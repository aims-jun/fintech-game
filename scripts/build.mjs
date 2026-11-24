import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const output = 'dist';
await rm(output, { recursive: true, force: true });
await mkdir(output);

for (const file of ['index.html', 'touch-center.css', 'touch-center.js', 'assets']) {
  await cp(file, join(output, file), { recursive: true });
}
for (const game of ['paper-race', 'one-shot']) {
  await mkdir(join(output, game));
  for (const file of await readdir(game)) {
    if (file === 'assets' || /\.(html|css|js)$/.test(file)) {
      await cp(join(game, file), join(output, game, file), { recursive: true });
    }
  }
}
