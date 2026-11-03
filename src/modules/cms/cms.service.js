const prisma = require('../../config/prisma');
const DEFAULT_TIMEOUT_MS = Number(process.env.CMS_DB_TIMEOUT_MS || 10000);

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
  const designId = data.designId != null ? Number(data.designId) : null;
  const latest = await withTimeout(
    prisma.cmsPage.findFirst({
      where: { organizationId: orgId, kind, ...(designId != null ? { designId } : { designId: null }) },
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
        description: data.description?.trim() || null,
        kind,
        sortOrder: nextSortOrder,
        designId,
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

async function renamePage({ organizationId, pageId, name }) {
  const pid = Number(pageId);
  const orgId = Number(organizationId);
  const nextName = String(name ?? '').trim();

  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Invalid page ID');
  if (!Number.isSafeInteger(orgId) || orgId < 1) throw new Error('Invalid organization');
  if (!nextName || nextName.length > 120) throw new Error('Page name must be between 1 and 120 characters');

  const existing = await withTimeout(
    prisma.cmsPage.findFirst({
      where: { id: pid, organizationId: orgId },
      select: { id: true }
    }),
    DEFAULT_TIMEOUT_MS
  );
  if (!existing) throw new Error('Page not found');

  const result = await withTimeout(
    prisma.cmsPage.updateMany({
      where: { id: pid, organizationId: orgId },
      data: { name: nextName }
    }),
    DEFAULT_TIMEOUT_MS
  );
  if (!result.count) throw new Error('Page not found');

  return await withTimeout(
    prisma.cmsPage.findFirst({
      where: { id: pid, organizationId: orgId }
    }),
    DEFAULT_TIMEOUT_MS
  );
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

async function getAllPages({ organizationId, kind, designId }) {
  const k = typeof kind === 'string' && kind ? kind : null;
  const d = designId === undefined ? undefined : (designId === null || designId === '' ? null : Number(designId));
  const where = { organizationId: Number(organizationId) };
  if (k) where.kind = k;
  // designId filter: number=specific group; null=legacy default group (designId IS NULL); undefined=any
  if (d !== undefined) where.designId = d;
  return await withTimeout(
    prisma.cmsPage.findMany({
      where,
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
    exportDesign,
    duplicateDesign,
    importDesign,

  createPage,
  getPageBySlug,
  saveLayout,
  fillEmptyTranslation,
  publishPage,
  updateMeta,
  renamePage,
  getAllPages,
  reorderPages,
  deletePage,

  // CmsDesign (top-level landing page bundles)
  createDesign,
  listDesigns,
  updateDesign,
  materializeDefaultDesign,
  deleteDesign,
  getDesignById
};

// ============================================================================
// CmsDesign — Top-level landing page design bundles (groups of inner CmsPage)
// ============================================================================

async function createDesign({ organizationId, name, slug, kind, description }) {
  const orgId = Number(organizationId);
  const k = kind || 'landing';
  return await withTimeout(
    prisma.cmsDesign.create({
      data: {
        organizationId: orgId,
        name: String(name || '').trim(),
        slug: String(slug || '').trim(),
        kind: k,
        description: description ? String(description).trim() : null,
      },
    }),
    DEFAULT_TIMEOUT_MS
  );
}

async function listDesigns({ organizationId, kind }) {
  const orgId = Number(organizationId);
  const where = { organizationId: orgId, deletedAt: null };
  if (typeof kind === 'string' && kind) where.kind = kind;
  return await withTimeout(
    prisma.cmsDesign.findMany({
      where,
      orderBy: [{ id: 'asc' }],
    }),
    DEFAULT_TIMEOUT_MS
  );
}

async function getDesignById({ organizationId, id }) {
  const orgId = Number(organizationId);
  const designId = Number(id);
  return await withTimeout(
    prisma.cmsDesign.findFirst({
      where: { id: designId, organizationId: orgId, deletedAt: null },
    }),
    DEFAULT_TIMEOUT_MS
  );
}

async function updateDesign({ organizationId, id, name, slug, kind, description, logoUrl }) {
  const orgId = Number(organizationId);
  const designId = Number(id);
  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  if (slug !== undefined) data.slug = String(slug).trim();
  if (kind !== undefined) data.kind = String(kind);
  if (description !== undefined) data.description = description ? String(description).trim() : null;
  if (logoUrl !== undefined) data.logoUrl = logoUrl ? String(logoUrl).trim() : null;
  return await withTimeout(
    prisma.cmsDesign.updateMany({
      where: { id: designId, organizationId: orgId, deletedAt: null },
      data,
  }),
    DEFAULT_TIMEOUT_MS
  );
}

async function materializeDefaultDesign({ organizationId, name, slug, kind, description }) {
  const orgId = Number(organizationId);
  const k = (kind || 'landing').toString();
  const finalName = String(name || '').trim() || 'Default Design';
  const finalSlug = (String(slug || '').trim() || 'default') + '-' + orgId;

  const result = await prisma.$transaction(async (tx) => {
    let existing = await withTimeout(
      tx.cmsDesign.findFirst({
        where: {
          organizationId: orgId,
          kind: k,
          OR: [
            { slug: { equals: finalSlug } },
            { slug: { in: [`default-${orgId}`, 'default-' + orgId + '-landing'] } }
          ]
        },
        select: { id: true, name: true, slug: true }
      }),
      DEFAULT_TIMEOUT_MS
    );

    if (existing) {
      existing = await withTimeout(
        tx.cmsDesign.update({
          where: { id: existing.id },
          data: {
            name: finalName,
            description: description ? String(description).trim() : undefined,
          }
        }),
        DEFAULT_TIMEOUT_MS
      );
    } else {
      existing = await withTimeout(
        tx.cmsDesign.create({
          data: {
            organizationId: orgId,
            name: finalName,
            slug: finalSlug,
            kind: k,
            description: description ? String(description).trim() : null,
          }
        }),
        DEFAULT_TIMEOUT_MS
      );
    }

    await tx.cmsPage.updateMany({
      where: { organizationId: orgId, kind: k, designId: null },
      data: { designId: existing.id }
    });

    return existing;
  });

  return result;
}

async function deleteDesign({ organizationId, id }) {
  const orgId = Number(organizationId);
  const designId = Number(id);

  await prisma.$transaction(async (tx) => {
    const existing = await withTimeout(
      tx.cmsDesign.findFirst({ where: { id: designId, organizationId: orgId, deletedAt: null }, select: { id: true } }),
      DEFAULT_TIMEOUT_MS
    );
    if (!existing) throw new Error('Design not found');

    // 1) Detach all CmsPage rows that currently belong to this design → set designId = null (move back to legacy default group)
    //    or delete them entirely? Move to default group is safer (avoid accidental data loss of pages user built)
    await tx.cmsPage.updateMany({
      where: { organizationId: orgId, designId },
      data: { designId: null },
    });

    // 2) Clear Product.cmsDesignId / Product.cmsCertificateDesignId FKs pointing to this design
    await tx.product.updateMany({
      where: { organizationId: orgId, cmsDesignId: designId },
      data: { cmsDesignId: null },
    });
    await tx.product.updateMany({
      where: { organizationId: orgId, cmsCertificateDesignId: designId },
      data: { cmsCertificateDesignId: null },
    });

    // 3) Clear Certificate.cmsDesignId per-cert override FK
    await tx.certificate.updateMany({
      where: { organizationId: orgId, cmsDesignId: designId },
      data: { cmsDesignId: null },
    });

    // 4) Soft-delete the design row
    await tx.cmsDesign.updateMany({
      where: { id: designId, organizationId: orgId },
      data: { deletedAt: new Date() },
    });
  });

  return { id: designId };
}


// ============================================================================
// CMS Design transfer: JSON export, duplicate, and import
// Imported/duplicated designs are always drafts and have no product assignments.
// ============================================================================
function cmsSlugBase(value, fallback = 'design') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
  return slug || fallback;
}

async function cmsUniqueSlug(tx, model, organizationId, base) {
  const root = cmsSlugBase(base);
  let candidate = root;
  let suffix = 2;

  while (await tx[model].findFirst({
    where: { organizationId: Number(organizationId), slug: candidate },
    select: { id: true }
  })) {
    candidate = `${root}-${suffix++}`;
  }
  return candidate;
}

async function exportDesign({ organizationId, id }) {
  const orgId = Number(organizationId);
  const designId = Number(id);

  const design = await prisma.cmsDesign.findFirst({
    where: { id: designId, organizationId: orgId, deletedAt: null },
    select: { id: true, name: true, slug: true, kind: true, description: true }
  });
  if (!design) throw new Error('Design not found');

  const pages = await prisma.cmsPage.findMany({
    where: { organizationId: orgId, designId, deletedAt: null },
    include: {
      draftVersion: true,
      publishedVersion: true,
      layout: true,
      translations: true
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
  });

  return {
    format: 'cms-design-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    design: {
      name: design.name,
      slug: design.slug,
      kind: design.kind,
      description: design.description
    },
    pages: pages.map((page) => ({
      name: page.name,
      slug: page.slug,
      description: page.description,
      kind: page.kind,
      sortOrder: page.sortOrder,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      ogImage: page.ogImage,
      layoutJson:
        page.draftVersion?.layoutJson ??
        page.publishedVersion?.layoutJson ??
        page.layout?.layoutJson ??
        [],
      translations: (page.translations || []).map((translation) => ({
        language: translation.language,
        contentJson: translation.contentJson
      }))
    }))
  };
}

async function importDesign({ organizationId, payload, name, slug }) {
  const orgId = Number(organizationId);

  if (!payload || payload.format !== 'cms-design-export' ||
      payload.version !== 1 || !payload.design ||
      !Array.isArray(payload.pages)) {
    throw new Error('Invalid CMS design JSON format');
  }
  if (payload.pages.length > 200) {
    throw new Error('Design import exceeds the 200-page limit');
  }

  const sourceDesign = payload.design;
  const finalName = String(name || sourceDesign.name || 'Imported Design').trim();
  if (!finalName) throw new Error('Design name is required');

  const result = await prisma.$transaction(async (tx) => {
    const designSlug = await cmsUniqueSlug(
      tx, 'cmsDesign', orgId,
      slug || `${sourceDesign.slug || finalName}-import`
    );

    const newDesign = await tx.cmsDesign.create({
      data: {
        organizationId: orgId,
        name: finalName,
        slug: designSlug,
        kind: String(sourceDesign.kind || 'landing').slice(0, 80),
        description: sourceDesign.description
          ? String(sourceDesign.description)
          : null
      }
    });

    for (let index = 0; index < payload.pages.length; index++) {
      const sourcePage = payload.pages[index] || {};
      const pageName = String(sourcePage.name || `Page ${index + 1}`).trim();
      const pageSlug = await cmsUniqueSlug(
        tx, 'cmsPage', orgId,
        `${sourcePage.slug || pageName}-import-${newDesign.id}`
      );
      const layoutJson = sourcePage.layoutJson == null ? [] : sourcePage.layoutJson;

      const page = await tx.cmsPage.create({
        data: {
          organizationId: orgId,
          designId: newDesign.id,
          name: pageName || `Page ${index + 1}`,
          slug: pageSlug,
          description: sourcePage.description == null ? null : String(sourcePage.description),
          kind: String(sourcePage.kind || sourceDesign.kind || 'landing').slice(0, 80),
          sortOrder: Number.isFinite(Number(sourcePage.sortOrder))
            ? Number(sourcePage.sortOrder)
            : index,
          metaTitle: sourcePage.metaTitle == null ? null : String(sourcePage.metaTitle),
          metaDescription: sourcePage.metaDescription == null ? null : String(sourcePage.metaDescription),
          ogImage: sourcePage.ogImage == null ? null : String(sourcePage.ogImage)
        }
      });

      const version = await tx.cmsVersion.create({
        data: {
          organizationId: orgId,
          pageId: page.id,
          versionNo: 1,
          status: 'draft',
          layoutJson
        }
      });

      await tx.cmsPage.update({
        where: { id: page.id },
        data: { draftVersionId: version.id, versionNo: 1 }
      });

      // Keep the legacy layout fallback in sync with the imported draft.
      await tx.cmsLayout.create({
        data: {
          organizationId: orgId,
          pageId: page.id,
          layoutJson
        }
      });

      const translations = Array.isArray(sourcePage.translations)
        ? sourcePage.translations
        : [];
      const seenLanguages = new Set();

      for (const translation of translations) {
        if (!translation || typeof translation.language !== 'string') continue;
        const rawLanguage = translation.language.trim().toLowerCase();
        if (!['en', 'ms', 'bm', 'zh', 'zh-cn', 'cn'].includes(rawLanguage)) continue;
        const language = normalizeLang(rawLanguage);
        if (!language || seenLanguages.has(language) || translation.contentJson == null) continue;
        seenLanguages.add(language);

        await tx.cmsTranslation.create({
          data: {
            organizationId: orgId,
            pageId: page.id,
            language,
            contentJson: translation.contentJson
          }
        });
      }
    }

    return {
      id: newDesign.id,
      name: newDesign.name,
      slug: newDesign.slug,
      kind: newDesign.kind,
      description: newDesign.description,
      pageCount: payload.pages.length
    };
  });

  return result;
}

async function duplicateDesign({ organizationId, id, name }) {
  const exported = await exportDesign({ organizationId, id });
  const originalName = String(exported.design.name || 'Design');
  return await importDesign({
    organizationId,
    payload: exported,
    name: name || `Copy of ${originalName}`,
    slug: `${exported.design.slug || originalName}-copy`
  });
}

