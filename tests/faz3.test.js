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
    'reader-type-badge': makeToggleEl(),
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
  assert.equal(domMap['reader-type-badge'].textContent, 'Novel');
  assert.equal(domMap['reader-type-badge'].attrs['data-type'], 'novel');
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
    /body\[data-active-view="reader"\]\s+\.site-header\s*\{[^}]*position:\s*relative;/s.test(
      layoutCss
    ),
    true
  );
});
