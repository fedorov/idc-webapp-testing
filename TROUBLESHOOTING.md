# IDC Portal Testing Troubleshooting Guide

Common issues and solutions when testing the IDC web portal.

## Page Load Issues

### Problem: Page Takes Too Long to Load

**Symptoms:**
- Tests timeout during page load
- Error: "Timeout 90000ms exceeded"

**Solutions:**

1. Increase timeout in `test-config.json`:
```json
{
  "pageLoadTimeout": 120000
}
```

2. Increase timeout in `playwright.config.js`:
```javascript
timeout: 180 * 1000, // 3 minutes
```

3. Check portal health:
```bash
curl -I https://testing-portal.canceridc.dev/explore/
```

### Problem: Page Loads but Content is Missing

**Symptoms:**
- Page loads but tests fail on assertions
- Screenshots show incomplete page

**Solutions:**

1. Increase wait time after load in `test-config.json`:
```json
{
  "tests": {
    "databaseInteraction": {
      "waitAfterLoad": 10000
    }
  }
}
```

2. Check for JavaScript errors in test output
3. Verify network requests completed successfully

## Selector Issues

### Problem: Elements Not Found

**Symptoms:**
- Error: "Locator not found"
- Tests skip finding certain elements

**Solutions:**

1. Inspect the actual HTML structure:
```bash
npm run test:headed  # Watch test run in browser
```

2. Update selectors in `test-config.json`:
```json
{
  "tests": {
    "pageLoad": {
      "selectors": {
        "filterPanel": ".actual-class-name"
      }
    }
  }
}
```

3. Use browser DevTools to find correct selectors:
   - Run test with `--debug` flag
   - Inspect element in browser
   - Copy selector

### Problem: Elements Found but Not Visible

**Symptoms:**
- Element exists but `.isVisible()` returns false
- Tests timeout waiting for visibility

**Solutions:**

1. Check if element is hidden by CSS
2. Wait for animations to complete
3. Use `.waitForSelector()` with `state: 'visible'`

## Database Interaction Issues

### Problem: Data Not Loading

**Symptoms:**
- Tests pass but reference results show no data
- Element counts are zero

**Solutions:**

1. Increase database wait time:
```json
{
  "tests": {
    "databaseInteraction": {
      "waitForNetworkIdle": true,
      "waitAfterLoad": 10000
    }
  }
}
```

2. Check network monitoring output for failed API calls

3. Verify database is accessible from test environment

### Problem: Inconsistent Data Between Runs

**Symptoms:**
- Tests pass sometimes, fail other times
- Reference results vary significantly

**Solutions:**

1. This is expected for a live database
2. Make assertions more flexible
3. Focus on structure rather than exact counts
4. Use ranges instead of exact values

## Network Issues

### Problem: Failed API Requests

**Symptoms:**
- Network monitoring shows failed requests
- Data doesn't load properly

**Solutions:**

1. Check network logs in test output:
```bash
npm test 2>&1 | grep "Failed requests"
```

2. Verify API endpoints are accessible:
```bash
curl https://testing-portal.canceridc.dev/api/
```

3. Check for CORS issues in test output

4. Add retry logic for flaky endpoints

### Problem: Tests Work Locally but Fail in CI

**Symptoms:**
- Tests pass on local machine
- GitHub Actions tests fail

**Solutions:**

1. Check if portal is accessible from GitHub Actions IPs
2. Verify no rate limiting or firewall blocking
3. Increase retries in `playwright.config.js`:
```javascript
retries: process.env.CI ? 3 : 0,
```

## Test Reliability

### Problem: Flaky Tests

**Symptoms:**
- Tests pass/fail inconsistently
- Timing-related failures

**Solutions:**

1. Use Playwright's auto-waiting features
2. Avoid hard-coded `waitForTimeout()` where possible
3. Wait for specific conditions instead
4. Increase retry count for flaky tests

### Problem: Tests Pass but Screenshots Show Issues

**Symptoms:**
- All assertions pass
- Screenshots reveal problems

**Solutions:**

1. Add more specific assertions
2. Check for visual elements programmatically
3. Add custom screenshot comparison tests

## Performance Issues

### Problem: Tests Take Too Long

**Symptoms:**
- Full test suite takes > 10 minutes
- CI job times out

**Solutions:**

1. Disable non-critical tests:
```json
{
  "tests": {
    "cartFunctionality": {
      "enabled": false
    }
  }
}
```

2. Run tests in parallel (locally):
```bash
npx playwright test --workers=2
```

3. Use `test.only()` for focused testing during development

### Problem: Too Many Screenshots/Artifacts

**Symptoms:**
- Artifact storage fills up
- Downloads are very large

**Solutions:**

1. Reduce screenshot frequency
2. Use viewport screenshots instead of full page:
```javascript
await page.screenshot({ 
  fullPage: false  // Change from true
});
```

3. Compress artifacts before upload

## Configuration Issues

### Problem: Config File Not Found

**Symptoms:**
- Error: "ENOENT: no such file or directory"

**Solutions:**

1. Verify `test-config.json` exists in root directory
2. Check file name spelling (case-sensitive)
3. Ensure file has valid JSON syntax:
```bash
cat test-config.json | python -m json.tool
```

### Problem: Invalid Configuration

**Symptoms:**
- Tests fail to start
- JSON parsing errors

**Solutions:**

1. Validate JSON syntax:
```bash
npm install -g jsonlint
jsonlint test-config.json
```

2. Compare with example configuration
3. Check for trailing commas (invalid in JSON)

## Browser Issues

### Problem: Chromium Not Installed

**Symptoms:**
- Error: "Executable doesn't exist"

**Solutions:**

```bash
npx playwright install chromium --with-deps
```

### Problem: Browser Crashes

**Symptoms:**
- Tests fail with browser crash
- Error: "Browser closed unexpectedly"

**Solutions:**

1. Update Playwright:
```bash
npm install -D @playwright/test@latest
npx playwright install
```

2. Add more memory if running in container
3. Disable GPU acceleration if needed

## Debugging Tips

### Enable Verbose Logging

```bash
DEBUG=pw:api npm test
```

### Run Single Test

```bash
npx playwright test -g "should load the explore page"
```

### Use Debug Mode

```bash
npm run test:debug
```

This opens Playwright Inspector for step-by-step debugging.

### Capture Trace

In `playwright.config.js`:
```javascript
use: {
  trace: 'on',  // Always capture trace
}
```

View trace:
```bash
npx playwright show-trace trace.zip
```

### Check Test Output

Review detailed output in test results:
```bash
cat test-results/results.json | python -m json.tool
```

## Portal-Specific Issues

### Problem: Cohort/Collection Features Not Working

**Symptoms:**
- Cart tests fail
- Filter tests fail

**Solutions:**

1. These may require authentication
2. Check if features are available on test portal
3. May need to mock authentication

### Problem: DICOM Viewer Issues

**Symptoms:**
- Viewer doesn't load
- Viewer-related tests fail

**Solutions:**

1. DICOM viewer uses WebGL/Canvas
2. May not work in headless mode
3. Consider testing in headed mode or skipping

### Problem: BigQuery Export Features

**Symptoms:**
- Export features not testable

**Solutions:**

1. These require Google Cloud authentication
2. May need to mock or skip in automated tests
3. Test only UI presence, not functionality

## Getting Help

If you're still stuck:

1. **Check test output** - Review console logs and error messages
2. **Capture screenshots** - Enable screenshots for all tests temporarily
3. **Check portal status** - Verify portal is accessible and functioning
4. **Review recent changes** - Check if portal was recently updated
5. **Open an issue** - Provide:
   - Test output
   - Screenshots
   - Configuration files
   - Steps to reproduce

## Useful Commands

```bash
# Run specific test file
npx playwright test tests/idc-portal.spec.js

# Run with UI
npm run test:headed

# Debug mode
npm run test:debug

# Show last report
npm run report

# Update snapshots
npx playwright test --update-snapshots

# List all tests
npx playwright test --list

# Run tests matching pattern
npx playwright test -g "database"
```
