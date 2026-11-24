import { expect, test, type Page } from '@playwright/test';

function dashboard(page: Page) {
  return page.locator('[data-mobile-dashboard-fixture] > div').first();
}

async function openMobileDashboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__TAURI_OS_PLUGIN_INTERNALS__', { configurable: true, value: { os_type: 'android' } });
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 14)' });
  });
  await page.goto('/?a11y-fixture=mobile-dashboard');
  await expect(dashboard(page)).toBeVisible();
}

for (const width of [320, 360, 390, 430]) {
  test(`portrait ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await openMobileDashboard(page);
    const header = dashboard(page).locator('header').first();
    const overflows = await header.evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(overflows).toBe(false);
    for (const button of await header.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    }
  });
}

test('portrait 320 with a long localized app title', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => {
    Object.defineProperty(window, '__TAURI_OS_PLUGIN_INTERNALS__', { configurable: true, value: { os_type: 'android' } });
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 14)' });
  });
  await page.goto('/?a11y-fixture=mobile-dashboard&locale-stress');
  await expect(dashboard(page)).toBeVisible();
  const header = dashboard(page).locator('header').first();
  const dimensions = await header.evaluate(el => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
  expect(
    dimensions.scrollWidth > dimensions.clientWidth + 1,
    `Header width: ${dimensions.scrollWidth}px scrollable / ${dimensions.clientWidth}px visible`,
  ).toBe(false);
});

test('portrait search keeps its keyboard controls and filter sheet inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openMobileDashboard(page);
  const skipTour = page.getByRole('button', { name: 'Skip drive introduction' });
  if (await skipTour.isVisible()) await skipTour.click();

  const search = page.getByRole('searchbox', { name: 'Search files in this folder' });
  await search.fill('mobile-fixture-file-500');
  await expect(page.getByText('1 result')).toBeVisible();
  const clear = page.getByRole('button', { name: 'Clear search' });
  await expect(clear).toBeVisible();
  await clear.press('Enter');
  await expect(page.getByText('500 results')).toBeVisible();

  await page.getByRole('button', { name: 'Filters' }).click();
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(321);
  await sheet.getByRole('combobox').first().selectOption('video');
  await expect(page.getByRole('button', { name: 'Filters' }).getByText('1')).toBeVisible();
  await sheet.press('Escape');
  await expect(sheet).toBeHidden();
});

test('footer navigation keeps the transfers view available while folders drawer opens and closes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openMobileDashboard(page);
  const skipTour = page.getByRole('button', { name: 'Skip drive introduction' });
  if (await skipTour.isVisible()) await skipTour.click();

  await page.getByRole('button', { name: 'Transfers' }).click();
  await expect(page.getByLabel('Transfer queue')).toBeVisible();
  await expect(page.getByText('写真 paused.jpg').first()).toBeVisible();

  await page.getByRole('button', { name: 'Files' }).click();
  await page.getByRole('button', { name: 'Open folders' }).click();
  await expect(page.getByRole('button', { name: 'Close folders' })).toBeVisible();
  await page.getByRole('button', { name: 'Close folders' }).click();
  await expect.poll(async () => {
    const box = await page.getByRole('button', { name: 'Close folders' }).boundingBox();
    return box ? box.x + box.width : 0;
  }).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Transfers' }).click();
  await expect(page.getByText('写真 paused.jpg').first()).toBeVisible();

  const footer = dashboard(page).locator(':scope > footer');
  await expect(footer).toBeVisible();
  await expect(footer.getByRole('navigation')).toBeVisible();

  await page.getByRole('button', { name: 'Files' }).click();
  const main = dashboard(page).locator(':scope > main');
  await expect(main.locator('[data-select-id]').first()).toBeVisible();
  // Each newly mounted row replaces an estimated size. Reach the measured end
  // after those updates, without the shell's smooth-scroll animation racing us.
  await expect.poll(async () => {
    await main.evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
    return main.locator('[data-select-id="10499"]').count();
  }).toBe(1);
  const lastFile = page.getByText('mobile-fixture-file-500.txt').first();
  await expect(lastFile).toBeVisible();
  const [lastFileBox, footerBox] = await Promise.all([lastFile.boundingBox(), footer.boundingBox()]);
  expect(lastFileBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(lastFileBox!.y + lastFileBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
});

test('500-file grid remains selectable through portrait orientation changes and scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openMobileDashboard(page);
  const skipTour = page.getByRole('button', { name: 'Skip drive introduction' });
  if (await skipTour.isVisible()) await skipTour.click();

  const main = dashboard(page).locator(':scope > main');
  const firstFile = main.locator('[data-select-id="10000"]');
  await expect(firstFile).toBeVisible();
  await page.getByRole('button', { name: 'Select' }).click();
  await firstFile.click();
  await expect(firstFile).toHaveAttribute('aria-pressed', 'true');

  await page.setViewportSize({ width: 740, height: 320 });
  await expect(firstFile).toHaveAttribute('aria-pressed', 'true');

  await main.evaluate(element => element.scrollTo({ top: element.scrollHeight / 2, behavior: 'instant' }));
  await expect(main.getByText('mobile-fixture-file-250.txt')).toBeVisible();

  await main.evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
  await expect(main.getByText('mobile-fixture-file-500.txt')).toBeVisible();
});
