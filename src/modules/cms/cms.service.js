const prisma = require('../../config/prisma');
const DEFAULT_TIMEOUT_MS = Number(process.env.CMS_DB_TIMEOUT_MS || 2000);

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function normalizeLang(lang) {
  const l = String(lang || 'en').toLowerCase();
  if (l === 'ms' || l === 'bm') return 'ms';
  if (l === 'zh' || l === 'zh-cn' || l === 'cn') return 'zh';
  return 'en';
}

function coerceLayoutToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.blocks)) return value.blocks;
    if (Array.isArray(value.layoutJson)) return value.layoutJson;
  }
  return null;
}

function mergeCmsLayoutBaseWithTranslation(baseLayout, translatedLayout) {
  const baseArr = Array.isArray(baseLayout) ? baseLayout : [];
  const trArr = Array.isArray(translatedLayout) ? translatedLayout : [];
  if (baseArr.length === 0) return trArr;
  if (trArr.length === 0) return baseArr;

  const trById = new Map(trArr.map((b) => [String(b?.id || ''), b]));
  return baseArr.map((b) => {
    const id = String(b?.id || '');
    if (!id) return b;
    const tr = trById.get(id);
    if (!tr) return b;
    const type = String(b?.type || '');
    if (type === 'text') {
      const trText = tr?.content?.text;
      if (typeof trText === 'string') {
        return { ...b, content: { ...(b.content || {}), text: trText } };
      }
    }
    return b;
  });
}

function pickTextOnlyTranslationLayout(layout) {
  const arr = Array.isArray(layout) ? layout : [];
  const out = [];
  const used = new Set();
  for (const b of arr) {
    if (!b || typeof b !== 'object') continue;
    if (String(b.type || '') !== 'text') continue;
    const id = String(b.id || '').trim();
    if (!id || used.has(id)) continue;
    used.add(id);
    const text = b?.content?.text;
    if (typeof text !== 'string') continue;
    out.push({ id, type: 'text', content: { text } });
  }
  return out;
}

function isMeaningfulHtmlText(value) {
  if (value == null) return false;
  const s = String(value);
  const stripped = s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > 0;
}

function fillEmptyCmsTextFromBase(baseLayout, existingTranslationLayout) {
  const baseArr = Array.isArray(baseLayout) ? baseLayout : [];
  const trArr = Array.isArray(existingTranslationLayout) ? existingTranslationLayout : [];
  if (baseArr.length === 0) return trArr;

  const trById = new Map(trArr.map((b) => [String(b?.id || ''), b]));
  return baseArr.map((b) => {
    const id = String(b?.id || '');
    if (!id) return b;
    const type = String(b?.type || '');
    if (type !== 'text') return b;
    const tr = trById.get(id);
    const trText = tr?.content?.text;
    if (isMeaningfulHtmlText(trText)) return { ...b, content: { ...(b.content || {}), text: trText } };
    const baseText = b?.content?.text;
    return typeof baseText === 'string' ? { ...b, content: { ...(b.content || {}), text: baseText } } : b;
  });
}

async function createPage(data) {
  const orgId = Number(data.organizationId);
  const kind = data.kind || 'landing';
  const latest = await withTimeout(
    prisma.cmsPage.findFirst({
      where: { organizationId: orgId, kind },
      select: { sortOrder: true, id: true },
      orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }]
    }),
    DEFAULT_TIMEOUT_MS
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
    DEFAULT_TIMEOUT_MS
  );
}

async function getPageBySlug({ organizationId, slug, language }) {
  const lang = normalizeLang(language);
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
      const baseLayout =
        coerceLayoutToArray(page?.draftVersion?.layoutJson) ??
        coerceLayoutToArray(page?.publishedVersion?.layoutJson) ??
        coerceLayoutToArray(page?.layout?.layoutJson) ??
        null;
      const translatedLayout = coerceLayoutToArray(translation?.contentJson) ?? null;

      const effectiveLayout = mergeCmsLayoutBaseWithTranslation(baseLayout, translatedLayout);
      return { ...page, effectiveLayout, language: lang };
    })(),
    DEFAULT_TIMEOUT_MS
  );
}

async function saveLayout({ organizationId, pageId, layoutJson, language }) {
  const lang = normalizeLang(language);
  const pid = parseInt(pageId);
  const translationPayload = lang === 'en' ? layoutJson : pickTextOnlyTranslationLayout(layoutJson);
  await withTimeout(
    prisma.cmsTranslation.upsert({
      where: { pageId_language: { pageId: pid, language: lang } },
      update: { organizationId: Number(organizationId), contentJson: translationPayload },
      create: { organizationId: Number(organizationId), pageId: pid, language: lang, contentJson: translationPayload }
    }),
    DEFAULT_TIMEOUT_MS
  );

  const page = await withTimeout(prisma.cmsPage.findUnique({ where: { id: pid } }), DEFAULT_TIMEOUT_MS);

  if (lang === 'en') {
    if (page?.draftVersionId) {
      await withTimeout(prisma.cmsVersion.update({ where: { id: page.draftVersionId }, data: { layoutJson } }), DEFAULT_TIMEOUT_MS);
    } else {
      const latest = await withTimeout(
        prisma.cmsVersion.findFirst({ where: { pageId: pid }, orderBy: { versionNo: 'desc' } }),
        DEFAULT_TIMEOUT_MS
      );
      const nextNo = (latest?.versionNo || 0) + 1;
      const created = await withTimeout(
        prisma.cmsVersion.create({
          data: { organizationId: Number(organizationId), pageId: pid, versionNo: nextNo, status: 'draft', layoutJson }
        }),
        DEFAULT_TIMEOUT_MS
      );
      await withTimeout(prisma.cmsPage.update({ where: { id: pid }, data: { draftVersionId: created.id } }), DEFAULT_TIMEOUT_MS);
    }
  }

  return { pageId: pid, language: lang, saved: true };
}

async function fillEmptyTranslation({ organizationId, pageId, language }) {
  const lang = normalizeLang(language);
  if (lang === 'en') throw new Error('Language must not be EN');
  const pid = parseInt(pageId);
  const orgId = Number(organizationId);

  const page = await withTimeout(
    prisma.cmsPage.findFirst({
      where: { organizationId: orgId, id: pid },
      include: { layout: true, publishedVersion: true, draftVersion: true }
    }),
    DEFAULT_TIMEOUT_MS
  );
  if (!page) throw new Error('Page not found');

  const baseLayout =
    coerceLayoutToArray(page?.draftVersion?.layoutJson) ??
    coerceLayoutToArray(page?.publishedVersion?.layoutJson) ??
    coerceLayoutToArray(page?.layout?.layoutJson) ??
    null;
  if (!Array.isArray(baseLayout) || baseLayout.length === 0) throw new Error('No base layout');

  const existing = await withTimeout(
    prisma.cmsTranslation.findFirst({ where: { organizationId: orgId, pageId: pid, language: lang } }),
    DEFAULT_TIMEOUT_MS
  );
  const existingLayout = coerceLayoutToArray(existing?.contentJson) ?? null;
  const filled = fillEmptyCmsTextFromBase(baseLayout, existingLayout);
  const translationPayload = pickTextOnlyTranslationLayout(filled);

  await withTimeout(
    prisma.cmsTranslation.upsert({
      where: { pageId_language: { pageId: pid, language: lang } },
      update: { organizationId: orgId, contentJson: translationPayload },
      create: { organizationId: orgId, pageId: pid, language: lang, contentJson: translationPayload }
    }),
    DEFAULT_TIMEOUT_MS
  );

  return { pageId: pid, language: lang, filled: true };
}

async function publishPage({ organizationId, pageId }) {
  const pid = parseInt(pageId);
  const page = await withTimeout(prisma.cmsPage.findUnique({ where: { id: pid } }), DEFAULT_TIMEOUT_MS);
  const draft = page?.draftVersionId
    ? await withTimeout(prisma.cmsVersion.findUnique({ where: { id: page.draftVersionId } }), DEFAULT_TIMEOUT_MS)
    : null;
  const baseLayout = draft?.layoutJson;
  if (!baseLayout) throw new Error('No draft layout to publish');

  const latest = await withTimeout(
    prisma.cmsVersion.findFirst({ where: { pageId: pid }, orderBy: { versionNo: 'desc' } }),
    DEFAULT_TIMEOUT_MS
  );
  const nextNo = (latest?.versionNo || 0) + 1;
  const published = await withTimeout(
    prisma.cmsVersion.create({
      data: { organizationId: Number(organizationId), pageId: pid, versionNo: nextNo, status: 'published', layoutJson: baseLayout }
    }),
    DEFAULT_TIMEOUT_MS
  );
  await withTimeout(prisma.cmsPage.update({ where: { id: pid }, data: { publishedVersionId: published.id } }), DEFAULT_TIMEOUT_MS);
  return { pageId: pid, publishedVersionId: published.id, versionNo: nextNo };
}

async function updateMeta({ organizationId, pageId, metaTitle, metaDescription, ogImage }) {
  const pid = parseInt(pageId);
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
    DEFAULT_TIMEOUT_MS
  );
}

async function getAllPages({ organizationId, kind }) {
  const k = typeof kind === 'string' && kind ? kind : null;
  return await withTimeout(
    prisma.cmsPage.findMany({
      where: { organizationId: Number(organizationId), ...(k ? { kind: k } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    }),
    DEFAULT_TIMEOUT_MS
  );
}

async function reorderPages({ organizationId, kind, orderedIds }) {
  const orgId = Number(organizationId);
  const k = typeof kind === 'string' && kind ? kind : null;
  const uniqIds = Array.from(new Set((orderedIds || []).map((v) => Number(v)).filter((n) => Number.isFinite(n))));
  if (!uniqIds.length) throw new Error('orderedIds is required');

  const existing = await withTimeout(
    prisma.cmsPage.findMany({
      where: { organizationId: orgId, ...(k ? { kind: k } : {}), id: { in: uniqIds } },
      select: { id: true }
    }),
    DEFAULT_TIMEOUT_MS
  );
  if (existing.length !== uniqIds.length) throw new Error('Invalid pages');

  await withTimeout(
    prisma.$transaction(uniqIds.map((id, idx) => prisma.cmsPage.update({ where: { id }, data: { sortOrder: idx + 1 } }))),
    DEFAULT_TIMEOUT_MS
  );

  return { orderedIds: uniqIds };
}

async function deletePage({ organizationId, pageId }) {
  const pid = parseInt(pageId);
  const orgId = Number(organizationId);
  await prisma.$transaction(async (tx) => {
    const existing = await withTimeout(tx.cmsPage.findFirst({ where: { id: pid, organizationId: orgId }, select: { id: true } }), DEFAULT_TIMEOUT_MS);
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
}

module.exports = {
  createPage,
  getPageBySlug,
  saveLayout,
  fillEmptyTranslation,
  publishPage,
  updateMeta,
  getAllPages,
  reorderPages,
  deletePage
};
