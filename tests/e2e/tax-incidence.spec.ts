import { expect, test } from '@playwright/test';

test.describe('tax-incidence', () => {
  test('renders the five-part spine and a live model', async ({ page }) => {
    await page.goto('/tax-incidence');

    await expect(page.getByRole('heading', { name: 'Who actually pays a tax' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What is going on' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Try to break it' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What this leaves out' })).toBeVisible();

    await expect(page.getByRole('img', { name: /supply and demand/i })).toBeVisible();
    await expect(page.getByLabel('Tax per unit')).toBeVisible();
  });

  test('state round-trips through the URL', async ({ page }) => {
    await page.goto('/tax-incidence?elasticity_d=3&elasticity_s=0.2&tax=4');
    // Consumers should bear very little when demand is the elastic side.
    const share = page.locator('text=Consumer share').locator('..').locator('span').last();
    await expect(share).toHaveText('6%');
  });

  test('arriving on a shared link shows that state immediately, with no intro sweep', async ({
    page,
  }) => {
    await page.goto('/tax-incidence?tax=4&elasticity_d=0.5&elasticity_s=2');
    // Scoped to the readouts block: "Quantity" also appears as the x-axis label.
    const quantity = page
      .locator('[class*="readouts"] [class*="readout"]')
      .filter({ hasText: 'Quantity' })
      .locator('span')
      .last();
    // Read repeatedly across the window the intro would have occupied; a sweep
    // would show quantity climbing back toward 100.
    for (let i = 0; i < 6; i++) {
      await expect(quantity).toHaveText('84.0');
      await page.waitForTimeout(250);
    }
  });

  test('statutory side changes nothing (the thesis)', async ({ page }) => {
    await page.goto('/tax-incidence?tax=4&elasticity_d=0.5&elasticity_s=2');
    const readouts = page.locator('[class*="readouts"]');
    const before = await readouts.innerText();

    await page.getByLabel('Buyers').click();
    const after = await readouts.innerText();

    // Only the "Collected from" cell may differ.
    expect(after.replace('Buyers', 'X')).toBe(before.replace('Sellers', 'X'));
  });

  test('at 375px the chart and the controls are on screen together', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-375', 'narrow-viewport check');
    await page.goto('/tax-incidence');
    await page.getByRole('img', { name: /supply and demand/i }).waitFor();

    // §9: a reader must be able to drag a control and watch the effect without
    // scrolling between them. Measured in the page, with the chart pinned to the
    // top of the viewport, so viewport-relative geometry is unambiguous.
    const fit = await page.evaluate(() => {
      const chart = document.querySelector('svg[aria-label*="Supply"]')!;
      chart.scrollIntoView({ block: 'start' });
      const slider = document.querySelector('input[type=range]')!;
      const c = chart.getBoundingClientRect();
      const s = slider.getBoundingClientRect();
      return {
        chartTop: c.top,
        chartHeight: c.height,
        sliderBottom: s.bottom,
        viewportHeight: window.innerHeight,
      };
    });

    expect(fit.chartTop).toBeGreaterThanOrEqual(-1);
    // Visualization capped at 45vh.
    expect(fit.chartHeight).toBeLessThanOrEqual(fit.viewportHeight * 0.45 + 2);
    // And the first control is fully on screen alongside it.
    expect(fit.sliderBottom).toBeLessThanOrEqual(fit.viewportHeight);
  });

  test('every control is keyboard reachable and labelled', async ({ page }) => {
    await page.goto('/tax-incidence');
    const slider = page.getByLabel('Tax per unit');
    await slider.focus();
    await expect(slider).toBeFocused();

    const initial = await slider.inputValue();
    await slider.press('ArrowRight');
    expect(await slider.inputValue()).not.toBe(initial);
  });
});
