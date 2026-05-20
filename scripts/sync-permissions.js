const prisma = require('../src/config/prisma');

const PERMISSIONS = [
  { key: '*', description: 'Full access' },
  { key: 'users.manage', description: 'Manage users' },
  { key: 'access.manage', description: 'Manage roles & permissions' },
  { key: 'products.read', description: 'Read products & batches' },
  { key: 'products.write', description: 'Write products & batches' },
  { key: 'categories.read', description: 'Read categories' },
  { key: 'categories.write', description: 'Write categories' },
  { key: 'certificates.read', description: 'Read certificates' },
  { key: 'certificates.write', description: 'Write certificates' },
  { key: 'templates.read', description: 'Read certificate templates' },
  { key: 'templates.write', description: 'Write certificate templates' },
  { key: 'uploads.write', description: 'Upload media' },
  { key: 'epc.read', description: 'Read EPC' },
  { key: 'epc.write', description: 'Write EPC' },
  { key: 'epc.batch.create', description: 'Create EPC batches' },
  { key: 'epc.batch.view', description: 'View EPC batches' },
  { key: 'epc.scan.access', description: 'Access EPC scan input' },
  { key: 'epc.certificate.view', description: 'View EPC certificates' },
  { key: 'epc.export.xlsx', description: 'Export EPC to XLSX' },
  { key: 'epc.encoding', description: 'Access EPC encoding' },
  { key: 'epc.sequence.reset', description: 'Reset EPC sequence' },
  { key: 'epc.delete', description: 'Delete EPC items' },
  { key: 'epc.cleanup.delete', description: 'Delete EPC and cleanup related data' },
  { key: 'epc.cleanup.delete_all_generated', description: 'Delete all generated EPC batches' },
  { key: 'epc.batch_import.access', description: 'Access EPC batch import' },
  { key: 'epc.production.access', description: 'Access production orders' },
  { key: 'epc.override', description: 'Override EPC data' },
  { key: 'cms.read', description: 'Read CMS pages' },
  { key: 'cms.write', description: 'Write CMS pages' },
  { key: 'cms.publish', description: 'Publish CMS pages' },
  { key: 'cms.meta.write', description: 'Write CMS metadata' },
  { key: 'settings.read', description: 'Read settings' },
  { key: 'settings.write', description: 'Write settings' }
];

async function main() {
  process.stdout.write('Syncing permissions...\n');
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description }
    });
    process.stdout.write(`- ${p.key}\n`);
  }
  process.stdout.write('Done.\n');
}

main()
  .catch((e) => {
    process.stderr.write(`${e?.message || e}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
