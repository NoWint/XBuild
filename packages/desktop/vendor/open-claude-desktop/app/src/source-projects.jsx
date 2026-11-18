import React, { useEffect, useMemo, useRef, useState } from 'react';
import { _ as Page } from './generated/current-chat/c193cfc9b-2wgBbI8O.js';
import { l as ProjectCard } from './generated/current-chat/cf8745532-BMxkFAAg.js';
import { s as EmptyState } from './generated/current-chat/cbef3b9e7-CuJuDnSt.js';
import { SourceSettingsButton as Button } from './source-settings-button.jsx';
import { yy as TextInput } from './generated/current-chat/shared-frame-DVFSKIcx.js';
import { $v as TextArea } from './generated/chat/shared-frame-C_2npUJq.js';
import { pu as ProjectHeader } from './generated/current-chat/c71dee58b-X8_F3dre.js';
import { i as ProjectSessionRow, a as SessionDate } from './generated/current-chat/c75e89812-Cz6W_Gc9.js';
import { LocalProjectContext } from './source-project-adapters.jsx';
import { Icon } from './icons';
import { SourceDialog } from './source-dialog.jsx';
import { t, getLocale } from '../electron/i18n/index.mjs';

// c17beaa76 Pr: host project data feeds the original Page, PageHeader, card and empty state.
export function SourceProjects({ call, onOpen, composer, sessions, sessionMetadata, onSession, onBack, onUpdated }) {
  const [selected, setSelected] = useState(null);
  const [projects, setProjects] = useState(null), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [sort, setSort] = useState('updatedAt');
  const [creating, setCreating] = useState(false), [opening, setOpening] = useState(false);
  const inputRef = useRef(null), results = useRef(null);
  const reload = () => call('local-projects', { action: 'list' }).then(setProjects).catch(error => setError(error.message));
  useEffect(() => { let active = true; call('local-projects', { action: 'list' }).then(value => { if (active) setProjects(value); }, error => { if (active) setError(error.message); }); return () => { active = false; }; }, [call]);
  const rows = useMemo(() => (projects ?? []).filter(project => `${project.name} ${project.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => Number(!!b.isStarred) - Number(!!a.isStarred) || (sort === 'name' ? a.name.localeCompare(b.name) : b[sort].localeCompare(a[sort]))), [projects, query, sort]);
  const open = async project => {
    if (opening) return;
    setOpening(true); setError('');
    try { setSelected(await onOpen(project)); } catch (error) { setError(error.message); } finally { setOpening(false); }
  };
  if (selected) return <ProjectDetail key={selected.id} project={selected} call={call} composer={composer} sessions={sessions} sessionMetadata={sessionMetadata} onSession={onSession}
    onBack={() => { setSelected(null); onBack(); }} onUpdated={project => { setSelected(project); setProjects(rows => rows.map(row => row.id === project.id ? project : row)); onUpdated(project); }} />;
  const newProject = <Button variant="primary" onClick={() => setCreating(true)}>{t('New project')}</Button>;
  return <div className="surface-projects cds-root" data-density="comfortable">
    <Page title={t('Projects')} band="tall-frame" contentGap="lg" primaryAction={newProject} primaryActionCompactIcon="Add"
      search={{ inputRef, value: query, onChange: setQuery, onClear: () => setQuery(''), placeholder: t('Search projects...'), label: t('Search projects'), resultsId: 'local-project-results',
        onInputKeyDown: event => { if (event.key === 'ArrowDown') { event.preventDefault(); results.current?.querySelector('[data-primary]')?.focus(); } } }}
      iconActions={[{ key: 'sort', icon: 'Sort', label: t('Sort projects'), items: [['updatedAt', 'Recently updated'], ['createdAt', 'Date created'], ['name', 'Name']].map(([value, label]) => ({ label: t(label), checkedRole: 'radio', checked: sort === value, onSelect: () => setSort(value) })) }]}>
      {error && <div role="alert" className="text-danger text-body mb-4">{error} <Button variant="ghost" onClick={reload}>{t('Try again')}</Button></div>}
      {projects === null ? <p role="status" className="text-muted text-body">{t('Loading…')}</p> : !rows.length ? query.trim()
        ? <div className="mt-10 text-center text-body text-muted">{t('No projects matching “{search}”', { search: query })}</div>
        : <EmptyState headline={t('Looking to start a project?')} description={t('Give XBuild a folder you already work from')} variant="projects" ctaLabel={t('New project')} onCtaClick={() => setCreating(true)} />
        : <ul id="local-project-results" ref={results} aria-label={t('Projects')} className="mb-3 grid grid-cols-1 gap-3 md:mb-6 md:grid-cols-2 md:gap-6"
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); inputRef.current?.focus(); } }}>
          {rows.map(project => <li key={project.id} className="h-full"><ProjectCard href={`#project-${project.id}`} title={project.name} description={project.description}
            className="min-h-28" onClick={() => open(project)} footer={new Date(project[sort === 'createdAt' ? 'createdAt' : 'updatedAt']).toLocaleDateString(getLocale())} /></li>)}
        </ul>}
    </Page>
    {creating && <CreateProject call={call} onClose={() => setCreating(false)} onCreated={project => { setProjects(value => [...(value ?? []), project]); setQuery(''); setCreating(false); }} />}
  </div>;
}

function CreateProject({ call, onClose, onCreated }) {
  const [name, setName] = useState(''), [description, setDescription] = useState(''), [folder, setFolder] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true); setError('');
    try { onCreated(await call('local-projects', { action: 'create', name, description, folder })); }
    catch (error) { setError(error.message); setBusy(false); }
  }
  async function chooseFolder() {
    try { const value = await call('folder', { additional: true }); if (value) setFolder(value); }
    catch (error) { setError(error.message); }
  }
  return <SourceDialog title={t('New project')} density="comfortable" onClose={busy ? undefined : onClose}
    footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" busy={busy} disabled={busy || !name.trim()} onClick={create}>{t('Create project')}</Button></>}>
    <form className="surface-project-form flex flex-col gap-lg pt-3" onSubmit={event => { event.preventDefault(); create(); }}>
      <label className="flex flex-col gap-sm text-body">{t('Name')}<TextInput size="lg" autoFocus required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder={t('Billing migration')} disabled={busy} /></label>
      <label className="flex flex-col gap-sm text-body">{t('Description')}<TextArea resize="y" rows={3} maxLength={4000} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} /></label>
      <div className="flex flex-col gap-sm text-body"><span>{t('Working folder')}</span><Button variant="secondary" icon="Folder" disabled={busy} onClick={chooseFolder}>{folder || t('Choose folder…')}</Button></div>
      {error && <p role="alert" className="text-danger text-body">{error}</p>}
    </form>
  </SourceDialog>;
}


function ProjectDetail({ project, call, composer, sessions, sessionMetadata, onSession, onBack, onUpdated }) {
  const [editing, setEditing] = useState(null), [error, setError] = useState('');
  const rows = sessions.filter(session => sessionMetadata[session.id]?.projectId === project.id && !session.archived)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  async function update(patch) {
    try {
      const next = await call('local-projects', { action: 'update', id: project.id, ...patch });
      onUpdated(next); setError(''); return next;
    } catch (error) { setError(error.message); throw error; }
  }
  const host = { update, optimistic: patch => onUpdated({ ...project, ...patch }), edit: setEditing,
    reveal: () => call('reveal-folder', { cwd: project.cwd }).catch(error => setError(error.message)) };
  return <LocalProjectContext.Provider value={host}>
    <div className="surface-project-detail cds-root relative flex h-full max-lg:flex-col" data-density="comfortable" data-project-id={project.id}>
      <div className="mx-auto w-full px-6 pt-4 lg:pt-6 pb-6 flex flex-col gap-8 max-w-3xl">
        <div><Button variant="ghost" size="sm" icon="ArrowLeft" onClick={onBack}>{t('Projects')}</Button></div>
        <ProjectHeader primary="project" project={{ ...project, uuid: project.id, is_starred: !!project.isStarred, archived_at: null }} inlineActions />
        {error && <p role="alert" className="text-body text-danger">{error}</p>}
        {composer}
        {rows.length ? <section className="flex flex-col gap-2" aria-label={t('Project sessions')}>
          <h2 className="text-sm text-muted">{t('Recents')}</h2>
          {rows.map(session => <button type="button" key={session.id} className="surface-project-session text-left rounded-lg hover:bg-surface-2" onClick={() => onSession(session.id)}>
            <ProjectSessionRow title={session.name || session.preview || t('Untitled')} rail={<SessionDate>{new Date(typeof session.updatedAt === 'number' ? session.updatedAt * 1000 : session.updatedAt).toLocaleDateString(getLocale())}</SessionDate>} />
          </button>)}
        </section> : <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="Chat" size={32} className="text-muted mb-3" />
          <p className="text-sm text-muted">{t('Give XBuild a task and it’ll pick up your project context automatically.')}</p>
        </div>}
      </div>
    </div>
    {editing && <EditProject key={editing} project={project} kind={editing} update={update} onClose={() => setEditing(null)} />}
  </LocalProjectContext.Provider>;
}

function EditProject({ project, kind, update, onClose }) {
  const [name, setName] = useState(project.name), [description, setDescription] = useState(project.description);
  const [instructions, setInstructions] = useState(project.instructions ?? '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const instructionsOnly = kind === 'instructions';
  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try { await update(instructionsOnly ? { instructions } : { name, description }); onClose(); }
    catch (error) { setError(error.message); setBusy(false); }
  }
  return <SourceDialog title={t(instructionsOnly ? 'Project instructions' : 'Edit project')} density="comfortable" onClose={busy ? undefined : onClose}
    footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" busy={busy} disabled={busy || (!instructionsOnly && !name.trim())} onClick={save}>{t('Save')}</Button></>}>
    <form className="surface-project-form flex flex-col gap-lg pt-3" onSubmit={event => { event.preventDefault(); save(); }}>
      {instructionsOnly ? <label className="flex flex-col gap-sm text-body">{t('Instructions')}<TextArea resize="y" rows={8} autoFocus maxLength={16000} value={instructions} onChange={event => setInstructions(event.target.value)} disabled={busy} /></label> : <>
        <label className="flex flex-col gap-sm text-body">{t('Name')}<TextInput size="lg" autoFocus required maxLength={200} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
        <label className="flex flex-col gap-sm text-body">{t('Description')}<TextArea resize="y" rows={3} maxLength={4000} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} /></label>
      </>}
      {error && <p role="alert" className="text-danger text-body">{error}</p>}
    </form>
  </SourceDialog>;
}
