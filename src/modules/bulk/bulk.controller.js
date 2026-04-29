const { z } = require('zod');

const jobQueue = require('../../services/jobQueue.service');
const bulkService = require('./bulk.service');

const generateSchema = z.object({
  batchId: z.number().int(),
  type: z.enum(['batch', 'unit']),
  quantity: z.number().int().min(1).optional(),
  runSync: z.boolean().optional()
});

const revokeSchema = z.object({
  certificateIds: z.array(z.string().min(1)).min(1),
  runSync: z.boolean().optional()
});

const assignSchema = z.object({
  rows: z.array(z.any()).min(1),
  runSync: z.boolean().optional()
});

const assignXlsxSchema = z.object({
  base64: z.string().min(1),
  sheetName: z.string().optional(),
  runSync: z.boolean().optional()
});

const importXlsxSchema = z.object({
  base64: z.string().min(1),
  dryRun: z.boolean().optional(),
  runSync: z.boolean().optional()
});

async function generate(req, res) {
  try {
    const data = generateSchema.parse(req.body);
    const payload = {
      organizationId: req.organization.id,
      batchId: data.batchId,
      type: data.type,
      quantity: data.quantity
    };

    if (data.runSync || !jobQueue.hasRedis()) {
      const result = await jobQueue.runNow('bulk_generate', payload);
      return res.success({ mode: 'sync', result }, 'Bulk generate completed');
    }

    const job = await jobQueue.addJob('bulk_generate', payload);
    return res.success({ mode: job.mode, jobId: job.id }, 'Bulk generate queued');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function revoke(req, res) {
  try {
    const data = revokeSchema.parse(req.body);
    const payload = {
      organizationId: req.organization.id,
      certificateIds: data.certificateIds
    };

    if (data.runSync || !jobQueue.hasRedis()) {
      const result = await jobQueue.runNow('bulk_revoke', payload);
      return res.success({ mode: 'sync', result }, 'Bulk revoke completed');
    }

    const job = await jobQueue.addJob('bulk_revoke', payload);
    return res.success({ mode: job.mode, jobId: job.id }, 'Bulk revoke queued');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function assign(req, res) {
  try {
    const data = assignSchema.parse(req.body);
    const payload = {
      organizationId: req.organization.id,
      rows: data.rows
    };

    if (data.runSync || !jobQueue.hasRedis()) {
      const result = await jobQueue.runNow('bulk_assign', payload);
      return res.success({ mode: 'sync', result }, 'Bulk assign completed');
    }

    const job = await jobQueue.addJob('bulk_assign', payload);
    return res.success({ mode: job.mode, jobId: job.id }, 'Bulk assign queued');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function assignXlsx(req, res) {
  try {
    const data = assignXlsxSchema.parse(req.body);
    const parsed = bulkService.parseXlsxBase64(data.base64, { sheetName: data.sheetName });
    const payload = {
      organizationId: req.organization.id,
      rows: parsed.rows
    };

    if (data.runSync || !jobQueue.hasRedis()) {
      const result = await jobQueue.runNow('bulk_assign', payload);
      return res.success({ mode: 'sync', sheetName: parsed.sheetName, result }, 'Bulk assign completed');
    }

    const job = await jobQueue.addJob('bulk_assign', payload);
    return res.success({ mode: job.mode, sheetName: parsed.sheetName, jobId: job.id }, 'Bulk assign queued');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function jobStatus(req, res) {
  try {
    const id = String(req.params.id);
    const job = await jobQueue.getJob(id);
    if (!job) return res.error('Job not found', 404);
    res.success(job);
  } catch (e) {
    res.error(e.message);
  }
}

async function importXlsx(req, res) {
  try {
    const data = importXlsxSchema.parse(req.body);
    const sheets = bulkService.parseWorkbookBase64(data.base64);
    const payload = {
      organizationId: req.organization.id,
      sheets,
      dryRun: Boolean(data.dryRun)
    };

    if (data.runSync || !jobQueue.hasRedis()) {
      const result = await jobQueue.runNow('bulk_import_xlsx', payload);
      return res.success({ mode: 'sync', result }, 'Bulk import completed');
    }

    const job = await jobQueue.addJob('bulk_import_xlsx', payload);
    return res.success({ mode: job.mode, jobId: job.id }, 'Bulk import queued');
  } catch (e) {
    res.error(e.message, 400);
  }
}

module.exports = {
  generate,
  revoke,
  assign,
  assignXlsx,
  importXlsx,
  jobStatus
};
