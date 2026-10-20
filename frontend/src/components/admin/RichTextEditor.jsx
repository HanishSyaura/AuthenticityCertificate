import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Quill from 'quill';

const FONT_OPTIONS = ['inter', 'arial', 'helvetica', 'verdana', 'tahoma', 'trebuchet-ms', 'georgia', 'garamond', 'times-new-roman', 'courier-new', 'serif', 'monospace'];
const SIZE_OPTIONS = ['8pt', '9pt', '10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '32pt', '36pt', '48pt', '60pt', '72pt'];
const TOOLBAR_PRESETS = {
  standard: [
    [{ header: [false, 1, 2, 3, 4] }],
    [{ size: [false, ...SIZE_OPTIONS] }],
    [{ font: [false, ...FONT_OPTIONS] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ script: 'sub' }, { script: 'super' }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
    ['blockquote'],
    ['link', 'clean']
  ]
};

if (!Quill.__acConfigured) {
  const Font = Quill.import('formats/font');
  Font.whitelist = FONT_OPTIONS;
  Quill.register(Font, true);

  const SizeStyle = Quill.import('attributors/style/size');
  SizeStyle.whitelist = SIZE_OPTIONS;
  Quill.register(SizeStyle, true);

  Quill.__acConfigured = true;
}

function normalizeEditorHtml(input) {
  const html = String(input || '').trim();
  return html === '<p><br></p>' ? '' : html;
}

const RichTextEditor = forwardRef(function RichTextEditor(
  { value, onChange, placeholder, minHeight = '6rem', maxHeight = '14rem', readOnly = false, toolbarPreset = 'standard' },
  ref
) {
  const rootRef = useRef(null);
  const toolbarRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const editor = quillRef.current;
        editor?.focus?.();
      },
      insertText: (text) => {
        const editor = quillRef.current;
        if (!editor) return;
        const t = String(text || '');
        const range = editor.getSelection?.(true);
        const index = range && typeof range.index === 'number' ? range.index : editor.getLength?.() || 0;
        editor.insertText(index, t, 'user');
        editor.setSelection(index + t.length, 0, 'user');
        editor.focus?.();
      }
    }),
    []
  );

  useEffect(() => {
    const host = rootRef.current;
    if (!host || quillRef.current) return undefined;

    const editorHost = document.createElement('div');
    host.replaceChildren(editorHost);
    const modules = {
      keyboard: {
        bindings: {
          tab: {
            key: 9,
            handler: (range, context) => {
              const editor = quillRef.current;
              if (!editor) return true;
              if (context?.format?.list) {
                editor.format('indent', '+1', 'user');
                return false;
              }
              editor.insertText(range.index, '    ', 'user');
              editor.setSelection(range.index + 4, 0, 'user');
              return false;
            }
          },
          shiftTab: {
            key: 9,
            shiftKey: true,
            handler: (range, context) => {
              const editor = quillRef.current;
              if (!editor) return true;
              if (context?.format?.list) {
                editor.format('indent', '-1', 'user');
                return false;
              }
              return true;
            }
          }
        }
      },
      ...(readOnly ? {} : { toolbar: toolbarRef.current || undefined })
    };

    const quill = new Quill(editorHost, {
      theme: 'snow',
      readOnly,
      placeholder,
      formats: [
        'bold',
        'italic',
        'underline',
        'strike',
        'header',
        'color',
        'background',
        'script',
        'list',
        'indent',
        'blockquote',
        'link',
        'size',
        'font',
        'align'
      ],
      modules
    });

    quillRef.current = quill;

    const handleTextChange = (_delta, _oldDelta, source) => {
      if (source !== 'user') return;
      onChangeRef.current?.(normalizeEditorHtml(quill.root.innerHTML));
    };

    quill.on('text-change', handleTextChange);
    const nextValue = normalizeEditorHtml(value);
    if (nextValue) quill.clipboard.dangerouslyPasteHTML(nextValue, 'silent');
    else quill.setContents([], 'silent');

    return () => {
      quill.off('text-change', handleTextChange);
      quillRef.current = null;
      host.replaceChildren();
    };
  }, [placeholder, readOnly]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    quill.enable(!readOnly);
    if (!readOnly && toolbarRef.current) {
      quill.getModule('toolbar')?.container?.classList?.add('ql-toolbar', 'ql-snow');
    }
  }, [readOnly]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const nextValue = normalizeEditorHtml(value);
    const currentValue = normalizeEditorHtml(quill.root.innerHTML);
    if (currentValue === nextValue) return;
    if (!nextValue) quill.setContents([], 'silent');
    else quill.clipboard.dangerouslyPasteHTML(nextValue, 'silent');
  }, [value]);

  return (
    <div className="ac-rt ac-richtext rounded-xl border border-zinc-200 bg-white" style={{ '--ac-rt-min-h': minHeight, '--ac-rt-max-h': maxHeight }}>
      {!readOnly ? (
        <div ref={toolbarRef} className="ql-toolbar ql-snow">
          {(TOOLBAR_PRESETS[toolbarPreset] || TOOLBAR_PRESETS.standard).map((group, groupIndex) => (
            <span key={groupIndex} className="ql-formats">
              {group.map((item, itemIndex) => {
                if (typeof item === 'string') {
                  return <button key={`${item}-${itemIndex}`} type="button" className={`ql-${item}`} aria-label={item} />;
                }
                const [format, rawValue] = Object.entries(item)[0];
                const values = Array.isArray(rawValue) ? rawValue : [rawValue];
                if (format === 'header' || format === 'size' || format === 'font' || format === 'align') {
                  return (
                    <select key={`${format}-${itemIndex}`} className={`ql-${format}`} defaultValue="">
                      {values.map((optionValue, optionIndex) => (
                        <option key={`${String(optionValue)}-${optionIndex}`} value={optionValue === false ? '' : String(optionValue)}>
                          {optionValue === false ? '' : String(optionValue)}
                        </option>
                      ))}
                    </select>
                  );
                }
                return values.map((optionValue, optionIndex) => (
                  <button
                    key={`${format}-${String(optionValue)}-${optionIndex}`}
                    type="button"
                    className={`ql-${format}`}
                    value={String(optionValue)}
                    aria-label={`${format}-${String(optionValue)}`}
                  />
                ));
              })}
            </span>
          ))}
        </div>
      ) : null}
      <div ref={rootRef} />
    </div>
  );
});

export default RichTextEditor;
