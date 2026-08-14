const certificateService = require('../certificate/certificate.service');

async function verifyCertificate(req, res) {
  try {
    const { id } = req.params;
    const cert = await certificateService.getCertificateDetails(id);

    if (!cert) {
      return res.error('Certificate not found', 404);
    }

    // ================================================================
    // NEW 3-TIER DESIGN FALLBACK + COMPOSE MULTIPLE INNER PAGES INTO 1 LAYOUT
    //   Tier 1 : cert.cmsDesignId
    //   Tier 2 : cert.batch.product.cmsCertificateDesignId
    //   Tier 3 : cert.batch.product.cmsDesignId
    //
    // We use cert.cmsPages which is already the resolved bundle's inner pages array
    // (see certificateService.getCertificateDetails). If empty we fall back to
    // legacy single-page cmsPage/cmsCertificatePage/cmsPage hierarchies.
    // ================================================================
    const product = cert.batch?.product ?? null;
    let composedLayout = null;

    // Helper: extract layout JSON from a single CmsPage row (prefer published, then draft)
    const extractPageLayout = (p) => {
      if (!p) return null;
      if (Array.isArray(p?.publishedVersion?.layoutJson)) return p.publishedVersion.layoutJson;
      if (Array.isArray(p?.layout?.layoutJson)) return p.layout.layoutJson;
      return null;
    };

    if (Array.isArray(cert.cmsPages) && cert.cmsPages.length) {
      const layoutsArr = cert.cmsPages
        .slice()
        .sort((a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0))
        .map((p, i) => ({ id: p?.id ?? i, effectiveLayout: extractPageLayout(p) }))
        .filter((o) => Array.isArray(o.effectiveLayout) && o.effectiveLayout.length > 0);
      // Simpler compose: concat each page's blocks sequentially without coordinate shift
      composedLayout = layoutsArr.flatMap((o) => o.effectiveLayout);
    }

    // Legacy 1-page fallback priority (kept for backward-compat when no bundle pages exist)
    let effectiveLayout = composedLayout;
    if (!Array.isArray(effectiveLayout) || effectiveLayout.length === 0) {
      effectiveLayout = extractPageLayout(cert?.cmsPage)
        ?? extractPageLayout(product?.cmsCertificatePage)
        ?? extractPageLayout(product?.cmsPage)
        ?? null;
    }

    // Prepare public response
    const publicData = {
      certificateId: cert.certificateId,
      type: cert.type,
      status: cert.status,
      issuedAt: cert.createdAt,
      product: product
        ? {
            name: product.name,
            code: product.code,
            cmsEffectiveDesignId: cert?.cmsEffectiveDesignId ?? product?.cmsDesignId ?? null,
            cmsEffectiveSource: cert?.cmsEffectiveSource ?? null
          }
        : null,
      batch: {
        batchNo: cert.batch?.batchNo ?? null
      },
      // Include CMS Layout — either multi-page composed (NEW) or single-page legacy fallback
      layout: effectiveLayout,
      // Expose full pages array for future client-side page tabs/navigation
      cmsPages:
        Array.isArray(cert.cmsPages) && cert.cmsPages.length
          ? cert.cmsPages.map((p) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              kind: p.kind,
              sortOrder: p.sortOrder,
              description: p.description ?? null
            }))
          : [],
      cmsEffectiveDesignId: cert?.cmsEffectiveDesignId ?? null,
      cmsEffectiveSource: cert?.cmsEffectiveSource ?? null
    };

    res.success(publicData, 'Certificate verified');
  } catch (error) {
    res.error(error.message);
  }
}

module.exports = {
  verifyCertificate
};
