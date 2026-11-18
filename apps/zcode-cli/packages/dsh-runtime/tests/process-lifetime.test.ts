import { expect, it } from 'vitest';

it.each(['win32', 'freebsd'])('rejects unsupported native process ownership on %s before activation', async platform => {
  const adapter = await import('../dist/process-lifetime.js').catch(() => ({}));
  expect(adapter).toHaveProperty('assertProcessLifetimePlatform', expect.any(Function));
  expect(() => (adapter as typeof import('../dist/process-lifetime.js')).assertProcessLifetimePlatform(platform)).toThrow(expect.objectContaining({
    code: 'DSH_DOMAIN_PLATFORM_UNSUPPORTED',
  }));
});
