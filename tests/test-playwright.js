let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright');
}
const { chromium } = playwright;
const path = require('path');
const fs = require('fs');

async function runVisualTest() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
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
  await page.waitForTimeout(500);

  // 1. Verify reader in desktop view
  const result = await page.evaluate(async () => {
    const app = window.ManowaApp;
    if (!app) {
      return { success: false, reason: 'ManowaApp is not defined' };
    }
    if (!app.catalog || app.catalog.seriesList.length === 0) {
      app.testGeneratedInReader();
    }
    const series = app.catalog.seriesList[0];
    const chapter = series.chapters[0];
    await app.openReader(series.id, chapter.id);

    const siteHeader = document.querySelector('.site-header');
    const siteMain = document.querySelector('.site-main');
    const readerWrapper = document.getElementById('reader-wrapper');
    const stickyHeader = document.getElementById('reader-sticky-header');
    const footerBar = document.getElementById('reader-footer-bar');
    const siteFooter = document.querySelector('.site-footer');

    const headerDisplay = window.getComputedStyle(siteHeader).display;
    const footerDisplay = window.getComputedStyle(siteFooter).display;
    const mainPadding = window.getComputedStyle(siteMain).padding;
    const mainMaxWidth = window.getComputedStyle(siteMain).maxWidth;
    const wrapperRadius = window.getComputedStyle(readerWrapper).borderRadius;
    const wrapperBorder = window.getComputedStyle(readerWrapper).borderTopWidth;
    const stickyHeaderRadius = window.getComputedStyle(stickyHeader).borderRadius;
    const footerBarRadius = window.getComputedStyle(footerBar).borderRadius;

    return {
      success: true,
      headerDisplay,
      footerDisplay,
      mainPadding,
      mainMaxWidth,
      wrapperRadius,
      wrapperBorder,
      stickyHeaderRadius,
      footerBarRadius,
      activeView: document.body.getAttribute('data-active-view')
    };
  });

  console.log('Reader desktop check result:', result);
  await page.waitForTimeout(300);

  // Take screenshot of webtoon/image reader desktop
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-desktop-fullscreen.png'),
    fullPage: false
  });

  // 2. Test novel mode in desktop
  await page.evaluate(() => {
    const app = window.ManowaApp;
    const series = app.catalog.seriesList[0];
    const chapter = series.chapters[0];
    chapter.novelText = '<h3>Bölüm 1 - Hayatta Kalmanın Üç Yolu</h3><p>Artık bazılarının ayrıntılarını unuttum. Fakat bir şeyden eminim: Şimdi bu kelimeleri okumakta olan sizler hayatta kalacaksınız.</p><p>Eski akıllı telefonumun ekranını bir web romanı platformu kaplamıştı.</p>';
    app.reader.loadChapter(series.id, chapter);
    app.reader.setMode('novel');
    app.renderReaderViewport();
  });
  await page.waitForTimeout(300);

  const novelResult = await page.evaluate(() => {
    const siteHeader = document.querySelector('.site-header');
    const headerDisplay = window.getComputedStyle(siteHeader).display;
    return {
      headerDisplay,
      mode: window.ManowaApp.reader.mode
    };
  });
  console.log('Novel mode check result:', novelResult);

  // Take screenshot of novel reader desktop
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-novel-fullscreen.png'),
    fullPage: false
  });

  // 3. Test mobile viewport (375x812)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);

  const mobileResult = await page.evaluate(() => {
    const siteHeader = document.querySelector('.site-header');
    const siteMain = document.querySelector('.site-main');
    return {
      headerDisplay: window.getComputedStyle(siteHeader).display,
      mainPadding: window.getComputedStyle(siteMain).padding
    };
  });
  console.log('Mobile check result:', mobileResult);

  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-mobile-fullscreen.png'),
    fullPage: false
  });

  // 4. Test exiting reader back to catalog or series
  await page.evaluate(() => {
    window.ManowaApp.openCatalog();
  });
  await page.waitForTimeout(300);

  const catalogResult = await page.evaluate(() => {
    const siteHeader = document.querySelector('.site-header');
    return {
      headerDisplay: window.getComputedStyle(siteHeader).display,
      activeView: document.body.getAttribute('data-active-view')
    };
  });
  console.log('Catalog restoration check result:', catalogResult);

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('Console errors detected:', consoleErrors);
  } else {
    console.log('No console errors detected! All visual tests passed.');
  }

  // Assertions
  if (result.headerDisplay !== 'none') throw new Error(`Site header should be hidden in reader, got: ${result.headerDisplay}`);
  if (result.wrapperRadius !== '0px') throw new Error(`Reader wrapper radius should be 0px, got: ${result.wrapperRadius}`);
  if (catalogResult.headerDisplay === 'none') throw new Error('Site header should be visible when exiting reader to catalog');

  console.log('Visual test completed successfully!');
}

runVisualTest().catch((err) => {
  console.error('Visual test failed:', err);
  process.exit(1);
});
