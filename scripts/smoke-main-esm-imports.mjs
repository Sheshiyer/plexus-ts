#!/usr/bin/env node
const shared = await import('../dist/shared/native-assistant.js');

for (const exportName of ['ASSISTANT_READ_ONLY_TOOLS', 'ASSISTANT_CONFIRM_REQUIRED_TOOLS']) {
  if (!Object.prototype.hasOwnProperty.call(shared, exportName)) {
    throw new Error(`dist/shared/native-assistant.js is missing ${exportName}`);
  }
}

const runtime = await import('../dist/main/assistant-runtime.js');
const permissions = await import('../dist/main/assistant-permissions.js');

for (const [moduleName, symbolName, moduleExports] of [
  ['assistant-runtime', 'buildAssistantToolSchemas', runtime],
  ['assistant-permissions', 'getAssistantToolPermission', permissions],
]) {
  if (typeof moduleExports[symbolName] !== 'function') {
    throw new Error(`dist/main/${moduleName}.js did not export ${symbolName}()`);
  }
}

console.log('[smoke-main-esm-imports] dist main/shared ESM imports ok');
