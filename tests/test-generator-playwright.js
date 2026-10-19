/**
 * @fileoverview Playwright gorsel ve etkilesim testi: Blogger Gonderi Olusturucu
 * Seri Tanitimi ve Bolum Okuma sekmelerinin, form alanlarinin ve HTML uretiminin dogrulamasi.
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

async function testGeneratorTabs() {
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
  console.log('Navigating to:', previewPath);
  await page.goto(previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // 1. Open Generator View
  console.log('Opening generator view...');
  await page.evaluate(() => {
    window.ManowaApp.openGenerator();
  });
  await page.waitForTimeout(300);

  // 2. Verify Tab 1 (Seri Tanitimi) is active by default
  const seriesTabActive = await page.$eval('#btn-tab-gen-series', (el) => el.classList.contains('active'));
  const seriesPanelVisible = await page.$eval('#panel-gen-series', (el) => !el.classList.contains('hidden'));
  const chapterPanelHidden = await page.$eval('#panel-gen-chapter', (el) => el.classList.contains('hidden'));

  assert.equal(seriesTabActive, true, 'Seri Tanitimi sekmesi varsayilan olarak aktif olmali');
  assert.equal(seriesPanelVisible, true, 'Seri Tanitimi formu gorunur olmali');
  assert.equal(chapterPanelHidden, true, 'Bolum formu baslangicta gizli olmali');

  // 3. Fill in custom Series Data
  await page.fill('#gen-series-title', 'Solo Leveling');
  await page.fill('#gen-series-alt-title', 'Only I Level Up');
  await page.selectOption('#gen-source-lang', 'KR');
  await page.selectOption('#gen-series-status', 'Devam Ediyor');
  await page.selectOption('#gen-reader-mode', 'webtoon');
  await page.fill('#gen-series-cover', 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600');
  await page.fill('#gen-series-author', 'Chugong');
  await page.fill('#gen-series-artist', 'DUBU (REDICE STUDIO)');
  await page.fill('#gen-series-translator', 'Manowa Ekibi');
  await page.fill('#gen-series-editor', 'Baş Editör');
  await page.fill('#gen-series-year', '2018');
  await page.fill('#gen-series-genres', 'Aksiyon, Fantastik, Zindan, Doğaüstü');
  await page.fill('#gen-series-synopsis', 'On yıl önce diğer dünyalara açılan kapılar belirdi. Sung Jin-Woo en zayıf avcı iken gizli zindanda çifte uyanış yaşar.');

  // Click generate series button
  await page.click('#btn-generate-series');
  await page.waitForTimeout(200);

  // Check generated code output
  const outputCode = await page.$eval('#gen-code-output', (el) => el.value);
  const labelsText = await page.$eval('#gen-labels-info', (el) => el.textContent);

  assert.equal(outputCode.includes('data-series-id="solo-leveling"'), true, 'series-id dogru uretilmeli');
  assert.equal(outputCode.includes('data-author="Chugong"'), true, 'author verisi olmali');
  assert.equal(outputCode.includes('<strong>Yazar:</strong> <span>Chugong</span>'), true, 'Yazar meta satiri olmali');
  assert.equal(outputCode.includes('<strong>Çizer:</strong> <span>DUBU (REDICE STUDIO)</span>'), true, 'Cizer meta satiri olmali');
  assert.equal(outputCode.includes('<strong>Editör:</strong> <span>Baş Editör</span>'), true, 'Editor meta satiri olmali');
  assert.equal(labelsText.includes('Solo Leveling'), true, 'Etiketlerde seri adi yer almali');
  assert.equal(labelsText.includes('Manhwa'), true, 'Etiketlerde tur yer almali');

  // Screenshot 1: Series tab
  const ssSeriesPath = path.join(screenshotsDir, 'generator-series-tab.png');
  await page.screenshot({ path: ssSeriesPath, fullPage: true });
  console.log('Saved series tab screenshot:', ssSeriesPath);

  // 4. Switch to Tab 2 (Bolum Okuma)
  console.log('Switching to chapter tab...');
  await page.click('#btn-tab-gen-chapter');
  await page.waitForTimeout(300);

  const chapterTabActive = await page.$eval('#btn-tab-gen-chapter', (el) => el.classList.contains('active'));
  const chapterPanelVisible = await page.$eval('#panel-gen-chapter', (el) => !el.classList.contains('hidden'));
  const seriesPanelHiddenNow = await page.$eval('#panel-gen-series', (el) => el.classList.contains('hidden'));

  assert.equal(chapterTabActive, true, 'Bolum sekmesi aktif olmali');
  assert.equal(chapterPanelVisible, true, 'Bolum formu gorunur olmali');
  assert.equal(seriesPanelHiddenNow, true, 'Seri formu gizlenmis olmali');

  // Check that series title synced or exists
  const chSeriesTitle = await page.$eval('#gen-chapter-series-title', (el) => el.value);
  assert.equal(chSeriesTitle, 'Solo Leveling', 'Bolum formundaki seri adi otomatik eslesmeli');

  // Click generate chapter button
  await page.click('#btn-generate-chapter');
  await page.waitForTimeout(200);

  const chapterOutputCode = await page.$eval('#gen-code-output', (el) => el.value);
  assert.equal(chapterOutputCode.includes('data-series-id="solo-leveling"'), true, 'Bolum kodu dogru seri id icermeli');
  assert.equal(chapterOutputCode.includes('class="manowa-chapter-post"'), true, 'Bolum post kapsayicisi olmali');

  // Screenshot 2: Chapter tab
  const ssChapterPath = path.join(screenshotsDir, 'generator-chapter-tab.png');
  await page.screenshot({ path: ssChapterPath, fullPage: true });
  console.log('Saved chapter tab screenshot:', ssChapterPath);

  // 5. Console error check
  console.log('Console errors count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  }
  assert.equal(consoleErrors.length, 0, 'Sifir konsol hatasi olmali');

  await browser.close();
  console.log('TUM PLAYWRIGHT GORSEL VE ETKILEM TESTLERI BASARIYLA TAMAMLANDI!');
}

testGeneratorTabs().catch((err) => {
  console.error('Test hatasi:', err);
  process.exit(1);
});
