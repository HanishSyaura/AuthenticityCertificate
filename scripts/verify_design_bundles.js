require('dotenv').config();
const prisma = require('../src/config/prisma');

async function run() {
  const org = await prisma.organization.findFirst({ orderBy: { id: 'asc' } });
  const orgId = org.id;

  // 1) Design bundles list
  const designs = await prisma.cmsDesign.findMany({
    where: { organizationId: orgId, kind: 'landing' },
    orderBy: { id: 'asc' },
    select: {
      id: true, slug: true, name: true, description: true
    }
  });
  console.log('\n1. Design Bundles found:', designs.length);
  designs.forEach((d) => console.log(`   #${d.id} [landing] ${d.name} (${d.slug})`));

  // 2) Pages per bundle
  for (const d of designs) {
    const pgs = await prisma.cmsPage.findMany({
      where: { organizationId: orgId, designId: d.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, slug: true, sortOrder: true, designId: true }
    });
    console.log(`\n2. Pages in Design #${d.id} ${d.slug}:`);
    pgs.forEach((p) => console.log(`   #${p.id} [order ${p.sortOrder}] ${p.name} (${p.slug})`));
  }

  // 3) Default (legacy) group
  const defaultPgs = await prisma.cmsPage.findMany({
    where: { organizationId: orgId, designId: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, slug: true, sortOrder: true }
  });
  console.log(`\n3. Default (designId=null) group has ${defaultPgs.length} pages`);
  defaultPgs.slice(0, 3).forEach((p) => console.log(`   #${p.id} [order ${p.sortOrder}] ${p.name} (${p.slug})`));
  if (defaultPgs.length > 3) console.log(`   ... and ${defaultPgs.length - 3} more`);

  // 4) Products with bundle links
  const products = await prisma.product.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { cmsDesignId: { not: null } },
        { cmsCertificateDesignId: { not: null } },
        { sku: { startsWith: 'TSM-' } },
        { sku: { startsWith: 'TMK-' } }
      ]
    },
    orderBy: { id: 'asc' },
    select: {
      id: true, sku: true, name: true,
      cmsDesignId: true, cmsCertificateDesignId: true,
      cmsPageId: true, cmsCertificatePageId: true,
      _count: { select: { batches: true } }
    }
  });
  console.log('\n4. Products linked to bundles:');
  products.forEach((p) => {
    console.log(`   #${p.id} ${p.sku} — ${p.name}`);
    console.log(`       Landing bundle: cmsDesignId=${p.cmsDesignId}   Cert-only bundle: cmsCertificateDesignId=${p.cmsCertificateDesignId}`);
    console.log(`       Legacy fallback: cmsPageId=${p.cmsPageId}  cmsCertificatePageId=${p.cmsCertificatePageId}`);
  });

  // 5) Certificates linked to those products - run fallback simulation
  const productIds = products.map((p) => p.id);
  if (productIds.length) {
    const certs = await prisma.certificate.findMany({
      where: {
        batch: { productId: { in: productIds } }
      },
      orderBy: { certificateId: 'desc' },
      take: 5,
      include: {
        batch: {
          select: {
            id: true,
            product: { select: { id: true, sku: true, name: true, cmsDesignId: true, cmsCertificateDesignId: true, cmsPageId: true, cmsCertificatePageId: true } }
          }
        }
      }
    });
    console.log(`\n5. Recent certificates (up to 5) + simulated 3-tier designId fallback:`);
    certs.forEach((c) => {
      const prod = c.batch?.product || null;
      // 3-tier fallback
      let eff = c.cmsDesignId;
      let src = 'cert.cmsDesignId';
      if (eff == null && prod?.cmsCertificateDesignId != null) {
        eff = prod.cmsCertificateDesignId;
        src = 'product.cmsCertificateDesignId';
      }
      if (eff == null && prod?.cmsDesignId != null) {
        eff = prod.cmsDesignId;
        src = 'product.cmsDesignId';
      }
      if (eff == null && c.cmsPageId != null) {
        eff = c.cmsPageId;
        src = 'legacy cert.cmsPageId (single page fallback, NOT a bundle designId)';
      }
      if (eff == null && prod?.cmsPageId != null) {
        eff = prod.cmsPageId;
        src = 'legacy product.cmsPageId (single page fallback, NOT a bundle designId)';
      }
      if (eff == null) {
        eff = null;
        src = 'default.designNull (ungrouped bundle)';
      }
      console.log(`   Cert #${c.id} (product: ${prod?.sku || 'null'}) → effectiveDesignId = ${eff}  (source: ${src})`);
    });
  } else {
    console.log('\n5. No products linked - skipping cert fallback');
  }

  console.log('\n=== SMOKE DB VERIFY DONE ===');

  await prisma.$disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
