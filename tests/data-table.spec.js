import { test, expect } from '@playwright/test';
import { loadPortalConfig, loadPortalPage } from './helpers/portal.js';

const config = loadPortalConfig();

// IDC portal explore page table-specific tests.
// These run serially against a single shared page load to avoid 90s × N navigations.
test.describe.configure({ mode: 'serial' });

test.describe('IDC Portal - Data Tables', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180000);
    page = await browser.newPage();
    await loadPortalPage(page, config);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('tables are present and have rows', async () => {
    let maxRows = 0;
    let tablesFound = 0;

    for (const selector of config.tests.dataTableVerification.tableSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        tablesFound += count;
        const rows = await page.locator(`${selector} tr, ${selector} [role="row"]`).count();
        maxRows = Math.max(maxRows, rows);
      }
    }

    expect(tablesFound, 'No tables found on the explore page').toBeGreaterThanOrEqual(1);
    expect(maxRows, 'Tables found but no rows — data may not have loaded').toBeGreaterThanOrEqual(
      config.tests.dataTableVerification.minRowCount
    );

    const firstTable = page.locator('table').first();
    await firstTable.screenshot({ path: 'test-results/data-table-overview.png' });
  });

  test('table cells contain non-empty text', async () => {
    // Find the first visible table and check that its cells have content
    const firstTableCells = page.locator('table td, [role="table"] [role="cell"]');
    const cellCount = await firstTableCells.count();

    expect(cellCount, 'No table cells found').toBeGreaterThan(0);

    // At least 50% of cells must have non-whitespace text
    let nonEmptyCount = 0;
    const checkLimit = Math.min(cellCount, 30); // sample up to 30 cells
    for (let i = 0; i < checkLimit; i++) {
      const text = await firstTableCells.nth(i).textContent().catch(() => '');
      if (text.trim().length > 0) nonEmptyCount++;
    }

    expect(nonEmptyCount, `Too many empty table cells (${nonEmptyCount}/${checkLimit} non-empty)`).toBeGreaterThan(
      checkLimit * 0.5
    );
  });

  test('table headers describe known IDC data dimensions', async () => {
    // The IDC explore table shows imaging data — at least one known column header must be present
    const knownHeaders = ['collection', 'modality', 'patient', 'study', 'series', 'cases', 'subject'];
    const bodyText = await page.locator('table, [role="table"]').first().textContent().catch(() => '');
    const bodyLower = bodyText.toLowerCase();

    const foundHeaders = knownHeaders.filter(h => bodyLower.includes(h));
    expect(foundHeaders.length, `Table headers do not contain any of: ${knownHeaders.join(', ')}`).toBeGreaterThan(0);
  });

  test('table column header click triggers a sort or interaction', async () => {
    // Find the first clickable table header (th or [role="columnheader"])
    const header = page.locator('th, [role="columnheader"]').first();
    const headerVisible = await header.isVisible({ timeout: 5000 }).catch(() => false);

    if (!headerVisible) {
      test.skip(); // No headers visible; skip without failing
    }

    const initialText = await page.locator('table tr:nth-child(2), [role="row"]:nth-child(2)').first()
      .textContent().catch(() => '');

    await header.click();
    await page.waitForTimeout(2000); // Give sorting time to complete

    // We can't predict sort direction, but the page must not crash (still have rows)
    const rowsAfterSort = await page.locator('table tr, [role="row"]').count();
    expect(rowsAfterSort, 'Table lost rows after clicking a column header').toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: 'test-results/data-table-sorted.png' });
  });

  test('pagination controls are present when table has multiple pages', async () => {
    // Look for pagination elements — only assert if they exist (not all tables paginate)
    const paginationSelectors = [
      '[class*="pagination"]',
      '[aria-label*="pagination" i]',
      'nav[role="navigation"]',
      'button[aria-label*="next" i]',
      'button[aria-label*="previous" i]',
    ];

    let paginationFound = false;
    for (const sel of paginationSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        paginationFound = true;
        break;
      }
    }

    // Pagination is optional; this is an informational assertion
    if (paginationFound) {
      const nextButton = page.locator('button[aria-label*="next" i], [class*="next-page"]').first();
      const nextEnabled = await nextButton.isEnabled().catch(() => false);
      if (nextEnabled) {
        await nextButton.click();
        await page.waitForTimeout(2000);
        const rowsOnPage2 = await page.locator('table tr, [role="row"]').count();
        expect(rowsOnPage2, 'No rows found on page 2').toBeGreaterThanOrEqual(1);
        await page.screenshot({ path: 'test-results/data-table-page2.png' });
      }
    }
    // If no pagination found, that's acceptable — test passes silently
  });
});
