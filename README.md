# IDC Web Portal Automated Testing

Automated testing infrastructure for the [NCI Imaging Data Commons (IDC)](https://portal.imaging.datacommons.cancer.gov/) web portal using Playwright and GitHub Actions.

## Overview

This repository provides automated browser testing for the IDC web portal. The tests handle the complex nature of the portal, including:

- Database interactions
- Long page load times (~1 minute)
- Dynamic content loading
- Configurable test scenarios
- Reference result verification
- **Automatic government warning popup dismissal**

## Features

- **Automated Testing**: GitHub Actions workflow runs tests automatically
- **Configurable Tests**: Customize test scenarios via `test-config.json`
- **Reference Results**: Capture and compare against baseline results
- **Screenshots**: Automatic screenshot capture for visual verification
- **Multiple Triggers**: Run on push, pull request, schedule, or manually
- **Comprehensive Reports**: HTML reports with videos and traces
- **Smart Popup Handling**: Automatically detects and closes government warning dialogs

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/fedorov/idc-webapp-testing.git
cd idc-webapp-testing

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Running Tests Locally

```bash
# Run all tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Debug tests interactively
npm run test:debug

# View test report
npm run report

# Run tests against a different URL
PORTAL_URL=https://example.com/explore npm test
```

## Configuration

### Test URL

The test URL can be configured in two ways:

1. **Default**: Set in `test-config.json` as `testUrl`
2. **Environment Variable**: Set `PORTAL_URL` environment variable (overrides config file)

In GitHub Actions, the URL is controlled by the `PORTAL_URL` repository variable. To set it:
1. Go to repository **Settings** → **Secrets and variables** → **Actions** → **Variables**
2. Create or update `PORTAL_URL` variable with your desired URL
3. If not set, tests will use the default from `test-config.json`

### Test Configuration (`test-config.json`)

Customize test behavior by editing `test-config.json`:

```json
{
  "testUrl": "https://portal.imaging.datacommons.cancer.gov/explore/",
  "pageLoadTimeout": 90000,
  "tests": {
    "pageLoad": {
      "enabled": true,
      "description": "Verify the portal loads successfully"
    },
    "databaseInteraction": {
      "enabled": true,
      "description": "Test database interactions",
      "waitForNetworkIdle": true
    },
    "exploration": {
      "enabled": true,
      "description": "Test exploration features"
    }
  }
}
```

### Playwright Configuration (`playwright.config.js`)

- Timeout: 2 minutes per test (accommodates slow load times)
- Retries: 2 retries on CI, 0 locally
- Screenshots: Captured on failure
- Videos: Recorded on failure
- Traces: Captured on first retry

## GitHub Actions Workflow

The automated testing workflow (`.github/workflows/test.yml`) runs:

- On every push to main/master branch
- On every pull request
- Daily at 2 AM UTC (scheduled)
- Manually via workflow dispatch

### Workflow Outputs

- **Test Results**: JSON results and logs
- **Screenshots**: PNG screenshots of test runs
- **Reference Results**: Baseline data for comparison
- **HTML Report**: Interactive Playwright report

## Test Structure

### Available Tests

1. **Page Load Test**: Verifies the explore page loads successfully
   - Checks page title
   - Validates content presence
   - Captures full page screenshot

2. **Database Interaction Test**: Tests database connectivity
   - Waits for network idle
   - Verifies data-related elements
   - Captures data view screenshot

3. **Exploration Features Test**: Tests interactive elements
   - Counts buttons and links
   - Verifies interactive components
   - Tests common exploration patterns

4. **Reference Results Test**: Generates baseline data
   - Saves page metadata
   - Captures element counts
   - Creates reference screenshot

### Government Warning Popup Handling

All tests automatically detect and close the government warning popup that appears on first visit:

- **Automatic Detection**: Tests specifically look for the `#gov_warning` element with 10-second timeout
- **Delayed Check**: Popup is checked AFTER page is fully loaded (network idle), as it may be triggered by JavaScript
- **Multiple Selectors**: Supports various button texts ("OK", "I Agree", "Accept", "Continue")
- **Wait for Closure**: Verifies the popup is actually hidden before proceeding
- **Graceful Handling**: If no popup is found, tests continue normally
- **Logging**: All popup interactions are logged for debugging

The popup check happens after `waitForPageReady()` to ensure any JavaScript-triggered popups have time to appear.

## Reference Results

Tests generate reference results in `test-results/reference-results.json`:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "url": "https://portal.imaging.datacommons.cancer.gov/explore/",
  "title": "IDC Portal",
  "contentLength": 50000,
  "hasDataElements": true,
  "elementCounts": {
    "buttons": 25,
    "links": 150,
    "inputs": 10
  }
}
```

## Troubleshooting

### Tests Timeout

If tests timeout, try increasing the timeout in `playwright.config.js` or `test-config.json`:

```javascript
timeout: 180 * 1000, // 3 minutes
```

### Network Issues

The portal requires internet access. Ensure:
- Network connectivity is stable
- The portal URL is accessible
- No firewall blocking

### Browser Installation

If browsers aren't installed:

```bash
npx playwright install --with-deps chromium
```

## Development

### Adding New Tests

Create a new test file in the `tests/` directory:

```javascript
import { test, expect } from '@playwright/test';

test('my new test', async ({ page }) => {
  await page.goto('https://portal.imaging.datacommons.cancer.gov/explore/');
  // Your test code here
});
```

### Modifying Test Configuration

Edit `test-config.json` to:
- Enable/disable specific tests
- Change timeouts
- Add new test scenarios
- Modify expected results

## CI/CD Integration

The GitHub Actions workflow automatically:
1. Checks out the code
2. Installs Node.js dependencies
3. Installs Playwright browsers
4. Runs the test suite
5. Uploads artifacts (reports, screenshots, reference results)

Access artifacts from the GitHub Actions UI under each workflow run.

## Related Projects

- [IDC Web App Source](https://github.com/ImagingDataCommons/IDC-WebApp)
- [IDC Portal](https://portal.imaging.datacommons.cancer.gov/)

## License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## Support

For issues or questions:
- Open an issue in this repository
- Refer to [Playwright documentation](https://playwright.dev/)
- Check [IDC documentation](https://learn.canceridc.dev/)
