let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright');
}
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const filePath = 'file:///' + path.resolve('dist/blogger-post-generator-page.html').replace(/\\/g, '/');
  await page.goto(filePath, { waitUntil: 'domcontentloaded' });

  const outputVal = await page.$eval('#mpg-code-output', (el) => el.value);
  assert(outputVal.includes('actual-series-tag'), 'Output must contain actual-series-tag');
  assert(outputVal.includes('Solo Leveling'), 'Output must contain default series title');

  await page.click('#mpg-tab-chapter');
  await page.waitForTimeout(200);

  const chapterVal = await page.$eval('#mpg-code-output', (el) => el.value);
  assert(chapterVal.includes('manowa-chapter-post'), 'Output must contain manowa-chapter-post');

  assert.strictEqual(errors.length, 0, 'No console errors expected');
  console.log('Static page verified successfully with 0 errors!');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
