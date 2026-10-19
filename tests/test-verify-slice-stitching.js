const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch(e) { playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright'); }
const path = require('path');
const assert = require('node:assert/strict');

function makeSliceSvg(sliceIdx, totalSlices = 5, w = 800, h = 240) {
  const yOffset = sliceIdx * h;
  const colors = ['#be123c', '#c2410c', '#b45309', '#15803d', '#1d4ed8'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${colors[sliceIdx]}"/>
    <line x1="0" y1="0" x2="${w}" y2="${h}" stroke="#ffffff" stroke-width="4"/>
    <text x="${w/2}" y="${h/2 - 10}" font-size="36" font-weight="bold" font-family="sans-serif" fill="#ffffff" text-anchor="middle">
      MANGA SLICE ${sliceIdx + 1} / ${totalSlices}
    </text>
    <text x="${w/2}" y="${h/2 + 35}" font-size="24" font-family="sans-serif" fill="#e2e8f0" text-anchor="middle">
      Y-Offset: ${yOffset}px (Kesintisiz Dikiş Testi)
    </text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');

  // Test 1: Single Mode (Manga 600x750) - 5 slices must merge into 1 seamless canvas fitting on screen
  {
    const page = await browser.newPage({ viewport: { width: 600, height: 750 } });
    await page.goto(previewPath);
    await page.waitForTimeout(400);

    const sliceSvgs = [0, 1, 2, 3, 4].map(i => makeSliceSvg(i, 5, 800, 240));

    await page.evaluate((svgs) => {
      const app = window.ManowaApp;
      const series = app.catalog.seriesList[0];
      app.openReader(series.id, series.chapters[0].id);

      const sliceUrls = [
        'https://blogger.googleusercontent.com/img/01_01.webp#' + svgs[0],
        'https://blogger.googleusercontent.com/img/01_02.webp#' + svgs[1],
        'https://blogger.googleusercontent.com/img/01_03.webp#' + svgs[2],
        'https://blogger.googleusercontent.com/img/01_04.webp#' + svgs[3],
        'https://blogger.googleusercontent.com/img/01_05.webp#' + svgs[4],
        'https://blogger.googleusercontent.com/img/02_01.webp'
      ];

      app.reader.loadChapter({
        seriesId: series.id,
        chapterId: 'c-sliced-1',
        chapterTitle: 'Bölüm 1 - Parça Birleştirme Testi',
        seriesType: 'Manga',
        defaultMode: 'single',
        pages: sliceUrls
      });
      app.reader.goToPage(0);

      app.renderReaderViewport();
      app.syncReaderControls();

      // Ensure canvas uses the data svgs directly
      const canvases = document.querySelectorAll('canvas.reader-stitched-canvas');
      if (canvases.length > 0 && app.reader.sliceMerger) {
        app.reader.sliceMerger.stitchCanvas(canvases[0], svgs);
      }
    }, sliceSvgs);

    await page.waitForTimeout(800);

    const singleCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.reader-stitched-canvas');
      const footer = document.getElementById('reader-footer-bar');
      const header = document.querySelector('.reader-sticky-header');
      const cRect = canvas ? canvas.getBoundingClientRect() : null;
      const fRect = footer.getBoundingClientRect();
      const hRect = header.getBoundingClientRect();

      const vp = document.getElementById('reader-viewport');
      const lp = document.querySelector('.reader-logical-page');
      return {
        canvasFound: Boolean(canvas),
        isStitched: canvas ? canvas.getAttribute('data-stitched') === 'true' : false,
        canvasWidth: cRect ? Math.round(cRect.width) : 0,
        canvasHeight: cRect ? Math.round(cRect.height) : 0,
        canvasTop: cRect ? Math.round(cRect.top) : 0,
        canvasBottom: cRect ? Math.round(cRect.bottom) : 0,
        vpRect: vp ? vp.getBoundingClientRect() : null,
        lpRect: lp ? lp.getBoundingClientRect() : null,
        headerBottom: Math.round(hRect.bottom),
        footerTop: Math.round(fRect.top),
        entireCanvasOnScreen: cRect ? cRect.top >= hRect.bottom && cRect.bottom <= fRect.top : false,
        isScrollable: document.documentElement.scrollHeight > window.innerHeight
      };
    });

    console.log('Single Mode Slice Check:', JSON.stringify(singleCheck, null, 2));
    assert.equal(singleCheck.canvasFound, true, 'canvas.reader-stitched-canvas DOM icinde olmali');
    assert.equal(singleCheck.isStitched, true, 'Canvas basariyla dikilmis olmali (data-stitched=true)');
    assert.equal(singleCheck.entireCanvasOnScreen, true, 'Dikilen canvas baslik ve alt bar arasinda ekrana tam sigmali');
    assert.equal(singleCheck.isScrollable, false, 'Manga modunda dikey kaydirma kapali kalmali');

    await page.screenshot({ path: 'tests/screenshots/slice-single-verified.png' });
    await page.close();
  }

  // Test 2: Double Mode (1280x800) - Both pages with slices stitched
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(previewPath);
    await page.waitForTimeout(400);

    const p1Svgs = [0, 1, 2].map(i => makeSliceSvg(i, 3, 800, 300));
    const p2Svgs = [0, 1, 2].map(i => makeSliceSvg(i, 3, 800, 300));

    await page.evaluate(({ p1, p2 }) => {
      const app = window.ManowaApp;
      const series = app.catalog.seriesList[0];
      app.openReader(series.id, series.chapters[0].id);

      const sliceUrls = [
        'https://blogger.googleusercontent.com/img/01_01.webp',
        'https://blogger.googleusercontent.com/img/01_02.webp',
        'https://blogger.googleusercontent.com/img/01_03.webp',
        'https://blogger.googleusercontent.com/img/02_01.webp',
        'https://blogger.googleusercontent.com/img/02_02.webp',
        'https://blogger.googleusercontent.com/img/02_03.webp',
        'https://blogger.googleusercontent.com/img/03_01.webp'
      ];

      app.reader.loadChapter({
        seriesId: series.id,
        chapterId: 'c-sliced-2',
        chapterTitle: 'Bölüm 2 - Çift Sayfa Parça Testi',
        seriesType: 'Manga',
        defaultMode: 'double',
        pages: sliceUrls
      });

      app.reader.goToPage(0);
      app.renderReaderViewport();
      app.syncReaderControls();

      const canvases = document.querySelectorAll('canvas.reader-stitched-canvas');
      if (canvases[0]) app.reader.sliceMerger.stitchCanvas(canvases[0], p1);
      if (canvases[1]) app.reader.sliceMerger.stitchCanvas(canvases[1], p2);
    }, { p1: p1Svgs, p2: p2Svgs });

    await page.waitForTimeout(800);

    const doubleCheck = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas.reader-stitched-canvas');
      const grid = document.querySelector('.double-page-grid');
      return {
        canvasCount: canvases.length,
        gridFound: Boolean(grid),
        allStitched: Array.from(canvases).every(c => c.getAttribute('data-stitched') === 'true'),
        isScrollable: document.documentElement.scrollHeight > window.innerHeight
      };
    });

    console.log('Double Mode Slice Check:', doubleCheck);
    assert.equal(doubleCheck.canvasCount, 2, 'Cift sayfa modunda 2 canvas cizilmeli');
    assert.equal(doubleCheck.allStitched, true, 'Her iki sayfa da basariyla dikilmeli');
    assert.equal(doubleCheck.isScrollable, false, 'Cift sayfa modunda dikey kaydirma kapali kalmali');

    await page.screenshot({ path: 'tests/screenshots/slice-double-verified.png' });
    await page.close();
  }

  await browser.close();
  console.log('Tum Playwright testleri basariyla tamamlandi!');
})();
