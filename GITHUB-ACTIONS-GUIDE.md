# GitHub Actions Workflow Guide

This document explains how the automated testing workflow operates and how to use it.

## Workflow Overview

The GitHub Actions workflow (`.github/workflows/test.yml`) automatically tests the IDC web portal whenever:

1. Code is pushed to `main` or `master` branch
2. A pull request is opened targeting `main` or `master`
3. Manually triggered via GitHub UI
4. Daily at 2 AM UTC (scheduled run)

## Workflow Steps

The workflow performs the following steps:

1. **Checkout repository** - Gets the latest code
2. **Setup Node.js** - Installs Node.js 20 with npm caching
3. **Install dependencies** - Runs `npm ci` to install packages
4. **Install Playwright browsers** - Downloads Chromium for testing
5. **Run tests** - Executes the test suite
6. **Upload artifacts** - Saves test results, screenshots, and reports

## Viewing Test Results

After a workflow run completes:

1. Go to the **Actions** tab in GitHub
2. Click on a workflow run
3. Scroll down to **Artifacts** section
4. Download any of the following:
   - **test-results** - JSON results and screenshots
   - **screenshots** - PNG images from test runs
   - **reference-results** - Baseline comparison data
   - **playwright-report** - Interactive HTML report

## Manual Workflow Trigger

To manually run the tests:

1. Go to **Actions** tab in GitHub
2. Select "IDC Web Portal Testing" workflow
3. Click "Run workflow" button
4. Choose branch (default: main)
5. Click "Run workflow"

## Workflow Configuration

### Timeout

The workflow has a 30-minute timeout. Modify in `.github/workflows/test.yml`:

```yaml
timeout-minutes: 30  # Increase if needed
```

### Test Parallelization

Currently runs serially in CI. To enable parallel testing:

In `playwright.config.js`:
```javascript
workers: process.env.CI ? 2 : undefined,  // Change from 1 to 2
```

### Browser Selection

Currently tests only on Chromium. To add more browsers:

In `playwright.config.js`:
```javascript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',  // Uncomment to enable
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',   // Uncomment to enable
    use: { ...devices['Desktop Safari'] },
  },
],
```

Then update workflow to install all browsers:
```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps  # Remove 'chromium'
```

### Retry Configuration

Tests retry twice on failure in CI. To modify:

In `playwright.config.js`:
```javascript
retries: process.env.CI ? 2 : 0,  // Change number of retries
```

## Scheduled Testing

The workflow runs daily at 2 AM UTC. To change schedule:

In `.github/workflows/test.yml`:
```yaml
schedule:
  - cron: '0 2 * * *'  # Minute Hour Day Month DayOfWeek
```

Examples:
- `'0 */6 * * *'` - Every 6 hours
- `'0 8 * * 1'` - Every Monday at 8 AM UTC
- `'0 0 * * 0'` - Every Sunday at midnight UTC

## Environment Variables

The workflow uses environment variables for configuration:

### Portal URL Configuration

The test URL is controlled by the `PORTAL_URL` repository variable:

**To set the PORTAL_URL variable:**

1. Go to repository **Settings**
2. Select **Secrets and variables** > **Actions** > **Variables** tab
3. Click **New repository variable**
4. Name: `PORTAL_URL`
5. Value: Your portal URL (e.g., `https://testing-portal.canceridc.dev/explore/`)
6. Click **Add variable**

If `PORTAL_URL` is not set, tests will use the default URL from `test-config.json`.

### Adding Custom Environment Variables

Add environment variables for testing:

In `.github/workflows/test.yml`:
```yaml
- name: Run tests
  run: npm test
  env:
    CI: true
    PORTAL_URL: ${{ vars.PORTAL_URL }}  # Repository variable
    TEST_ENV: testing  # Custom variable
    API_KEY: ${{ secrets.API_KEY }}  # From GitHub Secrets
```

## Secrets Management

To add secrets (like API keys):

1. Go to repository **Settings**
2. Select **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add name and value
5. Reference in workflow with `${{ secrets.SECRET_NAME }}`

## Artifacts Retention

Artifacts are kept for 30 days. To change:

In `.github/workflows/test.yml`:
```yaml
retention-days: 30  # Change to desired days (1-90)
```

## Notifications

To get notified of test failures:

1. Go to repository **Settings**
2. Select **Notifications**
3. Enable "Actions" notifications
4. Or use GitHub's watch feature

## Troubleshooting

### Tests Timing Out

Increase timeout in workflow:
```yaml
timeout-minutes: 60  # Increase from 30
```

And in test config:
```json
{
  "pageLoadTimeout": 120000  // 2 minutes
}
```

### Browser Installation Fails

The workflow installs Chromium with dependencies. If it fails:
```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
```

### Disk Space Issues

If artifacts are too large, reduce screenshot quality or disable full page screenshots in tests.

### Network Issues

If the portal is unreachable from GitHub Actions:
- Check if the URL is publicly accessible
- Verify no firewall blocking GitHub's IP ranges
- Consider adding retry logic

## Best Practices

1. **Review test results regularly** - Check the Actions tab daily
2. **Investigate failures promptly** - Download artifacts to debug
3. **Update reference results** - When portal changes, update expected values
4. **Monitor run duration** - Optimize if tests take too long
5. **Keep dependencies updated** - Regularly update Playwright and Node.js

## Integration with Pull Requests

Tests automatically run on PRs:

- ✅ Green check = All tests passed
- ❌ Red X = Tests failed
- 🟡 Yellow dot = Tests running

Click "Details" next to the check to view results.

## Local vs CI Differences

| Feature | Local | CI |
|---------|-------|-----|
| Retries | 0 | 2 |
| Workers | Unlimited | 1 |
| Screenshots | Only on failure | Only on failure |
| Videos | On failure | On failure |
| Headed mode | Optional | Headless only |

## Advanced: Matrix Testing

To test multiple configurations:

```yaml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
    
steps:
  - name: Install Playwright browsers
    run: npx playwright install --with-deps ${{ matrix.browser }}
```

This creates separate jobs for each browser.
