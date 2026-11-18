import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { createPreviewMenuItems } from './generated/code-editor/preview-menu-items.mjs';
import { createPreviewServerMenu } from './generated/code-editor/preview-server-menu.mjs';
import { RoutineSourceMenu, useRoutineIntl } from './source-routine-adapters.jsx';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { SourceTooltip } from './source-tooltip.jsx';
import { SourceSpinner } from './source-pane-states.jsx';
import { t } from '../electron/i18n/index.mjs';

function useStable(callback) {
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; });
  return useCallback((...args) => latest.current?.(...args), []);
}
function useOptionalStable(callback) {
  const stable = useStable(callback);
  return callback === undefined ? undefined : stable;
}
const Button = ({ tooltip, ...props }) => <SourceSettingsButton iconSize="auto" {...props} />;
const Spinner = ({ size, ...props }) => <SourceSpinner size={size === 'sm' ? 16 : size} {...props} />;
const MenuHost = {
  ...RoutineSourceMenu,
  Trigger: ({ render, disabled }) => <RoutineSourceMenu.Trigger render={React.cloneElement(render, { disabled })} />,
  Popup: ({ container, collisionPadding, ...props }) => <RoutineSourceMenu.Popup {...props} label={t('Dev servers')} />,
};
const renderItems = createPreviewMenuItems({ Menu: MenuHost, Tooltip: SourceTooltip, Spinner, collisionPadding: 8 });
export const { Menu: OriginalPreviewServerMenu } = createPreviewServerMenu({
  Menu: MenuHost, Tooltip: SourceTooltip, Button, Spinner, Provider: React.Fragment,
  useStable, useOptionalStable, usePortal: () => undefined, useIntl: useRoutineIntl, renderItems, collisionPadding: 8,
});

export function SourcePreviewServerMenu({ rows, loading, onStart, onStop, onAddServer }) {
  const servers = rows.map(row => ({
    id: row.name, label: row.name, detail: row.port ? `:${row.port}` : undefined,
    running: row.running || row.status === 'starting', starting: row.status === 'starting',
  }));
  const labels = Object.fromEntries(Object.entries({
    trigger: 'Dev servers', header: 'Servers', run: 'Run', stop: 'Stop', stopAll: 'Stop all servers',
    runningState: 'Running', stoppedState: 'Stopped', starting: 'Starting', addServer: 'Add server', empty: 'No dev server configured',
  }).map(([key, label]) => [key, t(label)]));
  return <OriginalPreviewServerMenu servers={servers} loading={loading} onRun={onStart} onStop={onStop}
    onStopAll={servers.some(server => server.running) ? () => servers.filter(server => server.running).forEach(server => onStop(server.id)) : undefined}
    onAddServer={onAddServer} labels={labels} />;
}
