/**
 * @fileoverview Playwright gorsel ve E2E testi: Blogger Statik Sayfa Gorunumu (#view-page).
 * Sayfa URL rotasini (#sayfa veya /p/*.html), icerik aktarimini ve geri donus butonunu dogrular.
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

async function testStaticPageView() {
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

  // 1. Dogrudan #sayfa rotasiyla acilis (Blogger statik sayfa simülasyonu)
  console.log('1. Navigating to preview.html#sayfa...');
  await page.goto(previewPath + '#sayfa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // 2. #view-page gorunumunun aktif oldugunu, #view-catalog'un gizlendigini dogrula
  const pageViewVisible = await page.$eval('#view-page', (el) => !el.classList.contains('hidden'));
  const catalogViewHidden = await page.$eval('#view-catalog', (el) => el.classList.contains('hidden'));
  assert.equal(pageViewVisible, true, '#view-page gorunumu aktif olmali');
  assert.equal(catalogViewHidden, true, '#view-catalog gorunumu gizli olmali');

  // 3. Statik sayfa icerigini DOM uzerinde test verisiyle guncelle ve render et
  await page.evaluate(() => {
    let raw = document.getElementById('blogger-static-page-raw');
    if (!raw) {
      raw = document.createElement('div');
      raw.id = 'blogger-static-page-raw';
      raw.className = 'hidden';
      document.body.appendChild(raw);
    }
    raw.innerHTML = `
      <div class="static-post-data" data-title="Hakkımızda & Künye">
        <h3>Manowa Çeviri Ekibi Hakkında</h3>
        <p>Manowa, kaliteli webtoon, manga ve novel çevirilerini okuyuculara sunan topluluk tabanlı bir platformdur.</p>
        <p>Bu statik sayfa Blogger /p/ URL yapısıyla sorunsuz çalışmaktadır.</p>
      </div>
    `;
    window.ManowaApp.openPage();
  });
  await page.waitForTimeout(300);

  const titleText = await page.$eval('#static-page-title', (el) => el.textContent.trim());
  const breadcrumbText = await page.$eval('#page-breadcrumb-title', (el) => el.textContent.trim());
  const bodyText = await page.$eval('#static-page-body', (el) => el.textContent.trim());

  assert.equal(titleText, 'Hakkımızda & Künye', 'Sayfa basligi eslesmeli');
  assert.equal(breadcrumbText, 'Hakkımızda & Künye', 'Breadcrumb basligi eslesmeli');
  assert.equal(bodyText.includes('Manowa, kaliteli webtoon'), true, 'Sayfa govdesi icerigi eslesmeli');

  // 4. Ekran goruntusu kaydet (Sayfa Gorunumu)
  const screenshotPath = path.join(screenshotsDir, 'static-page-view.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved screenshot:', screenshotPath);

  // 5. "Kataloga Don" (#btn-page-back) butonuna tikla
  console.log('2. Clicking #btn-page-back...');
  await page.click('#btn-page-back');
  await page.waitForTimeout(400);

  // 6. Katalog gorunumunun geri geldigini ve sayfa gorunumunun gizlendigini dogrula
  const catalogNowVisible = await page.$eval('#view-catalog', (el) => !el.classList.contains('hidden'));
  const pageNowHidden = await page.$eval('#view-page', (el) => el.classList.contains('hidden'));
  assert.equal(catalogNowVisible, true, 'Katalog geri donus sonrasi gorunur olmali');
  assert.equal(pageNowHidden, true, 'Sayfa gorunumu geri donus sonrasi gizlenmeli');

  // 7. Ekran goruntusu kaydet (Kataloga Donus)
  const backScreenshotPath = path.join(screenshotsDir, 'static-page-back-to-catalog.png');
  await page.screenshot({ path: backScreenshotPath, fullPage: false });
  console.log('Saved back-to-catalog screenshot:', backScreenshotPath);

  // 8. Konsol hatalarini kontrol et
  assert.equal(consoleErrors.length, 0, `Beklenmeyen konsol hatalari: ${consoleErrors.join(', ')}`);
  console.log('All static page visual and functional checks passed with 0 errors!');

  await browser.close();
}

testStaticPageView().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
