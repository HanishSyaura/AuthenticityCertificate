const express = require('express');
const router = express.Router();

const certificateService = require('../certificate/certificate.service');
const scanlog = require('../../services/scanlog.service');
const identityService = require('../../services/identity.service');
const { attachOrganization } = require('../../middleware/org.middleware');
const prisma = require('../../config/prisma');
const fraudService = require('../../services/fraud.service');
const dbGate = require('../../services/dbGate.service');
const webhookService = require('../../services/webhook.service');

function normalizeLang(lang) {
  const l = String(lang || 'en').toLowerCase();
  if (l === 'ms' || l === 'bm') return 'ms';
  if (l === 'zh' || l === 'zh-cn' || l === 'cn') return 'zh';
  return 'en';
}

function getPublicDbTimeoutMs() {
  const raw = process.env.PUBLIC_DB_TIMEOUT_MS || process.env.DB_QUERY_TIMEOUT_MS;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : 5000;
}

function isPrismaError(err) {
  return typeof err?.name === 'string' && err.name.startsWith('Prisma');
}

router.use(attachOrganization);

router.get('/settings', async (req, res) => {
  try {
    const orgId = Number(req.organization?.id || 0);
    if (!Number.isFinite(orgId) || orgId <= 0) {
      return res.success({ organization: null, settings: { logoUrl: null } }, 'OK');
    }

    if (!dbGate.shouldUseDb()) {
      return res.success({ organization: null, settings: { logoUrl: null } }, 'OK');
    }

    const dbTimeoutMs = getPublicDbTimeoutMs();
    const [org, settingsRows] = await Promise.all([
      Promise.race([
        prisma.organization.findUnique({ where: { id: orgId } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutMs))
      ]),
      Promise.race([
        prisma.$queryRaw`
          SELECT logoUrl, defaultLocale, defaultTimezone, maintenanceMode
          FROM OrganizationSettings
          WHERE organizationId = ${orgId}
          LIMIT 1
        `,
        new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutMs))
      ])
    ]);

    const row = settingsRows?.[0] || null;
    dbGate.markDbSuccess();

    return res.success(
      {
        organization: org
          ? {
              id: org.id,
              name: org.name,
              code: org.code
            }
          : null,
        settings: {
          defaultLocale: row?.defaultLocale ? String(row.defaultLocale) : null,
          defaultTimezone: row?.defaultTimezone ? String(row.defaultTimezone) : null,
          maintenanceMode: Boolean(row?.maintenanceMode),
          logoUrl: row?.logoUrl ? String(row.logoUrl) : null
        }
      },
      'OK'
    );
  } catch (e) {
    if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
    return res.success({ organization: null, settings: { logoUrl: null } }, 'OK');
  }
});

function chooseStatus({ effectiveStatus, overrideStatus }) {
  if (overrideStatus === 'REVOKED') return 'REVOKED';
  if (effectiveStatus === 'EXPIRED') return 'EXPIRED';
  return overrideStatus || effectiveStatus;
}

function getRect(block, mode) {
  const src = mode && block && typeof block === 'object' ? block[mode] || block : block;
  return {
    x: Number(src?.x ?? 0) || 0,
    y: Number(src?.y ?? 0) || 0,
    w: Number(src?.w ?? 0) || 0,
    h: Number(src?.h ?? 0) || 0
  };
}

function getLayoutHeight(layout) {
  if (!Array.isArray(layout)) return 0;
  let maxBottom = 0;
  for (const b of layout) {
    const rects = [getRect(b, null), getRect(b, 'desktop'), getRect(b, 'mobile')];
    for (const r of rects) {
      const bottom = (Number(r.y) || 0) + (Number(r.h) || 0);
      if (Number.isFinite(bottom)) maxBottom = Math.max(maxBottom, bottom);
    }
  }
  return maxBottom;
}

function shiftBlock(block, { yOffset, idPrefix }) {
  const next = { ...(block || {}) };
  if (next.id) next.id = `${idPrefix}${String(next.id)}`;
  if (next.x != null || next.y != null || next.w != null || next.h != null) {
    next.y = (Number(next.y) || 0) + yOffset;
  }
  if (next.desktop && typeof next.desktop === 'object') {
    next.desktop = { ...next.desktop, y: (Number(next.desktop.y) || 0) + yOffset };
  }
  if (next.mobile && typeof next.mobile === 'object') {
    next.mobile = { ...next.mobile, y: (Number(next.mobile.y) || 0) + yOffset };
  }
  return next;
}

function composeLayouts(pages) {
  const ordered = Array.isArray(pages) ? pages : [];
  let yOffset = 0;
  const out = [];
  for (const p of ordered) {
    const arr = Array.isArray(p?.effectiveLayout) ? p.effectiveLayout : [];
    const prefix = `p${String(p.id)}-`;
    for (const b of arr) out.push(shiftBlock(b, { yOffset, idPrefix: prefix }));
    yOffset += getLayoutHeight(arr);
  }
  return out;
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

function getSupportingTemplateIdsFromLayout(layout) {
  const out = new Set();
  if (!Array.isArray(layout)) return [];
  for (const b of layout) {
    if (!b || typeof b !== 'object') continue;
    if (b.type !== 'certificate') continue;
    const variant = String(b?.content?.variant || 'auth');
    if (variant !== 'supporting') continue;
    const tid = b?.content?.certificateTemplateId;
    const id = tid != null ? Number(tid) : NaN;
    if (Number.isFinite(id) && id > 0) out.add(id);
  }
  return Array.from(out);
}

function mergeTemplatePlaceholdersBaseWithTranslation(basePlaceholders, translatedPlaceholders) {
  const baseArr = Array.isArray(basePlaceholders) ? basePlaceholders : [];
  const trArr = Array.isArray(translatedPlaceholders) ? translatedPlaceholders : [];
  if (baseArr.length === 0) return trArr;
  if (trArr.length === 0) return baseArr;

  const trByKey = new Map(trArr.map((p) => [String(p?.key || '').trim(), p]));
  return baseArr.map((p) => {
    const key = String(p?.key || '').trim();
    if (!key) return p;
    const tr = trByKey.get(key);
    if (!tr) return p;
    return {
      ...(p || {}),
      label: tr.label !== undefined ? tr.label : p.label,
      labelHtml: tr.labelHtml !== undefined ? tr.labelHtml : p.labelHtml,
      separator: tr.separator !== undefined ? tr.separator : p.separator,
      separatorHtml: tr.separatorHtml !== undefined ? tr.separatorHtml : p.separatorHtml,
      staticValue: tr.staticValue !== undefined ? tr.staticValue : p.staticValue
    };
  });
}

function mergeTemplateMetaAliases(input) {
  const base = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const next = { ...base };
  const batchNumber = base.batchNumber != null ? String(base.batchNumber).trim() : '';
  const swiftletHouseNumber = base.swiftletHouseNumber != null ? String(base.swiftletHouseNumber).trim() : '';
  const swiftletHouseNumb = base.swiftletHouseNumb != null ? String(base.swiftletHouseNumb).trim() : '';
  const manufactureDate = base.manufactureDate != null ? String(base.manufactureDate).trim() : '';
  if (batchNumber && (next.batch_number == null || String(next.batch_number).trim() === '')) next.batch_number = batchNumber;
  if (batchNumber && (next.batchnumber == null || String(next.batchnumber).trim() === '')) next.batchnumber = batchNumber;
  if (batchNumber && (next.batchNo == null || String(next.batchNo).trim() === '')) next.batchNo = batchNumber;
  if (batchNumber && (next.batch_no == null || String(next.batch_no).trim() === '')) next.batch_no = batchNumber;
  if (swiftletHouseNumber && (next.swiftlet_house_number == null || String(next.swiftlet_house_number).trim() === ''))
    next.swiftlet_house_number = swiftletHouseNumber;
  if (swiftletHouseNumber && (next.swiftlethousenumber == null || String(next.swiftlethousenumber).trim() === ''))
    next.swiftlethousenumber = swiftletHouseNumber;
  if (swiftletHouseNumber && (next.swiftletHouseNo == null || String(next.swiftletHouseNo).trim() === '')) next.swiftletHouseNo = swiftletHouseNumber;
  if (swiftletHouseNumber && (next.swiftlet_house_no == null || String(next.swiftlet_house_no).trim() === ''))
    next.swiftlet_house_no = swiftletHouseNumber;
  if (swiftletHouseNumber && (next.swiftletHouseNumb == null || String(next.swiftletHouseNumb).trim() === '')) next.swiftletHouseNumb = swiftletHouseNumber;
  if (swiftletHouseNumb && (next.swiftletHouseNumber == null || String(next.swiftletHouseNumber).trim() === '')) next.swiftletHouseNumber = swiftletHouseNumb;
  if (manufactureDate && (next.manufacture_date == null || String(next.manufacture_date).trim() === '')) next.manufacture_date = manufactureDate;
  if (manufactureDate && (next.manufacturedate == null || String(next.manufacturedate).trim() === '')) next.manufacturedate = manufactureDate;

  const batchNumber2 = base.batch_number != null ? String(base.batch_number).trim() : '';
  const swiftletHouseNumber2 = base.swiftlet_house_number != null ? String(base.swiftlet_house_number).trim() : '';
  const manufactureDate2 = base.manufacture_date != null ? String(base.manufacture_date).trim() : '';
  if (batchNumber2 && (next.batchNumber == null || String(next.batchNumber).trim() === '')) next.batchNumber = batchNumber2;
  if (batchNumber2 && (next.batchnumber == null || String(next.batchnumber).trim() === '')) next.batchnumber = batchNumber2;
  if (batchNumber2 && (next.batchNo == null || String(next.batchNo).trim() === '')) next.batchNo = batchNumber2;
  if (batchNumber2 && (next.batch_no == null || String(next.batch_no).trim() === '')) next.batch_no = batchNumber2;
  if (swiftletHouseNumber2 && (next.swiftletHouseNumber == null || String(next.swiftletHouseNumber).trim() === ''))
    next.swiftletHouseNumber = swiftletHouseNumber2;
  if (swiftletHouseNumber2 && (next.swiftlethousenumber == null || String(next.swiftlethousenumber).trim() === ''))
    next.swiftlethousenumber = swiftletHouseNumber2;
  if (swiftletHouseNumber2 && (next.swiftletHouseNo == null || String(next.swiftletHouseNo).trim() === '')) next.swiftletHouseNo = swiftletHouseNumber2;
  if (swiftletHouseNumber2 && (next.swiftlet_house_no == null || String(next.swiftlet_house_no).trim() === ''))
    next.swiftlet_house_no = swiftletHouseNumber2;
  if (swiftletHouseNumber2 && (next.swiftletHouseNumb == null || String(next.swiftletHouseNumb).trim() === '')) next.swiftletHouseNumb = swiftletHouseNumber2;
  if (manufactureDate2 && (next.manufactureDate == null || String(next.manufactureDate).trim() === '')) next.manufactureDate = manufactureDate2;
  if (manufactureDate2 && (next.manufacturedate == null || String(next.manufacturedate).trim() === '')) next.manufacturedate = manufactureDate2;
  return next;
}

async function respondByCertificateId({ req, res, certificateId, verifiedVia, identity, organizationId }) {
  const ip = scanlog.normalizeIp(req);
  const userAgent = req.get('user-agent') || '';
  const deviceHash = typeof req.headers['x-device-hash'] === 'string' ? String(req.headers['x-device-hash']).trim() : null;
  const country = typeof req.headers['x-geo-country'] === 'string' ? String(req.headers['x-geo-country']).trim() : null;
  const latitude = req.headers['x-geo-lat'] != null ? Number(req.headers['x-geo-lat']) : null;
  const longitude = req.headers['x-geo-lng'] != null ? Number(req.headers['x-geo-lng']) : null;
  const orgIdForLog = Number(organizationId || (typeof req.organization?.id === 'number' ? req.organization.id : 0)) || null;
  const scanEntry = await scanlog.addScan({
    certificateId,
    organizationId: orgIdForLog,
    nfcUid: identity?.nfcUid || null,
    epc: identity?.epc || null,
    deviceHash: deviceHash || null,
    country: country || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    ip,
    userAgent,
    timestamp: Date.now()
  });

  void fraudService.autoFlagIfNeeded({
    organizationId: orgIdForLog || 1,
    certificateId,
    scanEntry
  });

  void webhookService.emitEvent({
    organizationId: orgIdForLog || 1,
    event: 'certificate_scanned',
    data: {
      certificateId,
      verifiedVia,
      ip,
      country: country || null,
      deviceHash: deviceHash || null,
      riskScore: scanEntry.riskScore,
      riskFlags: scanEntry.riskFlags
    }
  });

  const overrideStatus = scanlog.getCertificateStatusOverride(certificateId);

  const dbTimeoutMs = getPublicDbTimeoutMs();
  const dbTimeoutShortMs = Math.max(250, Math.min(dbTimeoutMs, 1500));
  try {
    const lang = normalizeLang(req.query?.lang || req.query?.language);
    let cert = await Promise.race([
      certificateService.getCertificateDetailsCached(certificateId, { ttlMs: 5000 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutMs))
    ]);
    if (!cert) return res.error('Certificate not found', 404);
    dbGate.markDbSuccess();

    const resolvedOrgId = Number(organizationId || cert.organizationId || req.organization?.id || 0) || null;
    const identityFromReq = identity || null;
    let resolvedEpc = identityFromReq?.epc || null;
    let resolvedNfcUid = identityFromReq?.nfcUid || null;
    if ((resolvedEpc == null && resolvedNfcUid == null) || resolvedOrgId == null) {
      try {
        const idRow = await Promise.race([
          prisma.tagIdentity.findFirst({
            where: { organizationId: resolvedOrgId || Number(cert.organizationId || 0), certificateId: String(certificateId), unassignedAt: null },
            orderBy: { assignedAt: 'desc' }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
        ]);
        if (idRow) {
          resolvedEpc = resolvedEpc || idRow.epc || null;
          resolvedNfcUid = resolvedNfcUid || idRow.nfcUid || null;
        }
      } catch (e) {
        if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    let epcItem = null;
    let epcItemId = null;
    let epcBatchTemplate = null;
    let templateData = null;
    let epcBatchName = null;
    let epcBatchId = null;
    let epcProduct = null;
    if (resolvedOrgId && resolvedEpc) {
      try {
        const row = await Promise.race([
          prisma.epcItem.findUnique({
            where: { organizationId_epcCode: { organizationId: resolvedOrgId, epcCode: String(resolvedEpc) } },
            select: {
              id: true,
              netWeight: true,
              productionDate: true,
              caiqNumber: true,
              barcode: true,
              batchNumber: true,
              swiftletHouseNumber: true,
              batch: {
                select: {
                  id: true,
                  batchName: true,
                  templateData: true,
                  certificateTemplate: true,
                  product: {
                    select: {
                      name: true,
                      code: true,
                      cmsPage: { select: { id: true } },
                      certificateTemplate: true
                    }
                  }
                }
              }
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
        ]);
        epcItemId = row?.id != null ? Number(row.id) : null;
        epcItem = row
          ? {
              netWeight: row.netWeight,
              productionDate: row.productionDate,
              caiqNumber: row.caiqNumber,
              barcode: row.barcode || null,
              batchNumber: row.batchNumber || null,
              swiftletHouseNumber: row.swiftletHouseNumber || null
            }
          : null;
        epcBatchTemplate = row?.batch?.certificateTemplate || null;
        templateData = mergeTemplateMetaAliases({
          ...(row?.batch?.templateData && typeof row.batch.templateData === 'object' && !Array.isArray(row.batch.templateData) ? row.batch.templateData : {}),
          epcCode: resolvedEpc,
          barcode: row?.barcode || null,
          netWeight: row?.netWeight || null,
          caiqNumber: row?.caiqNumber || null,
          manufactureDate: row?.productionDate ? new Date(row.productionDate).toISOString().slice(0, 10) : null,
          productionDate: row?.productionDate || null,
          batchNumber: row?.batchNumber || null,
          swiftletHouseNumber: row?.swiftletHouseNumber || null
        });
        epcBatchName = row?.batch?.batchName ? String(row.batch.batchName) : null;
        epcBatchId = row?.batch?.id != null ? Number(row.batch.id) : null;
        epcProduct = row?.batch?.product || null;
      } catch (e) {
        if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    if (resolvedOrgId && !resolvedEpc && (epcBatchTemplate == null || templateData == null || epcBatchName == null || epcProduct == null)) {
      try {
        const row = await Promise.race([
          prisma.epcBatch.findFirst({
            where: { organizationId: resolvedOrgId, certificateId: String(certificateId) },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              batchName: true,
              templateData: true,
              certificateTemplate: true,
              product: {
                select: {
                  name: true,
                  code: true,
                  cmsPage: { select: { id: true } },
                  certificateTemplate: true
                }
              }
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
        ]);
        if (row) {
          epcBatchTemplate = epcBatchTemplate || row.certificateTemplate || null;
          templateData = templateData || mergeTemplateMetaAliases(row.templateData || null);
          epcBatchName = epcBatchName || (row.batchName ? String(row.batchName) : null);
          epcBatchId = epcBatchId || (row.id != null ? Number(row.id) : null);
          epcProduct = epcProduct || row.product || null;
        }
      } catch (e) {
        if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    const resolvedProduct = epcProduct || cert.batch?.product || null;
    let supportingTemplates = [];
    let batchDocuments = [];
    let layout = null;
    const pageId = resolvedProduct?.cmsPage?.id || null;
    const certificateLayout = null;
    const certificatePageId = null;

    const landingOrgId = resolvedOrgId || Number(req.organization?.id || cert.organizationId || 0) || null;
    if (landingOrgId) {
      try {
        const pages = await Promise.race([
          prisma.cmsPage.findMany({
            where: { organizationId: landingOrgId, kind: 'landing' },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: { layout: true, publishedVersion: true }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
        ]);

        const rootId = pageId != null ? Number(pageId) : null;
        const sorted = rootId
          ? [
              ...pages.filter((p) => Number(p.id) === rootId),
              ...pages.filter((p) => Number(p.id) !== rootId)
            ]
          : pages;

        const ids = sorted.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));
        const translations = ids.length
          ? await Promise.race([
              prisma.cmsTranslation.findMany({ where: { organizationId: landingOrgId, language: lang, pageId: { in: ids } } }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
            ])
          : [];
        const tByPageId = new Map((translations || []).map((r) => [Number(r.pageId), r]));

        const effectivePages = sorted.map((p) => {
          const tRow = tByPageId.get(Number(p.id));
          const tLayout = Array.isArray(tRow?.contentJson) && tRow.contentJson.length > 0 ? tRow.contentJson : null;
          const baseLayout = Array.isArray(p?.publishedVersion?.layoutJson)
            ? p.publishedVersion.layoutJson
            : Array.isArray(p?.layout?.layoutJson)
              ? p.layout.layoutJson
              : null;
          const effectiveLayout = lang !== 'en' ? mergeCmsLayoutBaseWithTranslation(baseLayout, tLayout) : tLayout ?? baseLayout;
          return { id: p.id, effectiveLayout };
        });

        const composed = composeLayouts(effectivePages);
        if (composed.length) {
          layout = composed;
        } else if (pageId) {
          const tRow = tByPageId.get(Number(pageId));
          if (Array.isArray(tRow?.contentJson) && tRow.contentJson.length > 0) layout = tRow.contentJson;
        }
      } catch (e) {
        if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    void certificatePageId;
    if (!layout) layout = resolvedProduct?.cmsPage?.layout?.layoutJson || null;
    void certificateLayout;

    const supportingTemplateIds = getSupportingTemplateIdsFromLayout(layout);
    if (resolvedOrgId && supportingTemplateIds.length) {
      try {
        const rows = await Promise.race([
          prisma.certificateTemplate.findMany({
            where: { organizationId: resolvedOrgId, id: { in: supportingTemplateIds }, deletedAt: null }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
        ]);
        supportingTemplates = Array.isArray(rows) ? rows : [];
      } catch (e) {
        if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    if (resolvedOrgId && epcItemId) {
      try {
        const rows = await Promise.race([
          prisma.epcItemDocument.findMany({
            where: { organizationId: resolvedOrgId, epcItemId },
            select: { docType: true, mediaUrl: true },
            orderBy: { docType: 'asc' }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
        ]);
        batchDocuments = Array.isArray(rows) ? rows : [];
      } catch (e) {
        if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    let certificateTemplate = epcBatchTemplate || resolvedProduct?.certificateTemplate || null;
    if (resolvedOrgId && !certificateTemplate) {
      try {
        const tpl = await Promise.race([
          prisma.certificateTemplate.findFirst({
            where: { organizationId: resolvedOrgId, certificateId: String(certificateId), deletedAt: null },
            orderBy: { id: 'desc' }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
        ]);
        certificateTemplate = tpl || null;
      } catch (e) {
        if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }
    if (resolvedOrgId && lang !== 'en') {
      const ids = [];
      const mainId = certificateTemplate?.id != null ? Number(certificateTemplate.id) : NaN;
      if (Number.isFinite(mainId) && mainId > 0) ids.push(mainId);
      for (const t of Array.isArray(supportingTemplates) ? supportingTemplates : []) {
        const tid = t?.id != null ? Number(t.id) : NaN;
        if (Number.isFinite(tid) && tid > 0) ids.push(tid);
      }
      const uniqIds = Array.from(new Set(ids));
      if (uniqIds.length) {
        try {
          const trs = await Promise.race([
            prisma.certificateTemplateTranslation.findMany({
              where: { organizationId: resolvedOrgId, language: lang, templateId: { in: uniqIds } }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutShortMs))
          ]);
          const byId = new Map((trs || []).map((r) => [Number(r.templateId), r]));
          const applyTr = (tpl) => {
            if (!tpl || tpl.id == null) return tpl;
            const row = byId.get(Number(tpl.id));
            if (!row) return tpl;
            return {
              ...tpl,
              layoutJson: tpl.layoutJson,
              placeholders: mergeTemplatePlaceholdersBaseWithTranslation(tpl.placeholders, row.placeholders)
            };
          };
          certificateTemplate = applyTr(certificateTemplate);
          supportingTemplates = (Array.isArray(supportingTemplates) ? supportingTemplates : []).map(applyTr);
        } catch (e) {
          if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
        }
      }
    }

    let effectiveStatus = certificateService.computeEffectiveStatus(cert);
    if (effectiveStatus === 'PENDING' && (verifiedVia === 'epc' || verifiedVia === 'nfc_uid')) effectiveStatus = 'VALID';
    const status = chooseStatus({ effectiveStatus, overrideStatus });

    return res.success(
      {
        certificateId: cert.certificateId,
        type: cert.type,
        status,
        statusStored: cert.status,
        verifiedVia,
        identity: identityFromReq || null,
        issuedAt: cert.issuedAt || cert.createdAt,
        expiresAt: cert.expiresAt || null,
        revokedAt: cert.revokedAt || null,
        reissuedToId: cert.reissuedToId || null,
        product: resolvedProduct
          ? {
              name: resolvedProduct.name,
              code: resolvedProduct.code
            }
          : null,
        batch: epcBatchName ? { batchNo: epcBatchName } : cert.batch ? { batchNo: cert.batch.batchNo } : null,
        epcItem: epcItem
          ? {
              netWeight: epcItem.netWeight || null,
              productionDate: epcItem.productionDate || null,
              caiqNumber: epcItem.caiqNumber || null
            }
          : null,
        templateData: templateData || null,
        batchDocuments,
        supportingTemplates,
        layout,
        certificateLayout: null,
        certificateTemplate,
        risk: {
          score: scanEntry.riskScore,
          flags: scanEntry.riskFlags
        }
      },
      'Verification successful'
    );
  } catch (e) {
    if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000 });
    const msg = e?.message === 'db_timeout' ? 'Service temporarily unavailable' : 'Service unavailable';
    return res.error(msg, 503);
  }
}

router.get('/cert/:id', async (req, res) => {
  const { id } = req.params;
  return respondByCertificateId({ req, res, certificateId: id, verifiedVia: 'qr', identity: null, organizationId: null });
});

router.get('/resolve', async (req, res) => {
  const nfcUid = typeof req.query?.nfcUid === 'string' ? req.query.nfcUid : null;
  const epc = typeof req.query?.epc === 'string' ? req.query.epc : null;
  const orgId = typeof req.organization?.id === 'number' ? req.organization.id : null;
  if (!orgId) return res.error('Organization not found', 404);

  try {
    const requireEpcBatchMeta = Boolean(epc) && !nfcUid;
    let resolvedOrgId = orgId;
    let certificateId = await identityService.resolveCertificateId({
      organizationId: orgId,
      nfcUid,
      epc,
      requireEpcBatchMeta
    });
    if (!certificateId && !req.apiKey) {
      const found = await identityService.resolveCertificateIdGlobal({ nfcUid, epc, requireEpcBatchMeta });
      if (found?.certificateId && found?.organizationId) {
        certificateId = found.certificateId;
        resolvedOrgId = found.organizationId;
      }
    }
    if (!certificateId) return res.error('Identity not found. Use QR code fallback.', 404);

    const verifiedVia = nfcUid ? 'nfc_uid' : 'epc';
    return respondByCertificateId({
      req,
      res,
      certificateId,
      verifiedVia,
      identity: { nfcUid: nfcUid || null, epc: epc || null },
      organizationId: resolvedOrgId
    });
  } catch (e) {
    if (e?.message === 'epc_inactive_missing_batch_meta') {
      return res.error(
        'EPC certification is not active yet. Please fill in Batch Number and Swiftlet House Number first.',
        409
      );
    }
    const msg = e?.message === 'db_timeout' ? 'Service temporarily unavailable' : 'Service unavailable';
    return res.error(msg, 503);
  }
});

module.exports = router;
