/**
 * @fileoverview Playwright E2E ve Gorsel Testi: Populer & One Cikanlar ve Ilgili Seriler Kapak Resimleri (Cover Art).
 * Yan paneldeki .sidebar-rank-thumb ve seri sayfasindaki .series-related-thumb gorsellerinin
 * .is-loaded sinifini aldigini, opacity: 1 oldugunu ve basariyla goruntulendigini dogrular.
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

async function testSidebarCoverArt() {
  console.log('=== Playwright Testi: Populer & One Cikanlar Kapak Resimleri ===');

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

  // SENARYO 1: Ana sayfa acilisi ve yan panel Populer & One Cikanlar kapak denetimi
  console.log('1. preview.html yukleniyor...');
  await page.goto(previewPath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const topListExists = await page.$('#sidebar-top-list');
  assert.ok(topListExists, '#sidebar-top-list elementi mevcut olmali');

  const initialItems = await page.evaluate(() => {
    const el = document.getElementById('sidebar-top-list');
    const thumbs = Array.from(el.querySelectorAll('.sidebar-rank-thumb'));
    return thumbs.map((img) => {
      const cs = window.getComputedStyle(img);
      return {
        src: img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        opacity: cs.opacity,
        isLoadedClass: img.classList.contains('is-loaded'),
        width: cs.width,
        height: cs.height
      };
    });
  });

  console.log(`2. Tumu sekmesindeki kapak resmi sayisi: ${initialItems.length}`);
  assert.ok(initialItems.length > 0, 'En az 1 adet populer seri listelenmeli');

  for (let i = 0; i < initialItems.length; i++) {
    const item = initialItems[i];
    console.log(`   Gorsel ${i + 1}: opacity=${item.opacity}, isLoaded=${item.isLoadedClass}, complete=${item.complete}, size=${item.width}x${item.height}`);
    assert.equal(item.isLoadedClass, true, `Gorsel ${i + 1} .is-loaded sinifina sahip olmali`);
    assert.equal(item.opacity, '1', `Gorsel ${i + 1} opacity: 1 olmali`);
    assert.equal(item.width, '44px', `Gorsel ${i + 1} genisligi 44px olmali`);
    assert.equal(item.height, '58px', `Gorsel ${i + 1} yuksekligi 58px olmali`);
  }

  // Ekran goruntusu: Yan panel tumu
  const sidebarEl = await page.$('#home-sidebar');
  if (sidebarEl) {
    await sidebarEl.screenshot({ path: path.join(screenshotsDir, 'sidebar-cover-art-all.png') });
    console.log('   Kayıt: sidebar-cover-art-all.png olusturuldu.');
  }

  // SENARYO 2: Sekme filtreleme (Manhwa sekmesine tiklama)
  console.log('3. Manhwa sekmesine tiklaniyor...');
  const manhwaTab = await page.$('[data-sidebar-tab="Manhwa"]');
  if (manhwaTab) {
    await manhwaTab.click();
    await page.waitForTimeout(300);

    const manhwaItems = await page.evaluate(() => {
      const el = document.getElementById('sidebar-top-list');
      const thumbs = Array.from(el.querySelectorAll('.sidebar-rank-thumb'));
      return thumbs.map((img) => {
        const cs = window.getComputedStyle(img);
        return {
          opacity: cs.opacity,
          isLoadedClass: img.classList.contains('is-loaded')
        };
      });
    });

    console.log(`   Manhwa sekmesindeki kapak resmi sayisi: ${manhwaItems.length}`);
    for (let i = 0; i < manhwaItems.length; i++) {
      assert.equal(manhwaItems[i].isLoadedClass, true, `Manhwa gorsel ${i + 1} isLoaded olmali`);
      assert.equal(manhwaItems[i].opacity, '1', `Manhwa gorsel ${i + 1} opacity: 1 olmali`);
    }
  }

  // SENARYO 3: Seri detay sayfasi Benzer Seriler kapak resmi denetimi
  console.log('4. Seri detay sayfasina geciliyor (#seri/golge-hukumdari)...');
  await page.goto(previewPath + '#seri/golge-hukumdari', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const relatedThumbs = await page.evaluate(() => {
    const el = document.getElementById('series-related-grid');
    if (!el) return [];
    const thumbs = Array.from(el.querySelectorAll('.series-related-thumb'));
    return thumbs.map((img) => {
      const cs = window.getComputedStyle(img);
      return {
        opacity: cs.opacity,
        isLoadedClass: img.classList.contains('is-loaded')
      };
    });
  });

  console.log(`   Benzer seriler kapak resmi sayisi: ${relatedThumbs.length}`);
  if (relatedThumbs.length > 0) {
    for (let i = 0; i < relatedThumbs.length; i++) {
      assert.equal(relatedThumbs[i].isLoadedClass, true, `Benzer seri gorsel ${i + 1} isLoaded olmali`);
      assert.equal(relatedThumbs[i].opacity, '1', `Benzer seri gorsel ${i + 1} opacity: 1 olmali`);
    }
  }

  // Tam sayfa ekran goruntusu
  await page.screenshot({ path: path.join(screenshotsDir, 'sidebar-cover-art-fullpage.png') });
  console.log('   Kayıt: sidebar-cover-art-fullpage.png olusturuldu.');

  // Konsol hatalarini dogrula
  console.log(`5. Konsol hatalari denetleniyor (hata sayisi: ${consoleErrors.length})...`);
  assert.equal(consoleErrors.length, 0, `Beklenmeyen konsol hatalari: ${consoleErrors.join(', ')}`);

  await browser.close();
  console.log('=== Playwright Testi Basariyla Tamamlandi! Tum kapak resimleri gorunur (opacity: 1) ===');
}

testSidebarCoverArt().catch((err) => {
  console.error('Playwright Test Hatasi:', err);
  process.exit(1);
});
