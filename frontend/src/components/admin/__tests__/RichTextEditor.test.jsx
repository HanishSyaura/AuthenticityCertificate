import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

const editor = {
  focus: vi.fn(),
  getSelection: vi.fn(),
  getLength: vi.fn(),
  insertText: vi.fn(),
  setSelection: vi.fn(),
  setContents: vi.fn(),
  enable: vi.fn(),
  format: vi.fn(),
  root: { innerHTML: '<p>Hello</p>' },
  clipboard: {
    dangerouslyPasteHTML: vi.fn((html) => {
      editor.root.innerHTML = html;
    })
  },
  _handlers: {}
};

let RichTextEditor;

vi.mock('quill', () => {
  class MockQuill {
    static import = vi.fn((key) => {
      if (key === 'formats/font' || key === 'attributors/style/size') return { whitelist: [] };
      return {};
    });

    static register = vi.fn();

    constructor(_el, options) {
      this.options = options;
      this.root = editor.root;
      this.clipboard = editor.clipboard;
    }

    focus = editor.focus;
    getSelection = editor.getSelection;
    getLength = editor.getLength;
    insertText = editor.insertText;
    setSelection = editor.setSelection;
    setContents = editor.setContents;
    enable = editor.enable;
    format = editor.format;
    getModule = vi.fn(() => ({ container: { classList: { add: vi.fn() } } }));
    on = vi.fn((event, handler) => {
      editor._handlers[event] = handler;
    });
    off = vi.fn((event) => {
      delete editor._handlers[event];
    });
  }

  return {
    default: MockQuill
  };
});

describe('RichTextEditor', () => {
  beforeEach(() => {
    editor.focus.mockReset();
    editor.getSelection.mockReset();
    editor.getLength.mockReset();
    editor.insertText.mockReset();
    editor.setSelection.mockReset();
    editor.setContents.mockReset();
    editor.enable.mockReset();
    editor.format.mockReset();
    editor.clipboard.dangerouslyPasteHTML.mockClear();
    editor.root.innerHTML = '<p>Hello</p>';
    editor._handlers = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onChange with HTML', async () => {
    if (!RichTextEditor) RichTextEditor = (await import('../RichTextEditor')).default;
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>Hello</p>" onChange={onChange} />);
    editor.root.innerHTML = '<p>changed</p>';
    editor._handlers['text-change']?.({}, {}, 'user');
    expect(onChange).toHaveBeenCalledWith('<p>changed</p>');
  });

  it('supports insertText via ref', async () => {
    if (!RichTextEditor) RichTextEditor = (await import('../RichTextEditor')).default;
    const onChange = vi.fn();
    const ref = React.createRef();
    editor.getSelection.mockReturnValue({ index: 2 });
    editor.getLength.mockReturnValue(10);
    render(<RichTextEditor ref={ref} value="<p>Hello</p>" onChange={onChange} />);
    ref.current.insertText('ABC');
    expect(editor.insertText).toHaveBeenCalledWith(2, 'ABC', 'user');
    expect(editor.setSelection).toHaveBeenCalledWith(5, 0, 'user');
  });
});
