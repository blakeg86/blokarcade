#!/usr/bin/env python3
"""
Provision iOS App Store signing credentials with the App Store Connect API.

Creates (or reuses) the bundle ID, mints a distribution certificate from a
fresh private key, creates an App Store provisioning profile for it, and writes
`credentials.json` + the cert/profile files that EAS Build consumes with
`credentialsSource: "local"`.

Env:
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH   App Store Connect API key
  BUNDLE_ID                                  e.g. app.rork.blokarcade-match-run-drop
  APP_NAME                                   used for bundle ID / profile names
  P12_PASSWORD                               password for the exported .p12
  EXISTING_P12_B64                           optional: reuse a previously created cert (profile is
                                             looked up / regenerated from it)
  REVOKE_CERT_FINGERPRINTS                   optional: comma-separated SHA-1 fingerprints of
                                             orphaned distribution certs to revoke first
  REVOKE_CERTS_NEWER_THAN_HOURS              optional: also revoke certs issued within this window
  KEEP_CERT_FINGERPRINTS                     optional: never revoke these
"""
import base64
import datetime as dt
import json
import os
import pathlib
import sys
import time

import jwt
import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

API = "https://api.appstoreconnect.apple.com/v1"
OUT = pathlib.Path("credentials")
OUT.mkdir(exist_ok=True)

KEY_ID = os.environ["ASC_KEY_ID"]
ISSUER = os.environ["ASC_ISSUER_ID"]
KEY_PATH = os.environ["ASC_KEY_PATH"]
BUNDLE_ID = os.environ["BUNDLE_ID"]
APP_NAME = os.environ.get("APP_NAME", "App")
P12_PASSWORD = os.environ.get("P12_PASSWORD", "expo")


def token() -> str:
    now = int(time.time())
    payload = {"iss": ISSUER, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}
    return jwt.encode(payload, open(KEY_PATH).read(), algorithm="ES256", headers={"kid": KEY_ID})


def call(method: str, path: str, **kw):
    r = requests.request(method, f"{API}{path}", headers={"Authorization": f"Bearer {token()}"}, timeout=60, **kw)
    if r.status_code >= 400:
        print(f"{method} {path} -> {r.status_code}\n{r.text}", file=sys.stderr)
        r.raise_for_status()
    return r.json() if r.text else {}


def ensure_bundle_id() -> str:
    found = call("GET", "/bundleIds", params={"filter[identifier]": BUNDLE_ID, "filter[platform]": "IOS"})
    for b in found.get("data", []):
        if b["attributes"]["identifier"] == BUNDLE_ID:
            print(f"bundle id exists: {b['id']}")
            return b["id"]
    created = call(
        "POST",
        "/bundleIds",
        json={"data": {"type": "bundleIds", "attributes": {"identifier": BUNDLE_ID, "name": APP_NAME, "platform": "IOS"}}},
    )
    print(f"bundle id created: {created['data']['id']}")
    return created["data"]["id"]


def sha1_fingerprint(cert_b64: str) -> str:
    cert = x509.load_der_x509_certificate(base64.b64decode(cert_b64))
    return cert.fingerprint(hashes.SHA1()).hex().upper()


def revoke_orphaned_certificates():
    """Apple allows a single current iOS Distribution certificate. If an earlier
    run created one whose private key we no longer have, revoke it (only when its
    fingerprint is explicitly listed) so a fresh one can be issued."""
    wanted = {f.strip().upper() for f in os.environ.get("REVOKE_CERT_FINGERPRINTS", "").split(",") if f.strip()}
    newer_than_hours = float(os.environ.get("REVOKE_CERTS_NEWER_THAN_HOURS", "0") or 0)
    keep = {f.strip().upper() for f in os.environ.get("KEEP_CERT_FINGERPRINTS", "").split(",") if f.strip()}
    now = dt.datetime.now(dt.timezone.utc)
    existing = call("GET", "/certificates", params={"filter[certificateType]": "IOS_DISTRIBUTION", "limit": 200}).get("data", [])
    for c in existing:
        cert = x509.load_der_x509_certificate(base64.b64decode(c["attributes"]["certificateContent"]))
        fp = cert.fingerprint(hashes.SHA1()).hex().upper()
        issued = getattr(cert, "not_valid_before_utc", None) or cert.not_valid_before.replace(tzinfo=dt.timezone.utc)
        age_h = (now - issued).total_seconds() / 3600
        recent = newer_than_hours > 0 and age_h < newer_than_hours
        if fp not in keep and (fp in wanted or recent):
            call("DELETE", f"/certificates/{c['id']}")
            print(f"revoked orphaned certificate {c['id']} ({fp})")
        else:
            print(f"existing IOS_DISTRIBUTION certificate {c['id']} fingerprint {fp} issued {issued:%Y-%m-%d} (kept)")


def find_certificate_id(fingerprint: str):
    for c in call("GET", "/certificates", params={"filter[certificateType]": "IOS_DISTRIBUTION", "limit": 200}).get("data", []):
        if sha1_fingerprint(c["attributes"]["certificateContent"]) == fingerprint:
            return c["id"]
    return None


def ensure_profile(bundle_id_res: str, cert_id: str) -> bytes:
    """Return an App Store profile for this bundle ID + certificate, creating one if needed."""
    profiles = call(
        "GET",
        "/profiles",
        params={"filter[profileType]": "IOS_APP_STORE", "filter[profileState]": "ACTIVE", "include": "bundleId,certificates", "limit": 200},
    )
    for p in profiles.get("data", []):
        rel = p.get("relationships", {})
        b = (rel.get("bundleId", {}).get("data") or {}).get("id")
        certs = {c["id"] for c in rel.get("certificates", {}).get("data", [])}
        if b == bundle_id_res and cert_id in certs and p["attributes"].get("profileContent"):
            print(f"reusing profile {p['id']} ({p['attributes']['name']})")
            return base64.b64decode(p["attributes"]["profileContent"])
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M")
    created = call(
        "POST",
        "/profiles",
        json={
            "data": {
                "type": "profiles",
                "attributes": {"name": f"{APP_NAME} App Store {stamp}", "profileType": "IOS_APP_STORE"},
                "relationships": {
                    "bundleId": {"data": {"type": "bundleIds", "id": bundle_id_res}},
                    "certificates": {"data": [{"type": "certificates", "id": cert_id}]},
                },
            }
        },
    )
    print(f"profile created: {created['data']['id']}")
    return base64.b64decode(created["data"]["attributes"]["profileContent"])


def write_credentials(p12_path: pathlib.Path, profile_path: pathlib.Path):
    creds = {
        "ios": {
            "provisioningProfilePath": str(profile_path),
            "distributionCertificate": {"path": str(p12_path), "password": P12_PASSWORD},
        }
    }
    pathlib.Path("credentials.json").write_text(json.dumps(creds, indent=2))
    print("wrote credentials.json")


def main():
    p12_path = OUT / "dist.p12"
    profile_path = OUT / "appstore.mobileprovision"

    existing_p12 = os.environ.get("EXISTING_P12_B64", "").strip()
    bundle_id_res = ensure_bundle_id()

    if existing_p12:
        p12_bytes = base64.b64decode(existing_p12)
        _, cert, _ = pkcs12.load_key_and_certificates(p12_bytes, P12_PASSWORD.encode())
        fp = cert.fingerprint(hashes.SHA1()).hex().upper()
        cert_id = find_certificate_id(fp)
        if cert_id:
            print(f"reusing stored distribution certificate {cert_id} ({fp})")
            p12_path.write_bytes(p12_bytes)
            profile_path.write_bytes(ensure_profile(bundle_id_res, cert_id))
            write_credentials(p12_path, profile_path)
            return
        print(f"stored certificate {fp} no longer exists on Apple; issuing a new one")

    revoke_orphaned_certificates()

    # New key + CSR
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, f"{APP_NAME} Distribution")]))
        .sign(key, hashes.SHA256())
    )
    csr_pem = csr.public_bytes(serialization.Encoding.PEM).decode()

    cert_res = call(
        "POST",
        "/certificates",
        json={"data": {"type": "certificates", "attributes": {"certificateType": "IOS_DISTRIBUTION", "csrContent": csr_pem}}},
    )
    cert_id = cert_res["data"]["id"]
    cert_der = base64.b64decode(cert_res["data"]["attributes"]["certificateContent"])
    cert = x509.load_der_x509_certificate(cert_der)
    print(f"certificate created: {cert_id}, expires {cert.not_valid_after_utc if hasattr(cert, 'not_valid_after_utc') else cert.not_valid_after}")

    # macOS `security import` (used by EAS build workers) can't read PBES2/AES
    # PKCS#12 files, so use the legacy SHA1 + 3DES encryption Apple expects.
    legacy = (
        serialization.PrivateFormat.PKCS12.encryption_builder()
        .kdf_rounds(50000)
        .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
        .hmac_hash(hashes.SHA1())
        .build(P12_PASSWORD.encode())
    )
    p12 = pkcs12.serialize_key_and_certificates(
        name=b"distribution", key=key, cert=cert, cas=None, encryption_algorithm=legacy
    )
    p12_path.write_bytes(p12)

    profile_path.write_bytes(ensure_profile(bundle_id_res, cert_id))

    write_credentials(p12_path, profile_path)
    # Emit base64 copies so they can be saved as secrets and reused next time.
    (OUT / "dist.p12.b64").write_text(base64.b64encode(p12_path.read_bytes()).decode())


if __name__ == "__main__":
    main()
