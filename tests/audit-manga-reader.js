const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright'); }
const path = require('path');
const assert = require('node:assert/strict');

const makeSvg = (p, total = 32) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000">
    <rect width="700" height="1000" fill="#ffffff"/>
    <rect x="20" y="20" width="660" height="960" fill="none" stroke="#000000" stroke-width="4"/>
    <text x="350" y="450" font-size="44" font-family="sans-serif" fill="#000000" text-anchor="middle">MANGA PANEL TEST</text>
    <text x="350" y="520" font-size="36" font-family="sans-serif" fill="#000000" text-anchor="middle">Sayfa ${p} / ${total}</text>
    <text x="640" y="960" font-size="28" font-family="sans-serif" fill="#000000" text-anchor="end">${120 + p}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
};

const pages32 = [];
for (let i = 1; i <= 32; i++) {
  pages32.push(makeSvg(i, 32));
}

(async () => {
  console.log('=== KAPSAMLI MANGA OKUYUCU AUDIT TESTI BASLIYOR ===');
  const browser = await playwright.chromium.launch({ headless: true });
  const previewPath = 'file:///' + path.resolve(__dirname, '../dist/preview.html').replace(/\\/g, '/');

  const auditResults = [];

  // ==========================================
  // TEST 1: 502x603 Ekraninda Sayfa 7 (Kullanici Boyutu)
  // ==========================================
  {
    console.log('\n--- TEST 1: 502x603 Ekran Boyutunda Manga Sayfa 7 Kontrolu ---');
    const page = await browser.newPage({ viewport: { width: 502, height: 603 } });
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

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
      app.reader.goToPage(7);
      app.renderReaderViewport();
      app.syncReaderControls();
    }, pages32);

    await page.waitForTimeout(500);

    // Initial load check
    const topCheck = await page.evaluate(() => {
      const footer = document.getElementById('reader-footer-bar');
      const fRect = footer.getBoundingClientRect();
      const disqus = document.getElementById('disqus-section');
      return {
        footerBottom: fRect.bottom,
        windowHeight: window.innerHeight,
        footerSticky: Math.abs(fRect.bottom - window.innerHeight) <= 1,
        disqusDisplay: window.getComputedStyle(disqus).display,
      };
    });
    assert.equal(topCheck.footerSticky, true, 'Sayfa 7 baslangicta alt bar ekrana yapisik olmali');
    assert.equal(topCheck.disqusDisplay, 'none', 'Sayfa 7 baslangicta disqus gizli olmali');
    await page.screenshot({ path: 'tests/screenshots/audit-1-manga-page7-top.png' });

    // Scroll to bottom of manga page
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(400);

    const bottomCheck = await page.evaluate(() => {
      const img = document.querySelector('.reader-page-item');
      const footer = document.getElementById('reader-footer-bar');
      const disqus = document.getElementById('disqus-section');
      const fRect = footer.getBoundingClientRect();
      const iRect = img.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        footerSticky: Math.abs(fRect.bottom - window.innerHeight) <= 1,
        footerTop: fRect.top,
        imgBottom: iRect.bottom,
        gap: fRect.top - iRect.bottom,
        disqusDisplay: window.getComputedStyle(disqus).display,
      };
    });

    console.log('Test 1 Sonuclari:', bottomCheck);
    assert.equal(bottomCheck.footerSticky, true, 'Sayfa sonuna kaydirildiginda alt bar ekrana yapisik kalmali');
    assert.equal(bottomCheck.gap >= -1 && bottomCheck.gap <= 6, true, `Gorsel alt bara tasmmamali ve ekrana sigmali (Bulunan gap: ${bottomCheck.gap}px)`);
    assert.equal(bottomCheck.disqusDisplay, 'none', 'Ara sayfada disqus asla acilmamali');
    assert.equal(consoleErrors.length, 0, 'Sifir konsol hatasi olmali');
    await page.screenshot({ path: 'tests/screenshots/audit-1-manga-page7-bottom.png' });
    auditResults.push('Test 1 (502x603 Sayfa 7 Boşluksuzluk): BAŞARILI');
    await page.close();
  }

  // ==========================================
  // TEST 2: HUD Gizleme ve Mini Sayfa Gostergesi
  // ==========================================
  {
    console.log('\n--- TEST 2: HUD Gizleme ve Mini Sayfa Pill Konumlandirmasi ---');
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
      app.reader.goToPage(6);
      app.renderReaderViewport();
      app.syncReaderControls();
    }, pages32);
    await page.waitForTimeout(400);

    // Click viewport center to toggle HUD off
    await page.evaluate(() => {
      window.ManowaApp.reader.handleViewportClick(0.5);
      window.ManowaApp.syncReaderControls();
    });
    await page.waitForTimeout(400);

    const hudHiddenCheck = await page.evaluate(() => {
      const wrapper = document.querySelector('.reader-wrapper');
      const header = document.querySelector('.reader-sticky-header');
      const footer = document.getElementById('reader-footer-bar');
      const pill = document.getElementById('reader-mini-page-pill');
      const pRect = pill.getBoundingClientRect();

      return {
        isHudHidden: wrapper.classList.contains('hud-hidden'),
        pillOpacity: window.getComputedStyle(pill).opacity,
        pillPosition: window.getComputedStyle(pill).position,
        pillText: pill.textContent.trim(),
        pillCenterX: pRect.left + pRect.width / 2,
        windowCenterX: window.innerWidth / 2,
        pillBottom: pRect.bottom,
        windowHeight: window.innerHeight,
      };
    });

    console.log('Test 2 HUD Gizli Sonuclari:', hudHiddenCheck);
    assert.equal(hudHiddenCheck.isHudHidden, true, 'HUD gizli sinifi reader-wrapper uzerinde olmali');
    assert.equal(Number(hudHiddenCheck.pillOpacity) > 0.5, true, 'HUD gizliyken mini page pill gorunur olmali');
    assert.equal(hudHiddenCheck.pillPosition, 'fixed', 'Mini pill position: fixed olmali');
    assert.equal(Math.abs(hudHiddenCheck.pillCenterX - hudHiddenCheck.windowCenterX) <= 2, true, 'Mini pill ekranda yatay ortalanmali');
    assert.equal(hudHiddenCheck.pillText, '7 / 32', 'Mini pill sayfa numarasini dogru gostermeli');
    await page.screenshot({ path: 'tests/screenshots/audit-2-hud-hidden-minipill.png' });

    // Toggle HUD back on
    await page.evaluate(() => {
      window.ManowaApp.reader.handleViewportClick(0.5);
      window.ManowaApp.syncReaderControls();
    });
    await page.waitForTimeout(400);

    const hudVisibleCheck = await page.evaluate(() => {
      const wrapper = document.querySelector('.reader-wrapper');
      const pill = document.getElementById('reader-mini-page-pill');
      return {
        isHudHidden: wrapper.classList.contains('hud-hidden'),
        pillOpacity: window.getComputedStyle(pill).opacity,
      };
    });
    assert.equal(hudVisibleCheck.isHudHidden, false, 'HUD acildiginda hud-hidden kalkmali');
    assert.equal(Number(hudVisibleCheck.pillOpacity), 0, 'HUD acikken mini pill gizli (opacity 0) olmali');
    auditResults.push('Test 2 (HUD Gizleme & Mini Sayfa Pill): BAŞARILI');
    await page.close();
  }

  // ==========================================
  // TEST 3: Son Sayfaya Gelindiginde Bolum Sonu Karti ve Yorumlar
  // ==========================================
  {
    console.log('\n--- TEST 3: Son Sayfada Bolum Sonu Karti ve Yorumlar ---');
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
      // Go to last page (32 of 32, index 31)
      app.reader.goToPage(31);
      app.renderReaderViewport();
      app.syncReaderControls();
    }, pages32);
    await page.waitForTimeout(400);

    const endCheck = await page.evaluate(() => {
      const endCard = document.getElementById('reader-chapter-end-card');
      const disqus = document.getElementById('disqus-section');
      return {
        endCardDisplay: window.getComputedStyle(endCard).display,
        endCardHidden: endCard.classList.contains('hidden'),
        disqusHidden: disqus.classList.contains('hidden'),
        disqusVisibleClass: disqus.classList.contains('reader-comments-visible'),
        pageCounter: document.getElementById('page-counter').textContent.trim()
      };
    });

    console.log('Test 3 Son Sayfa Sonuclari:', endCheck);
    assert.equal(endCheck.endCardHidden, false, 'Son sayfada bolum sonu karti gorunur olmali');
    assert.equal(endCheck.endCardDisplay !== 'none', true, 'Son sayfada bolum sonu karti display: none olmamali');
    assert.equal(endCheck.disqusHidden, false, 'Son sayfada disqus hidden olmamali');
    assert.equal(endCheck.pageCounter, 'Sayfa 32 / 32', 'Sayfa sayaci son sayfayi gostermeli');
    await page.screenshot({ path: 'tests/screenshots/audit-3-lastpage-endcard.png' });
    auditResults.push('Test 3 (Son Sayfa Bölüm Sonu Kartı & Yorumlar): BAŞARILI');
    await page.close();
  }

  // ==========================================
  // TEST 4: Cift Sayfa (Double Page) Modu (1280x800)
  // ==========================================
  {
    console.log('\n--- TEST 4: Cift Sayfa Modu Masaustu (1280x800) ---');
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
      const grid = document.querySelector('.double-page-grid');
      const footer = document.getElementById('reader-footer-bar');
      const fRect = footer.getBoundingClientRect();
      const imgs = document.querySelectorAll('.reader-page-item');

      return {
        mode: window.ManowaApp.reader.mode,
        gridDisplay: window.getComputedStyle(grid).display,
        imageCount: imgs.length,
        footerSticky: Math.abs(fRect.bottom - window.innerHeight) <= 1,
        pageCounter: document.getElementById('page-counter').textContent.trim()
      };
    });

    console.log('Test 4 Cift Sayfa Sonuclari:', doubleCheck);
    assert.equal(doubleCheck.mode, 'double', 'Okuma modu double olmali');
    assert.equal(doubleCheck.gridDisplay, 'grid', 'Cift sayfa izgarasi display: grid olmali');
    assert.equal(doubleCheck.imageCount, 2, '2 sayfa gorseli yuklenmeli');
    assert.equal(doubleCheck.footerSticky, true, 'Alt bar masaustunde ekrana yapisik olmali');
    await page.screenshot({ path: 'tests/screenshots/audit-4-double-page-desktop.png' });
    auditResults.push('Test 4 (Çift Sayfa Modu 1280x800): BAŞARILI');
    await page.close();
  }

  // ==========================================
  // TEST 5: Webtoon Modu Mobilde (390x844)
  // ==========================================
  {
    console.log('\n--- TEST 5: Webtoon Dikey Serit Modu Mobilde (390x844) ---');
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
      const viewport = document.getElementById('reader-viewport');
      const footer = document.getElementById('reader-footer-bar');
      const fRect = footer.getBoundingClientRect();
      const imgs = document.querySelectorAll('.reader-page-item');

      return {
        mode: window.ManowaApp.reader.mode,
        imageCount: imgs.length,
        viewportPaddingBottom: window.getComputedStyle(viewport).paddingBottom,
        footerSticky: Math.abs(fRect.bottom - window.innerHeight) <= 1,
      };
    });

    console.log('Test 5 Webtoon Sonuclari:', webtoonCheck);
    assert.equal(webtoonCheck.mode, 'webtoon', 'Okuma modu webtoon olmali');
    assert.equal(webtoonCheck.imageCount, 10, '10 sayfa gorseli dikey siralanmali');
    assert.equal(webtoonCheck.viewportPaddingBottom, '72px', 'Webtoon modunda alt bar altinda kalmamasi icin 4.5rem (72px) bosluk olmali');
    assert.equal(webtoonCheck.footerSticky, true, 'Alt bar mobilde ekrana yapisik olmali');
    await page.screenshot({ path: 'tests/screenshots/audit-5-webtoon-mobile.png' });
    auditResults.push('Test 5 (Webtoon Dikey Şerit 390x844): BAŞARILI');
    await page.close();
  }

  // ==========================================
  // TEST 6: 360px Dar Ekranda Yatay Tasma Kontrolu
  // ==========================================
  {
    console.log('\n--- TEST 6: 360px Dar Mobil Ekranda Sifir Yatay Tasma Kontrolu ---');
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
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
      app.reader.goToPage(7);
      app.renderReaderViewport();
      app.syncReaderControls();
    }, pages32);
    await page.waitForTimeout(400);

    const narrowCheck = await page.evaluate(() => {
      return {
        bodyScrollWidth: document.body.scrollWidth,
        windowWidth: window.innerWidth,
        hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
      };
    });

    console.log('Test 6 Dar Ekran Sonuclari:', narrowCheck);
    assert.equal(narrowCheck.hasHorizontalOverflow, false, '360px ekranda sifir yatay tasma olmali');
    await page.screenshot({ path: 'tests/screenshots/audit-6-narrow360.png' });
    auditResults.push('Test 6 (360px Dar Ekranda Sıfır Yatay Taşma): BAŞARILI');
    await page.close();
  }

  await browser.close();

  console.log('\n==========================================');
  console.log('AUDIT OZETI:');
  auditResults.forEach(r => console.log('  ✔ ' + r));
  console.log('Tum senaryolar BASARIYLA TAMAMLANDI!');
  console.log('==========================================');
})();
