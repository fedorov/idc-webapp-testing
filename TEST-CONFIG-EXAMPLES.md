# IDC Web Portal Test Configuration Examples

This document provides examples of how to customize the test configuration in `test-config.json`.

## Basic Configuration

The `test-config.json` file controls all aspects of testing behavior:

```json
{
  "testUrl": "https://testing-portal.canceridc.dev/explore/",
  "pageLoadTimeout": 90000
}
```

## Enabling/Disabling Tests

Each test can be individually enabled or disabled:

```json
{
  "tests": {
    "pageLoad": {
      "enabled": true,  // Set to false to skip this test
      "description": "Verify the explore page loads successfully"
    }
  }
}
```

## Customizing Selectors

You can customize the CSS selectors used to find elements:

```json
{
  "tests": {
    "filterInteraction": {
      "enabled": true,
      "selectors": {
        "filterButton": "button.filter-btn, .apply-filters-btn",
        "resetButton": "button.reset-filters, .clear-filters"
      }
    }
  }
}
```

## Network Monitoring

Enable or disable network request tracking:

```json
{
  "networkMonitoring": {
    "enabled": true,
    "trackAPICalls": true,
    "captureFailedRequests": true
  }
}
```

## Reference Results

Define what the tests should look for:

```json
{
  "referenceResults": {
    "expectedTitle": "IDC",
    "expectedKeywords": [
      "imaging",
      "data",
      "commons"
    ]
  }
}
```

## Timeout Adjustments

If the portal loads slowly, increase timeouts:

```json
{
  "pageLoadTimeout": 120000,  // 2 minutes
  "tests": {
    "databaseInteraction": {
      "waitAfterLoad": 10000  // Wait 10 seconds after initial load
    }
  }
}
```

## Example: Testing a Different Environment

To test a different environment, create a new config file:

**test-config.production.json**
```json
{
  "testUrl": "https://portal.canceridc.dev/explore/",
  "pageLoadTimeout": 60000,
  "tests": {
    "pageLoad": { "enabled": true },
    "databaseInteraction": { "enabled": true },
    "filterInteraction": { "enabled": false },
    "dataTableVerification": { "enabled": true },
    "cartFunctionality": { "enabled": true }
  }
}
```

Then run tests with: `CONFIG=production npm test`

## Example: Focused Testing

Test only specific features:

```json
{
  "tests": {
    "pageLoad": { "enabled": true },
    "databaseInteraction": { "enabled": false },
    "filterInteraction": { "enabled": true },
    "dataTableVerification": { "enabled": false },
    "cartFunctionality": { "enabled": false }
  }
}
```

## Example: Comprehensive Testing

Enable all tests with extended timeouts:

```json
{
  "testUrl": "https://testing-portal.canceridc.dev/explore/",
  "pageLoadTimeout": 120000,
  "tests": {
    "pageLoad": { 
      "enabled": true,
      "selectors": {
        "filterPanel": ".filter-panel, #filters-panel",
        "dataTable": ".data-table, table",
        "navigationMenu": "nav, .navbar"
      }
    },
    "databaseInteraction": { 
      "enabled": true,
      "waitForNetworkIdle": true,
      "waitAfterLoad": 5000
    },
    "filterInteraction": { "enabled": true },
    "dataTableVerification": { "enabled": true },
    "cartFunctionality": { "enabled": true }
  },
  "networkMonitoring": {
    "enabled": true,
    "trackAPICalls": true,
    "captureFailedRequests": true
  }
}
```
