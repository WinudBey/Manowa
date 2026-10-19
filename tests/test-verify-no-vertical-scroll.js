const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch(e) { playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright'); }
const path = require('path');
const assert = require('node:assert/strict');

const makeSvg = (p, total = 32) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000">
    <rect width="700" height="1000" fill="#ffffff"/>
    <rect x="20" y="20" width="660" height="960" fill="none" stroke="#000000" stroke-width="4"/>
    <text x="350" y="350" font-size="44" font-family="sans-serif" fill="#000000" text-anchor="middle">MANGA PANEL TEST</text>
    <text x="350" y="450" font-size="36" font-family="sans-serif" fill="#000000" text-anchor="middle">Sayfa ${p} / ${total}</text>
    <text x="350" y="600" font-size="30" font-family="sans-serif" fill="#666666" text-anchor="middle">(Tum Sayfa Ekrana Sigmali)</text>
    <text x="640" y="960" font-size="28" font-family="sans-serif" fill="#000000" text-anchor="end">134</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
};

const pages32 = [];
for (let i = 1; i <= 32; i++) {
  pages32.push(makeSvg(i, 32));
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');

  // Test 1: Manga Single Page on 502x603 (Real theme styles, zero injection)
  {
    const page = await browser.newPage({ viewport: { width: 502, height: 603 } });
    await page.goto(previewPath);
    await page.waitForTimeout(400);

    await page.evaluate((pages) => {
      const app = window.ManowaApp;
      const series = app.catalog.seriesList[0];
      app.openReader(series.id, series.chapters[0].id);
      app.reader.loadChapter({
        seriesId: series.id,
        chapterId: 'c3',
        chapterTitle: 'Bölüm 3',
        seriesType: 'Manga',
        defaultMode: 'single',
        pages: pages
      });
      app.reader.goToPage(6); // Page 7
      app.renderReaderViewport();
      app.syncReaderControls();
    }, pages32);
    await page.waitForTimeout(400);

    const mangaCheck = await page.evaluate(() => {
      const img = document.querySelector('.reader-page-item');
      const footer = document.getElementById('reader-footer-bar');
      const header = document.querySelector('.reader-sticky-header');
      const iRect = img.getBoundingClientRect();
      const fRect = footer.getBoundingClientRect();
      const hRect = header.getBoundingClientRect();

      return {
        windowHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        isScrollable: document.documentElement.scrollHeight > window.innerHeight,
        imgTop: Math.round(iRect.top),
        imgBottom: Math.round(iRect.bottom),
        headerBottom: Math.round(hRect.bottom),
        footerTop: Math.round(fRect.top),
        entirePageOnScreen: iRect.top >= hRect.bottom && iRect.bottom <= fRect.top
      };
    });

    console.log('Manga Tek Sayfa (Dikey Kaydirma Kapali):', mangaCheck);
    assert.equal(mangaCheck.isScrollable, false, 'Manga modunda dikey kaydirma KAPALI (scrollHeight == windowHeight) olmali');
    assert.equal(mangaCheck.entirePageOnScreen, true, 'Tum sayfa baslik ve alt bar arasinda ekrana tam sigmali');
    await page.screenshot({ path: 'tests/screenshots/manga-no-scroll-verified.png' });
    await page.close();
  }

  // Test 2: Double page mode (1280x800)
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(previewPath);
    await page.waitForTimeout(400);

    await page.evaluate((pages) => {
      const app = window.ManowaApp;
      const series = app.catalog.seriesList[0];
      app.openReader(series.id, series.chapters[0].id);
      app.reader.loadChapter({
        seriesId: series.id,
        chapterId: 'c3',
        chapterTitle: 'Bölüm 3',
        seriesType: 'Manga',
        defaultMode: 'double',
        pages: pages
      });
      app.reader.goToPage(6);
      app.renderReaderViewport();
      app.syncReaderControls();
    }, pages32);
    await page.waitForTimeout(400);

    const doubleCheck = await page.evaluate(() => {
      return {
        windowHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        isScrollable: document.documentElement.scrollHeight > window.innerHeight
      };
    });
    console.log('Manga Cift Sayfa (Dikey Kaydirma Kapali):', doubleCheck);
    assert.equal(doubleCheck.isScrollable, false, 'Cift sayfa modunda dikey kaydirma kapali olmali');
    await page.screenshot({ path: 'tests/screenshots/manga-double-no-scroll.png' });
    await page.close();
  }

  // Test 3: Webtoon Mode (Should remain vertically scrollable!)
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(previewPath);
    await page.waitForTimeout(400);

    await page.evaluate((pages) => {
      const app = window.ManowaApp;
      const series = app.catalog.seriesList[1] || app.catalog.seriesList[0];
      app.openReader(series.id, series.chapters[0].id);
      app.reader.loadChapter({
        seriesId: series.id,
        chapterId: 'c1',
        chapterTitle: 'Bölüm 1',
        seriesType: 'Manhwa',
        defaultMode: 'webtoon',
        pages: pages.slice(0, 10)
      });
      app.renderReaderViewport();
      app.syncReaderControls();
    }, pages32);
    await page.waitForTimeout(400);

    const webtoonCheck = await page.evaluate(() => {
      return {
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        isScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight
      };
    });
    console.log('Webtoon (Dikey Kaydirma Acik):', webtoonCheck);
    assert.equal(webtoonCheck.isScrollable, true, 'Webtoon modunda dikey kaydirma ACIK kalmali');
    await page.screenshot({ path: 'tests/screenshots/webtoon-scroll-verified.png' });
    await page.close();
  }

  // Test 4: Switching back to home removes data-reader-mode
  {
    const page = await browser.newPage({ viewport: { width: 502, height: 603 } });
    await page.goto(previewPath);
    await page.waitForTimeout(400);

    const modeAttribute = await page.evaluate(() => {
      const app = window.ManowaApp;
      const series = app.catalog.seriesList[0];
      app.openReader(series.id, series.chapters[0].id);
      const modeInReader = document.body.getAttribute('data-reader-mode');
      app.switchView('home');
      const modeInHome = document.body.getAttribute('data-reader-mode');
      return { modeInReader, modeInHome };
    });
    console.log('Gorunum Gecisi Kontrolu:', modeAttribute);
    assert.equal(modeAttribute.modeInHome, null, 'Ana sayfaya gecildiginde data-reader-mode kaldirilmali');
    await page.close();
  }

  await browser.close();
  console.log('TUM E2E TESTLERI BASARIYLA TAMAMLANDI!');
})();
