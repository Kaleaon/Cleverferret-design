// Browser regressions for every registered screen and all seven layout families.
// npm ci && npx playwright install chromium && npm run test:layouts
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs"
);
const require = createRequire(import.meta.url);
const CF = require("../docs/cf-system.js");
const designs = [
  ["compose", "navy", "sheen"],
  ["terminal", "ink", "flat"],
  ["sweep", "lcars", "flat"],
  ["tiles", "metro", "flat"],
  ["glass", "aero", "glass"],
  ["rules", "deco", "flat"],
  ["press", "paper", "flat"],
];
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + new URL(req.url, "http://localhost").pathname
  );
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    "Content-Type",
    {
      ".js": "application/javascript",
      ".html": "text/html",
      ".css": "text/css",
    }[path.extname(file)] || "application/octet-stream"
  );
  res.end(fs.readFileSync(file));
});

await new Promise((resolve, reject) => {
  server.on("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const possiblePaths = [
  process.env.CHROMIUM_PATH,
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter(Boolean);
const fallbackPath = possiblePaths.find((p) => fs.existsSync(p));
const launchOpts = {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--mute-audio",
    "--font-render-hinting=none",
    "--force-color-profile=srgb",
  ],
};
if (process.env.CHROMIUM_PATH) {
  launchOpts.executablePath = process.env.CHROMIUM_PATH;
}

let browser;
try {
  browser = await chromium.launch(launchOpts);
} catch (err) {
  if (fallbackPath) {
    try {
      browser = await chromium.launch({
        ...launchOpts,
        executablePath: fallbackPath,
      });
    } catch {
      delete launchOpts.executablePath;
      browser = await chromium.launch(launchOpts);
    }
  } else {
    delete launchOpts.executablePath;
    browser = await chromium.launch(launchOpts);
  }
}

let pages = 0;
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const context = await browser.newContext({
    viewport: { width: 380, height: 780 },
  });
  // Exact runtime versions, served locally so CI is independent of CDN availability.
  const assets = new Map([
    [
      "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
      fs.readFileSync(
        require
          .resolve("react")
          .replace(/index\.js$/, "umd/react.production.min.js")
      ),
    ],
    [
      "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
      fs.readFileSync(
        require
          .resolve("react-dom")
          .replace(/index\.js$/, "umd/react-dom.production.min.js")
      ),
    ],
  ]);
  await context.route("https://**/*", (route) => {
    const body = assets.get(route.request().url());
    return body
      ? route
          .fulfill({
            body,
            contentType: "application/javascript",
            headers: { "access-control-allow-origin": "*" },
          })
          .catch(() => {})
      : route.abort().catch(() => {});
  });
  const errors = [];
  const layoutIssues = [];

  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  let hasLoadedApp = false;

  async function openOnPage(design, screen = "home") {
    const [layout, palette, effect] = design;
    if (!hasLoadedApp) {
      await page.goto(
        `${base}/app.dc.html?embed=1&screen=${screen}&layout=${layout}&palette=${palette}&effect=${effect}&motion=off`
      );
      hasLoadedApp = true;
    } else {
      await page.evaluate(
        ({ layout, palette, effect, screen }) => {
          window.__app.setState({
            theme: { layout, palette, effect, motion: "off" },
          });
          window.__app.goto(screen, true);
        },
        { layout, palette, effect, screen }
      );
    }
    await page
      .locator(`.phone-frame[data-layout="${layout}"] .cf-screen`)
      .waitFor();
    pages++;
  }

  for (const design of designs) {
    for (const screen of CF.SCREENS) {
      await openOnPage(design, screen.id);
      const issues = await page.locator(".phone-frame").evaluate((frame) => {
        const issues = [];
        const shell = frame.querySelector(".cf-shell").getBoundingClientRect();
        const main = frame.querySelector(".cf-screen").getBoundingClientRect();
        if (main.right > shell.right + 1 || main.left < shell.left - 1)
          issues.push("screen escapes its shell");
        for (const el of frame.querySelectorAll("button, select, input")) {
          const r = el.getBoundingClientRect();
          if (
            !r.width ||
            !r.height ||
            getComputedStyle(el).visibility === "hidden"
          )
            continue;
          if (r.width < 47.5 || r.height < 47.5)
            issues.push(
              `small target ${el.getAttribute("aria-label") || el.innerText}: ${
                r.width
              }x${r.height}`
            );
          const name =
            el.getAttribute("aria-label") ||
            el.getAttribute("aria-labelledby") ||
            Array.from(el.labels || [])
              .map((label) => label.innerText.trim())
              .join("") ||
            el.innerText?.trim() ||
            el.title;
          if (!name && !["checkbox", "radio"].includes(el.type))
            issues.push(`unnamed ${el.tagName}`);
        }
        if (frame.dataset.layout === "sweep") {
          const mini = frame.querySelector(".cf-mini")?.getBoundingClientRect();
          if (
            mini &&
            (mini.top < main.bottom - 1 || mini.right > shell.right + 1)
          )
            issues.push("player overlaps content or leaves console");
        }
        return issues;
      });
      if (issues.length)
        layoutIssues.push({ page: `${design[0]}/${screen.id}`, issues });
    }

    await openOnPage(design);
    // Adaptive layouts must respond to a resize without a reload.
    await page.setViewportSize({ width: 960, height: 780 });
    const adaptive = ["compose", "terminal", "glass", "press"].includes(
      design[0]
    );
    if (adaptive) {
      await page.waitForFunction(
        () =>
          Math.round(
            document
              .querySelector(
                '.phone-frame nav[aria-label="Sidebar navigation"]'
              )
              ?.getBoundingClientRect().width || 0
          ) === 72
      );
      assert.equal(
        await page
          .locator('.phone-frame nav[aria-label="Sidebar navigation"]')
          .count(),
        1
      );
      const navWidth = await page
        .locator('.phone-frame nav[aria-label="Sidebar navigation"]')
        .evaluate((el) => Math.round(el.getBoundingClientRect().width));
      assert.equal(navWidth, 72, `${design[0]} tablet rail`);
    }
    if (design[0] === "tiles") {
      const heights = await page
        .locator('button.cf-press[style*="--qh"]')
        .evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect().height)
        );
      assert.ok(
        heights.length > 0 && heights.every((h) => h <= 160.5),
        "Metro tablet tiles should remain bounded"
      );
      assert.equal(
        await page
          .locator(".cf-media-title")
          .evaluate((el) => getComputedStyle(el).textTransform),
        "none",
        "Metro preserves media title case"
      );
    }
    await page.setViewportSize({ width: 380, height: 780 });
    if (adaptive)
      await page.waitForFunction(
        () =>
          document
            .querySelector('.phone-frame nav[aria-label="Main navigation"]')
            ?.getBoundingClientRect().width > 72
      );
    await page.locator('.cf-mini button[aria-label="Play"]').click();
    await page.locator('.cf-mini button[aria-label="Pause"]').waitFor();
    await page.locator('.cf-mini button[aria-label="Pause"]').click();
    await page.locator('.cf-mini button[aria-label="Play"]').waitFor();
    console.log(
      `PASS ${design[0]}: ${CF.SCREENS.length} screens, resize and playback`
    );
  }

  await openOnPage(designs[2], "player");
  assert.equal(
    await page
      .locator(".cf-transport .cf-control-label")
      .filter({ hasText: "Play" })
      .isVisible(),
    true,
    "LCARS transport is text-led"
  );
  await openOnPage(designs[2]);
  const centers = await page.locator(".phone-frame").evaluate((frame) => {
    const curve = (selector, property, corner) => {
      const el = frame.querySelector(selector),
        r = el.getBoundingClientRect();
      const radii = getComputedStyle(el)[property].split(" ").map(parseFloat);
      return [
        r.left + radii[0],
        corner === "bottom"
          ? r.bottom - (radii[1] || radii[0])
          : r.top + (radii[1] || radii[0]),
      ];
    };
    return {
      headerOuter: curve(
        ".lc-header-outer",
        "borderBottomLeftRadius",
        "bottom"
      ),
      headerInner: curve(
        ".lc-header-inner",
        "borderBottomLeftRadius",
        "bottom"
      ),
      contentOuter: curve(".lc-content-outer", "borderTopLeftRadius", "top"),
      contentInner: curve(".cf-shell", "borderTopLeftRadius", "top"),
    };
  });
  assert.deepEqual(
    centers.headerOuter,
    centers.headerInner,
    "Rendered header sweep centers"
  );
  assert.deepEqual(
    centers.contentOuter,
    centers.contentInner,
    "Rendered content sweep centers"
  );
  assert.equal(
    await page
      .locator(".lc-readouts")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgba(0, 0, 0, 0)"
  );
  await page.locator('.cf-mini button[aria-label^="Open player"]').click();
  await page.locator('.cf-screen[data-screen-label="Audio player"]').waitFor();
  await page.getByRole("button", { name: "Cast", exact: true }).click();
  await page.locator('[role="status"] .cf-toast').waitFor();
  const dock = await page.locator(".cf-shell").evaluate((shell) => {
    const screen = shell.querySelector(".cf-screen").getBoundingClientRect();
    const toast = shell.querySelector(".cf-toast").getBoundingClientRect();
    return { contentBottom: screen.bottom, toastTop: toast.top };
  });
  assert.ok(
    dock.toastTop >= dock.contentBottom,
    "LCARS feedback must not cover content"
  );
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch (_) {}
  });
  await page.close();
  assert.deepEqual(errors, [], "No browser exceptions");
  assert.deepEqual(layoutIssues, [], "Layout and interaction targets");
  console.log(`SUCCESS: ${pages} rendered pages; all seven families passed.`);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
