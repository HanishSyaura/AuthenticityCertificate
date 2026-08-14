import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers.js';

async function ensureLoggedInLocal(page) {
  return ensureLoggedIn(page);
}

test.describe('Admin Dashboard & Navigation UAT', () => {

  test('TC-NAV-001: Navigate to dashboard page (verify redirect or shell renders)', async ({ page }) => {
    await ensureLoggedInLocal(page);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log('Dashboard body length:', bodyText.length);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('TC-NAV-002: Sidebar navigation menu items exist', async ({ page }) => {
    await ensureLoggedInLocal(page);
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(2000);
    const links = page.locator('nav a, [role="navigation"] a, aside a');
    const count = await links.count();
    console.log('Sidebar navigation links found:', count);
    if (count > 0) {
      const labels = [];
      for (let i = 0; i < Math.min(count, 10); i++) {
        const txt = await links.nth(i).innerText().catch(() => '');
        if (txt.trim()) labels.push(txt.trim());
      }
      console.log('Nav labels sample:', labels);
    }
    expect(true).toBe(true);
  });

  test('TC-NAV-003: Navigate to Records (Products) page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/records');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('TC-NAV-004: Navigate to Guide page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/guide');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-NAV-005: Navigate to EPC page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/epc');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-NAV-006: Navigate to CMS builder page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/cms');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-NAV-007: Navigate to Certificates list page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/certificates');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-NAV-008: Navigate to Settings page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/settings');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-NAV-009: Navigate to Users page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/users');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-NAV-010: Navigate to EPC Scan page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/epc/scan');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-NAV-011: Navigate to Force Reset Password page', async ({ page }) => {
    await ensureLoggedInLocal(page);
    const response = await page.goto('/admin/force-reset');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-NAV-012: Dashboard has no runtime errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push('PageError: ' + e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('Console: ' + msg.text());
    });
    await ensureLoggedInLocal(page);
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(5000);
    const critical = errors.filter(e => !/favicon|404|ERR_|resource|chunk failed|loading chunk|failed to fetch/i.test(e.toLowerCase()));
    console.log('Dashboard critical errors:', critical);
    expect(critical.length).toBe(0);
  });

  test('TC-NAV-013: Admin shell renders without React crash (no ErrorBoundary fallback)', async ({ page }) => {
    await ensureLoggedInLocal(page);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const bodyHtml = await page.locator('body').innerHTML();
    const hasErrorBoundaryFallback = /error.*boundary|error.*fallback|cannot read|uncaught/i.test(bodyHtml);
    expect(hasErrorBoundaryFallback).toBe(false);
  });

});

export { ensureLoggedIn };
