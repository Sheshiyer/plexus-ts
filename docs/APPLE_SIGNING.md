# Apple Developer ID Signing + Notarization Guide

> For Plexus and any Electron/macOS app you distribute outside the App Store.

## What You Have vs. What You Need

| Item | Status | How to Get |
|---|---|---|
| Apple Developer Account ($99/yr) | ✅ You have this | developer.apple.com |
| **Developer ID Application Certificate** | ⚠️ Need to create | See Step 1 below |
| **Developer ID Installer Certificate** | ⚠️ Optional (for `.pkg`) | Same as above |
| **Apple Team ID** | ✅ In your account | developer.apple.com → Membership |
| **App-Specific Password** | ⚠️ Need to create | See Step 2 below |
| `.p12` certificate file on your Mac | ⚠️ Need to export | See Step 3 below |

---

## Step 1: Create the Developer ID Application Certificate

**Where:** [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles

1. Click **"+"** (Create a certificate)
2. Select **"Developer ID Application"** (NOT "iOS Distribution" or "Mac App Distribution")
3. Follow the prompts to create a **Certificate Signing Request (CSR)** from Keychain Access:
   - Open **Keychain Access** (in `/Applications/Utilities/`)
   - Menu: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**
   - User Email Address: your Apple ID email
   - Common Name: `Thoughtseed Developer ID` (or whatever you want)
   - **CA Email:** leave blank
   - Check **"Saved to disk"**
   - Save as `certSigningRequest.certSigningRequest`
4. Upload the CSR file to Apple
5. Apple generates and downloads a `.cer` file: `developerID_application.cer`
6. Double-click the `.cer` file to install it in your **login** keychain

---

## Step 2: Create an App-Specific Password (for Notarization)

**Why:** Apple doesn't let you use your regular Apple ID password for notarization. You need a special app-specific password.

**Where:** [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords

1. Sign in with your Apple ID
2. Go to **Sign-In and Security** → **App-Specific Passwords**
3. Click **"Generate an app-specific password"**
4. Name it: `Plexus Notarization` (or the project name)
5. Copy the generated password (it looks like `abcd-efgh-ijkl-mnop`) — **you can only see it once!**

---

## Step 3: Export the .p12 Certificate File

**Why:** This bundles your certificate + private key into a single file that `electron-builder` can use for signing.

1. Open **Keychain Access**
2. In the **login** keychain, find your certificate:
   - Name: `Developer ID Application: Your Name (TEAMID)`
3. Expand the certificate and **select both the certificate AND the private key** below it
   - (Hold ⌘ and click both)
4. Right-click → **Export 2 Items...**
5. Save as `plexus_dev_id.p12` (or any name)
6. **Format:** Personal Information Exchange (.p12)
7. Set a password when prompted (save this password!)
8. Move the `.p12` file to your project directory (or a safe location)

---

## Step 4: Get Your Apple Team ID

1. Go to [developer.apple.com](https://developer.apple.com) → **Account** → **Membership**
2. Look for **"Team ID"** — it's a 10-character string like `ABC123DEF4`
3. Copy it — you'll need it

---

## Step 5: Set Up Environment Variables

You have two options for providing credentials to the build:

### Option A: Environment Variables (Recommended for CI/CD)

```bash
# Add to your ~/.zshrc or ~/.bash_profile for persistence
export CSC_LINK="/path/to/plexus_dev_id.p12"        # Or base64-encoded string
export CSC_KEY_PASSWORD="your-p12-password"
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="YOURTEAMID10"
```

After adding, reload:
```bash
source ~/.zshrc
```

### Option B: Base64-Encoded Certificate (Better for CI/GitHub Actions)

Convert your `.p12` to a base64 string:
```bash
base64 -i ~/path/to/plexus_dev_id.p12 | pbcopy
```

Paste this as `CSC_LINK` in your CI secrets (or `.env` file):
```bash
export CSC_LINK="base64:MIILtAIBAzC...very-long-string..."
export CSC_KEY_PASSWORD="your-p12-password"
```

---

## Step 6: Update Project Configuration

The project is already configured. Here's what was added:

### `scripts/notarize.js` (already created)

This hook runs automatically after `electron-builder` signs the app. It uploads the `.app` to Apple's notarization service, waits for approval, and staples the ticket to the app.

### `package.json` build config (already has)

```json
"mac": {
  "category": "public.app-category.productivity",
  "target": ["dmg", "zip"],
  "icon": "assets/icons/icon.icns",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "scripts/entitlements.mac.plist",
  "entitlementsInherit": "scripts/entitlements.mac.plist"
}
```

### `scripts/entitlements.mac.plist` (will create if needed)

This tells macOS what permissions the app needs. For Electron apps, you typically need:
- `com.apple.security.cs.allow-jit` (for V8)
- `com.apple.security.cs.allow-unsigned-executable-memory`
- `com.apple.security.cs.allow-dyld-environment-variables`

---

## Step 7: Build with Signing + Notarization

### Build and Sign (auto-notarization if env vars are set)
```bash
npm run build
```

If the `APPLE_ID` env var is set, the `afterSign` hook in `scripts/notarize.js` will run automatically.

### Build Unsigned (for testing)
```bash
SKIP_NOTARIZATION=true npm run build
```

---

## Step 8: Verify the Build

### Check codesign
```bash
codesign -dvv release/mac-arm64/Plexus.app
```

You should see:
```
Authority=Developer ID Application: Your Name (TEAMID)
Authority=Apple Root CA
```

### Check notarization (staple)
```bash
xcrun stapler validate release/mac-arm64/Plexus.app
```

Expected: `The validate action worked!`

### Check notarization history (if you're curious)
```bash
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

### Check DMG
```bash
codesign -dvv release/Plexus-0.2.0-arm64.dmg
xcrun stapler validate release/Plexus-0.2.0-arm64.dmg
```

---

## Troubleshooting

### "errSecInternalComponent" during signing
- **Cause:** The signing process is trying to access the keychain and can't find the certificate or the keychain is locked.
- **Fix:** Make sure the certificate is in your **login** keychain, not **System**. Try:
  ```bash
  security unlock-keychain login.keychain
  ```

### "The bundle identifier doesn't match"
- **Cause:** The `appId` in `package.json` doesn't match the certificate.
- **Fix:** `Developer ID Application` certificates are NOT tied to a specific bundle ID. This error usually means you're using the wrong certificate type (Mac App Distribution instead of Developer ID).

### Notarization takes forever (30+ minutes)
- **Normal:** First-time notarization can take 15-30 minutes. Subsequent ones are faster.
- **Check status:**
  ```bash
  xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"
  ```

### "The staple and validate action failed"
- **Cause:** The notarization completed but the ticket wasn't stapled to the app.
- **Fix:**
  ```bash
  xcrun stapler staple release/mac-arm64/Plexus.app
  ```

### "App can't be opened because it is from an unidentified developer"
- **Cause:** The app isn't signed with Developer ID, or the notarization ticket isn't stapled.
- **Fix:** Run `codesign` and `stapler` steps above. If unsigned, right-click → Open.

---

## Quick Reference: Required Values

Fill these in and keep them safe:

```
APPLE_ID:                  ________________________
APPLE_APP_SPECIFIC_PASSWORD: ________________________
APPLE_TEAM_ID:             ________________________ (10 chars)
CSC_LINK:                  ________________________ (path or base64)
CSC_KEY_PASSWORD:          ________________________
```

---

## Next Steps After This Guide

1. Add the Apple signing secrets to GitHub Actions.
2. Add the R2 OTA feed secrets listed in `docs/OTA_RELEASE.md`.
3. Run the Release workflow or push a `v*` tag.
4. Confirm the DMG, ZIP, blockmap, and `latest-mac.yml` are uploaded.
5. Check for updates from packaged Plexus Settings.

---

MIT © Thoughtseed
