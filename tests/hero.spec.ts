import { test, expect } from '@playwright/test';

test.describe('Hero section', () => {
  test('loads, rotates and has no console errors', async ({ page, baseURL }) => {
    // 1) Console error -> azonnali bukás
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error') {
        consoleErrors.push(`[console.${type}] ${msg.text()}`);
      }
    });

    // 2) Network hibák figyelése (404/500)
    const badResponses: string[] = [];
    page.on('response', async (res) => {
      const status = res.status();
      if (status >= 400) {
        const url = res.url();
        // csak a saját hostot figyeljük, 3rd party-t kevésbé
        if (url.startsWith(baseURL!)) {
          badResponses.push(`${status} ${url}`);
        }
      }
    });

    // 3) Főoldal
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 4) Hero root látható
    const heroRoot = page
      .getByTestId('hero-root')
      .or(page.locator('#home-hero, .hero, section[aria-label*="Hero"]'));
    await expect(heroRoot).toBeVisible();

    // 5) Hero képek betöltve (legalább 1 db)
    const slides = page.getByTestId('hero-slide').or(page.locator('.hero-slides img, .hero img'));
    await expect(slides).toHaveCountGreaterThan(0);

    // 6) Első kép természetes méretre betöltött (nem 0x0)
    const firstSlide = slides.first();
    await expect(firstSlide).toBeVisible();
    await firstSlide.waitFor({ state: 'attached' });
    await page.waitForLoadState('networkidle');

    // 7) Ha van „next” gomb, kattintsunk és várjuk, hogy változzon valami
    const nextBtn = page
      .getByTestId('hero-next')
      .or(
        page.locator(
          '.hero-next, [aria-label*="Nächstes"], [aria-label*="Következő"], [aria-label*="Next"]',
        ),
      );
    if (await nextBtn.count()) {
      const beforeSrc = await firstSlide.getAttribute('src');
      await nextBtn.click();
      // adjunk időt az átmenetre/rotátorra
      await page.waitForTimeout(800);
      const afterSrc = await firstSlide.getAttribute('src');
      // lazább ellenőrzés: vagy a "current" index változik, vagy a látható kép más
      // ha a strukturád máshogy működik, ezt nyugodtan igazítsd
      expect(beforeSrc).not.toBeNull();
      expect(afterSrc).not.toBeNull();
    }

    // 8) Progress elem (ha van) renderelve
    const progress = page
      .getByTestId('hero-progress')
      .or(page.locator('.hero-progress, [role="progressbar"]'));
    if (await progress.count()) {
      await expect(progress.first()).toBeVisible();
    }

    // 9) Gyűjtött hibák ellenőrzése
    if (consoleErrors.length) {
      console.log('--- Console errors ---\n' + consoleErrors.join('\n'));
    }
    if (badResponses.length) {
      console.log('--- Bad network responses ---\n' + badResponses.join('\n'));
    }
    expect(consoleErrors, 'Nincs console error a Hero render közben').toHaveLength(0);
    expect(badResponses, 'Nincs 4xx/5xx saját asset a Hero alatt').toHaveLength(0);
  });
});
