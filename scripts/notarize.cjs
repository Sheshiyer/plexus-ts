/**
 * Notarization script for electron-builder afterSign hook.
 * Runs automatically after signing with a Keychain profile or explicit Apple credentials.
 *
 * Required env vars:
 *   APPLE_ID              - Your Apple Developer email
 *   APPLE_APP_SPECIFIC_PASSWORD - App-specific password (see guide)
 *   APPLE_TEAM_ID         - Your Apple Developer Team ID
 *
 * Optional:
 *   APPLE_NOTARY_KEYCHAIN_PROFILE - Existing notarytool Keychain profile (preferred locally)
 *   SKIP_NOTARIZATION     - Set to "true" to skip (for local unsigned builds)
 */

const { notarize } = require('@electron/notarize');

async function main(context) {
  const { electronPlatformName, appOutDir } = context;
  const requireNotarization = process.env.REQUIRE_NOTARIZATION === 'true';

  if (electronPlatformName !== 'darwin') {
    console.log('[notarize] Skipping — not macOS platform');
    return;
  }

  if (process.env.SKIP_NOTARIZATION === 'true') {
    if (requireNotarization) {
      throw new Error('Notarization is required, but SKIP_NOTARIZATION=true was provided.');
    }
    console.log('[notarize] Skipping — SKIP_NOTARIZATION=true');
    return;
  }

  const appId = 'space.thoughtseed.plexus';
  const appPath = `${appOutDir}/Plexus.app`;

  const keychainProfile = process.env.APPLE_NOTARY_KEYCHAIN_PROFILE?.trim();
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!keychainProfile && (!appleId || !appleIdPassword || !teamId)) {
    if (requireNotarization) {
      throw new Error('Notarization is required, but Apple credentials are missing.');
    }
    console.warn('[notarize] Missing Apple credentials — skipping notarization');
    console.warn('[notarize] Set APPLE_NOTARY_KEYCHAIN_PROFILE or APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID');
    return;
  }

  console.log(`[notarize] Notarizing ${appId} at ${appPath}...`);

  await notarize({
    appPath,
    ...(keychainProfile ? { keychainProfile } : { appleId, appleIdPassword, teamId }),
    tool: 'notarytool',
  });

  console.log('[notarize] ✅ Notarization complete');
}

module.exports = main;

// Allow direct execution for testing
if (require.main === module) {
  console.log('[notarize] This script runs via electron-builder afterSign hook.');
  console.log('[notarize] Do not run directly. Set env vars and run: npm run build');
  process.exit(0);
}
