/**
 * Static Open Graph cards, one per explorable. SPEC §10.
 *
 * "v1 uses one static, well-made card per explorable. Dynamic per-state OG
 * images need a server and are explicitly deferred."
 *
 * Run with `npm run build:og` after a build (it reads .prerender/metas.json).
 * Commit the PNGs in public/og/ — they are build artifacts in the same sense as
 * §3's catalogs, regenerated only when a title or blurb changes.
 *
 * Rendered with the Playwright chromium already present for the smoke tests, so
 * no rasteriser is added as a dependency. The page is written into public/ and
 * opened over file:// so the self-hosted woff2 files resolve relatively — the
 * card must use the real faces, or it is not the same design.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const PUBLIC = join(ROOT, 'public');
const OUT = join(PUBLIC, 'og');
const SCRATCH = join(PUBLIC, '__og-card.html');

const WIDTH = 1200;
const HEIGHT = 630;

const DOMAIN_LABEL = {
  physics: 'Physics',
  mathematics: 'Mathematics',
  economics: 'Economics',
  statistics: 'Statistics',
};

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function card(meta) {
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @font-face { font-family: 'Bodoni Moda'; font-weight: 600; src: url('fonts/bodoni-moda-600.woff2') format('woff2'); }
  @font-face { font-family: 'Source Serif 4'; font-weight: 400; src: url('fonts/source-serif-4-400.woff2') format('woff2'); }
  @font-face { font-family: 'IBM Plex Mono'; font-weight: 400; src: url('fonts/ibm-plex-mono-400.woff2') format('woff2'); }

  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    background: #F7F6F2; color: #1A1D21;
    padding: 68px 76px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  /* Two rules of different weight: the engraved-plate device from SPEC §2. */
  .plate { border-top: 3px solid #1A1D21; padding-top: 8px; }
  .plate::after { content: ''; display: block; border-top: 1px solid #C9C6BC; margin-top: 5px; }
  .kicker {
    font-family: 'IBM Plex Mono', monospace; font-size: 20px;
    letter-spacing: 0.16em; text-transform: uppercase; color: #6B6F76;
    margin-top: 18px;
  }
  h1 {
    font-family: 'Bodoni Moda', Didot, serif; font-weight: 600;
    font-size: 74px; line-height: 1.06; letter-spacing: -0.015em;
    margin: 26px 0 22px; max-width: 20ch;
  }
  p {
    font-family: 'Source Serif 4', Georgia, serif; font-size: 27px;
    line-height: 1.45; color: #1A1D21; max-width: 44ch;
  }
  footer {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: 'IBM Plex Mono', monospace; font-size: 20px; color: #6B6F76;
    border-top: 1px solid #C9C6BC; padding-top: 16px;
  }
  .mark { color: #0F5EF7; letter-spacing: 0.16em; text-transform: uppercase; }
</style></head>
<body>
  <div>
    <div class="plate"></div>
    <div class="kicker">${escapeHtml(DOMAIN_LABEL[meta.domain] ?? meta.domain)}</div>
    <h1>${escapeHtml(meta.title)}</h1>
    <p>${escapeHtml(meta.blurb)}</p>
  </div>
  <footer>
    <span class="mark">Explorables</span>
    <span>${meta.minutes} min · interactive</span>
  </footer>
</body></html>`;
}

async function main() {
  const metas = JSON.parse(await readFile(join(ROOT, '.prerender', 'metas.json'), 'utf8'));
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  try {
    for (const meta of metas) {
      await writeFile(SCRATCH, card(meta), 'utf8');
      await page.goto(pathToFileURL(SCRATCH).href);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(OUT, `${meta.slug}.png`) });
      console.log(`  og/${meta.slug}.png`);
    }
  } finally {
    await browser.close();
    await rm(SCRATCH, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
