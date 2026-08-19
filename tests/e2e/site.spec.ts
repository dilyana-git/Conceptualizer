import { expect, test } from '@playwright/test';

test.describe('the index', () => {
  test('lists every explorable, grouped, with working links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Explorables', level: 1 })).toBeVisible();

    // One row per registered explorable.
    const links = page.locator('main a[href^="/"]');
    expect(await links.count()).toBeGreaterThanOrEqual(9);

    await expect(page.getByRole('heading', { name: 'Physics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Statistics and data' })).toBeVisible();

    await page.getByRole('link', { name: /Who actually pays a tax/ }).click();
    await expect(page).toHaveURL(/\/tax-incidence$/);
    await expect(page.getByRole('heading', { name: 'Who actually pays a tax' })).toBeVisible();
  });

  test('an explorable links back to the index', async ({ page }) => {
    await page.goto('/central-limit');
    await page.getByRole('link', { name: 'Explorables' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Explorables', level: 1 })).toBeVisible();
  });

  test('an unknown path explains itself instead of rendering an explorable', async ({ page }) => {
    await page.goto('/no-such-thing');
    await expect(page.getByRole('heading', { name: /nothing at \/no-such-thing/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'the index' })).toBeVisible();
  });
});

/**
 * §10: "Search is the primary discovery channel; a client-rendered blank div is
 * fatal." These run with JavaScript switched off, which is the closest this
 * suite can get to what a crawler sees before it decides to execute anything.
 */
test.describe('pre-rendered HTML, without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('carries the hook and reveal prose in the markup', async ({ page }) => {
    await page.goto('/tax-incidence');

    await expect(page.getByRole('heading', { name: 'Who actually pays a tax' })).toBeVisible();
    await expect(page.getByText(/In 2010 France cut restaurant VAT/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What is going on' })).toBeVisible();
    await expect(page.getByText(/The tax opens a wedge between what buyers pay/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What this leaves out' })).toBeVisible();
  });

  test('gives every route its own title and description', async ({ page }) => {
    await page.goto('/wave-interference');
    await expect(page).toHaveTitle(/Two sources, and the darkness between them — Explorables/);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description).toContain('Add one wave to another');

    await page.goto('/gradient-descent');
    await expect(page).toHaveTitle(/Rolling downhill, badly — Explorables/);
  });

  test('the index is a real document too', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Explorables');
    await expect(page.getByRole('link', { name: /Who actually pays a tax/ })).toBeVisible();
  });

  test('describes itself to a crawler with structured data', async ({ page }) => {
    await page.goto('/survival-analysis');
    const raw = await page.locator('script[type="application/ld+json"]').innerText();
    const data = JSON.parse(raw);
    expect(data['@type']).toBe('Article');
    expect(data.headline).toBe('The people who have not died yet');
    expect(data.articleSection).toBe('statistics');
  });
});

test.describe('typography', () => {
  test('serves the three faces from this origin, not a third party', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fontRequests.push(request.url());
    });

    await page.goto('/tax-incidence');
    await page.waitForTimeout(1500);

    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests) {
      expect(url).toContain('127.0.0.1:4173');
      expect(url).not.toContain('gstatic');
      expect(url).not.toContain('googleapis');
    }
  });
});
