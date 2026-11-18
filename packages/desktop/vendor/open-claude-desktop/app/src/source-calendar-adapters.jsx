import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { getLocale } from '../electron/i18n/index.mjs';
import { SourceSettingsButton } from './source-settings-button.jsx';
import { useNativeFieldControlProps } from './source-field-adapters.jsx';
import { SourcePopover } from './source-popover.jsx';

export const calendarLocale = () => getLocale();
export function CalendarButton({ tooltip, size, iconSize, ...props }) {
  return <SourceSettingsButton {...props} size={size} iconSize={iconSize ?? (size === 'xs' || size === 'xxs' ? 'auto-sm' : 'auto')} />;
}

const Context = createContext(null);
function Root({ open, onOpenChange, children }) {
  const id = useId(), trigger = useRef(null), wasOpen = useRef(false);
  const [triggerNode, setTriggerNode] = useState(null);
  useEffect(() => {
    // Source calendar selections close by setting the controlled open state.
    // In that path no host dismissal callback runs, so restore lost focus here.
    if (wasOpen.current && !open) {
      const node = trigger.current, doc = node?.ownerDocument, active = doc?.activeElement;
      if (node?.isConnected && (!active || active === doc.body || !active.isConnected)) node.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);
  return <Context.Provider value={{ open, onOpenChange, trigger, triggerNode, setTriggerNode, id }}>{children}</Context.Provider>;
}

function Trigger({ render }) {
  const { open, onOpenChange, trigger, setTriggerNode, id } = useContext(Context);
  const sourceRef = render.props.ref;
  const ref = useCallback(node => {
    trigger.current = node;
    setTriggerNode(node);
    if (typeof sourceRef === 'function') return sourceRef(node);
    if (sourceRef) sourceRef.current = node;
  }, [trigger, setTriggerNode, sourceRef]);
  return React.cloneElement(render, {
    ref,
    'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? id : undefined,
    onClick: event => {
      render.props.onClick?.(event);
      if (!event.defaultPrevented && !render.props.disabled) onOpenChange(!open, { reason: 'trigger-press', event });
    },
  });
}

function Popup({ anchor, 'aria-label': label, finalFocus, ...props }) {
  const { open, onOpenChange, triggerNode, id } = useContext(Context);
  if (!open || !triggerNode) return null;
  const owner = anchor?.current ?? triggerNode;
  const layerBase = Number.parseFloat(getComputedStyle(owner).getPropertyValue('--cds-layer-base')) || 0;
  return <SourcePopover {...props} id={id} anchor={owner} label={label} layerBase={layerBase}
    finalFocus={finalFocus === true ? triggerNode : finalFocus}
    onClose={(reason, event) => onOpenChange(false, { reason, event })} />;
}
export const CalendarPopover = { Root, Trigger, Popup };

export function useCalendarFieldDescription() {
  const props = useNativeFieldControlProps();
  return { getDescriptionProps: extra => ({...extra,
    'aria-describedby': [extra?.['aria-describedby'], props['aria-describedby']].filter(Boolean).join(' ') || undefined,
  }) };
}
