import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

export const name = 'descendant-lifetime-fixture';

export async function apply(ctx, config) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { spawn } from 'node:child_process';
    const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    grandchild.once('spawn', () => process.send({ pid: grandchild.pid }));
    process.once('message', () => {
      grandchild.once('exit', () => process.exit(0));
      grandchild.kill('SIGKILL');
    });
    setInterval(() => {}, 1000);
  `], { detached: config.detached, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const grandchild = await new Promise((resolve, reject) => {
    child.once('message', message => resolve(message.pid));
    child.once('error', reject);
  });
  await writeFile(config.pidFile, JSON.stringify([child.pid, grandchild]));
  if (config.reap) ctx.effect(() => () => new Promise((resolve, reject) => {
    child.once('exit', resolve);
    child.once('error', reject);
    child.send('stop');
  }));
  if (config.failStartup) throw new Error('descendant-fixture-startup-failure');
  if (config.hang) ctx.effect(() => () => new Promise(() => {}));
}
