ALTER TABLE `MediaAsset`
  ADD COLUMN `processingStatus` VARCHAR(32) NOT NULL DEFAULT 'ready',
  ADD COLUMN `processingError` VARCHAR(191) NULL,
  ADD COLUMN `posterUrl` VARCHAR(191) NULL,
  ADD COLUMN `processedAt` DATETIME(3) NULL,
  ADD COLUMN `processingJobId` VARCHAR(191) NULL;

