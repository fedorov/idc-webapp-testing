# GitHub Actions Workflow Guide

## Workflow Overview

The workflow (`.github/workflows/test.yml`) runs **two jobs** via a matrix — one for staging, one for production — with independent triggers for each.

| Job | Triggers | Portal URL |
|-----|----------|------------|
| **staging** | push to main/master, PRs, daily 2 AM UTC, manual | `PORTAL_URL` repository variable |
| **production** | weekly Monday 3 AM UTC, manual | `https://portal.imaging.datacommons.cancer.gov/explore/` |

Both jobs install Chromium and Firefox, run the full test suite, write a job summary, and upload artifacts.

## Viewing Results

1. Go to **Actions** tab → click a run → select the staging or production job
2. **Job summary** (top of job page) — pass/fail table written by the workflow
3. **Artifacts** (bottom of job page, retained 30 days):
   - `test-results-staging` / `test-results-production` — JSON results, screenshots, HTML report
   - `reference-results-staging` / `reference-results-production` — per-run baseline snapshot

To open the interactive HTML report locally after downloading:
```bash
unzip test-results-staging.zip
npx playwright show-report playwright-report/
```

## Manual Trigger

1. **Actions** tab → "IDC Web Portal Testing" → **Run workflow**
2. Optionally enter a `portal_url` to override both jobs
3. Both staging and production jobs run when triggered manually

## Portal URL Configuration

The staging job uses the `PORTAL_URL` **repository variable** (not a secret):

1. **Settings** → **Secrets and variables** → **Actions** → **Variables** tab
2. Create or update `PORTAL_URL` (e.g. `https://testing-portal.canceridc.dev/explore/`)
3. If unset, tests fall back to the default in `test-config.json`

The production job always uses `https://portal.imaging.datacommons.cancer.gov/explore/` — no configuration needed.

## Workflow Configuration

### Timeout

```yaml
timeout-minutes: 45
```

The suite runs in ~40s (Chromium) or ~80s (both browsers). 45 minutes is generous headroom for slow portal days and CI queue time.

### Workers

```javascript
// playwright.config.js
workers: process.env.CI ? 2 : undefined,
```

Two workers run spec files in parallel on CI. Each spec file loads the portal once via `beforeAll`, so two portal loads happen simultaneously at most.

### Retries

```javascript
retries: process.env.CI ? 2 : 0,
```

### Browser Installation

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium firefox
```

Both Chromium and Firefox are installed. To add WebKit (Safari), append `webkit` and add a project entry in `playwright.config.js`.

### Changing the Schedule

Edit the `schedule` block in `.github/workflows/test.yml`:

```yaml
schedule:
  - cron: '0 2 * * *'   # daily staging — adjust time as needed
  - cron: '0 3 * * 1'   # weekly production — Monday 3 AM UTC
```

Examples:
- `'0 */6 * * *'` — every 6 hours
- `'0 8 * * 1-5'` — weekdays at 8 AM UTC
- `'0 0 * * 0'` — Sundays at midnight UTC

## Local vs CI Differences

| Setting | Local | CI |
|---------|-------|----|
| Workers | unlimited | 2 |
| Retries | 0 | 2 |
| Browsers | Chromium + Firefox | Chromium + Firefox |
| Screenshots | on failure | on failure |
| Videos | on failure | on failure |
| Traces | on first retry | on first retry |
| Headed | optional | headless only |

## Secrets and Variables

**Repository variables** (non-sensitive, visible in logs):
- `PORTAL_URL` — staging portal URL

**Repository secrets** (encrypted, redacted in logs): currently none required. To add one for future use (e.g. an API key):
1. **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab
2. Reference in workflow with `${{ secrets.MY_SECRET }}`

## Troubleshooting CI Failures

### Tests fail only on CI, pass locally

- Confirm the portal URL is reachable from GitHub's hosted runners (no firewall/IP restrictions)
- Check the job summary and downloaded HTML report for the specific failing assertion
- Download the `test-results-staging` artifact and inspect screenshots

### `beforeAll` timeout

Each spec file loads the portal in `beforeAll` with a 180-second timeout. If the portal is slow:
1. Increase `pageLoadTimeout` in `test-config.json`
2. Increase `test.setTimeout(180000)` in the relevant `beforeAll`
3. Increase `timeout-minutes` in the workflow if needed

### Browser installation fails

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium firefox
```

The `--with-deps` flag installs OS-level dependencies. Remove it only if you manage system packages separately.

### Artifact not found

If `reference-results-{env}` artifact is empty, the `should save comprehensive reference results` test did not run or failed. Check the main test results artifact for details.
