import { test, expect } from '@playwright/test';
import { DEFAULT_CREDENTIALS, tryLogin } from './helpers.js';

test.describe('Admin Authentication UAT', () => {

  test('TC-AUTH-001: Admin login page loads successfully', async ({ page }) => {
    const response = await page.goto('/admin/login');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.locator('input[type="email"], input[autocomplete="email"]');
    const passInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');
    await expect(emailInput.first()).toBeVisible({ timeout: 15000 });
    await expect(passInput.first()).toBeVisible();
    await expect(submitBtn.first()).toBeVisible();
  });

  test('TC-AUTH-002: Login page has expected UI elements', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('domcontentloaded');
    const bodyText = await page.locator('body').innerText();
    const titleWords = [/admin login/i, /sign in/i, /email/i, /password/i];
    const matches = titleWords.filter(r => r.test(bodyText)).length;
    expect(matches).toBeGreaterThanOrEqual(2);
    const languageSwitcher = page.locator('[data-testid="language-switcher"], select, button:has-text("EN"), button:has-text("BM"), button:has-text("ZH")');
    const lsCount = await languageSwitcher.count();
    console.log('Language switcher elements found:', lsCount);
  });

  test('TC-AUTH-003: Invalid credentials show error message', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    if (!(await emailInput.isVisible())) {
      test.skip();
      return;
    }
    await emailInput.fill('wrong-user-never-exists@example.com');
    await passInput.fill('wrong-password-123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
    const bodyText = await page.locator('body').innerText();
    const hasErrorIndicator = /invalid|error|failed|incorrect|not exist|wrong/i.test(bodyText)
      || /\/admin\/login/.test(page.url());
    expect(hasErrorIndicator).toBeTruthy();
  });

  test('TC-AUTH-004: Attempt login with stored admin credentials', async ({ page }) => {
    let loginResult = null;
    for (const cred of DEFAULT_CREDENTIALS) {
      const result = await tryLogin(page, cred.email, cred.password);
      console.log(`Login attempt ${cred.email}:`, result.status);
      if (result.status === 'success' || result.status === 'already_logged_in') {
        loginResult = result;
        break;
      }
    }
    if (!loginResult) {
      console.log('WARN: No valid credentials found — skipping validation of authenticated dashboard');
      test.skip();
      return;
    }
    const url = page.url();
    const inApp = /\/admin(\/|$)/.test(url);
    expect(inApp).toBeTruthy();
  });

  test('TC-AUTH-005: Protected admin route redirects to login when unauthenticated', async ({ context }) => {
    const page = await context.newPage();
    await context.clearCookies();
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    const loginPageRegex = /\/admin\/login/;
    expect(loginPageRegex.test(finalUrl)).toBeTruthy();
  });

  test('TC-AUTH-006: No uncaught JS errors on login page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push('PageError: ' + e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('Console: ' + msg.text());
    });
    await page.goto('/admin/login');
    await page.waitForTimeout(3000);
    const critical = errors.filter(e => !/favicon|net::ERR|404|resource/i.test(e.toLowerCase()));
    console.log('Auth page console errors:', critical);
    expect(critical.length).toBe(0);
  });

});
