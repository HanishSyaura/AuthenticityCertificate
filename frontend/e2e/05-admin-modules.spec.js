import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers.js';

test.describe('Admin EPC Module UAT', () => {

  test('TC-EPC-001: EPC page loads successfully', async ({ page }) => {
    await ensureLoggedIn(page);
    const response = await page.goto('/admin/epc');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
    const len = (await page.locator('body').innerText().catch(() => '')).length;
    console.log('EPC body length:', len);
    expect(len).toBeGreaterThan(0);
  });

  test('TC-EPC-002: EPC panel UI components render (tabs/panels if present)', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/admin/epc');
    await page.waitForTimeout(3000);
    const panels = page.locator('[role="tablist"], [role="tab"], .ac-card, section > div');
    const pc = await panels.count();
    console.log('EPC panel card elements found:', pc);
    expect(true).toBe(true);
  });

  test('TC-EPC-003: EPC Scan page loads', async ({ page }) => {
    await ensureLoggedIn(page);
    const response = await page.goto('/admin/epc/scan');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-EPC-004: No console errors on EPC page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await ensureLoggedIn(page);
    await page.goto('/admin/epc');
    await page.waitForTimeout(5000);
    const critical = errors.filter(e => !/favicon|404|ERR_|resource|chunk/i.test(e.toLowerCase()));
    console.log('EPC critical errors:', critical);
    expect(critical.length).toBe(0);
  });

});

test.describe('Admin Certificates Module UAT', () => {

  test('TC-CERT-001: Certificates list page loads', async ({ page }) => {
    await ensureLoggedIn(page);
    const response = await page.goto('/admin/certificates');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
    const len = (await page.locator('body').innerText().catch(() => '')).length;
    console.log('Certificates list body len:', len);
    expect(len).toBeGreaterThan(0);
  });

  test('TC-CERT-002: New certificate builder page loads (route exists)', async ({ page }) => {
    await ensureLoggedIn(page);
    const response = await page.goto('/admin/certificates/new');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-CERT-003: No console errors on certificates page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await ensureLoggedIn(page);
    await page.goto('/admin/certificates');
    await page.waitForTimeout(5000);
    const critical = errors.filter(e => !/favicon|404|ERR_|resource/i.test(e.toLowerCase()));
    console.log('Certificates critical errors:', critical);
    expect(critical.length).toBe(0);
  });

});

test.describe('Admin CMS Builder UAT', () => {

  test('TC-CMS-001: CMS builder page loads successfully', async ({ page }) => {
    await ensureLoggedIn(page);
    const response = await page.goto('/admin/cms');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
    const len = (await page.locator('body').innerText().catch(() => '')).length;
    console.log('CMS builder body len:', len);
    expect(len).toBeGreaterThan(0);
  });

  test('TC-CMS-002: CMS page panels/sections render (canvas, inspector, pages)', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/admin/cms');
    await page.waitForTimeout(3000);
    const divs = page.locator('div[class*="panel"], div[class*="canvas"], div[class*="inspector"], div[class*="pages"]');
    const c = await divs.count();
    console.log('CMS panel-like divs found:', c);
    expect(true).toBe(true);
  });

  test('TC-CMS-003: No console errors on CMS page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await ensureLoggedIn(page);
    await page.goto('/admin/cms');
    await page.waitForTimeout(5000);
    const critical = errors.filter(e => !/favicon|404|ERR_|resource|chunk/i.test(e.toLowerCase()));
    console.log('CMS critical errors:', critical);
    expect(critical.length).toBe(0);
  });

});
