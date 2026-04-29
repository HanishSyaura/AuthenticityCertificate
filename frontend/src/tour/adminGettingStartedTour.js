export function getAdminGettingStartedTourSteps(t) {
  return [
    {
      selector: '[data-tour="nav-guide"]',
      title: t('gettingStarted'),
      body: t('gettingStartedSubtitle')
    },
    {
      selector: '[data-tour="nav-records"]',
      title: t('records'),
      body: t('recordsSubtitle')
    },
    {
      selector: '[data-tour="nav-epc"]',
      title: t('epc'),
      body: t('epcSubtitle')
    },
    {
      selector: '[data-tour="nav-certificates"]',
      title: t('certificates'),
      body: t('certificatesSubtitle')
    },
    {
      selector: '[data-tour="nav-identities"]',
      title: t('identities'),
      body: t('identitiesSubtitle')
    },
    {
      selector: '[data-tour="nav-cms"]',
      title: t('cmsBuilder'),
      body: t('cmsSubheading')
    },
    {
      selector: '[data-tour="nav-cert-templates"]',
      title: t('certTemplates'),
      body: t('certTplSubheading')
    },
    {
      selector: '[data-tour="nav-analytics"]',
      title: t('analytics'),
      body: t('analyticsSubtitle')
    },
    {
      selector: '[data-tour="nav-integrations"]',
      title: t('integrations'),
      body: t('integrationsSubtitle')
    }
  ];
}

