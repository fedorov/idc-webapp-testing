# Contributing to IDC Web Portal Testing

## Getting Started

```bash
git clone https://github.com/fedorov/idc-webapp-testing.git
cd idc-webapp-testing
npm install
npx playwright install --with-deps chromium firefox
npm test  # verify everything passes before making changes
```

## Project Layout

```
tests/
  helpers/portal.js      # Shared utilities — import from here, don't copy
  idc-portal.spec.js     # Core smoke tests
  data-table.spec.js     # Table-specific tests
  navigation.spec.js     # Navigation tests
  regression.spec.js     # Baseline comparison tests
baseline/
  reference-results.json # Committed baseline — updated by test run, commit changes
```

## Adding a New Test File

All spec files follow the same pattern: load the portal **once** in `beforeAll`, run all tests against the shared page, close it in `afterAll`. This avoids the ~90-second portal load cost per test.

```javascript
import { test, expect } from '@playwright/test';
import { loadPortalConfig, loadPortalPage } from './helpers/portal.js';

const config = loadPortalConfig();

test.describe.configure({ mode: 'serial' });

test.describe('My Feature', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180000);
    page = await browser.newPage();
    await loadPortalPage(page, config);  // navigates + dismisses gov popup
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should do something meaningful', async () => {
    const count = await page.locator('.my-element').count();
    expect(count, 'my-element missing — feature may be broken').toBeGreaterThanOrEqual(1);
  });
});
```

Note: test functions do **not** receive `page` as a parameter — they use the closure variable from `beforeAll`.

## Available Helpers (`tests/helpers/portal.js`)

| Export | Purpose |
|--------|---------|
| `loadPortalConfig()` | Reads `test-config.json`, applies `PORTAL_URL` env override |
| `loadPortalPage(page, config)` | `goto` + `waitForPageReady` + `closeGovernmentWarningPopup` |
| `waitForPageReady(page, timeout)` | Waits for network idle + 2s JS buffer |
| `closeGovernmentWarningPopup(page)` | Dismisses `#gov_warning` if present |
| `setupNetworkMonitoring(page)` | Attaches request/failure listeners; call before navigation |
| `loadReferenceResults()` | Returns parsed `baseline/reference-results.json` or `null` |
| `saveReferenceResults(data)` | Writes to `baseline/reference-results.json` |

## Writing Good Assertions

**Use a meaningful lower bound, not zero:**
```javascript
// Bad — always passes even if the feature is gone
expect(filterCount).toBeGreaterThanOrEqual(0);

// Good — catches a regression
expect(filterCount, 'Filter panel missing').toBeGreaterThanOrEqual(5);
```

**Include a failure message:**
```javascript
expect(rows, 'Table has no rows — data may not have loaded').toBeGreaterThanOrEqual(5);
```

**Skip gracefully when a feature is absent, rather than failing:**
```javascript
const el = page.locator('.optional-feature').first();
if (!(await el.isVisible({ timeout: 3000 }).catch(() => false))) {
  test.skip();
}
```

**Test interactions, not just presence:**
```javascript
// Presence only
expect(await page.locator('input[type="checkbox"]').count()).toBeGreaterThan(0);

// Better: actually click and verify something changes
await checkbox.click();
await page.waitForLoadState('networkidle');
expect(page.url()).not.toBe(initialUrl);
```

## Screenshots

Take element-scoped screenshots rather than full-viewport:

```javascript
// Bad — viewport shows the same thing for every test when page is shared
await page.screenshot({ path: 'test-results/my-feature.png' });

// Good — captures the specific element under test
const el = page.locator('.my-feature').first();
if (await el.isVisible().catch(() => false)) {
  await el.screenshot({ path: 'test-results/my-feature.png' });
} else {
  await page.screenshot({ path: 'test-results/my-feature.png' });
}
```

## Configuring New Tests

Add options to `test-config.json` so tests can be tuned without code changes:

```json
{
  "tests": {
    "myFeature": {
      "enabled": true,
      "minItemCount": 3,
      "selectors": {
        "itemList": ".my-list, [data-items]"
      }
    }
  }
}
```

Read it in the test:

```javascript
const config = loadPortalConfig();
const minCount = config.tests.myFeature.minItemCount ?? 1;
```

## Testing Patterns

### Wait for an API response before asserting

```javascript
const responsePromise = page.waitForResponse(r => r.url().includes('/api/collections'));
await page.goto(config.testUrl, { waitUntil: 'domcontentloaded' });
const response = await responsePromise;
expect(response.status()).toBe(200);
```

### Test navigation without reloading the shared page

```javascript
const initialUrl = page.url();
await page.locator('a[href*="cohorts"]').first().click();
await page.waitForLoadState('domcontentloaded');
// ... assertions ...
await page.goto(config.testUrl, { waitUntil: 'domcontentloaded' }); // restore
```

## Before Submitting a PR

- [ ] `npm test` passes locally (or expected skips are explained)
- [ ] New test files follow the `beforeAll` shared-page pattern
- [ ] Assertions have failure messages and meaningful thresholds (not `>= 0`)
- [ ] Screenshots are element-scoped
- [ ] If `test-config.json` changed, `TEST-CONFIG-EXAMPLES.md` is updated
- [ ] The new test is documented in the table in `README.md`

## Debugging

```bash
# Watch tests run in a real browser
npm run test:headed

# Step through tests interactively
npm run test:debug

# Run a single spec file
npx playwright test tests/data-table.spec.js --project=chromium

# Run a single test by name
npx playwright test -g "should load the explore page"

# List all tests without running them
npx playwright test --list
```

## License

By contributing you agree that your contributions will be licensed under Apache License 2.0.
