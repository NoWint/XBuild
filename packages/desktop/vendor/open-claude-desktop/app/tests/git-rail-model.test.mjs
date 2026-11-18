import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGitRailModel, railSignal, behindIndicator, visibleBaseBranch, railReservation, isLocalOnly, commitAction, COMMIT_TURN_TEXT, COMMIT_CLEAN_REASON, COMMIT_RESPONDING_REASON } from '../src/git-rail-model.mjs';

// F12: the row follows hasChanges (merge-base stats), Commit follows workingTreeDirty (Qe isWorkingTreeDirty).
const dirty = { isRepo: true, cwd: '/tmp/repo', repoName: 'repo', branch: 'feature', hasChanges: true, workingTreeDirty: true, added: 2, removed: 1 };
const comparison = { base: 'main', baseSource: 'default', ahead: 2, behind: 1, same: false, mergeBase: 'abc' };

test('commit mode (every local session) hides Base branch and keeps only the Changes fact', () => {
  const model = buildGitRailModel({ status: dirty, comparison });
  assert.equal(model.visible, true);
  assert.equal(model.title, 'repo · feature');
  assert.equal(model.glyphLabel, 'Branch');
  assert.deepEqual(model.facts.map((fact) => fact.key), ['changes']);
  assert.equal(model.baseBranch, undefined);
  assert.deepEqual(model.gates, []); assert.deepEqual(model.automation, []);
  assert.deepEqual(model.facts[0], { key: 'changes', label: 'Changes', added: 2, removed: 1, action: 'View changes', hint: 'View changes', hintDetail: 'Lines added and removed on this branch.' });
  assert.deepEqual(model.signal, { kind: 'changes', added: 2, removed: 1 });
  assert.deepEqual(model.action, { label: 'Commit changes', text: COMMIT_TURN_TEXT, disabled: false, disabledReason: undefined }, 'enabled action carries no reason (Hi/Fe reason only while disabled)');
  assert.equal(COMMIT_TURN_TEXT, 'Commit the working tree changes with a sensible message.');
  assert.equal(isLocalOnly('commit'), true); assert.equal(isLocalOnly('none'), true); assert.equal(isLocalOnly('create'), false);
});

test('commit action follows cc(): disabled while responding with the official reason, disabled when clean, never busy', () => {
  assert.equal(COMMIT_RESPONDING_REASON, 'DeepSeek is working \u2014 wait for the turn to finish', 'the assistant-as-actor word, rewritten per core');
  assert.equal(COMMIT_CLEAN_REASON, 'No changes to commit');
  assert.deepEqual(commitAction(dirty, { responding: true }), { label: 'Commit changes', text: COMMIT_TURN_TEXT, disabled: true, disabledReason: COMMIT_RESPONDING_REASON });
  assert.deepEqual(commitAction({ ...dirty, workingTreeDirty: false }), { label: 'Commit changes', text: COMMIT_TURN_TEXT, disabled: true, disabledReason: COMMIT_CLEAN_REASON });
  assert.deepEqual(commitAction({ ...dirty, workingTreeDirty: false }, { responding: true }).disabledReason, COMMIT_CLEAN_REASON, 'clean tree wins over responding (Sn checked first)');
  // After a commit on the branch: the band stays (hasChanges, +N −M for the branch) and Commit is 'No changes to commit'.
  const committed = buildGitRailModel({ status: { ...dirty, workingTreeDirty: false } });
  assert.equal(committed.visible, true); assert.equal(committed.action.disabled, true); assert.equal(committed.action.disabledReason, COMMIT_CLEAN_REASON);
  assert.equal(commitAction({ ...dirty, workingTreeDirty: undefined }).disabled, true, 'only a reported dirty tree enables Commit');
  assert.deepEqual(commitAction(dirty), { label: 'Commit changes', text: COMMIT_TURN_TEXT, disabled: false, disabledReason: undefined });
  assert.ok(!('busy' in commitAction(dirty, { responding: true })), 'no busy state: pi holds only PR creation and Mi has no commit busy label');
  const responding = buildGitRailModel({ status: dirty, responding: true });
  assert.equal(responding.action.disabled, true); assert.equal(responding.action.disabledReason, COMMIT_RESPONDING_REASON);
  assert.equal(responding.visible, true, 'responding does not hide the row');
  assert.equal(buildGitRailModel({ status: dirty, prMode: 'create', responding: true }).action, null);
});

test('behind data stays available to the model but needs branch !== base and a positive count', () => {
  const model = buildGitRailModel({ status: dirty, comparison });
  assert.deepEqual(model.behind, { count: 1, base: 'main', tooltip: '1 commit behind main' });
  assert.equal(behindIndicator({ ...comparison, behind: 0 }, 'feature'), null);
  assert.equal(behindIndicator({ ...comparison, base: 'feature', same: true, behind: 3 }, 'feature'), null);
  assert.equal(behindIndicator({ ...comparison, base: 'feature', behind: 3 }, 'feature'), null, 'branch === base');
  assert.equal(behindIndicator(comparison, null), null, 'detached HEAD has no branch');
  assert.equal(behindIndicator(null, 'feature'), null);
  assert.equal(behindIndicator({ ...comparison, behind: 2 }, 'feature').tooltip, '2 commits behind main');
  assert.equal(buildGitRailModel({ status: { ...dirty, detached: true, branch: 'abc1234' }, comparison }).behind, null);
});

test('outside commit mode the Base branch fact appears with the behind count and compared-with hint', () => {
  const model = buildGitRailModel({ status: dirty, comparison, prMode: 'create' });
  assert.deepEqual(model.facts.map((fact) => fact.key), ['base', 'changes']);
  assert.equal(model.facts[0].value, 'main · 1 behind');
  assert.equal(model.facts[0].hint, 'A pull request from this branch merges into main.');
  assert.equal(model.facts[0].hintDetail, '1 commit behind main');
  assert.equal(model.facts[1].hintDetail, 'Lines added and removed compared with main.');
  assert.equal(model.action, null);
  assert.equal(visibleBaseBranch({ prMode: 'create', prState: undefined, baseBranch: 'main', branch: 'main' }), undefined, 'A === j with no PR');
  assert.equal(visibleBaseBranch({ prMode: 'create', prState: 'open', baseBranch: 'main', branch: 'main' }), 'main');
  assert.equal(visibleBaseBranch({ prMode: 'commit', prState: 'open', baseBranch: 'main', branch: 'feature' }), undefined);
});

test('signals: counted changes, uncounted dirty (binary-only) and clean; hideRepo drops the repo from the title', () => {
  assert.deepEqual(railSignal({ isRepo: true, hasChanges: true, added: 0, removed: 0 }), { kind: 'uncounted', text: 'Changes' });
  assert.deepEqual(railSignal({ isRepo: true, hasChanges: false, added: 0, removed: 0 }), { kind: 'clean', text: 'No changes' });
  assert.equal(railSignal({ isRepo: false }), null);
  const clean = buildGitRailModel({ status: { ...dirty, hasChanges: false, workingTreeDirty: false, added: 0, removed: 0 } });
  assert.equal(clean.visible, false); assert.deepEqual(clean.facts, []); assert.equal(clean.action.disabled, true);
  assert.equal(buildGitRailModel({ status: dirty, hideRepo: true }).title, 'feature');
  assert.equal(buildGitRailModel({ status: { ...dirty, repoName: undefined, cwd: '/x/y/named' } }).title, 'named · feature');
  assert.equal(buildGitRailModel({ status: null }).visible, false);
  assert.equal(buildGitRailModel({ status: { isRepo: false } }).visible, false);
  assert.deepEqual(buildGitRailModel({ status: dirty, prLink: { numberText: '#1' } }).facts.map((fact) => fact.key), ['repository', 'changes']);
  assert.deepEqual(buildGitRailModel({ status: dirty, prLink: { numberText: '#1' }, hideRepo: true }).facts.map((fact) => fact.key), ['changes']);
});

test('placeholder reservation: remembered px capped at 360 with 28px rows, else 4 rows (5 with PR) at 28px + 4px gaps', () => {
  assert.deepEqual(railReservation({ remembered: 90 }), { heightPx: 90, rows: 3, source: 'memory' });
  assert.deepEqual(railReservation({ remembered: 20 }), { heightPx: 20, rows: 1, source: 'memory' });
  assert.deepEqual(railReservation({ remembered: 1000 }), { heightPx: 360, rows: 13, source: 'memory' });
  assert.deepEqual(railReservation({ checkoutHadRow: true }), { heightPx: 124, rows: 4, source: 'checkout' });
  assert.deepEqual(railReservation({ checkoutHadRow: true, hasPr: true }), { heightPx: 156, rows: 5, source: 'checkout' });
  assert.deepEqual(railReservation({}), { heightPx: 0, rows: 0, source: 'none' });
  assert.deepEqual(railReservation({ remembered: 0, checkoutHadRow: false }), { heightPx: 0, rows: 0, source: 'none' });
});

test('pull request action: a committed branch of a GitHub repo gets Create PR and the compare page', async () => {
  const { pullRequestAction } = await import('../src/git-rail-model.mjs');
  const github = { host: 'github.com', owner: 'acme', name: 'widget' };
  const status = { isRepo: true, branch: 'feature/x', workingTreeDirty: false, comparison: { base: 'main', same: false, ahead: 2, unpushed: 0 } };
  assert.deepEqual(pullRequestAction({ status, identity: github }), { mode: 'create', label: 'Create PR', busyLabel: 'Creating PR…',
    manualUrl: 'https://github.com/acme/widget/compare/main...feature%2Fx?expand=1', hint: null });
  assert.equal(pullRequestAction({ status: { ...status, workingTreeDirty: true }, identity: github }), null, 'Commit comes first');
  assert.equal(pullRequestAction({ status, identity: { ...github, host: 'gitlab.com' } }), null);
  assert.equal(pullRequestAction({ status, identity: { host: 'github.com', owner: null, name: 'w' } }), null);
  assert.match(pullRequestAction({ status: { ...status, branch: 'main', comparison: { base: 'main', same: true } }, identity: github }).disabledReason, /base branch/);
  assert.match(pullRequestAction({ status: { ...status, comparison: { ...status.comparison, ahead: 0 } }, identity: github }).disabledReason, /No changes/);
  assert.match(pullRequestAction({ status: { ...status, comparison: { ...status.comparison, unpushed: null } }, identity: github }).manualDisabledReason, /pushed/);
  assert.ok(pullRequestAction({ status, identity: github, responding: true }).disabledReason);
});

test('B08 D3: an existing PR drops Create PR; a pending lookup disables it; gh missing/signed out is the un hint', async () => {
  const { pullRequestAction, branchPullRequest, bandPrMode, prStatusHint, prStatusHintText } = await import('../src/git-rail-model.mjs');
  const github = { host: 'github.com', owner: 'acme', name: 'widget' };
  const status = { isRepo: true, branch: 'feature/x', workingTreeDirty: false, comparison: { base: 'main', same: false, ahead: 2, unpushed: 0 } };
  const pr = { number: 7, url: 'https://github.com/acme/widget/pull/7', state: 'open', ci: 'passed' };
  assert.equal(pullRequestAction({ status, identity: github, pr }), null, 'cd5a31703 Te is null in view mode');
  // Sn order (cd5a31703 :37385-37430): base, nothing to PR, then the pending lookup, then responding.
  assert.equal(pullRequestAction({ status, identity: github, lookup: { status: 'pending' }, responding: true }).disabledReason, 'Checking for an existing pull request');
  assert.match(pullRequestAction({ status: { ...status, comparison: { ...status.comparison, ahead: 0 } }, identity: github, lookup: { status: 'pending' } }).disabledReason, /No changes/);
  assert.equal(pullRequestAction({ status, identity: github, lookup: { status: 'error' } }).disabledReason, undefined, 'no verdict: Create PR stays available');
  assert.equal(pullRequestAction({ status, identity: github, lookup: { status: 'missing' } }).hint, 'gh_unavailable');
  assert.equal(pullRequestAction({ status, identity: github, lookup: { status: 'auth' } }).hint, 'gh_signed_out');
  assert.equal(pullRequestAction({ status: { ...status, comparison: { ...status.comparison, ahead: 0 } }, identity: github, lookup: { status: 'missing' } }).hint, null, 'only while Create PR is on offer (an rr)');
  assert.equal(prStatusHint({ lookup: { status: 'none' }, createOffered: true }), null);
  assert.deepEqual(prStatusHintText('gh_signed_out'), { trigger: 'GitHub CLI signed out', body: 'Sign in to the GitHub CLI to see existing pull requests, CI status, and auto-fix for this branch.' });
  // The lookup's PR wins; 'none' means no PR even when the core once bound one; otherwise the session binding is the fallback.
  assert.equal(branchPullRequest({ lookup: { status: 'found', pr, branch: 'feature/x' }, branch: 'feature/x' }), pr);
  assert.equal(branchPullRequest({ lookup: { status: 'none', branch: 'feature/x' }, branch: 'feature/x', sessionPr: { url: pr.url } }), null);
  assert.deepEqual(branchPullRequest({ lookup: { status: 'pending' }, sessionPr: { url: 'https://github.com/acme/widget/pull/9' } }),
    { number: 9, url: 'https://github.com/acme/widget/pull/9', state: 'open', title: null, ci: undefined, checks: null, fromSession: true });
  assert.equal(branchPullRequest({ lookup: { status: 'found', pr, branch: 'other' }, branch: 'feature/x' }), null, 'another branch\'s answer is ignored');
  // bze: merged / queued / view; no PR keeps the create mode.
  assert.equal(bandPrMode({ state: 'merged' }, 'create'), 'merged');
  assert.equal(bandPrMode({ state: 'queued' }, 'create'), 'queued');
  assert.equal(bandPrMode({ state: 'closed' }, 'draft'), 'view');
  assert.equal(bandPrMode(null, 'draft'), 'draft');
});

test('B08 split button: remembered mode (epitaxy-pr-create-mode), labels, compose without a repo reads create', async () => {
  const { readPrCreateMode, writePrCreateMode, effectivePrCreateMode, prModeLabel, prBusyLabel, pullRequestAction, PR_CREATE_MODE_KEY } = await import('../src/git-rail-model.mjs');
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.equal(PR_CREATE_MODE_KEY, 'epitaxy-pr-create-mode');
  assert.equal(readPrCreateMode(storage), 'create');
  writePrCreateMode(storage, 'draft'); assert.equal(readPrCreateMode(storage), 'draft');
  writePrCreateMode(storage, 'bogus'); assert.equal(readPrCreateMode(storage), 'draft', 'unknown modes are not stored');
  assert.equal(readPrCreateMode({ getItem: () => { throw new Error('blocked'); } }), 'create');
  assert.equal(effectivePrCreateMode('compose', false), 'create');
  assert.equal(effectivePrCreateMode('compose', true), 'compose');
  assert.deepEqual(['create', 'draft', 'compose', 'commit', 'view', 'merged', 'queued'].map(prModeLabel),
    ['Create PR', 'Create draft PR', 'Manually create PR', 'Commit changes', 'View PR', 'Merged', 'Queued']);
  assert.equal(prBusyLabel('draft'), 'Creating PR…'); assert.equal(prBusyLabel('view'), undefined);
  const github = { host: 'github.com', owner: 'acme', name: 'widget' };
  const unpushed = { isRepo: true, branch: 'feature/x', workingTreeDirty: false, comparison: { base: 'main', same: false, ahead: 2, unpushed: null } };
  const compose = pullRequestAction({ status: unpushed, identity: github, mode: 'compose' });
  assert.equal(compose.label, 'Manually create PR');
  assert.equal(compose.disabledReason, undefined, 'the split button stays usable; firing compose reports the unpushed branch');
  assert.equal(compose.manualDisabledReason, 'Branch hasn’t been pushed to GitHub');
});

test('B08 band glyphs, CI and chip URLs follow bLe / NB / c0a531389', async () => {
  const { PR_STATE_GLYPHS, PR_ROW_ACCENT, prStateLabel, ciStatusLabel, githubBranchUrl, githubRepoUrl } = await import('../src/git-rail-model.mjs');
  assert.deepEqual(PR_STATE_GLYPHS.open, { icon: 'GitPullRequest', tint: 'opened' });
  assert.deepEqual(PR_STATE_GLYPHS.merged, { icon: 'GitMergedSimple', tint: 'merged' });
  assert.deepEqual(PR_STATE_GLYPHS.conflicting, { icon: 'GitMergeConflict', tint: 'conflicting' });
  assert.deepEqual(PR_ROW_ACCENT, { merged: 'purple', queued: 'yellow' });
  assert.equal(prStateLabel('conflicting'), 'Merge conflicts');
  assert.equal(prStateLabel('changesRequested'), 'Changes requested');
  assert.equal(ciStatusLabel('failed'), 'CI: checks failing');
  assert.equal(ciStatusLabel('pending'), 'CI: checks in progress');
  assert.equal(ciStatusLabel(undefined), undefined);
  const github = { host: 'github.com', owner: 'acme', name: 'widget' };
  assert.equal(githubRepoUrl(github), 'https://github.com/acme/widget');
  assert.equal(githubRepoUrl({ ...github, host: 'gitlab.com' }), null);
  assert.equal(githubBranchUrl(github, { branch: 'feature/a b', comparison: { unpushed: 0 } }), 'https://github.com/acme/widget/tree/feature/a%20b');
  assert.equal(githubBranchUrl(github, { branch: 'feature', comparison: { unpushed: null } }), null, 'a branch not on origin has no GitHub page');
  assert.equal(githubBranchUrl(github, { branch: 'feature', detached: true, comparison: { unpushed: 0 } }), null);
});
