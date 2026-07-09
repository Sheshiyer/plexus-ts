#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(repoRoot, 'src/renderer/index.html'), 'utf8');
const mainSource = readFileSync(path.join(repoRoot, 'src/main/main.ts'), 'utf8');

function fail(message) {
  console.error(`[verify:csp] ${message}`);
  process.exit(1);
}

function parseDirectives(content) {
  const directives = new Map();
  for (const rawDirective of content.split(';')) {
    const parts = rawDirective.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    directives.set(parts[0], parts.slice(1));
  }
  return directives;
}

const metaMatch = html.match(/<meta\b(?=[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1)[^>]*>/i);
if (!metaMatch) fail('src/renderer/index.html is missing a Content-Security-Policy meta tag.');

const contentMatch = metaMatch[0].match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
if (!contentMatch) fail('Content-Security-Policy meta tag is missing a content attribute.');

const csp = contentMatch[2];
const directives = parseDirectives(csp);

function values(name) {
  return directives.get(name) ?? [];
}

function requireIncludes(name, expected) {
  if (!values(name).includes(expected)) {
    fail(`${name} must include ${expected}.`);
  }
}

function forbidIncludes(name, forbidden) {
  if (values(name).includes(forbidden)) {
    fail(`${name} must not include ${forbidden}.`);
  }
}

for (const name of ['default-src', 'base-uri', 'object-src', 'frame-ancestors', 'script-src', 'connect-src']) {
  if (!directives.has(name)) fail(`Missing CSP directive: ${name}.`);
}

requireIncludes('default-src', "'self'");
requireIncludes('base-uri', "'self'");
requireIncludes('object-src', "'none'");
requireIncludes('frame-ancestors', "'none'");
requireIncludes('script-src', "'self'");
requireIncludes('connect-src', "'self'");
requireIncludes('connect-src', 'https://api.github.com');
requireIncludes('connect-src', 'https://curious.thoughtseed.space');
requireIncludes('connect-src', 'https://plexus-upgrade.thoughtseed.space');

for (const name of ['default-src', 'script-src', 'connect-src', 'img-src', 'media-src']) {
  forbidIncludes(name, '*');
  forbidIncludes(name, "'unsafe-eval'");
}

const scriptValues = values('script-src');
const remoteScript = scriptValues.find((value) => /^https?:\/\//i.test(value));
if (remoteScript) fail(`script-src must not allow remote script origins; found ${remoteScript}.`);

const connectValues = values('connect-src');
const disallowedHttp = connectValues.find((value) => /^http:\/\//i.test(value) && !/^http:\/\/127\.0\.0\.1:\*/.test(value));
if (disallowedHttp) fail(`connect-src only allows http://127.0.0.1:* for local API access; found ${disallowedHttp}.`);

function requireMainPolicy(snippet, description) {
  if (!mainSource.includes(snippet)) fail(`src/main/main.ts must enforce ${description}.`);
}

for (const [snippet, description] of [
  ['contextIsolation: true', 'contextIsolation for the renderer window'],
  ['nodeIntegration: false', 'nodeIntegration disabled for the renderer window'],
  ['nodeIntegrationInWorker: false', 'nodeIntegration disabled in renderer workers'],
  ['nodeIntegrationInSubFrames: false', 'nodeIntegration disabled in renderer subframes'],
  ['sandbox: true', 'renderer sandboxing'],
  ['webSecurity: true', 'webSecurity for the renderer window'],
  ['mainWindow.webContents.setWindowOpenHandler', 'popup interception'],
  ["return { action: 'deny' }", 'popup denial'],
  ["mainWindow.webContents.on('will-navigate'", 'navigation interception'],
  ['isAllowedRendererNavigation(url, allowedRendererOrigin)', 'navigation allowlisting'],
  ["mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))", 'production file loading'],
]) {
  requireMainPolicy(snippet, description);
}

console.log('[verify:csp] renderer CSP policy ok');
