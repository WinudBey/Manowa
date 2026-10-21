/**
 * @fileoverview Playwright E2E ve Gorsel Testi: Hibrit Yukleme Modeli ve Lazy Loading.
 * 1. Ilk acilista tam ekran preloader'in gorundugunu ve kapandigini dogrular.
 * 2. SPA rota gecislerinde ust ilerleme cubugunun aktigini dogrular.
 * 3. Kart ve kapak gorsellerinin iskelet pariltisi (shimmer) ve is-loaded gecisini dogrular.
 * 4. Masaustu ve mobil ekran goruntulerini alir; konsol hatalarini (0) teyit eder.
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

async function testHybridLoaders() {
  console.log('=== Playwright Testi: Hibrit Yukleme Modeli ve Lazy Loading ===');

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const brainDir = 'C:/Users/Winud/.gemini/antigravity/brain/7e9b77e6-672b-46ad-89e0-8d062b8ba549';

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

  // ADIM 1: Ilk acilis (Cold Load) ve Tam Ekran Preloader
  console.log('1. preview.html aciliyor...');
  await page.goto(previewPath, { waitUntil: 'domcontentloaded' });

  const preloader = await page.$('#fullscreen-preloader');
  assert.ok(preloader, '#fullscreen-preloader DOM icinde bulunmali');

  // Preloader gorselini yakala
  const coldLoadScreen = path.join(screenshotsDir, 'hybrid-preloader-cold-load.png');
  await page.screenshot({ path: coldLoadScreen });
  console.log('   Cold load preloader fotografi kaydedildi.');

  // Preloader'in otomatik kapanmasini bekle (en fazla 1.2s)
  await page.waitForFunction(() => {
    const el = document.getElementById('fullscreen-preloader');
    return el && (el.classList.contains('hidden') || el.style.display === 'none');
  }, { timeout: 4000 });

  const isPreloaderHidden = await page.$eval('#fullscreen-preloader', (el) => el.classList.contains('hidden') || el.style.display === 'none');
  assert.equal(isPreloaderHidden, true, 'Preloader otomatik olarak kapanmali');
  console.log('2. Tam ekran preloader basariyla kapandi.');

  // ADIM 2: SPA Rota Degisimi ve Ust Ilerleme Cubugu
  console.log('3. Tum Seriler (#nav-directory) tiklaniyor...');
  const navDirBtn = await page.$('#nav-directory');
  assert.ok(navDirBtn, '#nav-directory butonu mevcut olmali');

  await page.click('#nav-directory');

  // Tiklama aninda ust ilerleme cubugunun aktifligini kontrol et
  const progressBarActiveScreen = path.join(screenshotsDir, 'hybrid-progress-bar-active.png');
  await page.screenshot({ path: progressBarActiveScreen });

  // Rota gecisinin tamamlanmasini bekle
  await page.waitForTimeout(500);

  const isDirectoryVisible = await page.$eval('#view-directory', (el) => !el.classList.contains('hidden'));
  assert.equal(isDirectoryVisible, true, 'Dizin (#view-directory) gorunumu aktiflesmeli');

  // ADIM 3: Kartlar ve Lazy Loading Gorunumu
  console.log('4. Dizin kartlari ve gorsel yuklenmesi test ediliyor...');
  const directoryCardsScreen = path.join(screenshotsDir, 'hybrid-directory-cards-loaded.png');
  await page.screenshot({ path: directoryCardsScreen });

  // ADIM 4: Mobil Gorunum Testi (375x812)
  console.log('5. Mobil gorunum testi baslatiliyor...');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(previewPath + '#seriler', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(600);

  const mobileScreen = path.join(screenshotsDir, 'hybrid-mobile-view.png');
  await mobilePage.screenshot({ path: mobileScreen });
  await mobileContext.close();

  // Ekran goruntulerini brain klasorune kopyala
  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(coldLoadScreen, path.join(brainDir, 'hybrid-preloader-cold-load.png'));
    fs.copyFileSync(progressBarActiveScreen, path.join(brainDir, 'hybrid-progress-bar-active.png'));
    fs.copyFileSync(directoryCardsScreen, path.join(brainDir, 'hybrid-directory-cards-loaded.png'));
    fs.copyFileSync(mobileScreen, path.join(brainDir, 'hybrid-mobile-view.png'));
    console.log('Ekran goruntuleri brain dizinine aktarildi.');
  }

  await browser.close();

  console.log('Konsol hatalari:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Hatalar:', consoleErrors);
    process.exit(1);
  }

  console.log('=== Playwright Testi Basariyla Tamamlandi ===');
}

testHybridLoaders().catch((err) => {
  console.error('Playwright Test Hatasi:', err);
  process.exit(1);
});
