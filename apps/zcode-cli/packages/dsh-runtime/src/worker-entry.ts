import { runDshDomainWorker } from './worker.js';

try {
  await runDshDomainWorker();
  process.exit(0);
} catch (error) {
  process.stderr.write(`DSH worker failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
