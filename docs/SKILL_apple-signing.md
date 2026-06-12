# Skill: Apple Developer ID Signing + Notarization

> Reusable guide for signing and notarizing any Electron/macOS app for distribution outside the App Store. Applicable to Plexus, Paperclip, and all future Thoughtseed macOS apps.

## Trigger
- `apple developer id`
- `sign macos app`
- `notarize electron`
- `code signing`
- `apple signing`
- `app notarization`

## Prerequisites
- Apple Developer Account ($99/year, already active)
- macOS machine for building

## One-Time Setup (Per Apple ID)

### 1. Get Your Team ID
1. Visit [developer.apple.com](https://developer.apple.com) → **Account** → **Membership**
2. Copy **"Team ID"** — 10-character string (e.g., `ABC123DEF4`)
3. Save it — you need it for every project

### 2. Create Developer ID Application Certificate
1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Certificates**
2. Click **+** (Create certificate)
3. Select **"Developer ID Application"** — NOT "Mac App Distribution"
4. Create CSR via Keychain Access:
   ```
   Keychain Access → Certificate Assistant → Request a Certificate...
   - Email: your Apple ID
   - Common Name: "Thoughtseed Developer ID"
   - CA Email: leave blank
   - Saved to disk: checked
   ```
5. Upload CSR → Apple generates `.cer` file
6. Double-click `.cer` to install in **login** keychain

### 3. Export .p12 Bundle
1. Keychain Access → **login** keychain
2. Find `Developer ID Application: Your Name (TEAMID)`
3. **⌘-click** both the certificate AND its private key below it
4. Right-click → **Export 2 Items...**
5. Save as `dev-id.p12`, format: Personal Information Exchange
6. Set a password — this is your `CSC_KEY_PASSWORD`

### 4. Create App-Specific Password
1. Visit [appleid.apple.com](https://appleid.apple.com) → **Sign-In and Security** → **App-Specific Passwords**
2. Generate password, name it "Plexus Notarization" (or project name)
3. **Copy immediately** — shown only once
4. This is your `APPLE_APP_SPECIFIC_PASSWORD`

## Per-Project Setup

### 1. Install Dependency
```bash
npm install --save-dev @electron/notarize
```

### 2. Create `scripts/notarize.js`

Already created for Plexus. For a new project:
```js
const { notarize } = require('@electron/notarize');

async function main(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;
  if (process.env.SKIP_NOTARIZATION === 'true') return;

  const appId = 'space.thoughtseed.yourapp'; // CHANGE THIS
  const appPath = `${appOutDir}/YourApp.app`; // CHANGE THIS

  await notarize({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
    tool: 'notarytool',
  });
  console.log('[notarize] ✅ Complete');
}
module.exports = main;
```

### 3. Create `scripts/entitlements.mac.plist`

Already created for Plexus. For a new project, copy the same file.

### 4. Update `package.json` build config

```json
"build": {
  "appId": "space.thoughtseed.yourapp",
  "mac": {
    "category": "public.app-category.productivity",
    "target": "dmg",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "scripts/entitlements.mac.plist",
    "entitlementsInherit": "scripts/entitlements.mac.plist"
  },
  "afterSign": "scripts/notarize.js"
}
```

### 5. Set Environment Variables

```bash
# Add to ~/.zshrc
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="YOURTEAMID10"
export CSC_LINK="/path/to/dev-id.p12"
export CSC_KEY_PASSWORD="your-p12-password"

# For CI (base64-encoded p12)
# export CSC_LINK="base64:MIILtAIBAzC..."
```

## Build + Verify

### Build (auto-sign + notarize)
```bash
npm run build
```

### Build unsigned (for testing)
```bash
SKIP_NOTARIZATION=true npm run build
```

### Verify Signature
```bash
codesign -dvv release/mac-arm64/YourApp.app
# Should show: Authority=Developer ID Application: Your Name (TEAMID)
```

### Verify Notarization
```bash
xcrun stapler validate release/mac-arm64/YourApp.app
# Should show: The validate action worked!
```

## GitHub Actions (Auto-Build on Release)

Create `.github/workflows/build.yml`:

```yaml
name: Build and Release
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run build
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
      - uses: actions/upload-artifact@v4
        with:
          name: macos-artifacts
          path: release/*.dmg
```

Add these secrets to your GitHub repo:
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `CSC_LINK` (base64-encoded p12)
- `CSC_KEY_PASSWORD`

## Quick Reference: Your Values

| Variable | Value | Source |
|---|---|---|
| `APPLE_ID` | `thoughtseedlabs@gmail.com` | Your Apple ID email |
| `APPLE_TEAM_ID` | `_____________` | developer.apple.com → Membership |
| `APPLE_APP_SPECIFIC_PASSWORD` | `_____________` | appleid.apple.com → App-Specific Passwords |
| `CSC_LINK` | `_____________` | Path to exported `.p12` file |
| `CSC_KEY_PASSWORD` | `_____________` | Password you set when exporting `.p12` |

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `errSecInternalComponent` | Keychain locked or cert in wrong keychain | `security unlock-keychain login.keychain` |
| `The bundle identifier doesn't match` | Using wrong cert type (Mac App Distribution) | Use **Developer ID Application**, not Mac App Distribution |
| Notarization timeout (30+ min) | Normal for first-time | Wait, or check status with `notarytool log` |
| `unidentified developer` warning | Not signed or not stapled | Run `codesign` + `stapler staple` |

---

**Plexus status:** Infra ready. Waiting for you to provide:
1. `APPLE_TEAM_ID`
2. `APPLE_APP_SPECIFIC_PASSWORD`
3. `.p12` file path or base64 string
4. `CSC_KEY_PASSWORD`

Once provided, run `npm run build` and the macOS DMG will be signed + notarized automatically.
