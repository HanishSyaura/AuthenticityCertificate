import { describe, expect, it } from 'vitest';
import { resolveCmsVideoSource } from '../videoEmbed';

describe('resolveCmsVideoSource', () => {
  it('returns null for empty', () => {
    expect(resolveCmsVideoSource('')).toBeNull();
  });

  it('rejects javascript: URLs', () => {
    expect(resolveCmsVideoSource('javascript:alert(1)')).toBeNull();
  });

  it('keeps relative URLs as html5 video', () => {
    expect(resolveCmsVideoSource('/uploads/media/1/a.mp4')).toEqual({ kind: 'video', src: '/uploads/media/1/a.mp4' });
  });

  it('converts YouTube watch URL to embed', () => {
    expect(resolveCmsVideoSource('https://www.youtube.com/watch?v=AbC_123')).toEqual({ kind: 'iframe', src: 'https://www.youtube.com/embed/AbC_123' });
  });

  it('converts youtu.be URL to embed', () => {
    expect(resolveCmsVideoSource('https://youtu.be/AbC_123')).toEqual({ kind: 'iframe', src: 'https://www.youtube.com/embed/AbC_123' });
  });

  it('converts Vimeo URL to embed', () => {
    expect(resolveCmsVideoSource('https://vimeo.com/123456')).toEqual({ kind: 'iframe', src: 'https://player.vimeo.com/video/123456' });
  });
});

