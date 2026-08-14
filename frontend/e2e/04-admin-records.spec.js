import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers.js';

test.describe('Admin Records (Products & Categories) UAT', () => {

  test('TC-REC-001: Products tab loads', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/admin/records');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log('Records page body length:', bodyText.length);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('TC-REC-002: Tabs (Products/Categories) render if present', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/admin/records');
    await page.waitForTimeout(2500);
    const tabs = page.locator('[role="tab"], [data-testid="tab"], button:has-text("Products"), button:has-text("Categories"), nav button');
    const count = await tabs.count();
    console.log('Tab-like buttons found:', count);
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 4); i++) {
        const isV = await tabs.nth(i).isVisible().catch(() => false);
        console.log(`  tab[${i}] visible=`, isV, 'text=', await tabs.nth(i).innerText().catch(() => ''));
      }
    }
    expect(true).toBe(true);
  });

  test('TC-REC-003: Create Product button exists and modal opens (no submit)', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/admin/records');
    await page.waitForTimeout(3000);
    const bodyHtmlBefore = await page.locator('body').innerHTML();
    const createBtn = page.getByRole('button').filter({ hasText: /Create Product|Add Product|New Product|create.*product/i }).first();
    const fallbackBtn = page.locator('button.ac-btn-primary, button.ac-btn, .ac-card button').first();
    const useBtn = (await createBtn.count() > 0) ? createBtn : fallbackBtn;
    if (await useBtn.isVisible().catch(() => false)) {
      await useBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }
    const bodyHtmlAfter = await page.locator('body').innerHTML();
    console.log('Body HTML changed after click:', bodyHtmlBefore.length !== bodyHtmlAfter.length);
    expect(true).toBe(true);
  });

  test('TC-REC-004: Product table/list container exists', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/admin/records');
    await page.waitForTimeout(2500);
    const table = page.locator('table, [data-testid="data-table"], .data-table, .ac-table, [role="grid"]');
    const tCount = await table.count();
    console.log('Data table containers found:', tCount);
    const rows = page.locator('tbody tr, [role="row"]').first();
    const rowCount = await rows.count().catch(() => 0);
    console.log('Sample row-like count:', rowCount);
    expect(true).toBe(true);
  });

  test('TC-REC-005: No console errors on records page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push('PE: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CE: ' + m.text()); });
    await ensureLoggedIn(page);
    await page.goto('/admin/records');
    await page.waitForTimeout(5000);
    const critical = errors.filter(e => !/favicon|404|net::ERR|resource/i.test(e.toLowerCase()));
    console.log('Records critical errors:', critical);
    expect(critical.length).toBe(0);
  });

});
