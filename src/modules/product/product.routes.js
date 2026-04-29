const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

// Protect all product/batch routes
router.use(verifyToken);
router.use(attachOrganization);
router.use(requireRole(['super_admin', 'admin']));
router.use(requireOrganization);

router.post('/', auditAction('CREATE_PRODUCT', { targetType: 'product' }), productController.createProduct);
router.patch(
  '/:id',
  auditAction('UPDATE_PRODUCT', { targetType: 'product', getTargetId: (req) => req.params.id }),
  productController.updateProduct
);
router.post(
  '/:id/deactivate',
  auditAction('DEACTIVATE_PRODUCT', { targetType: 'product', getTargetId: (req) => req.params.id }),
  productController.deactivateProduct
);
router.get('/', productController.getAllProducts);

router.post('/batches', auditAction('CREATE_BATCH', { targetType: 'batch' }), productController.createBatch);
router.get('/:id/batches', productController.getProductBatches);

module.exports = router;
