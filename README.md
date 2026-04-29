# IDC Web Portal Automated Testing

Automated browser testing for the [NCI Imaging Data Commons (IDC)](https://portal.imaging.datacommons.cancer.gov/) web portal using Playwright and GitHub Actions.

## Overview

The suite exercises the IDC explore page end-to-end, covering filters, data tables, navigation, cart UI, and regression detection against a committed baseline. Key design choices:

- **Shared page state** — each spec file loads the portal once in `beforeAll`, then all tests in that file reuse the same browser page. This cuts runtime from ~9 minutes to ~40 seconds for a full Chromium run.
- **Two browsers** — Chromium and Firefox run in parallel on CI.
- **Regression baseline** — `baseline/reference-results.json` is committed to the repo. Regression tests compare live portal metrics against it within tolerance (±30% for element counts, all keywords must be present).
- **Automatic popup handling** — government warning popup (`#gov_warning`) is dismissed automatically in every spec.

## Repository Structure

```
tests/
  helpers/
    portal.js           # Shared utilities: loadPortalPage, closeGovernmentWarningPopup, etc.
  idc-portal.spec.js    # Core smoke tests (page load, keywords, filters, cart, tables)
  data-table.spec.js    # Table content, headers, sort, pagination
  navigation.spec.js    # Nav presence, link targets, error-page detection
  regression.spec.js    # Baseline comparison against baseline/reference-results.json
baseline/
  reference-results.json  # Committed baseline snapshot (updated on each full test run)
playwright.config.js
test-config.json
```

## Quick Start

### Prerequisites

- Node.js 18 or higher

### Installation

```bash
git clone https://github.com/fedorov/idc-webapp-testing.git
cd idc-webapp-testing
npm install
npx playwright install --with-deps chromium firefox
```

### Running Tests

```bash
# Run all tests (Chromium + Firefox)
npm test

# Run Chromium only
npx playwright test --project=chromium

# Run a single spec file
npx playwright test tests/data-table.spec.js

# Run with a visible browser
npm run test:headed

# Interactive debug mode
npm run test:debug

# View HTML report
npm run report

# Override the portal URL
PORTAL_URL=https://testing-portal.canceridc.dev/explore/ npm test
```

## Configuration

### Portal URL

The URL under test is resolved in this priority order:

1. `PORTAL_URL` environment variable (used by GitHub Actions)
2. `testUrl` in `test-config.json` (default: production portal)

### `test-config.json`

Controls per-test thresholds and selectors. Key fields:

| Field | Default | Description |
|-------|---------|-------------|
| `testUrl` | production portal | URL to test |
| `pageLoadTimeout` | 90000 | ms to wait for portal load |
| `tests.filterInteraction.minFilterCount` | 5 | Minimum filter elements required |
| `tests.dataTableVerification.minRowCount` | 5 | Minimum table rows required |

### `playwright.config.js`

| Setting | Local | CI |
|---------|-------|----|
| Workers | unlimited | 2 |
| Retries | 0 | 2 |
| Browsers | Chromium + Firefox | Chromium + Firefox |
| Screenshots | on failure | on failure |
| Videos | on failure | on failure |
| Traces | on first retry | on first retry |

## Test Suite

### Spec files

| File | Tests | What it covers |
|------|-------|----------------|
| `idc-portal.spec.js` | 7 | Page load, keywords, filters, tables, cart, filter interaction, baseline save |
| `data-table.spec.js` | 5 | Table presence, cell content, column headers, sort, pagination |
| `navigation.spec.js` | 5 | Nav menu, link targets, error-page detection, external links |
| `regression.spec.js` | 7 | Live metrics vs `baseline/reference-results.json` |

Total: **24 tests × 2 browsers = 48 tests**, completing in ~40 seconds.

### Regression baseline

`baseline/reference-results.json` is a snapshot of the portal's "known good" state:

```json
{
  "contentLength": 2467698,
  "elementCounts": { "buttons": 57, "links": 477, "tables": 4, ... },
  "foundKeywords": ["imaging", "data", "commons", "explore", "portal", "collection", "cohort"],
  "testResults": { "hasFilterPanel": true, "hasTables": true, "hasCart": true, ... }
}
```

**How it is created** — there is no separate baseline generation step. The last test in `idc-portal.spec.js` (`should save comprehensive reference results`) navigates the live portal, collects these metrics, and writes them to `baseline/reference-results.json` on every full test run. So the first `npm test` creates the baseline; all subsequent runs both update it and check against the previous version.

**How regression tests use it** — `regression.spec.js` loads the file at startup, navigates the portal fresh, measures the same metrics, and asserts they are within tolerance: ±30% for element counts, ±50% for content length, zero missing keywords, ±1 table count.

**Updating intentionally** — if the portal changes legitimately (redesign, new features), run `npm test` and commit the updated `baseline/reference-results.json`. That new snapshot becomes the regression reference going forward.

**Why it lives in `baseline/` not `test-results/`** — Playwright clears the `test-results/` directory at the start of every run. Storing the baseline there would erase it before regression tests could read it.

### Government warning popup

All spec files call `closeGovernmentWarningPopup()` from `tests/helpers/portal.js`. It waits up to 10 seconds for `#gov_warning` to appear after page load, then clicks the dismiss button. Tests continue normally if no popup is found.

## GitHub Actions

The workflow (`.github/workflows/test.yml`) runs two jobs via a matrix:

| Job | Trigger | Portal |
|-----|---------|--------|
| staging | push, PR, daily at 2 AM UTC, manual | `PORTAL_URL` repository variable |
| production | weekly Monday 3 AM UTC, manual | `https://portal.imaging.datacommons.cancer.gov/explore/` |

Each run posts a pass/fail summary to the GitHub Actions job summary tab and uploads artifacts retained for 30 days.

### Setting `PORTAL_URL`

1. **Settings** → **Secrets and variables** → **Actions** → **Variables**
2. Create variable `PORTAL_URL` with your staging URL (e.g. `https://testing-portal.canceridc.dev/explore/`)
3. If unset, the production URL from `test-config.json` is used

### Artifacts

| Artifact | Contents |
|----------|----------|
| `test-results-staging` / `test-results-production` | JSON results, screenshots, HTML report |
| `reference-results-staging` / `reference-results-production` | Per-run baseline snapshot |

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add new tests.

## Related

- [IDC Web App source](https://github.com/ImagingDataCommons/IDC-WebApp)
- [IDC documentation](https://learn.canceridc.dev/)
- [Playwright documentation](https://playwright.dev/)

## License

Apache License 2.0 — see [LICENSE](LICENSE).
