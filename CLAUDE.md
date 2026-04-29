# CLAUDE.md — IDC Web Portal Testing

## Setup (new workstation)

```bash
npm install
npx playwright install --with-deps chromium firefox
npm test  # first run creates baseline/reference-results.json
```

Node.js 18+ required. No other system dependencies.

## Running tests

```bash
npm test                                          # Chromium + Firefox
npx playwright test --project=chromium           # Chromium only (faster)
npx playwright test tests/regression.spec.js     # single spec
npx playwright test -g "should load"             # single test by name
npm run test:headed                              # visible browser
npm run test:debug                               # step-through debugger
npm run report                                   # open last HTML report
PORTAL_URL=https://testing-portal.canceridc.dev/explore/ npm test  # override URL
```

## Architecture

**Single shared page per spec file.** Each spec file loads the portal once in `beforeAll`, then all tests reuse that page. This cuts runtime from ~9 min to ~40 sec. Tests do NOT receive `page` as a parameter — they use the closure variable.

Template for every new spec file:
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
    await loadPortalPage(page, config);  // goto + wait for idle + dismiss popup
  });

  test.afterAll(async () => { await page.close(); });

  test('should do something', async () => {
    const count = await page.locator('.my-element').count();
    expect(count, 'my-element missing').toBeGreaterThanOrEqual(1);
  });
});
```

## Key files

| Path | Purpose |
|------|---------|
| `tests/helpers/portal.js` | All shared utilities — import from here, never duplicate |
| `tests/idc-portal.spec.js` | Core smoke tests; also saves the regression baseline |
| `tests/data-table.spec.js` | Table content, headers, sort, pagination |
| `tests/navigation.spec.js` | Nav presence, links, error-page detection |
| `tests/regression.spec.js` | Compares live portal against `baseline/reference-results.json` |
| `baseline/reference-results.json` | Committed snapshot — updated by every full test run |
| `test-config.json` | Thresholds, selectors, portal URL |
| `playwright.config.js` | Chromium + Firefox projects, workers, retries |
| `.github/workflows/test.yml` | Staging (daily) + production (weekly) CI matrix |

## Helper exports (`tests/helpers/portal.js`)

```javascript
loadPortalConfig()              // reads test-config.json + PORTAL_URL env override
loadPortalPage(page, config)    // goto + waitForPageReady + closeGovernmentWarningPopup
waitForPageReady(page, timeout) // networkidle + 2s JS buffer
closeGovernmentWarningPopup(page) // dismisses #gov_warning if present
setupNetworkMonitoring(page)    // attaches request/failure listeners; call before goto
loadReferenceResults()          // returns parsed baseline/reference-results.json or null
saveReferenceResults(data)      // writes to baseline/reference-results.json
```

## Regression baseline

`baseline/reference-results.json` stores a snapshot of portal metrics (element counts, keywords, content length). It is **auto-created** — the last test in `idc-portal.spec.js` writes it on every full run. The first `npm test` creates it; every run after that updates it and regression tests compare against the previous version.

**Do NOT store it in `test-results/`** — Playwright clears that directory at the start of every run.

When the portal legitimately changes: run `npm test`, review the diff, commit the updated baseline.

## Assertions

Always use meaningful lower bounds, never `>= 0`:
```javascript
expect(count, 'Filter panel missing').toBeGreaterThanOrEqual(5);  // good
expect(count).toBeGreaterThanOrEqual(0);  // never — always passes
```

Skip gracefully for optional features:
```javascript
if (!(await el.isVisible({ timeout: 3000 }).catch(() => false))) {
  test.skip();
}
```

## Screenshots

Use element-scoped screenshots (shared page has fixed scroll position — viewport shots are identical across tests):
```javascript
const el = page.locator('.my-feature').first();
if (await el.isVisible().catch(() => false)) {
  await el.screenshot({ path: 'test-results/my-feature.png' });
} else {
  await page.screenshot({ path: 'test-results/my-feature.png' });
}
```

## Portal URL

Resolved in priority order:
1. `PORTAL_URL` environment variable
2. `testUrl` in `test-config.json` (default: production portal)

## CI

Two jobs via GitHub Actions matrix:
- **staging** — runs on push/PR/daily 2 AM UTC; uses `PORTAL_URL` repository variable
- **production** — runs weekly Monday 3 AM UTC; hardcoded to production URL

Set `PORTAL_URL`: **Settings → Secrets and variables → Actions → Variables**.

## Common pitfalls

- Adding a `page.goto()` inside a test (not `beforeAll`) adds ~90s per call — never do this
- `setupNetworkMonitoring(page)` must be called before `page.goto()`, not after
- `test-results/` is wiped at the start of each run — nothing persistent lives there
- The portal is a React SPA backed by a database; allow 15–90s for content to fully render
