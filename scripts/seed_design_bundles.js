require('dotenv').config();
const prisma = require('../src/config/prisma');

function slug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function run() {
  const org = await prisma.organization.findFirst({ orderBy: { id: 'asc' } });
  if (!org) {
    console.log('No organization found, bootstrap first.');
    process.exit(0);
  }
  const orgId = org.id;
  console.log(`Using org #${orgId} (${org.name})`);

  // Cleanup product FKs previous test rows so script is idempotent (don't delete pages, break other FKs)
  await prisma.product.updateMany({
    where: { organizationId: orgId, OR: [{ sku: { startsWith: 'TSM-' } }, { sku: { startsWith: 'TMK-' } }] },
    data: { cmsDesignId: null, cmsCertificateDesignId: null, cmsPageId: null, cmsCertificatePageId: null }
  });
  // Cleanup previous designs if any (their child pages get designId nulled by soft logic anyway)
  try {
    await prisma.cmsDesign.deleteMany({
      where: { organizationId: orgId, OR: [{ slug: 'sarang-madu' }, { slug: 'minyak-kelapa' }] }
    });
  } catch {
    // ignore FK or any errors, just try to proceed without cleanup
  }

  // Create 2 Design Bundles (top-level = 1 Landing Page Design each)
  const desA = await prisma.cmsDesign.create({
    data: {
      organizationId: orgId,
      name: 'Sarang Madu Premium Landing',
      slug: 'sarang-madu',
      kind: 'landing',
      description: 'Bundle untuk produk sarang madu: Overview, Khasiat, Testimoni, Cara Guna, Sijil',
      versionNo: 1
    }
  });
  const desB = await prisma.cmsDesign.create({
    data: {
      organizationId: orgId,
      name: 'Minyak Kelapa Dara Landing',
      slug: 'minyak-kelapa',
      kind: 'landing',
      description: 'Bundle untuk minyak kelapa: Hero, Ingredients, Benefits, How To Use, FAQ',
      versionNo: 1
    }
  });
  console.log(`Created designs: #${desA.id} sarang-madu, #${desB.id} minyak-kelapa`);

  // Create 3 inner pages per bundle (CmsPage)
  const pagesDesA = ['Landing Utama Sarang Madu', 'Khasiat & Vitamin', 'Testimoni Pelanggan'];
  for (let i = 0; i < pagesDesA.length; i += 1) {
    const title = pagesDesA[i];
    const s = slug(`sarang-${title}`);
    await prisma.cmsPage.create({
      data: {
        organizationId: orgId,
        designId: desA.id,
        name: title,
        slug: s,
        kind: 'landing',
        sortOrder: i + 1,
        metaTitle: title,
        metaDescription: `Inner page #${i + 1} dalam bundle Sarang Madu`
      }
    });
  }

  const pagesDesB = ['Landing Utama Minyak Kelapa', 'Komposisi & Bahan', 'Cara Pakai & Penjagaan'];
  for (let i = 0; i < pagesDesB.length; i += 1) {
    const title = pagesDesB[i];
    const s = slug(`minyak-${title}`);
    await prisma.cmsPage.create({
      data: {
        organizationId: orgId,
        designId: desB.id,
        name: title,
        slug: s,
        kind: 'landing',
        sortOrder: i + 1,
        metaTitle: title,
        metaDescription: `Inner page #${i + 1} dalam bundle Minyak Kelapa`
      }
    });
  }
  console.log('Created 3 inner pages for each design');

  // Link/update 2 products to each design
  let prodA = await prisma.product.findFirst({
    where: { organizationId: orgId, sku: { startsWith: 'TSM-' } },
    orderBy: { id: 'asc' }
  });
  if (!prodA) {
    const cats = await prisma.category.findMany({ where: { organizationId: orgId }, take: 1 });
    const catCode = cats[0]?.code || 'DEFAULT';
    prodA = await prisma.product.create({
      data: {
        organizationId: orgId,
        sku: 'TSM-001',
        code: 'TSARANG-01',
        name: 'Tualang Sarang Madu Premium 500g',
        category: catCode,
        status: 'active',
        remark: 'Sample linked to sarang-madu design bundle'
      }
    });
  }
  prodA = await prisma.product.update({
    where: { id: prodA.id },
    data: { cmsDesignId: desA.id, cmsCertificateDesignId: desA.id }
  });

  let prodB = await prisma.product.findFirst({
    where: { organizationId: orgId, sku: { startsWith: 'TMK-' } },
    orderBy: { id: 'asc' }
  });
  if (!prodB) {
    const cats = await prisma.category.findMany({ where: { organizationId: orgId }, take: 1 });
    const catCode = cats[0]?.code || 'DEFAULT';
    prodB = await prisma.product.create({
      data: {
        organizationId: orgId,
        sku: 'TMK-001',
        code: 'TVCO-01',
        name: 'Tropika Minyak Kelapa Dara 250ml',
        category: catCode,
        status: 'active',
        remark: 'Sample linked to minyak-kelapa design bundle'
      }
    });
  }
  prodB = await prisma.product.update({
    where: { id: prodB.id },
    data: { cmsDesignId: desB.id, cmsCertificateDesignId: desB.id }
  });

  console.log(`Linked products: #${prodA.id} ${prodA.sku} → design #${desA.id}; #${prodB.id} ${prodB.sku} → design #${desB.id}`);
  console.log('\nSEED DONE. Buka Admin Records, Admin CMS Builder untuk verify.');

  await prisma.$disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
