const prisma = require('../../config/prisma');

const memPages = [];
const memLayouts = new Map();
const memVersions = new Map();
const memTranslations = new Map();

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function normalizeLang(lang) {
  const l = String(lang || 'en').toLowerCase();
  if (l === 'ms' || l === 'bm') return 'ms';
  if (l === 'zh' || l === 'zh-cn' || l === 'cn') return 'zh';
  return 'en';
}

async function createPage(data) {
  try {
    const orgId = Number(data.organizationId);
    const kind = data.kind || 'landing';
    const latest = await withTimeout(
      prisma.cmsPage.findFirst({
        where: { organizationId: orgId, kind },
        select: { sortOrder: true, id: true },
        orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }]
      }),
      300
    );
    const nextSortOrder = (Number(latest?.sortOrder) || 0) + 1;
    return await withTimeout(
      prisma.cmsPage.create({
        data: {
          organizationId: orgId,
          name: data.name,
          slug: data.slug,
          kind,
          sortOrder: nextSortOrder,
          metaTitle: data.metaTitle || null,
          metaDescription: data.metaDescription || null,
          ogImage: data.ogImage || null
        }
      }),
      300
    );
  } catch {
    const orgId = Number(data.organizationId);
    const kind = data.kind || 'landing';
    const nextSortOrder =
      memPages
        .filter((p) => p.organizationId === orgId && p.kind === kind)
        .reduce((max, p) => Math.max(max, Number(p?.sortOrder) || 0), 0) + 1;
    const next = {
      id: Date.now(),
      organizationId: orgId,
      name: data.name,
      slug: data.slug,
      kind,
      sortOrder: nextSortOrder,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      ogImage: data.ogImage || null,
      draftVersionId: null,
      publishedVersionId: null,
      versionNo: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      layout: null
    };
    memPages.unshift(next);
    return next;
  }
}

async function getPageBySlug({ organizationId, slug, language }) {
  const lang = normalizeLang(language);
  try {
    return await withTimeout(
      (async () => {
        const page = await prisma.cmsPage.findFirst({
          where: { organizationId: Number(organizationId), slug },
          include: { layout: true, publishedVersion: true, draftVersion: true }
        });
        if (!page) return null;
        const translation = await prisma.cmsTranslation.findFirst({
          where: { organizationId: Number(organizationId), pageId: page.id, language: lang }
        });
        const effectiveLayout =
          (translation && translation.contentJson) ||
          page?.publishedVersion?.layoutJson ||
          page?.draftVersion?.layoutJson ||
          page?.layout?.layoutJson ||
          null;
        return { ...page, effectiveLayout, language: lang };
      })(),
      300
    );
  } catch {
    const page = memPages.find((p) => p.organizationId === Number(organizationId) && p.slug === slug) || null;
    if (!page) return null;
    const translation = memTranslations.get(`${page.id}:${lang}`) || null;
    const publishedVersion = page.publishedVersionId ? memVersions.get(String(page.publishedVersionId)) : null;
    const draftVersion = page.draftVersionId ? memVersions.get(String(page.draftVersionId)) : null;
    const layout = memLayouts.get(String(page.id)) || null;
    const effectiveLayout = translation || publishedVersion?.layoutJson || draftVersion?.layoutJson || layout?.layoutJson || null;
    return { ...page, layout, publishedVersion, draftVersion, effectiveLayout, language: lang };
  }
}

async function saveLayout({ organizationId, pageId, layoutJson, language }) {
  const lang = normalizeLang(language);
  try {
    const pid = parseInt(pageId);
    await withTimeout(
      prisma.cmsTranslation.upsert({
        where: { pageId_language: { pageId: pid, language: lang } },
        update: { organizationId: Number(organizationId), contentJson: layoutJson },
        create: { organizationId: Number(organizationId), pageId: pid, language: lang, contentJson: layoutJson }
      }),
      300
    );

    const page = await withTimeout(prisma.cmsPage.findUnique({ where: { id: pid } }), 300);

    if (lang === 'en') {
      if (page?.draftVersionId) {
        await withTimeout(prisma.cmsVersion.update({ where: { id: page.draftVersionId }, data: { layoutJson } }), 300);
      } else {
        const latest = await withTimeout(
          prisma.cmsVersion.findFirst({ where: { pageId: pid }, orderBy: { versionNo: 'desc' } }),
          300
        );
        const nextNo = (latest?.versionNo || 0) + 1;
        const created = await withTimeout(
          prisma.cmsVersion.create({
            data: { organizationId: Number(organizationId), pageId: pid, versionNo: nextNo, status: 'draft', layoutJson }
          }),
          300
        );
        await withTimeout(prisma.cmsPage.update({ where: { id: pid }, data: { draftVersionId: created.id } }), 300);
      }
    }

    return { pageId: pid, language: lang, saved: true };
  } catch {
    const next = {
      id: Date.now(),
      organizationId: Number(organizationId),
      pageId: parseInt(pageId),
      layoutJson,
      updatedAt: new Date()
    };
    memLayouts.set(String(pageId), next);

    memTranslations.set(`${pageId}:${lang}`, layoutJson);

    if (lang === 'en') {
      const pIdx = memPages.findIndex((p) => p.id === parseInt(pageId) && p.organizationId === Number(organizationId));
      if (pIdx !== -1) {
        const page = memPages[pIdx];
        if (page.draftVersionId) {
          const v = memVersions.get(String(page.draftVersionId));
          if (v) memVersions.set(String(page.draftVersionId), { ...v, layoutJson });
        } else {
          const id = Date.now();
          const v = {
            id,
            organizationId: Number(organizationId),
            pageId: parseInt(pageId),
            versionNo: 1,
            status: 'draft',
            layoutJson,
            createdAt: new Date()
          };
          memVersions.set(String(id), v);
          memPages[pIdx] = { ...page, draftVersionId: id };
        }
      }
    }

    return { pageId: parseInt(pageId), language: lang, saved: true };
  }
}

async function publishPage({ organizationId, pageId }) {
  const pid = parseInt(pageId);
  try {
    const page = await withTimeout(prisma.cmsPage.findUnique({ where: { id: pid } }), 300);
    const draft = page?.draftVersionId ? await withTimeout(prisma.cmsVersion.findUnique({ where: { id: page.draftVersionId } }), 300) : null;
    const baseLayout = draft?.layoutJson;
    if (!baseLayout) throw new Error('No draft layout to publish');

    const latest = await withTimeout(prisma.cmsVersion.findFirst({ where: { pageId: pid }, orderBy: { versionNo: 'desc' } }), 300);
    const nextNo = (latest?.versionNo || 0) + 1;
    const published = await withTimeout(
      prisma.cmsVersion.create({
        data: { organizationId: Number(organizationId), pageId: pid, versionNo: nextNo, status: 'published', layoutJson: baseLayout }
      }),
      300
    );
    await withTimeout(prisma.cmsPage.update({ where: { id: pid }, data: { publishedVersionId: published.id } }), 300);
    return { pageId: pid, publishedVersionId: published.id, versionNo: nextNo };
  } catch {
    const idx = memPages.findIndex((p) => p.id === pid && p.organizationId === Number(organizationId));
    if (idx === -1) throw new Error('Page not found');
    const page = memPages[idx];
    const draft = page.draftVersionId ? memVersions.get(String(page.draftVersionId)) : null;
    if (!draft?.layoutJson) throw new Error('No draft layout to publish');
    const id = Date.now();
    const v = { id, organizationId: Number(organizationId), pageId: pid, versionNo: 1, status: 'published', layoutJson: draft.layoutJson, createdAt: new Date() };
    memVersions.set(String(id), v);
    memPages[idx] = { ...page, publishedVersionId: id };
    return { pageId: pid, publishedVersionId: id, versionNo: v.versionNo };
  }
}

async function updateMeta({ organizationId, pageId, metaTitle, metaDescription, ogImage }) {
  const pid = parseInt(pageId);
  try {
    return await withTimeout(
      prisma.cmsPage.update({
        where: { id: pid },
        data: {
          metaTitle: metaTitle === undefined ? undefined : metaTitle,
          metaDescription: metaDescription === undefined ? undefined : metaDescription,
          ogImage: ogImage === undefined ? undefined : ogImage,
          versionNo: { increment: 1 }
        }
      }),
      300
    );
  } catch {
    const idx = memPages.findIndex((p) => p.id === pid && p.organizationId === Number(organizationId));
    if (idx === -1) throw new Error('Page not found');
    const current = memPages[idx];
    const next = {
      ...current,
      metaTitle: metaTitle === undefined ? current.metaTitle : metaTitle,
      metaDescription: metaDescription === undefined ? current.metaDescription : metaDescription,
      ogImage: ogImage === undefined ? current.ogImage : ogImage,
      versionNo: (current.versionNo || 1) + 1,
      updatedAt: new Date()
    };
    memPages[idx] = next;
    return next;
  }
}

async function getAllPages({ organizationId, kind }) {
  const k = typeof kind === 'string' && kind ? kind : null;
  try {
    return await withTimeout(
      prisma.cmsPage.findMany({
        where: { organizationId: Number(organizationId), ...(k ? { kind: k } : {}) },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
      }),
      250
    );
  } catch {
    return memPages
      .filter((p) => p.organizationId === Number(organizationId) && (k ? p.kind === k : true))
      .sort((a, b) => {
        const ao = Number(a?.sortOrder) || 0;
        const bo = Number(b?.sortOrder) || 0;
        if (ao !== bo) return ao - bo;
        return Number(a?.id) - Number(b?.id);
      });
  }
}

async function reorderPages({ organizationId, kind, orderedIds }) {
  const orgId = Number(organizationId);
  const k = typeof kind === 'string' && kind ? kind : null;
  const uniqIds = Array.from(new Set((orderedIds || []).map((v) => Number(v)).filter((n) => Number.isFinite(n))));
  if (!uniqIds.length) throw new Error('orderedIds is required');

  try {
    const existing = await withTimeout(
      prisma.cmsPage.findMany({
        where: { organizationId: orgId, ...(k ? { kind: k } : {}), id: { in: uniqIds } },
        select: { id: true }
      }),
      300
    );
    if (existing.length !== uniqIds.length) throw new Error('Invalid pages');

    await withTimeout(
      prisma.$transaction(uniqIds.map((id, idx) => prisma.cmsPage.update({ where: { id }, data: { sortOrder: idx + 1 } }))),
      300
    );

    return { orderedIds: uniqIds };
  } catch {
    const allowed = new Set(
      memPages
        .filter((p) => p.organizationId === orgId && (k ? p.kind === k : true))
        .map((p) => Number(p.id))
    );
    for (const id of uniqIds) {
      if (!allowed.has(Number(id))) throw new Error('Invalid pages');
    }
    for (let i = 0; i < uniqIds.length; i++) {
      const idx = memPages.findIndex((p) => p.organizationId === orgId && Number(p.id) === Number(uniqIds[i]));
      if (idx !== -1) memPages[idx] = { ...memPages[idx], sortOrder: i + 1, updatedAt: new Date() };
    }
    return { orderedIds: uniqIds };
  }
}

async function deletePage({ organizationId, pageId }) {
  const pid = parseInt(pageId);
  try {
    const orgId = Number(organizationId);
    await prisma.$transaction(async (tx) => {
      const existing = await withTimeout(
        tx.cmsPage.findFirst({ where: { id: pid, organizationId: orgId }, select: { id: true } }),
        300
      );
      if (!existing) throw new Error('Page not found');

      await tx.cmsPage.updateMany({ where: { id: pid, organizationId: orgId }, data: { draftVersionId: null, publishedVersionId: null } });
      await tx.product.updateMany({ where: { organizationId: orgId, cmsPageId: pid }, data: { cmsPageId: null } });
      await tx.product.updateMany({ where: { organizationId: orgId, cmsCertificatePageId: pid }, data: { cmsCertificatePageId: null } });
      await tx.cmsLayout.deleteMany({ where: { pageId: pid } });
      await tx.cmsTranslation.deleteMany({ where: { pageId: pid } });
      await tx.cmsVersion.deleteMany({ where: { pageId: pid } });
      await tx.cmsPage.deleteMany({ where: { id: pid, organizationId: orgId } });
    });

    return { id: pid };
  } catch {
    const idx = memPages.findIndex((p) => p.id === pid && p.organizationId === Number(organizationId));
    if (idx === -1) throw new Error('Page not found');
    memPages.splice(idx, 1);
    memLayouts.delete(String(pid));
    return { id: pid };
  }
}

module.exports = {
  createPage,
  getPageBySlug,
  saveLayout,
  publishPage,
  updateMeta,
  getAllPages,
  reorderPages,
  deletePage
};
