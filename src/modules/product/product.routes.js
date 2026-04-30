const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

// Protect all product/batch routes
router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'products.read', write: 'products.write' }));

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
router.post(
  '/:id/activate',
  auditAction('ACTIVATE_PRODUCT', { targetType: 'product', getTargetId: (req) => req.params.id }),
  productController.activateProduct
);
router.post(
  '/bulk-delete',
  auditAction('BULK_DELETE_PRODUCT', { targetType: 'product' }),
  productController.deleteProductsBulk
);
router.delete(
  '/:id',
  auditAction('DELETE_PRODUCT', { targetType: 'product', getTargetId: (req) => req.params.id }),
  productController.deleteProduct
);
router.get('/', productController.getAllProducts);

router.post('/batches', auditAction('CREATE_BATCH', { targetType: 'batch' }), productController.createBatch);
router.get('/:id/batches', productController.getProductBatches);

module.exports = router;
