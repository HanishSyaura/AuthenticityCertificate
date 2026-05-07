export function getProductLinksTourSteps() {
  return [
    {
      selector: '[data-tour="record-detail-links-card"]',
      title: 'Link Certificate Template',
      body: 'This panel controls which Certificate Template and Landing Page will be used for this product.'
    },
    {
      selector: '[data-tour="record-detail-cert-template"]',
      title: 'Certificate Template',
      body: 'Select the correct Certificate Template for this product. This is important before EPC batch generation.'
    },
    {
      selector: '[data-tour="record-detail-open-certificates"]',
      title: 'Open Certificate Module',
      body: 'Use this shortcut if you need to create or edit a certificate template first.'
    },
    {
      selector: '[data-tour="record-detail-cms-landing"]',
      title: 'CMS Landing (optional)',
      body: 'Select a landing page if your verification flow uses CMS landing pages.'
    },
    {
      selector: '[data-tour="record-detail-open-cms"]',
      title: 'Open CMS Module',
      body: 'Use this shortcut if you need to create or edit a landing page first.'
    },
    {
      selector: '[data-tour="record-detail-save"]',
      title: 'Save',
      body: 'Click Save to apply the selected links to this product.'
    }
  ];
}

