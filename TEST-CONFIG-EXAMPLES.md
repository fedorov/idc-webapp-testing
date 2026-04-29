# Test Configuration Examples

`test-config.json` controls thresholds, selectors, and optional behavior. The portal URL can also be overridden at runtime with the `PORTAL_URL` environment variable, which takes priority over `testUrl` in the file.

## Current Defaults

```json
{
  "testUrl": "https://portal.imaging.datacommons.cancer.gov/explore/",
  "pageLoadTimeout": 90000,
  "tests": {
    "filterInteraction": {
      "minFilterCount": 5
    },
    "dataTableVerification": {
      "minRowCount": 5
    }
  }
}
```

## Tightening Thresholds

After confirming what the portal actually serves, you can raise thresholds to catch larger regressions earlier. The portal currently has ~57 buttons, ~477 links, and ~2300 filter inputs:

```json
{
  "tests": {
    "filterInteraction": {
      "minFilterCount": 20
    },
    "dataTableVerification": {
      "minRowCount": 10,
      "tableSelectors": ["table", ".dataTable", "[role='table']"]
    }
  }
}
```

## Testing Against Staging

Rather than editing `test-config.json`, override the URL at runtime:

```bash
PORTAL_URL=https://testing-portal.canceridc.dev/explore/ npm test
```

Or set it permanently in `test-config.json` for local development:

```json
{
  "testUrl": "https://testing-portal.canceridc.dev/explore/",
  "pageLoadTimeout": 90000
}
```

Note: the GitHub Actions staging job uses the `PORTAL_URL` **repository variable**, not this file. See [GITHUB-ACTIONS-GUIDE.md](GITHUB-ACTIONS-GUIDE.md).

## Adjusting Timeouts

The portal typically loads in 15–30 seconds but can be slower. If you see timeout failures:

```json
{
  "pageLoadTimeout": 120000
}
```

And increase `test.setTimeout(180000)` in the relevant `beforeAll` to match.

## Customizing Selectors

If the portal's HTML structure changes and selector-based tests start failing, update them here without touching the spec files:

```json
{
  "tests": {
    "pageLoad": {
      "selectors": {
        "filterPanel": ".filter-panel, #filters-panel, [data-filters]",
        "dataTable": ".data-table, table, [role='table']",
        "navigationMenu": "nav, [role='navigation'], .navbar"
      }
    },
    "filterInteraction": {
      "selectors": {
        "filterButton": "button.filter-btn, .apply-filters-btn",
        "filterPanel": ".filters, #filters, .filter-panel",
        "resetButton": "button.reset-filters, .clear-filters"
      }
    },
    "cartFunctionality": {
      "selectors": {
        "cartIcon": ".cart, #cart, [data-cart]",
        "addToCart": "button[data-add-to-cart], .add-to-cart"
      }
    }
  }
}
```

## Network Monitoring

Control whether network requests are tracked:

```json
{
  "networkMonitoring": {
    "enabled": true,
    "trackAPICalls": true,
    "captureFailedRequests": true
  }
}
```

Tracked API call patterns are defined in `referenceResults.expectedAPICalls`.

## Expected Keywords and API Calls

Used by `idc-portal.spec.js` to assert all keywords are present and by `regression.spec.js` to flag if any go missing:

```json
{
  "referenceResults": {
    "expectedTitle": "IDC",
    "expectedKeywords": [
      "imaging", "data", "commons", "explore",
      "portal", "collection", "cohort"
    ],
    "expectedAPICalls": ["/api/", "/cohorts/", "/collections/"]
  }
}
```

## Disabling Individual Tests

Each top-level test in `idc-portal.spec.js` checks `config.tests.<name>.enabled`. To skip a test without deleting it:

```json
{
  "tests": {
    "cartFunctionality": {
      "enabled": false
    }
  }
}
```

Note: `data-table.spec.js`, `navigation.spec.js`, and `regression.spec.js` do not currently check `enabled` flags — to skip them, use `npx playwright test --ignore-glob "tests/regression.spec.js"`.
