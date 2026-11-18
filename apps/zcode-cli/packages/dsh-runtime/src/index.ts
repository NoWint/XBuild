export type * from './contract.js';
export { DshDomainError } from './ipc.js';
export { startDshDomain } from './supervisor.js';
export { withDshDataMaintenance } from './ownership.js';
export async function runDshDomainWorker(): Promise<void> {
  const { runDshDomainWorker: run } = await import('./worker.js');
  await run();
}
