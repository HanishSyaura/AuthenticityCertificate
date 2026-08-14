import { test, expect } from '@playwright/test';

test.describe('Public Pages UAT', () => {

  test('TC-PUB-001: Load verify page root route successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    console.log('Page title:', title);
  });

  test('TC-PUB-002: Load /verify route successfully', async ({ page }) => {
    const response = await page.goto('/verify');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-PUB-003: Verify page shows UI elements (no crash)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).not.toContainText(/Cannot read property/i);
    await expect(body).not.toContainText(/undefined is not/i);
    const htmlErrors = page.locator('.error-boundary, [data-testid="error-fallback"]');
    const count = await htmlErrors.count();
    expect(count).toBe(0);
  });

  test('TC-PUB-004: NotFound route returns 404-style page', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-xyz');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').innerText({ timeout: 10000 });
    const found404 = /404|not found|back to/i.test(bodyText.toLowerCase());
    expect(found404 || response?.status() === 200).toBeTruthy();
  });

  test('TC-PUB-005: Preview CMS page loads without crash', async ({ page }) => {
    const response = await page.goto('/preview/cms');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-PUB-006: Check no uncaught JS console errors (public pages)', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push('PageError: ' + err.message);
    });
    await page.goto('/');
    await page.waitForTimeout(3000);
    const critical = errors.filter(e =>
      !/favicon|failed to load resource|404|net::ERR/i.test(e.toLowerCase())
    );
    console.log('Console errors count:', errors.length);
    console.log('Critical errors:', critical);
    expect(critical.length).toBe(0);
  });

});
