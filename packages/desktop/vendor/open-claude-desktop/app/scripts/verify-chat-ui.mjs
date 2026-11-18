import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'src/generated/chat/provenance.json'), 'utf8'));
for (const entry of manifest) {
  const generated = await fs.readFile(path.join(root, 'src/generated/chat', entry.source));
  if (createHash('sha256').update(generated).digest('hex') !== entry.outputSha256)
    throw new Error(`Extracted Chat UI was modified: ${entry.source}. Regenerate it from source.`);
  const original = await fs.readFile(path.join(root, '../reference/current-2.2553.1/ion-dist/assets/v1', entry.source));
  if (createHash('sha256').update(original).digest('hex') !== entry.sha256)
    throw new Error(`Chat UI source changed: ${entry.source}. Inspect it and rerun scripts/extract-chat-ui.mjs.`);
}
