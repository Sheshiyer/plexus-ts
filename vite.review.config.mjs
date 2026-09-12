import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import base from './vite.config.mjs';
import { cambiumReviewSource } from './scripts/cambium-review-source.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = process.env.CAMBIUM_SOURCE_LIBRARY
  ?? path.resolve(root, '../../cambium/docs/assets/visual-flow/source-library');
const reviewMap = JSON.parse(readFileSync(path.join(root, 'docs/design/cambium-consumption-map.v1.json'), 'utf8'));

// This config is selected only by review:design. Default Vite/Electron builds
// have neither the reference endpoint nor access to the Cambium source folder.
export default mergeConfig(base, {
  plugins: [cambiumReviewSource({ sourceRoot, reviewMap })],
});
