import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('lets the trusted launcher resolve distribution metadata without importing native runtime code', () => {
  const manifest = new URL('../package.json', import.meta.url);
  const require = createRequire(manifest);
  expect(require.resolve('@zcode/dsh-runtime/package.json')).toBe(fileURLToPath(manifest));
});
