#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(msg, type = 'info') {
  const prefix = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[PASS]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
    error: `${colors.red}[FAIL]${colors.reset}`,
    header: `${colors.bold}${colors.cyan}==>${colors.reset}`
  }[type] || colors.blue;

  console.log(`${prefix} ${msg}`);
}

// Parse Command Line Arguments
const args = process.argv.slice(2);
let runUnit = args.includes('--unit');
let runCatalog = args.includes('--catalog');
let runA11y = args.includes('--a11y');
let runVisual = args.includes('--visual');
const updateSnapshots = args.includes('--update-snapshots') || args.includes('--update');
const helpFlag = args.includes('--help') || args.includes('-h');

const portArgIdx = args.indexOf('--port');
let customPort = portArgIdx !== -1 && args[portArgIdx + 1] ? parseInt(args[portArgIdx + 1], 10) : 0;

if (helpFlag) {
  console.log(`
${colors.bold}Unified Design System Validation CLI (tools/ci-runner.mjs)${colors.reset}

${colors.bold}USAGE:${colors.reset}
  node tools/ci-runner.mjs [FLAGS]

${colors.bold}FLAGS:${colors.reset}
  --unit              Run unit test suites
  --catalog           Run theme catalog parity checks
  --a11y              Run automated WCAG 2.1 AA accessibility auditing
  --visual            Run Playwright visual snapshot regression suite
  --update-snapshots  Update visual baseline snapshots
  --port <number>     Specify static server port override
  --help, -h          Show this help message

  ${colors.gray}If no task flags (--unit, --catalog, --a11y, --visual) are specified,
  all applicable validation tasks for the current repository will run.${colors.reset}
`);
  process.exit(0);
}

// If no specific task flag was passed, run all tasks applicable to the current repo
if (!runUnit && !runCatalog && !runA11y && !runVisual) {
  runUnit = true;
  runCatalog = true;
  runA11y = true;
  runVisual = true;
}

// Signal and process cleanup handler
const activeServers = new Set();
function cleanup() {
  for (const s of activeServers) {
    try {
      s.close();
    } catch (_) {}
  }
  activeServers.clear();
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

// Server Harness Helper
async function findFreePort(startingPort = 0) {
  if (startingPort > 0) return startingPort;
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8'
  };
  return map[ext] || 'application/octet-stream';
}

async function startServerHarness(rootDirectory, requestedPort = 0) {
  const port = await findFreePort(requestedPort);
  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    let safePath = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\.\.[\/\\])+/, '');
    let fullPath = path.join(rootDirectory, safePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      fullPath = path.join(fullPath, 'index.html');
    }

    if (!fs.existsSync(fullPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    try {
      const data = fs.readFileSync(fullPath);
      res.writeHead(200, {
        'Content-Type': getMimeType(fullPath),
        'Cache-Control': 'no-store'
      });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`500 Internal Server Error: ${err.message}`);
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      activeServers.add(server);
      log(`Static server harness listening at http://127.0.0.1:${port}/ serving ${rootDirectory}`, 'info');
      resolve({
        port,
        url: `http://127.0.0.1:${port}`,
        close: async () => {
          activeServers.delete(server);
          return new Promise((res) => server.close(res));
        }
      });
    });
    server.on('error', reject);
  });
}

// Pure Node PNG Parser & Pixel Matcher Helper
function parsePNG(buffer) {
  let offset = 8;
  let width = 0, height = 0;
  const idatChunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const idatCombined = Buffer.concat(idatChunks);
  const raw = zlib.inflateSync(idatCombined);
  return { width, height, raw };
}

function comparePNGBuffers(bufA, bufB, colorThreshold = 15) {
  try {
    const pngA = parsePNG(bufA);
    const pngB = parsePNG(bufB);

    if (pngA.width !== pngB.width || pngA.height !== pngB.height) {
      return { match: false, diffPercent: 100, reason: `Dimension mismatch (${pngA.width}x${pngA.height} vs ${pngB.width}x${pngB.height})` };
    }

    const totalPixels = pngA.width * pngA.height;
    let diffPixels = 0;
    const bytesPerRow = 1 + pngA.width * 4;

    for (let y = 0; y < pngA.height; y++) {
      const rowStart = y * bytesPerRow + 1; // skip filter byte
      for (let x = 0; x < pngA.width; x++) {
        const px = rowStart + x * 4;
        const dr = Math.abs(pngA.raw[px] - pngB.raw[px]);
        const dg = Math.abs(pngA.raw[px + 1] - pngB.raw[px + 1]);
        const db = Math.abs(pngA.raw[px + 2] - pngB.raw[px + 2]);
        const da = Math.abs(pngA.raw[px + 3] - pngB.raw[px + 3]);

        if (dr > colorThreshold || dg > colorThreshold || db > colorThreshold || da > colorThreshold) {
          diffPixels++;
        }
      }
    }

    const diffPercent = (diffPixels / totalPixels) * 100;
    return {
      match: diffPercent <= 0.1,
      diffPercent: parseFloat(diffPercent.toFixed(3)),
      diffPixels,
      totalPixels
    };
  } catch (e) {
    // Fallback byte-wise buffer compare if PNG parsing fails
    const isExact = bufA.equals(bufB);
    return { match: isExact, diffPercent: isExact ? 0 : 100, reason: `Buffer comparison (PNG parse error: ${e.message})` };
  }
}

// Helper to resolve Playwright browser launch
async function getPlaywrightBrowser() {
  const playwright = await import('playwright');
  const possiblePaths = [
    process.env.CHROMIUM_PATH,
    '/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ].filter(Boolean);

  let executablePath = possiblePaths.find(p => fs.existsSync(p));

  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb']
  };

  if (executablePath) {
    launchOpts.executablePath = executablePath;
  }

  return await playwright.chromium.launch(launchOpts);
}

// TASK 1: Unit Tests
async function taskUnitTests() {
  log('Running Unit Test Suite...', 'header');

  const hasKthemeJest = fs.existsSync(path.join(cwd, 'jest.config.js')) || fs.existsSync(path.join(cwd, 'src/core/ThemeEngine.ts'));
  const hasReactVitest = fs.existsSync(path.join(cwd, 'docs/react/package.json'));

  let success = true;

  if (hasKthemeJest) {
    log('Executing Ktheme Jest Unit Tests...', 'info');
    const res = spawnSync('npm', ['test'], { cwd, stdio: 'inherit', shell: true });
    if (res.status !== 0) success = false;
  }

  if (hasReactVitest) {
    log('Executing React Linkpoint Vitest Suite...', 'info');
    const reactDir = path.join(cwd, 'docs/react');
    const res = spawnSync('npm', ['test'], { cwd: reactDir, stdio: 'inherit', shell: true });
    if (res.status !== 0) success = false;
  }

  if (!hasKthemeJest && !hasReactVitest) {
    log('No specific unit test runner found for this directory. Skipped.', 'warn');
    return true;
  }

  if (success) {
    log('Unit tests passed successfully.', 'success');
  } else {
    log('Unit tests failed.', 'error');
  }
  return success;
}

// TASK 2: Catalog Parity Check
async function taskCatalogCheck() {
  const scriptPath = path.join(cwd, 'scripts/generate-theme-catalog.mjs');
  if (!fs.existsSync(scriptPath)) {
    log('No theme catalog generator script found in this repository. Skipped.', 'info');
    return true;
  }

  log('Checking Theme Catalog Parity...', 'header');
  const res = spawnSync('node', [scriptPath, '--check'], { cwd, stdio: 'inherit' });
  if (res.status === 0) {
    log('Theme catalog parity verified.', 'success');
    return true;
  } else {
    log('Theme catalog is out of sync with SHARED_PRESET_REGISTRY.', 'error');
    return false;
  }
}

// TASK 3: WCAG 2.1 AA Accessibility Audit
async function taskA11yAudit() {
  log('Running WCAG 2.1 AA Accessibility Audit on Live DOM Nodes...', 'header');

  let server;
  let targetUrl;

  const docsIndex = path.join(cwd, 'docs/index.html');
  const kthemeHtml = path.join(cwd, 'Ktheme.html');
  const rootIndex = path.join(cwd, 'index.html');

  if (fs.existsSync(docsIndex)) {
    server = await startServerHarness(cwd, customPort);
    targetUrl = `${server.url}/docs/index.html`;
  } else if (fs.existsSync(kthemeHtml)) {
    server = await startServerHarness(cwd, customPort);
    targetUrl = `${server.url}/Ktheme.html`;
  } else if (fs.existsSync(rootIndex)) {
    server = await startServerHarness(cwd, customPort);
    targetUrl = `${server.url}/index.html`;
  } else {
    log('No target HTML entry file found to run live DOM accessibility audit.', 'warn');
    return true;
  }

  let browser;
  try {
    browser = await getPlaywrightBrowser();
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const auditResults = await page.evaluate(() => {
      // Helper function for relative luminance
      function getLuminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function parseRgb(colorStr) {
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return null;
        return {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10),
          a: match[4] !== undefined ? parseFloat(match[4]) : 1
        };
      }

      function getContrastRatio(fgStr, bgStr) {
        const fg = parseRgb(fgStr);
        let bg = parseRgb(bgStr);
        if (!fg) return null;
        if (!bg || bg.a < 0.1) bg = { r: 15, g: 17, b: 23, a: 1 }; // default dark slate fallback if transparent

        const l1 = getLuminance(fg.r, fg.g, fg.b);
        const l2 = getLuminance(bg.r, bg.g, bg.b);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      const issues = [];
      const interactiveSelector = 'button, [role="button"], a[href], input, select, textarea, [tabindex]';
      const interactiveElements = Array.from(document.querySelectorAll(interactiveSelector));

      let auditedNodes = 0;

      // 1. ARIA & Accessible Name Audit
      for (const el of interactiveElements) {
        if (el.offsetParent === null) continue; // Skip hidden elements
        auditedNodes++;

        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledby = el.getAttribute('aria-labelledby');
        const textContent = (el.innerText || el.textContent || '').trim();
        const title = el.getAttribute('title');
        const alt = el.getAttribute('alt');

        const placeholder = el.getAttribute('placeholder');
        const accessibleName = ariaLabel || ariaLabelledby || textContent || title || alt || placeholder;

        if (!accessibleName) {
          issues.push({
            type: 'aria-missing-name',
            element: el.tagName.toLowerCase(),
            snippet: el.outerHTML.slice(0, 80),
            message: `Interactive element <${el.tagName.toLowerCase()}> lacks accessible name (aria-label, text content, title, or alt)`
          });
        }

        // Tabindex check
        const tabIndex = el.getAttribute('tabindex');
        if (tabIndex !== null && parseInt(tabIndex, 10) < -1) {
          issues.push({
            type: 'aria-invalid-tabindex',
            element: el.tagName.toLowerCase(),
            message: `Element has invalid negative tabindex "${tabIndex}"`
          });
        }
      }

      // 2. WCAG Contrast Audit
      const textNodesSelector = 'p, span, h1, h2, h3, h4, h5, h6, button, a, label, div';
      const textElements = Array.from(document.querySelectorAll(textNodesSelector));

      for (const el of textElements) {
        if (el.offsetParent === null) continue;
        const directText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (!directText) continue;

        auditedNodes++;
        const style = window.getComputedStyle(el);
        const fgColor = style.color;
        const bgColor = style.backgroundColor;

        const ratio = getContrastRatio(fgColor, bgColor);
        if (ratio !== null) {
          const fontSize = parseFloat(style.fontSize);
          const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight, 10) >= 700;
          const requiredRatio = (fontSize >= 18 || (fontSize >= 14 && isBold)) ? 3.0 : 4.5;

          if (ratio < requiredRatio && ratio > 1.05) { // Exclude identical transparent / overlapping layers
            issues.push({
              type: 'wcag-contrast',
              element: el.tagName.toLowerCase(),
              snippet: el.innerText.slice(0, 30),
              ratio: parseFloat(ratio.toFixed(2)),
              requiredRatio,
              fgColor,
              bgColor,
              message: `Insufficient text contrast ratio (${ratio.toFixed(2)}:1 < required ${requiredRatio}:1) for "${el.innerText.slice(0, 20)}..."`
            });
          }
        }
      }

      return { auditedNodes, issues };
    });

    log(`Audited ${auditResults.auditedNodes} live DOM nodes across ${targetUrl}`, 'info');

    const contrastIssues = auditResults.issues.filter(i => i.type === 'wcag-contrast');
    const ariaIssues = auditResults.issues.filter(i => i.type !== 'wcag-contrast');

    if (ariaIssues.length > 0) {
      log(`Found ${ariaIssues.length} ARIA compliance issues:`, 'warn');
      ariaIssues.forEach(i => console.log(`  - ${i.message} (snippet: ${i.snippet || 'n/a'})`));
    }

    if (contrastIssues.length > 0) {
      log(`Found ${contrastIssues.length} color contrast warnings:`, 'warn');
      contrastIssues.slice(0, 5).forEach(i => console.log(`  - ${i.message}`));
    }

    if (ariaIssues.length === 0) {
      log('WCAG 2.1 AA ARIA and Keyboard compliance check passed!', 'success');
      return true;
    } else {
      log('WCAG 2.1 AA audit reported ARIA/accessibility errors.', 'error');
      return false;
    }
  } catch (err) {
    log(`Accessibility audit error: ${err.message}`, 'error');
    return false;
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
}

// TASK 4: Playwright Visual Snapshot Regression Suite
async function taskVisualSuite() {
  log('Running Playwright Visual Snapshot Regression Testing...', 'header');

  let server;
  let targetUrl;

  const docsIndex = path.join(cwd, 'docs/index.html');
  const kthemeHtml = path.join(cwd, 'Ktheme.html');
  const rootIndex = path.join(cwd, 'index.html');

  if (fs.existsSync(docsIndex)) {
    server = await startServerHarness(cwd, customPort);
    targetUrl = `${server.url}/docs/index.html`;
  } else if (fs.existsSync(kthemeHtml)) {
    server = await startServerHarness(cwd, customPort);
    targetUrl = `${server.url}/Ktheme.html`;
  } else if (fs.existsSync(rootIndex)) {
    server = await startServerHarness(cwd, customPort);
    targetUrl = `${server.url}/index.html`;
  } else {
    log('No target HTML file found for visual testing. Skipped.', 'warn');
    return true;
  }

  const snapshotDir = path.join(cwd, 'docs/screenshots/baseline');
  fs.mkdirSync(snapshotDir, { recursive: true });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 375, height: 667 }
  ];

  let browser;
  let allMatched = true;

  try {
    browser = await getPlaywrightBrowser();

    for (const vp of viewports) {
      log(`Capturing visual snapshots for viewport: ${vp.name} (${vp.width}x${vp.height})`, 'info');
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Attempt interactive panel triggers if available
      try {
        const sweepBtn = page.getByText('Sweep Console', { exact: true }).first();
        if (await sweepBtn.isVisible()) {
          await sweepBtn.click();
          await page.waitForTimeout(300);
        }
        const lcarsBtn = page.getByText('LCARS Amber', { exact: true }).first();
        if (await lcarsBtn.isVisible()) {
          await lcarsBtn.click();
          await page.waitForTimeout(300);
        }
      } catch (_) {}

      const currentBuf = await page.screenshot({ fullPage: false });
      const baselineFile = path.join(snapshotDir, `${vp.name}_sweep_lcars.png`);

      if (updateSnapshots || !fs.existsSync(baselineFile)) {
        fs.writeFileSync(baselineFile, currentBuf);
        log(`Saved baseline snapshot: ${baselineFile}`, 'success');
      } else {
        const baselineBuf = fs.readFileSync(baselineFile);
        const result = comparePNGBuffers(currentBuf, baselineBuf);

        if (result.match) {
          log(`Visual match for ${vp.name} (${result.diffPercent}% diff)`, 'success');
        } else {
          allMatched = false;
          log(`Visual regression detected for ${vp.name}! Diff: ${result.diffPercent}% (${result.diffPixels} diff pixels)`, 'error');
          const diffDir = path.join(cwd, 'docs/screenshots/diffs');
          fs.mkdirSync(diffDir, { recursive: true });
          const diffFile = path.join(diffDir, `${vp.name}_diff.png`);
          fs.writeFileSync(diffFile, currentBuf);
          log(`Saved diff snapshot: ${diffFile}`, 'warn');
        }
      }

      await page.close();
    }

    if (allMatched) {
      log('All visual snapshot comparisons matched baseline successfully!', 'success');
      return true;
    } else {
      log('Visual regression test failures detected.', 'error');
      return false;
    }
  } catch (err) {
    log(`Visual suite error: ${err.message}`, 'error');
    return false;
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
}

// MAIN RUNNER ORCHESTRATION
async function main() {
  console.log(`
${colors.bold}${colors.cyan}=====================================================${colors.reset}
${colors.bold}  UNIFIED CROSS-REPO DESIGN SYSTEM VALIDATION CLI   ${colors.reset}
${colors.bold}${colors.cyan}=====================================================${colors.reset}
Working Directory: ${cwd}
Active Tasks: ${[runUnit && 'Unit', runCatalog && 'Catalog', runA11y && 'A11y', runVisual && 'Visual'].filter(Boolean).join(', ')}
`);

  const results = {};

  if (runUnit) {
    results.unit = await taskUnitTests();
  }

  if (runCatalog) {
    results.catalog = await taskCatalogCheck();
  }

  if (runA11y) {
    results.a11y = await taskA11yAudit();
  }

  if (runVisual) {
    results.visual = await taskVisualSuite();
  }

  console.log(`
${colors.bold}${colors.cyan}=====================================================${colors.reset}
${colors.bold}                 VALIDATION SUMMARY                 ${colors.reset}
${colors.bold}${colors.cyan}=====================================================${colors.reset}`);

  let overallPass = true;
  for (const [task, pass] of Object.entries(results)) {
    const statusText = pass ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    console.log(`  - Task [${task.toUpperCase()}]: ${statusText}`);
    if (!pass) overallPass = false;
  }

  console.log(`-----------------------------------------------------`);
  if (overallPass) {
    console.log(`${colors.bold}${colors.green}ALL VALIDATION CHECKS PASSED SUCCESSFULLY!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.bold}${colors.red}VALIDATION CHECKS FAILED. PLEASE REVIEW ERRORS ABOVE.${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal CLI runner error:`, err);
  process.exit(1);
});
