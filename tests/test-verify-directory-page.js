/**
 * @fileoverview Playwright gorsel ve E2E testi: Sadelestirilmis Tum Seriler Kategorik Sayfasi.
 * Yalnizca Kategoriler ve Seri Durumu filtrelerini, alt kisimda dogrudan secilen kategorinin
 * kart izgarasini ve ekran goruntulerini dogrular.
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

async function testSimplifiedDirectoryPage() {
  console.log('=== Playwright Testi: Sadelestirilmis Tum Seriler Sayfasi ===');

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

  // SENARYO 1: Dogrudan #seriler rotasiyla acilis
  console.log('1. preview.html#seriler yukleniyor...');
  await page.goto(previewPath + '#seriler', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const isDirectoryVisible = await page.$eval('#view-directory', (el) => !el.classList.contains('hidden'));
  assert.equal(isDirectoryVisible, true, '#view-directory gorunumu aktif olmali');

  // Arama kutusunun ve gruplama switcher'in kaldirildigini dogrula
  const searchInputExists = await page.$('#dir-search-input');
  assert.equal(searchInputExists, null, 'Arama kutusu kaldirilmis olmali');

  const groupSwitcherExists = await page.$('.directory-group-switcher');
  assert.equal(groupSwitcherExists, null, 'Gruplama switcher kaldirilmis olmali');

  // Yalnizca Kategoriler ve Seri Durumu satirlarinin varligini dogrula
  const genrePillsExists = await page.$('#dir-genre-pills');
  assert.ok(genrePillsExists, 'Kategoriler filtre hapi bulunmali');

  const statusPillsExists = await page.$('#dir-status-pills');
  assert.ok(statusPillsExists, 'Seri Durumu filtre hapi bulunmali');

  // Ilk masaustu ekran goruntusunu al (Tum Kategoriler secili)
  const desktopImg = path.join(screenshotsDir, 'directory-page-desktop.png');
  await page.screenshot({ path: desktopImg, fullPage: true });
  console.log('   Masaustu ekran goruntusu kaydedildi: directory-page-desktop.png');

  // SENARYO 2: "Aksiyon" kategorisi seciliyor
  console.log('2. "Aksiyon" kategorisine tiklaniyor...');
  const aksiyonPill = page.locator('#dir-genre-pills .dir-pill:has-text("Aksiyon")').first();
  await aksiyonPill.click();
  await page.waitForTimeout(400);

  // Alt kisimda akordeon veya grup basligi olmadan dogrudan kartlarin listelendigini dogrula
  const groupSectionExists = await page.$('.directory-group-section');
  assert.equal(groupSectionExists, null, 'Alt kisimda akordeon veya ekstra grup basligi olmamali');

  const cardsCount = await page.$$eval('.directory-series-card', (els) => els.length);
  assert.ok(cardsCount > 0, 'Secilen kategoride seriler listelenmeli');

  const actionImg = path.join(screenshotsDir, 'directory-page-action-selected.png');
  await page.screenshot({ path: actionImg, fullPage: true });
  console.log('   Aksiyon kategorisi secili ekran goruntusu kaydedildi: directory-page-action-selected.png');

  // SENARYO 3: Seri kartina tiklandiginda seri detayina gecis
  console.log('3. Listelenen serilerden birine tiklaniyor...');
  const firstCard = page.locator('.directory-series-card').first();
  await firstCard.click();
  await page.waitForTimeout(500);

  const isSeriesVisible = await page.$eval('#view-series', (el) => !el.classList.contains('hidden'));
  assert.equal(isSeriesVisible, true, 'Seri kartina tiklandiginda seri detay sayfasi acilmali');

  // SENARYO 4: Mobil Gorunum (375x812)
  console.log('4. Mobil gorunum test ediliyor (375x812)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => window.ManowaApp.openDirectory());
  await page.waitForTimeout(500);

  const mobileImg = path.join(screenshotsDir, 'directory-page-mobile.png');
  await page.screenshot({ path: mobileImg, fullPage: true });
  console.log('   Mobil ekran goruntusu kaydedildi: directory-page-mobile.png');

  // Konsol hata denetimi
  if (consoleErrors.length > 0) {
    console.error('Konsol Hatalari:', consoleErrors);
  }
  assert.equal(consoleErrors.length, 0, 'Konsol hatasi olmamali');

  await browser.close();
  console.log('=== SADELISTIRILMIS DIZIN TESTLERI BASARIYLA TAMAMLANDI! ===');
}

testSimplifiedDirectoryPage().catch((err) => {
  console.error('Test Hatasi:', err);
  process.exit(1);
});
