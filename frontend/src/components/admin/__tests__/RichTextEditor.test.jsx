import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RichTextEditor from '../RichTextEditor';

describe('RichTextEditor', () => {
  beforeEach(() => {
    document.execCommand = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs basic formatting commands', () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>Hello</p>" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(document.execCommand).toHaveBeenCalledWith('styleWithCSS', false, true);
    expect(document.execCommand).toHaveBeenCalledWith('bold', false, null);
    expect(onChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'H1' }));
    expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, '<h1>');
  });

  it('runs list and font size commands', () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>Hello</p>" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /• List/i }));
    expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, null);

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '5' } });
    expect(document.execCommand).toHaveBeenCalledWith('fontSize', false, '5');

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Georgia' } });
    expect(document.execCommand).toHaveBeenCalledWith('fontName', false, 'Georgia');
  });

  it('runs clear formatting (removeFormat + unlink)', () => {
    const onChange = vi.fn();
    render(<RichTextEditor value='<a href="https://example.com">Link</a>' onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(document.execCommand).toHaveBeenCalledWith('removeFormat', false, null);
    expect(document.execCommand).toHaveBeenCalledWith('unlink', false, null);
    expect(onChange).toHaveBeenCalled();
  });
});
