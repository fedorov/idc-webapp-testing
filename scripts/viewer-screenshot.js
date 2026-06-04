#!/usr/bin/env node
/**
 * Take a screenshot of an IDC viewer test case from idc-viewer-test-samples.md.
 *
 * Usage:
 *   node scripts/viewer-screenshot.js <TEST_ID> [options]
 *
 * Examples:
 *   node scripts/viewer-screenshot.js R1
 *   node scripts/viewer-screenshot.js P2 --headed
 *   node scripts/viewer-screenshot.js R6 --wait 20000 --out screenshots/
 *
 * Options:
 *   --headed        Show browser window (default: headless)
 *   --wait <ms>     Extra ms to wait after networkidle for viewer rendering (default: 10000)
 *   --out <dir>     Output directory for screenshots (default: screenshots/)
 *   --timeout <ms>  Page load / networkidle timeout in ms (default: 120000)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SAMPLES_MD = path.join(REPO_ROOT, 'idc-viewer-test-samples.md');

// ---------------------------------------------------------------------------
// Markdown parser — extracts { testId -> viewerUrl } from the samples file
// ---------------------------------------------------------------------------
function parseTestSamples(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf-8');
  const tests = {};

  // Match table rows that start with a test ID like R1 or P12
  const rowRe = /^\|\s*(R\d+|P\d+)\s*\|(.+)$/;
  // Last [View...](url) on the line is the viewer link
  const urlRe = /\[View[^\]]*\]\((https?:\/\/[^)]+)\)/g;

  for (const line of content.split('\n')) {
    const rowMatch = line.match(rowRe);
    if (!rowMatch) continue;
    const id = rowMatch[1];
    const urls = [...line.matchAll(urlRe)];
    if (urls.length > 0) {
      tests[id] = urls[urls.length - 1][1];
    }
  }

  return tests;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    testId: null,
    headed: false,
    wait: 10000,
    out: path.join(REPO_ROOT, 'screenshots'),
    timeout: 120000,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--headed') {
      opts.headed = true;
    } else if (a === '--wait') {
      opts.wait = parseInt(args[++i], 10);
    } else if (a === '--out') {
      opts.out = args[++i];
    } else if (a === '--timeout') {
      opts.timeout = parseInt(args[++i], 10);
    } else if (!a.startsWith('--')) {
      opts.testId = a.toUpperCase();
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.testId) {
    console.error('Usage: node scripts/viewer-screenshot.js <TEST_ID> [--headed] [--wait <ms>] [--out <dir>] [--timeout <ms>]');
    process.exit(1);
  }

  const tests = parseTestSamples(SAMPLES_MD);

  if (!tests[opts.testId]) {
    const known = Object.keys(tests).sort().join(', ');
    console.error(`Unknown test ID: ${opts.testId}`);
    console.error(`Known IDs: ${known}`);
    process.exit(1);
  }

  const url = tests[opts.testId];
  console.log(`[${opts.testId}] URL: ${url}`);

  fs.mkdirSync(opts.out, { recursive: true });
  const outFile = path.join(opts.out, `${opts.testId}.png`);

  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    console.log(`[${opts.testId}] Navigating…`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeout });

    console.log(`[${opts.testId}] Waiting for network idle…`);
    await page.waitForLoadState('networkidle', { timeout: opts.timeout }).catch(() => {
      console.warn(`[${opts.testId}] networkidle timed out — proceeding anyway`);
    });

    if (opts.wait > 0) {
      console.log(`[${opts.testId}] Extra wait ${opts.wait} ms for viewer rendering…`);
      await page.waitForTimeout(opts.wait);
    }

    await page.screenshot({ path: outFile, fullPage: false });
    console.log(`[${opts.testId}] Screenshot saved: ${outFile}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});