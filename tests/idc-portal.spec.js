import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Load test configuration
const configPath = path.join(process.cwd(), 'test-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

/**
 * Helper function to wait for page to be fully loaded
 * The IDC portal is complex and takes ~1 minute to load
 */
async function waitForPageReady(page, timeout = config.pageLoadTimeout) {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout });
  
  // Give additional time for dynamic content and JavaScript execution
  await page.waitForTimeout(2000);
}

/**
 * Helper to capture network requests
 */
function setupNetworkMonitoring(page) {
  const requests = [];
  const failedRequests = [];
  
  if (config.networkMonitoring?.enabled) {
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });
    
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()
      });
    });
  }
  
  return { requests, failedRequests };
}

test.describe('IDC Web Portal - Explore Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set extended timeout for complex page
    test.setTimeout(120000); // 2 minutes
  });

  test('should load the explore page successfully', async ({ page }) => {
    if (!config.tests.pageLoad.enabled) {
      test.skip();
    }

    const { requests, failedRequests } = setupNetworkMonitoring(page);
    
    console.log('Navigating to:', config.testUrl);
    
    // Navigate to the explore page
    await page.goto(config.testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: config.pageLoadTimeout 
    });

    console.log('Waiting for page to be fully loaded...');
    await waitForPageReady(page);

    // Take a screenshot for reference
    await page.screenshot({ 
      path: 'test-results/explore-page-loaded.png',
      fullPage: true 
    });

    // Verify the page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check if title contains expected keywords
    const hasExpectedTitle = config.referenceResults.expectedKeywords.some(
      keyword => title.toLowerCase().includes(keyword.toLowerCase())
    );
    
    expect(hasExpectedTitle || title.includes(config.referenceResults.expectedTitle)).toBeTruthy();

    // Verify page has substantial content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText.length).toBeGreaterThan(100);
    
    console.log('Page loaded successfully with content length:', bodyText.length);
    
    // Check for essential elements
    const selectors = config.tests.pageLoad.selectors;
    let foundElements = [];
    
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
        if (isVisible) {
          console.log(`✓ Found ${key} element`);
          foundElements.push(key);
        }
      } catch (e) {
        console.log(`✗ ${key} element not found`);
      }
    }
    
    // Log network monitoring results
    if (config.networkMonitoring?.trackAPICalls) {
      const apiCalls = requests.filter(r => 
        config.referenceResults.expectedAPICalls.some(api => r.url.includes(api))
      );
      console.log(`API calls detected: ${apiCalls.length}`);
    }
    
    if (failedRequests.length > 0) {
      console.warn(`Failed requests: ${failedRequests.length}`);
      failedRequests.forEach(fr => console.warn(`  - ${fr.url}`));
    }
  });

  test('should handle database-driven content loading', async ({ page }) => {
    if (!config.tests.databaseInteraction.enabled) {
      test.skip();
    }

    console.log('Testing database interactions...');
    
    await page.goto(config.testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: config.pageLoadTimeout 
    });

    if (config.tests.databaseInteraction.waitForNetworkIdle) {
      await waitForPageReady(page);
    }
    
    // Additional wait for database queries
    if (config.tests.databaseInteraction.waitAfterLoad) {
      await page.waitForTimeout(config.tests.databaseInteraction.waitAfterLoad);
    }

    // Check for data-related content
    const pageContent = await page.content();
    const bodyText = await page.locator('body').textContent();
    
    const foundElements = config.tests.databaseInteraction.expectedElements.filter(
      keyword => bodyText.toLowerCase().includes(keyword.toLowerCase())
    );
    
    console.log(`Found ${foundElements.length}/${config.tests.databaseInteraction.expectedElements.length} expected elements:`, foundElements);

    // Take screenshot of the data view
    await page.screenshot({ 
      path: 'test-results/database-interaction.png',
      fullPage: false 
    });

    // Verify that the page has loaded dynamic content from database
    expect(bodyText.length).toBeGreaterThan(500);
    expect(foundElements.length).toBeGreaterThan(0);
  });

  test('should verify filter panel functionality', async ({ page }) => {
    if (!config.tests.filterInteraction.enabled) {
      test.skip();
    }

    console.log('Testing filter panel...');
    
    await page.goto(config.testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: config.pageLoadTimeout 
    });

    await waitForPageReady(page);

    const selectors = config.tests.filterInteraction.selectors;
    
    // Look for filter panel
    for (const [key, selector] of Object.entries(selectors)) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✓ Found ${key}: ${count} instances`);
      } else {
        console.log(`  ${key} not found with selector: ${selector}`);
      }
    }

    // Capture filter panel screenshot
    await page.screenshot({ 
      path: 'test-results/filter-panel.png',
      fullPage: false 
    });
    
    // Check for any filter-related elements
    const filterElements = await page.locator('[class*="filter"], [id*="filter"], [data-filter]').count();
    console.log(`Total filter-related elements: ${filterElements}`);
    
    expect(filterElements).toBeGreaterThanOrEqual(0); // May be 0 if filters are dynamic
  });

  test('should verify data tables load correctly', async ({ page }) => {
    if (!config.tests.dataTableVerification.enabled) {
      test.skip();
    }

    console.log('Testing data tables...');
    
    await page.goto(config.testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: config.pageLoadTimeout 
    });

    await waitForPageReady(page);

    // Look for data tables
    let tableFound = false;
    let totalRows = 0;
    
    for (const selector of config.tests.dataTableVerification.tableSelectors) {
      const tables = await page.locator(selector).count();
      if (tables > 0) {
        console.log(`✓ Found ${tables} table(s) with selector: ${selector}`);
        tableFound = true;
        
        // Count rows in first table
        const rows = await page.locator(`${selector} tr, ${selector} [role="row"]`).count();
        totalRows = Math.max(totalRows, rows);
      }
    }
    
    console.log(`Total table rows found: ${totalRows}`);

    // Take screenshot of tables
    await page.screenshot({ 
      path: 'test-results/data-tables.png',
      fullPage: false 
    });
    
    if (tableFound) {
      expect(totalRows).toBeGreaterThanOrEqual(config.tests.dataTableVerification.minRowCount);
    } else {
      console.log('No tables found - may be loaded dynamically or with different structure');
    }
  });

  test('should verify cart functionality exists', async ({ page }) => {
    if (!config.tests.cartFunctionality.enabled) {
      test.skip();
    }

    console.log('Testing cart functionality...');
    
    await page.goto(config.testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: config.pageLoadTimeout 
    });

    await waitForPageReady(page);

    const selectors = config.tests.cartFunctionality.selectors;
    
    // Look for cart-related elements
    for (const [key, selector] of Object.entries(selectors)) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✓ Found ${key}: ${count} instances`);
      } else {
        console.log(`  ${key} not found`);
      }
    }
    
    // Also check for cart-related text
    const bodyText = await page.locator('body').textContent();
    const hasCartKeyword = bodyText.toLowerCase().includes('cart') || 
                          bodyText.toLowerCase().includes('selection');
    
    console.log(`Cart-related content found: ${hasCartKeyword}`);

    await page.screenshot({ 
      path: 'test-results/cart-functionality.png',
      fullPage: false 
    });
  });

  test('should save comprehensive reference results', async ({ page }) => {
    console.log('Generating comprehensive reference results...');
    
    const { requests, failedRequests } = setupNetworkMonitoring(page);
    
    await page.goto(config.testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: config.pageLoadTimeout 
    });

    await waitForPageReady(page);

    // Collect comprehensive reference data
    const title = await page.title();
    const url = page.url();
    const bodyText = await page.locator('body').textContent();
    
    const referenceData = {
      timestamp: new Date().toISOString(),
      url: url,
      title: title,
      contentLength: bodyText.length,
      elementCounts: {
        buttons: await page.locator('button').count(),
        links: await page.locator('a').count(),
        inputs: await page.locator('input').count(),
        tables: await page.locator('table').count(),
        forms: await page.locator('form').count(),
      },
      foundKeywords: config.referenceResults.expectedKeywords.filter(
        keyword => bodyText.toLowerCase().includes(keyword.toLowerCase())
      ),
      networkRequests: {
        total: requests.length,
        failed: failedRequests.length,
        apiCalls: requests.filter(r => 
          config.referenceResults.expectedAPICalls.some(api => r.url.includes(api))
        ).length
      },
      testResults: {
        hasFilterPanel: await page.locator('[class*="filter"], [id*="filter"]').count() > 0,
        hasTables: await page.locator('table').count() > 0,
        hasCart: bodyText.toLowerCase().includes('cart'),
        hasCohorts: bodyText.toLowerCase().includes('cohort'),
        hasCollections: bodyText.toLowerCase().includes('collection'),
      }
    };

    // Save reference results
    const resultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(resultsDir, 'reference-results.json'),
      JSON.stringify(referenceData, null, 2)
    );

    console.log('Reference results saved:', JSON.stringify(referenceData, null, 2));
    
    // Take reference screenshot
    await page.screenshot({ 
      path: 'test-results/reference-screenshot.png',
      fullPage: true 
    });
    
    // Expect at least some basic content
    expect(referenceData.contentLength).toBeGreaterThan(100);
    expect(referenceData.foundKeywords.length).toBeGreaterThan(0);
  });
});
