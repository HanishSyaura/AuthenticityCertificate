export function getProductModuleTourSteps() {
  return [
    {
      selector: '[data-tour="records-header"]',
      title: 'Product Module',
      body: 'This page manages Categories and Products. Recommended flow: create Categories (only if needed), then create Products under the correct Category. We will walk through both.',
      action: { type: 'navigate', to: '/admin/records', options: { replace: false } }
    },
    {
      selector: '[data-tour="records-tabs"]',
      title: 'Products & Categories tabs',
      body: 'This tab container switches between Products and Categories. Categories are used for grouping and selection, while Products are what you will later generate EPC batches for.'
    },
    {
      selector: '[data-tour="records-tab-categories"]',
      title: 'Go to Categories',
      body: 'Start with Categories. You only need to create new Categories when you have new product groupings.',
      action: { type: 'records.setTab', tab: 'categories' }
    },
    {
      selector: '[data-tour="records-search-categories"]',
      title: 'Search categories',
      body: 'Use this search box to quickly find Categories by name or code before creating a new one.'
    },
    {
      selector: '[data-tour="records-add-category"]',
      title: 'Add Category',
      body: 'Click here to open the Create Category form.',
      action: { type: 'records.openCreateCategory' }
    },
    {
      selector: '[data-tour="records-category-modal"]',
      title: 'Create Category form',
      body: 'Fill in the required fields, then click Create. If you are just learning, you can click Cancel to exit without saving anything.'
    },
    {
      selector: '[data-tour="records-category-name"]',
      title: 'Category Name',
      body: 'Enter a readable category name (example: “Beverages”). This is what users see in lists.',
      focus: true
    },
    {
      selector: '[data-tour="records-category-code"]',
      title: 'Category Code',
      body: 'Enter a short unique code (example: “BEV”). This is used for filtering and selection.',
      focus: true
    },
    {
      selector: '[data-tour="records-category-status"]',
      title: 'Category Status',
      body: 'Keep it Active so it can be selected when creating products. Inactive categories are hidden in most pickers.'
    },
    {
      selector: '[data-tour="records-category-create"]',
      title: 'Create Category',
      body: 'Click Create to save this category. If you do not want to save, click Cancel. Then press Next here to continue.'
    },
    {
      selector: '[data-tour="records-category-modal"]',
      title: 'Continue',
      body: 'Next we will switch to Products.',
      action: { type: 'records.closeModals' }
    },
    {
      selector: '[data-tour="records-tab-products"]',
      title: 'Go back to Products',
      body: 'Now create a Product under the correct Category.',
      action: { type: 'records.setTab', tab: 'products' }
    },
    {
      selector: '[data-tour="records-search-products"]',
      title: 'Search products',
      body: 'Use this search box to find products by SKU, name, or code. Use filters to narrow down the list.'
    },
    {
      selector: '[data-tour="records-products-table"]',
      title: 'Products table',
      body: 'This table lists Products. Click a row to open Product details. Use the checkboxes to bulk select, deactivate, or delete.'
    },
    {
      selector: '[data-tour="records-create-product"]',
      title: 'Create Product',
      body: 'Click here to open the Create Product form.',
      action: { type: 'records.openCreateProduct' }
    },
    {
      selector: '[data-tour="records-product-modal"]',
      title: 'Create Product form',
      body: 'Fill in SKU, Name, Product Code, and Category. Then click Create to save. Keep Status Active if this product will be used for EPC generation.'
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
      body: 'Enter a short product code (example: “TEA500”). This should be stable and easy to reference.',
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
      body: 'Keep it Active so it appears in EPC batch creation. Set Inactive to hide it from normal operations.'
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
      body: 'Product is ready. Next step is to prepare Certificate Templates and then generate EPC batches.',
      action: { type: 'records.closeModals' }
    }
  ];
}
