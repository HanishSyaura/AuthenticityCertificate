import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill';

const RichTextEditor = forwardRef(function RichTextEditor({ value, onChange, placeholder, minHeight = '6rem', maxHeight = '14rem' }, ref) {
  const quillRef = useRef(null);

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

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link'],
        ['clean']
      ]
    }),
    []
  );

  const formats = useMemo(
    () => ['header', 'bold', 'italic', 'underline', 'strike', 'align', 'list', 'bullet', 'blockquote', 'code-block', 'link'],
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
      />
    </div>
  );
});

export default RichTextEditor;
