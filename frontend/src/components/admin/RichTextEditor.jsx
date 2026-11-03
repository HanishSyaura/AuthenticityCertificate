import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Quill from 'quill';

const FONT_OPTIONS = ['inter', 'arial', 'helvetica', 'verdana', 'tahoma', 'trebuchet-ms', 'georgia', 'garamond', 'times-new-roman', 'courier-new', 'serif', 'monospace'];
const SIZE_OPTIONS = ['8pt', '9pt', '10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '32pt', '36pt', '48pt', '60pt', '72pt'];
const BULLET_STYLE_OPTIONS = [false, 'disc', 'circle', 'square', 'dash', 'arrow', 'check'];
const NUMBER_STYLE_OPTIONS = [false, 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'];
const LIST_STYLE_LABELS = {
  disc: 'Disc •',
  circle: 'Circle ○',
  square: 'Square ▪',
  dash: 'Dash –',
  arrow: 'Arrow →',
  check: 'Check ✓',
  decimal: '1, 2, 3',
  'lower-alpha': 'a, b, c',
  'upper-alpha': 'A, B, C',
  'lower-roman': 'i, ii, iii',
  'upper-roman': 'I, II, III'
};
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

  const Parchment = Quill.import('parchment');
  const BulletStyle = new Parchment.ClassAttributor('bulletStyle', 'ql-bullet-style', {
    scope: Parchment.Scope.BLOCK,
    whitelist: BULLET_STYLE_OPTIONS.filter(Boolean)
  });
  const NumberStyle = new Parchment.ClassAttributor('numberStyle', 'ql-number-style', {
    scope: Parchment.Scope.BLOCK,
    whitelist: NUMBER_STYLE_OPTIONS.filter(Boolean)
  });
  Quill.register(BulletStyle, true);
  Quill.register(NumberStyle, true);

  Quill.__acConfigured = true;
}

function normalizeEditorHtml(input) {
  const html = String(input || '').trim();
  return html === '<p><br></p>' ? '' : html;
}

function restoreListStyleClasses(editorRoot, html) {
  if (!editorRoot || !html || typeof document === 'undefined') return;

  const source = document.createElement('div');
  source.innerHTML = html;

  const sourceItems = Array.from(source.querySelectorAll('li[data-list]'));
  const targetItems = Array.from(editorRoot.querySelectorAll('li[data-list]'));
  const allowed = [
    /^ql-bullet-style-(disc|circle|square|dash|arrow|check)$/,
    /^ql-number-style-(decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)$/
  ];

  sourceItems.forEach((sourceItem, index) => {
    const targetItem = targetItems[index];
    if (!targetItem) return;

    Array.from(targetItem.classList).forEach((name) => {
      if (allowed.some((pattern) => pattern.test(name))) {
        targetItem.classList.remove(name);
      }
    });

    Array.from(sourceItem.classList).forEach((name) => {
      if (allowed.some((pattern) => pattern.test(name))) {
        targetItem.classList.add(name);
      }
    });
  });
}

function applyListStyle(quill, format, value, onChangeRef, selectionOverride = null) {
  if (!quill) return;

  const range = selectionOverride || quill.getSelection(true);
  if (!range) return;

  const expectedType = format === 'bulletStyle' ? 'bullet' : 'ordered';
  const prefix = format === 'bulletStyle' ? 'ql-bullet-style-' : 'ql-number-style-';
  const allowedValues = format === 'bulletStyle'
    ? ['disc', 'circle', 'square', 'dash', 'arrow', 'check']
    : ['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'];

  const selectedClass = allowedValues.includes(value) ? prefix + value : null;
  const end = range.index + range.length;
  let position = range.index;
  let safety = 0;

  while (position <= end && safety++ < 500) {
    const result = quill.getLine(position);
    const line = result && result[0];
    if (!line) break;

    const node = line.domNode;
    if (node && node.tagName === 'LI' && node.getAttribute('data-list') === expectedType) {
      Array.from(node.classList).forEach((name) => {
        if (name.startsWith(prefix)) node.classList.remove(name);
      });
      if (selectedClass) node.classList.add(selectedClass);
    }

    if (range.length === 0) break;

    const nextPosition = quill.getIndex(line) + line.length();
    if (nextPosition <= position) break;
    position = nextPosition;
  }

  onChangeRef.current?.(normalizeEditorHtml(quill.root.innerHTML));
}

const RichTextEditor = forwardRef(function RichTextEditor(
  { value, onChange, placeholder, minHeight = '6rem', maxHeight = '14rem', readOnly = false, toolbarPreset = 'standard' },
  ref
) {
  const rootRef = useRef(null);
  const toolbarRef = useRef(null);
  const listSelectionRef = useRef(null);
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
      ...(readOnly ? {} : {
        toolbar: {
          container: toolbarRef.current,
          handlers: {
            bulletStyle: function(value) {
              applyListStyle(quillRef.current, 'bulletStyle', value, onChangeRef);
            },
            numberStyle: function(value) {
              applyListStyle(quillRef.current, 'numberStyle', value, onChangeRef);
            }
          }
        }
      })
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
        'align',
        'bulletStyle',
        'numberStyle'
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
    if (nextValue) { quill.clipboard.dangerouslyPasteHTML(nextValue, 'silent'); restoreListStyleClasses(quill.root, nextValue); }
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
    else { quill.clipboard.dangerouslyPasteHTML(nextValue, 'silent'); restoreListStyleClasses(quill.root, nextValue); }
  }, [value]);

  return (
    <div className="ac-rt ac-richtext rounded-xl border border-zinc-200 bg-white" style={{ '--ac-rt-min-h': minHeight, '--ac-rt-max-h': maxHeight }}>
      {!readOnly ? (
        <>
        <div ref={toolbarRef} className="ql-toolbar ql-snow">
          {(TOOLBAR_PRESETS[toolbarPreset] || TOOLBAR_PRESETS.standard).map((group, groupIndex) => (
            <span key={groupIndex} className="ql-formats">
              {group.map((item, itemIndex) => {
                if (typeof item === 'string') {
                  return <button key={`${item}-${itemIndex}`} type="button" className={`ql-${item}`} aria-label={item} />;
                }
                const [format, rawValue] = Object.entries(item)[0];
                const values = Array.isArray(rawValue) ? rawValue : [rawValue];
                if (format === 'header' || format === 'size' || format === 'font' || format === 'align' || format === 'bulletStyle' || format === 'numberStyle') {
                  return (
                    <select
                      key={`${format}-${itemIndex}`}
                      id={`richtext-${format}-${itemIndex}`}
                      name={`richtext-${format}-${itemIndex}`}
                      aria-label={`Text ${format}`}
                      className={`ql-${format}`}
                      defaultValue=""
                    >
                      {values.map((optionValue, optionIndex) => (
                        <option key={`${String(optionValue)}-${optionIndex}`} value={optionValue === false ? '' : String(optionValue)}>
                          {optionValue === false
                            ? (format === 'bulletStyle' ? 'Bullet style' : format === 'numberStyle' ? 'Numbering style' : '')
                            : (LIST_STYLE_LABELS[String(optionValue)] || String(optionValue))}
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
        <div className="ac-list-style-controls">
          <div className="ac-list-style-field">
            <label htmlFor="ac-bullet-style">Bullet Style</label>
            <select
              id="ac-bullet-style"
              value=""
              onMouseDown={() => { listSelectionRef.current = quillRef.current?.getSelection(); }}
              onFocus={() => { listSelectionRef.current = quillRef.current?.getSelection(); }}
              onChange={(event) => {
                const quill = quillRef.current;
                applyListStyle(quill, 'bulletStyle', event.target.value, onChangeRef, listSelectionRef.current);
                listSelectionRef.current = null;
                event.target.value = '';
              }}
            >
              <option value="">Choose bullet style…</option>
              {BULLET_STYLE_OPTIONS.filter(Boolean).map((option) => (
                <option key={option} value={option}>{LIST_STYLE_LABELS[option]}</option>
              ))}
            </select>
          </div>
          <div className="ac-list-style-field">
            <label htmlFor="ac-number-style">Numbering Style</label>
            <select
              id="ac-number-style"
              value=""
              onMouseDown={() => { listSelectionRef.current = quillRef.current?.getSelection(); }}
              onFocus={() => { listSelectionRef.current = quillRef.current?.getSelection(); }}
              onChange={(event) => {
                const quill = quillRef.current;
                applyListStyle(quill, 'numberStyle', event.target.value, onChangeRef, listSelectionRef.current);
                listSelectionRef.current = null;
                event.target.value = '';
              }}
            >
              <option value="">Choose numbering style…</option>
              {NUMBER_STYLE_OPTIONS.filter(Boolean).map((option) => (
                <option key={option} value={option}>{LIST_STYLE_LABELS[option]}</option>
              ))}
            </select>
          </div>
        </div>
        </>
      ) : null}
      <div ref={rootRef} />
    </div>
  );
});

export default RichTextEditor;
