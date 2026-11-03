export const PERMISSION_GROUPS = [
  {
    id: 'dashboard',
    title: '1. Dashboard',
    subpages: [
      { id: 'overview', title: 'Overview', keys: ['dashboard.view'] },
    ],
  },
  {
    id: 'master-data',
    title: '2. Master Data',
    subpages: [
      { id: 'products', title: 'Products', keys: ['products.read', 'products.write', 'products.create', 'products.update', 'products.delete', 'products.status.update'] },
      { id: 'categories', title: 'Categories', keys: ['categories.read', 'categories.write', 'categories.create', 'categories.update'] },
      { id: 'customers', title: 'Customers', keys: ['customers.read', 'customers.create', 'customers.update'] },
      { id: 'suppliers', title: 'Suppliers', keys: ['suppliers.read', 'suppliers.create', 'suppliers.update'] },
    ],
  },
  {
    id: 'epc',
    title: '3. EPC Management',
    subpages: [
      { id: 'epc-items', title: 'EPC Items', keys: ['epc.read', 'epc.write', 'epc.delete', 'epc.override'] },
      { id: 'epc-batches', title: 'Batches', keys: ['epc.batch.view', 'epc.batch.create', 'epc.assignment.clear'] },
      { id: 'epc-certificates', title: 'Certificate Assignment', keys: ['epc.certificate.view'] },
      { id: 'epc-import', title: 'Import', keys: ['epc.batch_import.access'] },
      { id: 'epc-fields', title: 'Fields', keys: [] },
      { id: 'epc-production', title: 'Production', keys: ['epc.production.access'] },
      { id: 'epc-encoding', title: 'Encoding & Scanning', keys: ['epc.encoding', 'epc.scan.access'] },
      { id: 'epc-maintenance', title: 'Export & Maintenance', keys: ['epc.export.xlsx', 'epc.sequence.reset', 'epc.cleanup.delete', 'epc.cleanup.delete_all_generated'] },
    ],
  },
  {
    id: 'certificates',
    title: '4. Certificates',
    subpages: [
      { id: 'certificate-identity', title: 'Certificate Identity & Lifecycle', keys: ['certificates.read', 'certificates.write', 'certificates.create', 'certificates.update', 'certificates.assign', 'certificates.reissue', 'certificates.revoke'] },
      { id: 'certificate-templates', title: 'Certificate Templates', keys: ['templates.read', 'templates.write', 'templates.create', 'templates.update', 'templates.delete', 'templates.duplicate'] },
      { id: 'certificate-designer', title: 'Certificate Designer', keys: [] },
    ],
  },
  {
    id: 'cms',
    title: '5. CMS / Landing Page',
    subpages: [
      { id: 'cms-pages', title: 'Pages', keys: ['cms.read', 'cms.write', 'cms.pages.create', 'cms.pages.update', 'cms.pages.delete'] },
      { id: 'cms-design', title: 'Design & Layout', keys: ['cms.design.create', 'cms.design.update', 'cms.design.delete', 'cms.design.duplicate', 'cms.design.import', 'cms.design.export', 'cms.layout.write'] },
      { id: 'cms-publishing', title: 'Publishing & Metadata', keys: ['cms.publish', 'cms.meta.write'] },
    ],
  },
  {
    id: 'users-access',
    title: '6. User & Access Management',
    subpages: [
      { id: 'users', title: 'Users', keys: ['users.manage', 'users.read', 'users.create', 'users.update', 'users.delete', 'users.password.reset'] },
      { id: 'roles-permissions', title: 'Roles & Permissions', keys: ['users.roles.assign', 'access.manage'] },
      { id: 'access-audit', title: 'Access Audit Log', keys: [] },
    ],
  },
  {
    id: 'settings',
    title: '7. Settings',
    subpages: [
      { id: 'organization', title: 'Organization & Branding', keys: ['organizations.read', 'organizations.create', 'organizations.write', 'settings.branding.write'] },
      { id: 'profile', title: 'Profile', keys: ['settings.read', 'settings.write'] },
      { id: 'email', title: 'Email / SMTP', keys: ['settings.email.write', 'settings.email.test'] },
    ],
  },
  {
    id: 'shared-operations',
    title: '8. Shared Operations',
    subpages: [
      { id: 'file-uploads', title: 'File Uploads', keys: ['uploads.read', 'uploads.write', 'uploads.upload', 'uploads.delete'] },
    ],
  },
  {
    id: 'system',
    title: '9. System',
    subpages: [
      { id: 'system-access', title: 'System-level Access', keys: ['*'] },
    ],
  },
];

export const VISIBLE_PERMISSION_KEYS = new Set(
  PERMISSION_GROUPS.flatMap((page) =>
    page.subpages.flatMap((subpage) => subpage.keys)
  )
);
