import React, { createContext, useContext, useState } from 'react';
import { SourceDialog, SourceConfirmationDialog } from './source-dialog.jsx';
import { SourceSwitch } from './source-switch.jsx';
import { SourceSettingsCheckbox } from './source-settings-checkbox.jsx';
import { SourceTooltip } from './source-tooltip.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { Icon } from './icons';
import { PERMISSION_OPTIONS } from './source-permission-menu.jsx';
import { lm as scheduledCopy } from './generated/chat/shared-19-CjdiaR4X.js';
import { RoutineContext, useRoutineIntl } from './source-routine-adapters.jsx';
import { t } from '../electron/i18n/index.mjs';
export { useRoutineIntl, noRemoteModel, UnavailableRoutineBadge } from './source-routine-adapters.jsx';
export { useHomeNow as useRoutineNow } from './source-home-adapters.jsx';
export const useScheduledCopy = () => ({ ...scheduledCopy,
  // The local delete operation deliberately keeps sessions. Do not promise archive.
  deleteBody: { defaultMessage: 'This removes the schedule. Existing conversations and files are kept.', id: 'local-routine-delete' },
});
export const noRoutineBlockers = () => [];
export const scheduledKind = () => ({ kind: 'scheduled' });
export const noRoutineConnectionHold = () => ({});
export const noRoutineReview = () => ({ heldForReview: false });
export const useCurrentScheduledCopy = () => ({ ...useContext(RoutineContext).copy, deleteBody: useScheduledCopy().deleteBody });
export const noRoutineTools = () => undefined;
const routineSkills = new Map();
export const useRoutineSkills = () => routineSkills;
export const noRoutineDevice = () => undefined;
export const noRoutineEffect = () => {};
export const noDeviceConnectivity = () => () => undefined;
export const useRoutineReadState = selector => selector({ readState: useContext(RoutineContext).readState });
export const RoutineFragment = ({ children }) => children;
export function RoutineCheckbox({ label, onCheckedChange, ...props }) {
  return <label className="flex items-center gap-sm text-body"><SourceSettingsCheckbox {...props} onChange={onCheckedChange} />{label}</label>;
}
export function RoutineInfo({ content, size }) {
  return <SourceTooltip content={content} multiline><SourceSettingsButton variant="ghost" iconOnly icon="Info" size={size} aria-label={t('More info')} /></SourceTooltip>;
}
export const routinePermissionSupported = value => PERMISSION_OPTIONS.some(item => item.value === value);
export function routinePermissionDescription({ mode }) {
  const option = PERMISSION_OPTIONS.find(item => item.value === mode);
  return { label: option?.label ?? mode, description: option?.description, icon: <Icon name={mode === 'bypass' ? 'Warning' : 'Shield'} size={16} />, isWarning: mode === 'bypass' };
}
export const routineToolLabel = value => value;
export const routinePermissionRule = value => value;
export function RoutineMessage({ defaultMessage, values }) {
  return useRoutineIntl().formatMessage({ defaultMessage, id: defaultMessage }, values);
}
export function RoutineSwitch({ 'aria-label': label, checked, disabled, onCheckedChange }) {
  const host = useContext(RoutineContext);
  return <SourceSwitch label={label} checked={checked} disabled={disabled || !!host.busy} onChange={onCheckedChange} />;
}
export function RoutineConfirmation({ onOpenChange, description, onConfirm, ...props }) {
  const host = useContext(RoutineContext);
  return <SourceConfirmationDialog {...props} body={description} pending={!!host.busy} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />;
}
export function RoutineSessionStatus({ liveStatus, hasError, sessionId }) {
  const host = useContext(RoutineContext);
  const run = host.task?.runs.find(run => run.threadId === sessionId);
  const label = hasError ? t('Failed') : liveStatus === 'running' ? t('Running') : liveStatus === 'awaiting' ? t('Needs attention') : run?.status === 'interrupted' ? t('Interrupted') : t('Completed');
  return <span role="status" aria-label={label} className="flex items-center"><Icon name={hasError ? 'Warning' : liveStatus === 'running' ? 'Circle' : 'Check'} size={16} /></span>;
}

// Original detail owns the trigger, header content and preview markup. The host
// supplies the existing accessible dialog portal, focus trap and dismissal.
const DialogContext = createContext(null);
function Root({ children, open: controlledOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = value => { setLocalOpen(value); onOpenChange?.(value); };
  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>;
}
function Trigger({ children, ...props }) {
  const { setOpen } = useContext(DialogContext);
  return <button {...props} type="button" onClick={() => setOpen(true)}>{children}</button>;
}
function Header() { return null; }
function Popup({ children, size }) {
  const { open, setOpen } = useContext(DialogContext);
  const nodes = React.Children.toArray(children), header = nodes.find(child => child.type === Header);
  return <SourceDialog open={open} size={size} title={header?.props.children} description={header?.props.description}
    showClose={header?.props.showClose} density="comfortable" onClose={() => setOpen(false)}>
    {nodes.filter(child => child !== header)}
  </SourceDialog>;
}
export const RoutineDialog = { Root, Trigger, Popup, Header };
