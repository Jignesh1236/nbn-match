import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const env = { ...process.env };

// Some editors (for example Idiot Box) export their own ESBUILD_BINARY_PATH.
// esbuild refuses to start when that binary's version does not match the
// version installed in this project, so only use the project's own binary.
delete env.ESBUILD_BINARY_PATH;

const result = spawnSync(process.execPath, [viteBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
