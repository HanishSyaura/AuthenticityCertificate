export function getProductModuleTourSteps() {
  return [
    {
      selector: '[data-tour="nav-records"]',
      title: 'Product Module',
      body: 'This is where you manage Categories and Products. We will create a Category first, then create a Product.',
      action: { type: 'navigate', to: '/admin/records', options: { replace: false } }
    },
    {
      selector: '[data-tour="records-tabs"]',
      title: 'Products & Categories tabs',
      body: 'Use these tabs to switch between Products and Categories.'
    },
    {
      selector: '[data-tour="records-tab-categories"]',
      title: 'Go to Categories',
      body: 'Start by creating Categories (only if you have new categories).',
      action: { type: 'records.setTab', tab: 'categories' }
    },
    {
      selector: '[data-tour="records-add-category"]',
      title: 'Add Category',
      body: 'Click this button to open the Create Category form.',
      action: { type: 'records.openCreateCategory' }
    },
    {
      selector: '[data-tour="records-category-modal"]',
      title: 'Create Category form',
      body: 'Fill in the required fields, then click Create. If you are just learning, you can click Cancel to exit without saving.'
    },
    {
      selector: '[data-tour="records-category-name"]',
      title: 'Category Name',
      body: 'Enter a readable category name (example: “Beverages”).',
      focus: true
    },
    {
      selector: '[data-tour="records-category-code"]',
      title: 'Category Code',
      body: 'Enter a short unique code (example: “BEV”).',
      focus: true
    },
    {
      selector: '[data-tour="records-category-status"]',
      title: 'Category Status',
      body: 'Keep it Active so it can be selected when creating products.'
    },
    {
      selector: '[data-tour="records-category-create"]',
      title: 'Create Category',
      body: 'Click Create to save this category. If you do not want to save, click Cancel. Then press Next here to continue.'
    },
    {
      selector: '[data-tour="records-category-modal"]',
      title: 'Continue',
      body: 'We will continue to Products next.',
      action: { type: 'records.closeModals' }
    },
    {
      selector: '[data-tour="records-tab-products"]',
      title: 'Go back to Products',
      body: 'Now we will create a Product under the correct category.',
      action: { type: 'records.setTab', tab: 'products' }
    },
    {
      selector: '[data-tour="records-create-product"]',
      title: 'Create Product',
      body: 'Click this button to open the Create Product form.',
      action: { type: 'records.openCreateProduct' }
    },
    {
      selector: '[data-tour="records-product-modal"]',
      title: 'Create Product form',
      body: 'Fill in SKU, Name, Product Code, and Category. Then click Create to save.'
    },
    {
      selector: '[data-tour="records-product-sku"]',
      title: 'SKU',
      body: 'Enter a unique SKU for this product (example: “SKU-TEA-500”).',
      focus: true
    },
    {
      selector: '[data-tour="records-product-name"]',
      title: 'Name',
      body: 'Enter the product name (example: “Green Tea 500ml”).',
      focus: true
    },
    {
      selector: '[data-tour="records-product-code"]',
      title: 'Product Code',
      body: 'Enter a short product code (example: “TEA500”).',
      focus: true
    },
    {
      selector: '[data-tour="records-product-category"]',
      title: 'Category',
      body: 'Select the correct category for this product.'
    },
    {
      selector: '[data-tour="records-product-status"]',
      title: 'Product Status',
      body: 'Keep it Active so it appears in EPC batch creation.'
    },
    {
      selector: '[data-tour="records-product-remark"]',
      title: 'Remark (optional)',
      body: 'Use this for internal notes (not required).'
    },
    {
      selector: '[data-tour="records-product-create"]',
      title: 'Create Product',
      body: 'Click Create to save this product. If you do not want to save, click Cancel. Then press Next here to continue.'
    },
    {
      selector: '[data-tour="records-product-modal"]',
      title: 'Done',
      body: 'Product is ready. Next step is to open the product details and link the correct Certificate Template before EPC generation.',
      action: { type: 'records.closeModals' }
    }
  ];
}
