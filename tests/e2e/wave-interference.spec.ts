import { expect, test } from '@playwright/test';

test.describe('wave interference', () => {
  test('renders the spine and a live field', async ({ page }) => {
    await page.goto('/wave-interference');
    await expect(
      page.getByRole('heading', { name: 'Two sources, and the darkness between them' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What is going on' })).toBeVisible();
    await expect(page.getByRole('img', { name: /interference pattern|wave field/i })).toBeVisible();
  });

  test('counts the cancellation bands the geometry allows', async ({ page }) => {
    // d = 0.6, lambda = 0.15 -> 2 * floor(0.6/0.15 + 0.5) = 2 * 4 = 8
    await page.goto('/wave-interference?separation=0.6&wavelength=0.15&phase=0');
    await expect(page.getByTestId('nodal-count')).toHaveText('8');
    await expect(page.getByTestId('ratio')).toHaveText('4.00');
  });

  test('loses every band once the sources are closer than half a wavelength', async ({ page }) => {
    await page.goto('/wave-interference?separation=0.1&wavelength=0.3');
    await expect(page.getByTestId('nodal-count')).toHaveText('0');
  });

  test('depends only on the ratio of separation to wavelength', async ({ page }) => {
    await page.goto('/wave-interference?separation=0.4&wavelength=0.1');
    const small = await page.getByTestId('nodal-count').innerText();

    await page.goto('/wave-interference?separation=0.8&wavelength=0.2');
    const doubled = await page.getByTestId('nodal-count').innerText();

    expect(doubled).toBe(small);
  });

  test('a half-turn of phase darkens the centre', async ({ page }) => {
    await page.goto('/wave-interference?separation=0.5&wavelength=0.12&phase=0');
    await expect(page.getByTestId('axis')).toHaveText('4.00');

    await page.goto('/wave-interference?separation=0.5&wavelength=0.12&phase=3.14');
    const dark = Number(await page.getByTestId('axis').innerText());
    expect(dark).toBeLessThan(0.01);
  });

  test('the live view keeps its accessible name and control path', async ({ page }) => {
    await page.goto('/wave-interference?mode=amplitude');
    await expect(page.getByRole('img', { name: /Live wave field/ })).toBeVisible();

    const slider = page.getByLabel('Source separation');
    await slider.focus();
    const before = await slider.inputValue();
    await slider.press('ArrowRight');
    expect(await slider.inputValue()).not.toBe(before);
  });

  test('the log wavelength slider moves under the keyboard', async ({ page }) => {
    // Regression: an absolute step grid on a log scale made this control stick.
    await page.goto('/wave-interference');
    const slider = page.getByLabel('Wavelength');
    await slider.focus();
    const before = await slider.inputValue();
    await slider.press('ArrowRight');
    expect(await slider.inputValue()).not.toBe(before);
  });
});
