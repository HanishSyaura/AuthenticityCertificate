const path = require('path');
const fs = require('fs/promises');
const { processUploadedVideo } = require('../src/services/videoTranscode.service');

async function main() {
  const inAbs = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (!inAbs) {
    process.stderr.write('Usage: node scripts/transcode-one-video.js <absolute-or-relative-path-to-video>\n');
    process.exit(2);
  }

  const st = await fs.stat(inAbs).catch(() => null);
  if (!st) {
    process.stderr.write(`File not found: ${inAbs}\n`);
    process.exit(2);
  }

  const destDir = path.dirname(inAbs);
  const fileName = path.basename(inAbs);
  const out = await processUploadedVideo({ fileAbs: inAbs, fileName, mimeType: 'video/mp4', destDir });
  process.stdout.write(`${JSON.stringify(out)}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e?.message || String(e)}\n`);
  process.exit(1);
});

