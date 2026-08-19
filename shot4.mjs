import { chromium } from '@playwright/test';
const OUT = process.env.SHOTS;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1150, height: 900 }, deviceScaleFactor: 2 });
for (const [name, q] of [
  ['wave-intensity', '?separation=0.5&wavelength=0.12&show_rays=1'],
  ['wave-amplitude', '?separation=0.5&wavelength=0.12&mode=amplitude'],
]) {
  await p.goto('http://127.0.0.1:4173/wave-interference' + q);
  await p.waitForTimeout(2200);
  await (await p.locator('[class*="canvasHolder"]').first()).screenshot({ path: `${OUT}/${name}.png` });
}
await b.close(); console.log('done');
