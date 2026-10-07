#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Parse CLI flags
const args = process.argv.slice(2);
let runContrast = false;
let runLinks = false;
let runSyntax = false;

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node tools/ci-runner.mjs [options]

Options:
  --contrast    Run WCAG 2.2 AA contrast verification
  --links       Run HTML link & static asset verification
  --syntax      Run JS/MJS syntax validation
  --all         Run all validation suites (default)
  --help, -h    Show this help message
`);
  process.exit(0);
}

if (args.includes('--contrast')) runContrast = true;
if (args.includes('--links')) runLinks = true;
if (args.includes('--syntax')) runSyntax = true;
if (args.includes('--all') || (!runContrast && !runLinks && !runSyntax)) {
  runContrast = true;
  runLinks = true;
  runSyntax = true;
}

const startTime = Date.now();
const results = [];

// 1. Contrast Verification
function verifyContrast() {
  const testFile = path.join(rootDir, 'tests', 'verify_contrast.js');
  if (!fs.existsSync(testFile)) {
    return {
      task: 'WCAG Contrast Audit',
      details: 'tests/verify_contrast.js not found',
      passed: false
    };
  }

  const proc = spawnSync('node', [testFile], { cwd: rootDir, encoding: 'utf8' });
  const stdout = proc.stdout || '';
  const stderr = proc.stderr || '';

  if (proc.status === 0) {
    let details = 'All theme palettes meet WCAG 2.2 AA standards';
    const matchPalettes = stdout.match(/Total Palettes Audited:\s*(\d+)/);
    const matchChecks = stdout.match(/Total Role Contrast Checks:\s*(\d+)/);
    if (matchPalettes && matchChecks) {
      details = `${matchPalettes[1]} palettes / ${matchChecks[1]} checks passed`;
    }
    return {
      task: 'WCAG Contrast Audit',
      details,
      passed: true,
      log: stdout
    };
  } else {
    return {
      task: 'WCAG Contrast Audit',
      details: 'Contrast violations detected',
      passed: false,
      log: stderr || stdout
    };
  }
}

// Helper: Scan directory for files with given extensions
function findFiles(dir, extensions, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        findFiles(fullPath, extensions, fileList);
      }
    } else if (entry.isFile()) {
      if (extensions.some(ext => entry.name.endsWith(ext))) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

// 2. HTML Link Verification
function verifyLinks() {
  const docsDir = path.join(rootDir, 'docs');
  const htmlFiles = findFiles(docsDir, ['.html']);

  let totalLinks = 0;
  let brokenLinks = 0;
  const errors = [];

  const linkRegex = /(?:href|src)=["']([^"']+)["']/gi;

  for (const htmlFile of htmlFiles) {
    const content = fs.readFileSync(htmlFile, 'utf8');
    const relativeHtmlPath = path.relative(rootDir, htmlFile);
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const link = match[1].trim();
      if (!link) continue;

      // Skip external schemes, protocol-relative, javascript, data URIs
      if (/^(https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(link)) {
        continue;
      }

      totalLinks++;

      // Handle query params & hash anchors
      const [urlPart, hashPart] = link.split('#');
      const cleanPath = urlPart.split('?')[0];

      if (!cleanPath) {
        // Internal anchor on same page (e.g. "#section")
        if (hashPart) {
          const idPattern = new RegExp(`(?:id|name)=["']${hashPart}["']`, 'i');
          if (!idPattern.test(content)) {
            errors.push(`${relativeHtmlPath}: anchor '#${hashPart}' not found in document`);
            brokenLinks++;
          }
        }
        continue;
      }

      // Local file reference
      const targetPath = path.resolve(path.dirname(htmlFile), cleanPath);
      if (!fs.existsSync(targetPath)) {
        errors.push(`${relativeHtmlPath}: link target '${link}' not found (${path.relative(rootDir, targetPath)})`);
        brokenLinks++;
      } else if (hashPart && (cleanPath.endsWith('.html') || cleanPath.endsWith('.dc.html'))) {
        const targetContent = fs.readFileSync(targetPath, 'utf8');
        const idPattern = new RegExp(`(?:id|name)=["']${hashPart}["']`, 'i');
        if (!idPattern.test(targetContent)) {
          errors.push(`${relativeHtmlPath}: anchor '#${hashPart}' not found in target ${cleanPath}`);
          brokenLinks++;
        }
      }
    }
  }

  if (brokenLinks === 0) {
    return {
      task: 'HTML Link Verification',
      details: `${htmlFiles.length} HTML files / ${totalLinks} local links verified`,
      passed: true
    };
  } else {
    return {
      task: 'HTML Link Verification',
      details: `${brokenLinks} broken link(s) found across ${htmlFiles.length} HTML files`,
      passed: false,
      log: errors.join('\n')
    };
  }
}

// 3. JS Syntax Validation
function verifySyntax() {
  const dirsToScan = ['docs', 'tests', 'tools'].map(d => path.join(rootDir, d));
  let jsFiles = [];
  for (const dir of dirsToScan) {
    findFiles(dir, ['.js', '.mjs'], jsFiles);
  }

  let syntaxFailures = 0;
  const errors = [];

  for (const jsFile of jsFiles) {
    const relativePath = path.relative(rootDir, jsFile);
    const proc = spawnSync('node', ['--check', jsFile], { cwd: rootDir, encoding: 'utf8' });
    if (proc.status !== 0) {
      syntaxFailures++;
      errors.push(`Syntax error in ${relativePath}:\n${proc.stderr || proc.stdout}`);
    }
  }

  if (syntaxFailures === 0) {
    return {
      task: 'JS Syntax Validation',
      details: `${jsFiles.length} JS/MJS files syntax validated`,
      passed: true
    };
  } else {
    return {
      task: 'JS Syntax Validation',
      details: `${syntaxFailures} file(s) failed syntax check`,
      passed: false,
      log: errors.join('\n')
    };
  }
}

// Execute selected tasks
if (runContrast) results.push(verifyContrast());
if (runLinks) results.push(verifyLinks());
if (runSyntax) results.push(verifySyntax());

const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
const overallPassed = results.every(r => r.passed);

// Output Terminal Summary
console.log('\n==================================================');
console.log('         CI Test Matrix Execution Summary         ');
console.log('==================================================');
for (const res of results) {
  const statusStr = res.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${statusStr}] ${res.task.padEnd(24)} | ${res.details}`);
  if (!res.passed && res.log) {
    console.error(`  Details:\n${res.log.split('\n').map(l => '    ' + l).join('\n')}`);
  }
}
console.log(`--------------------------------------------------`);
console.log(`Duration: ${durationSec}s | Status: ${overallPassed ? 'SUCCESS' : 'FAILURE'}\n`);

// Format Markdown for $GITHUB_STEP_SUMMARY
let markdown = `## 🚀 CI Validation Matrix Summary

| Validation Task | Target / Details | Status |
| :--- | :--- | :--- |
`;

for (const res of results) {
  const statusBadge = res.passed ? '✅ PASS' : '❌ FAIL';
  markdown += `| ${res.task} | ${res.details} | ${statusBadge} |\n`;
}

markdown += `\n*Execution completed in ${durationSec}s*\n`;

if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8');
    console.log(`Appended validation summary to $GITHUB_STEP_SUMMARY`);
  } catch (err) {
    console.error(`Failed to write to $GITHUB_STEP_SUMMARY: ${err.message}`);
  }
}

if (!overallPassed) {
  process.exit(1);
} else {
  process.exit(0);
}
