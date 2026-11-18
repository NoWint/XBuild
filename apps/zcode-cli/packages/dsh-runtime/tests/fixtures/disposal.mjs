export const name = 'disposal-outcome-fixture';

export function apply(ctx, config) {
  ctx.effect(() => () => {
    if (config.hang) return new Promise(() => {});
    throw new Error('native-disposer-rejected');
  });
}
