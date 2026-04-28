const certificateService = require('../certificate/certificate.service');

async function verifyCertificate(req, res) {
  try {
    const { id } = req.params;
    const cert = await certificateService.getCertificateDetails(id);

    if (!cert) {
      return res.error('Certificate not found', 404);
    }

    // Prepare public response
    const publicData = {
      certificateId: cert.certificateId,
      type: cert.type,
      status: cert.status,
      issuedAt: cert.createdAt,
      product: {
        name: cert.batch.product.name,
        code: cert.batch.product.code
      },
      batch: {
        batchNo: cert.batch.batchNo
      },
      // Include CMS Layout if the product has a linked page
      layout: cert.batch.product.cmsPage?.layout?.layoutJson || null
    };

    res.success(publicData, 'Certificate verified');
  } catch (error) {
    res.error(error.message);
  }
}

module.exports = {
  verifyCertificate
};
