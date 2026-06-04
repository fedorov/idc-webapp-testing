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
    wait: 60000,
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
// Wait for viewer canvas to fill with image content (polls every 5 s).
// See viewer-gallery.js for full rationale and per-viewer strategy.
// ---------------------------------------------------------------------------
async function waitForViewerReady(page, maxWait) {
  const POLL = 5000;
  const NO_CANVAS_GIVE_UP = 15000;
  const deadline = Date.now() + maxWait;
  const start = Date.now();
  let sawCanvas = false;

  while (Date.now() < deadline) {
    const { hasCanvas, ready } = await page.evaluate(() => {
      const isSlim = window.location.href.includes('/slim/');
      const canvases = [...document.querySelectorAll('canvas')]
        .filter(c => c.width >= 100 && c.height >= 100)
        .sort((a, b) => b.width * b.height - a.width * a.height);
      if (!canvases.length) return { hasCanvas: false, ready: false };
      try {
        if (isSlim) {
          const canvas = canvases.find(c => !!(c.getContext('webgl') || c.getContext('webgl2')));
          if (!canvas) return { hasCanvas: false, ready: false };
          const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
          const B = 20;
          let chromatic = 0, total = 0;
          for (let gx = 0; gx < 5; gx++) {
            for (let gy = 0; gy < 5; gy++) {
              const x   = Math.max(0, Math.floor(canvas.width  * (gx + 0.5) / 5) - B / 2);
              const y   = Math.max(0, Math.floor(canvas.height * (gy + 0.5) / 5) - B / 2);
              const gygl = Math.max(0, canvas.height - y - B);
              const px  = new Uint8Array(B * B * 4);
              gl.readPixels(x, gygl, B, B, gl.RGBA, gl.UNSIGNED_BYTE, px);
              for (let i = 0; i < px.length; i += 4) {
                total++;
                if (Math.max(px[i], px[i+1], px[i+2]) - Math.min(px[i], px[i+1], px[i+2]) > 30) chromatic++;
              }
            }
          }
          return { hasCanvas: true, ready: chromatic / total > 0.01 };
        } else {
          const canvas = canvases.find(c => !!c.getContext('2d'));
          if (!canvas) return { hasCanvas: false, ready: false };
          const ctx = canvas.getContext('2d');
          let nonBlack = 0, total = 0;
          for (let gx = 0; gx < 5; gx++) {
            for (let gy = 0; gy < 5; gy++) {
              const x = Math.max(0, Math.floor(canvas.width  * (gx + 0.5) / 5) - 10);
              const y = Math.max(0, Math.floor(canvas.height * (gy + 0.5) / 5) - 10);
              const d = ctx.getImageData(x, y, 20, 20).data;
              for (let i = 0; i < d.length; i += 4) {
                total++;
                if (d[i] > 8 || d[i+1] > 8 || d[i+2] > 8) nonBlack++;
              }
            }
          }
          return { hasCanvas: true, ready: nonBlack / total > 0.01 };
        }
      } catch {
        return { hasCanvas: true, ready: true };
      }
    }).catch(() => ({ hasCanvas: false, ready: false }));

    if (ready) return;
    if (hasCanvas) sawCanvas = true;
    if (!sawCanvas && Date.now() - start > NO_CANVAS_GIVE_UP) return;

    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    await page.waitForTimeout(Math.min(POLL, remaining));
  }
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

    console.log(`[${opts.testId}] Waiting for viewer to render (up to ${opts.wait} ms)…`);
    await waitForViewerReady(page, opts.wait);

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