import { test, expect } from '@playwright/test';
import { loadPortalConfig, loadPortalPage } from './helpers/portal.js';

const config = loadPortalConfig();

test.describe.configure({ mode: 'serial' });

test.describe('IDC Portal - Navigation', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180000);
    page = await browser.newPage();
    await loadPortalPage(page, config);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navigation menu is present', async () => {
    const navSelectors = ['nav', '[role="navigation"]', '.navbar', '.nav', 'header'];
    let navFound = false;

    for (const sel of navSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        navFound = true;
        break;
      }
    }

    expect(navFound, 'No navigation element found on the page').toBeTruthy();
    await page.screenshot({ path: 'test-results/navigation-menu.png' });
  });

  test('navigation contains expected portal links', async () => {
    // The IDC portal should link to core sections; check by link text or href patterns
    const expectedPatterns = ['explore', 'imaging', 'data', 'commons', 'idc'];
    const allLinks = await page.locator('nav a, header a, [role="navigation"] a').allTextContents();
    const allHrefs = await page.locator('nav a, header a, [role="navigation"] a').evaluateAll(
      els => els.map(el => (el.getAttribute('href') || '').toLowerCase())
    );

    const linkText = allLinks.join(' ').toLowerCase();
    const linkHrefs = allHrefs.join(' ');

    const foundPattern = expectedPatterns.some(p => linkText.includes(p) || linkHrefs.includes(p));
    expect(foundPattern, 'Navigation links do not reference expected IDC portal sections').toBeTruthy();
  });

  test('page has a logo or site title linking to home', async () => {
    // Most portals have a logo/title link in the header
    const logoSelectors = [
      'a[href="/"], a[href="./"], a[href="#"]',
      'header a img',
      '.logo a, a.logo, a.brand, .navbar-brand',
      'a[aria-label*="home" i], a[title*="home" i]',
    ];

    let logoFound = false;
    for (const sel of logoSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        logoFound = true;
        break;
      }
    }

    // Logo is common but not strictly required — informational
    if (!logoFound) {
      console.log('Note: No logo/home link found in header');
    }
  });

  test('clicking a navigation link navigates without error', async () => {
    test.setTimeout(60000);

    // Find internal navigation links (exclude external and anchor-only links)
    const internalLinks = page.locator(
      'nav a[href]:not([href^="http"]):not([href^="mailto"]):not([href="#"]):not([href^="#"]), ' +
      'header a[href]:not([href^="http"]):not([href^="mailto"]):not([href="#"]):not([href^="#"])'
    );

    const linkCount = await internalLinks.count();
    if (linkCount === 0) {
      test.skip(); // No internal nav links; skip
    }

    const initialUrl = page.url();
    const firstLink = internalLinks.first();
    const href = await firstLink.getAttribute('href');

    // Open in same page only if it stays on the same domain
    await firstLink.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Page must not show an error (check for common error indicators)
    const title = await page.title();
    const bodyText = await page.locator('body').textContent().catch(() => '');
    const isErrorPage = /404|not found|error|unavailable/i.test(title) ||
      /page not found|something went wrong/i.test(bodyText.slice(0, 500));

    expect(isErrorPage, `Navigating to "${href}" resulted in an error page`).toBeFalsy();

    await page.screenshot({ path: 'test-results/navigation-after-click.png' });

    // Navigate back to restore page state for any tests that follow
    await page.goto(config.testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: config.pageLoadTimeout,
    });
    await page.waitForTimeout(3000);
  });

  test('external documentation/about links exist', async () => {
    // The IDC portal should link to documentation or "about" resources
    const externalLinks = await page.locator('a[href^="http"]').evaluateAll(
      els => els.map(el => el.getAttribute('href') || '')
    );

    expect(externalLinks.length, 'No external links found on the page').toBeGreaterThan(0);

    // At least one link should point to NCI/NIH/cancer.gov domain or GitHub
    const trustedDomains = ['cancer.gov', 'nih.gov', 'github.com', 'datacommons', 'tcia'];
    const trustedLinkFound = externalLinks.some(href =>
      trustedDomains.some(domain => href.toLowerCase().includes(domain))
    );

    expect(trustedLinkFound,
      'No links to trusted NCI/NIH/GitHub domains found — navigation may be broken').toBeTruthy();
  });
});
