module.exports = {
  apps: [
    {
      name: 'certauth-api',
      script: 'src/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '450M',
      env: {
        APP_MODE: 'web',
        BULLMQ_RUN_WORKER: '0',
        NODE_OPTIONS: '--max-old-space-size=384'
      }
    },
    {
      name: 'certauth-worker',
      script: 'src/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '700M',
      env: {
        APP_MODE: 'worker',
        BULLMQ_RUN_WORKER: '1',
        BULLMQ_CONCURRENCY: '1',
        NODE_OPTIONS: '--max-old-space-size=512'
      }
    }
  ]
};
