#!/usr/bin/env node
/**
 * Capture screenshots of every IDC viewer test case in idc-viewer-test-samples.md
 * and generate an HTML gallery page (index.html) within the output directory.
 *
 * Usage:
 *   node scripts/viewer-gallery.js [options]
 *
 * Options:
 *   --out <dir>             Output directory (default: screenshots/production)
 *   --label <name>          Gallery label shown in HTML (default: "Production")
 *   --viewer-base <url>     Replace the production viewer base URL with this one.
 *                           Use for testing-tier runs, e.g.:
 *                           --viewer-base https://testing-viewer.canceridc.dev
 *   --concurrency <n>       Parallel browser contexts (default: 4)
 *   --wait <ms>             Extra wait after networkidle (default: 10000)
 *   --timeout <ms>          Per-page navigation timeout (default: 120000)
 *   --headed                Show browser windows
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SAMPLES_MD = path.join(REPO_ROOT, 'idc-viewer-test-samples.md');
const PRODUCTION_BASE = 'https://viewer.imaging.datacommons.cancer.gov';

// ---------------------------------------------------------------------------
// Markdown parser
// ---------------------------------------------------------------------------
export function parseTestSamples(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf-8');
  const tests = [];
  let section = '';
  let subsection = '';

  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) { section = line.replace(/^##\s+/, '').trimEnd(); subsection = ''; continue; }
    if (line.startsWith('### ')) { subsection = line.replace(/^###\s+/, '').trimEnd(); continue; }

    const idMatch = line.match(/^\|\s*(R\d+|P\d+)\s*\|/);
    if (!idMatch) continue;
    const id = idMatch[1];

    const allUrls = [...line.matchAll(/\[View[^\]]*\]\((https?:\/\/[^)]+)\)/g)];
    if (!allUrls.length) continue;
    const url = allUrls[allUrls.length - 1][1];

    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    const category = cells[1] || '';

    const backtickValues = [...line.matchAll(/`([^`]+)`/g)].map(m => m[1]);
    const collection = backtickValues.find(v => /[a-z_]/.test(v) && !/^\d/.test(v)) || '';

    const noteMatch = line.match(/\|\s*([^|[`][^|]*?)\s*\|\s*\[View/);
    const notes = noteMatch ? noteMatch[1].trim() : '';

    tests.push({ id, section, subsection, category, collection, notes, url });
  }
  return tests;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    out: path.join(REPO_ROOT, 'screenshots', 'production'),
    label: 'Production',
    viewerBase: null,
    concurrency: 4,
    wait: 60000,
    timeout: 120000,
    headed: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out')          { opts.out = args[++i]; }
    else if (args[i] === '--label')   { opts.label = args[++i]; }
    else if (args[i] === '--viewer-base') { opts.viewerBase = args[++i].replace(/\/$/, ''); }
    else if (args[i] === '--concurrency') { opts.concurrency = parseInt(args[++i], 10); }
    else if (args[i] === '--wait')    { opts.wait = parseInt(args[++i], 10); }
    else if (args[i] === '--timeout') { opts.timeout = parseInt(args[++i], 10); }
    else if (args[i] === '--headed')  { opts.headed = true; }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Bounded concurrency runner
// ---------------------------------------------------------------------------
async function runWithConcurrency(items, fn, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Wait for viewer canvas to fill with image content (polls every 5 s).
//
// Two viewers, two canvas technologies, two readiness signals:
//
//   OHIF (/v3/viewer/…)  — cornerstoneJS renders to a 2D canvas.
//     Loading state : canvas is all-black (spinner is a DOM overlay).
//     Ready signal  : >1% of sampled pixels are non-black.
//
//   SLIM (/slim/…)       — OpenLayers renders to a WebGL canvas.
//     Loading state : canvas shows a uniform light-gray background.
//     Ready signal  : >1% of sampled pixels are chromatic
//                     (max(R,G,B)−min(R,G,B) > 30), indicating slide tiles.
//     Read method   : gl.readPixels (canvas.getContext('2d') returns null).
//
// Non-imaging IODs (RTPLAN, SR) never produce a canvas; after 15 s we give up
// and screenshot whatever the viewer is showing.
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

      // Pick the relevant canvas: WebGL for SLIM, 2D for OHIF
      const canvases = [...document.querySelectorAll('canvas')]
        .filter(c => c.width >= 100 && c.height >= 100)
        .sort((a, b) => b.width * b.height - a.width * a.height);

      if (!canvases.length) return { hasCanvas: false, ready: false };

      try {
        if (isSlim) {
          // --- SLIM: WebGL canvas, chromatic-pixel check ---
          const canvas = canvases.find(c => {
            const gl = c.getContext('webgl') || c.getContext('webgl2');
            return !!gl;
          });
          if (!canvas) return { hasCanvas: false, ready: false };
          const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
          const B = 20; // block size
          let chromatic = 0, total = 0;
          for (let gx = 0; gx < 5; gx++) {
            for (let gy = 0; gy < 5; gy++) {
              const x  = Math.max(0, Math.floor(canvas.width  * (gx + 0.5) / 5) - B / 2);
              const y  = Math.max(0, Math.floor(canvas.height * (gy + 0.5) / 5) - B / 2);
              const gy_gl = Math.max(0, canvas.height - y - B); // WebGL Y is flipped
              const px = new Uint8Array(B * B * 4);
              gl.readPixels(x, gy_gl, B, B, gl.RGBA, gl.UNSIGNED_BYTE, px);
              for (let i = 0; i < px.length; i += 4) {
                total++;
                if (Math.max(px[i], px[i+1], px[i+2]) - Math.min(px[i], px[i+1], px[i+2]) > 30) chromatic++;
              }
            }
          }
          return { hasCanvas: true, ready: chromatic / total > 0.01 };
        } else {
          // --- OHIF: 2D canvas, non-black-pixel check ---
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
        return { hasCanvas: true, ready: true }; // any error → assume ready
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
// Screenshot one test
// ---------------------------------------------------------------------------
async function screenshotOne(browser, { id, url }, opts) {
  const imgFile = path.join(opts.out, `${id}.png`);
  const effectiveUrl = opts.viewerBase
    ? url.replace(PRODUCTION_BASE, opts.viewerBase)
    : url;

  const page = await browser.newPage();
  try {
    process.stdout.write(`  [${id}] navigating…\n`);
    await page.goto(effectiveUrl, { waitUntil: 'domcontentloaded', timeout: opts.timeout });
    await page.waitForLoadState('networkidle', { timeout: opts.timeout }).catch(() => {
      process.stdout.write(`  [${id}] networkidle timed out — proceeding\n`);
    });
    await waitForViewerReady(page, opts.wait);
    await page.screenshot({ path: imgFile, fullPage: false });
    process.stdout.write(`  [${id}] saved ${id}.png\n`);
    return { id, ok: true, url: effectiveUrl };
  } catch (err) {
    process.stdout.write(`  [${id}] FAILED: ${err.message}\n`);
    return { id, ok: false, url: effectiveUrl, error: err.message };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// HTML gallery generator (single environment)
// ---------------------------------------------------------------------------
export function generateGalleryHtml(tests, results, label, generatedAt) {
  const byId = Object.fromEntries(results.map(r => [r.id, r]));
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;

  const groups = {};
  for (const t of tests) {
    const sec = t.section || 'Other';
    const sub = t.subsection || '';
    if (!groups[sec]) groups[sec] = {};
    if (!groups[sec][sub]) groups[sec][sub] = [];
    groups[sec][sub].push(t);
  }

  function card(t) {
    const r = byId[t.id];
    const imgTag = r?.ok
      ? `<a href="${escHtml(r.url)}" target="_blank" rel="noopener"><img src="${t.id}.png" alt="${t.id}" loading="lazy"></a>`
      : `<div class="card-error"><div class="error-icon">⚠</div><div>${escHtml(r?.error ?? 'Not run')}</div></div>`;
    return `
    <div class="card">
      <div class="card-header">
        <span class="test-id">${t.id}</span>
        <span class="status ${r?.ok ? 'ok' : 'error'}">${r?.ok ? 'OK' : 'FAILED'}</span>
      </div>
      ${imgTag}
      <div class="card-body">
        <div class="category">${escHtml(t.category)}</div>
        ${t.collection ? `<div class="collection">${escHtml(t.collection)}</div>` : ''}
        ${t.notes ? `<div class="notes">${escHtml(t.notes)}</div>` : ''}
        <a class="view-link" href="${escHtml(r?.url ?? t.url)}" target="_blank" rel="noopener">Open viewer ↗</a>
      </div>
    </div>`;
  }

  const sectionsHtml = Object.entries(groups).map(([sec, subs]) => `
  <h2>${escHtml(sec)}</h2>
  ${Object.entries(subs).map(([sub, items]) => `
    ${sub ? `<h3>${escHtml(sub)}</h3>` : ''}
    <div class="grid">${items.map(card).join('')}</div>`).join('')}`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IDC Viewer Gallery — ${escHtml(label)}</title>
  ${sharedStyles()}
</head>
<body>
<div class="page-wrap">
  <header>
    <h1>IDC Viewer Gallery — ${escHtml(label)}</h1>
    <div class="meta">Generated: ${escHtml(generatedAt)} · Source: idc-viewer-test-samples.md</div>
    <div class="summary">
      <span class="pill tot">${results.length} total</span>
      <span class="pill ok">✓ ${passed} passed</span>
      ${failed ? `<span class="pill err">✗ ${failed} failed</span>` : ''}
    </div>
  </header>
  ${sectionsHtml}
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Shared CSS (used by gallery and comparison pages)
// ---------------------------------------------------------------------------
export function sharedStyles() {
  return `<style>
    :root {
      --bg:#0a0f1e; --surface:#111827; --card:#151c2e; --border:#1e2d40;
      --accent:#4fa3d1; --text:#dde6f0; --muted:#6a8499;
      --success:#4caf50; --error:#ef5350;
    }
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;}
    .page-wrap{max-width:1600px;margin:0 auto;padding:2rem 1.5rem;}
    header{margin-bottom:2.5rem;}
    h1{font-size:1.75rem;color:var(--accent);margin-bottom:.5rem;}
    .meta{color:var(--muted);font-size:.875rem;}
    .summary{display:flex;gap:.75rem;margin-top:1rem;flex-wrap:wrap;}
    .pill{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .8rem;
          border-radius:99px;font-size:.8rem;font-weight:500;border:1px solid;}
    .pill.ok {border-color:var(--success);color:var(--success);background:#0d2410;}
    .pill.err{border-color:var(--error);  color:var(--error);  background:#240d0d;}
    .pill.tot{border-color:var(--border); color:var(--muted);  background:var(--surface);}
    h2{font-size:1.2rem;border-bottom:1px solid var(--border);
       padding-bottom:.5rem;margin:2.5rem 0 1rem;color:var(--text);}
    h3{font-size:.875rem;color:var(--muted);margin:1.5rem 0 .75rem;
       text-transform:uppercase;letter-spacing:.05em;}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem;}
    .card{background:var(--card);border:1px solid var(--border);border-radius:8px;
          overflow:hidden;display:flex;flex-direction:column;}
    .card-header{padding:.5rem .75rem;background:var(--surface);
                 display:flex;justify-content:space-between;align-items:center;}
    .test-id{font-weight:700;font-size:1rem;color:var(--accent);letter-spacing:.02em;}
    .status{font-size:.7rem;font-weight:600;padding:2px 8px;border-radius:99px;
            text-transform:uppercase;letter-spacing:.05em;}
    .status.ok   {background:#0d2410;color:var(--success);border:1px solid var(--success);}
    .status.error{background:#240d0d;color:var(--error);  border:1px solid var(--error);}
    .card a img{width:100%;display:block;object-fit:cover;
                transition:opacity .15s;border-bottom:1px solid var(--border);}
    .card a:hover img{opacity:.85;}
    .card-error{padding:2rem 1rem;text-align:center;color:var(--error);
                font-size:.8rem;background:#1a0f0f;flex:1;
                display:flex;flex-direction:column;align-items:center;gap:.5rem;}
    .error-icon{font-size:2rem;}
    .card-body{padding:.75rem;flex:1;display:flex;flex-direction:column;gap:.3rem;}
    .category{font-size:.875rem;font-weight:500;}
    .collection{font-size:.75rem;color:var(--accent);font-family:ui-monospace,monospace;}
    .notes{font-size:.75rem;color:var(--muted);line-height:1.4;flex:1;}
    .view-link{display:inline-block;margin-top:.5rem;font-size:.75rem;color:var(--accent);
               text-decoration:none;border:1px solid var(--accent);padding:3px 10px;
               border-radius:4px;align-self:flex-start;transition:background .15s,color .15s;}
    .view-link:hover{background:var(--accent);color:#000;}
    @media(max-width:600px){.grid{grid-template-columns:1fr;}}
  </style>`;
}

export function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv);
  const tests = parseTestSamples(SAMPLES_MD);
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  console.log(`Gallery: ${opts.label}`);
  console.log(`Found ${tests.length} tests | concurrency: ${opts.concurrency} | wait: ${opts.wait} ms`);
  if (opts.viewerBase) console.log(`URL base → ${opts.viewerBase}`);
  fs.mkdirSync(opts.out, { recursive: true });

  const browser = await chromium.launch({ headless: !opts.headed });
  let results;
  try {
    results = await runWithConcurrency(
      tests,
      (t) => screenshotOne(browser, t, opts),
      opts.concurrency,
    );
  } finally {
    await browser.close();
  }

  // Save metadata for use by the comparison page builder
  fs.writeFileSync(
    path.join(opts.out, 'results.json'),
    JSON.stringify({ label: opts.label, generatedAt, results }, null, 2),
  );

  const html = generateGalleryHtml(tests, results, opts.label, generatedAt);
  fs.writeFileSync(path.join(opts.out, 'index.html'), html);

  const passed = results.filter(r => r.ok).length;
  console.log(`\nDone: ${passed}/${results.length} passed → ${opts.out}/index.html`);
}

// Only run when invoked directly, not when imported by build-comparison.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err); process.exit(1); });
}