# BlokArcade

Six tiny monochrome arcade games behind one hub screen — Jump Run, Gem Match, Tap Stack, Brik Break, Zig Zag and Snake. Expo SDK 57 / React Native / expo-router, TypeScript.

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go, or press i / a / w
```

## Verify

```bash
npm run typecheck       # tsc
npm test                # jest — pure game-logic tests in __tests__/
npx expo export --platform web && python3 -m http.server 8090 -d dist &
node scripts/smoke.mjs  # Playwright: plays every game headlessly, fails on console errors
```

## Ship to the App Store

`.github/workflows/ios-release.yml` builds with EAS and submits to App Store Connect. It needs these repository secrets:

| Secret | What |
|---|---|
| `EXPO_TOKEN` | Expo access token |
| `ASC_KEY_P8` | Contents of the App Store Connect API key (`AuthKey_XXXX.p8`) |
| `ASC_KEY_ID`, `ASC_ISSUER_ID` | From the App Store Connect → Integrations page |
| `APPLE_TEAM_ID` | Developer account Team ID |
| `P12_PASSWORD` | Any password; protects the generated signing certificate |
| `ASC_APP_ID` | Numeric Apple ID of the app record in App Store Connect (needed for submit) |
| `IOS_DIST_P12_B64`, `IOS_PROFILE_B64` | Optional — set from the `ios-signing-credentials` artifact after the first run so later runs reuse the same certificate |

The first run mints a distribution certificate + App Store provisioning profile through Apple's API (`scripts/apple_credentials.py`) and passes them to EAS as local credentials.

## Layout

- `app/` — routes: `index` (hub) + one file per game
- `lib/` — pure game logic (testable without React)
- `constants/brickLevels.ts` — 16 hand-designed Brik Break boards, then procedural ones
- `hooks/useHighScores.ts` — one AsyncStorage record for all games (key kept as `BLOCARCADE_HIGH_SCORES` so old scores survive)
