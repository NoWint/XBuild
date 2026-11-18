import { rm, writeFile } from 'node:fs/promises';
import * as runtime from '../../dist/index.js';

async function send(value) {
  await new Promise((resolve, reject) => process.send(value, error => error ? reject(error) : resolve()));
}

process.once('message', async ({ mode, options, proof }) => {
  try {
    if (mode === 'start') {
      const domain = await runtime.startDshDomain(options);
      await domain.stop();
    } else {
      await runtime.withDshDataMaintenance(options, async () => {
        await rm(options.dataDirectory, { recursive: true, force: true });
        if (mode === 'hold') {
          await send({ kind: 'held' });
          await new Promise(resolve => process.once('message', resolve));
        }
        if (proof) await writeFile(proof, 'maintenance-finished');
      });
    }
    await send({ kind: 'done' });
  } catch (error) {
    await send({ kind: 'error', code: error.code, message: error.message, details: error.details });
  } finally { process.exit(0); }
});
