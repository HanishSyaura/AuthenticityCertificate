-- =====================================================
-- DIAGNOSTIC: Investigate MySQL errno 121 (Duplicate key)
-- Run these queries one by one in your MySQL client
-- (phpMyAdmin, HeidiSQL, MySQL Workbench, or mysql CLI)
-- =====================================================

-- 1) List ALL tables — look for leftover temp/shadow tables
--    (any table starting with _prisma_ or _copy_ is a leftover from failed Prisma push)
SHOW TABLES;

-- 2) Find any duplicate constraint names across the whole database
--    (any row with cnt > 1 = DUPLICATE / PROBLEM!)
SELECT CONSTRAINT_NAME, COUNT(*) as cnt,
       GROUP_CONCAT(TABLE_NAME ORDER BY TABLE_NAME SEPARATOR ', ') as attached_to_tables
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
GROUP BY CONSTRAINT_NAME
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- 3) Show every FOREIGN KEY constraint with its table + referenced table
--    Look for duplicate names and any FK on shadow/temp tables
SELECT
  tc.CONSTRAINT_NAME,
  tc.TABLE_NAME,
  kcu.COLUMN_NAME,
  kcu.REFERENCED_TABLE_NAME,
  kcu.REFERENCED_COLUMN_NAME,
  tc.CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS tc
JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
 AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
  AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
  AND (tc.CONSTRAINT_NAME LIKE 'Product_%'
    OR tc.CONSTRAINT_NAME LIKE 'Certificate_%'
    OR tc.CONSTRAINT_NAME LIKE 'Cms%'
    OR tc.TABLE_NAME LIKE '_prisma_%'
    OR tc.TABLE_NAME LIKE '_copy_%')
ORDER BY tc.CONSTRAINT_NAME, tc.TABLE_NAME;

-- 4) List ALL constraints on the Product table (current, if it still exists)
SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Product'
ORDER BY CONSTRAINT_NAME;
