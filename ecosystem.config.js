module.exports = {
  apps: [
    {
      name: 'birdnestauth-api',
      script: 'src/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '450M',
      env: {
        APP_MODE: 'web',
        BULLMQ_RUN_WORKER: '0',
        NODE_OPTIONS: '--max-old-space-size=384',
        SHARP_CONCURRENCY: '1',
        SHARP_CACHE_MB: '64',
        MAX_UPLOAD_MB: '50',
        EPC_XLSX_MAX_MB: '10',
        EPC_XLSX_MAX_ROWS: '10000',
        EPC_EXPORT_MAX_ROWS: '3000'
      }
    },
    {
      name: 'birdnestauth-worker',
      script: 'src/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '700M',
      env: {
        APP_MODE: 'worker',
        BULLMQ_RUN_WORKER: '1',
        BULLMQ_CONCURRENCY: '1',
        NODE_OPTIONS: '--max-old-space-size=512',
        SHARP_CONCURRENCY: '1',
        SHARP_CACHE_MB: '128',
        BULLMQ_KEEP_COMPLETED: '500',
        BULLMQ_KEEP_FAILED: '500'
      }
    }
  ]
};
