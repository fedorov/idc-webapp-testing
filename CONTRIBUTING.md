# Contributing to IDC Web Portal Testing

Thank you for your interest in contributing to the IDC web portal testing infrastructure! This guide will help you add new tests and improve existing ones.

## Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/fedorov/idc-webapp-testing.git
   cd idc-webapp-testing
   ```

2. **Install dependencies**
   ```bash
   npm install
   npx playwright install chromium
   ```

3. **Run existing tests**
   ```bash
   npm test
   ```

## Adding New Tests

### Test Structure

Tests are located in the `tests/` directory and use Playwright Test framework:

```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('https://testing-portal.canceridc.dev/explore/');
    // Your test code here
    expect(something).toBeTruthy();
  });
});
```

### Creating a New Test File

1. Create a new file in `tests/` directory:
   ```bash
   touch tests/my-feature.spec.js
   ```

2. Follow the naming convention: `<feature-name>.spec.js`

3. Import required modules:
   ```javascript
   import { test, expect } from '@playwright/test';
   import fs from 'fs';
   import path from 'path';
   ```

### Example: Testing a New Feature

Let's say you want to test the collection details page:

```javascript
import { test, expect } from '@playwright/test';

test.describe('Collection Details', () => {
  test('should display collection information', async ({ page }) => {
    // Navigate to a specific collection
    await page.goto('https://testing-portal.canceridc.dev/collections/tcga_gbm');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Verify collection name is displayed
    const heading = await page.locator('h1').textContent();
    expect(heading).toContain('TCGA-GBM');
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/collection-details.png' 
    });
  });
});
```

## Adding Configuration Options

To make tests configurable:

1. **Update `test-config.json`**:
   ```json
   {
     "tests": {
       "myNewTest": {
         "enabled": true,
         "description": "Description of what this tests",
         "customOption": "value"
       }
     }
   }
   ```

2. **Use configuration in test**:
   ```javascript
   import config from '../test-config.json';
   
   test('my test', async ({ page }) => {
     if (!config.tests.myNewTest.enabled) {
       test.skip();
     }
     // Use config.tests.myNewTest.customOption
   });
   ```

## Best Practices

### 1. Wait for Content Properly

❌ **Don't use arbitrary timeouts:**
```javascript
await page.waitForTimeout(5000); // Avoid this
```

✅ **Do wait for specific conditions:**
```javascript
await page.waitForSelector('.data-loaded');
await page.waitForLoadState('networkidle');
```

### 2. Make Tests Resilient

❌ **Don't rely on exact counts:**
```javascript
expect(rowCount).toBe(42); // Will break when data changes
```

✅ **Do check for presence and reasonable ranges:**
```javascript
expect(rowCount).toBeGreaterThan(0);
expect(rowCount).toBeLessThan(10000);
```

### 3. Use Descriptive Test Names

❌ **Don't:**
```javascript
test('test 1', async ({ page }) => { ... });
```

✅ **Do:**
```javascript
test('should display collection list with pagination', async ({ page }) => { ... });
```

### 4. Clean Up After Tests

```javascript
test.afterEach(async ({ page }) => {
  // Clean up any state if needed
});
```

### 5. Handle Errors Gracefully

```javascript
try {
  await page.locator('.optional-element').click({ timeout: 5000 });
} catch (error) {
  console.log('Optional element not found, continuing...');
}
```

## Testing Patterns

### Pattern 1: Testing Page Navigation

```javascript
test('should navigate to cohorts page', async ({ page }) => {
  await page.goto('https://testing-portal.canceridc.dev/');
  
  // Click navigation link
  await page.click('a[href*="cohorts"]');
  
  // Verify navigation
  await expect(page).toHaveURL(/.*cohorts/);
  expect(await page.title()).toContain('Cohorts');
});
```

### Pattern 2: Testing Forms

```javascript
test('should submit search form', async ({ page }) => {
  await page.goto('https://testing-portal.canceridc.dev/explore/');
  
  // Fill form
  await page.fill('input[name="search"]', 'liver');
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Wait for results
  await page.waitForSelector('.search-results');
  
  // Verify results
  const results = await page.locator('.search-results .result-item').count();
  expect(results).toBeGreaterThan(0);
});
```

### Pattern 3: Testing Interactive Elements

```javascript
test('should toggle filter panel', async ({ page }) => {
  await page.goto('https://testing-portal.canceridc.dev/explore/');
  
  // Check initial state
  const panel = page.locator('.filter-panel');
  const initiallyVisible = await panel.isVisible();
  
  // Toggle
  await page.click('button.toggle-filters');
  
  // Verify state changed
  const afterToggle = await panel.isVisible();
  expect(afterToggle).not.toBe(initiallyVisible);
});
```

### Pattern 4: Testing API Responses

```javascript
test('should load data from API', async ({ page }) => {
  // Listen for API calls
  const apiCall = page.waitForResponse(
    response => response.url().includes('/api/cohorts')
  );
  
  await page.goto('https://testing-portal.canceridc.dev/cohorts/');
  
  // Wait for API call
  const response = await apiCall;
  expect(response.status()).toBe(200);
  
  const data = await response.json();
  expect(data).toHaveProperty('results');
});
```

## Code Review Guidelines

When submitting a pull request:

1. **Run tests locally first**
   ```bash
   npm test
   ```

2. **Run linting** (if configured)
   ```bash
   npm run lint
   ```

3. **Include screenshots** in PR description for visual tests

4. **Update documentation** if adding new configuration options

5. **Add test to CI** by ensuring it's in the `tests/` directory

## Debugging Your Tests

### Use Headed Mode

```bash
npm run test:headed
```

### Use Debug Mode

```bash
npm run test:debug
```

### Add Console Logs

```javascript
test('my test', async ({ page }) => {
  console.log('Starting test...');
  await page.goto('...');
  console.log('Page loaded, title:', await page.title());
});
```

### Capture Screenshots at Each Step

```javascript
await page.screenshot({ path: 'test-results/step1.png' });
// ... do something ...
await page.screenshot({ path: 'test-results/step2.png' });
```

## Common Issues

### Issue: Timeout Errors

**Solution:** Increase timeout for specific action:
```javascript
await page.click('button', { timeout: 30000 }); // 30 seconds
```

### Issue: Element Not Found

**Solution:** Wait for element before interacting:
```javascript
await page.waitForSelector('button.my-button');
await page.click('button.my-button');
```

### Issue: Flaky Tests

**Solution:** Use Playwright's auto-waiting:
```javascript
// This automatically waits for element to be visible and enabled
await page.click('button');
```

## Testing Checklist

Before submitting your tests:

- [ ] Tests pass locally
- [ ] Tests are properly documented
- [ ] Configuration options are added if needed
- [ ] Tests handle errors gracefully
- [ ] Tests don't rely on hard-coded data
- [ ] Screenshots are captured for visual verification
- [ ] Test names are descriptive
- [ ] Tests are independent (don't rely on other tests)
- [ ] Timeouts are appropriate for the portal's load time
- [ ] Network monitoring is used where appropriate

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [IDC WebApp Source](https://github.com/ImagingDataCommons/IDC-WebApp)
- [IDC Portal](https://portal.imaging.datacommons.cancer.gov/)

## Questions?

If you have questions or need help:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review existing tests in `tests/` directory
3. Open an issue for discussion
4. Join the IDC community channels

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
