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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');
  console.log('Loading:', previewPath);
  await page.goto(previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // 1. Open reader with multi-page chapter
  await page.evaluate(() => {
    const app = window.ManowaApp;
    const series = app.catalog.seriesList[0];
    app.openReader(series.id, series.chapters[0].id);
    const pages = [];
    for (let i = 1; i <= 30; i++) {
      pages.push("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1200'><rect width='800' height='1200' fill='%231e293b'/><text x='50%' y='50%' font-size='40' fill='%2394a3b8' text-anchor='middle'>Sayfa " + i + "</text></svg>");
    }
    app.reader.loadChapter({
      seriesId: series.id,
      chapterId: series.chapters[0].id,
      seriesType: 'Manhwa',
      defaultMode: 'webtoon',
      pages: pages
    });
    app.syncReaderControls();
    app.renderReaderViewport();
  });
  await page.waitForTimeout(400);

  // 2. Verify Top Bar on Mobile (390px)
  const topBarInfo = await page.evaluate(() => {
    const labelEl = document.getElementById('reader-current-chapter-label');
    const triggerBtn = document.getElementById('btn-chapter-dropdown');
    const switcher = document.querySelector('.reader-chapter-switcher');
    const backBtn = document.getElementById('reader-series-title');
    const settingsBtn = document.getElementById('btn-reader-settings');

    const style = window.getComputedStyle(labelEl);
    const labelRect = labelEl.getBoundingClientRect();
    const btnRect = triggerBtn.getBoundingClientRect();
    const switcherRect = switcher.getBoundingClientRect();

    return {
      text: labelEl.textContent.trim(),
      display: style.display,
      visibility: style.visibility,
      labelWidth: labelRect.width,
      labelHeight: labelRect.height,
      btnWidth: btnRect.width,
      btnHeight: btnRect.height,
      switcherLeft: switcherRect.left,
      switcherRight: switcherRect.right,
      switcherWidth: switcherRect.width,
      switcherCenter: switcherRect.left + switcherRect.width / 2,
      windowCenter: window.innerWidth / 2,
      switcherVisible: Boolean(switcher && switcher.offsetHeight > 0),
      backBtnVisible: Boolean(backBtn && backBtn.offsetHeight > 0),
      settingsBtnVisible: Boolean(settingsBtn && settingsBtn.offsetHeight > 0)
    };
  });

  console.log('Top bar mobile verification:', topBarInfo);
  assert.equal(topBarInfo.text.length > 0, true, 'Bolum etiketi metni bos olmamali');
  assert.notEqual(topBarInfo.display, 'none', 'Bolum etiketi mobilde display: none OLMAMALI');
  assert.equal(topBarInfo.labelWidth > 30, true, 'Bolum etiketi genisligi 30px uzerinde olmali');
  assert.equal(topBarInfo.btnHeight >= 32, true, 'Dropdown tetikleyici dugmesi yuksekligi en az 32px olmali');
  assert.equal(
    Math.abs(topBarInfo.switcherCenter - topBarInfo.windowCenter) <= 2,
    true,
    `Bolum secici ekranda ortalanmali (Merkez farki: ${Math.abs(topBarInfo.switcherCenter - topBarInfo.windowCenter)}px)`
  );

  // 3. Verify Bottom Bar on Mobile
  const bottomBarInfo = await page.evaluate(() => {
    const footer = document.getElementById('reader-footer-bar');
    const prevBtn = document.getElementById('btn-prev-chapter');
    const nextBtn = document.getElementById('btn-next-chapter');
    const seekbarRow = document.getElementById('reader-seekbar-row');
    const seekbarPill = document.querySelector('.mihon-seekbar-pill');
    const pageSlider = document.getElementById('reader-page-slider');

    const footerRect = footer.getBoundingClientRect();
    const prevRect = prevBtn.getBoundingClientRect();
    const nextRect = nextBtn.getBoundingClientRect();
    const seekbarRect = seekbarRow.getBoundingClientRect();

    return {
      footerBottom: footerRect.bottom,
      windowHeight: window.innerHeight,
      footerHeight: footerRect.height,
      prevWidth: prevRect.width,
      nextWidth: nextRect.width,
      seekbarWidth: seekbarRect.width,
      seekbarPillHeight: seekbarPill ? seekbarPill.offsetHeight : 0,
      sliderVisible: Boolean(pageSlider && pageSlider.offsetHeight > 0),
      sliderDir: pageSlider ? pageSlider.getAttribute('dir') : null,
      sliderValue: pageSlider ? pageSlider.value : null,
      sliderFill: pageSlider ? pageSlider.style.getPropertyValue('--slider-fill') : null
    };
  });

  console.log('Bottom bar mobile verification:', bottomBarInfo);
  assert.equal(bottomBarInfo.footerBottom, bottomBarInfo.windowHeight, 'Footer ekranin tam altina yapismali');
  assert.equal(bottomBarInfo.seekbarWidth > 200, true, 'Seekbar mobilde dengeli genislikte (> 200px) olmali');
  assert.equal(bottomBarInfo.prevWidth >= 40, true, 'Onceki bolum butonu en az 40px olmali');
  assert.equal(bottomBarInfo.nextWidth >= 40, true, 'Sonraki bolum butonu en az 40px olmali');
  assert.equal(bottomBarInfo.sliderDir, 'ltr', 'Seekbar slider her zaman LTR olmali');
  assert.equal(bottomBarInfo.sliderValue, '1', 'Seekbar ilk sayfada degeri 1 olmali');
  assert.equal(bottomBarInfo.sliderFill, '0%', 'Ilk sayfada iz dolgusu 0% olmali');

  // Screenshot 1: Mobile (390x844) full view
  const screenshotsDir = path.join(__dirname, 'screenshots');
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-mobile-bars-fixed.png'),
    fullPage: false
  });
  console.log('Saved screenshot: reader-mobile-bars-fixed.png');

  // 4. Test Manga (RTL) mode with 502px viewport (user screenshot screen size)
  await page.setViewportSize({ width: 502, height: 603 });
  await page.waitForTimeout(300);

  const mangaInfo = await page.evaluate(() => {
    const app = window.ManowaApp;
    const series = app.catalog.seriesList[0];
    const pages = [];
    for (let i = 1; i <= 32; i++) {
      pages.push("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1200'><rect width='800' height='1200' fill='%231e293b'/><text x='50%' y='50%' font-size='40' fill='%2394a3b8' text-anchor='middle'>Sayfa " + i + "</text></svg>");
    }
    app.reader.loadChapter({
      seriesId: series.id,
      chapterId: series.chapters[0].id,
      seriesType: 'manga',
      defaultMode: 'single',
      pages: pages
    });
    app.syncReaderControls();
    app.renderReaderViewport();

    const switcher = document.querySelector('.reader-chapter-switcher');
    const slider = document.getElementById('reader-page-slider');
    const sRect = switcher.getBoundingClientRect();
    return {
      direction: app.reader.direction,
      switcherCenter: sRect.left + sRect.width / 2,
      windowCenter: window.innerWidth / 2,
      sliderDir: slider.getAttribute('dir'),
      sliderValue: slider.value,
      sliderFill: slider.style.getPropertyValue('--slider-fill')
    };
  });

  console.log('Manga 502px viewport verification:', mangaInfo);
  assert.equal(mangaInfo.direction, 'rtl', 'Manga serisinde okuma yonu RTL olmali');
  assert.equal(mangaInfo.sliderDir, 'ltr', 'Seekbar slider RTL seride bile LTR yonunde kalmali');
  assert.equal(mangaInfo.sliderValue, '1', 'Sayfa 1 de slider degeri 1 olmali');
  assert.equal(mangaInfo.sliderFill, '0%', 'Sayfa 1 de ilerleme izi 0% olmali');
  assert.equal(
    Math.abs(mangaInfo.switcherCenter - mangaInfo.windowCenter) <= 2,
    true,
    `Manga modunda bolum secici 502px ekranda tam ortali olmali (fark: ${Math.abs(mangaInfo.switcherCenter - mangaInfo.windowCenter)}px)`
  );

  // Screenshot 2: Manga 502px page 1 with centered switcher and left thumb
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-manga-502px-centered.png'),
    fullPage: false
  });
  console.log('Saved screenshot: reader-manga-502px-centered.png');

  // Test slider drag to page 16 and verify trace (--slider-fill)
  await page.evaluate(() => {
    const app = window.ManowaApp;
    const slider = document.getElementById('reader-page-slider');
    slider.value = '16';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const dragInfo = await page.evaluate(() => {
    const slider = document.getElementById('reader-page-slider');
    const currEl = document.getElementById('seekbar-current-page');
    return {
      sliderValue: slider.value,
      currText: currEl.textContent,
      sliderFill: slider.style.getPropertyValue('--slider-fill')
    };
  });
  console.log('Slider drag verification:', dragInfo);
  assert.equal(dragInfo.sliderValue, '16', 'Surukleme sonrasi slider degeri 16 olmali');
  assert.equal(dragInfo.currText, '16', 'Gosterge sayisi 16 olmali');
  assert.equal(dragInfo.sliderFill, '48%', '16. sayfada dinamik iz 48% olmali');

  // Screenshot 3: Slider at page 16 with vibrant progress trace behind thumb
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-manga-page16-trace.png'),
    fullPage: false
  });
  console.log('Saved screenshot: reader-manga-page16-trace.png');

  // 5. Test dropdown click and menu visibility on mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.click('#btn-chapter-dropdown');
  await page.waitForTimeout(300);

  const menuVisible = await page.$eval('#reader-chapter-menu', (el) => !el.classList.contains('hidden'));
  assert.equal(menuVisible, true, 'Menu tiklandiginda acilmali');

  // Screenshot 4: Mobile chapter dropdown menu opened
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-mobile-chapter-menu.png'),
    fullPage: false
  });
  console.log('Saved screenshot: reader-mobile-chapter-menu.png');

  // Close menu with Escape key
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 6. Test narrow mobile viewport (360x740)
  await page.setViewportSize({ width: 360, height: 740 });
  await page.waitForTimeout(300);

  const narrowInfo = await page.evaluate(() => {
    const topBar = document.querySelector('.reader-toolbar');
    const bottomBar = document.querySelector('.reader-footer-bar');
    return {
      topBarScrollWidth: topBar.scrollWidth,
      topBarClientWidth: topBar.clientWidth,
      bottomBarScrollWidth: bottomBar.scrollWidth,
      bottomBarClientWidth: bottomBar.clientWidth
    };
  });
  console.log('Narrow 360px bar metrics:', narrowInfo);
  assert.equal(narrowInfo.topBarScrollWidth <= narrowInfo.topBarClientWidth + 1, true, 'Ust barda 360px modunda yatay tasma olmamali');
  assert.equal(narrowInfo.bottomBarScrollWidth <= narrowInfo.bottomBarClientWidth + 1, true, 'Alt barda 360px modunda yatay tasma olmamali');

  // Screenshot 5: Narrow 360px view
  await page.screenshot({
    path: path.join(screenshotsDir, 'reader-mobile-bars-narrow360.png'),
    fullPage: false
  });
  console.log('Saved screenshot: reader-mobile-bars-narrow360.png');

  await browser.close();

  assert.equal(consoleErrors.length, 0, 'Sifir konsol hatasi olmali');
  console.log('Mobile reader bars visual tests completed successfully with 0 console errors!');
})();
