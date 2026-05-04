const prisma = require('./prisma');

async function tableExists(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
  `;
  const c = Number(rows?.[0]?.c ?? rows?.[0]?.C ?? 0);
  return c > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `;
  const c = Number(rows?.[0]?.c ?? rows?.[0]?.C ?? 0);
  return c > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND INDEX_NAME = ${indexName}
  `;
  const c = Number(rows?.[0]?.c ?? rows?.[0]?.C ?? 0);
  return c > 0;
}

async function resolveProductTableName() {
  const tableName = (await tableExists('Product')) ? 'Product' : (await tableExists('Products')) ? 'Products' : null;
  return tableName;
}

async function resolveCategoryTableName() {
  const tableName = (await tableExists('Category')) ? 'Category' : (await tableExists('Categories')) ? 'Categories' : null;
  return tableName;
}

async function resolveTableName(candidates) {
  for (const name of candidates) {
    if (await tableExists(name)) return name;
  }
  return null;
}

async function ensureColumn(tableName, columnName, addSql, fillSql, modifySql) {
  const exists = await columnExists(tableName, columnName);
  if (exists) return;
  await prisma.$executeRawUnsafe(addSql);
  if (fillSql) await prisma.$executeRawUnsafe(fillSql);
  if (modifySql) await prisma.$executeRawUnsafe(modifySql);
}

async function ensureProductSchemaCompat() {
  const tableName = await resolveProductTableName();
  if (!tableName) return;

  const hasId = await columnExists(tableName, 'id');
  const hasOrg = await columnExists(tableName, 'organizationId');
  const hasCode = await columnExists(tableName, 'code');

  await ensureColumn(
    tableName,
    'sku',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`sku\` VARCHAR(191) NULL`,
    hasCode
      ? `UPDATE \`${tableName}\` SET \`sku\` = \`code\` WHERE \`sku\` IS NULL OR \`sku\` = ''`
      : hasId
        ? `UPDATE \`${tableName}\` SET \`sku\` = CONCAT('SKU-', \`id\`) WHERE \`sku\` IS NULL OR \`sku\` = ''`
        : null,
    `ALTER TABLE \`${tableName}\` MODIFY \`sku\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'category',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`category\` VARCHAR(191) NULL`,
    `UPDATE \`${tableName}\` SET \`category\` = 'general' WHERE \`category\` IS NULL OR \`category\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`category\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'status',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`status\` VARCHAR(191) NULL`,
    `UPDATE \`${tableName}\` SET \`status\` = 'active' WHERE \`status\` IS NULL OR \`status\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`status\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'name',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`name\` VARCHAR(191) NULL`,
    `UPDATE \`${tableName}\` SET \`name\` = 'Unnamed product' WHERE \`name\` IS NULL OR \`name\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`name\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'code',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`code\` VARCHAR(191) NULL`,
    hasId ? `UPDATE \`${tableName}\` SET \`code\` = CONCAT('CODE-', \`id\`) WHERE \`code\` IS NULL OR \`code\` = ''` : null,
    `ALTER TABLE \`${tableName}\` MODIFY \`code\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(tableName, 'remark', `ALTER TABLE \`${tableName}\` ADD COLUMN \`remark\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(tableName, 'origin', `ALTER TABLE \`${tableName}\` ADD COLUMN \`origin\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(tableName, 'description', `ALTER TABLE \`${tableName}\` ADD COLUMN \`description\` TEXT NULL`, null, null);
  await ensureColumn(tableName, 'cmsPageId', `ALTER TABLE \`${tableName}\` ADD COLUMN \`cmsPageId\` INT NULL`, null, null);
  await ensureColumn(
    tableName,
    'cmsCertificatePageId',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`cmsCertificatePageId\` INT NULL`,
    null,
    null
  );
  await ensureColumn(
    tableName,
    'certificateTemplateId',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`certificateTemplateId\` INT NULL`,
    null,
    null
  );

  await ensureColumn(
    tableName,
    'versionNo',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`versionNo\` INT NULL`,
    `UPDATE \`${tableName}\` SET \`versionNo\` = 1 WHERE \`versionNo\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`versionNo\` INT NOT NULL DEFAULT 1`
  );

  await ensureColumn(
    tableName,
    'createdAt',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`createdAt\` DATETIME NULL`,
    `UPDATE \`${tableName}\` SET \`createdAt\` = NOW() WHERE \`createdAt\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  await ensureColumn(
    tableName,
    'updatedAt',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`updatedAt\` DATETIME NULL`,
    `UPDATE \`${tableName}\` SET \`updatedAt\` = NOW() WHERE \`updatedAt\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  await ensureColumn(tableName, 'deletedAt', `ALTER TABLE \`${tableName}\` ADD COLUMN \`deletedAt\` DATETIME NULL`, null, null);

  if (hasOrg) {
    const idxSku = `${tableName}_organizationId_sku_key`;
    const hasIdxSku = await indexExists(tableName, idxSku);
    if (!hasIdxSku) await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxSku}\` ON \`${tableName}\` (\`organizationId\`, \`sku\`)`);

    const idxCode = `${tableName}_organizationId_code_key`;
    const hasIdxCode = await indexExists(tableName, idxCode);
    if (!hasIdxCode) await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxCode}\` ON \`${tableName}\` (\`organizationId\`, \`code\`)`);

    const idxCategory = `${tableName}_organizationId_category_idx`;
    const hasIdxCategory = await indexExists(tableName, idxCategory);
    if (!hasIdxCategory) await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxCategory}\` ON \`${tableName}\` (\`organizationId\`, \`category\`)`);

    const idxStatus = `${tableName}_organizationId_status_idx`;
    const hasIdxStatus = await indexExists(tableName, idxStatus);
    if (!hasIdxStatus) await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxStatus}\` ON \`${tableName}\` (\`organizationId\`, \`status\`)`);
  }
}

async function ensureCategorySchemaCompat() {
  let tableName = await resolveCategoryTableName();

  if (!tableName) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Category\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`code\` VARCHAR(191) NOT NULL,
        \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`deletedAt\` DATETIME NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    tableName = 'Category';
  }

  await ensureColumn(
    tableName,
    'organizationId',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`organizationId\` INT NULL`,
    null,
    `ALTER TABLE \`${tableName}\` MODIFY \`organizationId\` INT NOT NULL`
  );

  await ensureColumn(
    tableName,
    'name',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`name\` VARCHAR(191) NULL`,
    null,
    `ALTER TABLE \`${tableName}\` MODIFY \`name\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'code',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`code\` VARCHAR(191) NULL`,
    null,
    `ALTER TABLE \`${tableName}\` MODIFY \`code\` VARCHAR(191) NOT NULL`
  );

  const hasOrg = await columnExists(tableName, 'organizationId');

  await ensureColumn(
    tableName,
    'isActive',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`isActive\` TINYINT(1) NULL`,
    `UPDATE \`${tableName}\` SET \`isActive\` = 1 WHERE \`isActive\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`isActive\` TINYINT(1) NOT NULL DEFAULT 1`
  );

  await ensureColumn(
    tableName,
    'createdAt',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`createdAt\` DATETIME NULL`,
    `UPDATE \`${tableName}\` SET \`createdAt\` = NOW() WHERE \`createdAt\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  await ensureColumn(
    tableName,
    'updatedAt',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`updatedAt\` DATETIME NULL`,
    `UPDATE \`${tableName}\` SET \`updatedAt\` = NOW() WHERE \`updatedAt\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  await ensureColumn(tableName, 'deletedAt', `ALTER TABLE \`${tableName}\` ADD COLUMN \`deletedAt\` DATETIME NULL`, null, null);

  if (hasOrg) {
    const idxCode = `${tableName}_organizationId_code_key`;
    const hasIdxCode = await indexExists(tableName, idxCode);
    if (!hasIdxCode) await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxCode}\` ON \`${tableName}\` (\`organizationId\`, \`code\`)`);

    const idxActive = `${tableName}_organizationId_isActive_idx`;
    const hasIdxActive = await indexExists(tableName, idxActive);
    if (!hasIdxActive)
      await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxActive}\` ON \`${tableName}\` (\`organizationId\`, \`isActive\`)`);
  }
}

async function ensureCmsPageSchemaCompat() {
  const tableName = await resolveTableName(['CmsPage', 'cmsPage', 'cms_pages']);
  if (!tableName) return;
  await ensureColumn(
    tableName,
    'kind',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`kind\` VARCHAR(32) NULL`,
    `UPDATE \`${tableName}\` SET \`kind\` = 'landing' WHERE \`kind\` IS NULL OR \`kind\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`kind\` VARCHAR(32) NOT NULL DEFAULT 'landing'`
  );
}

async function ensureCertificateTemplateSchemaCompat() {
  const tableName = await resolveTableName(['CertificateTemplate', 'certificateTemplate', 'certificate_templates']);
  if (!tableName) return;
  const hasOrg = await columnExists(tableName, 'organizationId');
  await ensureColumn(tableName, 'placeholders', `ALTER TABLE \`${tableName}\` ADD COLUMN \`placeholders\` JSON NULL`, null, null);
  await ensureColumn(
    tableName,
    'certificateId',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`certificateId\` VARCHAR(191) NULL`,
    `UPDATE \`${tableName}\` SET \`certificateId\` = CONCAT('TPL-', \`id\`) WHERE \`certificateId\` IS NULL OR \`certificateId\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`certificateId\` VARCHAR(191) NOT NULL`
  );
  await ensureColumn(
    tableName,
    'backgroundColor',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`backgroundColor\` VARCHAR(32) NULL`,
    `UPDATE \`${tableName}\` SET \`backgroundColor\` = '#ffffff' WHERE \`backgroundColor\` IS NULL OR \`backgroundColor\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`backgroundColor\` VARCHAR(32) NOT NULL DEFAULT '#ffffff'`
  );
  await ensureColumn(
    tableName,
    'backgroundMode',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`backgroundMode\` VARCHAR(32) NULL`,
    `UPDATE \`${tableName}\` SET \`backgroundMode\` = 'background' WHERE \`backgroundMode\` IS NULL OR \`backgroundMode\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`backgroundMode\` VARCHAR(32) NOT NULL DEFAULT 'background'`
  );
  await ensureColumn(
    tableName,
    'canvasWidth',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`canvasWidth\` INT NULL`,
    `UPDATE \`${tableName}\` SET \`canvasWidth\` = 390 WHERE \`canvasWidth\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`canvasWidth\` INT NOT NULL DEFAULT 390`
  );
  await ensureColumn(
    tableName,
    'canvasHeight',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`canvasHeight\` INT NULL`,
    `UPDATE \`${tableName}\` SET \`canvasHeight\` = 844 WHERE \`canvasHeight\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`canvasHeight\` INT NOT NULL DEFAULT 844`
  );

  if (hasOrg) {
    const idxCertId = `${tableName}_organizationId_certificateId_key`;
    const hasIdxCertId = await indexExists(tableName, idxCertId);
    if (!hasIdxCertId)
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxCertId}\` ON \`${tableName}\` (\`organizationId\`, \`certificateId\`)`);
  }
}

async function ensureEpcSchemaCompat() {
  const hasCorpSequence = await tableExists('CorpSequence');
  if (!hasCorpSequence) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`CorpSequence\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`corpPrefix\` VARCHAR(191) NOT NULL,
        \`lastNo\` BIGINT NOT NULL DEFAULT 0,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const idxUnique = `CorpSequence_organizationId_corpPrefix_key`;
    const hasIdxUnique = await indexExists('CorpSequence', idxUnique);
    if (!hasIdxUnique)
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxUnique}\` ON \`CorpSequence\` (\`organizationId\`, \`corpPrefix\`)`);

    const idxOrg = `CorpSequence_organizationId_idx`;
    const hasIdxOrg = await indexExists('CorpSequence', idxOrg);
    if (!hasIdxOrg) await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrg}\` ON \`CorpSequence\` (\`organizationId\`)`);
  }

  const hasEpcBatch = await tableExists('EpcBatch');
  if (!hasEpcBatch) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`EpcBatch\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`corpPrefix\` VARCHAR(191) NOT NULL,
        \`productId\` INT NOT NULL,
        \`sku\` VARCHAR(191) NOT NULL,
        \`batchName\` VARCHAR(191) NOT NULL,
        \`batchQty\` INT NOT NULL,
        \`remark\` VARCHAR(191) NULL,
        \`certificateId\` VARCHAR(191) NULL,
        \`certificateTemplateId\` INT NULL,
        \`templateData\` JSON NULL,
        \`productionUploadedAt\` DATETIME NULL,
        \`productionDoneAt\` DATETIME NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const idx1 = `EpcBatch_organizationId_createdAt_idx`;
    if (!(await indexExists('EpcBatch', idx1)))
      await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx1}\` ON \`EpcBatch\` (\`organizationId\`, \`createdAt\`)`);

    const idx2 = `EpcBatch_organizationId_corpPrefix_idx`;
    if (!(await indexExists('EpcBatch', idx2)))
      await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx2}\` ON \`EpcBatch\` (\`organizationId\`, \`corpPrefix\`)`);

    const idx3 = `EpcBatch_organizationId_productId_idx`;
    if (!(await indexExists('EpcBatch', idx3)))
      await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx3}\` ON \`EpcBatch\` (\`organizationId\`, \`productId\`)`);
  }

  await ensureColumn(
    'EpcBatch',
    'certificateTemplateId',
    `ALTER TABLE \`EpcBatch\` ADD COLUMN \`certificateTemplateId\` INT NULL`,
    null,
    null
  );
  await ensureColumn(
    'EpcBatch',
    'certificateId',
    `ALTER TABLE \`EpcBatch\` ADD COLUMN \`certificateId\` VARCHAR(191) NULL`,
    null,
    null
  );
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE \`EpcBatch\` b
      JOIN (
        SELECT i.batchId AS batchId, MIN(t.certificateId) AS certificateId, COUNT(DISTINCT t.certificateId) AS c
        FROM \`EpcItem\` i
        JOIN \`TagIdentity\` t
          ON t.organizationId = i.organizationId
         AND t.epc = i.epcCode
         AND t.unassignedAt IS NULL
        GROUP BY i.batchId
      ) x ON x.batchId = b.id
      SET b.certificateId = x.certificateId
      WHERE b.certificateId IS NULL AND x.c = 1
    `);
  } catch {
  }
  await ensureColumn('EpcBatch', 'templateData', `ALTER TABLE \`EpcBatch\` ADD COLUMN \`templateData\` JSON NULL`, null, null);
  await ensureColumn(
    'EpcBatch',
    'productionUploadedAt',
    `ALTER TABLE \`EpcBatch\` ADD COLUMN \`productionUploadedAt\` DATETIME NULL`,
    null,
    null
  );
  await ensureColumn(
    'EpcBatch',
    'productionDoneAt',
    `ALTER TABLE \`EpcBatch\` ADD COLUMN \`productionDoneAt\` DATETIME NULL`,
    null,
    null
  );

  const idxCert = `EpcBatch_organizationId_certificateId_idx`;
  if (!(await indexExists('EpcBatch', idxCert)))
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxCert}\` ON \`EpcBatch\` (\`organizationId\`, \`certificateId\`)`);

  const hasEpcItem = await tableExists('EpcItem');
  if (!hasEpcItem) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`EpcItem\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`batchId\` INT NOT NULL,
        \`epcCode\` VARCHAR(191) NOT NULL,
        \`runningNo\` BIGINT NOT NULL,
        \`netWeight\` VARCHAR(191) NULL,
        \`productionDate\` DATETIME NULL,
        \`caiqNumber\` VARCHAR(191) NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const idxUnique = `EpcItem_organizationId_epcCode_key`;
    if (!(await indexExists('EpcItem', idxUnique)))
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxUnique}\` ON \`EpcItem\` (\`organizationId\`, \`epcCode\`)`);

    const idx1 = `EpcItem_organizationId_createdAt_idx`;
    if (!(await indexExists('EpcItem', idx1)))
      await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx1}\` ON \`EpcItem\` (\`organizationId\`, \`createdAt\`)`);

    const idx2 = `EpcItem_batchId_idx`;
    if (!(await indexExists('EpcItem', idx2))) await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx2}\` ON \`EpcItem\` (\`batchId\`)`);
  }

  await ensureColumn('EpcItem', 'netWeight', `ALTER TABLE \`EpcItem\` ADD COLUMN \`netWeight\` VARCHAR(191) NULL`, null, null);
  await ensureColumn('EpcItem', 'productionDate', `ALTER TABLE \`EpcItem\` ADD COLUMN \`productionDate\` DATETIME NULL`, null, null);
  await ensureColumn('EpcItem', 'caiqNumber', `ALTER TABLE \`EpcItem\` ADD COLUMN \`caiqNumber\` VARCHAR(191) NULL`, null, null);
}

async function ensureOrganizationSettingsSchemaCompat() {
  const hasTable = await tableExists('OrganizationSettings');
  if (!hasTable) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`OrganizationSettings\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`defaultLocale\` VARCHAR(20) NULL,
        \`defaultTimezone\` VARCHAR(64) NULL,
        \`maintenanceMode\` TINYINT(1) NOT NULL DEFAULT 0,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  await ensureColumn(
    'OrganizationSettings',
    'createdAt',
    'ALTER TABLE `OrganizationSettings` ADD COLUMN `createdAt` DATETIME NULL',
    'UPDATE `OrganizationSettings` SET `createdAt` = NOW() WHERE `createdAt` IS NULL',
    'ALTER TABLE `OrganizationSettings` MODIFY `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
  );
  await ensureColumn(
    'OrganizationSettings',
    'updatedAt',
    'ALTER TABLE `OrganizationSettings` ADD COLUMN `updatedAt` DATETIME NULL',
    'UPDATE `OrganizationSettings` SET `updatedAt` = NOW() WHERE `updatedAt` IS NULL',
    'ALTER TABLE `OrganizationSettings` MODIFY `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
  );

  await ensureColumn(
    'OrganizationSettings',
    'logoUrl',
    'ALTER TABLE `OrganizationSettings` ADD COLUMN `logoUrl` VARCHAR(512) NULL',
    null,
    null
  );

  const idx = 'OrganizationSettings_organizationId_key';
  if (!(await indexExists('OrganizationSettings', idx))) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idx}\` ON \`OrganizationSettings\` (\`organizationId\`)`);
  }
}

async function ensureAccessControlSchemaCompat() {
  const hasRole = await tableExists('Role');
  if (!hasRole) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Role\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(191) NOT NULL,
        \`description\` VARCHAR(191) NULL,
        \`isSystem\` TINYINT(1) NOT NULL DEFAULT 0,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`Role_name_key\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  const hasPermission = await tableExists('Permission');
  if (!hasPermission) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Permission\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(191) NOT NULL,
        \`description\` VARCHAR(191) NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`Permission_key_key\` (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  const hasRolePermission = await tableExists('RolePermission');
  if (!hasRolePermission) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`RolePermission\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`roleId\` INT NOT NULL,
        \`permissionId\` INT NOT NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`RolePermission_roleId_permissionId_key\` (\`roleId\`, \`permissionId\`),
        KEY \`RolePermission_permissionId_idx\` (\`permissionId\`),
        CONSTRAINT \`RolePermission_roleId_fkey\` FOREIGN KEY (\`roleId\`) REFERENCES \`Role\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`RolePermission_permissionId_fkey\` FOREIGN KEY (\`permissionId\`) REFERENCES \`Permission\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  const hasUserRole = await tableExists('UserRole');
  if (!hasUserRole) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`UserRole\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`userId\` INT NOT NULL,
        \`roleId\` INT NOT NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UserRole_userId_roleId_key\` (\`userId\`, \`roleId\`),
        KEY \`UserRole_roleId_idx\` (\`roleId\`),
        CONSTRAINT \`UserRole_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`UserRole_roleId_fkey\` FOREIGN KEY (\`roleId\`) REFERENCES \`Role\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  const permissions = [
    ['*', 'Full access'],
    ['users.manage', 'Manage users'],
    ['access.manage', 'Manage roles & permissions'],
    ['products.read', 'Read products & batches'],
    ['products.write', 'Write products & batches'],
    ['categories.read', 'Read categories'],
    ['categories.write', 'Write categories'],
    ['epc.read', 'Read EPC'],
    ['epc.write', 'Write EPC'],
    ['certificates.read', 'Read certificates'],
    ['certificates.write', 'Write certificates'],
    ['templates.read', 'Read templates'],
    ['templates.write', 'Write templates'],
    ['media.read', 'Read media'],
    ['media.write', 'Write media'],
    ['uploads.write', 'Upload files'],
    ['audit.read', 'Read audit logs'],
    ['analytics.read', 'Read analytics'],
    ['fraud.read', 'Read fraud flags'],
    ['fraud.write', 'Write fraud flags'],
    ['integrations.read', 'Read integrations'],
    ['integrations.write', 'Write integrations'],
    ['bulk.read', 'Read bulk jobs'],
    ['bulk.write', 'Execute bulk jobs'],
    ['identities.read', 'Read identities'],
    ['identities.write', 'Write identities'],
    ['organizations.read', 'Read organizations'],
    ['organizations.write', 'Write organizations'],
    ['settings.read', 'Read settings'],
    ['settings.write', 'Write settings'],
    ['cms.read', 'Read CMS'],
    ['cms.write', 'Write CMS'],
    ['cms.publish', 'Publish CMS'],
    ['cms.meta.write', 'Edit CMS meta']
  ];

  for (const [key, description] of permissions) {
    await prisma.$executeRaw`
      INSERT IGNORE INTO \`Permission\` (\`key\`, \`description\`, \`createdAt\`, \`updatedAt\`)
      VALUES (${key}, ${description}, NOW(), NOW())
    `;
  }

  const roles = [
    { name: 'super_admin', description: 'System Super Admin', isSystem: 1 },
    { name: 'admin', description: 'System Admin', isSystem: 1 },
    { name: 'operator', description: 'System Operator', isSystem: 1 }
  ];

  for (const r of roles) {
    await prisma.$executeRaw`
      INSERT IGNORE INTO \`Role\` (\`name\`, \`description\`, \`isSystem\`, \`createdAt\`, \`updatedAt\`)
      VALUES (${r.name}, ${r.description}, ${Number(r.isSystem)}, NOW(), NOW())
    `;
  }

  const rolePerms = {
    super_admin: ['*'],
    admin: [
      'products.read',
      'products.write',
      'categories.read',
      'categories.write',
      'epc.read',
      'epc.write',
      'certificates.read',
      'certificates.write',
      'templates.read',
      'templates.write',
      'media.read',
      'media.write',
      'uploads.write',
      'audit.read',
      'analytics.read',
      'fraud.read',
      'fraud.write',
      'integrations.read',
      'integrations.write',
      'bulk.read',
      'bulk.write',
      'identities.read',
      'identities.write',
      'organizations.read',
      'settings.read',
      'cms.read',
      'cms.write',
      'cms.publish',
      'cms.meta.write'
    ],
    operator: ['bulk.read', 'bulk.write', 'cms.read', 'cms.write']
  };

  for (const [roleName, keys] of Object.entries(rolePerms)) {
    for (const key of keys) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO \`RolePermission\` (\`roleId\`, \`permissionId\`, \`createdAt\`)
        SELECT r.id, p.id, NOW()
        FROM \`Role\` r
        JOIN \`Permission\` p ON p.\`key\` = ${key}
        WHERE r.\`name\` = ${roleName}
      `;
    }
  }

  const hasUserTable = await tableExists('User');
  if (hasUserTable) {
    await prisma.$executeRawUnsafe(`
      INSERT IGNORE INTO \`UserRole\` (\`userId\`, \`roleId\`, \`createdAt\`)
      SELECT u.id, r.id, NOW()
      FROM \`User\` u
      JOIN \`Role\` r ON r.\`name\` = u.\`role\`
      WHERE u.\`deletedAt\` IS NULL
    `);
  }
}

async function applyDbPatches() {
  await ensureProductSchemaCompat();
  await ensureCategorySchemaCompat();
  await ensureCmsPageSchemaCompat();
  await ensureCertificateTemplateSchemaCompat();
  await ensureEpcSchemaCompat();
  await ensureOrganizationSettingsSchemaCompat();
  await ensureAccessControlSchemaCompat();
}

module.exports = { applyDbPatches };
