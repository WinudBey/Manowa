let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright');
}
const path = require('path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');
  console.log('Loading:', previewPath);
  await page.goto(previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  
  // 1. Open reader with first series
  await page.evaluate(() => {
    const app = window.ManowaApp;
    const series = app.catalog.seriesList.find((s) => s.chapters && s.chapters.length > 1) || app.catalog.seriesList[0];
    app.openReader(series.id, series.chapters[0].id);
  });
  await page.waitForSelector('#btn-chapter-dropdown', { state: 'visible' });
  await page.waitForTimeout(400);

  // Check initial trigger label
  const initialLabel = await page.$eval('#reader-current-chapter-label', (el) => el.textContent.trim());
  console.log('Initial chapter trigger label:', initialLabel);
  assert.equal(initialLabel.length > 0, true);

  // 2. Click chapter dropdown button to open custom listbox
  console.log('Clicking chapter dropdown button...');
  await page.click('#btn-chapter-dropdown');
  await page.waitForTimeout(300);

  // Verify menu is visible and expanded
  const isExpanded = await page.$eval('#btn-chapter-dropdown', (el) => el.getAttribute('aria-expanded'));
  const isMenuVisible = await page.$eval('#reader-chapter-menu', (el) => !el.classList.contains('hidden'));
  assert.equal(isExpanded, 'true', 'Button aria-expanded true olmali');
  assert.equal(isMenuVisible, true, 'Custom chapter menu gorunur olmali');

  // Verify active option has active class and check icon
  const activeOptText = await page.$eval('#reader-chapter-menu .reader-chapter-option.active', (el) => el.textContent.trim());
  console.log('Active option text in menu:', activeOptText);
  assert.equal(activeOptText.includes(initialLabel), true);

  // Screenshot: custom chapter listbox opened
  await page.screenshot({
    path: path.join(__dirname, 'screenshots/custom-chapter-listbox-opened.png'),
    fullPage: false
  });
  console.log('Screenshot saved: custom-chapter-listbox-opened.png');

  // 3. Test filter search
  console.log('Testing chapter filter search...');
  await page.fill('#input-chapter-filter', '2');
  await page.waitForTimeout(200);

  // 4. Click second chapter option
  const options = await page.$$('#reader-chapter-options-list .reader-chapter-option:not(.hidden)');
  console.log('Filtered options count:', options.length);
  assert.equal(options.length >= 1, true, 'Filtrelenen en az 1 bolum olmali');
  await options[0].click();
  await page.waitForTimeout(400);

  const newLabel = await page.$eval('#reader-current-chapter-label', (el) => el.textContent.trim());
  console.log('New chapter trigger label after click:', newLabel);
  assert.equal(newLabel.includes('2'), true, 'Yeni etiket Bolum 2 olmali');

  const isClosedAfterClick = await page.$eval('#reader-chapter-menu', (el) => el.classList.contains('hidden'));
  assert.equal(isClosedAfterClick, true, 'Secim yapildiktan sonra menu otomatik kapanmali');

  // Screenshot: full view after selection
  await page.screenshot({
    path: path.join(__dirname, 'screenshots/custom-chapter-listbox-selected.png'),
    fullPage: false
  });
  console.log('Screenshot saved: custom-chapter-listbox-selected.png');

  await browser.close();

  assert.equal(consoleErrors.length, 0, 'Sifir konsol hatasi olmali');
  console.log('Custom chapter listbox test completed successfully with 0 console errors!');
})();
