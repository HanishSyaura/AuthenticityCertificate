let Queue;
let Worker;
let IORedis;

try {
  ({ Queue, Worker } = require('bullmq'));
  IORedis = require('ioredis');
} catch {
}

const memJobs = new Map();

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

function ensureQueue() {
  if (!hasRedis()) return null;
  if (queue && worker) return queue;

  redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  queue = new Queue('bulk', { connection: redisConnection });
  worker = new Worker(
    'bulk',
    async (job) => {
      const fn = handlers.get(job.name);
      if (!fn) throw new Error(`No handler for job ${job.name}`);
      return await fn(job.data);
    },
    { connection: redisConnection }
  );

  return queue;
}

function registerHandler(name, fn) {
  handlers.set(name, fn);
}

async function addJob(name, data) {
  if (hasRedis()) {
    const q = ensureQueue();
    const job = await q.add(name, data, { removeOnComplete: true, removeOnFail: false });
    return { id: String(job.id), mode: 'redis' };
  }

  const id = makeId(name);
  memJobs.set(id, { id, name, status: 'queued', result: null, error: null, createdAt: Date.now() });
  setTimeout(async () => {
    const entry = memJobs.get(id);
    if (!entry) return;
    entry.status = 'running';
    try {
      const fn = handlers.get(name);
      if (!fn) throw new Error(`No handler for job ${name}`);
      const result = await fn(data);
      entry.status = 'completed';
      entry.result = result;
    } catch (e) {
      entry.status = 'failed';
      entry.error = e?.message || String(e);
    }
  }, 0);
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
  registerHandler,
  addJob,
  runNow,
  getJob
};

