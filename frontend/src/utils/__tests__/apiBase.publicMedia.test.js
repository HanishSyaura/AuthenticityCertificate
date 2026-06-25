import { describe, expect, it } from 'vitest';
import { resolvePublicMediaUrl } from '../apiBase';

describe('resolvePublicMediaUrl', () => {
  it('maps /uploads/ to /api/public/uploads/', () => {
    const u = resolvePublicMediaUrl('/uploads/media/1/a.jpg');
    expect(u).toContain('/api/public/uploads/media/1/a.jpg');
  });

  it('maps /api/uploads/ to /api/public/uploads/', () => {
    const u = resolvePublicMediaUrl('/api/uploads/media/1/a.jpg');
    expect(u).toContain('/api/public/uploads/media/1/a.jpg');
  });

  it('maps /public/uploads/ to /api/public/uploads/', () => {
    const u = resolvePublicMediaUrl('/public/uploads/media/1/a.jpg');
    expect(u).toContain('/api/public/uploads/media/1/a.jpg');
  });
});

