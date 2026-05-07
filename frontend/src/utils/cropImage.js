import { tRaw } from '../i18n/tRaw';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(tRaw('failedToLoadImage')));
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function cropImageToBlob(input, crop, opts) {
  const mimeType = opts?.mimeType || input?.type || 'image/jpeg';
  const quality = typeof opts?.quality === 'number' ? opts.quality : 0.92;
  const maxSize = typeof opts?.maxSize === 'number' ? opts.maxSize : null;

  const useBitmap = typeof createImageBitmap === 'function';
  const source = useBitmap ? await createImageBitmap(input) : await blobToImage(input);

  const srcW = useBitmap ? source.width : source.naturalWidth;
  const srcH = useBitmap ? source.height : source.naturalHeight;

  const x = clamp(Number(crop?.x) || 0, 0, srcW);
  const y = clamp(Number(crop?.y) || 0, 0, srcH);
  const w = clamp(Number(crop?.width) || srcW, 1, srcW - x);
  const h = clamp(Number(crop?.height) || srcH, 1, srcH - y);

  const scale = maxSize != null ? Math.min(1, maxSize / Math.max(w, h)) : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(tRaw('canvas2dContextUnavailable'));

  ctx.drawImage(source, x, y, w, h, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(tRaw('toBlobFailed')))),
      mimeType,
      mimeType === 'image/png' ? undefined : quality
    );
  });

  if (useBitmap) source.close();
  return blob;
}
