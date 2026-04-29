import fs from 'fs';
import path from 'path';

/**
 * Load and return the test configuration, applying any environment variable overrides.
 */
export function loadPortalConfig() {
  const configPath = path.join(process.cwd(), 'test-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.testUrl = process.env.PORTAL_URL || config.testUrl;
  return config;
}

/**
 * Load the saved reference results baseline, or return null if none exists.
 * Stored in baseline/ (not test-results/) so Playwright's run cleanup doesn't erase it.
 */
export function loadReferenceResults() {
  const resultsPath = path.join(process.cwd(), 'baseline', 'reference-results.json');
  if (!fs.existsSync(resultsPath)) return null;
  return JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
}

/**
 * Save reference results to the persistent baseline directory.
 */
export function saveReferenceResults(data) {
  const baselineDir = path.join(process.cwd(), 'baseline');
  if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true });
  fs.writeFileSync(path.join(baselineDir, 'reference-results.json'), JSON.stringify(data, null, 2));
}

/**
 * Wait for the IDC portal page to fully settle (network idle + JS execution buffer).
 * The portal takes ~1 minute to load on first visit.
 */
export async function waitForPageReady(page, timeout = 90000) {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(2000);
}

/**
 * Detect and dismiss the government warning popup (#gov_warning) if it appears.
 * Returns true if the popup was found and closed, false otherwise.
 */
export async function closeGovernmentWarningPopup(page) {
  try {
    const govWarning = page.locator('#gov_warning');
    const isVisible = await govWarning.isVisible({ timeout: 10000 }).catch(() => false);

    if (!isVisible) return false;

    const okButtonSelectors = [
      '#gov_warning button:has-text("OK")',
      '#gov_warning button:has-text("I Agree")',
      '#gov_warning button:has-text("Accept")',
      '#gov_warning button:has-text("Continue")',
      '#gov_warning button[type="button"]',
      '#gov_warning .btn',
      '#gov_warning button',
    ];

    for (const selector of okButtonSelectors) {
      const button = page.locator(selector).first();
      const buttonVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
      if (buttonVisible) {
        await button.click();
        await page.waitForSelector('#gov_warning', { state: 'hidden', timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(2000);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Attach request/failure listeners to a page. Call before navigation.
 * Returns arrays that are populated as requests occur.
 */
export function setupNetworkMonitoring(page) {
  const requests = [];
  const failedRequests = [];

  page.on('request', request => {
    requests.push({ url: request.url(), method: request.method(), resourceType: request.resourceType() });
  });
  page.on('requestfailed', request => {
    failedRequests.push({ url: request.url(), failure: request.failure() });
  });

  return { requests, failedRequests };
}

/**
 * Navigate to the portal URL and fully wait for the page to be ready,
 * then close the government popup. Suitable for use in beforeAll.
 */
export async function loadPortalPage(page, config) {
  await page.goto(config.testUrl, {
    waitUntil: 'domcontentloaded',
    timeout: config.pageLoadTimeout,
  });
  await waitForPageReady(page, config.pageLoadTimeout);
  await closeGovernmentWarningPopup(page);
}
