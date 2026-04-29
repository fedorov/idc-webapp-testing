# Troubleshooting Guide

## Page Load Issues

### Tests timeout during portal load

**Symptom:** `TimeoutError: page.waitForLoadState('networkidle') exceeded 90000ms`

The portal takes 15–90 seconds to fully load. `beforeAll` has a 3-minute timeout; the portal navigation itself has a `pageLoadTimeout` (default 90s).

**Solutions:**

1. Increase `pageLoadTimeout` in `test-config.json`:
   ```json
   { "pageLoadTimeout": 120000 }
   ```

2. Check portal health:
   ```bash
   curl -I https://portal.imaging.datacommons.cancer.gov/explore/
   ```

3. If running against staging, verify the staging URL is up:
   ```bash
   curl -I https://testing-portal.canceridc.dev/explore/
   ```

### Page loads but content is missing

**Symptom:** Screenshots show a blank or partial page; keyword assertions fail.

**Solutions:**

- The portal is a React SPA — all content is database-driven. If the database is slow, content may not render within the timeout. Increase `pageLoadTimeout`.
- Check network monitoring output in test logs for failed API calls.
- Run `npm run test:headed` to watch the browser and see what loads.

---

## Regression Tests Skip

**Symptom:** All tests in `regression.spec.js` show as `-` (skipped).

**Cause:** `baseline/reference-results.json` does not exist. The regression tests require a baseline to compare against.

**Solution:** Run the full test suite once to generate the baseline:
```bash
npm test
```

The `should save comprehensive reference results` test writes `baseline/reference-results.json`. After that, regression tests will run on subsequent executions.

---

## Regression Tests Fail

**Symptom:** Regression test fails with a message like `Button count regression: baseline=57, current=12`.

**Cause A — legitimate portal change:** A new portal version reduced/changed UI elements. This is expected when the portal is updated.
- Run `npm test`, review the new numbers, commit the updated `baseline/reference-results.json`.

**Cause B — portal is down or degraded:** The portal returned an error page or loaded partially.
- Check portal status; re-run when the portal is healthy.

**Cause C — threshold too tight:** The portal's element counts vary slightly between renders.
- Widen the tolerance constants in `regression.spec.js` (currently ±30% for element counts, ±50% for content length).

---

## Filter Interaction Test Skips

**Symptom:** `should apply a filter and reflect the change in URL or page state` is always skipped.

**Cause:** The selector `input[type="checkbox"]:not(:checked)` did not find a visible checkbox within 5 seconds. This can happen on the staging portal if filters render differently.

**Solutions:**
- Run the test headed (`npm run test:headed`) and inspect what the filter area looks like.
- Update the checkbox selector in `idc-portal.spec.js` to match the actual filter input selector on your portal.

---

## Element Not Found

**Symptom:** Test fails with `Locator not found` or counts 0 elements.

**Solutions:**

1. Run headed to see the actual page:
   ```bash
   npm run test:headed
   ```

2. Use debug mode to inspect elements interactively:
   ```bash
   npm run test:debug
   ```

3. Confirm what CSS classes the portal is actually using:
   - Open the portal in a browser
   - DevTools → Inspector → find the element
   - Update the selector in `test-config.json` (for configurable selectors) or in the spec file

---

## Tests Pass Locally but Fail on CI

**Cause A — portal unreachable from CI:** GitHub Actions runners have public IPs. If the staging portal has IP restrictions, tests will fail.
- Verify the portal URL is publicly accessible.
- Use the production URL (`https://portal.imaging.datacommons.cancer.gov/explore/`) for CI instead.

**Cause B — timing differences:** CI machines are slower than local; the portal may not finish loading within the timeout.
- Increase `pageLoadTimeout` in `test-config.json`.

**Cause C — `beforeAll` timeout:** The default `beforeAll` timeout matches `playwright.config.js`'s `timeout` (120s). If portal load + popup takes longer, `beforeAll` silently fails and all tests in the spec file are marked as skipped.
- Each `beforeAll` calls `test.setTimeout(180000)` to extend this. If 180s is still too short, increase it.

---

## Identical Screenshots

**Symptom:** Multiple test screenshots look the same.

**Cause:** Tests sharing a page via `beforeAll` will capture the same viewport if screenshots are not element-scoped. The spec files use `element.screenshot()` to capture the specific feature under test. If a new test uses `page.screenshot()` (viewport), it will look the same as other viewport shots.

**Solution:** Use element-scoped screenshots:
```javascript
const el = page.locator('.my-feature').first();
if (await el.isVisible().catch(() => false)) {
  await el.screenshot({ path: 'test-results/my-feature.png' });
} else {
  await page.screenshot({ path: 'test-results/my-feature.png' });
}
```

---

## Flaky Tests

**Symptom:** Tests pass sometimes, fail others, with no code changes.

The most common causes on the IDC portal:
- Dynamic data (collection counts change as data is added)
- Slow portal responses on high-traffic days

**Solutions:**
- Avoid asserting exact counts; use `toBeGreaterThanOrEqual()` with a floor.
- For CI, rely on Playwright's built-in 2-retry (`retries: 2` in `playwright.config.js`).
- Investigate which assertion is flaky and widen its bound.

---

## Performance

### Full suite takes too long

With the shared `beforeAll` pattern, the suite runs in ~40 seconds (Chromium) or ~2 minutes (both browsers). If it's taking much longer:

- Each spec file should load the portal exactly once. If a test inside a spec calls `page.goto()` independently, it adds 30–90s. Check for stray navigations.
- On CI, workers are set to 2. All four spec files run with 2 workers, so they run in two pairs. This is already near-optimal.

### CI job times out

The workflow has a 45-minute timeout. For a healthy portal this is very generous. If CI is timing out:
- Check if the portal is having an incident.
- Review the GitHub Actions log to see which step is stuck.
- Confirm `npx playwright install --with-deps chromium firefox` isn't re-downloading browsers unnecessarily (Node.js caching is configured in the workflow).

---

## Browser Issues

### Browser not installed

```bash
npx playwright install --with-deps chromium firefox
```

### Firefox-specific failures

Some portal features may behave differently on Firefox. Run Chromium-only to isolate:
```bash
npx playwright test --project=chromium
```

---

## Useful Commands

```bash
# Run all tests
npm test

# Chromium only
npx playwright test --project=chromium

# Single spec file
npx playwright test tests/regression.spec.js

# Single test by name
npx playwright test -g "should load the explore page"

# List all tests without running
npx playwright test --list

# Watch mode (headed browser)
npm run test:headed

# Step-through debugger
npm run test:debug

# Open last HTML report
npm run report

# Enable verbose Playwright API logging
DEBUG=pw:api npm test
```
