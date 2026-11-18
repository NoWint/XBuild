import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'src/generated/code-editor');
const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
for (const entry of manifest.modules) {
  for (const base of [output, path.resolve(root, '../reference/current-2.31226.0/ion-dist/assets/v1')]) {
    const bytes = await fs.readFile(path.join(base, entry.name));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error(`Code editor provenance mismatch: ${base}/${entry.name}`);
  }
}
for (const entry of manifest.adapters ?? []) {
  const bytes = await fs.readFile(path.join(output, entry.name));
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error(`Editor adapter changed: ${entry.name}`);
  for (const ref of entry.sources) {
    const original = await fs.readFile(path.resolve(root, '../reference/current-2.31226.0/ion-dist/assets/v1', ref.name));
    if (createHash('sha256').update(original).digest('hex') !== ref.sha256) throw Error(`Editor adapter source changed: ${ref.name}`);
  }
}
for(const copy of manifest.copies??[]) {
 const bytes=await fs.readFile(path.join(root,copy.target));
 if(createHash('sha256').update(bytes).digest('hex')!==copy.sha256)throw Error(`Editor worker copy changed: ${copy.target}`);
}
console.log(`Verified ${manifest.modules.length} original CodeMirror modules (${manifest.referenceVersion}).`);
