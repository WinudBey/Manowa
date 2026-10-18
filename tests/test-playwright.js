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
    const dockCommentsBtn = document.getElementById('btn-dock-comments');

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
      activeView: document.body.getAttribute('data-active-view'),
      dockCommentsBtnExists: Boolean(dockCommentsBtn)
    };
  });

  console.log('Reader desktop check result:', result);
  await page.waitForTimeout(300);

  // Take screenshot of webtoon/image reader desktop
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-desktop-fullscreen.png'),
    fullPage: false
  });

  // 1.1 Test Manga (single-page) mode chapter-end card and comments visibility
  const mangaResult = await page.evaluate(() => {
    const app = window.ManowaApp;
    app.reader.loadChapter({
      seriesId: 'wistoria',
      chapterId: 'wistoria-1',
      seriesType: 'Manga',
      sourceLang: 'JP',
      pages: [
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1100'><rect width='800' height='1100' fill='%231e293b'/><text x='50%25' y='50%25' font-size='48' fill='%2394a3b8' text-anchor='middle'>Manga Sayfa 1</text></svg>",
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1100'><rect width='800' height='1100' fill='%231e293b'/><text x='50%25' y='50%25' font-size='48' fill='%2394a3b8' text-anchor='middle'>Manga Sayfa 2</text></svg>",
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1100'><rect width='800' height='1100' fill='%231e293b'/><text x='50%25' y='50%25' font-size='48' fill='%2394a3b8' text-anchor='middle'>Manga Son Sayfa (3)</text></svg>"
      ]
    });
    app.syncReaderControls();
    app.renderReaderViewport();

    const endCard = document.getElementById('reader-chapter-end-card');
    const disqusSec = document.getElementById('disqus-section');
    const p1CardDisplay = window.getComputedStyle(endCard).display;
    const p1HasHidden = endCard.classList.contains('hidden');
    const p1DisqusDisplay = window.getComputedStyle(disqusSec).display;
    const p1DisqusHidden = disqusSec.classList.contains('hidden');
    const p1DisqusVisibleClass = disqusSec.classList.contains('reader-comments-visible');

    // Go to last page (index 2 / page 3)
    app.reader.goToPage(2);
    app.syncReaderControls();
    app.renderReaderViewport();
    const lastCardDisplay = window.getComputedStyle(endCard).display;
    const lastHasHidden = endCard.classList.contains('hidden');
    const lastDisqusDisplay = window.getComputedStyle(disqusSec).display;
    const lastDisqusHidden = disqusSec.classList.contains('hidden');
    const lastDisqusVisibleClass = disqusSec.classList.contains('reader-comments-visible');
    const lastDisqusOpacity = window.getComputedStyle(disqusSec).opacity;

    // Go back to page 1 (index 0)
    app.reader.goToPage(0);
    app.syncReaderControls();
    app.renderReaderViewport();
    const returnCardDisplay = window.getComputedStyle(endCard).display;
    const returnHasHidden = endCard.classList.contains('hidden');
    const returnDisqusDisplay = window.getComputedStyle(disqusSec).display;
    const returnDisqusHidden = disqusSec.classList.contains('hidden');
    const returnDisqusVisibleClass = disqusSec.classList.contains('reader-comments-visible');

    return {
      p1CardDisplay,
      p1HasHidden,
      p1DisqusDisplay,
      p1DisqusHidden,
      p1DisqusVisibleClass,
      lastCardDisplay,
      lastHasHidden,
      lastDisqusDisplay,
      lastDisqusHidden,
      lastDisqusVisibleClass,
      lastDisqusOpacity,
      returnCardDisplay,
      returnHasHidden,
      returnDisqusDisplay,
      returnDisqusHidden,
      returnDisqusVisibleClass
    };
  });
  console.log('Manga mode chapter-end card and comments check:', mangaResult);

  // Take screenshot of Manga mode Page 1 (end card & comments hidden)
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-manga-page1-no-endcard.png'),
    fullPage: false
  });

  // Switch to last page and verify automatic smooth scroll to comments
  await page.evaluate(() => {
    window.ManowaApp.reader.goToPage(2);
    window.ManowaApp.syncReaderControls();
    window.ManowaApp.renderReaderViewport();
  });
  // Wait for smooth scroll timer and animation
  await page.waitForTimeout(600);

  const scrollYAfterLastPage = await page.evaluate(() => window.scrollY);
  console.log('ScrollY after reaching last page (smooth scroll):', scrollYAfterLastPage);
  if (scrollYAfterLastPage < 1000) {
    throw new Error('Smooth scroll to comments failed or did not scroll enough: window.scrollY is ' + scrollYAfterLastPage);
  }

  // Take screenshot of Manga mode Last Page (end card & comments visible)
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-manga-lastpage-with-endcard.png'),
    fullPage: false
  });

  // 1.2 Test Webtoon scroll to chapter end triggers comments reveal
  await page.evaluate(async () => {
    const app = window.ManowaApp;
    window.scrollTo(0, 0);
    app.reader.loadChapter({
      seriesId: 'long-webtoon',
      chapterId: 'lw-1',
      seriesType: 'Manhwa',
      sourceLang: 'KR',
      defaultMode: 'webtoon',
      pages: [
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'><rect width='800' height='1000' fill='%231e293b'/><text x='50%25' y='50%25' font-size='40' fill='%2394a3b8' text-anchor='middle'>Webtoon Panel 1</text></svg>",
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'><rect width='800' height='1000' fill='%231e293b'/><text x='50%25' y='50%25' font-size='40' fill='%2394a3b8' text-anchor='middle'>Webtoon Panel 2</text></svg>",
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'><rect width='800' height='1000' fill='%231e293b'/><text x='50%25' y='50%25' font-size='40' fill='%2394a3b8' text-anchor='middle'>Webtoon Panel 3</text></svg>",
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'><rect width='800' height='1000' fill='%231e293b'/><text x='50%25' y='50%25' font-size='40' fill='%2394a3b8' text-anchor='middle'>Webtoon Panel 4</text></svg>"
      ]
    });
    app.syncReaderControls();
    app.renderReaderViewport();
    window.scrollTo(0, 0);
    const disqusSec = document.getElementById('disqus-section');
    if (disqusSec) disqusSec.classList.remove('reader-comments-visible');
  });
  await page.waitForTimeout(300);

  const webtoonCommentsResult = await page.evaluate(() => {
    const app = window.ManowaApp;
    const endCard = document.getElementById('reader-chapter-end-card');
    const disqusSec = document.getElementById('disqus-section');
    const initialVisible = disqusSec.classList.contains('reader-comments-visible');

    // Scroll towards end of webtoon
    window.scrollTo({ top: document.body.scrollHeight * 0.8, behavior: 'instant' });
    if (app.readerHud) app.readerHud.checkCommentsEndVisibility();

    const afterScrollVisible = disqusSec.classList.contains('reader-comments-visible');
    const opacity = window.getComputedStyle(disqusSec).opacity;

    return {
      initialVisible,
      afterScrollVisible,
      opacity
    };
  });
  console.log('Webtoon comments end check result:', webtoonCommentsResult);
  await page.waitForTimeout(600);

  const webtoonScrollY = await page.evaluate(() => window.scrollY);
  console.log('Webtoon scrollY after chapter end (smooth scroll):', webtoonScrollY);
  if (webtoonScrollY <= 0) {
    throw new Error('Webtoon failed to auto-scroll to comments!');
  }

  // Take screenshot of Webtoon at chapter end showing soft comments section
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-webtoon-end-comments.png'),
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
  if (result.dockCommentsBtnExists) throw new Error('btn-dock-comments should NOT exist in reader bottom bar');
  if (catalogResult.headerDisplay === 'none') throw new Error('Site header should be visible when exiting reader to catalog');
  if (mangaResult.p1CardDisplay !== 'none') throw new Error(`Chapter end card should be hidden on Manga Page 1, got: ${mangaResult.p1CardDisplay}`);
  if (mangaResult.p1DisqusDisplay !== 'none') throw new Error(`Disqus comments should be hidden on Manga Page 1, got: ${mangaResult.p1DisqusDisplay}`);
  if (mangaResult.lastCardDisplay === 'none') throw new Error(`Chapter end card should be visible on Manga Last Page, got: ${mangaResult.lastCardDisplay}`);
  if (mangaResult.lastDisqusDisplay === 'none') throw new Error('Disqus comments should be unhidden on Manga Last Page');
  if (!mangaResult.lastDisqusVisibleClass) throw new Error('Disqus comments should have reader-comments-visible on Manga Last Page');
  if (mangaResult.returnCardDisplay !== 'none') throw new Error(`Chapter end card should be hidden again on Manga Page 1, got: ${mangaResult.returnCardDisplay}`);
  if (mangaResult.returnDisqusDisplay !== 'none') throw new Error('Disqus comments should be hidden again on Manga Page 1');
  if (!webtoonCommentsResult.afterScrollVisible) throw new Error('Webtoon comments should be visible when reaching chapter end');

  console.log('Visual test completed successfully!');
}

runVisualTest().catch((err) => {
  console.error('Visual test failed:', err);
  process.exit(1);
});
