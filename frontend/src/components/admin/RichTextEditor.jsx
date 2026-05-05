import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill';

const RichTextEditor = forwardRef(function RichTextEditor({ value, onChange, placeholder, minHeight = '6rem', maxHeight = '14rem', readOnly = false }, ref) {
  const quillRef = useRef(null);

  const Quill = ReactQuill?.Quill;
  if (Quill && !Quill.__acConfigured) {
    const Font = Quill.import('formats/font');
    Font.whitelist = ['serif', 'monospace', 'arial', 'times-new-roman', 'georgia', 'courier-new'];
    Quill.register(Font, true);

    const SizeStyle = Quill.import('attributors/style/size');
    SizeStyle.whitelist = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt', '48pt'];
    Quill.register(SizeStyle, true);

    Quill.__acConfigured = true;
  }

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const editor = quillRef.current?.getEditor?.();
        editor?.focus?.();
      },
      insertText: (text) => {
        const editor = quillRef.current?.getEditor?.();
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

  const modules = useMemo(() => {
    if (readOnly) return { toolbar: false };
    return {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ script: 'super' }, { align: [] }],
        [
          { size: [false, '8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt', '48pt'] },
          { font: [false, 'serif', 'monospace', 'arial', 'times-new-roman', 'georgia', 'courier-new'] }
        ]
      ],
      keyboard: {
        bindings: {
          tab: {
            key: 9,
            handler: (range, context) => {
              const editor = quillRef.current?.getEditor?.();
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
              const editor = quillRef.current?.getEditor?.();
              if (!editor) return true;
              if (context?.format?.list) {
                editor.format('indent', '-1', 'user');
                return false;
              }
              return true;
            }
          }
        }
      }
    };
  }, [readOnly]);

  const formats = useMemo(
    () => [
      'bold',
      'italic',
      'underline',
      'strike',
      'list',
      'script',
      'indent',
      'size',
      'font',
      'align'
    ],
    []
  );

  return (
    <div className="ac-rt rounded-xl border border-zinc-200 bg-white" style={{ '--ac-rt-min-h': minHeight, '--ac-rt-max-h': maxHeight }}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={String(value || '')}
        onChange={(html) => onChange(html)}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        readOnly={readOnly}
      />
    </div>
  );
});

export default RichTextEditor;
