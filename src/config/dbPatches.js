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

async function getColumnInfo(tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
    LIMIT 1
  `;
  return rows?.[0] || null;
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

async function ensureProductSupportingCertificateSchemaCompat() {
  const tableName = 'ProductSupportingCertificate';
  const exists = await tableExists(tableName);
  if (!exists) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`productId\` INT NOT NULL,
        \`sortOrder\` INT NOT NULL DEFAULT 0,
        \`title\` VARCHAR(191) NULL,
        \`certificateTemplateId\` INT NULL,
        \`templateData\` JSON NULL,
        \`mediaUrl\` VARCHAR(2048) NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`deletedAt\` DATETIME NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  await ensureColumn(tableName, 'organizationId', `ALTER TABLE \`${tableName}\` ADD COLUMN \`organizationId\` INT NULL`, null, `ALTER TABLE \`${tableName}\` MODIFY \`organizationId\` INT NOT NULL`);
  await ensureColumn(tableName, 'productId', `ALTER TABLE \`${tableName}\` ADD COLUMN \`productId\` INT NULL`, null, `ALTER TABLE \`${tableName}\` MODIFY \`productId\` INT NOT NULL`);
  await ensureColumn(
    tableName,
    'sortOrder',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`sortOrder\` INT NULL`,
    `UPDATE \`${tableName}\` SET \`sortOrder\` = 0 WHERE \`sortOrder\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`sortOrder\` INT NOT NULL DEFAULT 0`
  );
  await ensureColumn(tableName, 'title', `ALTER TABLE \`${tableName}\` ADD COLUMN \`title\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(tableName, 'certificateTemplateId', `ALTER TABLE \`${tableName}\` ADD COLUMN \`certificateTemplateId\` INT NULL`, null, null);
  await ensureColumn(tableName, 'templateData', `ALTER TABLE \`${tableName}\` ADD COLUMN \`templateData\` JSON NULL`, null, null);
  await ensureColumn(tableName, 'mediaUrl', `ALTER TABLE \`${tableName}\` ADD COLUMN \`mediaUrl\` VARCHAR(2048) NULL`, null, null);

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

  const idx1 = 'ProductSupportingCertificate_org_product_sort_idx';
  if (!(await indexExists(tableName, idx1))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx1}\` ON \`${tableName}\` (\`organizationId\`, \`productId\`, \`sortOrder\`)`);
  }
  const idx2 = 'ProductSupportingCertificate_org_product_idx';
  if (!(await indexExists(tableName, idx2))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx2}\` ON \`${tableName}\` (\`organizationId\`, \`productId\`)`);
  }
  const idx3 = 'ProductSupportingCertificate_org_template_idx';
  if (!(await indexExists(tableName, idx3))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx3}\` ON \`${tableName}\` (\`organizationId\`, \`certificateTemplateId\`)`);
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
  await ensureColumn(
    tableName,
    'sortOrder',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`sortOrder\` INT NULL`,
    `UPDATE \`${tableName}\` SET \`sortOrder\` = COALESCE(\`sortOrder\`, \`id\`)`,
    `ALTER TABLE \`${tableName}\` MODIFY \`sortOrder\` INT NOT NULL DEFAULT 0`
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
    'templateType',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`templateType\` VARCHAR(32) NULL`,
    `UPDATE \`${tableName}\`
      SET \`templateType\` = CASE
        WHEN LOWER(\`certificateId\`) LIKE '%auth%' OR LOWER(\`name\`) LIKE '%authentic%' THEN 'auth'
        ELSE 'supporting'
      END
      WHERE \`templateType\` IS NULL OR \`templateType\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`templateType\` VARCHAR(32) NOT NULL DEFAULT 'auth'`
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

    const idxType = `${tableName}_organizationId_templateType_idx`;
    if (!(await indexExists(tableName, idxType))) {
      await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxType}\` ON \`${tableName}\` (\`organizationId\`, \`templateType\`)`);
    }
  }
}

async function ensureCertificateTemplateTranslationSchemaCompat() {
  const tableName =
    (await resolveTableName([
      'CertificateTemplateTranslation',
      'certificateTemplateTranslation',
      'certificate_template_translations'
    ])) || 'CertificateTemplateTranslation';
  if (!(await tableExists(tableName))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`templateId\` INT NOT NULL,
        \`language\` VARCHAR(32) NOT NULL,
        \`layoutJson\` JSON NOT NULL,
        \`placeholders\` JSON NULL,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
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
    'templateId',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`templateId\` INT NULL`,
    null,
    `ALTER TABLE \`${tableName}\` MODIFY \`templateId\` INT NOT NULL`
  );
  await ensureColumn(
    tableName,
    'language',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`language\` VARCHAR(32) NULL`,
    null,
    `ALTER TABLE \`${tableName}\` MODIFY \`language\` VARCHAR(32) NOT NULL`
  );
  await ensureColumn(
    tableName,
    'layoutJson',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`layoutJson\` JSON NULL`,
    `UPDATE \`${tableName}\` SET \`layoutJson\` = JSON_ARRAY() WHERE \`layoutJson\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`layoutJson\` JSON NOT NULL`
  );
  await ensureColumn(tableName, 'placeholders', `ALTER TABLE \`${tableName}\` ADD COLUMN \`placeholders\` JSON NULL`, null, null);
  await ensureColumn(
    tableName,
    'updatedAt',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`updatedAt\` DATETIME NULL`,
    `UPDATE \`${tableName}\` SET \`updatedAt\` = NOW() WHERE \`updatedAt\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  const idxUnique = `${tableName}_templateId_language_key`;
  if (!(await indexExists(tableName, idxUnique))) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxUnique}\` ON \`${tableName}\` (\`templateId\`, \`language\`)`);
  }

  const idxOrgTemplate = `${tableName}_organizationId_templateId_idx`;
  if (!(await indexExists(tableName, idxOrgTemplate))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrgTemplate}\` ON \`${tableName}\` (\`organizationId\`, \`templateId\`)`);
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
        \`skuCode\` VARCHAR(191) NOT NULL DEFAULT '',
        \`lastNo\` BIGINT NOT NULL DEFAULT 0,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const idxUnique = `CorpSequence_organizationId_corpPrefix_skuCode_key`;
    const hasIdxUnique = await indexExists('CorpSequence', idxUnique);
    if (!hasIdxUnique)
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX \`${idxUnique}\` ON \`CorpSequence\` (\`organizationId\`, \`corpPrefix\`, \`skuCode\`)`
      );

    const idxOrg = `CorpSequence_organizationId_idx`;
    const hasIdxOrg = await indexExists('CorpSequence', idxOrg);
    if (!hasIdxOrg) await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrg}\` ON \`CorpSequence\` (\`organizationId\`)`);
  }
  await ensureColumn(
    'CorpSequence',
    'skuCode',
    'ALTER TABLE `CorpSequence` ADD COLUMN `skuCode` VARCHAR(191) NULL',
    "UPDATE `CorpSequence` SET `skuCode` = '' WHERE `skuCode` IS NULL",
    "ALTER TABLE `CorpSequence` MODIFY `skuCode` VARCHAR(191) NOT NULL DEFAULT ''"
  );
  const oldUnique = `CorpSequence_organizationId_corpPrefix_key`;
  const newUnique = `CorpSequence_organizationId_corpPrefix_skuCode_key`;
  if (!(await indexExists('CorpSequence', newUnique))) {
    if (await indexExists('CorpSequence', oldUnique)) {
      try {
        await prisma.$executeRawUnsafe(`DROP INDEX \`${oldUnique}\` ON \`CorpSequence\``);
      } catch {
      }
    }
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX \`${newUnique}\` ON \`CorpSequence\` (\`organizationId\`, \`corpPrefix\`, \`skuCode\`)`
    );
  }

  const hasCorpMonthSeq = await tableExists('CorpMonthSequence');
  if (!hasCorpMonthSeq) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`CorpMonthSequence\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`corpPrefix\` VARCHAR(191) NOT NULL,
        \`periodKey\` VARCHAR(191) NOT NULL,
        \`lastNo\` BIGINT NOT NULL DEFAULT 0,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
  await ensureColumn(
    'CorpMonthSequence',
    'organizationId',
    'ALTER TABLE `CorpMonthSequence` ADD COLUMN `organizationId` INT NULL',
    'UPDATE `CorpMonthSequence` SET `organizationId` = 0 WHERE `organizationId` IS NULL',
    'ALTER TABLE `CorpMonthSequence` MODIFY `organizationId` INT NOT NULL'
  );
  await ensureColumn(
    'CorpMonthSequence',
    'corpPrefix',
    'ALTER TABLE `CorpMonthSequence` ADD COLUMN `corpPrefix` VARCHAR(191) NULL',
    "UPDATE `CorpMonthSequence` SET `corpPrefix` = '' WHERE `corpPrefix` IS NULL",
    "ALTER TABLE `CorpMonthSequence` MODIFY `corpPrefix` VARCHAR(191) NOT NULL DEFAULT ''"
  );
  await ensureColumn(
    'CorpMonthSequence',
    'periodKey',
    'ALTER TABLE `CorpMonthSequence` ADD COLUMN `periodKey` VARCHAR(191) NULL',
    "UPDATE `CorpMonthSequence` SET `periodKey` = '' WHERE `periodKey` IS NULL",
    "ALTER TABLE `CorpMonthSequence` MODIFY `periodKey` VARCHAR(191) NOT NULL DEFAULT ''"
  );
  await ensureColumn(
    'CorpMonthSequence',
    'lastNo',
    'ALTER TABLE `CorpMonthSequence` ADD COLUMN `lastNo` BIGINT NULL',
    'UPDATE `CorpMonthSequence` SET `lastNo` = 0 WHERE `lastNo` IS NULL',
    'ALTER TABLE `CorpMonthSequence` MODIFY `lastNo` BIGINT NOT NULL DEFAULT 0'
  );
  await ensureColumn(
    'CorpMonthSequence',
    'updatedAt',
    'ALTER TABLE `CorpMonthSequence` ADD COLUMN `updatedAt` DATETIME NULL',
    'UPDATE `CorpMonthSequence` SET `updatedAt` = NOW() WHERE `updatedAt` IS NULL',
    'ALTER TABLE `CorpMonthSequence` MODIFY `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
  );
  const corpMonthUnique = `CorpMonthSequence_organizationId_corpPrefix_periodKey_key`;
  if (!(await indexExists('CorpMonthSequence', corpMonthUnique))) {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX \`${corpMonthUnique}\` ON \`CorpMonthSequence\` (\`organizationId\`, \`corpPrefix\`, \`periodKey\`)`
    );
  }
  const corpMonthIdxOrg = `CorpMonthSequence_organizationId_idx`;
  if (!(await indexExists('CorpMonthSequence', corpMonthIdxOrg))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${corpMonthIdxOrg}\` ON \`CorpMonthSequence\` (\`organizationId\`)`);
  }

  const hasBatchSeq = await tableExists('EpcBatchSequence');
  if (!hasBatchSeq) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`EpcBatchSequence\` (
        \`dateKey\` VARCHAR(8) NOT NULL,
        \`lastNo\` BIGINT NOT NULL DEFAULT 0,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`dateKey\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
  await ensureColumn(
    'EpcBatchSequence',
    'dateKey',
    'ALTER TABLE `EpcBatchSequence` ADD COLUMN `dateKey` VARCHAR(8) NULL',
    null,
    'ALTER TABLE `EpcBatchSequence` MODIFY `dateKey` VARCHAR(8) NOT NULL'
  );
  await ensureColumn(
    'EpcBatchSequence',
    'lastNo',
    'ALTER TABLE `EpcBatchSequence` ADD COLUMN `lastNo` BIGINT NULL',
    'UPDATE `EpcBatchSequence` SET `lastNo` = 0 WHERE `lastNo` IS NULL',
    'ALTER TABLE `EpcBatchSequence` MODIFY `lastNo` BIGINT NOT NULL DEFAULT 0'
  );
  await ensureColumn(
    'EpcBatchSequence',
    'updatedAt',
    'ALTER TABLE `EpcBatchSequence` ADD COLUMN `updatedAt` DATETIME NULL',
    'UPDATE `EpcBatchSequence` SET `updatedAt` = NOW() WHERE `updatedAt` IS NULL',
    'ALTER TABLE `EpcBatchSequence` MODIFY `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
  );

  const hasImportBatchSeq = await tableExists('ImportBatchSequence');
  if (!hasImportBatchSeq) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`ImportBatchSequence\` (
        \`dateKey\` VARCHAR(8) NOT NULL,
        \`lastNo\` BIGINT NOT NULL DEFAULT 0,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`dateKey\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
  await ensureColumn(
    'ImportBatchSequence',
    'dateKey',
    'ALTER TABLE `ImportBatchSequence` ADD COLUMN `dateKey` VARCHAR(8) NULL',
    null,
    'ALTER TABLE `ImportBatchSequence` MODIFY `dateKey` VARCHAR(8) NOT NULL'
  );
  await ensureColumn(
    'ImportBatchSequence',
    'lastNo',
    'ALTER TABLE `ImportBatchSequence` ADD COLUMN `lastNo` BIGINT NULL',
    'UPDATE `ImportBatchSequence` SET `lastNo` = 0 WHERE `lastNo` IS NULL',
    'ALTER TABLE `ImportBatchSequence` MODIFY `lastNo` BIGINT NOT NULL DEFAULT 0'
  );
  await ensureColumn(
    'ImportBatchSequence',
    'updatedAt',
    'ALTER TABLE `ImportBatchSequence` ADD COLUMN `updatedAt` DATETIME NULL',
    'UPDATE `ImportBatchSequence` SET `updatedAt` = NOW() WHERE `updatedAt` IS NULL',
    'ALTER TABLE `ImportBatchSequence` MODIFY `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
  );

  const hasEpcBatch = await tableExists('EpcBatch');
  if (!hasEpcBatch) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`EpcBatch\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`corpPrefix\` VARCHAR(191) NOT NULL,
        \`periodKey\` VARCHAR(191) NULL,
        \`origin\` VARCHAR(191) NOT NULL DEFAULT 'generated',
        \`productId\` INT NULL,
        \`sku\` VARCHAR(191) NULL,
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

  await ensureColumn('EpcBatch', 'periodKey', `ALTER TABLE \`EpcBatch\` ADD COLUMN \`periodKey\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(
    'EpcBatch',
    'origin',
    `ALTER TABLE \`EpcBatch\` ADD COLUMN \`origin\` VARCHAR(191) NULL`,
    `UPDATE \`EpcBatch\` SET \`origin\` = 'generated' WHERE \`origin\` IS NULL OR \`origin\` = ''`,
    `ALTER TABLE \`EpcBatch\` MODIFY \`origin\` VARCHAR(191) NOT NULL DEFAULT 'generated'`
  );
  try {
    const info = await getColumnInfo('EpcBatch', 'productId');
    const isNullable = String(info?.isNullable || '').toUpperCase() === 'YES';
    if (info && !isNullable) await prisma.$executeRawUnsafe('ALTER TABLE `EpcBatch` MODIFY `productId` INT NULL');
  } catch {
  }
  try {
    const info = await getColumnInfo('EpcBatch', 'sku');
    const isNullable = String(info?.isNullable || '').toUpperCase() === 'YES';
    if (info && !isNullable) await prisma.$executeRawUnsafe('ALTER TABLE `EpcBatch` MODIFY `sku` VARCHAR(191) NULL');
  } catch {
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

  const idxOrigin = `EpcBatch_organizationId_origin_idx`;
  if (!(await indexExists('EpcBatch', idxOrigin))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrigin}\` ON \`EpcBatch\` (\`organizationId\`, \`origin\`)`);
  }

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
  await ensureColumn('EpcItem', 'barcode', `ALTER TABLE \`EpcItem\` ADD COLUMN \`barcode\` VARCHAR(191) NULL`, null, null);
  await ensureColumn('EpcItem', 'batchNumber', `ALTER TABLE \`EpcItem\` ADD COLUMN \`batchNumber\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(
    'EpcItem',
    'swiftletHouseNumber',
    `ALTER TABLE \`EpcItem\` ADD COLUMN \`swiftletHouseNumber\` VARCHAR(191) NULL`,
    null,
    null
  );
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
    ['epc.read', 'Read EPC (legacy)'],
    ['epc.write', 'Write EPC (legacy)'],
    ['epc.batch.create', 'EPC Batch Creation'],
    ['epc.batch.view', 'View EPC'],
    ['epc.scan.access', 'Scan input'],
    ['epc.certificate.view', 'View certificate'],
    ['epc.export.xlsx', 'Export XLSX'],
    ['epc.encoding', 'Encoding'],
    ['epc.sequence.reset', 'Reset running number'],
    ['epc.delete', 'Delete EPC'],
    ['epc.cleanup.delete', 'Delete EPC (cleanup related data)'],
    ['epc.cleanup.delete_all_generated', 'Delete all generated EPC (cleanup related data)'],
    ['epc.batch_import.access', 'Batch import access'],
    ['epc.production.access', 'Production orders access'],
    ['epc.override', 'Override production fields'],
    ['certificates.read', 'Read certificates'],
    ['certificates.write', 'Write certificates'],
    ['templates.read', 'Read templates'],
    ['templates.write', 'Write templates'],
    ['uploads.write', 'Upload files'],
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

  for (const [key, description] of permissions) {
    await prisma.$executeRaw`
      UPDATE \`Permission\`
      SET \`description\` = ${description}, \`updatedAt\` = NOW()
      WHERE \`key\` = ${key}
        AND ( \`description\` IS NULL OR \`description\` <> ${description} )
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
      'uploads.write',
      'organizations.read',
      'settings.read',
      'cms.read',
      'cms.write',
      'cms.publish',
      'cms.meta.write'
    ],
    operator: ['cms.read', 'cms.write']
  };

  let totalRolePerms = 0;
  try {
    totalRolePerms = await prisma.rolePermission.count();
  } catch {
    totalRolePerms = 0;
  }

  if (totalRolePerms === 0) {
    for (const [roleName, keys] of Object.entries(rolePerms)) {
      const roleRow = await prisma.role.findUnique({ where: { name: roleName }, select: { id: true } });
      if (!roleRow?.id) continue;

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

async function ensureCertificateSchemaCompat() {
  const tableName = await resolveTableName(['Certificate', 'Certificates']);
  if (!tableName) return;
  const hasBatchId = await columnExists(tableName, 'batchId');
  if (!hasBatchId) return;
  const info = await getColumnInfo(tableName, 'batchId');
  if (!info) return;
  const isNullable = String(info.isNullable || '').toUpperCase() === 'YES';
  if (isNullable) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` MODIFY \`batchId\` INT NULL`);
}

async function ensureCertificateSequenceSchemaCompat() {
  const tableName = 'CertificateSequence';
  const exists = await tableExists(tableName);
  if (!exists) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`dateKey\` VARCHAR(6) NOT NULL,
        \`lastNo\` BIGINT NOT NULL DEFAULT 0,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`dateKey\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  await ensureColumn(
    tableName,
    'dateKey',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`dateKey\` VARCHAR(6) NULL`,
    null,
    `ALTER TABLE \`${tableName}\` MODIFY \`dateKey\` VARCHAR(6) NOT NULL`
  );
  await ensureColumn(
    tableName,
    'lastNo',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`lastNo\` BIGINT NULL`,
    `UPDATE \`${tableName}\` SET \`lastNo\` = 0 WHERE \`lastNo\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`lastNo\` BIGINT NOT NULL DEFAULT 0`
  );
  await ensureColumn(
    tableName,
    'updatedAt',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`updatedAt\` DATETIME NULL`,
    `UPDATE \`${tableName}\` SET \`updatedAt\` = NOW() WHERE \`updatedAt\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
}

async function ensureEpcScanGroupSchemaCompat() {
  const groupTable = 'EpcScanGroup';
  const itemTable = 'EpcScanGroupItem';

  if (!(await tableExists(groupTable))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${groupTable}\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        \`productId\` INT NULL,
        \`createdByEmail\` VARCHAR(191) NULL,
        \`assignedByEmail\` VARCHAR(191) NULL,
        \`assignedAt\` DATETIME NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  await ensureColumn(
    groupTable,
    'organizationId',
    `ALTER TABLE \`${groupTable}\` ADD COLUMN \`organizationId\` INT NULL`,
    `UPDATE \`${groupTable}\` SET \`organizationId\` = 0 WHERE \`organizationId\` IS NULL`,
    `ALTER TABLE \`${groupTable}\` MODIFY \`organizationId\` INT NOT NULL`
  );
  await ensureColumn(
    groupTable,
    'status',
    `ALTER TABLE \`${groupTable}\` ADD COLUMN \`status\` VARCHAR(32) NULL`,
    `UPDATE \`${groupTable}\` SET \`status\` = 'OPEN' WHERE \`status\` IS NULL OR \`status\` = ''`,
    `ALTER TABLE \`${groupTable}\` MODIFY \`status\` VARCHAR(32) NOT NULL DEFAULT 'OPEN'`
  );
  await ensureColumn(groupTable, 'productId', `ALTER TABLE \`${groupTable}\` ADD COLUMN \`productId\` INT NULL`, null, null);
  await ensureColumn(groupTable, 'createdByEmail', `ALTER TABLE \`${groupTable}\` ADD COLUMN \`createdByEmail\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(groupTable, 'assignedByEmail', `ALTER TABLE \`${groupTable}\` ADD COLUMN \`assignedByEmail\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(groupTable, 'assignedAt', `ALTER TABLE \`${groupTable}\` ADD COLUMN \`assignedAt\` DATETIME NULL`, null, null);
  await ensureColumn(
    groupTable,
    'createdAt',
    `ALTER TABLE \`${groupTable}\` ADD COLUMN \`createdAt\` DATETIME NULL`,
    `UPDATE \`${groupTable}\` SET \`createdAt\` = NOW() WHERE \`createdAt\` IS NULL`,
    `ALTER TABLE \`${groupTable}\` MODIFY \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  const idxOrgCreated = `${groupTable}_organizationId_createdAt_idx`;
  if (!(await indexExists(groupTable, idxOrgCreated))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrgCreated}\` ON \`${groupTable}\` (\`organizationId\`, \`createdAt\`)`);
  }
  const idxOrgStatus = `${groupTable}_organizationId_status_idx`;
  if (!(await indexExists(groupTable, idxOrgStatus))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrgStatus}\` ON \`${groupTable}\` (\`organizationId\`, \`status\`)`);
  }
  const idxOrgProduct = `${groupTable}_organizationId_productId_idx`;
  if (!(await indexExists(groupTable, idxOrgProduct))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrgProduct}\` ON \`${groupTable}\` (\`organizationId\`, \`productId\`)`);
  }

  if (!(await tableExists(itemTable))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${itemTable}\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`organizationId\` INT NOT NULL,
        \`scanGroupId\` INT NOT NULL,
        \`epcItemId\` INT NOT NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  await ensureColumn(
    itemTable,
    'organizationId',
    `ALTER TABLE \`${itemTable}\` ADD COLUMN \`organizationId\` INT NULL`,
    `UPDATE \`${itemTable}\` SET \`organizationId\` = 0 WHERE \`organizationId\` IS NULL`,
    `ALTER TABLE \`${itemTable}\` MODIFY \`organizationId\` INT NOT NULL`
  );
  await ensureColumn(itemTable, 'scanGroupId', `ALTER TABLE \`${itemTable}\` ADD COLUMN \`scanGroupId\` INT NULL`, null, `ALTER TABLE \`${itemTable}\` MODIFY \`scanGroupId\` INT NOT NULL`);
  await ensureColumn(itemTable, 'epcItemId', `ALTER TABLE \`${itemTable}\` ADD COLUMN \`epcItemId\` INT NULL`, null, `ALTER TABLE \`${itemTable}\` MODIFY \`epcItemId\` INT NOT NULL`);
  await ensureColumn(
    itemTable,
    'createdAt',
    `ALTER TABLE \`${itemTable}\` ADD COLUMN \`createdAt\` DATETIME NULL`,
    `UPDATE \`${itemTable}\` SET \`createdAt\` = NOW() WHERE \`createdAt\` IS NULL`,
    `ALTER TABLE \`${itemTable}\` MODIFY \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  const uniquePair = `${itemTable}_scanGroupId_epcItemId_key`;
  if (!(await indexExists(itemTable, uniquePair))) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${uniquePair}\` ON \`${itemTable}\` (\`scanGroupId\`, \`epcItemId\`)`);
  }
  const idxOrgGroup = `${itemTable}_organizationId_scanGroupId_idx`;
  if (!(await indexExists(itemTable, idxOrgGroup))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrgGroup}\` ON \`${itemTable}\` (\`organizationId\`, \`scanGroupId\`)`);
  }
  const idxOrgItem = `${itemTable}_organizationId_epcItemId_idx`;
  if (!(await indexExists(itemTable, idxOrgItem))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxOrgItem}\` ON \`${itemTable}\` (\`organizationId\`, \`epcItemId\`)`);
  }
}

async function ensureUserSchemaCompat() {
  const tableName = 'User';
  const exists = await tableExists(tableName);
  if (!exists) return;

  await ensureColumn(
    tableName,
    'mustResetPassword',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`mustResetPassword\` TINYINT(1) NOT NULL DEFAULT 0`,
    null,
    null
  );
}

async function applyDbPatches() {
  await ensureProductSchemaCompat();
  await ensureProductSupportingCertificateSchemaCompat();
  await ensureCategorySchemaCompat();
  await ensureCmsPageSchemaCompat();
  await ensureCertificateTemplateSchemaCompat();
  await ensureCertificateTemplateTranslationSchemaCompat();
  await ensureCertificateSchemaCompat();
  await ensureCertificateSequenceSchemaCompat();
  await ensureEpcSchemaCompat();
  await ensureEpcScanGroupSchemaCompat();
  await ensureOrganizationSettingsSchemaCompat();
  await ensureAccessControlSchemaCompat();
  await ensureUserSchemaCompat();
}

module.exports = { applyDbPatches };
