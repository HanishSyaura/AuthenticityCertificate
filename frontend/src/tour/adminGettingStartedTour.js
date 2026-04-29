export function getAdminGettingStartedTourSteps(t) {
  return [
    {
      selector: '[data-tour="nav-guide"]',
      title: t('gettingStarted'),
      body: t('gettingStartedSubtitle')
    },
    {
      selector: '[data-tour="nav-records"]',
      title: t('productModule'),
      body: t('recordsSubtitle')
    },
    {
      selector: '[data-tour="nav-epc"]',
      title: t('epc'),
      body: t('guideStepBatchesBody')
    },
    {
      selector: '[data-tour="nav-certificates"]',
      title: t('certificateList'),
      body: t('certTplSubheading')
    },
    {
      selector: '[data-tour="nav-cms"]',
      title: t('cmsLanding'),
      body: t('cmsSubheading')
    },
    {
      selector: '[data-tour="nav-settings"]',
      title: t('settings'),
      body: t('systemSettingsHint')
    }
  ];
}
