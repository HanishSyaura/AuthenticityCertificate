let Queue;
let Worker;
let IORedis;

try {
  ({ Queue, Worker } = require('bullmq'));
  IORedis = require('ioredis');
} catch {
}

const memJobs = new Map();
const memQueue = [];
let memActive = 0;
let memPumpScheduled = false;

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.min(max, Math.max(min, i));
}

function memConfig() {
  const concurrency = clampInt(process.env.MEM_QUEUE_CONCURRENCY, 1, 8, 1);
  const retainMs = clampInt(process.env.MEM_QUEUE_RETAIN_MS, 10_000, 24 * 60 * 60_000, 30 * 60_000);
  const maxJobs = clampInt(process.env.MEM_QUEUE_MAX_JOBS, 100, 100_000, 10_000);
  return { concurrency, retainMs, maxJobs };
}

function memPrune(now = Date.now()) {
  const { retainMs, maxJobs } = memConfig();
  for (const [id, j] of memJobs.entries()) {
    const doneAt = j.completedAt || j.failedAt || j.updatedAt || j.createdAt || 0;
    if ((j.status === 'completed' || j.status === 'failed') && doneAt && now - doneAt > retainMs) {
      memJobs.delete(id);
    }
  }
  if (memJobs.size <= maxJobs) return;
  const keep = new Set(memQueue);
  const candidates = [];
  for (const [id, j] of memJobs.entries()) {
    if (keep.has(id)) continue;
    if (j.status === 'running') continue;
    candidates.push({ id, t: j.createdAt || 0 });
  }
  candidates.sort((a, b) => a.t - b.t);
  const toDrop = Math.max(0, memJobs.size - maxJobs);
  for (let i = 0; i < toDrop && i < candidates.length; i += 1) {
    memJobs.delete(candidates[i].id);
  }
}

async function runMemJob(id) {
  const entry = memJobs.get(id);
  if (!entry) return;
  if (entry.status !== 'queued') return;

  entry.status = 'running';
  entry.startedAt = Date.now();
  entry.updatedAt = entry.startedAt;
  memActive += 1;
  try {
    const fn = handlers.get(entry.name);
    if (!fn) throw new Error(`No handler for job ${entry.name}`);
    const payload = entry.data;
    entry.data = null;
    const result = await fn(payload);
    entry.status = 'completed';
    entry.result = result;
    entry.completedAt = Date.now();
    entry.updatedAt = entry.completedAt;
  } catch (e) {
    entry.status = 'failed';
    entry.error = e?.message || String(e);
    entry.failedAt = Date.now();
    entry.updatedAt = entry.failedAt;
  } finally {
    memActive -= 1;
    memPrune();
    scheduleMemPump();
  }
}

function pumpMemQueue() {
  memPumpScheduled = false;
  const { concurrency } = memConfig();
  while (memActive < concurrency && memQueue.length > 0) {
    const id = memQueue.shift();
    void runMemJob(id);
  }
  memPrune();
}

function scheduleMemPump() {
  if (memPumpScheduled) return;
  memPumpScheduled = true;
  setTimeout(pumpMemQueue, 0);
}

function hasRedis() {
  return !!process.env.REDIS_URL && Queue && Worker && IORedis;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let redisConnection = null;
let queue = null;
let worker = null;
let handlers = new Map();

function queueConfig() {
  const name = String(process.env.BULLMQ_QUEUE_NAME || process.env.QUEUE_NAME || 'bulk').trim() || 'bulk';
  const prefixRaw = String(process.env.BULLMQ_PREFIX || process.env.QUEUE_PREFIX || '').trim();
  const prefix = prefixRaw ? prefixRaw : undefined;
  return { name, prefix };
}

function ensureQueue() {
  if (!hasRedis()) return null;
  if (queue && worker) return queue;

  const cfg = queueConfig();
  redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  queue = new Queue(cfg.name, { connection: redisConnection, prefix: cfg.prefix });
  worker = new Worker(
    cfg.name,
    async (job) => {
      const fn = handlers.get(job.name);
      if (!fn) throw new Error(`No handler for job ${job.name}`);
      return await fn(job.data);
    },
    { connection: redisConnection, prefix: cfg.prefix }
  );

  return queue;
}

function registerHandler(name, fn) {
  handlers.set(name, fn);
}

async function addJob(name, data, options = null) {
  if (hasRedis()) {
    const q = ensureQueue();
    const opts = {
      removeOnComplete: true,
      removeOnFail: false,
      ...(options && typeof options === 'object' ? options : {})
    };
    const job = await q.add(name, data, opts);
    return { id: String(job.id), mode: 'redis' };
  }

  const id = makeId(name);
  const now = Date.now();
  memJobs.set(id, {
    id,
    name,
    data,
    status: 'queued',
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now
  });
  memQueue.push(id);
  scheduleMemPump();
  return { id, mode: 'memory' };
}

async function runNow(name, data) {
  const fn = handlers.get(name);
  if (!fn) throw new Error(`No handler for job ${name}`);
  return await fn(data);
}

async function getJob(id) {
  if (hasRedis()) {
    const q = ensureQueue();
    const job = await q.getJob(id);
    if (!job) return null;
    const state = await job.getState();
    return {
      id: String(job.id),
      name: job.name,
      status: state,
      result: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null
    };
  }

  return memJobs.get(String(id)) || null;
}

module.exports = {
  hasRedis,
  initQueue: ensureQueue,
  registerHandler,
  addJob,
  runNow,
  getJob
};

