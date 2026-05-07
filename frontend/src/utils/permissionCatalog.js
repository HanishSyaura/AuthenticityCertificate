export const PERMISSION_GROUPS = [
  {
    id: 'system',
    titleKey: 'permGroupSystem',
    keys: ['*']
  },
  {
    id: 'users',
    titleKey: 'permGroupUsersRoles',
    keys: ['users.manage', 'access.manage']
  },
  {
    id: 'products',
    titleKey: 'permGroupProductsBatches',
    keys: ['products.read', 'products.write', 'categories.read', 'categories.write']
  },
  {
    id: 'certificates',
    titleKey: 'permGroupCertificates',
    keys: ['certificates.read', 'certificates.write', 'templates.read', 'templates.write', 'uploads.write']
  },
  {
    id: 'epc',
    titleKey: 'permGroupEpc',
    keys: [
      'epc.batch.create',
      'epc.batch.view',
      'epc.scan.access',
      'epc.certificate.view',
      'epc.export.xlsx',
      'epc.encoding',
      'epc.sequence.reset',
      'epc.delete',
      'epc.production.access',
      'epc.override'
    ]
  },
  {
    id: 'content',
    titleKey: 'permGroupContent',
    keys: ['cms.read', 'cms.write', 'cms.publish', 'cms.meta.write']
  },
  {
    id: 'settings',
    titleKey: 'permGroupSettings',
    keys: ['settings.read', 'settings.write']
  }
];

export const VISIBLE_PERMISSION_KEYS = new Set(PERMISSION_GROUPS.flatMap((g) => g.keys));
