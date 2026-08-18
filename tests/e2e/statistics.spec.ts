import { expect, test } from '@playwright/test';

/** Every explorable must clear the §12 checklist, not just tax-incidence. */
const EXPLORABLES = [
  { slug: 'survival-analysis', heading: 'The people who have not died yet', firstControl: 'Cohort size' },
  { slug: 'statistical-power', heading: 'What an underpowered study actually does', firstControl: 'True effect size' },
  { slug: 'simpsons-paradox', heading: 'When the average reverses every group', firstControl: 'Number of groups' },
  { slug: 'bias-variance', heading: 'Why the better fit is the worse model', firstControl: 'Model flexibility (polynomial degree)' },
] as const;

for (const item of EXPLORABLES) {
  test.describe(item.slug, () => {
    test('renders the five-part spine with a live model', async ({ page }) => {
      await page.goto(`/${item.slug}`);
      await expect(page.getByRole('heading', { name: item.heading })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'What is going on' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Try to break it' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'What this leaves out' })).toBeVisible();
      await expect(page.getByLabel(item.firstControl)).toBeVisible();
    });

    test('is keyboard reachable and announces its state', async ({ page }) => {
      await page.goto(`/${item.slug}`);
      const control = page.getByLabel(item.firstControl);
      await control.focus();
      await expect(control).toBeFocused();

      const before = await control.inputValue();
      await control.press('ArrowRight');
      expect(await control.inputValue()).not.toBe(before);

      // §9: a debounced polite live region describing the current state.
      await expect(page.locator('[aria-live="polite"]').first()).toHaveCount(1);
    });

    test('round-trips its state through the URL', async ({ page }) => {
      await page.goto(`/${item.slug}`);
      const control = page.getByLabel(item.firstControl);
      await control.focus();
      await control.press('ArrowRight');
      await control.press('ArrowRight');

      await expect(async () => {
        expect(page.url()).toContain('?');
      }).toPass({ timeout: 3000 });

      const shared = page.url();
      const value = await control.inputValue();
      await page.goto(shared);
      expect(await page.getByLabel(item.firstControl).inputValue()).toBe(value);
    });

    test('at 375px the chart and the controls are on screen together', async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile-375', 'narrow-viewport check');
      await page.goto(`/${item.slug}`);
      await page.locator('svg[role="img"]').first().waitFor();

      const fit = await page.evaluate(() => {
        const chart = document.querySelector('svg[role="img"]')!;
        chart.scrollIntoView({ block: 'start' });
        const slider = document.querySelector('input[type=range]')!;
        return {
          chartTop: chart.getBoundingClientRect().top,
          chartHeight: chart.getBoundingClientRect().height,
          sliderBottom: slider.getBoundingClientRect().bottom,
          viewportHeight: window.innerHeight,
        };
      });

      expect(fit.chartTop).toBeGreaterThanOrEqual(-1);
      expect(fit.chartHeight).toBeLessThanOrEqual(fit.viewportHeight * 0.45 + 2);
      expect(fit.sliderBottom).toBeLessThanOrEqual(fit.viewportHeight);
    });
  });
}

test.describe('specific claims each model makes', () => {
  test('survival: discarding censored subjects underestimates the median', async ({ page }) => {
    await page.goto('/survival-analysis?n=400&median=12&censoring=0.6&comparator=drop');
    // Closed form is median*(1-c) = 12*0.4 = 4.8, and Kaplan-Meier should stay
    // near the true 12 on the same data.
    const naive = Number(await page.getByTestId('naive-median').innerText());
    const km = Number(await page.getByTestId('km-median').innerText());
    expect(naive).toBeGreaterThan(3.5);
    expect(naive).toBeLessThan(6.5);
    expect(km).toBeGreaterThan(9);
    expect(km).toBeLessThan(15);
  });

  test('power: zero effect makes power equal alpha', async ({ page }) => {
    await page.goto('/statistical-power?effect=0&alpha=0.05');
    await expect(page.getByTestId('power')).toHaveText('5.0%');
    // No effect means no meaningful exaggeration or sample size to quote.
    await expect(page.getByTestId('exaggeration')).toHaveText('—');
    await expect(page.getByTestId('n-for-80')).toHaveText('—');
  });

  test('power: an underpowered study exaggerates', async ({ page }) => {
    await page.goto('/statistical-power?effect=0.1&n=10&alpha=0.05');
    const exaggeration = Number((await page.getByTestId('exaggeration').innerText()).replace('×', ''));
    expect(exaggeration).toBeGreaterThan(5);
    const wrongSign = parseFloat(await page.getByTestId('wrong-sign').innerText());
    expect(wrongSign).toBeGreaterThan(20);
  });

  test('simpson: separation zero removes the reversal', async ({ page }) => {
    await page.goto('/simpsons-paradox?separation=0');
    await expect(page.getByTestId('verdict')).toHaveText('Both point the same way');

    await page.goto('/simpsons-paradox');
    await expect(page.getByTestId('verdict')).toHaveText('Reversed');
    // The measured pooled slope must match the closed-form prediction.
    const pooled = Number(await page.getByTestId('pooled-slope').innerText());
    const predicted = Number(await page.getByTestId('predicted-slope').innerText());
    expect(pooled).toBeCloseTo(predicted, 1);
    expect(Number(await page.getByTestId('within-slope').innerText())).toBeGreaterThan(0);
    expect(pooled).toBeLessThan(0);
  });

  test('bias-variance: no noise means no variance', async ({ page }) => {
    await page.goto('/bias-variance?noise=0&degree=9');
    await expect(page.getByTestId('variance-value')).toHaveText('0.000');
    await expect(page.getByTestId('noise-value')).toHaveText('0.000');
  });

  test('bias-variance: training error undershoots error on new data', async ({ page }) => {
    await page.goto('/bias-variance?degree=9&trainSize=12');
    const train = Number(await page.getByTestId('train-error').innerText());
    const expected = Number(await page.getByTestId('expected-error').innerText());
    expect(train).toBeLessThan(expected / 5);
  });
});
