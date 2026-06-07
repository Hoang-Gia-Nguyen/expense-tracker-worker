import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await esbuild.build({
  entryPoints: [path.join(root, 'index.js')],
  bundle: true,
  outfile: path.join(root, '.test-bundle', 'worker.mjs'),
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: false,
  minify: false,
});

console.log('Worker bundled for testing: .test-bundle/worker.mjs');
