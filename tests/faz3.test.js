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
