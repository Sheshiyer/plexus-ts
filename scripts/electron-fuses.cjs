const fs = require('node:fs');
const path = require('node:path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

const FUSE_KEYS = {
  runAsNode: FuseV1Options.RunAsNode,
  enableCookieEncryption: FuseV1Options.EnableCookieEncryption,
  enableNodeOptionsEnvironmentVariable: FuseV1Options.EnableNodeOptionsEnvironmentVariable,
  enableNodeCliInspectArguments: FuseV1Options.EnableNodeCliInspectArguments,
  enableEmbeddedAsarIntegrityValidation: FuseV1Options.EnableEmbeddedAsarIntegrityValidation,
  onlyLoadAppFromAsar: FuseV1Options.OnlyLoadAppFromAsar,
  loadBrowserProcessSpecificV8Snapshot: FuseV1Options.LoadBrowserProcessSpecificV8Snapshot,
  grantFileProtocolExtraPrivileges: FuseV1Options.GrantFileProtocolExtraPrivileges,
};

function firstExisting(paths) {
  return paths.find(candidate => candidate && fs.existsSync(candidate));
}

function firstFileIn(dir, predicate) {
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    const candidate = path.join(dir, name);
    const stat = fs.statSync(candidate);
    if (stat.isFile() && predicate(candidate, name, stat)) return candidate;
  }
  return null;
}

function firstEntryIn(dir, predicate) {
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    const candidate = path.join(dir, name);
    const stat = fs.statSync(candidate);
    if (predicate(candidate, name, stat)) return candidate;
  }
  return null;
}

function findMacExecutable(context, appName) {
  const appDir = firstExisting([
    path.join(context.appOutDir, `${appName}.app`),
  ]) ?? firstEntryIn(context.appOutDir, (_candidate, name, stat) => stat.isDirectory() && name.endsWith('.app'));
  if (!appDir) throw new Error(`Could not find packaged .app in ${context.appOutDir}`);

  const macosDir = path.join(appDir, 'Contents', 'MacOS');
  const executableName = context.packager.executableName || context.packager.appInfo.productFilename || appName;
  return firstExisting([
    path.join(macosDir, executableName),
    path.join(macosDir, context.packager.appInfo.productFilename),
    path.join(macosDir, appName),
  ]) ?? firstFileIn(macosDir, (_candidate, _name, stat) => Boolean(stat.mode & 0o111));
}

function findWindowsExecutable(context, appName) {
  const executableName = `${context.packager.appInfo.productFilename || appName}.exe`;
  return firstExisting([
    path.join(context.appOutDir, executableName),
    path.join(context.appOutDir, `${appName}.exe`),
  ]) ?? firstFileIn(context.appOutDir, (_candidate, name) => name.endsWith('.exe') && !name.toLowerCase().includes('uninstall'));
}

function findLinuxExecutable(context, appName) {
  const executableName = context.packager.executableName || context.packager.appInfo.productFilename || appName;
  return firstExisting([
    path.join(context.appOutDir, executableName),
    path.join(context.appOutDir, appName),
  ]) ?? firstFileIn(context.appOutDir, (_candidate, _name, stat) => Boolean(stat.mode & 0o111));
}

function electronExecutablePath(context) {
  const appName = context.packager.appInfo.productFilename || context.packager.appInfo.productName || 'Plexus';
  const executable = context.electronPlatformName === 'darwin'
    ? findMacExecutable(context, appName)
    : context.electronPlatformName === 'win32'
      ? findWindowsExecutable(context, appName)
      : findLinuxExecutable(context, appName);
  if (!executable) throw new Error(`Could not find packaged Electron executable in ${context.appOutDir}`);
  return executable;
}

function fuseConfig(context) {
  const pkgPath = path.join(context.packager.projectDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const policy = pkg.plexusElectronFuses || {};
  const config = {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: context.electronPlatformName === 'darwin',
  };
  for (const [policyKey, fuseKey] of Object.entries(FUSE_KEYS)) {
    if (typeof policy[policyKey] !== 'boolean') {
      throw new Error(`Missing boolean plexusElectronFuses.${policyKey} in package.json`);
    }
    config[fuseKey] = policy[policyKey];
  }
  return config;
}

exports.default = async function applyPlexusElectronFuses(context) {
  const executable = electronExecutablePath(context);
  await flipFuses(executable, fuseConfig(context));
  console.log(`[electron-fuses] applied Plexus fuse policy to ${executable}`);
};
