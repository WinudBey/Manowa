let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright');
}
const path = require('path');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');
  console.log('Loading:', previewPath);
  await page.goto(previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  
  // Open reader
  await page.evaluate(() => {
    const app = window.ManowaApp;
    const series = app.catalog.seriesList[0];
    app.openReader(series.id, series.chapters[0].id);
  });
  await page.waitForSelector('#btn-reader-settings', { state: 'visible' });
  await page.waitForTimeout(400);

  // Click settings button
  await page.click('#btn-reader-settings');
  await page.waitForTimeout(400);

  // Take screenshot of settings sheet
  await page.screenshot({ path: path.join(__dirname, 'screenshots/reader-settings-sheet-fixed.png'), fullPage: false });
  console.log('Saved screenshot: reader-settings-sheet-fixed.png');
  await browser.close();
})();
