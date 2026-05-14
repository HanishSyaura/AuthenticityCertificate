CREATE TABLE `EpcItemDocument` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `organizationId` INT NOT NULL,
  `epcItemId` INT NOT NULL,
  `docType` VARCHAR(191) NOT NULL,
  `mediaUrl` VARCHAR(191) NOT NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `EpcItemDocument_epcItemId_docType_key` (`epcItemId`, `docType`),
  INDEX `EpcItemDocument_organizationId_uploadedAt_idx` (`organizationId`, `uploadedAt`),
  INDEX `EpcItemDocument_epcItemId_idx` (`epcItemId`),

  CONSTRAINT `EpcItemDocument_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EpcItemDocument_epcItemId_fkey` FOREIGN KEY (`epcItemId`) REFERENCES `EpcItem` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
