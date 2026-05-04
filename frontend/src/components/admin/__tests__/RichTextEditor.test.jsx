import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const editor = {
  focus: vi.fn(),
  getSelection: vi.fn(),
  getLength: vi.fn(),
  insertText: vi.fn(),
  setSelection: vi.fn()
};

let RichTextEditor;

vi.mock('react-quill', () => {
  const MockQuill = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ getEditor: () => editor }));
    return (
      <button type="button" data-testid="mock-quill" onClick={() => props.onChange('<p>changed</p>')}>
        MockQuill
      </button>
    );
  });
  MockQuill.displayName = 'MockQuill';
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onChange with HTML', async () => {
    if (!RichTextEditor) RichTextEditor = (await import('../RichTextEditor')).default;
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>Hello</p>" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('mock-quill'));
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
