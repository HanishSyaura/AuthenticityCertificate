import React from 'react';

export function Field({ label, hint, error, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-700">
        {label}
      </label>
      {hint ? <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div> : null}
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
