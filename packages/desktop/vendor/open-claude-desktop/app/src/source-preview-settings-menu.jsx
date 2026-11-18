import React, { createContext, useContext, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPreviewSettingsMenu } from './generated/code-editor/preview-settings-menu.mjs';
import { createPreviewPaneMenu } from './generated/code-editor/preview-pane-menu.mjs';
import { SourceMenu, menuTriggerProps } from './source-menu.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SourceTooltip } from './source-tooltip.jsx';
import { SourceConfirmationDialog } from './source-dialog.jsx';
import { useRoutineIntl } from './source-routine-adapters.jsx';
import { t } from '../electron/i18n/index.mjs';

const RootContext = createContext(null), NestedContext = createContext(false);
function Root({ children, onOpenChange }) {
  const [anchor, setAnchor] = useState(null), [highlight, setHighlight] = useState();
  const change = (node, highlight) => { setAnchor(node); setHighlight(highlight); onOpenChange?.(!!node); };
  return <RootContext.Provider value={{ anchor, change, highlight }}><NestedContext.Provider value={false}>{children}</NestedContext.Provider></RootContext.Provider>;
}
function Trigger({ render, disabled }) {
  const { anchor, change } = useContext(RootContext);
  return React.cloneElement(render, { disabled,
    ...menuTriggerProps({ open: !!anchor, onOpen: (highlight, event) => change(event.currentTarget, highlight) }),
    onClick: event => change(anchor ? null : event.currentTarget),
  });
}
function Popup({ container, collisionPadding, ...props }) {
  const { anchor, change, highlight } = useContext(RootContext), nested = useContext(NestedContext);
  if (nested) return <SourceMenu.Popup {...props} />;
  return anchor ? <SourceMenu.Popup {...props} anchor={anchor} label={anchor.getAttribute('aria-label')}
    initialHighlight={highlight} onClose={() => change(null)} /> : null;
}
function Submenu({ children, ...props }) {
  return <SourceMenu.Submenu {...props}><NestedContext.Provider value={true}>{children}</NestedContext.Provider></SourceMenu.Submenu>;
}
function useOptionalStable(callback) {
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; });
  const stable = useCallback((...args) => latest.current?.(...args), []);
  return callback === undefined ? undefined : stable;
}
const Button = ({ tooltip, ...props }) => <SourceSettingsButton iconSize="auto" {...props} />;
const MenuHost = { ...SourceMenu, Root, Trigger, Popup, Submenu };
const { Menu: PaneMenu } = createPreviewPaneMenu({ Menu: MenuHost, Button, Tooltip: SourceTooltip, Provider: React.Fragment,
  useIntl: useRoutineIntl, usePortal: () => undefined, collisionPadding: 8,
  isTextInput: node => !!node?.closest?.('input,textarea,[contenteditable=true]'), asElement: node => node?.nodeType === 1 ? node : null,
  useOwnerWindow: () => typeof window === 'undefined' ? null : window,
});
const ConfirmDialog = ({ open, onOpenChange, description, ...props }) => open
  ? <SourceConfirmationDialog {...props} body={description} onCancel={() => onOpenChange(false)} /> : null;
const source = createPreviewSettingsMenu({ useOptionalStable, PaneMenu, ConfirmDialog, useIntl: useRoutineIntl });
export const SourcePreviewClearDataDialog = source.ClearDataDialog;
export function SourcePreviewSettingsMenu({ labels, ...props }) {
  const translated = Object.fromEntries(Object.entries(source.labels).map(([key, value]) => [key, t(value)]));
  return <source.Menu paneName={t('Preview')} {...props} labels={{ ...translated, ...labels }} />;
}
