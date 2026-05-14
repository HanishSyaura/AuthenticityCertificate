import { describe, expect, it } from 'vitest';
import { resolvePublicMediaUrl } from '../apiBase';

describe('resolvePublicMediaUrl', () => {
  it('maps /uploads/ to /public/uploads/', () => {
    const u = resolvePublicMediaUrl('/uploads/media/1/a.jpg');
    expect(u).toContain('/public/uploads/media/1/a.jpg');
  });

  it('maps /api/uploads/ to /public/uploads/', () => {
    const u = resolvePublicMediaUrl('/api/uploads/media/1/a.jpg');
    expect(u).toContain('/public/uploads/media/1/a.jpg');
  });

  it('keeps /public/uploads/ as-is', () => {
    const u = resolvePublicMediaUrl('/public/uploads/media/1/a.jpg');
    expect(u).toContain('/public/uploads/media/1/a.jpg');
  });
});

