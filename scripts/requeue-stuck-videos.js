require('dotenv').config();
const prisma = require('../src/config/prisma');
const jobQueue = require('../src/services/jobQueue.service');

function minutesAgo(min) {
  return new Date(Date.now() - min * 60_000);
}

async function main() {
  if (!jobQueue.hasRedis()) {
    console.error('REDIS_URL not configured; cannot requeue');
    process.exitCode = 2;
    return;
  }

  jobQueue.initQueue();

  const cutoffMins = Number(process.env.VIDEO_REQUEUE_STUCK_MINUTES || 20);
  const cutoff = minutesAgo(Number.isFinite(cutoffMins) && cutoffMins > 0 ? cutoffMins : 20);

  const rows = await prisma.mediaAsset.findMany({
    where: {
      processingStatus: 'processing',
      createdAt: { lt: cutoff },
      deletedAt: null
    },
    orderBy: { createdAt: 'asc' },
    take: 50
  });

  let count = 0;
  for (const r of rows) {
    if (!String(r.mimeType || '').toLowerCase().startsWith('video/')) continue;
    const job = await jobQueue.addJob(
      'transcode_video',
      { mediaAssetId: r.id },
      { jobId: `transcode_video__${r.id}`, attempts: 2, backoff: { type: 'exponential', delay: 5000 } }
    );
    await prisma.mediaAsset.update({
      where: { id: r.id },
      data: { processingJobId: String(job?.id || '') || null }
    });
    count += 1;
  }

  console.log(JSON.stringify({ ok: true, cutoff: cutoff.toISOString(), found: rows.length, requeued: count }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
  });
