import React, { useEffect, useRef, useState } from 'react';
import { ui as ArtifactTitle, mi as ArtifactAction } from './generated/current-chat/c2bb74286-D8NXeKVk.js';
import { bf as headerClass, xf as bodyClass } from './generated/current-chat/shared-9-CAAkBVM3.js';
import { filePreviewKind } from './file-preview-model.mjs';
import { SourceFileViewer } from './source-file-viewer.jsx';
import { SourceMarkdown } from './source-session.jsx';
import { SourceLoadingPane } from './source-pane-states.jsx';
import { t } from '../electron/i18n/index.mjs';

// Installed 2.31226.0 artifact frame, title and action primitives.
// Local files use the existing scoped readers and document renderers in the body slot.
export function SourceArtifactViewer({ record, call, onClose, onSession, onPin, actionError, navigation, windowActions }) {
  const [viewMode, setViewMode] = useState('preview');
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [force, setForce] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    call('local-artifacts', { action: 'read', key: record.key, force }).then(value => { if (active) setData(value); }, error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [record.key, revision, force, call]);
  useEffect(() => { root.current?.focus({ preventScroll: true }); }, []);
  const act = (operation, params) => call(operation, params).catch(error => setError(error.message));
  return <section ref={root} tabIndex={-1} aria-label={t('Artifact preview')} className="surface-artifact-viewer flex h-full min-h-0 flex-col cds-root" data-density="comfortable"
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div data-testid="frame-artifact-viewer-header" className={`${headerClass} window-drag`}>
      <div className="flex min-w-0 shrink-[999] items-center gap-2 self-stretch pl-2" data-testid="frame-artifact-header-leading">
        {navigation}
        <ArtifactAction glyph="ArrowLeft" label={t('Back to artifacts')} onClick={onClose} />
        <ArtifactTitle title={record.title} heading />
      </div>
      <div className="flex items-center gap-1">
        {data && typeof data.file.text === 'string' && filePreviewKind(data.file.path) && <ArtifactAction glyph={viewMode === 'source' ? 'Eye' : 'Code'} label={t(viewMode === 'source' ? 'Preview' : 'View source')} onClick={() => setViewMode(value => value === 'source' ? 'preview' : 'source')} />}
        <ArtifactAction glyph={record.starred ? 'PinFilled' : 'Pin'} label={t(record.starred ? 'Unpin' : 'Pin')} aria-pressed={!!record.starred} onClick={() => onPin(record)} />
        <ArtifactAction glyph="ArrowClockwise" label={t('Reload')} onClick={() => setRevision(value => value + 1)} />
        <ArtifactAction glyph="Chat" label={t('Open conversation')} onClick={() => onSession(record.threadId)} />
        <ArtifactAction glyph="ArrowUpRight" label={t('Open in default app')} onClick={() => act('open-tool-file', { sessionId: record.threadId, path: record.path })} />
        {windowActions}
        <ArtifactAction glyph="X" label={t('Close')} onClick={onClose} />
      </div>
    </div>
    <div className={`${bodyClass} flex flex-col overflow-hidden`}>
      {(error || actionError) && <p role="alert" className="text-body text-danger px-4 py-3">{error || actionError}</p>}
      {data ? <SourceFileViewer key={`${record.key}:${revision}:${force}`} showHeader={false} viewMode={viewMode} onViewModeChange={setViewMode} file={data.file} displayPath={data.displayPath} fullPath={data.fullPath} scopeKey={record.key}
        onCopyPath={() => navigator.clipboard.writeText(data.fullPath).catch(error => setError(error.message))}
        onViewAsText={() => setForce(true)} renderMarkdown={text => <SourceMarkdown text={text} cwd={data.root} sessionKey={record.threadId} />} />
        : !error && <SourceLoadingPane label={t('Loading artifact…')} />}
    </div>
  </section>;
}
