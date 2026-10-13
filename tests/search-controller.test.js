/**
 * @fileoverview SearchController birim testleri:
 * Turkce karakter normalizasyonu, canli kismi arama, WAI-ARIA listbox/combobox yapisi,
 * klavye olaylari (ArrowDown, ArrowUp, Enter, Escape) ve AppController entegrasyonu.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SearchController,
  normalizeSearchText,
  escapeHtml,
  highlightMatch
} = require('../src/scripts/search-controller');
const { AppController } = require('../src/scripts/app-init');

const sampleSeries = [
  {
    id: 'solo-leveling',
    title: 'Solo Leveling',
    altTitle: 'Na Honjaman Level Up',
    type: 'Manhwa',
    status: 'Tamamlandı',
    cover: 'https://example.com/solo.jpg',
    genres: ['Aksiyon', 'Fantastik', 'Zindan'],
    chapters: [{ id: 'ch-1' }, { id: 'ch-2' }]
  },
  {
    id: 'omniscient-reader',
    title: 'Omniscient Reader',
    altTitle: 'Tüm Bilen Okuyucu',
    type: 'Manhwa',
    status: 'Devam Ediyor',
    cover: 'https://example.com/orv.jpg',
    genres: ['Aksiyon', 'Gizem', 'Kıyamet'],
    chapters: [{ id: 'ch-1' }]
  },
  {
    id: 'one-piece',
    title: 'One Piece',
    altTitle: 'Wan Pīsu',
    type: 'Manga',
    status: 'Devam Ediyor',
    cover: 'https://example.com/op.jpg',
    genres: ['Macera', 'Korsan', 'Komedi'],
    chapters: [{ id: 'ch-1' }, { id: 'ch-2' }, { id: 'ch-3' }]
  }
];

function createMockElement(id, tagName = 'div') {
  const classes = new Set();
  const attrs = {};
  const listeners = {};
  let value = '';
  let innerHTML = '';

  const el = {
    id,
    tagName: tagName.toUpperCase(),
    get value() {
      return value;
    },
    set value(v) {
      value = String(v);
    },
    get innerHTML() {
      return innerHTML;
    },
    set innerHTML(html) {
      innerHTML = String(html);
    },
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => {
        const next = typeof force === 'boolean' ? force : !classes.has(c);
        if (next) classes.add(c);
        else classes.delete(c);
        return next;
      }
    },
    setAttribute(k, v) {
      attrs[k] = String(v);
    },
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null;
    },
    removeAttribute(k) {
      delete attrs[k];
    },
    addEventListener(evt, fn) {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (!listeners[evt]) return;
      listeners[evt] = listeners[evt].filter((f) => f !== fn);
    },
    dispatchMockEvent(evt, data = {}) {
      if (listeners[evt]) {
        listeners[evt].forEach((fn) => fn({ target: el, ...data }));
      }
    },
    querySelectorAll(selector) {
      // Basit [role="option"] tespiti
      if (selector === '[role="option"]') {
        const matches = [];
        const regex = /<div class="([^"]*)" role="option" id="([^"]*)"/g;
        let match;
        let idx = 0;
        while ((match = regex.exec(innerHTML)) !== null) {
          const itemClasses = new Set(match[1].split(' '));
          const itemId = match[2];
          matches.push({
            id: itemId,
            classList: {
              toggle: (cls, force) => {
                if (force) itemClasses.add(cls);
                else itemClasses.delete(cls);
              },
              contains: (cls) => itemClasses.has(cls)
            },
            setAttribute: (k, v) => {},
            scrollIntoView: () => {}
          });
          idx++;
        }
        return matches;
      }
      return [];
    },
    contains(other) {
      return other === el;
    }
  };

  return el;
}

test('SearchController: Turkce karakter ve XSS guvenligi normallestirmesi dogru calismali', () => {
  assert.equal(normalizeSearchText('İSTANBUL'), 'istanbul');
  assert.equal(normalizeSearchText('IĞDIR'), 'igdir');
  assert.equal(normalizeSearchText('ığdır'), 'igdir');
  assert.equal(normalizeSearchText('ŞAMPİYON'), 'sampiyon');
  assert.equal(normalizeSearchText('ÇÖMLEK'), 'comlek');
  assert.equal(normalizeSearchText('Café au Lait'), 'cafe au lait');

  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("Test & 'Quote'"), 'Test &amp; &#39;Quote&#39;');
});

test('SearchController: Tam ad yazilmadan canli kismi arama ve puanlama dogru calismali', () => {
  const controller = new SearchController({
    getSeriesList: () => sampleSeries
  });

  // 1. Baslik baslangici (prefix) ile arama: "sol" -> "Solo Leveling"
  const res1 = controller.searchSeries('sol');
  assert.equal(res1.length >= 1, true);
  assert.equal(res1[0].id, 'solo-leveling');

  // 2. Baslik icinde arama (contains): "level" -> "Solo Leveling"
  const res2 = controller.searchSeries('level');
  assert.equal(res2.length >= 1, true);
  assert.equal(res2[0].id, 'solo-leveling');

  // 3. Alternatif ad ile arama: "honjaman" -> "Solo Leveling"
  const res3 = controller.searchSeries('honjaman');
  assert.equal(res3.length >= 1, true);
  assert.equal(res3[0].id, 'solo-leveling');

  // 4. Tur/Kategori ile arama: "zindan" -> "Solo Leveling"
  const res4 = controller.searchSeries('zindan');
  assert.equal(res4.length >= 1, true);
  assert.equal(res4[0].id, 'solo-leveling');

  // 5. Durum veya tur tipi ile arama: "manga" -> "One Piece"
  const res5 = controller.searchSeries('manga');
  assert.equal(res5.length >= 1, true);
  assert.equal(res5[0].id, 'one-piece');

  // 6. Turkce karakter uyumu: "kiyamet" / "kıyamet" -> "Omniscient Reader"
  const res6 = controller.searchSeries('kiyamet');
  assert.equal(res6.length >= 1, true);
  assert.equal(res6[0].id, 'omniscient-reader');

  // 7. Eslesmeyen sorgu -> bos dizi
  const resNone = controller.searchSeries('hicbireşleşmeyok');
  assert.equal(resNone.length, 0);
});

test('SearchController: Listbox DOM render, WAI-ARIA ozellikleri ve bos durum ciktisi calismali', () => {
  const inputEl = createMockElement('input-search', 'input');
  const listboxEl = createMockElement('search-results-listbox');
  listboxEl.classList.add('hidden');
  const containerEl = createMockElement('header-search-box');

  let selectedSeriesId = null;
  let viewAllQuery = null;

  const controller = new SearchController({
    input: inputEl,
    listbox: listboxEl,
    container: containerEl,
    getSeriesList: () => sampleSeries,
    onSelect: (id) => {
      selectedSeriesId = id;
    },
    onViewAll: (query) => {
      viewAllQuery = query;
    }
  });

  // Baslangic ARIA durumlari
  assert.equal(inputEl.getAttribute('role'), 'combobox');
  assert.equal(inputEl.getAttribute('aria-expanded'), 'false');
  assert.equal(inputEl.getAttribute('aria-controls'), 'search-results-listbox');

  // Arama calistirildiginda listbox acilmali
  controller.executeSearch('solo');
  assert.equal(controller.isOpen, true);
  assert.equal(inputEl.getAttribute('aria-expanded'), 'true');
  assert.equal(listboxEl.classList.contains('hidden'), false);

  // Sonuclar HTML yapisi kontrolu
  assert.equal(listboxEl.innerHTML.includes('role="option"'), true);
  assert.equal(listboxEl.innerHTML.includes('Leveling'), true);
  assert.equal(listboxEl.innerHTML.includes('search-highlight'), true);
  assert.equal(listboxEl.innerHTML.includes('badge-type'), true);
  assert.equal(listboxEl.innerHTML.includes('Tüm sonuçları katalogda gör'), true);

  // Seri secildiginde onSelect tetiklenmeli ve listbox kapanmali
  controller.selectSeries('solo-leveling');
  assert.equal(selectedSeriesId, 'solo-leveling');
  assert.equal(controller.isOpen, false);
  assert.equal(inputEl.getAttribute('aria-expanded'), 'false');
  assert.equal(inputEl.value, '');

  // Eslesmeyen aramada bos durum mesaji gosterilmeli
  controller.executeSearch('olmayan_seri_123');
  assert.equal(controller.isOpen, true);
  assert.equal(listboxEl.innerHTML.includes('search-empty-state'), true);
  assert.equal(listboxEl.innerHTML.includes('için sonuç bulunamadı'), true);

  // Kapatma
  controller.close();
  assert.equal(controller.isOpen, false);
});

test('SearchController: highlightMatch ve arama sonuclarinda nerede eslestigini vurgulama calismali', () => {
  // 1. Baslikta buyuk/kucuk harf ve Turkce karakter korumali vurgulama
  assert.equal(
    highlightMatch('Solo Leveling', 'sol'),
    '<mark class="search-highlight">Sol</mark>o Leveling'
  );
  assert.equal(
    highlightMatch('Kıyamet Sonrası', 'kiyamet'),
    '<mark class="search-highlight">Kıyamet</mark> Sonrası'
  );

  // 2. XSS guvenligi
  assert.equal(
    highlightMatch('<b>Alert</b>', 'alert'),
    '&lt;b&gt;<mark class="search-highlight">Alert</mark>&lt;/b&gt;'
  );

  // 3. Eslesmeyen metin guvenli sekilde kacisli donmeli
  assert.equal(highlightMatch('One Piece', 'xyz'), 'One Piece');

  // 4. DOM uzerinde vurgulama ve eslesme alani bildirimleri
  const inputEl = createMockElement('input-search', 'input');
  const listboxEl = createMockElement('search-results-listbox');
  const controller = new SearchController({
    input: inputEl,
    listbox: listboxEl,
    getSeriesList: () => sampleSeries
  });

  // Baslikta eslesme: 'level' -> Solo <mark>Level</mark>ing
  controller.executeSearch('level');
  assert.equal(listboxEl.innerHTML.includes('<mark class="search-highlight">Level</mark>'), true);

  // Turde eslesme: 'zindan' -> Zindan turu vurgulanmali ve Kategori Eslesmesi gosterilmeli
  controller.executeSearch('zindan');
  assert.equal(listboxEl.innerHTML.includes('<mark class="search-highlight">Zindan</mark>'), true);
  assert.equal(listboxEl.innerHTML.includes('search-genre-tag is-matched'), true);
  assert.equal(listboxEl.innerHTML.includes('Kategori Eşleşmesi'), true);

  // Alternatif ad eslesmesi: 'honjaman' -> Alternatif ad vurgulanmali ve Alternatif Ad etiketi gosterilmeli
  controller.executeSearch('honjaman');
  assert.equal(listboxEl.innerHTML.includes('<mark class="search-highlight">Honjaman</mark>'), true);
  assert.equal(listboxEl.innerHTML.includes('Alternatif Ad:'), true);
});

test('SearchController: Klavye olaylari (ArrowDown, ArrowUp, Enter, Escape) secim akisi calismali', () => {
  const inputEl = createMockElement('input-search', 'input');
  const listboxEl = createMockElement('search-results-listbox');
  const containerEl = createMockElement('header-search-box');

  let selectedId = null;
  const controller = new SearchController({
    input: inputEl,
    listbox: listboxEl,
    container: containerEl,
    getSeriesList: () => sampleSeries,
    onSelect: (id) => {
      selectedId = id;
    }
  });

  // Arama baslat
  controller.executeSearch('one');
  assert.equal(controller.isOpen, true);
  assert.equal(controller.activeIndex, -1);

  // ArrowDown -> ilk secenege odaklan
  inputEl.dispatchMockEvent('keydown', { key: 'ArrowDown', preventDefault: () => {} });
  assert.equal(controller.activeIndex, 0);

  // ArrowDown -> sonraki secenege (Tumunu gor) gec
  inputEl.dispatchMockEvent('keydown', { key: 'ArrowDown', preventDefault: () => {} });
  assert.equal(controller.activeIndex, 1);

  // ArrowUp -> geri 0. secenege don
  inputEl.dispatchMockEvent('keydown', { key: 'ArrowUp', preventDefault: () => {} });
  assert.equal(controller.activeIndex, 0);

  // Enter -> aktif secenegi calistir
  inputEl.dispatchMockEvent('keydown', { key: 'Enter', preventDefault: () => {} });
  assert.equal(selectedId, 'one-piece');
  assert.equal(controller.isOpen, false);

  // Escape testi
  controller.executeSearch('one');
  assert.equal(controller.isOpen, true);
  inputEl.dispatchMockEvent('keydown', { key: 'Escape', preventDefault: () => {} });
  assert.equal(controller.isOpen, false);
});

test('AppController: SearchController entegrasyonu ve secim baglantisi dogru calismali', () => {
  const app = new AppController();
  assert.ok(app.searchController);
  assert.equal(typeof app.searchController.executeSearch, 'function');

  // SearchController uzerinden bir seri secildiginde openSeriesDetail calismali
  let openedDetailId = null;
  app.openSeriesDetail = (id) => {
    openedDetailId = id;
  };

  app.searchController.selectSeries('wistoria-asa-ve-kilic');
  assert.equal(openedDetailId, 'wistoria-asa-ve-kilic');
});
