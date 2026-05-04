import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill';
import katex from 'katex';

const RichTextEditor = forwardRef(function RichTextEditor({ value, onChange, placeholder, minHeight = '6rem', maxHeight = '14rem', readOnly = false }, ref) {
  const quillRef = useRef(null);

  if (typeof window !== 'undefined' && !window.katex) {
    window.katex = katex;
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
        ['blockquote', 'code-block'],
        ['link', 'image', 'video', 'formula'],
        [{ header: 1 }, { header: 2 }],
        [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
        [{ script: 'sub' }, { script: 'super' }],
        [{ indent: '-1' }, { indent: '+1' }],
        [{ direction: 'rtl' }],
        [{ size: ['small', false, 'large', 'huge'] }],
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ color: [] }, { background: [] }],
        [{ font: [] }],
        [{ align: [] }],
        ['clean']
      ]
    };
  }, [readOnly]);

  const formats = useMemo(
    () => [
      'bold',
      'italic',
      'underline',
      'strike',
      'blockquote',
      'code-block',
      'link',
      'image',
      'video',
      'formula',
      'header',
      'list',
      'script',
      'indent',
      'direction',
      'size',
      'color',
      'background',
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
