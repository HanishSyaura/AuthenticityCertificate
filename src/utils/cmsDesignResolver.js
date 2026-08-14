/**
 * Resolves the effective CmsDesign (landing page design bundle) ID
 * for a Certificate + Product pairing using the 3-TIER FALLBACK chain:
 *   Tier 1 : Certificate.cmsDesignId          (per-cert override - HIGHEST PRIORITY)
 *   Tier 2 : Product.cmsCertificateDesignId   (product cert-only design)
 *   Tier 3 : Product.cmsDesignId              (product main landing design)
 *   Fallback: null (caller should handle legacy single-CmsPage or default group)
 *
 * This utility is shared between certificate.service.getCertificateDetails()
 * and public.routes.js verify flow to prevent code duplication / drift bugs.
 */
function resolveEffectiveCmsDesignId({ certCmsDesignId, productCmsCertificateDesignId, productCmsDesignId } = {}) {
  const certTier = certCmsDesignId != null ? Number(certCmsDesignId) : NaN;
  if (Number.isFinite(certTier) && certTier > 0) return certTier;

  const certProdTier = productCmsCertificateDesignId != null ? Number(productCmsCertificateDesignId) : NaN;
  if (Number.isFinite(certProdTier) && certProdTier > 0) return certProdTier;

  const prodTier = productCmsDesignId != null ? Number(productCmsDesignId) : NaN;
  if (Number.isFinite(prodTier) && prodTier > 0) return prodTier;

  return null;
}

/**
 * Convenience wrapper that accepts a cert + product object directly (as returned by Prisma).
 */
function resolveEffectiveCmsDesignIdFromEntities({ cert, product } = {}) {
  return resolveEffectiveCmsDesignId({
    certCmsDesignId: cert?.cmsDesignId,
    productCmsCertificateDesignId: product?.cmsCertificateDesignId,
    productCmsDesignId: product?.cmsDesignId
  });
}

/**
 * Last-resort legacy single CmsPage fallback chain (no bundle / multi-page support).
 *   cert.cmsPage → product.cmsCertificatePage → product.cmsPage
 *
 * Used when NO CmsDesign is resolved and we need a single page to render.
 * Returns the CmsPage object or null.
 */
function resolveLegacySingleCmsPage({ certCmsPage, productCmsCertificatePage, productCmsPage } = {}) {
  return certCmsPage && certCmsPage.id
    ? certCmsPage
    : productCmsCertificatePage && productCmsCertificatePage.id
      ? productCmsCertificatePage
      : productCmsPage && productCmsPage.id
        ? productCmsPage
        : null;
}

module.exports = {
  resolveEffectiveCmsDesignId,
  resolveEffectiveCmsDesignIdFromEntities,
  resolveLegacySingleCmsPage
};
