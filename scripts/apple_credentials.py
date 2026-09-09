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
  EXISTING_P12_B64 / EXISTING_PROFILE_B64    optional: reuse previously created files
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
    existing_profile = os.environ.get("EXISTING_PROFILE_B64", "").strip()
    if existing_p12 and existing_profile:
        p12_path.write_bytes(base64.b64decode(existing_p12))
        profile_path.write_bytes(base64.b64decode(existing_profile))
        print("reusing credentials from secrets")
        write_credentials(p12_path, profile_path)
        return

    bundle_id_res = ensure_bundle_id()

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
        .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESC)
        .hmac_hash(hashes.SHA1())
        .build(P12_PASSWORD.encode())
    )
    p12 = pkcs12.serialize_key_and_certificates(
        name=b"distribution", key=key, cert=cert, cas=None, encryption_algorithm=legacy
    )
    p12_path.write_bytes(p12)

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M")
    profile_res = call(
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
    profile_path.write_bytes(base64.b64decode(profile_res["data"]["attributes"]["profileContent"]))
    print(f"profile created: {profile_res['data']['id']}")

    write_credentials(p12_path, profile_path)
    # Emit base64 copies so they can be saved as secrets and reused next time.
    (OUT / "dist.p12.b64").write_text(base64.b64encode(p12_path.read_bytes()).decode())
    (OUT / "appstore.mobileprovision.b64").write_text(base64.b64encode(profile_path.read_bytes()).decode())


if __name__ == "__main__":
    main()
