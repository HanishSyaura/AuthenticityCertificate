import React, { useEffect, useMemo, useRef, useState } from 'react';

function exec(cmd, value = null) {
  try {
    document.execCommand('styleWithCSS', false, true);
  } catch (e) {
    void e;
  }
  document.execCommand(cmd, false, value);
}

function buildTableHtml(rows, cols) {
  const r = Math.max(1, Math.min(20, Number(rows) || 1));
  const c = Math.max(1, Math.min(12, Number(cols) || 1));
  const cells = Array.from({ length: c }).map(() => '<td style="border:1px solid #e4e4e7; padding:6px;">&nbsp;</td>').join('');
  const trs = Array.from({ length: r }).map(() => `<tr>${cells}</tr>`).join('');
  return `<table style="border-collapse:collapse; width:100%;">${trs}</table>`;
}

export default function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const [color, setColor] = useState('#111827');
  const sizeOptions = useMemo(() => [1, 2, 3, 4, 5, 6, 7], []);

  useEffect(() => {
    if (focused) return;
    const el = ref.current;
    if (!el) return;
    const next = String(value || '');
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [focused, value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange(el.innerHTML);
  };

  const run = (cmd, v = null) => {
    exec(cmd, v);
    emit();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-50 p-2">
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('bold')}>
          B
        </button>
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold italic" onMouseDown={(e) => e.preventDefault()} onClick={() => run('italic')}>
          I
        </button>
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold underline" onMouseDown={(e) => e.preventDefault()} onClick={() => run('underline')}>
          U
        </button>
        <button
          type="button"
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold line-through"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('strikeThrough')}
        >
          S
        </button>
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('superscript')}>
          x²
        </button>
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('subscript')}>
          x₂
        </button>

        <div className="mx-1 h-5 w-px bg-zinc-200" />

        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('formatBlock', '<h1>')}>
          H1
        </button>
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('formatBlock', '<h2>')}>
          H2
        </button>
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('insertUnorderedList')}>
          • List
        </button>
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('insertOrderedList')}>
          1. List
        </button>
        <button type="button" className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('formatBlock', '<blockquote>')}>
          “ ”
        </button>

        <div className="mx-1 h-5 w-px bg-zinc-200" />

        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            exec('foreColor', e.target.value);
            emit();
          }}
          className="h-8 w-10 rounded border border-zinc-200 bg-white p-1"
          title="Text color"
        />
        <select
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold"
          defaultValue="3"
          onChange={(e) => {
            run('fontSize', e.target.value);
          }}
        >
          {sizeOptions.map((n) => (
            <option key={n} value={String(n)}>
              Size {n}
            </option>
          ))}
        </select>

        <div className="mx-1 h-5 w-px bg-zinc-200" />

        <button
          type="button"
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = window.prompt('Link URL');
            if (!url) return;
            run('createLink', url);
          }}
        >
          Link
        </button>
        <button
          type="button"
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = window.prompt('Image URL');
            if (!url) return;
            run('insertImage', url);
          }}
        >
          Image
        </button>
        <button
          type="button"
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const rows = window.prompt('Table rows', '2');
            const cols = window.prompt('Table columns', '2');
            if (!rows || !cols) return;
            run('insertHTML', buildTableHtml(rows, cols));
          }}
        >
          Table
        </button>
        <button
          type="button"
          className="ml-auto rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            exec('removeFormat');
            exec('unlink');
            emit();
          }}
        >
          Clear
        </button>
      </div>
      <div
        ref={ref}
        className="min-h-24 rounded-b-xl px-3 py-2 text-sm outline-none"
        contentEditable
        suppressContentEditableWarning
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          emit();
        }}
        onInput={emit}
      />
    </div>
  );
}
