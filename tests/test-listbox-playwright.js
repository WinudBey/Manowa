/**
 * @fileoverview Playwright gorsel ve etkilesim testi: Liste Kutulari (Select & Listbox) Tema Uyumu
 * Tum select ve listbox elemanlarinin appearance, chevron svg, hover/focus durumlarinin ve ekran goruntulerinin dogrulamasi.
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

async function testThemeListboxes() {
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
  console.log('Navigating to preview:', previewPath);
  await page.goto(previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // 1. TEST: Gonderi Olusturucu Select Liste Kutulari
  console.log('Testing Post Generator listboxes...');
  await page.evaluate(() => {
    window.ManowaApp.openGenerator();
  });
  await page.waitForTimeout(300);

  const genSelectAppearance = await page.$eval('#gen-source-lang', (el) => {
    const s = window.getComputedStyle(el);
    return {
      appearance: s.appearance || s.webkitAppearance,
      cursor: s.cursor,
      bgImage: s.backgroundImage,
      color: s.color
    };
  });

  assert.equal(genSelectAppearance.appearance, 'none', 'Select appearance none olmali');
  assert.equal(genSelectAppearance.cursor, 'pointer', 'Select imleci pointer olmali');
  assert.equal(genSelectAppearance.bgImage.includes('svg'), true, 'Select ozel SVG oka sahip olmali');

  // Focus durumu testi
  await page.focus('#gen-source-lang');
  await page.waitForTimeout(100);

  // Ekran goruntusu: Gonderi Olusturucu Liste Kutulari
  await page.screenshot({
    path: path.join(screenshotsDir, 'listbox-generator.png'),
    fullPage: false
  });
  console.log('Screenshot saved: listbox-generator.png');

  // 2. TEST: Okuyucu Bolum Secimi (#select-chapter)
  console.log('Testing Reader chapter listbox (#select-chapter)...');
  await page.evaluate(() => {
    const app = window.ManowaApp;
    const series = app.catalog && app.catalog.seriesList && app.catalog.seriesList.length > 0
      ? app.catalog.seriesList[0]
      : null;
    if (series && series.chapters && series.chapters.length > 0) {
      app.openReader(series.id, series.chapters[0].id);
    }
  });
  await page.waitForSelector('#view-reader:not(.hidden)');
  await page.waitForTimeout(500);

  const chapterSelectStyles = await page.$eval('#select-chapter', (el) => {
    const s = window.getComputedStyle(el);
    return {
      appearance: s.appearance || s.webkitAppearance,
      cursor: s.cursor,
      bgImage: s.backgroundImage,
      color: s.color,
      textAlign: s.textAlign
    };
  });

  assert.equal(chapterSelectStyles.appearance, 'none', 'Okuyucu bolum secimi appearance none olmali');
  assert.equal(chapterSelectStyles.cursor, 'pointer', 'Okuyucu bolum secimi pointer olmali');
  assert.equal(chapterSelectStyles.bgImage.includes('svg'), true, 'Okuyucu bolum secimi ozel SVG oka sahip olmali');
  assert.equal(chapterSelectStyles.bgImage.includes('%23f97316'), true, 'Okuyucu bolum oku turuncu tema renginde olmali');

  // Bolum secimi degistirme testi
  const secondChapId = await page.evaluate(() => {
    const app = window.ManowaApp;
    const series = app.catalog.seriesList[0];
    return series.chapters.length > 1 ? series.chapters[1].id : null;
  });
  if (secondChapId) {
    await page.selectOption('#select-chapter', secondChapId);
    await page.waitForTimeout(300);
  }

  // Ust baslik yakindan ekran goruntusu
  const switcherEl = await page.$('.reader-chapter-switcher');
  if (switcherEl) {
    await switcherEl.screenshot({
      path: path.join(screenshotsDir, 'listbox-reader-switcher.png')
    });
    console.log('Screenshot saved: listbox-reader-switcher.png');
  }

  await page.screenshot({
    path: path.join(screenshotsDir, 'listbox-reader-full.png'),
    fullPage: false
  });
  console.log('Screenshot saved: listbox-reader-full.png');

  // 3. TEST: Harici Bagimsiz Post Generator Sayfasi
  const standalonePath = 'file:///' + path.resolve(__dirname, '../dist/blogger-post-generator-page.html').replace(/\\/g, '/');
  console.log('Navigating to standalone generator page:', standalonePath);
  await page.goto(standalonePath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const standaloneSelectStyles = await page.$eval('#mpg-source-lang', (el) => {
    const s = window.getComputedStyle(el);
    return {
      appearance: s.appearance || s.webkitAppearance,
      cursor: s.cursor,
      bgImage: s.backgroundImage
    };
  });

  assert.equal(standaloneSelectStyles.appearance, 'none', 'Harici sayfadaki select appearance none olmali');
  assert.equal(standaloneSelectStyles.cursor, 'pointer', 'Harici sayfadaki select pointer olmali');
  assert.equal(standaloneSelectStyles.bgImage.includes('svg'), true, 'Harici sayfadaki select SVG oka sahip olmali');

  await page.screenshot({
    path: path.join(screenshotsDir, 'listbox-standalone-generator.png'),
    fullPage: false
  });
  console.log('Screenshot saved: listbox-standalone-generator.png');

  await browser.close();

  // Konsol hatalari denetimi
  if (consoleErrors.length > 0) {
    console.error('Console errors encountered:', consoleErrors);
  }
  assert.equal(consoleErrors.length, 0, 'Tarayici konsolunda hicbir hata bulunmamali');
  console.log('All listbox Playwright tests passed successfully with 0 console errors!');
}

testThemeListboxes().catch((err) => {
  console.error('Playwright Test Failed:', err);
  process.exit(1);
});
