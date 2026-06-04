#!/usr/bin/env node
/**
 * Build a side-by-side comparison HTML page from two viewer-gallery.js runs.
 *
 * Usage:
 *   node scripts/build-comparison.js <dir-a> <dir-b> <out-dir>
 *
 * Example:
 *   node scripts/build-comparison.js screenshots/production screenshots/testing screenshots/
 *
 * Reads <dir-a>/results.json and <dir-b>/results.json produced by viewer-gallery.js.
 * Writes <out-dir>/index.html with a side-by-side comparison grid.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseTestSamples, sharedStyles, escHtml } from './viewer-gallery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SAMPLES_MD = path.join(REPO_ROOT, 'idc-viewer-test-samples.md');

function loadResults(dir) {
  const p = path.join(dir, 'results.json');
  if (!fs.existsSync(p)) throw new Error(`results.json not found in ${dir}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function generateComparisonHtml(tests, dataA, dataB, dirA, dirB, generatedAt) {
  const byIdA = Object.fromEntries(dataA.results.map(r => [r.id, r]));
  const byIdB = Object.fromEntries(dataB.results.map(r => [r.id, r]));

  // Relative paths from the output dir to the two subdirs
  const relA = path.basename(dirA);
  const relB = path.basename(dirB);

  const passedA = dataA.results.filter(r => r.ok).length;
  const passedB = dataB.results.filter(r => r.ok).length;

  const groups = {};
  for (const t of tests) {
    const sec = t.section || 'Other';
    const sub = t.subsection || '';
    if (!groups[sec]) groups[sec] = {};
    if (!groups[sec][sub]) groups[sec][sub] = [];
    groups[sec][sub].push(t);
  }

  function halfCard(t, r, imgPrefix, viewerLabel) {
    const imgTag = r?.ok
      ? `<a href="${escHtml(r.url)}" target="_blank" rel="noopener">
           <img src="${imgPrefix}/${t.id}.png" alt="${t.id}" loading="lazy">
         </a>`
      : `<div class="card-error"><div class="error-icon">⚠</div>
           <div>${escHtml(r?.error ?? 'Not run')}</div></div>`;
    return `
        <div class="half">
          <div class="half-label ${r?.ok ? 'ok' : 'error'}">
            ${escHtml(viewerLabel)}
            <span class="status ${r?.ok ? 'ok' : 'error'}">${r?.ok ? 'OK' : 'FAILED'}</span>
          </div>
          ${imgTag}
          <div class="half-footer">
            <a class="view-link" href="${escHtml(r?.url ?? t.url)}" target="_blank" rel="noopener">Open ↗</a>
          </div>
        </div>`;
  }

  function card(t) {
    const rA = byIdA[t.id];
    const rB = byIdB[t.id];
    return `
    <div class="cmp-card">
      <div class="cmp-header">
        <span class="test-id">${t.id}</span>
        <span class="cmp-meta">${escHtml(t.category)}</span>
      </div>
      <div class="cmp-body">
        ${halfCard(t, rA, relA, dataA.label)}
        ${halfCard(t, rB, relB, dataB.label)}
      </div>
      <div class="cmp-footer">
        ${t.collection ? `<span class="collection">${escHtml(t.collection)}</span>` : ''}
        <span class="notes">${escHtml(t.notes)}</span>
      </div>
    </div>`;
  }

  const sectionsHtml = Object.entries(groups).map(([sec, subs]) => `
  <h2>${escHtml(sec)}</h2>
  ${Object.entries(subs).map(([sub, items]) => `
    ${sub ? `<h3>${escHtml(sub)}</h3>` : ''}
    <div class="cmp-grid">${items.map(card).join('')}</div>`).join('')}`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IDC Viewer Comparison — ${escHtml(dataA.label)} vs ${escHtml(dataB.label)}</title>
  ${sharedStyles()}
  <style>
    .env-badges { display:flex; gap:1rem; margin-top:1rem; flex-wrap:wrap; }
    .env-badge  { padding:.4rem 1rem; border-radius:6px; font-size:.85rem; font-weight:600;
                  border:1px solid var(--border); background:var(--surface); }
    .env-badge span { color:var(--accent); }
    .individual-links { margin-top:.75rem; font-size:.8rem; color:var(--muted); }
    .individual-links a { color:var(--accent); text-decoration:none; }
    .individual-links a:hover { text-decoration:underline; }

    .cmp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(580px,1fr)); gap:1.25rem; }
    .cmp-card { background:var(--card); border:1px solid var(--border); border-radius:8px; overflow:hidden; }
    .cmp-header { padding:.5rem .75rem; background:var(--surface);
                  display:flex; align-items:center; gap:.75rem; }
    .cmp-meta { font-size:.8rem; color:var(--muted); }

    .cmp-body { display:flex; border-top:1px solid var(--border); }
    .half { flex:1; min-width:0; border-right:1px solid var(--border); }
    .half:last-child { border-right:none; }
    .half-label { padding:.35rem .6rem; font-size:.72rem; font-weight:600;
                  display:flex; justify-content:space-between; align-items:center; }
    .half-label.ok    { background:#0a1f0a; color:var(--muted); }
    .half-label.error { background:#1f0a0a; color:var(--muted); }
    .half a img { width:100%; display:block; transition:opacity .15s;
                  border-bottom:1px solid var(--border); }
    .half a:hover img { opacity:.85; }
    .half-footer { padding:.4rem .6rem; }

    .cmp-footer { padding:.5rem .75rem; border-top:1px solid var(--border);
                  display:flex; gap:.75rem; align-items:baseline; flex-wrap:wrap; }

    @media(max-width:700px){ .cmp-grid{grid-template-columns:1fr;} .cmp-body{flex-direction:column;} }
  </style>
</head>
<body>
<div class="page-wrap">
  <header>
    <h1>IDC Viewer Comparison</h1>
    <div class="meta">Generated: ${escHtml(generatedAt)} · Source: idc-viewer-test-samples.md</div>
    <div class="env-badges">
      <div class="env-badge">${escHtml(dataA.label)} <span>${passedA}/${dataA.results.length} OK</span></div>
      <div class="env-badge">${escHtml(dataB.label)} <span>${passedB}/${dataB.results.length} OK</span></div>
    </div>
    <div class="individual-links">
      Individual galleries:
      <a href="${relA}/index.html">${escHtml(dataA.label)}</a> ·
      <a href="${relB}/index.html">${escHtml(dataB.label)}</a>
    </div>
  </header>
  ${sectionsHtml}
</div>
</body>
</html>`;
}

async function main() {
  const [,, dirA, dirB, outDir] = process.argv;
  if (!dirA || !dirB || !outDir) {
    console.error('Usage: node scripts/build-comparison.js <dir-a> <dir-b> <out-dir>');
    process.exit(1);
  }

  const tests = parseTestSamples(SAMPLES_MD);
  const dataA = loadResults(dirA);
  const dataB = loadResults(dirB);
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  fs.mkdirSync(outDir, { recursive: true });
  const html = generateComparisonHtml(tests, dataA, dataB, dirA, dirB, generatedAt);
  const outFile = path.join(outDir, 'index.html');
  fs.writeFileSync(outFile, html);
  console.log(`Comparison page written: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });