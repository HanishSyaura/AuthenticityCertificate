import { getProductModuleTourSteps } from './productModuleTour';

export function getAdminGettingStartedTourSteps(t) {
  return [
    {
      selector: '[data-tour="dashboard-start-tour"]',
      title: t('gettingStarted'),
      body: t('tourAdminStartBody'),
      action: { type: 'navigate', to: '/admin/dashboard', options: { replace: false } }
    },
    {
      selector: '[data-tour="dashboard-verify"]',
      title: t('publicVerifyPage'),
      body: t('tourAdminVerifyBody'),
      action: { type: 'navigate', to: '/admin/dashboard', options: { replace: false } }
    },
    ...getProductModuleTourSteps(),
    {
      selector: '[data-tour="epc-header"]',
      title: t('epc'),
      body: t('tourAdminEpcHeaderBody'),
      action: { type: 'navigate', to: '/admin/epc', options: { replace: false } }
    },
    {
      selector: '[data-tour="epc-generate"]',
      title: t('tourAdminEpcGenerateTitle'),
      body: t('tourAdminEpcGenerateBody'),
      action: { type: 'navigate', to: '/admin/epc', options: { replace: false } }
    },
    {
      selector: '[data-tour="cert-header"]',
      title: t('certificateList'),
      body: t('tourAdminCertHeaderBody'),
      action: { type: 'navigate', to: '/admin/certificates', options: { replace: false } }
    },
    {
      selector: '[data-tour="cert-add"]',
      title: t('tourAdminCertCreateTitle'),
      body: t('tourAdminCertCreateBody'),
      action: { type: 'navigate', to: '/admin/certificates', options: { replace: false } }
    },
    {
      selector: '[data-tour="cms-header"]',
      title: t('cmsLanding'),
      body: t('tourAdminCmsHeaderBody'),
      action: { type: 'navigate', to: '/admin/cms', options: { replace: false } }
    },
    {
      selector: '[data-tour="cms-canvas-panel"]',
      title: t('tourAdminCmsCanvasTitle'),
      body: t('tourAdminCmsCanvasBody'),
      action: { type: 'navigate', to: '/admin/cms', options: { replace: false } }
    },
    {
      selector: '[data-tour="cms-inspector-panel"]',
      title: t('tourAdminCmsInspectorTitle'),
      body: t('tourAdminCmsInspectorBody'),
      action: { type: 'navigate', to: '/admin/cms', options: { replace: false } }
    },
    {
      selector: '[data-tour="cms-publish"]',
      title: t('tourAdminCmsPublishTitle'),
      body: t('tourAdminCmsPublishBody'),
      action: { type: 'navigate', to: '/admin/cms', options: { replace: false } }
    }
  ];
}
