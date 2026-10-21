/**
 * @fileoverview Faz 3 birim testleri: ReadingEngine (Webtoon, Single, Double, Novel, RTL ve LocalStorage).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { ReadingEngine } = require('../src/scripts/reading-engine');

function createMockStorage() {
  const store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, val) {
      store[key] = String(val);
    }
  };
}

test('ReadingEngine: Webtoon, Tek Sayfa ve Cift Sayfa (LTR/RTL) gecisleri dogru calismali', () => {
  const storage = createMockStorage();
  const engine = new ReadingEngine({ storage });

  engine.loadChapter({
    seriesId: 'wistoria-asa-ve-kilic',
    chapterId: 'wistoria-bolum-1',
    pages: ['p1.webp', 'p2.webp', 'p3.webp', 'p4.webp'],
    defaultMode: 'webtoon'
  });

  // Webtoon modunda tum sayfalar gorunur
  assert.deepEqual(engine.getVisiblePageIndices(), [0, 1, 2, 3]);

  // Single modunda tek sayfa ilerler
  engine.setMode('single');
  assert.deepEqual(engine.getVisiblePageIndices(), [0]);
  assert.equal(engine.nextPage(), true);
  assert.deepEqual(engine.getVisiblePageIndices(), [1]);

  // Double modunda cift sayfa ve RTL yonu
  engine.goToPage(0);
  engine.setMode('double');
  engine.setDirection('ltr');
  assert.deepEqual(engine.getVisiblePageIndices(), [0, 1]);

  engine.setDirection('rtl');
  assert.deepEqual(engine.getVisiblePageIndices(), [1, 0]);

  // RTL klavye kontrolu: ArrowLeft sonraki sayfaya gecmeli
  const action = engine.handleKeyCommand('ArrowLeft');
  assert.equal(action, 'next');
  assert.equal(engine.currentIndex, 2);
});

test('ReadingEngine: Novel (Metin) bolumlerinde otomatik novel moduna gecmeli ve yazi ayarlari calismali', () => {
  const engine = new ReadingEngine({ storage: createMockStorage() });
  const state = engine.loadChapter({
    seriesId: 'orv-novel',
    chapterId: 'orv-bolum-3',
    pages: [],
    htmlContent: '<div class="orv_title"><h1>Ch 3</h1></div><p class="orv_line">Metin</p>'
  });

  assert.equal(state.mode, 'novel');
  assert.equal(state.hasNovelContent, true);
  assert.equal(state.progressPercent, 100);
  assert.equal(engine.setNovelFontSize(125), 125);
  assert.equal(engine.toggleNovelFontFamily(), 'serif');
  assert.equal(engine.handleKeyCommand('KeyF'), 'fullscreen');
});

test('ReadingEngine: Kaldigi sayfayi localStorage uzerinden hatirlamali', () => {
  const sharedStorage = createMockStorage();
  const engine1 = new ReadingEngine({ storage: sharedStorage });

  engine1.loadChapter({
    seriesId: 'tomb-raider-king',
    chapterId: 'trk-279',
    pages: ['1.webp', '2.webp', '3.webp'],
    defaultMode: 'single'
  });
  engine1.goToPage(2);

  const engine2 = new ReadingEngine({ storage: sharedStorage });
  const resumedState = engine2.loadChapter({
    seriesId: 'tomb-raider-king',
    chapterId: 'trk-279',
    pages: ['1.webp', '2.webp', '3.webp'],
    defaultMode: 'single'
  });

  assert.equal(resumedState.currentIndex, 2);
});

test('ReadingEngine: Seri turune gore (Manhwa, Manga, Novel) gereksiz secenekleri gizlemeli ve uygun kontrolleri gostermeli', () => {
  const engine = new ReadingEngine({ storage: createMockStorage() });

  // 1. Manhwa (Kore Webtoon): Dikey serit + LTR; Manga ve Novel kontrolleri gizli, Sayfa alt bari gizli
  const manhwaState = engine.loadChapter({
    seriesId: 'tomb-raider-king',
    chapterId: 'trk-279',
    seriesType: 'Manhwa',
    sourceLang: 'KR',
    pages: ['p1.jpg', 'p2.jpg']
  });
  assert.equal(manhwaState.seriesType, 'manhwa');
  assert.equal(manhwaState.seriesTypeLabel, 'Manhwa');
  assert.equal(manhwaState.mode, 'webtoon');
  assert.equal(manhwaState.direction, 'ltr');
  assert.equal(manhwaState.showMangaControls, false);
  assert.equal(manhwaState.showImageControls, true);
  assert.equal(manhwaState.showAutoScroll, true);
  assert.equal(manhwaState.showNovelControls, false);
  assert.equal(manhwaState.showPageFooterNav, false);
  assert.equal(
    engine.formatChapterSelectLabel({ number: 279, title: 'Tomb Raider King Bölüm 279' }),
    'Bölüm 279'
  );

  // 2. Manga (Japon Manga): Tek sayfa + RTL; Manga gorunum/yon secicileri ve alt sayfa bari acik, Novel gizli
  const mangaState = engine.loadChapter({
    seriesId: 'kuzeyin-kilici',
    chapterId: 'kk-1',
    seriesType: 'Manga',
    sourceLang: 'JP',
    pages: ['m1.jpg', 'm2.jpg', 'm3.jpg']
  });
  assert.equal(mangaState.seriesType, 'manga');
  assert.equal(mangaState.seriesTypeLabel, 'Manga');
  assert.equal(mangaState.mode, 'single');
  assert.equal(mangaState.direction, 'rtl');
  assert.equal(mangaState.showMangaControls, true);
  assert.equal(mangaState.showImageControls, true);
  assert.equal(mangaState.showAutoScroll, false);
  assert.equal(mangaState.showNovelControls, false);
  assert.equal(mangaState.showPageFooterNav, true);

  // Manga RTL modunda sol tarafa tiklamak (<0.45) sonraki sayfaya gecirmeli
  assert.equal(engine.handleViewportClick(0.2), 'next');
  assert.equal(engine.currentIndex, 1);
  assert.equal(engine.handleViewportClick(0.8), 'prev');
  assert.equal(engine.currentIndex, 0);

  // 3. Novel (Web Roman): Metin modu; Tum gorsel ve manga araclari gizli, yalnizca Novel yazi araclari acik
  const novelState = engine.loadChapter({
    seriesId: 'orv-novel',
    chapterId: 'orv-3',
    seriesType: 'Novel',
    isNovel: true,
    pages: ['kapak.jpg'],
    htmlContent: '<p>Roman metni</p>'
  });
  assert.equal(novelState.seriesType, 'novel');
  assert.equal(novelState.seriesTypeLabel, 'Novel');
  assert.equal(novelState.mode, 'novel');
  assert.equal(novelState.showMangaControls, false);
  assert.equal(novelState.showImageControls, false);
  assert.equal(novelState.showAutoScroll, false);
  assert.equal(novelState.showNovelControls, true);
  assert.equal(novelState.showPageFooterNav, false);

  // DOM senkronizasyon testi
  const makeToggleEl = () => ({
    hiddenState: false,
    textContent: '',
    value: '',
    disabled: false,
    attrs: {},
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    classList: {
      toggle(cls, force) {
        if (cls === 'hidden') this.hiddenState = Boolean(force);
      }
    }
  });
  const domMap = {
    'select-mode': makeToggleEl(),
    'select-direction': makeToggleEl(),
    'zoom-label': makeToggleEl(),
    'font-size-label': makeToggleEl(),
    'font-family-label': makeToggleEl(),
    'reader-group-manga': makeToggleEl(),
    'reader-group-image': makeToggleEl(),
    'reader-group-novel': makeToggleEl(),
    'btn-autoscroll': makeToggleEl(),
    'reader-footer-page-nav': makeToggleEl(),
    'btn-prev-page': makeToggleEl(),
    'btn-next-page': makeToggleEl()
  };
  const mockDoc = {
    getElementById(id) {
      return domMap[id] || null;
    }
  };

  engine.syncControlsIntoDom(mockDoc);
  assert.equal(domMap['reader-group-manga'].classList.hiddenState, true);
  assert.equal(domMap['reader-group-image'].classList.hiddenState, true);
  assert.equal(domMap['reader-group-novel'].classList.hiddenState, false);
  assert.equal(domMap['reader-footer-page-nav'].classList.hiddenState, true);
});

test('ReadingEngine: 01_01, 01_02 formatinda bolunmus Manga sayfalarini otomatik algilayip Tek/Cift Sayfa modlarinda tam sayfa olarak birlestirmeli', () => {
  const engine = new ReadingEngine({ storage: createMockStorage() });
  const slicedUrls = [
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/hash0/s0/Kapak.webp',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/hash1/s0/01_01.webp',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/hash2/s0/01_02.webp',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/hash3/s0/01_03.webp',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/hash4/s0/02_01.webp',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/hash5/s0/02_02.webp'
  ];

  const state = engine.loadChapter({
    seriesId: 'wistoria-asa-ve-kilic',
    chapterId: 'wistoria-bolum-1',
    seriesType: 'Manga',
    sourceLang: 'JP',
    pages: slicedUrls
  });

  // 6 dilim -> 3 mantiksal tam sayfa (Kapak, Sayfa 01 [3 parca], Sayfa 02 [2 parca])
  assert.equal(state.totalPages, 3);
  assert.deepEqual(engine.getPageSlices(0), [slicedUrls[0]]);
  assert.deepEqual(engine.getPageSlices(1), [slicedUrls[1], slicedUrls[2], slicedUrls[3]]);
  assert.deepEqual(engine.getPageSlices(2), [slicedUrls[4], slicedUrls[5]]);

  // Sayfa 1'e (indeks 1: 01_01..01_03) gecildiginde Tek Sayfa modunda 3 dilim birlesik cizilmeli
  engine.goToPage(1);
  const mockViewport = {
    className: '',
    innerHTML: '',
    style: { setProperty() {} }
  };
  const mockCounter = { textContent: '' };
  const mockProgress = { style: { width: '' } };
  const mockDoc = {
    getElementById(id) {
      if (id === 'reader-viewport') return mockViewport;
      if (id === 'page-counter') return mockCounter;
      if (id === 'reader-progress-bar') return mockProgress;
      return null;
    }
  };

  engine.renderViewportIntoDom(mockDoc);
  assert.equal(mockCounter.textContent, 'Sayfa 2 / 3');
  assert.equal(mockViewport.innerHTML.includes('class="reader-logical-page"'), true);
  assert.equal(mockViewport.innerHTML.includes('01_01.webp'), true);
  assert.equal(mockViewport.innerHTML.includes('01_02.webp'), true);
  assert.equal(mockViewport.innerHTML.includes('01_03.webp'), true);
  assert.equal(mockViewport.innerHTML.includes('02_01.webp'), false);
});

test('Reader Sticky Header: Ust cubuk asagi kaydirildiginda uste yapismali ve tek satirli kapsul yapisinda olmali', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const rootDir = path.resolve(__dirname, '..');
  const bodyHtml = fs.readFileSync(path.join(rootDir, 'src/templates/body-content.html'), 'utf8');
  const readerCss = fs.readFileSync(path.join(rootDir, 'src/styles/reader.css'), 'utf8');
  const layoutCss = fs.readFileSync(path.join(rootDir, 'src/styles/layout.css'), 'utf8');

  assert.equal(bodyHtml.includes('class="reader-sticky-header" id="reader-sticky-header"'), true);
  assert.equal(
    bodyHtml.includes('class="reader-chapter-name hidden" id="reader-chapter-title"'),
    true
  );
  assert.equal(/\.reader-wrapper\s*\{[^}]*overflow:\s*visible;/s.test(readerCss), true);
  assert.equal(
    /\.reader-sticky-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s.test(readerCss),
    true
  );
  assert.equal(/\.reader-toolbar\s*\{[^}]*flex-wrap:\s*nowrap;/s.test(readerCss), true);
  assert.equal(/\.reader-controls\s*\{[^}]*flex-wrap:\s*nowrap;/s.test(readerCss), true);
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.site-header\s*\{[^}]*display:\s*none\s*!important;/s.test(
      layoutCss
    ),
    true
  );
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.site-main\s*\{[^}]*max-width:\s*100%\s*!important;[^}]*padding:\s*0\s*!important;/s.test(
      layoutCss
    ),
    true
  );
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.reader-wrapper\s*\{[^}]*border:\s*none\s*!important;[^}]*border-radius:\s*0\s*!important;/s.test(
      layoutCss
    ),
    true
  );
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.reader-sticky-header,\s*body\[data-active-view="reader"\]\s+\.reader-progress-track\s*\{[^}]*border-radius:\s*0\s*!important;/s.test(
      layoutCss
    ),
    true
  );
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.reader-footer-bar\s*\{[^}]*border-radius:\s*0\s*!important;/s.test(
      layoutCss
    ),
    true
  );
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.site-footer\s*\{[^}]*display:\s*none\s*!important;/s.test(
      layoutCss
    ),
    true
  );
});

test('Mobil Uyumluluk: Hamburger menu, acilir arama, simge odakli dugmeler ve ReadingEngine dokunmatik kaydirma (swipe) destegi dogru calismali', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { BloggerThemeBridge } = require('../src/scripts/blogger-theme-bridge');
  const rootDir = path.resolve(__dirname, '..');
  const bodyHtml = fs.readFileSync(path.join(rootDir, 'src/templates/body-content.html'), 'utf8');
  const layoutCss = fs.readFileSync(path.join(rootDir, 'src/styles/layout.css'), 'utf8');
  const cardsCss = fs.readFileSync(path.join(rootDir, 'src/styles/cards.css'), 'utf8');
  const seriesCss = fs.readFileSync(path.join(rootDir, 'src/styles/series-page.css'), 'utf8');
  const heroCss = fs.readFileSync(path.join(rootDir, 'src/styles/hero-slider.css'), 'utf8');
  const readerCss = fs.readFileSync(path.join(rootDir, 'src/styles/reader.css'), 'utf8');

  // Hamburger menu, mobil arama ve simge odakli .btn-label yapisi kontrolu
  assert.equal(bodyHtml.includes('id="mobile-nav-drawer"'), true);
  assert.equal(bodyHtml.includes('id="btn-mobile-menu"'), true);
  assert.equal(bodyHtml.includes('id="btn-mobile-search"'), true);
  assert.equal(bodyHtml.includes('class="btn-label"'), true);
  assert.equal(layoutCss.includes('.hero-cover-img'), false);
  assert.equal(layoutCss.includes('#mobile-nav-drawer.is-mobile-open'), true);
  assert.equal(layoutCss.includes('#header-search-box.is-mobile-open'), true);
  assert.equal(layoutCss.includes('.btn-label,'), true);
  assert.equal(cardsCss.includes('@media (max-width: 540px)'), true);
  assert.equal(cardsCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), true);
  assert.equal(seriesCss.includes('@media (max-width: 1080px)'), true);
  assert.equal(seriesCss.includes('@media (max-width: 768px)'), true);
  assert.equal(seriesCss.includes('@media (max-width: 480px)'), true);
  assert.equal(heroCss.includes('@media (max-width: 480px)'), true);
  assert.equal(readerCss.includes('@media (max-width: 480px)'), true);

  // BloggerThemeBridge hamburger menu ve mobil arama gecis testi
  const makeClassEl = () => {
    const classes = new Set();
    const attrs = {};
    return {
      classes,
      attrs,
      focused: false,
      focus() {
        this.focused = true;
      },
      setAttribute(k, v) {
        attrs[k] = v;
      },
      querySelector(sel) {
        if (sel === '.icon-menu-open') return openIconEl;
        if (sel === '.icon-menu-close') return closeIconEl;
        return null;
      },
      classList: {
        contains: (c) => classes.has(c),
        toggle(c, force) {
          const next = typeof force === 'boolean' ? force : !classes.has(c);
          if (next) classes.add(c);
          else classes.delete(c);
          return next;
        }
      }
    };
  };
  const openIconEl = makeClassEl();
  const closeIconEl = makeClassEl();
  closeIconEl.classes.add('hidden');
  const mockMobileDom = {
    'top-app-bar': makeClassEl(),
    'mobile-nav-drawer': makeClassEl(),
    'btn-mobile-menu': makeClassEl(),
    'header-search-box': makeClassEl(),
    'btn-mobile-search': makeClassEl(),
    'input-search': makeClassEl()
  };
  const mockDoc = {
    getElementById(id) {
      return mockMobileDom[id] || null;
    }
  };
  const bridge = new BloggerThemeBridge({ storage: createMockStorage() });

  // Hamburger menuyu ac -> menu acilir, ikon X olur
  assert.equal(bridge.toggleMobileMenu(undefined, mockDoc), true);
  assert.equal(mockMobileDom['mobile-nav-drawer'].classes.has('is-mobile-open'), true);
  assert.equal(mockMobileDom['btn-mobile-menu'].attrs['aria-expanded'], 'true');
  assert.equal(openIconEl.classes.has('hidden'), true);
  assert.equal(closeIconEl.classes.has('hidden'), false);

  // Mobil aramayi ac -> arama acilir, input odaklanir ve hamburger menu otomatik kapanir
  assert.equal(bridge.toggleMobileSearch(undefined, mockDoc), true);
  assert.equal(mockMobileDom['header-search-box'].classes.has('is-mobile-open'), true);
  assert.equal(mockMobileDom['input-search'].focused, true);
  assert.equal(mockMobileDom['mobile-nav-drawer'].classes.has('is-mobile-open'), false);

  bridge.closeMobilePanels(mockDoc);
  assert.equal(mockMobileDom['header-search-box'].classes.has('is-mobile-open'), false);

  // ReadingEngine dokunmatik kaydirma (LTR ve RTL) testi
  const engine = new ReadingEngine({ storage: createMockStorage() });
  engine.loadChapter({
    seriesId: 'test-manga',
    chapterId: 'bolum-1',
    seriesType: 'Manga',
    sourceLang: 'JP',
    pages: ['p1.webp', 'p2.webp', 'p3.webp']
  });

  // Varsayilan Manga modu: single + rtl
  assert.equal(engine.handleTouchSwipe(100, 220, 300, 305), 'next');
  assert.equal(engine.currentIndex, 1);
  assert.equal(engine.handleTouchSwipe(220, 100, 300, 305), 'prev');
  assert.equal(engine.currentIndex, 0);
  assert.equal(engine.handleTouchSwipe(100, 200, 100, 350), 'none');
  assert.equal(engine.handleTouchSwipe(100, 120, 100, 102), 'none');

  engine.setDirection('ltr');
  assert.equal(engine.handleTouchSwipe(240, 110, 200, 210), 'next');
  assert.equal(engine.currentIndex, 1);
  assert.equal(engine.handleTouchSwipe(110, 240, 200, 210), 'prev');
  assert.equal(engine.currentIndex, 0);
});

test('Mihon Okuyucu (ReaderHudController): Merkez tiklama ile HUD gizleme, Seekbar, Arka Plan Temalari ve Webtoon kaydirma takibi dogru calismali', () => {
  const { ReaderHudController } = require('../src/scripts/reader-hud');
  const engine = new ReadingEngine({ storage: createMockStorage() });
  const hud = new ReaderHudController();

  engine.loadChapter({
    seriesId: 'tomb-raider-king',
    chapterId: 'trk-279',
    seriesType: 'Manhwa',
    sourceLang: 'KR',
    pages: ['p1.webp', 'p2.webp', 'p3.webp', 'p4.webp']
  });

  // 1. Webtoon modunda tiklama HUD gorunurlugunu acip kapatmali
  assert.equal(engine.hudVisible, true);
  assert.equal(engine.handleViewportClick(0.5), 'toggle-hud');
  assert.equal(engine.hudVisible, false);
  assert.equal(engine.handleViewportClick(0.2), 'toggle-hud');
  assert.equal(engine.hudVisible, true);

  // 2. Tek sayfa modunda kenar tiklamalari sayfa degistirmeli, orta bolge (0.35-0.65) HUD gizlemeli
  engine.setMode('single');
  engine.setDirection('ltr');
  assert.equal(engine.handleViewportClick(0.8), 'next');
  assert.equal(engine.currentIndex, 1);
  assert.equal(engine.handleViewportClick(0.5), 'toggle-hud');
  assert.equal(engine.hudVisible, false);

  // 3. Arka plan temalari, sayfa boslugu (gap), oto-kaydir hizi ve duraklama suresi
  assert.equal(engine.setBackgroundTheme('amoled'), 'amoled');
  assert.equal(engine.setBackgroundTheme('sepia'), 'sepia');
  assert.equal(engine.setGap(16), 16);
  assert.equal(engine.setAutoScrollSpeed(3), 3);
  assert.equal(engine.setAutoScrollPause(2000), 2000);
  assert.equal(engine.getState().autoScrollSpeed, 3);
  assert.equal(engine.getState().autoScrollPause, 2000);

  // 4. ReaderHudController DOM esitleme ve Seekbar gezinmesi
  const makeHudEl = () => {
    const classes = new Set();
    const attrs = {};
    return {
      classes,
      attrs,
      textContent: '',
      value: '',
      disabled: false,
      scrolledIntoView: false,
      style: { width: '' },
      setAttribute(k, v) {
        attrs[k] = v;
      },
      getAttribute(k) {
        return attrs[k];
      },
      scrollIntoView() {
        this.scrolledIntoView = true;
      },
      querySelector(sel) {
        if (sel === '[data-page-index="2"]') return pageImg2;
        return null;
      },
      querySelectorAll() {
        return [pageImg0, pageImg1, pageImg2];
      },
      classList: {
        add(c) {
          classes.add(c);
        },
        remove(c) {
          classes.delete(c);
        },
        contains(c) {
          return classes.has(c);
        },
        toggle(c, force) {
          const next = typeof force === 'boolean' ? force : !classes.has(c);
          if (next) classes.add(c);
          else classes.delete(c);
          return next;
        }
      }
    };
  };

  const pageImg0 = makeHudEl();
  pageImg0.attrs['data-page-index'] = '0';
  pageImg0.getBoundingClientRect = () => ({ top: -900, bottom: -100 });
  const pageImg1 = makeHudEl();
  pageImg1.attrs['data-page-index'] = '1';
  pageImg1.getBoundingClientRect = () => ({ top: -400, bottom: 40 });
  const pageImg2 = makeHudEl();
  pageImg2.attrs['data-page-index'] = '2';
  pageImg2.getBoundingClientRect = () => ({ top: 100, bottom: 850 });

  const domMap = {
    'reader-wrapper': makeHudEl(),
    'reader-settings-sheet': makeHudEl(),
    'btn-reader-settings': makeHudEl(),
    'btn-dock-settings': makeHudEl(),
    'dock-mode-label': makeHudEl(),
    'dock-dir-label': makeHudEl(),
    'btn-dock-mode': makeHudEl(),
    'btn-dock-direction': makeHudEl(),
    'reader-seekbar-row': makeHudEl(),
    'mihon-setting-gap-group': makeHudEl(),
    'mihon-setting-scroll-speed-group': makeHudEl(),
    'mihon-setting-scroll-pause-group': makeHudEl(),
    'mihon-setting-mode-group': makeHudEl(),
    'mihon-setting-dir-group': makeHudEl(),
    'reader-end-chapter-label': makeHudEl(),
    'btn-end-prev-chapter': makeHudEl(),
    'btn-end-next-chapter': makeHudEl(),
    'btn-end-series': makeHudEl(),
    'reader-chapter-end-card': makeHudEl(),
    'reader-viewport': makeHudEl(),
    'seekbar-current-page': makeHudEl(),
    'seekbar-total-pages': makeHudEl(),
    'reader-page-slider': makeHudEl(),
    'reader-mini-page-pill': makeHudEl(),
    'reader-progress-bar': makeHudEl(),
    'disqus-section': makeHudEl()
  };

  const mockDoc = {
    getElementById(id) {
      return domMap[id] || null;
    }
  };

  // Ayarlar cekmecesini ac/kapat
  assert.equal(hud.toggleSettingsSheet(true, mockDoc), true);
  assert.equal(domMap['reader-settings-sheet'].classes.has('hidden'), false);
  assert.equal(domMap['btn-reader-settings'].attrs['aria-expanded'], 'true');

  // HUD gizlendiginde ayarlar cekmecesi de otomatik kapanmali
  hud.syncHudIntoDom(
    engine,
    {
      chapterLabel: 'Bölüm 279',
      hasPrevChapter: true,
      hasNextChapter: false,
      seriesHref: '/seri/trk',
      seriesId: 'tomb-raider-king'
    },
    mockDoc
  );
  assert.equal(domMap['reader-wrapper'].classes.has('hud-hidden'), true);
  assert.equal(domMap['reader-wrapper'].classes.has('reader-bg-sepia'), true);
  assert.equal(hud.settingsOpen, false);
  assert.equal(domMap['reader-end-chapter-label'].textContent, 'Bölüm 279 Tamamlandı');
  assert.equal(domMap['btn-end-prev-chapter'].disabled, false);
  assert.equal(domMap['btn-end-next-chapter'].disabled, true);
  // Manhwa (Webtoon) serisinde Okuma Modu ve Okuma Yonu gizli olmali
  assert.equal(domMap['mihon-setting-mode-group'].classes.has('hidden'), true);
  assert.equal(domMap['mihon-setting-dir-group'].classes.has('hidden'), true);

  // Manga serisinde Okuma Modu ve Okuma Yonu acik, Sayfa Boslugu ve Oto-Kaydir ayarlari (single modda) gizli olmali
  engine.loadChapter({
    seriesId: 'wistoria',
    chapterId: 'wistoria-1',
    seriesType: 'Manga',
    sourceLang: 'JP',
    pages: ['m1.webp', 'm2.webp']
  });
  hud.syncHudIntoDom(engine, null, mockDoc);
  assert.equal(domMap['mihon-setting-mode-group'].classes.has('hidden'), false);
  assert.equal(domMap['mihon-setting-dir-group'].classes.has('hidden'), false);
  assert.equal(domMap['mihon-setting-gap-group'].classes.has('hidden'), true);
  assert.equal(domMap['mihon-setting-scroll-speed-group'].classes.has('hidden'), true);
  assert.equal(domMap['mihon-setting-scroll-pause-group'].classes.has('hidden'), true);
  // Manga 1. sayfadayken (ara sayfa) bolum sonu karti ve yorumlar gizli olmali
  assert.equal(domMap['reader-chapter-end-card'].classes.has('hidden'), true);
  assert.equal(domMap['disqus-section'].classes.has('hidden'), true);
  assert.equal(domMap['disqus-section'].classes.has('reader-comments-visible'), false);

  // Son sayfaya (2/2) gecildiginde bolum sonu karti ve yorumlar yumusak bicimde gorunur olmali
  engine.goToPage(1);
  hud.syncHudIntoDom(engine, null, mockDoc);
  assert.equal(domMap['reader-chapter-end-card'].classes.has('hidden'), false);
  assert.equal(domMap['disqus-section'].classes.has('hidden'), false);
  assert.equal(domMap['disqus-section'].classes.has('reader-comments-visible'), true);

  // 1. sayfaya donuldugunde bolum sonu karti ve yorumlar tekrar gizlenmeli
  engine.goToPage(0);
  hud.syncHudIntoDom(engine, null, mockDoc);
  assert.equal(domMap['reader-chapter-end-card'].classes.has('hidden'), true);
  assert.equal(domMap['disqus-section'].classes.has('hidden'), true);
  assert.equal(domMap['disqus-section'].classes.has('reader-comments-visible'), false);

  // Webtoon modunda seekbar, oto-kaydir ayarlari ve kaydirma takibi
  engine.loadChapter({
    seriesId: 'tomb-raider-king',
    chapterId: 'trk-279',
    seriesType: 'Manhwa',
    sourceLang: 'KR',
    pages: ['p1.webp', 'p2.webp', 'p3.webp', 'p4.webp']
  });
  hud.syncHudIntoDom(engine, null, mockDoc);
  // Webtoon modunda bolum sonu karti surekli gorunur olmali
  assert.equal(domMap['reader-chapter-end-card'].classes.has('hidden'), false);
  assert.equal(domMap['mihon-setting-scroll-speed-group'].classes.has('hidden'), false);
  assert.equal(domMap['mihon-setting-scroll-pause-group'].classes.has('hidden'), false);
  const seekIdx = hud.handleSeekbarChange(engine, 3, mockDoc);
  assert.equal(seekIdx, 2);
  assert.equal(domMap['seekbar-current-page'].textContent, '3');
  assert.equal(domMap['reader-mini-page-pill'].textContent, '3 / 4');
  assert.equal(pageImg2.scrolledIntoView, true);

  engine.goToPage(0);
  const scrolledIdx = hud.updateWebtoonScrollPage(engine, mockDoc);
  assert.equal(scrolledIdx, 2);
  assert.equal(domMap['seekbar-current-page'].textContent, '3');

  const fs = require('node:fs');
  const path = require('node:path');
  const bodyHtml = fs.readFileSync(
    path.join(path.resolve(__dirname, '..'), 'src/templates/body-content.html'),
    'utf8'
  );
  const readerCss = fs.readFileSync(
    path.join(path.resolve(__dirname, '..'), 'src/styles/reader.css'),
    'utf8'
  );
  const layoutCss = fs.readFileSync(
    path.join(path.resolve(__dirname, '..'), 'src/styles/layout.css'),
    'utf8'
  );
  assert.equal(bodyHtml.includes('Mihon Okuyucu Ayarları'), false);
  assert.equal(bodyHtml.includes('Okuyucu Ayarları</strong>'), true);
  assert.equal(bodyHtml.includes('id="mihon-setting-scroll-speed-group"'), true);
  assert.equal(bodyHtml.includes('id="mihon-setting-scroll-pause-group"'), true);
  assert.equal(bodyHtml.includes('data-scroll-speed-pill="2"'), true);
  assert.equal(bodyHtml.includes('data-scroll-pause-pill="1000"'), true);
  assert.equal(bodyHtml.includes('id="reader-group-manga"'), false);
  assert.equal(bodyHtml.includes('id="btn-zoom-in"'), false);
  assert.equal(bodyHtml.includes('id="btn-zoom-out"'), false);
  assert.equal(bodyHtml.includes('id="btn-footer-series"'), false);
  assert.equal(bodyHtml.includes('id="btn-dock-mode"'), false);
  assert.equal(bodyHtml.includes('id="btn-dock-direction"'), false);
  assert.equal(bodyHtml.includes('id="btn-dock-settings"'), false);
  assert.equal(bodyHtml.includes('id="reader-type-badge"'), false);
  assert.equal(bodyHtml.includes('id="btn-fullscreen"'), false);
  assert.equal(bodyHtml.includes('class="ui-icon ui-icon-arrow-left"'), true);
  assert.equal(bodyHtml.includes('class="btn-label" id="reader-series-name"'), true);
  assert.equal(readerCss.includes('.reader-type-badge'), false);
  assert.equal(
    bodyHtml.includes('class="reader-btn reader-floating-autoscroll" id="btn-autoscroll"'),
    true
  );
  assert.equal(
    bodyHtml.indexOf('id="reader-viewport"') < bodyHtml.indexOf('id="btn-autoscroll"'),
    true
  );
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.scroll-top-btn\s*\{\s*display:\s*none\s*!important;/s.test(
      layoutCss
    ),
    true
  );
  assert.equal(
    /\.reader-floating-autoscroll\s*\{[^}]*position:\s*fixed;[^}]*right:\s*1\.5rem;[^}]*bottom:\s*4\.5rem;/s.test(
      readerCss
    ),
    true
  );
  assert.equal(
    /\.reader-settings-sheet\s*\{[^}]*position:\s*fixed;[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*transform:\s*translate\(-50%,\s*-50%\);[^}]*width:\s*min\(94vw,\s*780px\);[^}]*background:\s*rgba\(13,\s*16,\s*25,\s*0\.88\);[^}]*backdrop-filter:\s*blur\(14px\)\s*saturate\(150%\);/s.test(
      readerCss
    ),
    true
  );
  assert.equal(
    /\.mihon-sheet-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(320px,\s*1fr\)\);/s.test(
      readerCss
    ),
    true
  );
  assert.equal(
    /\.mihon-setting-group\s*\{[^}]*background:\s*rgba\(8,\s*10,\s*16,\s*0\.52\);/s.test(
      readerCss
    ),
    true
  );
  assert.equal(
    /\.mihon-pill-row\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(0,\s*1fr\)\);/s.test(
      readerCss
    ),
    true
  );
  assert.equal(/\.reader-viewport\s*\{\s*min-height:\s*0;\s*padding:\s*0;/s.test(readerCss), true);
  assert.equal(/\.reader-footer-bar\s*\{[^}]*flex-direction:\s*row;[^}]*flex-wrap:\s*nowrap;/s.test(readerCss), true);
  assert.equal(/\.mihon-action-dock\s*\{\s*flex-wrap:\s*nowrap;/s.test(readerCss), true);
  assert.equal(/\.mihon-choice-pill\s*\{[^}]*min-height:\s*38px;/s.test(readerCss), true);
  assert.equal(/\.mihon-seekbar-pill\s*\{\s*height:\s*44px;/s.test(readerCss), true);
  assert.equal(bodyHtml.includes('>AMOLED</button>'), true);
  assert.equal(bodyHtml.includes('>1x Yavaş</button>'), true);
  assert.equal(bodyHtml.includes('>Yok (0s)</button>'), true);
  assert.equal(
    /\.reader-title-group\s*\{\s*display:\s*none\s*!important;\s*\}/s.test(readerCss),
    false
  );
  assert.equal(
    /\.reader-series-back-btn\s*\{[^}]*width:\s*42px;[^}]*min-width:\s*42px;[^}]*height:\s*42px;/s.test(
      readerCss
    ),
    true
  );
  assert.equal(
    /\.reader-chapter-switcher\s*\{[^}]*height:\s*42px;[^}]*margin:\s*0\s+auto;/s.test(readerCss),
    true
  );
  assert.equal(bodyHtml.includes('id="reader-prev-dock"'), true);
  assert.equal(bodyHtml.includes('class="mihon-prev-dock"'), true);
  assert.equal(/\.mihon-prev-dock\s*\{[^}]*flex:\s*1\s+1\s+0%;/s.test(readerCss), true);
  assert.equal(/\.mihon-action-dock\s*\{[^}]*flex:\s*1\s+1\s+0%;/s.test(readerCss), true);
  assert.equal(/\.mihon-seekbar-row\s*\{[^}]*justify-content:\s*center;[^}]*margin:\s*0;/s.test(readerCss), true);

  // Sag eylem dock alani: Yorumlar butonu alt bardan kaldirilmis olmali, Sonraki Bolum butonu bulunmali
  const actionDockSegment = bodyHtml.split('class="mihon-action-dock"')[1].split('</div>\n    </div>')[0];
  assert.equal(actionDockSegment.includes('id="btn-dock-comments"'), false);
  assert.equal(actionDockSegment.includes('id="btn-next-chapter"'), true);
});

test('Reader Comments: Alt barda yorum butonu olmamali, bolum sonuna gelindiginde yumusak sekilde acilmali', () => {
  const fs = require('fs');
  const path = require('path');
  const { ReaderHudController } = require('../src/scripts/reader-hud');

  const layoutCss = fs.readFileSync(path.join(__dirname, '../src/styles/layout.css'), 'utf-8');
  assert.equal(layoutCss.includes('body[data-active-view="reader"] .disqus-container'), true);
  assert.equal(layoutCss.includes('opacity: 0;'), true);
  assert.equal(layoutCss.includes('reader-comments-visible'), true);
  assert.equal(/\.disqus-container\.reader-comments-visible\s*\{[^}]*opacity:\s*1;/s.test(layoutCss), true);
  assert.equal(layoutCss.includes('scroll-margin-top: 80px;'), true);
  assert.equal(layoutCss.includes('margin: 2rem auto 50vh auto;'), true);

  const hud = new ReaderHudController();
  const classes = new Set();
  const mockDisqus = {
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); },
      toggle(c, force) {
        if (force) classes.add(c);
        else classes.delete(c);
      }
    }
  };

  let endCardTop = 1500;
  const mockEndCard = {
    getBoundingClientRect() {
      return { top: endCardTop, bottom: endCardTop + 200 };
    }
  };

  const mockDoc = {
    getElementById(id) {
      if (id === 'disqus-section') return mockDisqus;
      if (id === 'reader-chapter-end-card') return mockEndCard;
      return null;
    }
  };

  // Henuz bolum sonuna ulasilmadiginda (endCard ekrandan uzakta) gorunur olmamali
  hud.checkCommentsEndVisibility(mockDoc);
  assert.equal(classes.has('reader-comments-visible'), false);

  // Kullanici bolum sonuna geldiginde (endCard ekrana girdiginde) yorumlar aktiflesmeli
  endCardTop = 600;
  hud.checkCommentsEndVisibility(mockDoc);
  assert.equal(classes.has('reader-comments-visible'), true);
});

test('SliceMerger: extractSliceGroupKey ve groupSlicedPages dilimleri dogru gruplamali ve stitchCanvas calismali', async () => {
  const { SliceMerger } = require('../src/scripts/slice-merger');
  const merger = new SliceMerger();

  assert.equal(SliceMerger.extractSliceGroupKey('https://example.com/01_01.webp'), 'page:1');
  assert.equal(SliceMerger.extractSliceGroupKey('https://example.com/01_02.webp'), 'page:1');
  assert.equal(SliceMerger.extractSliceGroupKey('https://example.com/sayfa-02_01.png'), 'page:2');
  assert.equal(SliceMerger.extractSliceGroupKey('https://example.com/single-page.png'), null);

  const groups = SliceMerger.groupSlicedPages([
    'https://example.com/cover.webp',
    'https://example.com/01_01.webp',
    'https://example.com/01_02.webp',
    'https://example.com/02_01.webp'
  ]);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0], ['https://example.com/cover.webp']);
  assert.deepEqual(groups[1], ['https://example.com/01_01.webp', 'https://example.com/01_02.webp']);
  assert.deepEqual(groups[2], ['https://example.com/02_01.webp']);

  // stitchCanvas gecersiz eleman ile cagrildiginda false donmeli
  const res = await merger.stitchCanvas(null, []);
  assert.equal(res, false);
});

test('SliceMerger: Onbellek (cache), LRU tahliyesi ve clearCache dogru calismali', () => {
  const { SliceMerger } = require('../src/scripts/slice-merger');
  const merger = new SliceMerger({ maxCacheSize: 3 });

  merger._putCache('p1', { width: 100, height: 100 });
  merger._putCache('p2', { width: 200, height: 200 });
  merger._putCache('p3', { width: 300, height: 300 });

  assert.equal(merger.isCached(['p1']), true);
  assert.equal(merger.isCached(['p2']), true);
  assert.equal(merger.isCached(['p3']), true);

  // 4. oge eklendiginde en eski p1 tahliye edilmeli (LRU)
  merger._putCache('p4', { width: 400, height: 400 });
  assert.equal(merger.isCached(['p1']), false);
  assert.equal(merger.isCached(['p4']), true);
  assert.equal(merger.cache.size, 3);

  // clearCache tum onbellegi temizlemeli
  merger.clearCache();
  assert.equal(merger.cache.size, 0);
  assert.equal(merger.isCached(['p2']), false);
});

test('SliceMerger: stitchCanvas onbellekteki veriyi aninda (0ms) aktarmali', async () => {
  const { SliceMerger } = require('../src/scripts/slice-merger');
  const merger = new SliceMerger();

  const mockCtx = {
    drawImage: () => {}
  };
  const mockCanvas = {
    getContext: () => mockCtx,
    setAttribute: (attr, val) => { mockCanvas[attr] = val; },
    classList: {
      add: (cls) => { mockCanvas.className = cls; }
    }
  };

  merger._putCache('url1|url2', {
    width: 600,
    height: 1200,
    images: [{ width: 600, height: 600 }, { width: 600, height: 600 }]
  });

  const res = await merger.stitchCanvas(mockCanvas, ['url1', 'url2']);
  assert.equal(res, true);
  assert.equal(mockCanvas.width, 600);
  assert.equal(mockCanvas.height, 1200);
  assert.equal(mockCanvas['data-stitched'], 'true');
  assert.equal(mockCanvas.className, 'stitched-ready');
});



