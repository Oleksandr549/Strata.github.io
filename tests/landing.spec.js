import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ignorable = (t) => /GPU stall|GL Driver Message|WebGL-.*Performance/.test(t);

async function waitFor3D(page) {
  await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
  await page.waitForFunction(() => !!window.__strata, null, { timeout: 90000 });
}

test.describe('page shell', () => {
  test('loads with correct meta and no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    const failed = [];
    page.on('requestfailed', (r) => failed.push(r.url()));
    await page.goto('/');
    await waitFor3D(page);
    await expect(page).toHaveTitle(/STRATA S-01/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /field chronograph/i);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'og.jpg');
    await expect(page.locator('h1')).toContainText('bad weather');
    await expect(page.locator('html')).toHaveClass(/has-3d/);
    await expect(page.locator('[data-stage]')).toHaveClass(/is-ready/);
    await expect(page.locator('[data-loader]')).toHaveClass(/is-done/);
    expect(errors, errors.join('\n')).toEqual([]);
    expect(failed, failed.join('\n')).toEqual([]);
  });

  test('every image has alt text and loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
    const imgs = await page.locator('img').evaluateAll((els) => els.map((e) => ({ alt: e.getAttribute('alt'), src: e.currentSrc || e.src })));
    expect(imgs.length).toBeGreaterThan(4);
    for (const i of imgs) expect(i.alt && i.alt.length > 3).toBeTruthy();
    for (const path of ['img/hero-1100.avif', 'img/v3-860.webp', 'models/strata-hd.glb', 'models/strata-sd.glb', 'og.jpg', 'favicon.svg', 'site.webmanifest', 'robots.txt', 'fonts/archivo.woff2']) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(200);
    }
  });

  test('404 page renders', async ({ page }) => {
    await page.goto('/404.html');
    await expect(page.getByRole('heading', { name: 'Off the map' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to base' })).toHaveAttribute('href', './');
  });
});

test.describe('3D story', () => {
  test('model loads with four colour variants and real-time hands', async ({ page }) => {
    await page.goto('/');
    await waitFor3D(page);
    const info = await page.evaluate(() => ({ variants: window.__strata.scene.variants, current: window.__strata.scene.variant }));
    expect(info.variants).toEqual(['Polar White', 'Midnight Gold', 'Field Green', 'Signal Red']);
    expect(info.current).toBe(1);
  });

  test('anatomy chapter explodes the watch while scrolling', async ({ page }) => {
    await page.goto('/');
    await waitFor3D(page);
    const y = await page.evaluate(() => {
      const an = document.querySelector('#anatomy');
      return an.getBoundingClientRect().top + scrollY + (an.offsetHeight - innerHeight) * 0.55;
    });
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForFunction(() => window.__strata.story.update().explode > 0.95);
    await expect(page.locator('[data-layer].is-on')).not.toHaveCount(0);
    const top = await page.evaluate(() => document.querySelector('#anatomy .sticky').getBoundingClientRect().top);
    expect(Math.abs(top)).toBeLessThan(2);
  });

  test('night shift turns the lume on', async ({ page }) => {
    await page.goto('/');
    await waitFor3D(page);
    await page.evaluate(() => {
      const n = document.querySelector('#night');
      window.scrollTo(0, n.getBoundingClientRect().top + scrollY + n.offsetHeight * 0.3);
    });
    await page.waitForFunction(() => window.__strata.story.update().lume > 0.9);
  });
});

test.describe('interactions', () => {
  test('cast switches colour by click and keyboard', async ({ page }) => {
    await page.goto('/');
    await waitFor3D(page);
    await page.locator('#cast').scrollIntoViewIfNeeded();
    const green = page.getByRole('radio', { name: /Field Green/ });
    await green.click();
    await expect(green).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-cast-line]')).toContainText('treeline');
    await page.waitForFunction(() => window.__strata.scene.variant === 2, null, { timeout: 30000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('#9fd8b8');
    await page.keyboard.press('ArrowDown');
    const red = page.getByRole('radio', { name: /Signal Red/ });
    await expect(red).toHaveAttribute('aria-checked', 'true');
    await expect(red).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('radio', { name: /Polar White/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('reserve form validates and confirms', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
    const input = page.getByLabel('Email for the ship date');
    const button = page.getByRole('button', { name: 'Reserve yours' });
    await button.click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-reserve-msg]')).toHaveText(/Enter your email/);
    await input.fill('pilot@strata');
    await button.click();
    await expect(page.locator('[data-reserve-msg]')).toHaveText(/looks incomplete/);
    await input.fill('pilot@strata.watch');
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await button.click();
    await expect(page.locator('[data-reserve-msg]')).toHaveText(/Reserved for pilot@strata.watch/);
    await expect(input).toHaveValue('');
  });

  test('sound toggle starts and stops the ambience', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
    const btn = page.getByRole('button', { name: 'Sound' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('skip link moves focus to the main content', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('chapter navigation scrolls to the section', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
    await page.getByRole('navigation', { name: 'Chapters' }).getByRole('link', { name: 'The cast' }).click();
    await page.waitForFunction(() => Math.abs(document.querySelector('#cast').getBoundingClientRect().top) < 10, null, { timeout: 15000 });
  });
});

test.describe('fallbacks and layout', () => {
  test('reduced motion shows still frames and no WebGL', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
    await expect(page.locator('html')).toHaveClass(/no-3d/);
    await expect(page.locator('html')).not.toHaveClass(/has-3d/);
    await expect(page.locator('[data-slot="hero"] img')).toBeVisible();
    const pos = await page.locator('#anatomy .sticky').evaluate((e) => getComputedStyle(e).position);
    expect(pos).toBe('relative');
    await ctx.close();
  });

  test('browsers without WebGL get the still-frame version', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (/webgl/i.test(type)) return null;
        return orig.call(this, type, ...rest);
      };
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
    await expect(page.locator('html')).toHaveClass(/no-3d/);
    await expect(page.locator('[data-slot="hero"] img')).toBeVisible();
    await expect(page.locator('[data-loader]')).toHaveClass(/is-done/);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('phones load the lighter model', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const models = [];
    page.on('request', (r) => { if (r.url().includes('/models/')) models.push(r.url().split('/').pop()); });
    await page.goto('/');
    await page.waitForFunction(() => !!window.__strata, null, { timeout: 90000 });
    expect(models).toEqual(['strata-sd.glb']);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await ctx.close();
  });

  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    test(`no horizontal overflow at ${width}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width, height: 800 } });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await ctx.close();
    });
  }

  test('no serious accessibility violations', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('is-booted'));
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
    await ctx.close();
  });
});
