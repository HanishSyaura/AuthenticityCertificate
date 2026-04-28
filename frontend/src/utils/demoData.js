import { ADMIN_KEYS } from './adminKeys';
import { readJson, writeJson } from './storage';

function makeImage(prompt, size = 'landscape_4_3') {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;
}

export function ensureDemoData() {
  const existingPages = readJson(ADMIN_KEYS.cmsPages, null);
  const existingLayouts = readJson(ADMIN_KEYS.cmsLayouts, null);
  const existingTemplates = readJson(ADMIN_KEYS.certTemplates, null);

  if (!Array.isArray(existingPages) || existingPages.length === 0) {
    const pages = [
      {
        id: 1001,
        name: 'Product Page (Demo)',
        slug: 'produk-demo'
      }
    ];
    writeJson(ADMIN_KEYS.cmsPages, pages);
  }

  const pagesNow = readJson(ADMIN_KEYS.cmsPages, []);
  const firstPageId = pagesNow[0]?.id;

  if ((existingLayouts == null || typeof existingLayouts !== 'object') && firstPageId) {
    const layouts = {
      [String(firstPageId)]: [
        {
          id: 'block-1',
          type: 'text',
          x: 24,
          y: 96,
          w: 560,
          h: 56,
          content: {
            text: 'AUTHENTIC & VERIFIED — Confirmed via NFC'
          }
        },
        {
          id: 'block-2',
          type: 'text',
          x: 24,
          y: 156,
          w: 720,
          h: 70,
          content: {
            text: 'Thank you for supporting genuine products. This page is generated directly from the verification system.'
          }
        },
        {
          id: 'block-3',
          type: 'image',
          x: 24,
          y: 242,
          w: 640,
          h: 360,
          content: {
            url: makeImage('premium bird nest product packaging, Malaysian brand, elegant, dark navy and gold accents, studio lighting')
          }
        },
        {
          id: 'block-4',
          type: 'certificate',
          x: 24,
          y: 626,
          w: 640,
          h: 280
        }
      ]
    };
    writeJson(ADMIN_KEYS.cmsLayouts, layouts);
  }

  if (!Array.isArray(existingTemplates) || existingTemplates.length === 0) {
    const templates = [
      {
        id: 'tpl-demo',
        name: 'Authenticity Certificate (Demo)',
        width: 920,
        height: 640,
        backgroundUrl: makeImage('elegant authenticity certificate background, minimal, gold accent, paper texture, Malaysian premium brand', 'landscape_4_3'),
        fields: [
          { id: 'field-1', path: 'certificateId', label: 'Certificate ID', x: 80, y: 110, w: 300, h: 60 },
          { id: 'field-2', path: 'product.name', label: 'Product', x: 80, y: 190, w: 520, h: 60 },
          { id: 'field-3', path: 'batch.batchNo', label: 'Batch', x: 80, y: 270, w: 300, h: 60 },
          { id: 'field-4', path: 'issuedAt', label: 'Issued', x: 80, y: 350, w: 300, h: 60 },
          { id: 'field-5', path: 'status', label: 'Status', x: 80, y: 430, w: 240, h: 60 }
        ]
      }
    ];
    writeJson(ADMIN_KEYS.certTemplates, templates);
  }
}
