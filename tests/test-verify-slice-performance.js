const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch(e) { playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright'); }
const path = require('path');
const assert = require('node:assert/strict');

function makeSliceSvg(sliceIdx, totalSlices = 5, w = 800, h = 240) {
  const yOffset = sliceIdx * h;
  const colors = ['#0284c7', '#0d9488', '#16a34a', '#ca8a04', '#e11d48'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${colors[sliceIdx]}"/>
    <text x="${w/2}" y="${h/2}" font-size="32" font-weight="bold" font-family="sans-serif" fill="#ffffff" text-anchor="middle">
      MANGA OPTIMIZED SLICE ${sliceIdx + 1} / ${totalSlices} (y: ${yOffset})
    </text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');
  const page = await browser.newPage({ viewport: { width: 640, height: 800 } });

  await page.goto(previewPath);
  await page.waitForTimeout(400);

  const page1Svgs = [0, 1, 2, 3, 4].map(i => makeSliceSvg(i, 5, 800, 240));
  const page2Svgs = [0, 1, 2, 3].map(i => makeSliceSvg(i, 4, 800, 300));

  const perfReport = await page.evaluate(async ({ p1, p2 }) => {
    const app = window.ManowaApp;
    const series = app.catalog.seriesList[0];
    app.openReader(series.id, series.chapters[0].id);

    const chapterPages = [
      'https://example.com/p01_01.webp#' + p1[0],
      'https://example.com/p01_02.webp#' + p1[1],
      'https://example.com/p01_03.webp#' + p1[2],
      'https://example.com/p01_04.webp#' + p1[3],
      'https://example.com/p01_05.webp#' + p1[4],
      'https://example.com/p02_01.webp#' + p2[0],
      'https://example.com/p02_02.webp#' + p2[1],
      'https://example.com/p02_03.webp#' + p2[2],
      'https://example.com/p02_04.webp#' + p2[3]
    ];

    app.reader.loadChapter({
      seriesId: series.id,
      chapterId: 'c-sliced-perf',
      chapterTitle: 'Performans Testi Bölüm 1',
      seriesType: 'Manga',
      defaultMode: 'single',
      pages: chapterPages
    });

    const merger = app.reader.sliceMerger;

    // Test 1: First stitch of Page 1
    const t0 = performance.now();
    const c1 = document.createElement('canvas');
    await merger.stitchCanvas(c1, p1);
    const firstStitchDuration = performance.now() - t0;
    const isCachedAfterFirst = merger.isCached(p1);

    // Test 2: Second stitch of Page 1 (Cache Hit)
    const t1 = performance.now();
    const c2 = document.createElement('canvas');
    await merger.stitchCanvas(c2, p1);
    const cachedStitchDuration = performance.now() - t1;

    // Test 3: Background Preload of Page 2
    const isP2CachedBefore = merger.isCached(p2);
    await merger.preload(p2);
    const isP2CachedAfter = merger.isCached(p2);

    // Test 4: Render DOM canvas for Page 1
    app.reader.goToPage(0);
    app.renderReaderViewport();
    const domCanvas = document.querySelector('canvas.reader-stitched-canvas');
    if (domCanvas) {
      await merger.stitchCanvas(domCanvas, p1);
    }

    return {
      firstStitchDuration: Math.round(firstStitchDuration * 10) / 10,
      cachedStitchDuration: Math.round(cachedStitchDuration * 100) / 100,
      isCachedAfterFirst,
      isP2CachedBefore,
      isP2CachedAfter,
      domCanvasStitched: domCanvas ? domCanvas.getAttribute('data-stitched') === 'true' : false,
      domCanvasReady: domCanvas ? domCanvas.classList.contains('stitched-ready') : false
    };
  }, { p1: page1Svgs, p2: page2Svgs });

  console.log('Performans Test Raporu:', perfReport);
  assert.equal(perfReport.isCachedAfterFirst, true, 'Sayfa 1 cizildikten sonra onbellekte olmali');
  assert.equal(perfReport.isP2CachedBefore, false, 'Sayfa 2 on yukleme oncesi onbellekte olmamali');
  assert.equal(perfReport.isP2CachedAfter, true, 'Sayfa 2 preload() sonrasi onbellege alinmis olmali');
  assert.equal(perfReport.domCanvasStitched, true, 'DOM canvas data-stitched=true olmali');
  assert.equal(perfReport.domCanvasReady, true, 'DOM canvas stitched-ready sinifina sahip olmali');
  assert.ok(perfReport.cachedStitchDuration < 10, 'Onbellekten cizim 10ms altinda (anlik) tamamlanmali');

  await page.screenshot({ path: 'tests/screenshots/slice-perf-verified.png' });
  await browser.close();
  console.log('SliceMerger Performans Dogrulamasi Basariyla Tamamlandi!');
})();
