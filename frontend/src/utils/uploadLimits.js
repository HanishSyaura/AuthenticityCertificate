const envMaxMb = Number.parseInt(import.meta.env.VITE_MAX_UPLOAD_MB, 10);
export const MAX_UPLOAD_MB = Number.isFinite(envMaxMb) && envMaxMb > 0 ? envMaxMb : 500;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function isFileTooLarge(file) {
  return Number(file?.size || 0) > MAX_UPLOAD_BYTES;
}
