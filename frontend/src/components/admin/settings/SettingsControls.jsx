import React from 'react';
import InfoTooltip from '../../ui/InfoTooltip';

export function Field({ label, hint, error, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700">
        <span>{label}</span>
        {hint ? <InfoTooltip content={hint} /> : null}
      </label>
      <div className="mt-2">{children}</div>
      {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

export function Input({ id, value, onChange, disabled, type = 'text', placeholder, autoComplete }) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="ac-input-compact"
    />
  );
}

export function TextArea({ id, value, onChange, disabled, placeholder, rows = 4 }) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
      className="ac-input-compact min-h-[110px] resize-y py-2.5"
    />
  );
}

export function Select({ id, value, onChange, disabled, options }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="ac-input-compact bg-white"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
        checked ? 'border-brand-600 bg-brand-600' : 'border-zinc-300 bg-zinc-200'
      } ${disabled ? 'opacity-60' : 'hover:shadow-sm'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}
