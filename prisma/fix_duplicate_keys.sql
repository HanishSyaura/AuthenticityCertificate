-- =====================================================
-- CLEANUP SCRIPT: Fix MySQL errno 121 for Prisma db push
-- Execute these in ORDER (safe → aggressive). Stop at
-- the first step that makes `prisma db push` succeed.
-- =====================================================

-- -------------------------------------------------------------------
-- STEP 1 (SAFEST — usually enough): Drop leftover Prisma shadow tables
-- -------------------------------------------------------------------
-- When Prisma db push fails mid-operation, it leaves behind a
-- "_prisma_new_<Table>" or "_copy_<Table>" table. The FK constraints
-- on that temp table have the SAME names that Prisma tries to create
-- for the real table → ER_DUP_KEYNAME (errno 121).
DROP TABLE IF EXISTS `_prisma_new_Product`;
DROP TABLE IF EXISTS `_prisma_new_Certificate`;
DROP TABLE IF EXISTS `_prisma_new_CmsDesign`;
DROP TABLE IF EXISTS `_prisma_new_CmsPage`;
DROP TABLE IF EXISTS `_prisma_new_Batch`;
DROP TABLE IF EXISTS `_prisma_new_EpcBatch`;
DROP TABLE IF EXISTS `_prisma_new_EpcItem`;
DROP TABLE IF EXISTS `_copy_Product`;
DROP TABLE IF EXISTS `_copy_Certificate`;
DROP TABLE IF EXISTS `_copy_CmsDesign`;
DROP TABLE IF EXISTS `_copy_CmsPage`;

-- Also drop any OTHER leftover temp tables matching the pattern
-- (adjust table names if your diagnostic query showed more)
DROP TABLE IF EXISTS `_prisma_migrations`;

-- Now retry `prisma db push`. If it still fails, go to Step 2.

-- -------------------------------------------------------------------
-- STEP 2 (Still safe): Drop FK constraints DIRECTLY from Product
--   (only if Product table currently EXISTS in the DB)
--   Prisma will re-create them during db push anyway.
--   Note: use ALTER TABLE with DROP FOREIGN KEY + constraint name
-- -------------------------------------------------------------------
-- Uncomment and run ONLY IF Product table exists:
--
-- ALTER TABLE `Product` DROP FOREIGN KEY IF EXISTS `Product_organizationId_fkey`;
-- ALTER TABLE `Product` DROP FOREIGN KEY IF EXISTS `Product_organizationId_fk`;
-- ALTER TABLE `Product` DROP FOREIGN KEY IF EXISTS `Product_cmsPageId_fkey`;
-- ALTER TABLE `Product` DROP FOREIGN KEY IF EXISTS `Product_cmsCertificatePageId_fkey`;
-- ALTER TABLE `Product` DROP FOREIGN KEY IF EXISTS `Product_cmsDesignId_fkey`;
-- ALTER TABLE `Product` DROP FOREIGN KEY IF EXISTS `Product_cmsCertificateDesignId_fkey`;
-- ALTER TABLE `Product` DROP FOREIGN KEY IF EXISTS `Product_certificateTemplateId_fkey`;
--
-- ALTER TABLE `Certificate` DROP FOREIGN KEY IF EXISTS `Certificate_organizationId_fkey`;
-- ALTER TABLE `Certificate` DROP FOREIGN KEY IF EXISTS `Certificate_batchId_fkey`;
-- ALTER TABLE `Certificate` DROP FOREIGN KEY IF EXISTS `Certificate_cmsPageId_fkey`;
-- ALTER TABLE `Certificate` DROP FOREIGN KEY IF EXISTS `Certificate_cmsDesignId_fkey`;

-- -------------------------------------------------------------------
-- STEP 3 (If Step 1 & 2 failed): Drop duplicate constraints globally
--   Use diagnostic query #2 to find the actual names.
--   Replace the names below with what your diagnostic found.
--   Syntax: for EACH duplicate entry found on a TEMP table:
--     ALTER TABLE `<problem_table>` DROP FOREIGN KEY `<constraint_name>`;
--   Or simply DROP the entire temp table (recommended):
--     DROP TABLE IF EXISTS `<temp_table_name>`;
-- -------------------------------------------------------------------

-- -------------------------------------------------------------------
-- STEP 4 (Last resort — destructive):
--   Only use this in DEV when data is disposable / backed up.
--   Drops the entire Product table so Prisma can build it cleanly.
--   Uncomment only if you understand the data loss.
-- -------------------------------------------------------------------
--
-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS `Product`;
-- SET FOREIGN_KEY_CHECKS = 1;
--
-- Then retry: npx prisma db push
