import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import CmsInspectorPanel from '../CmsInspectorPanel';

const mockUploadMedia = vi.fn();

vi.mock('../../../../store/useUploadsStore', () => ({
  default: (selector) => selector({ uploadMedia: mockUploadMedia })
}));

vi.mock('../../RichTextEditor', () => ({
  default: React.forwardRef(function MockRichTextEditor(_props, _ref) {
    return <div data-testid="rich-text-editor" />;
  })
}));

vi.mock('../ImageCropModal', () => ({
  default: function MockImageCropModal() {
    return null;
  }
}));

describe('CmsInspectorPanel', () => {
  beforeEach(() => {
    mockUploadMedia.mockReset();
  });

  it('reenables the file input after a successful video upload', async () => {
    mockUploadMedia
      .mockResolvedValueOnce({ url: '/uploads/media/1/first.mp4', posterUrl: '/uploads/media/1/first.jpg' })
      .mockResolvedValueOnce({ url: '/uploads/media/1/second.mp4', posterUrl: '/uploads/media/1/second.jpg' });

    const layout = [
      {
        id: 'video-1',
        type: 'video',
        x: 20,
        y: 20,
        w: 200,
        h: 120,
        content: { url: '' }
      }
    ];

    const setLayout = vi.fn();
    const { container } = render(
      <CmsInspectorPanel
        selectedBlock={layout[0]}
        layout={layout}
        setLayout={setLayout}
        clearSelection={() => {}}
        templates={[]}
      />
    );

    const firstFile = new File(['first'], 'first.mp4', { type: 'video/mp4' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [firstFile] } });

    await waitFor(() => expect(mockUploadMedia).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeDisabled());

    const secondFile = new File(['second'], 'second.mp4', { type: 'video/mp4' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [secondFile] } });

    await waitFor(() => expect(mockUploadMedia).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeDisabled());
    expect(setLayout).toHaveBeenCalledTimes(2);
    expect(setLayout).toHaveBeenNthCalledWith(1, [
      {
        ...layout[0],
        content: { url: '/uploads/media/1/first.mp4', posterUrl: '/uploads/media/1/first.jpg' }
      }
    ]);
    expect(setLayout).toHaveBeenNthCalledWith(2, [
      {
        ...layout[0],
        content: { url: '/uploads/media/1/second.mp4', posterUrl: '/uploads/media/1/second.jpg' }
      }
    ]);
  });
});
