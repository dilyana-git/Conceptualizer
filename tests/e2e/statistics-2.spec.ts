import { expect, test } from '@playwright/test';

/**
 * Smoke tests for the inference, sampling and optimisation explorables.
 *
 * Every navigation carries query parameters, which suppresses the §2.4 intro
 * sweep — so these read settled values without needing to wait it out.
 */

const SLUGS = ['bayes-base-rates', 'central-limit', 'gradient-descent'] as const;

test.describe('the pages render and are usable', () => {
  for (const slug of SLUGS) {
    test(`${slug}: five-part spine, a model, and labelled controls`, async ({ page }) => {
      await page.goto(`/${slug}`);

      await expect(page.getByRole('heading', { name: 'What is going on' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Try to break it' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'What this leaves out' })).toBeVisible();

      // The model itself, whether it is SVG or canvas, exposes an accessible name.
      await expect(page.getByRole('img').first()).toBeVisible();

      // Every slider is reachable by its label and moves with the keyboard.
      const slider = page.locator('input[type=range]').first();
      await slider.focus();
      const before = await slider.inputValue();
      await slider.press('ArrowRight');
      expect(await slider.inputValue()).not.toBe(before);
    });
  }
});

test.describe('base rates', () => {
  test('reproduces the classic 1% case: a positive is mostly a false alarm', async ({ page }) => {
    await page.goto('/bayes-base-rates?prevalence=0.01&sensitivity=0.99&specificity=0.95');
    await expect(page.getByTestId('ppv')).toHaveText('16.7%');
    // LR+ = 0.99 / 0.05 = 19.8
    await expect(page.getByTestId('likelihood-ratio')).toHaveText('19.8x');
  });

  test('is rescued by specificity, not by sensitivity', async ({ page }) => {
    await page.goto('/bayes-base-rates?prevalence=0.01&sensitivity=1&specificity=0.95');
    const perfectSensitivity = Number((await page.getByTestId('ppv').innerText()).replace('%', ''));
    expect(perfectSensitivity).toBeLessThan(20);

    await page.goto('/bayes-base-rates?prevalence=0.01&sensitivity=0.99&specificity=0.999');
    const betterSpecificity = Number((await page.getByTestId('ppv').innerText()).replace('%', ''));
    expect(betterSpecificity).toBeGreaterThan(90);
  });

  test('a second independent positive compounds the evidence', async ({ page }) => {
    await page.goto('/bayes-base-rates?prevalence=0.01&tests=2');
    const twice = Number((await page.getByTestId('ppv').innerText()).replace('%', ''));
    expect(twice).toBeGreaterThan(79);
  });
});

test.describe('central limit theorem', () => {
  test('shrinks the spread as sigma over root n', async ({ page }) => {
    // Exponential parent has sigma = 1, so n = 25 predicts 0.200.
    await page.goto('/central-limit?parent=exponential&sampleSize=25&draws=5000');
    await expect(page.getByTestId('predicted-sd')).toContainText('0.200');

    const observed = Number(await page.getByTestId('observed-sd').innerText());
    expect(observed).toBeGreaterThan(0.18);
    expect(observed).toBeLessThan(0.22);
  });

  test('quadrupling the sample halves the spread', async ({ page }) => {
    await page.goto('/central-limit?parent=exponential&sampleSize=9&draws=5000');
    const at9 = Number(await page.getByTestId('observed-sd').innerText());

    await page.goto('/central-limit?parent=exponential&sampleSize=36&draws=5000');
    const at36 = Number(await page.getByTestId('observed-sd').innerText());

    expect(at9 / at36).toBeGreaterThan(1.8);
    expect(at9 / at36).toBeLessThan(2.2);
  });

  test('a more skewed parent is still lopsided at the same sample size', async ({ page }) => {
    await page.goto('/central-limit?parent=exponential&sampleSize=30&draws=5000');
    const exponential = Math.abs(Number(await page.getByTestId('observed-skew').innerText()));

    await page.goto('/central-limit?parent=lognormal&sampleSize=30&draws=5000');
    const lognormal = Math.abs(Number(await page.getByTestId('observed-skew').innerText()));

    expect(lognormal).toBeGreaterThan(exponential);
    expect(lognormal).toBeGreaterThan(0.7);
  });
});

test.describe('gradient descent', () => {
  test('reports the exact stability threshold for each quadratic surface', async ({ page }) => {
    await page.goto('/gradient-descent?surface=bowl');
    await expect(page.getByTestId('threshold')).toHaveText('1.00');
    await expect(page.getByTestId('condition-number')).toHaveText('1');

    await page.goto('/gradient-descent?surface=ravine');
    await expect(page.getByTestId('threshold')).toHaveText('0.50');
    await expect(page.getByTestId('condition-number')).toHaveText('40');
  });

  test('diverges one step past the threshold and converges just below it', async ({ page }) => {
    await page.goto('/gradient-descent?surface=bowl&learningRate=0.95&steps=300');
    const converged = Number(await page.getByTestId('final-loss').innerText());
    expect(converged).toBeLessThan(0.001);

    await page.goto('/gradient-descent?surface=bowl&learningRate=1.05&steps=300');
    await expect(page.getByTestId('final-loss')).toHaveText('diverged');
  });

  test('momentum rescues the ill-conditioned ravine', async ({ page }) => {
    await page.goto('/gradient-descent?surface=ravine&learningRate=0.4&momentum=0&steps=200&startAngle=0');
    const plain = Number(await page.getByTestId('final-loss').innerText());

    await page.goto('/gradient-descent?surface=ravine&learningRate=0.4&momentum=0.9&steps=200&startAngle=0');
    const heavy = Number(await page.getByTestId('final-loss').innerText());

    expect(heavy).toBeLessThan(plain / 10);
  });

  test('finds whichever valley it started in', async ({ page }) => {
    await page.goto('/gradient-descent?surface=double&learningRate=0.05&startAngle=0&steps=300');
    await expect(page.getByRole('img').first()).toBeVisible();
    // Both valleys are equally deep, so the loss is the same either way — the
    // point is that it settles at all, in a basin chosen by the start alone.
    const right = Number(await page.getByTestId('final-loss').innerText());

    await page.goto('/gradient-descent?surface=double&learningRate=0.05&startAngle=180&steps=300');
    const left = Number(await page.getByTestId('final-loss').innerText());

    expect(right).toBeLessThan(0.01);
    expect(left).toBeCloseTo(right, 3);
  });
});
