import { test, expect } from '@playwright/test';
import {
  loadPortalConfig,
  loadPortalPage,
  loadReferenceResults,
  setupNetworkMonitoring,
} from './helpers/portal.js';

const config = loadPortalConfig();
const baseline = loadReferenceResults();

// Tolerance thresholds for regression detection
const ELEMENT_COUNT_TOLERANCE = 0.30; // ±30% change triggers failure
const CONTENT_LENGTH_TOLERANCE = 0.50; // ±50% change triggers failure (content varies more)
const KEYWORD_TOLERANCE = 0;           // all baseline keywords must still be present

/**
 * Returns true if `current` is within `tolerance` (fraction) of `baseline`.
 */
function withinTolerance(current, baseline, tolerance) {
  if (baseline === 0) return current === 0;
  const ratio = Math.abs(current - baseline) / baseline;
  return ratio <= tolerance;
}

test.describe.configure({ mode: 'serial' });

test.describe('IDC Portal - Regression Against Baseline', () => {
  let page;
  let current;

  test.beforeAll(async ({ browser }) => {
    if (!baseline) {
      // No baseline to compare against; regression tests cannot run.
      // Generate a baseline by running the main test suite first (npm test).
      return;
    }

    test.setTimeout(180000);
    page = await browser.newPage();
    const { requests, failedRequests } = setupNetworkMonitoring(page);
    await loadPortalPage(page, config);

    const bodyText = await page.locator('body').textContent();

    current = {
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
      },
      testResults: {
        hasFilterPanel: await page.locator('[class*="filter"], [id*="filter"]').count() > 0,
        hasTables: await page.locator('table').count() > 0,
        hasCart: bodyText.toLowerCase().includes('cart'),
        hasCohorts: bodyText.toLowerCase().includes('cohort'),
        hasCollections: bodyText.toLowerCase().includes('collection'),
      },
    };
  });

  test.afterAll(async () => {
    await page?.close();
  });

  // Helper to skip all tests when no baseline is available
  function requireBaseline() {
    if (!baseline || !current) {
      test.skip(
        true,
        'No reference baseline found. Run the main test suite first to generate test-results/reference-results.json.'
      );
    }
  }

  test('content length is within tolerance of baseline', async () => {
    requireBaseline();
    const ok = withinTolerance(current.contentLength, baseline.contentLength, CONTENT_LENGTH_TOLERANCE);
    expect(ok,
      `Content length changed significantly: baseline=${baseline.contentLength}, current=${current.contentLength} (tolerance ±${CONTENT_LENGTH_TOLERANCE * 100}%)`
    ).toBeTruthy();
  });

  test('all baseline keywords are still present on the page', async () => {
    requireBaseline();
    const missingFromBaseline = baseline.foundKeywords.filter(
      k => !current.foundKeywords.includes(k)
    );
    expect(missingFromBaseline,
      `Keywords present in baseline but missing now: ${missingFromBaseline.join(', ')}`
    ).toHaveLength(KEYWORD_TOLERANCE);
  });

  test('button count is within tolerance of baseline', async () => {
    requireBaseline();
    const ok = withinTolerance(current.elementCounts.buttons, baseline.elementCounts.buttons, ELEMENT_COUNT_TOLERANCE);
    expect(ok,
      `Button count regression: baseline=${baseline.elementCounts.buttons}, current=${current.elementCounts.buttons}`
    ).toBeTruthy();
  });

  test('link count is within tolerance of baseline', async () => {
    requireBaseline();
    const ok = withinTolerance(current.elementCounts.links, baseline.elementCounts.links, ELEMENT_COUNT_TOLERANCE);
    expect(ok,
      `Link count regression: baseline=${baseline.elementCounts.links}, current=${current.elementCounts.links}`
    ).toBeTruthy();
  });

  test('table count matches baseline', async () => {
    requireBaseline();
    // Tables are structural; allow only ±1 change before flagging
    const diff = Math.abs(current.elementCounts.tables - baseline.elementCounts.tables);
    expect(diff,
      `Table count changed: baseline=${baseline.elementCounts.tables}, current=${current.elementCounts.tables}`
    ).toBeLessThanOrEqual(1);
  });

  test('key features present in baseline are still present', async () => {
    requireBaseline();
    const featureKeys = ['hasFilterPanel', 'hasTables', 'hasCart', 'hasCohorts', 'hasCollections'];
    const regressions = featureKeys.filter(
      k => baseline.testResults[k] === true && current.testResults[k] === false
    );
    expect(regressions,
      `Features were present in baseline but are now gone: ${regressions.join(', ')}`
    ).toHaveLength(0);
  });

  test('network requests are within expected range', async () => {
    requireBaseline();
    // Rather than comparing to baseline (which may be 0 if captured on a shared page),
    // assert that the current page makes a sane number of requests: between 5 and 300.
    expect(current.networkRequests.total,
      `Unexpectedly few network requests: ${current.networkRequests.total} — page may not have loaded`
    ).toBeGreaterThanOrEqual(5);
    expect(current.networkRequests.total,
      `Unexpectedly many network requests: ${current.networkRequests.total} — possible request loop`
    ).toBeLessThan(300);
  });
});
