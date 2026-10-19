const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch(e) { playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright'); }
const path = require('path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 502, height: 603 } });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');
  await page.goto(previewPath);
  await page.waitForTimeout(500);

  const makeSvg = (p) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000">
      <rect width="700" height="1000" fill="#ffffff"/>
      <rect x="20" y="20" width="660" height="960" fill="none" stroke="#000000" stroke-width="4"/>
      <text x="350" y="450" font-size="44" font-family="sans-serif" fill="#000000" text-anchor="middle">THAT'S MY ARTIFICER!</text>
      <text x="350" y="520" font-size="36" font-family="sans-serif" fill="#000000" text-anchor="middle">Sayfa ${p} / 32</text>
      <text x="640" y="960" font-size="28" font-family="sans-serif" fill="#000000" text-anchor="end">${127 + p}</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  };

  const pages = [];
  for (let i = 1; i <= 32; i++) {
    pages.push(makeSvg(i));
  }

  // Load Manga chapter in single page mode, navigate to page 7
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
    app.reader.goToPage(7);
    app.renderReaderViewport();
    app.syncReaderControls();
  }, pages);

  await page.waitForTimeout(600);

  // Take screenshot at initial scroll
  await page.screenshot({ path: 'tests/screenshots/manga-page7-verified-top.png' });

  // Scroll to the bottom of the page
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(400);

  // Take screenshot at the bottom of the page
  await page.screenshot({ path: 'tests/screenshots/manga-page7-verified-bottom.png' });

  const verification = await page.evaluate(() => {
    const img = document.querySelector('.reader-page-item');
    const footer = document.getElementById('reader-footer-bar');
    const viewport = document.getElementById('reader-viewport');
    const disqus = document.getElementById('disqus-section');
    const debugPanel = document.getElementById('debug-log-panel');
    const miniPill = document.getElementById('reader-mini-page-pill');

    const footerRect = footer.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    return {
      windowHeight: window.innerHeight,
      scrollY: window.scrollY,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
      footerStickyToBottom: Math.abs(footerRect.bottom - window.innerHeight) <= 1,
      footerTop: footerRect.top,
      footerBottom: footerRect.bottom,
      imgBottom: imgRect.bottom,
      gapBetweenImgAndFooter: footerRect.top - imgRect.bottom,
      disqusDisplay: window.getComputedStyle(disqus).display,
      debugPanelDisplay: debugPanel ? window.getComputedStyle(debugPanel).display : null,
      viewportPaddingBottom: window.getComputedStyle(viewport).paddingBottom,
      miniPillPosition: window.getComputedStyle(miniPill).position
    };
  });

  console.log('Verification results:', JSON.stringify(verification, null, 2));

  assert.equal(verification.footerStickyToBottom, true, 'Alt bar ekranin alt sinirina tam yapismali');
  assert.equal(Math.abs(verification.gapBetweenImgAndFooter) <= 1, true, `Gorsel ile alt bar arasindaki bosluk 0 olmali (olculen: ${verification.gapBetweenImgAndFooter}px)`);
  assert.equal(verification.disqusDisplay, 'none', 'Disqus yorum alani ara sayfada display: none olmali');
  assert.equal(verification.debugPanelDisplay, 'none', 'Hata ayiklama paneli okuyucu gorunumunde display: none olmali');
  assert.equal(verification.miniPillPosition, 'fixed', 'Mini sayfa gostergesi DOM akisi disinda (fixed) olmali');
  assert.equal(consoleErrors.length, 0, 'Sifir konsol hatasi olmali');

  console.log('Playwright dogrulamasi BASARIYLA tamamlandi!');
  await browser.close();
})();
