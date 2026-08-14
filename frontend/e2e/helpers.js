export const DEFAULT_CREDENTIALS = [
  { email: 'admin@example.com', password: 'admin123' },
  { email: 'superadmin@example.com', password: 'admin123' },
  { email: 'admin@damadingjiyanwo.com', password: 'admin123' },
  { email: 'admin@company.com', password: 'password123' },
];

export async function tryLogin(page, email, password) {
  await page.goto('/admin/login');
  await page.waitForLoadState('domcontentloaded');
  const emailInput = page.locator('input[type="email"], input[placeholder*="admin@"], input[autocomplete="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  if (!(await emailInput.isVisible()) || !(await passInput.isVisible())) {
    return { status: 'already_logged_in' };
  }
  await emailInput.fill(email);
  await passInput.fill(password);
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(3000);
  const currentUrl = page.url();
  const redirectedToDashboard = !/\/admin\/login/.test(currentUrl);
  const errorBox = page.locator('.border-red-200, .text-red-700, [role="alert"]').first();
  const hasError = await errorBox.isVisible().catch(() => false);
  if (redirectedToDashboard && !hasError) {
    return { status: 'success', email };
  }
  return { status: 'failed', hasError };
}

export async function ensureLoggedIn(page) {
  for (const cred of DEFAULT_CREDENTIALS) {
    const r = await tryLogin(page, cred.email, cred.password);
    if (r.status === 'success' || r.status === 'already_logged_in') return true;
  }
  return false;
}
