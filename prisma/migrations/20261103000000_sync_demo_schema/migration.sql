-- Add missing CMS and customer fields.
ALTER TABLE `CmsDesign`
ADD COLUMN `logoUrl` VARCHAR(512) NULL;

ALTER TABLE `CmsPage`
ADD COLUMN `description` TEXT NULL;

ALTER TABLE `Customer`
ADD COLUMN `contactNo` VARCHAR(100) NULL;

-- Add optional customer and supplier references to EPC batches.
ALTER TABLE `EpcBatch`
ADD COLUMN `customerId` INTEGER NULL,
ADD COLUMN `supplierId` INTEGER NULL;

-- Add indexes required by the Prisma schema.
CREATE INDEX `EpcBatch_organizationId_customerId_idx`
ON `EpcBatch` (`organizationId`, `customerId`);

CREATE INDEX `EpcBatch_organizationId_supplierId_idx`
ON `EpcBatch` (`organizationId`, `supplierId`);

-- Add nullable relations.
ALTER TABLE `EpcBatch`
ADD CONSTRAINT `EpcBatch_customerId_fkey`
FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EpcBatch`
ADD CONSTRAINT `EpcBatch_supplierId_fkey`
FOREIGN KEY (`supplierId`) REFERENCES `Supplier` (`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
