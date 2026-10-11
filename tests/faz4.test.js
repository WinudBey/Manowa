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
          title: { $t: 'Gölge Hükümdarı' },
          published: { $t: '2026-09-26T08:33:27.685-07:00' },
          category: [{ term: 'Manhwa' }, { term: 'Seri' }, { term: 'Gölge Hükümdarı' }],
          link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/golge-hukumdari.html' }],
          content: { $t: '<div id="actual-series-tag">Gölge Hükümdarı</div><img src="https://example.com/gh.jpg" />' }
        },
        {
          id: { $t: 'p2' },
          title: { $t: 'Gölge Hükümdarı Bölüm 279' },
          published: { $t: '2026-09-26T08:58:42.651-07:00' },
          category: [{ term: 'Bölüm' }, { term: 'Gölge Hükümdarı' }],
          link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/golge-hukumdari-bolum-279.html' }],
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
  assert.equal(catalog.seriesList[0].id, 'golge-hukumdari');

  // Dogrudan bolum URL'sine girildiginde okuyucu acilmali
  const routedToReader = app.handleUrlRouting(
    'https://example.blogspot.com/2026/09/golge-hukumdari-bolum-279.html'
  );
  assert.equal(routedToReader, true);
  assert.equal(app.currentView, 'reader');
  assert.equal(app.activeChapterId, 'golge-hukumdari-bolum-279');
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
          link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/omniscient-readers-viewpoint-novel.html' }],
          content: { $t: '<div id="actual-series-tag">Omniscient Reader\'s Viewpoint Novel</div><img src="https://example.com/orv.jpg" />' }
        },
        {
          id: { $t: 'p2' },
          title: { $t: "Omniscient Reader's Viewpoint Novel Bölüm 3" },
          published: { $t: '2026-09-26T09:05:51.646-07:00' },
          category: [{ term: 'Bölüm' }, { term: "Omniscient Reader's Viewpoint Novel" }],
          link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/omniscient-readers-viewpoint-novel-bolum-3.html' }],
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
    origin: 'https://example.blogspot.com',
    pathname: '/',
    href: 'https://example.blogspot.com/'
  };

  const mockHistory = {
    get state() {
      return stackIndex >= 0 ? historyStack[stackIndex].state : null;
    },
    pushState(state, title, url) {
      stackIndex++;
      historyStack.splice(stackIndex, historyStack.length - stackIndex, { state, title, url });
      mockLocation.pathname = url;
      mockLocation.href = 'https://example.blogspot.com' + url;
    },
    replaceState(state, title, url) {
      if (stackIndex < 0) stackIndex = 0;
      historyStack[stackIndex] = { state, title, url };
      mockLocation.pathname = url;
      mockLocation.href = 'https://example.blogspot.com' + url;
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
  mockLocation.href = 'https://example.blogspot.com' + mockLocation.pathname;
  app.handlePopState({ state: historyStack[stackIndex].state });
  assert.equal(app.currentView, 'series');
  assert.equal(mockLocation.pathname, '/2026/09/omniscient-readers-viewpoint-novel.html');

  // 4. Kullanici tekrar GERI (Back) tusuna basar -> Katalog ana sayfasina donmeli
  stackIndex--;
  mockLocation.pathname = historyStack[stackIndex].url;
  mockLocation.href = 'https://example.blogspot.com' + mockLocation.pathname;
  app.handlePopState({ state: historyStack[stackIndex].state });
  assert.equal(app.currentView, 'catalog');
  assert.equal(mockLocation.pathname, '/');
});

test('GitHub Yayin Hazirligi: .gitignore, README.md, LICENSE, CI ve Release is akisi dosyalari mevcut olmali', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const rootDir = path.resolve(__dirname, '..');

  const requiredFiles = [
    '.gitignore',
    'README.md',
    'LICENSE',
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml',
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
  assert.equal(gitignoreContent.includes('ai.md'), true);
  assert.equal(gitignoreContent.includes('manowa.config.local.json'), true);
  assert.equal(gitignoreContent.includes('dist/theme.personal.xml'), true);

  const releaseWorkflowContent = fs.readFileSync(path.join(rootDir, '.github/workflows/release.yml'), 'utf8');
  assert.equal(releaseWorkflowContent.includes('npm run build'), true);
  assert.equal(releaseWorkflowContent.includes('dist/theme.xml'), true);
  assert.equal(releaseWorkflowContent.includes('dist/preview.html'), true);
  assert.equal(releaseWorkflowContent.includes('gh release'), true);
});

test('UserLibrary: Favoriler (Kitapligim), Okuma Gecmisi ve Son Eklenen Bolumler dogru calismali', () => {
  const { UserLibrary } = require('../src/scripts/user-library');
  const store = {};
  const mockStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    }
  };

  const catalog = new CatalogController();
  const reader = new ReadingEngine({ storage: mockStorage });
  const library = new UserLibrary({ storage: mockStorage });

  assert.equal(library.isFavorite('kuzeyin-kilici'), false);
  assert.equal(library.toggleFavorite('kuzeyin-kilici'), true);
  assert.equal(library.isFavorite('kuzeyin-kilici'), true);
  assert.equal(library.getFavoriteSeries(catalog).length, 1);

  // Son eklenen bolumler
  const latest = library.getLatestChapters(catalog, 5);
  assert.equal(latest.length >= 2, true);
  assert.equal(latest[0].seriesId, 'kuzeyin-kilici');

  // Okuma gecmisi
  reader.loadChapter({
    seriesId: 'kuzeyin-kilici',
    chapterId: 'kuzeyin-kilici-bolum-1',
    pages: ['p1.jpg', 'p2.jpg'],
    defaultMode: 'single'
  });
  reader.goToPage(1);

  const historyList = library.getRecentHistoryList(catalog, reader);
  assert.equal(historyList.length, 1);
  assert.equal(historyList[0].seriesId, 'kuzeyin-kilici');
  assert.equal(historyList[0].pageIndex, 1);

  library.clearHistory();
  assert.equal(library.getRecentHistoryList(catalog, reader).length, 0);
});

test('Canli Tema (theme.xml) ve Onizleme (preview.html) Ayrimi: Gelistirici araclari ve kisisel degerler theme.xml icinde olmamali', () => {
  const fs = require('node:fs');
  const { ThemeBuilder } = require('../src/core/builder');
  const builder = new ThemeBuilder();
  const { themeXmlPath, previewHtmlPath } = builder.build();

  const themeXml = fs.readFileSync(themeXmlPath, 'utf8');
  const previewHtml = fs.readFileSync(previewHtmlPath, 'utf8');

  // Canli theme.xml icinde gelistirici araclari OLMAMALI
  assert.equal(themeXml.includes('id="nav-generator"'), false);
  assert.equal(themeXml.includes('id="view-generator"'), false);
  assert.equal(themeXml.includes('id="debug-log-panel"'), false);
  assert.equal(themeXml.includes('id="input-disqus-shortname"'), false);
  assert.equal(themeXml.includes('id="input-blog-origin"'), false);
  assert.equal(themeXml.includes('MODULE: scripts/post-generator.js'), false);

  // Canli theme.xml icinde kisisel sabit degerler OLMAMALI, Blogger degiskeni OLMALI
  assert.equal(themeXml.includes('manhwaarsiv.blogspot.com'), false);
  assert.equal(themeXml.includes('manhawon'), false);
  assert.equal(themeXml.includes('id="view-bookmarks"'), true);
  assert.equal(themeXml.includes('id="view-history"'), true);
  assert.equal(themeXml.includes('id="latest-chapters-section"'), true);
  assert.equal(themeXml.includes('id="btn-scroll-top"'), true);
  assert.equal(themeXml.includes('name="disqus.shortname"'), true);

  // Yerel preview.html icinde gelistirici araclari ve Blog URL kutusu KORUNMALI
  assert.equal(previewHtml.includes('id="nav-generator"'), true);
  assert.equal(previewHtml.includes('id="view-generator"'), true);
  assert.equal(previewHtml.includes('id="debug-log-panel"'), true);
  assert.equal(previewHtml.includes('id="input-disqus-shortname"'), true);
  assert.equal(previewHtml.includes('id="input-blog-origin"'), true);
  assert.equal(previewHtml.includes('id="btn-connect-blog"'), true);
  assert.equal(previewHtml.includes('MODULE: scripts/post-generator.js'), true);

  // Blog URL normalizasyon ve kaydetme testi
  const memStore = {};
  const loaderWithStore = new BloggerFeedLoader({
    storage: {
      getItem: (k) => memStore[k] || null,
      setItem: (k, v) => {
        memStore[k] = v;
      },
      removeItem: (k) => {
        delete memStore[k];
      }
    }
  });
  const savedOrigin = loaderWithStore.setSavedBlogOrigin('ornek-blog.blogspot.com/');
  assert.equal(savedOrigin, 'https://ornek-blog.blogspot.com');
  assert.equal(loaderWithStore.getSavedBlogOrigin(), 'https://ornek-blog.blogspot.com');

  // Yorum alani (#disqus-section) varsayilan olarak gizli (hidden) baslamali
  assert.equal(themeXml.includes('<section class="disqus-container hidden" id="disqus-section">'), true);
  assert.equal(previewHtml.includes('<section class="disqus-container hidden" id="disqus-section">'), true);
});

test('AppController: Yorumlar yalnizca seri ayrintilarinda ve bolumlerde gosterilmeli', () => {
  const { DisqusLoader } = require('../src/scripts/disqus-loader');
  const catalog = new CatalogController();
  const reader = new ReadingEngine();
  const disqus = new DisqusLoader();
  const app = new AppController({ catalog, reader, disqus });

  // Baslangic katalog gorunumunde yorumlar gizli olmali ve Disqus yuklenmemeli
  app.openCatalog();
  assert.equal(app.currentView, 'catalog');
  assert.equal(app.commentsVisible, false);
  assert.equal(disqus.currentIdentifier, null);

  // Kitapligim ve Gecmis gorunumlerinde yorumlar gizli kalmali
  app.openBookmarks();
  assert.equal(app.commentsVisible, false);
  assert.equal(disqus.currentIdentifier, null);

  app.openHistory();
  assert.equal(app.commentsVisible, false);
  assert.equal(disqus.currentIdentifier, null);

  // Seri ayrintilarina girildiginde yorumlar gosterilmeli ve seri konusu yuklenmeli
  const sampleSeries = catalog.seriesList[0];
  app.openSeriesDetail(sampleSeries.id);
  assert.equal(app.currentView, 'series');
  assert.equal(app.commentsVisible, true);
  assert.equal(disqus.currentIdentifier, `series-${sampleSeries.id}`);

  // Bolum okuyucuya girildiginde yorumlar gosterilmeli ve bolum konusu yuklenmeli
  const sampleChapter = sampleSeries.chapters[0];
  app.openReader(sampleSeries.id, sampleChapter.id);
  assert.equal(app.currentView, 'reader');
  assert.equal(app.commentsVisible, true);
  assert.equal(disqus.currentIdentifier, `chapter-${sampleChapter.id}`);

  // Kataloga donuldugunde yorumlar tekrar gizlenmeli
  app.openCatalog();
  assert.equal(app.currentView, 'catalog');
  assert.equal(app.commentsVisible, false);
});

test('HeroSlider: Coklu seri gecisi, dokunmatik kaydirma ve yer tutucu ozet temizligi dogru calismali', () => {
  const { HeroSlider } = require('../src/scripts/hero-slider');
  const { UserLibrary } = require('../src/scripts/user-library');
  const catalog = new CatalogController();
  const library = new UserLibrary();
  const slider = new HeroSlider({ maxSlides: 4, autoPlayMs: 0 });

  const slides = slider.setSlidesFromCatalog(catalog);
  assert.equal(slides.length, 3);
  assert.equal(slider.currentIndex, 0);

  // Ileri / Geri ve dairesel gecis
  slider.nextSlide();
  assert.equal(slider.currentIndex, 1);

  slider.prevSlide();
  assert.equal(slider.currentIndex, 0);

  slider.prevSlide();
  assert.equal(slider.currentIndex, 2);

  slider.goToSlide(1);
  assert.equal(slider.currentIndex, 1);

  // Dokunmatik kaydirma (Swipe Left -> Next, Swipe Right -> Prev)
  assert.equal(slider.handleTouchGesture(300, 200), 'next');
  assert.equal(slider.currentIndex, 2);
  assert.equal(slider.handleTouchGesture(200, 300), 'prev');
  assert.equal(slider.currentIndex, 1);

  // Sablon yer tutucu ozet temizligi
  const cleaned = slider.cleanSynopsis(
    'Buraya serinin özet hikayesini uzun uzun yazabilirsiniz. Yepyeni tasarımla çok profesyonel duracaktır.',
    { title: 'Tomb Raider King', type: 'Manhwa', genres: ['Aksiyon', 'Zindan'], chapters: [{ id: '1' }] }
  );
  assert.equal(cleaned.includes('Buraya serinin özet hikayesini'), false);
  assert.equal(cleaned.includes('Tomb Raider King'), true);

  // Baslik altinda kategoriler ve seri ayrintilari kontrolu
  slider.goToSlide(0);
  const html = slider.buildSliderHtml(catalog, library, (v, s, c) => `/${v}/${s}/${c || ''}`);
  assert.equal(html.includes('class="hero-backdrop"'), true);
  assert.equal(html.includes('id="hero-badge"'), false);
  assert.equal(html.includes('id="hero-genres"'), true);
  assert.equal(html.includes('id="hero-title"'), true);
  assert.equal(html.includes('id="hero-details"'), true);
  assert.equal(html.indexOf('id="hero-title"') < html.indexOf('id="hero-genres"'), true);
  assert.equal(html.indexOf('id="hero-details"') > html.indexOf('id="hero-genres"'), true);
  assert.equal(html.includes('id="hero-desc"'), true);
  assert.equal(html.includes('id="btn-hero-read"'), true);
  assert.equal(html.includes('id="btn-hero-detail"'), true);
  assert.equal(html.includes('Seri Ayrıntıları'), true);
  assert.equal(html.includes('id="btn-hero-prev"'), true);
  assert.equal(html.includes('id="btn-hero-next"'), true);
  assert.equal(html.includes('class="hero-dot active"'), true);
  assert.equal(html.includes('data-hero-index="1"'), true);
});

test('SVG Ikon Sistemi ve SidebarController: Temada emoji kullanilmamali, SVG ikonlar ve Sidebar calismali', () => {
  const fs = require('node:fs');
  const { ThemeBuilder } = require('../src/core/builder');
  const { ManowaIcons } = require('../src/scripts/svg-icons');
  const { SidebarController } = require('../src/scripts/sidebar-controller');
  const { UserLibrary } = require('../src/scripts/user-library');

  // 1. SVG Ikon uretimi ve 1. Cilt (layers) ikonu kontrolu
  const layersSvg = ManowaIcons.get('layers');
  assert.equal(layersSvg.includes('<svg class="ui-icon'), true);
  assert.equal(layersSvg.includes('M4 19.5A2.5 2.5 0 0 1 6.5 17H20'), true);
  assert.equal(ManowaIcons.get('heart-filled').includes('fill="currentColor"'), true);

  // 2. SidebarController mantigi ve kategori filtreleme
  const catalog = new CatalogController();
  const library = new UserLibrary();
  const sidebar = new SidebarController({ topLimit: 5 });

  const topSeries = sidebar.getTopSeries(catalog);
  assert.equal(topSeries.length, 3);

  const genres = sidebar.getGenreCounts(catalog);
  assert.equal(genres.length > 0, true);

  const stats = sidebar.getArchiveStats(catalog, library);
  assert.equal(stats.totalSeries, 3);
  assert.equal(stats.totalChapters >= 3, true);

  const topHtml = sidebar.renderTopSeriesHtml(catalog, (v, s) => `/${v}/${s}`);
  assert.equal(topHtml.includes('sidebar-rank-item'), true);
  assert.equal(topHtml.includes('<svg class="ui-icon'), true);

  // CatalogController kategori filtreleme ve Sidebar kategori bulutu testi
  catalog.setGenreFilter('Aksiyon');
  assert.equal(catalog.getFilteredSeries().length, 1);
  assert.equal(catalog.getFilteredSeries()[0].id, 'golge-hukumdari');

  const genresHtml = sidebar.renderGenresHtml(catalog);
  assert.equal(genresHtml.includes('data-sidebar-genre="Aksiyon"'), true);
  assert.equal(genresHtml.includes('class="sidebar-genre-chip active"'), true);

  catalog.setGenreFilter('ALL');
  assert.equal(catalog.getFilteredSeries().length, 3);

  // 3. Derlenen temada (theme.xml ve preview.html) hicbir emoji bulunmamali
  const builder = new ThemeBuilder();
  const { themeXmlPath, previewHtmlPath } = builder.build();
  const themeXml = fs.readFileSync(themeXmlPath, 'utf8');
  const previewHtml = fs.readFileSync(previewHtmlPath, 'utf8');

  const emojiRegex = /\p{Extended_Pictographic}/u;
  assert.equal(emojiRegex.test(themeXml), false, 'theme.xml icinde emoji karakteri bulundu!');
  assert.equal(emojiRegex.test(previewHtml), false, 'preview.html icinde emoji karakteri bulundu!');
  assert.equal(themeXml.includes('id="home-sidebar"'), true);
  assert.equal(themeXml.includes('id="sidebar-top-series"'), true);
  assert.equal(themeXml.includes('id="sidebar-genres"'), true);
  assert.equal(themeXml.includes('id="sidebar-quick-library"'), true);
});

