import React, { useEffect, useRef, useState } from 'react';
import { createSelectedElementDetail } from './generated/code-editor/preview-element-detail.mjs';
import { createSelectedElementChipBody } from './generated/code-editor/preview-element-chip.mjs';
import { createSelectedElementTranscript } from './generated/code-editor/preview-element-transcript.mjs';
import { selectedElementLabel } from './generated/code-editor/preview-element-label.mjs';
import { Icon } from './icons.jsx';
import { HostCollapsible } from './source-chat-adapters.jsx';
import { useRoutineIntl } from './source-routine-adapters.jsx';
import { SourcePopover } from './source-popover.jsx';
import { SourceImageViewer } from './source-image-viewer.jsx';
import { t } from '../electron/i18n/index.mjs';
import './source-disclosure.css';
import './source-selected-element.css';

const ElementIcon = ({ size, ...props }) => <Icon {...props} size={size === 'xs' ? 12 : size === 'sm' ? 16 : size} />;
function Message({ defaultMessage, values }) {
  return useRoutineIntl().formatMessage({ defaultMessage, id: defaultMessage }, values);
}
const Collapsible = { ...HostCollapsible,
  Trigger: ({ children, caretPosition, className = '' }) => <HostCollapsible.Trigger render={<button type="button" className={`source-disclosure-trigger selected-element-disclosure ${className}`}>
    {caretPosition !== 'end' && <Icon name="CaretRight" size={16} />}{children}{caretPosition === 'end' && <Icon name="CaretRight" size={16} />}
  </button>} />,
};
const { Preview, Details } = createSelectedElementDetail({ Icon: ElementIcon, Message, useIntl: useRoutineIntl, Collapsible });
function ChipButton({ onKeyUp, ...props }) {
  return <button type="button" {...props} onKeyUp={event => {
    event.preventBaseUIHandler = () => {};
    onKeyUp?.(event);
  }} />;
}
const ChipBody = createSelectedElementChipBody({ Button: ChipButton });

// pk keeps the exact original button tree/classes. The local host owns its
// portal, focus, hover intent and the per-draft lifetime of the attachment.
export function SourceSelectedElementPill({ entry, onRemove, disabled, previewLayerBase = 0 }) {
  const anchor = useRef(null), previewRef = useRef(null), closeTimer = useRef(null);
  const [preview, setPreview] = useState(null);
  const label = selectedElementLabel(entry.context);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (preview?.pinned) previewRef.current?.focus({ preventScroll: true });
  }, [preview?.pinned]);
  const intent = (value, immediate, pinned, via) => {
    clearTimeout(closeTimer.current);
    setPreview(current => value === null ? null : current?.pinned && !pinned ? current : { pinned: !!pinned, via: via ?? 'hover' });
  };
  const leave = () => { closeTimer.current = setTimeout(() => setPreview(value => value?.pinned ? value : null), 180); };
  const remove = keyboard => {
    if (disabled || !onRemove) return;
    if (keyboard) {
      const buttons = [...(anchor.current?.closest('.sca-strip')?.querySelectorAll('.epitaxy-pill-body') ?? [])];
      const index = buttons.indexOf(anchor.current?.querySelector('.epitaxy-pill-body'));
      (buttons[index + 1] ?? buttons[index - 1])?.focus();
    }
    setPreview(null); onRemove(entry.id);
  };
  const keyDown = event => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape' && preview) { event.preventDefault(); event.stopPropagation(); setPreview(null); return; }
    if (event.key === ' ') { event.preventDefault(); event.stopPropagation(); intent(preview?.pinned ? null : entry.id, true, true, 'keyboard'); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(true); return; }
    const buttons = [...(anchor.current?.closest('.sca-strip')?.querySelectorAll('.epitaxy-pill-body') ?? [])];
    const at = buttons.indexOf(event.currentTarget);
    const next = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (next !== undefined) { event.preventDefault(); event.stopPropagation(); setPreview(null); buttons[next]?.focus(); }
  };
  return <div ref={anchor} data-cds-attachment="" data-kind="elementContext" data-status={entry.status}
    className="sca-pill selected-element-pill" onMouseEnter={() => intent(entry.id, false, false, 'hover')} onMouseLeave={leave}>
    <ChipBody value={entry.id} label={label} thumbnail={<Icon name="Cursor" size={12} />}
      hoverPeek previewOpen={!!preview} previewPinned={!!preview?.pinned} previewContent={entry.context}
      previewRef={previewRef} onPreviewIntent={intent} onKeyDown={keyDown} />
    {entry.status === 'loading' && <span className="sr-only" role="status">{t('Processing image')}</span>}
    {onRemove && <button type="button" className="epitaxy-pill-remove sca-remove" tabIndex={-1} disabled={disabled}
      aria-label={t('Remove {name}', { name: label })} onMouseDown={event => event.preventDefault()}
      onClick={event => { event.stopPropagation(); event.preventDefault(); remove(anchor.current?.contains(document.activeElement)); }}><Icon name="X" size={12} /></button>}
    {preview && anchor.current && <SourcePopover anchor={anchor.current} side="top" align="start" sideOffset={8} padding="none"
      label={label} dataCds="AttachmentPreview" className="selected-element-popover" layerBase={previewLayerBase}
      initialFocus={false} finalFocus={preview.pinned ? anchor.current.querySelector('button') : false} onClose={() => setPreview(null)}>
      <div ref={previewRef} tabIndex={-1} data-epitaxy-pill-preview="" onMouseEnter={() => clearTimeout(closeTimer.current)} onMouseLeave={leave}>
        <Preview ctx={entry.context} width={320} scrollRegionLabel={label} openedVia={preview.via} />
      </div>
    </SourcePopover>}
  </div>;
}

function ElementScreenshot({ src, alt, onClick, className = '', ref }) {
  const [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false);
  return <div ref={ref} className={`source-user-attachment-image ${className}`} data-cds="MessageAttachmentsImage" role="button" tabIndex={0}
    aria-label={alt} onClick={onClick} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.(event); } }}>
    <div className="source-user-attachment-card" data-cds="Card">
      <span aria-hidden="true" className="source-user-attachment-fill" />
      {!failed && <img src={src} alt={alt} width={120} height={120} className="source-user-attachment-picture" data-loaded={loaded ? '' : undefined}
        onLoad={() => setLoaded(true)} onError={() => setFailed(true)} draggable={false} />}
      {failed && <span className="source-user-attachment-glyph"><Icon name="Image" size={24} /></span>}
    </div>
  </div>;
}
const TranscriptCard = createSelectedElementTranscript({ useIntl: useRoutineIntl, Message, Icon: ElementIcon, Collapsible, Details, Image: ElementScreenshot });
export function SourceSelectedElementTranscript({ view, screenshot }) {
  const [viewer, setViewer] = useState(null);
  if (view.simulator) return null;
  return <div className="flex min-w-0 basis-full [justify-content:inherit]" data-element-context="">
    <TranscriptCard view={view} screenshot={screenshot ? { ...screenshot, onOpen: event => setViewer(event.currentTarget) } : undefined} />
    {viewer && screenshot && <SourceImageViewer src={screenshot.src} alt={t('Screenshot of the selected element')} originRef={{ current: viewer }} onClose={() => setViewer(null)} />}
  </div>;
}
