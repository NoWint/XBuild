import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {_electron as electron} from '../../tools/node_modules/playwright/index.mjs'

// F09 home stats from the core (suite key "home-account-usage"). The isolated protocol
// fixture plays the DeepSeek bridge: its initialize lists capabilities.codeStats
// (fixture-core.json) and codeDesktop/stats/read answers the original getCodeStats object
// (fixture-usage.json, held behind release gates). Checks:
// 1) the hold skeleton is a delayed, waving SkeletonGroup (shared-frame hc) timed from the
//    home mount, whose pre-live tabs never hover;
// 2) every tile comes from the RPC, not from the profile's ledger, with no provenance
//    footer, no [title] and the messages heatmap; the result is kept in the profile;
// 3) the next launch paints the kept result at once and the fresh fold replaces it
//    through the 'stats' push event;
// 4) a DeepSeek core without a key shows the key card, and no generic connection card.
const root = path.resolve(import.meta.dirname, '..'), project = path.dirname(root), evidence = path.join(project, 'analysis/batch-20260920')
const directory = await fs.mkdtemp(path.join(evidence, 'home-account-usage-ui-')), profile = path.join(directory, 'profile'), workspace = path.join(profile, 'workspace')
await fs.mkdir(workspace, {recursive: true})
await fs.mkdir(path.join(profile, 'codex-home'))
const dayKey = offset => {const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`}
const T0 = dayKey(0), T1 = dayKey(1), T40 = dayKey(40)
const usage = (inputTokens, outputTokens) => ({inputTokens, outputTokens, cacheReadInputTokens: 0, cacheCreationInputTokens: 0})
// Full-history stats: 40 days back is outside the ledger's window entirely.
const statsA = {
  dailyActivity: [
    {date: T40, messageCount: 30, sessionCount: 2, toolCallCount: 9},
    {date: T1, messageCount: 8, sessionCount: 1, toolCallCount: 3},
    {date: T0, messageCount: 4, sessionCount: 0, toolCallCount: 1},
  ],
  dailyModelTokens: [
    {date: T40, tokensByModel: {fixture: 900000}},
    {date: T1, tokensByModel: {'fixture-1': 60000}},
    {date: T0, tokensByModel: {'fixture-1': 40000, fixture: 1000}},
  ],
  modelUsage: {fixture: usage(800000, 101000), 'fixture-1': usage(90000, 10000)},
  peakActivityHour: 15,
}
const statsB = {...statsA, dailyActivity: [...statsA.dailyActivity.slice(0, 2), {date: T0, messageCount: 10, sessionCount: 1, toolCallCount: 1}]}
// A ledger that would read very differently: it must not reach the card.
const ledger = {startedAt: new Date().toISOString(), days: {[T0]: {v: 2, messages: 999, sessions: 99, tokens: 5, hours: {3: 999}, models: {'fixture-5': 5}}}}
await fs.writeFile(path.join(profile, 'preferences.json'), JSON.stringify({cwd: workspace, theme: 'light', mode: 'code', threadIds: [], activity: ledger, stats: {}, onboarded: true /* first-run setup (source-onboarding.jsx) already done; this suite is about the home card */}))
await fs.writeFile(path.join(profile, 'fixture-core.json'), JSON.stringify({capabilities: {codeStats: true}}))
const writeAtomic = async (file, value) => {await fs.writeFile(file + '.tmp', JSON.stringify(value)); await fs.rename(file + '.tmp', file)}
const usageFixture = value => writeAtomic(path.join(profile, 'fixture-usage.json'), value)
const gate = name => path.join(profile, `fixture-usage-${name}`)
const exists = file => fs.access(file).then(() => true, () => false)
async function poll(check, label, timeout = 10000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {if (await check()) return; await new Promise(resolve => setTimeout(resolve, 25))}
  throw new Error(`Timed out: ${label}`)
}
const env = {...process.env, CODE_DESKTOP_DATA: profile, CODEX_HOME: path.join(profile, 'codex-home'), CODEX_BINARY: path.join(root, 'tests/fixtures/codex-server.cjs')}
delete env.ELECTRON_RUN_AS_NODE
delete env.CODE_DESKTOP_DEV_URL
const build = JSON.parse(await fs.readFile(path.join(root, 'dist/build-info.json'), 'utf8')), sha = bytes => createHash('sha256').update(bytes).digest('hex')
const integrity = async () => {
  assert.equal(sha(JSON.stringify(build.sources)), build.sourceSha256)
  for (const file of build.sources) assert.equal(sha(await fs.readFile(path.join(root, file.path))), file.sha256, `Build is stale: ${file.path}`)
}
const report = {at: new Date().toISOString(), directory, build: {version: build.version, sourceSha256: build.sourceSha256}, checks: [], metrics: {}, rendererErrors: [], passed: false}
let app, page
async function launch() {
  app = await electron.launch({args: [root], executablePath: path.join(root, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'), env, timeout: 20000})
  page = await app.firstWindow()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.rendererErrors.push(error.message))
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setContentSize(1324, 768))
  await page.waitForFunction(() => innerWidth === 1324 && innerHeight === 768)
}
const requests = () => fs.readFile(path.join(profile, 'fixture-requests.jsonl'), 'utf8').then(text => text.trim().split('\n').map(line => JSON.parse(line)), () => [])
const readTiles = () => page.locator('.sh-tile').evaluateAll(tiles => Object.fromEntries(tiles.map(tile => [tile.querySelector('.sh-tile-label').textContent, tile.querySelector('.sh-tile-value').textContent])))
const color = css => page.evaluate(css => {const probe = document.createElement('span'); probe.style.backgroundColor = css; document.querySelector('.cds-root').append(probe); const value = getComputedStyle(probe).backgroundColor; probe.remove(); return value}, css)
const peak = new Intl.DateTimeFormat(undefined, {hour: 'numeric'}).format(new Date(2000, 0, 1, 15))

try {
  await integrity()
  // ------------------------------------------------------------ launch 1: held RPC
  await usageFixture({'codeDesktop/stats/read': {result: statsA, hold: 'stats1'}})
  await launch()
  const hold = page.getByTestId('epitaxy-stats-hold')
  await hold.waitFor({state: 'attached'})
  const skeleton = await hold.evaluate(node => {
    const group = node.closest('[data-cds="SkeletonGroup"]'), style = getComputedStyle(group)
    const time = value => parseFloat(value) * (value.endsWith('ms') ? 1 : 1000)
    const skeletons = [...node.querySelectorAll('[data-cds="Skeleton"]')]
    return {role: group.getAttribute('role'), hold: group.dataset.hold, motion: group.dataset.motion, label: group.querySelector(':scope > .sr-only[data-skeleton-label]') !== null,
      elapsed: parseFloat(group.style.getPropertyValue('--cds-skel-elapsed')) || 0, settled: group.hasAttribute('data-settled'),
      reveal: [style.animationName, style.animationFillMode], delay: time(style.animationDelay),
      indices: skeletons.map(el => el.style.getPropertyValue('--cds-skel-i')), breathe: [...new Set(skeletons.map(el => getComputedStyle(el).animationName))]}
  })
  assert.deepEqual({role: skeleton.role, hold: skeleton.hold, motion: skeleton.motion, label: skeleton.label}, {role: 'status', hold: 'delayed', motion: 'wave', label: true})
  // cds-placeholder-reveal (opacity 0 → 1, backwards fill) starts .5s after the home mount:
  // delay = .5s − --cds-skel-elapsed (− the 100s --cds-skel-settled once it has run).
  assert.deepEqual(skeleton.reveal, ['cds-placeholder-reveal', 'backwards'])
  assert.ok(Math.abs(skeleton.delay + skeleton.elapsed + (skeleton.settled ? 1e5 : 0) - 500) < 1, `reveal delay ${skeleton.delay} + elapsed ${skeleton.elapsed} = 500ms`)
  assert.deepEqual(skeleton.indices, ['0', '1', '2', '3', '4', '5', '6', '7'])
  assert.deepEqual(skeleton.breathe, ['cds-skeleton-breathe'])
  await page.waitForFunction(() => {const group = document.querySelector('[data-cds="SkeletonGroup"][data-hold="delayed"]'); return group && getComputedStyle(group).opacity === '1' && group.hasAttribute('data-shown')})
  const shown = await hold.evaluate(node => {const group = node.closest('[data-cds="SkeletonGroup"]'); return {label: group.querySelector('[data-skeleton-label]').textContent, busy: node.closest('[aria-busy]')?.getAttribute('aria-busy') ?? null}})
  assert.deepEqual(shown, {label: 'Loading', busy: 'true'})
  // R02, Kw (code-home.js:13844-13847): the pre-live unselected labels are text-muted (not button:disabled's
  // text-disabled), also inside the .5-opacity hold card.
  const holdTabs = await hold.evaluate(node => [...node.querySelectorAll('.sh-tabs-row button:disabled:not(.is-selected)')].map(button => [button.textContent, getComputedStyle(button).color]))
  const muted = await color('var(--cds-text-muted)')
  assert.deepEqual(holdTabs, [['Models', muted], ['30d', muted], ['7d', muted]], 'hold card pre-live tabs paint --cds-text-muted')
  // Pre-live (disabled, aria-hidden) tabs never paint a hover pill.
  const preLive = hold.locator('.sh-tabs-row button:disabled').nth(1)
  await preLive.hover({force: true})
  assert.equal(await preLive.evaluate(node => {const b = getComputedStyle(node, '::before'); return b.content === 'none' ? 'none' : b.backgroundColor}), 'none')
  assert.equal(await page.locator('.connection-card').count(), 0, 'no connection card while the stats are held')
  report.metrics.skeleton = {...skeleton, ...shown, holdTabs}
  await page.screenshot({path: path.join(directory, 'hold.png')})
  report.checks.push('Hold: SkeletonGroup role=status data-hold=delayed data-motion=wave, cds-placeholder-reveal .15s backwards with delay = 500ms − elapsed since the home mount (then opacity 1), sr-only label filled with "Loading" on reveal, eight --cds-skel-i 0–7 Skeletons breathing; disabled pre-live tabs paint text-muted labels and no hover pill')

  await poll(() => exists(gate('stats1') + '-held.json'), 'stats request held')
  await fs.writeFile(gate('stats1') + '-release', '')
  const card = page.getByTestId('epitaxy-stats-card')
  await card.waitFor()
  await page.getByRole('button', {name: 'Model', exact: true}).filter({hasText: 'Test model'}).waitFor()
  assert.deepEqual(await readTiles(), {Sessions: '3', Messages: '42', 'Total tokens': '1M', 'Active days': '3', 'Peak hour': peak, 'Favorite model': 'Test model'})
  const shape = await card.evaluate(node => ({titles: node.querySelectorAll('[title]').length, footer: node.querySelectorAll('.sh-account-source, [role="status"], button:not(:disabled)').length,
    heatmap: node.querySelector('[role="img"]')?.getAttribute('aria-label'), counts: [...node.querySelectorAll('.sh-heatmap-cell[data-count]:not([data-count="0"])')].map(cell => [cell.dataset.date, cell.dataset.count])}))
  assert.deepEqual(shape, {titles: 0, footer: 0, heatmap: 'Daily activity heatmap', counts: [[T40, '30'], [T1, '8'], [T0, '4']]})
  // Yw goes live on pointerenter/focus (code-home.js:13940-13941). The hold step left the pointer resting on a pre-live tab,
  // and the card replaced the hold under it, so no pointerenter reaches it until the pointer leaves and comes back.
  await page.mouse.move(1, 1)
  await card.hover()
  await card.getByRole('tab', {name: '7d', exact: true}).click()
  assert.deepEqual(await readTiles(), {Sessions: '1', Messages: '12', 'Total tokens': '101k', 'Active days': '2', 'Peak hour': peak, 'Favorite model': 'Test model 2'})
  await card.getByRole('tab', {name: 'All', exact: true}).click()
  const prefs = JSON.parse(await fs.readFile(path.join(profile, 'preferences.json'), 'utf8'))
  assert.deepEqual(prefs.codeStats, statsA, 'the last core result is kept for the next launch')
  assert.equal(prefs.codeStatsCore, `override:${env.CODEX_BINARY}`, 'F09 review: tagged with the core that produced it')
  const statsReads = (await requests()).filter(entry => entry.method === 'codeDesktop/stats/read')
  assert.equal(statsReads.length, 1); assert.deepEqual(statsReads[0].params, {})
  assert.equal((await requests()).filter(entry => entry.method === 'account/usage/read').length, 0, 'the home no longer reads account usage')
  report.metrics.card = shape
  await page.screenshot({path: path.join(directory, 'home-core-stats.png')})
  report.checks.push('Card from codeDesktop/stats/read (one read, empty params): Sessions 3 / Messages 42 / 1M / 3 active days / 3 PM / Test model in All, 1 / 12 / 101k / 2 / Test model 2 in 7d; the profile ledger (999 messages) never shows; no [title], no footer, messages heatmap; result kept in the profile')
  await app.close(); app = null

  // ------------------------------------------------------------ launch 2: kept result first
  await usageFixture({'codeDesktop/stats/read': {result: statsB, hold: 'stats2'}})
  await launch()
  await page.getByTestId('epitaxy-stats-card').waitFor()
  assert.equal(await page.getByTestId('epitaxy-stats-hold').count(), 0)
  assert.equal((await readTiles()).Messages, '42', 'the kept result paints before the fresh fold')
  await poll(() => exists(gate('stats2') + '-held.json'), 'second stats request held')
  await fs.writeFile(gate('stats2') + '-release', '')
  await page.waitForFunction(() => [...document.querySelectorAll('.sh-tile')].some(tile => tile.textContent === 'Messages48'))
  assert.equal((await readTiles()).Sessions, '4')
  await poll(async () => JSON.parse(await fs.readFile(path.join(profile, 'preferences.json'), 'utf8')).codeStats?.dailyActivity?.[2]?.messageCount === 10, 'fresh result kept')
  report.checks.push('Next launch: the kept result paints at once (no hold) while the fresh fold is held; releasing it updates the card through the stats push event (Messages 42 → 48) and the profile')

  // ------------------------------------------------------------ DeepSeek core without a key
  // harness account.js shape: the home asks for a key, never for ChatGPT; Refresh re-reads account/read.
  const deepseek = configured => ({result: {account: configured ? {type: 'apiKey'} : null, requiresOpenaiAuth: false, deepseek: {apiKey: {configured, source: configured ? 'file' : null}, platform: 'signed-out', links: null}}})
  await usageFixture({'account/read': deepseek(false)})
  await page.evaluate(() => window.desktop.call('account-auth', {operation: 'refresh'}))
  const keyCard = page.getByTestId('deepseek-key-card')
  await keyCard.waitFor()
  // R02: the Lw outline card (code-home.js:13752-13754) with a Jw text-body title and CDS Buttons (sm; Get an API key primary).
  const keyShape = await keyCard.evaluate(node => {
    const style = getComputedStyle(node), title = node.querySelector('.connection-card-title'), body = node.querySelector('.connection-card-body')
    return {outline: node.matches('.sh-card.is-outline'), padding: style.padding, radius: style.borderRadius, maxWidth: style.maxWidth, ring: style.boxShadow,
      title: [title.textContent, getComputedStyle(title).fontSize, getComputedStyle(title).color], body: [body.textContent, getComputedStyle(body).color],
      buttons: [...node.querySelectorAll('button')].map(button => [button.textContent.trim(), button.dataset.cds, button.dataset.variant, button.dataset.size ?? null])}
  })
  assert.deepEqual({...keyShape, ring: undefined}, {outline: true, padding: '8px 12px 12px', radius: '8px', maxWidth: '480px', ring: undefined,
    title: ['Add your DeepSeek API key', '13px', await color('var(--cds-text-primary)')], body: ['Choose Add key and paste your key to start. A key saved in DeepSeek Harness or set as DEEPSEEK_API_KEY also works; refresh after adding one there.', await color('var(--cds-text-secondary)')],
    buttons: [['Refresh', 'Button', 'secondary', 'sm'], ['Get an API key', 'Button', 'secondary', 'sm'], ['Add key', 'Button', 'primary', 'sm']]})
  assert.match(keyShape.ring, /0px 0px 0px 1px/, 'epitaxy-card-outline ring')
  report.metrics.keyCard = keyShape
  // The composer warns instead of letting a doomed send reach turn/start; Enter keeps the draft and starts nothing.
  const warningRow = page.locator('[data-cds-composer-warning]')
  await warningRow.waitFor()
  assert.equal(await warningRow.locator('.sc-warning-text').textContent(), 'Add a DeepSeek API key to start a session.')
  const composerBox = page.getByRole('textbox', {name: 'Message DeepSeek'})
  await composerBox.click()
  await page.keyboard.type('hello without a key')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  assert.equal((await composerBox.textContent()).trim(), 'hello without a key', 'the draft stays')
  assert.equal((await requests()).filter(entry => ['thread/start', 'turn/start'].includes(entry.method)).length, 0, 'no thread/start or turn/start without a key')
  assert.equal(await page.getByText('Continue with your ChatGPT account.', {exact: true}).count(), 0)
  assert.equal(await page.locator('.connection-card').count(), 1, 'only the key card')
  await page.getByTestId('epitaxy-stats-card').waitFor()
  await page.screenshot({path: path.join(directory, 'home-deepseek-no-key.png')})
  await usageFixture({'account/read': deepseek(true)})
  await keyCard.getByRole('button', {name: 'Refresh', exact: true}).click()
  await keyCard.waitFor({state: 'detached'})
  await warningRow.waitFor({state: 'detached'})
  report.checks.push('DeepSeek account/read without a key shows the Add your DeepSeek API key card on the Lw outline (8/12/12, radius 8, 1px ring, 13px primary title, secondary body, sm CDS Buttons Refresh secondary / Get an API key primary) beside the stats card, no ChatGPT card and no generic connection card; the composer warns "Add a DeepSeek API key to start a session." and Enter keeps the draft with no thread/start or turn/start; Refresh re-reads account/read and the card and warning leave once a key is configured')

  assert.equal((await requests()).filter(entry => ['turn/start', 'thread/resume', 'account/login/start', 'account/logout'].includes(entry.method)).length, 0)
  assert.deepEqual(report.rendererErrors, [])
  await integrity()
  report.checks.push('Read-only integration sends no turn/start, resume, login or logout; no renderer errors and built source integrity unchanged')
  report.passed = true
} catch (error) {
  report.error = error.stack
  process.exitCode = 1
  if (page) await page.screenshot({path: path.join(directory, 'failure.png')}).catch(() => {})
} finally {
  await app?.close()
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  await fs.writeFile(path.join(evidence, 'home-account-usage-ui-report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
