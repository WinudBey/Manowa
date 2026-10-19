/**
 * @fileoverview Playwright E2E Testi: Blogger Dinamik Besleme ve Preview.html Veri Cekme
 * dist/preview.html uzerinde blog baglantisi, JSONP/besleme yukleme, seri ve bolum listeleme dogrulamasi.
 */

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright');
}
const { chromium } = playwright;
const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');

async function testFeedLoader() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');
  console.log('Navigating to preview:', previewPath);
  await page.goto(previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // 1. Ilk yuklemede katalog kartlari kontrolu
  const initialCards = await page.$$('.series-card');
  console.log(`Initial series cards count: ${initialCards.length}`);
  assert.ok(initialCards.length > 0, 'Ilk yuklemede varsayilan kartlar goruntulenmeli');

  // 2. Blog adresi girisi ve baglanma
  console.log('Connecting to manhawon blog...');
  await page.fill('#input-blog-origin', 'manhawon');
  await page.click('#btn-connect-blog');

  // Yukleme tamamlanana kadar bekle (maksimum 12 saniye)
  await page.waitForFunction(() => {
    const btn = document.getElementById('btn-connect-blog');
    return btn && !btn.disabled && !btn.textContent.includes('Bağlanıyor');
  }, { timeout: 15000 }).catch(() => {
    console.warn('Timeout waiting for connect button completion');
  });

  await page.waitForTimeout(1000);

  // Ekran goruntusu: Katalog
  const screenshotPathCatalog = path.join(screenshotsDir, 'preview-connected-catalog.png');
  await page.screenshot({ path: screenshotPathCatalog, fullPage: false });
  console.log(`Katalog ekran goruntusu alindi: ${screenshotPathCatalog}`);

  // 3. Yuklenen serilerin kontrolu
  const loadedTitles = await page.$$eval('#catalog-grid .series-card .card-title', (els) =>
    els.map((e) => e.textContent.trim())
  );
  console.log('Loaded series titles in catalog-grid:', loadedTitles);

  assert.ok(loadedTitles.length >= 2, 'En az 2 seri yuklenmis olmali');
  const hasWistoria = loadedTitles.some((t) => /wistoria/i.test(t));
  const hasOmniscient = loadedTitles.some((t) => /omniscient/i.test(t));
  assert.ok(hasWistoria || hasOmniscient, 'Wistoria veya Omniscient serisi katalogda yer almali');

  // 4. Bolum sayisi kontrolu (0 Bolum hatasi giderilmis olmali)
  const metaTexts = await page.$$eval('#catalog-grid .series-card .card-meta', (els) =>
    els.map((e) => e.textContent.trim())
  );
  console.log('Loaded card meta texts:', metaTexts);
  const zeroChapterMeta = metaTexts.find((m) => m.includes('0 Bölüm') || m.includes('0 Bolum'));
  assert.equal(zeroChapterMeta, undefined, 'Hicbir seride "0 Bolum" olmamali');

  // 5. Bir seriye tiklayip seri detay sayfasini acma
  console.log('Opening series detail...');
  await page.click('#catalog-grid .series-card:first-child a[data-action="detail"]');
  await page.waitForTimeout(800);

  const seriesViewVisible = await page.$eval('#view-series', (el) => {
    return !el.classList.contains('hidden') && window.getComputedStyle(el).display !== 'none';
  });
  assert.ok(seriesViewVisible, 'Seri detay sayfasi (#view-series) gorunur olmali');

  // Ekran goruntusu: Seri Detay
  const screenshotPathSeries = path.join(screenshotsDir, 'preview-connected-series.png');
  await page.screenshot({ path: screenshotPathSeries, fullPage: false });
  console.log(`Seri detay ekran goruntusu alindi: ${screenshotPathSeries}`);

  // Bolum listesi kontrolu (#chapter-list-grid .chapter-item-btn)
  const chapterItems = await page.$$('#chapter-list-grid .chapter-item-btn');
  console.log(`Series detail chapter items count: ${chapterItems.length}`);
  assert.ok(chapterItems.length > 0, 'Seri icinde en az 1 bolum listelenmeli');

  // Konsol hatalarinin kontrolu
  const criticalErrors = consoleErrors.filter((err) =>
    !err.includes('favicon') && !err.includes('disqus')
  );
  console.log('Critical console errors:', criticalErrors);
  assert.equal(criticalErrors.length, 0, 'Hicbir kritik konsol hatasi olmamali');

  await browser.close();
  console.log('Tum dinamik veri yukleme Playwright testleri basariyla tamamlandi!');
}

testFeedLoader().catch((err) => {
  console.error('Playwright Test Hatasi:', err);
  process.exit(1);
});
