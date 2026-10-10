/**
 * @fileoverview Faz 4 birim testleri: PostGenerator ve AppController dinamik veri & URL yonlendirme.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { PostGenerator } = require('../src/scripts/post-generator');
const { BloggerFeedLoader } = require('../src/scripts/blogger-feed-loader');
const { CatalogController } = require('../src/scripts/catalog-controller');
const { ReadingEngine } = require('../src/scripts/reading-engine');
const { AppController } = require('../src/scripts/app-init');

test('PostGenerator: Seri ve Bolum HTML kodlarini Blogger uyumlu uretmeli ve geri okunabilmeli', () => {
  const gen = new PostGenerator();
  const loader = new BloggerFeedLoader();

  const seriesRes = gen.generateSeriesPost({
    title: 'Solo Leveling',
    sourceLang: 'KR',
    type: 'Manhwa',
    status: 'Tamamlandı',
    genres: ['Aksiyon', 'Zindan'],
    cover: 'https://example.com/sl-cover.jpg',
    synopsis: 'Avcı Sung Jin-Woo uyanışı.'
  });

  const chapterRes = gen.generateChapterPost({
    seriesTitle: 'Solo Leveling',
    chapterNumber: 1,
    pages: 'https://example.com/p1.jpg\nhttps://example.com/p2.jpg'
  });

  const parsedCatalog = loader.buildCatalogFromPosts([
    {
      title: 'Solo Leveling',
      categories: ['Seri', 'Manhwa', 'Tamamlandı', 'Aksiyon', 'Zindan', 'Solo Leveling'],
      content: seriesRes.html
    },
    {
      title: 'Solo Leveling Bölüm 1',
      categories: ['Bölüm', 'Solo Leveling'],
      content: chapterRes.html
    }
  ]);

  assert.equal(parsedCatalog.length, 1);
  assert.equal(parsedCatalog[0].id, 'solo-leveling');
  assert.equal(parsedCatalog[0].chapters.length, 1);
  assert.equal(parsedCatalog[0].chapters[0].pages.length, 2);
});

test('AppController: Dinamik Blogger beslemesini yuklemeli ve dogrudan URL yonlendirmesini calistirmali', async () => {
  const mockFeed = {
    feed: {
      entry: [
        {
          id: { $t: 'p1' },
          title: { $t: 'Tomb Raider King' },
          published: { $t: '2026-09-26T08:33:27.685-07:00' },
          category: [{ term: 'Manhwa' }, { term: 'Seri' }, { term: 'Tomb Raider King' }],
          link: [{ rel: 'alternate', href: 'https://manhwaarsiv.blogspot.com/2026/09/tomb-raider-king.html' }],
          content: { $t: '<div id="actual-series-tag">Tomb Raider King</div><img src="https://example.com/trk.jpg" />' }
        },
        {
          id: { $t: 'p2' },
          title: { $t: 'Tomb Raider King Bölüm 279' },
          published: { $t: '2026-09-26T08:58:42.651-07:00' },
          category: [{ term: 'Bölüm' }, { term: 'Tomb Raider King' }],
          link: [{ rel: 'alternate', href: 'https://manhwaarsiv.blogspot.com/2026/09/tomb-raider-king-bolum-279.html' }],
          content: { $t: '<div class="separator"><img src="https://example.com/279-1.webp" /></div>' }
        }
      ]
    }
  };

  const feedLoader = new BloggerFeedLoader({
    fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => mockFeed
    })
  });
  const catalog = new CatalogController();
  const reader = new ReadingEngine();
  const app = new AppController({ feedLoader, catalog, reader });

  const count = await app.loadDynamicData();
  assert.equal(count, 1);
  assert.equal(catalog.seriesList.length, 1);
  assert.equal(catalog.seriesList[0].id, 'tomb-raider-king');

  // Dogrudan bolum URL'sine girildiginde okuyucu acilmali
  const routedToReader = app.handleUrlRouting(
    'https://manhwaarsiv.blogspot.com/2026/09/tomb-raider-king-bolum-279.html'
  );
  assert.equal(routedToReader, true);
  assert.equal(app.currentView, 'reader');
  assert.equal(app.activeChapterId, 'tomb-raider-king-bolum-279');
});

test('AppController: Seri ve Bolume girildiginde URL degismeli (pushState) ve Geri tusu (popstate) calismali', async () => {
  const mockFeed = {
    feed: {
      entry: [
        {
          id: { $t: 'p1' },
          title: { $t: "Omniscient Reader's Viewpoint Novel" },
          published: { $t: '2026-09-26T08:31:43.871-07:00' },
          category: [{ term: 'Novel' }, { term: 'Seri' }, { term: "Omniscient Reader's Viewpoint Novel" }],
          link: [{ rel: 'alternate', href: 'https://manhwaarsiv.blogspot.com/2026/09/omniscient-readers-viewpoint-novel.html' }],
          content: { $t: '<div id="actual-series-tag">Omniscient Reader\'s Viewpoint Novel</div><img src="https://example.com/orv.jpg" />' }
        },
        {
          id: { $t: 'p2' },
          title: { $t: "Omniscient Reader's Viewpoint Novel Bölüm 3" },
          published: { $t: '2026-09-26T09:05:51.646-07:00' },
          category: [{ term: 'Bölüm' }, { term: "Omniscient Reader's Viewpoint Novel" }],
          link: [{ rel: 'alternate', href: 'https://manhwaarsiv.blogspot.com/2026/09/omniscient-readers-viewpoint-novel-bolum-3.html' }],
          content: { $t: '<div class="orv_title"><h1>Ch 3</h1></div><p class="orv_line">Metin</p>' }
        }
      ]
    }
  };

  // Sahte tarayici History ve Location nesneleri
  const historyStack = [];
  let stackIndex = -1;
  const mockLocation = {
    protocol: 'https:',
    origin: 'https://manhwaarsiv.blogspot.com',
    pathname: '/',
    href: 'https://manhwaarsiv.blogspot.com/'
  };

  const mockHistory = {
    get state() {
      return stackIndex >= 0 ? historyStack[stackIndex].state : null;
    },
    pushState(state, title, url) {
      stackIndex++;
      historyStack.splice(stackIndex, historyStack.length - stackIndex, { state, title, url });
      mockLocation.pathname = url;
      mockLocation.href = 'https://manhwaarsiv.blogspot.com' + url;
    },
    replaceState(state, title, url) {
      if (stackIndex < 0) stackIndex = 0;
      historyStack[stackIndex] = { state, title, url };
      mockLocation.pathname = url;
      mockLocation.href = 'https://manhwaarsiv.blogspot.com' + url;
    }
  };

  const feedLoader = new BloggerFeedLoader({
    fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => mockFeed
    })
  });
  const catalog = new CatalogController();
  const reader = new ReadingEngine();
  const app = new AppController({
    feedLoader,
    catalog,
    reader,
    historyObj: mockHistory,
    locationObj: mockLocation
  });

  await app.loadDynamicData();
  assert.equal(app.currentView, 'catalog');
  assert.equal(mockLocation.pathname, '/');

  // 1. Kullanici seriye tiklar -> URL degismeli
  app.openSeriesDetail('omniscient-reader-s-viewpoint-novel');
  assert.equal(app.currentView, 'series');
  assert.equal(mockLocation.pathname, '/2026/09/omniscient-readers-viewpoint-novel.html');

  // 2. Kullanici bolume tiklar -> URL bolum adresine degismeli
  app.openReader(
    'omniscient-reader-s-viewpoint-novel',
    'omniscient-reader-s-viewpoint-novel-bolum-3'
  );
  assert.equal(app.currentView, 'reader');
  assert.equal(mockLocation.pathname, '/2026/09/omniscient-readers-viewpoint-novel-bolum-3.html');

  // 3. Kullanici tarayicida GERI (Back) tusuna basar -> Seri sayfasina donmeli
  stackIndex--;
  mockLocation.pathname = historyStack[stackIndex].url;
  mockLocation.href = 'https://manhwaarsiv.blogspot.com' + mockLocation.pathname;
  app.handlePopState({ state: historyStack[stackIndex].state });
  assert.equal(app.currentView, 'series');
  assert.equal(mockLocation.pathname, '/2026/09/omniscient-readers-viewpoint-novel.html');

  // 4. Kullanici tekrar GERI (Back) tusuna basar -> Katalog ana sayfasina donmeli
  stackIndex--;
  mockLocation.pathname = historyStack[stackIndex].url;
  mockLocation.href = 'https://manhwaarsiv.blogspot.com' + mockLocation.pathname;
  app.handlePopState({ state: historyStack[stackIndex].state });
  assert.equal(app.currentView, 'catalog');
  assert.equal(mockLocation.pathname, '/');
});

test('GitHub Yayin Hazirligi: .gitignore, README.md, LICENSE ve CI is akisi dosyalari mevcut olmali', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const rootDir = path.resolve(__dirname, '..');

  const requiredFiles = [
    '.gitignore',
    'README.md',
    'LICENSE',
    '.github/workflows/ci.yml',
    'dist/theme.xml',
    'dist/preview.html'
  ];

  for (const relPath of requiredFiles) {
    const fullPath = path.join(rootDir, relPath);
    assert.equal(fs.existsSync(fullPath), true, `Eksik dosya: ${relPath}`);
  }

  const gitignoreContent = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
  assert.equal(gitignoreContent.includes('logs/'), true);
  assert.equal(gitignoreContent.includes('node_modules/'), true);
});
