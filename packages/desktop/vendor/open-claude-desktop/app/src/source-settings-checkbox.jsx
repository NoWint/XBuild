import React from 'react';
import { Icon } from './icons';
import './source-settings-checkbox.css';

// The CDS Checkbox (2.2553.1 shared-frame Ux/Hx: data-cds="Checkbox", a size-[--cds-checkbox] box with border-strong,
// hover border-stronger, bg-fill-accent + text-on-accent Check once checked, shadow-focus, opacity-disabled). The
// native input stays for form semantics but is painted as the box (appearance:none), so macOS never draws its Aqua
// checkbox. Put it inside the row's <label> so the label text toggles it.
export function SourceSettingsCheckbox({ checked = false, disabled = false, onChange, className, ...rest }) {
  return <span className={className ? `sscb ${className}` : 'sscb'} data-cds="Checkbox" data-checked={checked ? '' : undefined}
    data-disabled={disabled ? '' : undefined}>
    <input {...rest} type="checkbox" className="sscb-input" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked, event)}/>
    <Icon name="Check" size={16} weight="strong" className="sscb-glyph" style={{ fontSize: 'var(--cds-checkbox-glyph, 12px)' }}/>
  </span>;
}
