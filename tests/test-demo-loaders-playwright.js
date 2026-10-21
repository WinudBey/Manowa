/**
 * @fileoverview Playwright testi: Yukleme animasyonlari demo sayfasi (Secenek A ve Secenek B).
 * Ekran goruntulerini alir ve konsol hatalarini dogrular.
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

async function testDemoLoaders() {
  console.log('=== Playwright: Yukleme Animasyonlari Demo Dogrulamasi ===');

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

  const demoPath = 'file:///' + path.resolve(__dirname, 'demo-loaders.html').replace(/\\/g, '/');

  console.log('1. Demo sayfasi aciliyor:', demoPath);
  await page.goto(demoPath, { waitUntil: 'domcontentloaded' });

  // 1. Ekran Goruntusu: Secenek B (Tam Ekran Preloader)
  console.log('2. Secenek B (Tam Ekran Preloader) fotografi yakalaniyor...');
  const screenBPath = path.join(screenshotsDir, 'option-b-fullscreen-preloader.png');
  await page.screenshot({ path: screenBPath });

  // Preloader kapanmasi icin bekle (1.5s)
  await page.waitForTimeout(1600);

  // 2. Secenek A'yi tetikle (Ust Ilerleme Cubugu)
  console.log('3. Secenek A (Ust Ilerleme Cubugu) tetikleniyor...');
  await page.click('#btn-trigger-a');
  await page.waitForTimeout(250); // Cubuk ilerlerken yakalayalim

  const screenAPath = path.join(screenshotsDir, 'option-a-top-progress-bar.png');
  await page.screenshot({ path: screenAPath });

  // Gorsellerin ve cubugun tamamlanmasini bekle
  await page.waitForTimeout(2000);
  const screenCardsPath = path.join(screenshotsDir, 'option-cards-loaded.png');
  await page.screenshot({ path: screenCardsPath });

  // Artifact klasorune kopyala (varsa)
  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(screenBPath, path.join(brainDir, 'option-b-fullscreen-preloader.png'));
    fs.copyFileSync(screenAPath, path.join(brainDir, 'option-a-top-progress-bar.png'));
    fs.copyFileSync(screenCardsPath, path.join(brainDir, 'option-cards-loaded.png'));
    console.log('Ekran goruntuleri brain klasorune kopyalandi.');
  }

  await browser.close();

  console.log('Konsol hatalari:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Hatalar:', consoleErrors);
    process.exit(1);
  }

  console.log('Tum ekran goruntuleri basariyla uretildi.');
}

testDemoLoaders().catch((err) => {
  console.error('Test hatasi:', err);
  process.exit(1);
});
