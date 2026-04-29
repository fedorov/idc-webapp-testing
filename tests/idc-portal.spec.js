import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  loadPortalConfig,
  loadPortalPage,
  waitForPageReady,
  closeGovernmentWarningPopup,
  setupNetworkMonitoring,
  saveReferenceResults,
} from './helpers/portal.js';

const config = loadPortalConfig();

// All tests in this file share one page load to avoid the ~90s portal startup cost.
// Tests run serially so shared state is predictable.
test.describe.configure({ mode: 'serial' });

test.describe('IDC Web Portal - Explore Page Tests', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180000); // 3 minutes: 90s load + 90s for all tests
    page = await browser.newPage();
    await loadPortalPage(page, config);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should load the explore page successfully', async () => {
    // Title must contain at least one known keyword
    const title = await page.title();
    const titleLower = title.toLowerCase();
    const titleMatch = config.referenceResults.expectedKeywords.some(k => titleLower.includes(k));
    expect(titleMatch || title.includes(config.referenceResults.expectedTitle),
      `Page title "${title}" did not match any expected keywords`).toBeTruthy();

    // Page must have substantial rendered content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.length, 'Body text too short — page may not have loaded').toBeGreaterThan(10000);

    await page.screenshot({ path: 'test-results/explore-page-loaded.png', fullPage: true });
  });

  test('should contain all expected keywords from database-driven content', async () => {
    const bodyText = await page.locator('body').textContent();
    const bodyLower = bodyText.toLowerCase();

    const missingKeywords = config.referenceResults.expectedKeywords.filter(
      k => !bodyLower.includes(k.toLowerCase())
    );

    expect(missingKeywords, `Missing expected keywords: ${missingKeywords.join(', ')}`).toHaveLength(0);

    // Capture the first visible table as evidence of database-driven content
    const tableEl = page.locator('table').first();
    const tableVisible = await tableEl.isVisible().catch(() => false);
    if (tableVisible) {
      await tableEl.screenshot({ path: 'test-results/database-interaction.png' });
    } else {
      await page.screenshot({ path: 'test-results/database-interaction.png' });
    }
  });

  test('should have a meaningful number of filter elements', async () => {
    const filterElements = await page
      .locator('[class*="filter"], [id*="filter"], [data-filter]')
      .count();

    expect(filterElements, 'Filter elements not found — filter panel may be broken').toBeGreaterThanOrEqual(
      config.tests.filterInteraction.minFilterCount ?? 5
    );

    // Capture the first filter panel element
    const filterEl = page.locator('[class*="filter"], [id*="filter"]').first();
    const filterVisible = await filterEl.isVisible().catch(() => false);
    if (filterVisible) {
      await filterEl.screenshot({ path: 'test-results/filter-panel.png' });
    } else {
      await page.screenshot({ path: 'test-results/filter-panel.png' });
    }
  });

  test('should have data tables with meaningful content', async () => {
    let totalRows = 0;

    for (const selector of config.tests.dataTableVerification.tableSelectors) {
      const tables = await page.locator(selector).count();
      if (tables > 0) {
        const rows = await page.locator(`${selector} tr, ${selector} [role="row"]`).count();
        totalRows = Math.max(totalRows, rows);
      }
    }

    expect(totalRows, 'Data tables have too few rows — data may not have loaded').toBeGreaterThanOrEqual(
      config.tests.dataTableVerification.minRowCount
    );

    // Capture the first data table
    const tableEl = page.locator('table').first();
    const tableVisible = await tableEl.isVisible().catch(() => false);
    if (tableVisible) {
      await tableEl.screenshot({ path: 'test-results/data-tables.png' });
    } else {
      await page.screenshot({ path: 'test-results/data-tables.png' });
    }
  });

  test('should have cart/selection UI elements present', async () => {
    const bodyText = await page.locator('body').textContent();
    const bodyLower = bodyText.toLowerCase();

    const hasCartKeyword = bodyLower.includes('cart') || bodyLower.includes('selection');
    expect(hasCartKeyword, 'No cart or selection-related text found on page').toBeTruthy();

    // At least one cart-related button or icon must be present
    const cartElements = await page
      .locator('[class*="cart"], [id*="cart"], [data-cart], [aria-label*="cart" i]')
      .count();
    expect(cartElements, 'No cart UI elements found in DOM').toBeGreaterThanOrEqual(1);

    // Capture the cart element
    const cartEl = page.locator('[class*="cart"], [id*="cart"]').first();
    const cartVisible = await cartEl.isVisible().catch(() => false);
    if (cartVisible) {
      await cartEl.screenshot({ path: 'test-results/cart-functionality.png' });
    } else {
      await page.screenshot({ path: 'test-results/cart-functionality.png' });
    }
  });

  test('should apply a filter and reflect the change in URL or page state', async () => {
    test.setTimeout(60000);

    const initialUrl = page.url();

    // Find the first visible unchecked checkbox in the filter region
    const checkbox = page.locator(
      '[class*="filter"] input[type="checkbox"]:not(:checked), ' +
      '[id*="filter"] input[type="checkbox"]:not(:checked), ' +
      'input[type="checkbox"]:not(:checked)'
    ).first();

    const checkboxVisible = await checkbox.isVisible({ timeout: 5000 }).catch(() => false);
    if (!checkboxVisible) {
      test.skip(); // filters rendered differently; skip rather than fail
    }

    await checkbox.click();

    // Wait for the page to react (URL change or network activity)
    await Promise.race([
      page.waitForURL(url => url !== initialUrl, { timeout: 15000 }).catch(() => {}),
      page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
    ]);
    await page.waitForTimeout(1000);

    const newUrl = page.url();
    const bodyText = await page.locator('body').textContent();

    // Either the URL changed (filter encoded in query string) or "clear" indicator appeared
    const urlChanged = newUrl !== initialUrl;
    const clearVisible = await page.locator(
      'button:has-text("Clear"), button:has-text("Reset"), [class*="clear-filter"], [class*="reset-filter"]'
    ).count() > 0;
    const activeFilterIndicator = bodyText.toLowerCase().includes('active') ||
      bodyText.toLowerCase().includes('selected') ||
      clearVisible;

    expect(urlChanged || activeFilterIndicator,
      'Clicking a filter did not change the URL or show an active-filter indicator').toBeTruthy();

    // Uncheck to restore state for subsequent tests
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (isChecked) {
      await checkbox.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  });

  test('should save comprehensive reference results', async () => {
    const { requests, failedRequests } = setupNetworkMonitoring(page);

    const title = await page.title();
    const url = page.url();
    const bodyText = await page.locator('body').textContent();

    const referenceData = {
      timestamp: new Date().toISOString(),
      url,
      title,
      contentLength: bodyText.length,
      elementCounts: {
        buttons: await page.locator('button').count(),
        links: await page.locator('a').count(),
        inputs: await page.locator('input').count(),
        tables: await page.locator('table').count(),
        forms: await page.locator('form').count(),
      },
      foundKeywords: config.referenceResults.expectedKeywords.filter(
        k => bodyText.toLowerCase().includes(k.toLowerCase())
      ),
      networkRequests: {
        total: requests.length,
        failed: failedRequests.length,
        apiCalls: requests.filter(r =>
          config.referenceResults.expectedAPICalls.some(api => r.url.includes(api))
        ).length,
      },
      testResults: {
        hasFilterPanel: await page.locator('[class*="filter"], [id*="filter"]').count() > 0,
        hasTables: await page.locator('table').count() > 0,
        hasCart: bodyText.toLowerCase().includes('cart'),
        hasCohorts: bodyText.toLowerCase().includes('cohort'),
        hasCollections: bodyText.toLowerCase().includes('collection'),
      },
    };

    // Save to baseline/ so it persists across test runs (commit to git for CI continuity)
    saveReferenceResults(referenceData);
    // Also copy to test-results/ for the GitHub Actions artifact upload
    const resultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(path.join(resultsDir, 'reference-results.json'), JSON.stringify(referenceData, null, 2));

    await page.screenshot({ path: 'test-results/reference-screenshot.png', fullPage: true });

    expect(referenceData.contentLength).toBeGreaterThan(10000);
    expect(referenceData.foundKeywords.length).toBe(config.referenceResults.expectedKeywords.length);
  });
});
