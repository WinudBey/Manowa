/**
 * @fileoverview Ana uygulama denetleyicisi (AppController).
 * BloggerFeedLoader, CatalogController, ReadingEngine, DisqusLoader, PostGenerator
 * ve RouterController modullerini birbirine baglar.
 */
(function (globalScope) {
  'use strict';
  const RouterClass =
    globalScope.RouterController ||
    (typeof require === 'function' ? require('./router-controller').RouterController : null);
  const UserLibraryClass =
    globalScope.UserLibrary ||
    (typeof require === 'function' ? require('./user-library').UserLibrary : null);
  const HeroSliderClass =
    globalScope.HeroSlider ||
    (typeof require === 'function' ? require('./hero-slider').HeroSlider : null);
  const SidebarClass =
    globalScope.SidebarController ||
    (typeof require === 'function' ? require('./sidebar-controller').SidebarController : null);
  const SeriesPageClass =
    globalScope.SeriesPageController ||
    (typeof require === 'function' ? require('./series-page').SeriesPageController : null);
  const ThemeBridgeClass =
    globalScope.BloggerThemeBridge ||
    (typeof require === 'function'
      ? require('./blogger-theme-bridge').BloggerThemeBridge
      : null);
  const SearchControllerClass =
    globalScope.SearchController ||
    (typeof require === 'function'
      ? require('./search-controller').SearchController
      : null);
  const ReaderHudClass =
    globalScope.ReaderHudController ||
    (typeof require === 'function' ? require('./reader-hud').ReaderHudController : null);
  const iconFn =
    (globalScope.ManowaIcons && globalScope.ManowaIcons.get) ||
    (typeof require === 'function' ? require('./svg-icons').getSvgIcon : () => '');
  /**
   * Tum tema gorunumlerini, Blogger URL entegrasyonunu ve dinamik veri akisini yoneten sinif.
   */
  class AppController {
    /**
     * AppController nesnesini yapilandirir.
     * @param {Object} [deps={}] - Bagimliliklar.
     */
    constructor(deps = {}) {
      this.logger = deps.logger || globalScope.ManowaLogger || null;
      this.catalog =
        deps.catalog ||
        (globalScope.CatalogController ? new globalScope.CatalogController() : null);
      this.reader =
        deps.reader || (globalScope.ReadingEngine ? new globalScope.ReadingEngine() : null);
      const ResolvedReaderHud = globalScope.ReaderHudController || ReaderHudClass;
      this.readerHud =
        deps.readerHud ||
        (ResolvedReaderHud ? new ResolvedReaderHud({ logger: this.logger }) : null);
      this.disqus =
        deps.disqus || (globalScope.DisqusLoader ? new globalScope.DisqusLoader() : null);
      this.generator =
        deps.generator || (globalScope.PostGenerator ? new globalScope.PostGenerator() : null);
      this.library =
        deps.library || (UserLibraryClass ? new UserLibraryClass({ logger: this.logger }) : null);
      this.heroSlider =
        deps.heroSlider || (HeroSliderClass ? new HeroSliderClass({ logger: this.logger }) : null);
      this.sidebar =
        deps.sidebar || (SidebarClass ? new SidebarClass({ logger: this.logger }) : null);
      const ResolvedSeriesPage = globalScope.SeriesPageController || SeriesPageClass;
      this.seriesPage =
        deps.seriesPage ||
        (ResolvedSeriesPage ? new ResolvedSeriesPage({ logger: this.logger }) : null);
      const ResolvedThemeBridge = globalScope.BloggerThemeBridge || ThemeBridgeClass;
      this.themeBridge =
        deps.themeBridge ||
        (ResolvedThemeBridge ? new ResolvedThemeBridge({ logger: this.logger }) : null);
      this.feedLoader =
        deps.feedLoader ||
        (globalScope.BloggerFeedLoader
          ? new globalScope.BloggerFeedLoader({ logger: this.logger })
          : null);
      this.router =
        deps.router ||
        (RouterClass
          ? new RouterClass({
              logger: this.logger,
              historyObj: deps.historyObj,
              locationObj: deps.locationObj
            })
          : null);
      this.siteBaseTitle = globalScope.MANOWA_SITE_TITLE || 'Manowa';
      this.currentView = 'catalog';
      this.commentsVisible = false;
      this.activeSeriesId = '';
      this.activeChapterId = '';
      this.chapterSortOrder = 'desc';
      const ResolvedSearchClass = globalScope.SearchController || SearchControllerClass;
      this.searchController =
        deps.searchController ||
        (ResolvedSearchClass
          ? new ResolvedSearchClass({
              logger: this.logger,
              getSeriesList: () => (this.catalog ? this.catalog.seriesList : []),
              onSelect: (seriesId) => {
                if (this.themeBridge) this.themeBridge.closeMobilePanels();
                this.openSeriesDetail(seriesId);
              },
              onViewAll: (query) => {
                if (this.themeBridge) this.themeBridge.closeMobilePanels();
                if (this.catalog) {
                  this.catalog.setSearchQuery(query);
                }
                this.switchToCatalogIfNeeded();
                this.renderCatalogView();
              }
            })
          : null);
    }
    /**
     * Tarayici DOM baslatmasini, ust baslik entegrasyonunu ve dinamik Blogger veri cekimini calistirir.
     * @returns {Promise<void>}
     */
    async initDom() {
      if (typeof document === 'undefined') return;
      const brandEl = document.getElementById('brand-home-link');
      const brandText = brandEl && brandEl.textContent ? brandEl.textContent.trim() : '';
      if (brandText) {
        this.siteBaseTitle = brandText;
      } else if (document.title) {
        this.siteBaseTitle = document.title.split(' - ')[0].trim() || 'Manowa';
      }
      const originInput = document.getElementById('input-blog-origin');
      if (originInput && this.feedLoader && typeof this.feedLoader.getSavedBlogOrigin === 'function') {
        originInput.value = this.feedLoader.getSavedBlogOrigin();
      }
      if (this.themeBridge) {
        this.themeBridge.applyLayoutConfigWidgets({
          disqus: this.disqus,
          heroSlider: this.heroSlider
        });
        this.themeBridge.initThemeMode();
        this.themeBridge.integrateSidebarGadgets();
      }
      this.integrateHeaderBar();
      if (this.searchController && typeof this.searchController._initElements === 'function') {
        this.searchController._initElements();
      }
      this.bindEvents();
      await this.loadDynamicData();
      this.renderDebugLogs();
    }
    /**
     * Ust kontrol cubugunu (#top-app-bar) Blogger site basliginin (#site-header-inner) icine tasir.
     * @returns {void}
     */
    integrateHeaderBar() {
      if (this.themeBridge) {
        this.themeBridge.integrateHeaderBar();
      }
    }
    /**
     * Hedef gorunum icin Blogger URL'sini uretir.
     * @param {'catalog'|'series'|'reader'|'bookmarks'|'history'|'generator'} viewName - Hedef gorunum.
     * @param {string} [seriesId=''] - Seri kimligi.
     * @param {string} [chapterId=''] - Bolum kimligi.
     * @returns {string} Hedef URL.
     */
    computeTargetUrl(viewName, seriesId = '', chapterId = '') {
      return this.router ? this.router.computeTargetUrl(this.catalog, viewName, seriesId, chapterId) : '/';
    }
    /**
     * Tarayici URL'sini ve History API durumunu gunceller.
     * @param {Object} stateObj - Durum nesnesi.
     * @param {string} pageTitle - Sayfa basligi.
     * @param {string} targetUrl - Hedef URL.
     * @param {Object} [options={}] - Secenekler.
     * @returns {void}
     */
    syncBrowserHistory(stateObj, pageTitle, targetUrl, options = {}) {
      if (this.router) this.router.syncBrowserHistory(stateObj, pageTitle, targetUrl, options);
    }
    /**
     * Blogger JSON Feed API'sinden veya DOM'dan dinamik serileri yukler ve arayuzu gunceller.
     * @returns {Promise<number>} Yuklenen seri sayisi.
     */
    async loadDynamicData() {
      let loadedCount = 0;
      if (this.feedLoader && this.catalog) {
        const dynamicSeries = await this.feedLoader.fetchDynamicCatalog();
        if (Array.isArray(dynamicSeries) && dynamicSeries.length > 0) {
          this.catalog.setSeriesList(dynamicSeries);
          loadedCount = dynamicSeries.length;
        }
      }
      if (loadedCount === 0) loadedCount = this.ingestBloggerPostsFromDom();
      const firstSeries =
        this.catalog && this.catalog.seriesList.length > 0 ? this.catalog.seriesList[0] : null;
      if (firstSeries) {
        this.activeSeriesId = firstSeries.id;
        const firstCh = this.catalog.getSortedChapters(firstSeries.id, 'asc')[0];
        this.activeChapterId = firstCh ? firstCh.id : '';
      }
      this.updateHeroShowcase();
      this.renderHomeSections();
      this.renderCatalogView();
      const routed = this.handleUrlRouting(undefined, {
        updateHistory: false,
        replaceInitialState: true
      });
      if (!routed) {
        this.switchView('catalog');
        this.syncBrowserHistory(
          { view: 'catalog', seriesId: '', chapterId: '' },
          this.siteBaseTitle,
          this.computeTargetUrl('catalog'),
          { updateHistory: true, replace: true }
        );
      }
      return loadedCount;
    }
    /**
     * DOM uzerindeki .post-entry veya .manowa-* dugumlerinden veri okur.
     * @returns {number} Islenen seri/gonderi sayisi.
     */
    ingestBloggerPostsFromDom() {
      if (typeof document === 'undefined' || !this.catalog) return 0;
      if (this.feedLoader) {
        const domSeries = this.feedLoader.parseDomEntries(document);
        if (domSeries.length > 0) {
          domSeries.forEach((s) => this.catalog.upsertSeries(s));
          return domSeries.length;
        }
      }
      return this.themeBridge
        ? this.themeBridge.ingestDomSeriesNodes(this.catalog, this.siteBaseTitle, document)
        : 0;
    }
    /**
     * Ana sayfadaki Hero Slider (Vitrin) alanini katalogdaki serilerle dinamik gunceller.
     * @param {boolean} [resetSlides=true] - Slayt listesini bastan yukle.
     * @returns {void}
     */
    updateHeroShowcase(resetSlides = true) {
      if (!this.catalog || !this.heroSlider) return;
      if (resetSlides) this.heroSlider.setSlidesFromCatalog(this.catalog);
      const featured = this.heroSlider.getCurrentSlide();
      if (featured && !this.activeSeriesId) {
        this.activeSeriesId = featured.id;
        const firstChapter = this.catalog.getSortedChapters(featured.id, 'asc')[0];
        if (!this.activeChapterId && firstChapter) this.activeChapterId = firstChapter.id;
      }
      this.heroSlider.renderIntoDom(
        this.catalog,
        this.library,
        (v, s, c) => this.computeTargetUrl(v, s, c)
      );
      if (resetSlides && typeof document !== 'undefined') {
        this.heroSlider.startAutoPlay(() => this.updateHeroShowcase(false));
      }
    }
    /**
     * Ana sayfadaki Kaldigin Yerden Devam Et, Son Eklenen Bolumler ve Kitaplik sayacini gunceller.
     * @returns {void}
     */
    renderHomeSections() {
      if (typeof document === 'undefined' || !this.library || !this.catalog) return;
      const urlFn = (v, s, c) => this.computeTargetUrl(v, s, c);
      const badgeEl = document.getElementById('bookmarks-count-badge');
      if (badgeEl) {
        const favCount = this.library.getFavoriteIds().length;
        badgeEl.textContent = favCount > 0 ? `(${favCount})` : '';
      }
      const continueSec = document.getElementById('continue-reading-section');
      const continueGrid = document.getElementById('continue-reading-grid');
      if (continueSec && continueGrid) {
        const html = this.library.renderContinueReadingHtml(this.catalog, this.reader, urlFn);
        continueGrid.innerHTML = html;
        continueSec.classList.toggle('hidden', !html);
      }
      const latestSec = document.getElementById('latest-chapters-section');
      const latestGrid = document.getElementById('latest-chapters-grid');
      if (latestSec && latestGrid) {
        const html = this.library.renderLatestChaptersHtml(this.catalog, urlFn, 6);
        latestGrid.innerHTML = html;
        latestSec.classList.toggle('hidden', !html);
      }
      if (this.sidebar) {
        this.sidebar.renderIntoDom(this.catalog, this.library, urlFn);
      }
    }
    /**
     * Ziyaretci dogrudan bir Blogger seri veya bolum URL'sine girdiyse ilgili ekrani acar.
     * @param {string} [currentUrl] - Kontrol edilecek URL.
     * @param {Object} [options={}] - Yonlendirme secenekleri.
     * @returns {boolean} Ozel bir gorunume yonlendirme yapildiysa true.
     */
    handleUrlRouting(currentUrl, options = {}) {
      if (!this.router || !this.catalog) return false;
      const resolved = this.router.resolveUrlRoute(this.catalog, currentUrl);
      const routeOpts = {
        updateHistory: Boolean(options.updateHistory || options.replaceInitialState),
        replace: Boolean(options.replaceInitialState)
      };
      if (resolved.matched) {
        if (resolved.view === 'reader') this.openReader(resolved.seriesId, resolved.chapterId, routeOpts);
        else if (resolved.view === 'series') this.openSeriesDetail(resolved.seriesId, routeOpts);
        else if (resolved.view === 'bookmarks') this.openBookmarks(routeOpts);
        else if (resolved.view === 'history') this.openHistory(routeOpts);
        else if (resolved.view === 'generator') this.openGenerator(routeOpts);
        else return false;
        return true;
      }
      if (options.openCatalogOnRoot) this.openCatalog({ updateHistory: false });
      return false;
    }
    /**
     * Tarayici Geri / Ileri (popstate) olayini isler ve ilgili gorunume gecis yapar.
     * @param {PopStateEvent|Object} [event] - PopState olayi.
     * @returns {void}
     */
    handlePopState(event) {
      const state = event && event.state ? event.state : null;
      if (this.logger) this.logger.info('Tarayici Geri/Ileri (popstate) olayi isleniyor.', { state });
      const noHist = { updateHistory: false };
      if (state && state.view) {
        if (state.view === 'reader' && state.seriesId && state.chapterId) {
          return this.openReader(state.seriesId, state.chapterId, noHist);
        }
        if (state.view === 'series' && state.seriesId) return this.openSeriesDetail(state.seriesId, noHist);
        if (state.view === 'bookmarks') return this.openBookmarks(noHist);
        if (state.view === 'history') return this.openHistory(noHist);
        if (state.view === 'generator') return this.openGenerator(noHist);
        if (state.view === 'catalog') return this.openCatalog(noHist);
      }
      if (!this.handleUrlRouting(undefined, { updateHistory: false, openCatalogOnRoot: true })) {
        this.openCatalog(noHist);
      }
    }
    /**
     * Aktif gorunumu degistirir ('catalog', 'series', 'reader', 'bookmarks', 'history', 'generator').
     * Yorum alanini (#disqus-section) yalnizca 'series' ve 'reader' gorunumlerinde gosterir.
     * @param {string} viewName - Hedef gorunum.
     * @returns {void}
     */
    switchView(viewName) {
      this.currentView = viewName;
      this.commentsVisible = viewName === 'series' || viewName === 'reader';
      if (typeof document === 'undefined') return;
      if (document.body && typeof document.body.setAttribute === 'function') {
        document.body.setAttribute('data-active-view', viewName);
      }
      const views = {
        catalog: document.getElementById('view-catalog'),
        series: document.getElementById('view-series'),
        reader: document.getElementById('view-reader'),
        bookmarks: document.getElementById('view-bookmarks'),
        history: document.getElementById('view-history'),
        generator: document.getElementById('view-generator')
      };
      Object.keys(views).forEach((key) => {
        if (views[key]) views[key].classList.toggle('hidden', key !== viewName);
      });
      const disqusSec = document.getElementById('disqus-section');
      if (disqusSec) disqusSec.classList.toggle('hidden', !this.commentsVisible);
      const navMap = {
        catalog: document.getElementById('nav-catalog'),
        bookmarks: document.getElementById('nav-bookmarks'),
        history: document.getElementById('nav-history'),
        generator: document.getElementById('nav-generator')
      };
      Object.keys(navMap).forEach((key) => {
        if (navMap[key]) navMap[key].classList.toggle('active', key === viewName);
      });
      if (viewName !== 'reader' && this.reader) this.reader.stopAutoScroll();
      const scrollBtn = document.getElementById('btn-scroll-top');
      if (scrollBtn && scrollBtn.classList && viewName === 'reader') {
        scrollBtn.classList.add('hidden');
      }
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      this.renderDebugLogs();
    }
    /**
     * Ana Sayfa (Katalog & Vitrin) gorunumunu acar ve URL'yi ana sayfaya ('/') gunceller.
     * @param {Object} [options={}] - Gecmis secenekleri.
     * @returns {void}
     */
    openCatalog(options = {}) {
      this.switchView('catalog');
      this.renderHomeSections();
      const targetUrl = this.computeTargetUrl('catalog');
      this.syncBrowserHistory(
        { view: 'catalog', seriesId: '', chapterId: '' },
        this.siteBaseTitle,
        targetUrl,
        options
      );
    }
    /**
     * Kullanici Kitapligim (Favorilerim) gorunumunu acar.
     * @param {Object} [options={}] - Gecmis secenekleri.
     * @returns {void}
     */
    openBookmarks(options = {}) {
      this.switchView('bookmarks');
      this.renderBookmarksView();
      const targetUrl = this.computeTargetUrl('bookmarks');
      this.syncBrowserHistory(
        { view: 'bookmarks', seriesId: '', chapterId: '' },
        `Kitaplığım - ${this.siteBaseTitle}`,
        targetUrl,
        options
      );
    }
    /**
     * Kitapligim izgarasini favori serilerle doldurur.
     * @returns {void}
     */
    renderBookmarksView() {
      if (typeof document === 'undefined' || !this.library || !this.catalog) return;
      const grid = document.getElementById('bookmarks-grid');
      if (!grid) return;
      const favSeries = this.library.getFavoriteSeries(this.catalog);
      if (favSeries.length === 0) {
        grid.innerHTML = `<div class="disqus-status-note">Kitaplığınızda henüz favori seri bulunmuyor. Katalogdaki serilerin üzerindeki ${iconFn('heart')} düğmesine tıklayarak kitaplığınıza ekleyebilirsiniz.</div>`;
        return;
      }
      grid.innerHTML = this.library.renderSeriesCardListHtml(
        favSeries,
        this.catalog,
        (v, s, c) => this.computeTargetUrl(v, s, c)
      );
    }
    /**
     * Okuma Gecmisim gorunumunu acar.
     * @param {Object} [options={}] - Gecmis secenekleri.
     * @returns {void}
     */
    openHistory(options = {}) {
      this.switchView('history');
      if (typeof document !== 'undefined' && this.library && this.catalog) {
        const grid = document.getElementById('history-list-grid');
        if (grid) {
          grid.innerHTML = this.library.renderHistoryListHtml(
            this.catalog,
            this.reader,
            (v, s, c) => this.computeTargetUrl(v, s, c)
          );
        }
      }
      const targetUrl = this.computeTargetUrl('history');
      this.syncBrowserHistory(
        { view: 'history', seriesId: '', chapterId: '' },
        `Okuma Geçmişim - ${this.siteBaseTitle}`,
        targetUrl,
        options
      );
    }
    /**
     * Gonderi Olusturucu gorunumunu acar ve URL'yi gunceller.
     * @param {Object} [options={}] - Gecmis secenekleri.
     * @returns {void}
     */
    openGenerator(options = {}) {
      this.switchView('generator');
      this.triggerGenerator('chapter');
      const targetUrl = this.computeTargetUrl('generator');
      this.syncBrowserHistory(
        { view: 'generator', seriesId: '', chapterId: '' },
        `Gönderi Oluşturucu - ${this.siteBaseTitle}`,
        targetUrl,
        options
      );
    }
    /**
     * Katalog izgarasini dinamik serilerle ve gercek Blogger URL baglantilariyla olusturur.
     * @returns {void}
     */
    renderCatalogView() {
      if (typeof document === 'undefined') return;
      const grid = document.getElementById('catalog-grid');
      const countLabel = document.getElementById('catalog-count-label');
      if (!grid || !this.catalog) return;
      const list = this.catalog.getFilteredSeries();
      if (countLabel) countLabel.textContent = `${list.length} Seri Listeleniyor`;
      if (list.length === 0) {
        grid.innerHTML = `<div class="disqus-status-note">Aramanızla eşleşen seri bulunamadı.</div>`;
        return;
      }
      if (this.library) {
        grid.innerHTML = this.library.renderSeriesCardListHtml(
          list,
          this.catalog,
          (v, s, c) => this.computeTargetUrl(v, s, c)
        );
      }
    }
    /**
     * Secilen serinin tanitim ve bolum listesi sayfasini acar, tarayici URL'sini serinin Blogger adresine gunceller.
     * @param {string} seriesId - Seri kimligi.
     * @param {Object} [options={}] - Gecmis guncelleme secenekleri.
     * @returns {void}
     */
    openSeriesDetail(seriesId, options = {}) {
      const series = this.catalog ? this.catalog.getSeriesById(seriesId) : null;
      if (!series) return;
      this.activeSeriesId = series.id;
      this.switchView('series');
      const targetUrl = this.computeTargetUrl('series', series.id);
      const pageTitle = `${series.title} - ${this.siteBaseTitle}`;
      this.syncBrowserHistory(
        { view: 'series', seriesId: series.id, chapterId: '' },
        pageTitle,
        targetUrl,
        options
      );
      this.updateDisqus(`series-${series.id}`, `${series.title} - Seri Yorumları`);
      if (this.seriesPage) {
        this.seriesPage.renderIntoDom(
          series,
          this.catalog,
          this.library,
          this.reader,
          (v, s, c) => this.computeTargetUrl(v, s, c)
        );
      }
    }
    /**
     * Aktif serinin bolum listesini gercek Blogger URL baglantilariyla olusturur.
     * @returns {void}
     */
    renderChapterList() {
      if (this.seriesPage) {
        this.seriesPage.renderChaptersIntoDom(
          this.catalog,
          this.reader,
          (v, s, c) => this.computeTargetUrl(v, s, c)
        );
      }
    }
    /**
     * Secilen bolumu okuma motorunda acar ve tarayici URL'sini bolumun Blogger adresine gunceller.
     * @param {string} seriesId - Seri kimligi.
     * @param {string} chapterId - Bolum kimligi.
     * @param {Object} [options={}] - Gecmis guncelleme secenekleri.
     * @returns {void}
     */
    openReader(seriesId, chapterId, options = {}) {
      const series = this.catalog ? this.catalog.getSeriesById(seriesId) : null;
      if (!series || !Array.isArray(series.chapters) || series.chapters.length === 0) return;
      const chapter =
        series.chapters.find((c) => c.id === chapterId) ||
        this.catalog.getSortedChapters(series.id, 'asc')[0];
      if (!chapter) return;
      this.activeSeriesId = series.id;
      this.activeChapterId = chapter.id;
      this.switchView('reader');
      const targetUrl = this.computeTargetUrl('reader', series.id, chapter.id);
      const pageTitle = `${chapter.title} - ${this.siteBaseTitle}`;
      this.syncBrowserHistory(
        { view: 'reader', seriesId: series.id, chapterId: chapter.id },
        pageTitle,
        targetUrl,
        options
      );
      if (this.reader) {
        const isNovel = Boolean(
          chapter.isNovel || String(series.type || '').toLowerCase() === 'novel'
        );
        this.reader.loadChapter({
          seriesId: series.id,
          chapterId: chapter.id,
          seriesType: series.type || 'Manhwa',
          sourceLang: series.sourceLang || '',
          isNovel,
          pages: chapter.pages,
          htmlContent: chapter.htmlContent || '',
          defaultMode: isNovel ? 'novel' : (series.defaultReaderMode || '')
        });
      }
      this.updateDisqus(`chapter-${chapter.id}`, `${series.title} - ${chapter.title}`);
      if (typeof document === 'undefined') return;
      const seriesHref = this.computeTargetUrl('series', series.id);
      const seriesTitleEl = document.getElementById('reader-series-title');
      const seriesNameEl = document.getElementById('reader-series-name');
      const footerSeriesBtn = document.getElementById('btn-footer-series');
      const chapterTitleEl = document.getElementById('reader-chapter-title');
      const noteBox = document.getElementById('translator-note-box');
      const selectChapter = document.getElementById('select-chapter');
      if (seriesTitleEl) {
        if (seriesNameEl) {
          seriesNameEl.textContent = series.title;
        } else {
          seriesTitleEl.innerHTML = `<span aria-hidden="true" class="reader-back-arrow">←</span> <span class="btn-label" id="reader-series-name">${series.title}</span>`;
        }
        seriesTitleEl.setAttribute('href', seriesHref);
        seriesTitleEl.setAttribute('data-action', 'detail');
        seriesTitleEl.setAttribute('data-series', series.id);
      }
      if (footerSeriesBtn) {
        footerSeriesBtn.setAttribute('href', seriesHref);
        footerSeriesBtn.setAttribute('data-action', 'detail');
        footerSeriesBtn.setAttribute('data-series', series.id);
      }
      if (chapterTitleEl) {
        chapterTitleEl.textContent = this.reader
          ? this.reader.formatChapterSelectLabel(chapter)
          : chapter.title;
      }
      if (noteBox) {
        if (chapter.translatorNote) {
          noteBox.innerHTML = `${iconFn('note')} Çevirmen Notu: ${chapter.translatorNote}`;
          noteBox.classList.remove('hidden');
        } else {
          noteBox.classList.add('hidden');
        }
      }
      const sortedAsc = this.catalog.getSortedChapters(series.id, 'asc');
      const currentChapterIdx = sortedAsc.findIndex((c) => c.id === chapter.id);
      if (selectChapter) {
        selectChapter.innerHTML = sortedAsc
          .map((c) => {
            const label = this.reader ? this.reader.formatChapterSelectLabel(c) : `Bölüm ${c.number}`;
            return `<option value="${c.id}" ${c.id === chapter.id ? 'selected' : ''}>${label}</option>`;
          })
          .join('');
      }
      const hasPrevChapter = currentChapterIdx > 0;
      const hasNextChapter = currentChapterIdx >= 0 && currentChapterIdx < sortedAsc.length - 1;
      ['btn-prev-chapter', 'btn-top-prev-chapter'].forEach((btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.disabled = !hasPrevChapter;
      });
      ['btn-next-chapter', 'btn-top-next-chapter'].forEach((btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.disabled = !hasNextChapter;
      });
      this.syncReaderControls();
      this.renderReaderViewport();
      if (this.readerHud) {
        const chapterLabel = this.reader
          ? this.reader.formatChapterSelectLabel(chapter)
          : chapter.title;
        this.readerHud.syncHudIntoDom(this.reader, {
          chapterLabel,
          hasPrevChapter,
          hasNextChapter,
          seriesHref,
          seriesId: series.id
        });
      }
      this.renderHomeSections();
    }
    /**
     * Okuyucu kontrol cubugunu motor durumuyla esitler.
     * @returns {void}
     */
    syncReaderControls() {
      if (this.reader && typeof this.reader.syncControlsIntoDom === 'function') {
        this.reader.syncControlsIntoDom();
      }
      if (this.readerHud && typeof this.readerHud.syncHudIntoDom === 'function') {
        this.readerHud.syncHudIntoDom(this.reader);
      }
    }
    /**
     * Okuma motoru goruntuleme alanini (viewport) aktif moda gore cizer.
     * @returns {void}
     */
    renderReaderViewport() {
      if (this.reader && typeof this.reader.renderViewportIntoDom === 'function') {
        this.reader.renderViewportIntoDom();
      }
      this.renderDebugLogs();
    }
    /**
     * Onceki veya sonraki bolume gecis yapar.
     * @param {number} delta - Bolum degisim yonu (-1 veya +1).
     * @returns {void}
     */
    navigateChapter(delta) {
      const chapters = this.catalog.getSortedChapters(this.activeSeriesId, 'asc');
      const idx = chapters.findIndex((c) => c.id === this.activeChapterId);
      if (idx >= 0 && idx + delta >= 0 && idx + delta < chapters.length) {
        this.openReader(this.activeSeriesId, chapters[idx + delta].id);
      }
    }
    /**
     * Disqus yorum basligini yalnizca seri ve bolum gorunumlerinde gunceller.
     * @param {string} identifier - Konu kimligi.
     * @param {string} title - Konu basligi.
     * @returns {void}
     */
    updateDisqus(identifier, title) {
      if (!this.commentsVisible || !this.disqus) return;
      const statusEl =
        typeof document !== 'undefined' ? document.getElementById('disqus-status') : null;
      this.disqus.loadThread({ identifier, title }, statusEl);
    }
    /**
     * Gelistirici DEBUG log panelini gunceller.
     * @returns {void}
     */
    renderDebugLogs() {
      if (this.themeBridge) {
        this.themeBridge.renderDebugLogs(this.logger);
      }
    }
    /**
     * Tum kullanici arayuzu olay dinleyicilerini ve tarayici popstate (Geri/Ileri) dinleyicisini baglar.
     * @returns {void}
     */
    bindEvents() {
      if (typeof globalScope.addEventListener === 'function') {
        globalScope.addEventListener('popstate', (ev) => this.handlePopState(ev));
        globalScope.addEventListener('scroll', () => {
          const scrollBtn = document.getElementById('btn-scroll-top');
          if (scrollBtn) {
            const hideScrollTop =
              this.currentView === 'reader' || (globalScope.scrollY || 0) < 350;
            scrollBtn.classList.toggle('hidden', hideScrollTop);
          }
        });
      }
      if (this.heroSlider) this.heroSlider.bindDomEvents(() => this.updateHeroShowcase(false));
      if (this.sidebar) {
        this.sidebar.bindDomEvents({
          onTopFilterChange: () => this.renderHomeSections(),
          onGenreSelect: (genre) => {
            this.catalog.setGenreFilter(genre);
            this.renderCatalogView();
            this.renderHomeSections();
          }
        });
      }
      if (this.seriesPage) {
        this.seriesPage.bindDomEvents({
          onChapterUpdate: () => this.renderChapterList(),
          onGenreSelect: (genre) => {
            this.catalog.setGenreFilter(genre);
            this.openCatalog();
            this.renderCatalogView();
          }
        });
      }
      document.addEventListener('click', (ev) => {
        const target = ev.target.closest('[data-action]');
        if (!target) return;
        if (
          ev.ctrlKey ||
          ev.metaKey ||
          ev.shiftKey ||
          ev.altKey ||
          (typeof ev.button === 'number' && ev.button !== 0)
        ) {
          return;
        }
        ev.preventDefault();
        const action = target.getAttribute('data-action');
        const seriesId = target.getAttribute('data-series');
        const chapterId = target.getAttribute('data-chapter');
        if (action === 'catalog') {
          this.openCatalog();
        } else if (action === 'detail' && seriesId) {
          this.openSeriesDetail(seriesId);
        } else if (action === 'read' && seriesId && chapterId) {
          this.openReader(seriesId, chapterId);
        } else if (action === 'toggle-fav' && seriesId && this.library) {
          this.library.toggleFavorite(seriesId);
          this.renderHomeSections();
          this.updateHeroShowcase(false);
          if (this.currentView === 'catalog') this.renderCatalogView();
          else if (this.currentView === 'bookmarks') this.renderBookmarksView();
          else if (this.currentView === 'series') {
            this.openSeriesDetail(seriesId, { updateHistory: false });
          }
        }
      });
      const on = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
      };
      on('btn-gen-close', 'click', () => this.openCatalog());
      on('nav-generator', 'click', () => this.openGenerator());
      on('nav-bookmarks', 'click', () => this.openBookmarks());
      on('nav-history', 'click', () => this.openHistory());
      on('btn-view-all-history', 'click', () => this.openHistory());
      on('btn-clear-history', 'click', () => {
        if (this.library) this.library.clearHistory();
        this.openHistory({ updateHistory: false });
        this.renderHomeSections();
      });
      on('nav-random', 'click', () => {
        const all = this.catalog.seriesList;
        const pick = all[Math.floor(Math.random() * all.length)];
        if (pick) this.openSeriesDetail(pick.id);
      });
      if (!this.searchController) {
        on('input-search', 'input', (e) => {
          this.catalog.setSearchQuery(e.target.value);
          this.switchToCatalogIfNeeded();
          this.renderCatalogView();
        });
      }
      on('select-catalog-sort', 'change', (e) => {
        this.catalog.setSortOrder(e.target.value);
        this.renderCatalogView();
      });
      const langGroup = document.getElementById('lang-filter-group');
      if (langGroup) {
        langGroup.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-lang]');
          if (!btn) return;
          langGroup.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.catalog.setLanguageFilter(btn.getAttribute('data-lang'));
          this.renderCatalogView();
        });
      }
      on('btn-theme-toggle', 'click', () => {
        if (this.themeBridge) {
          this.themeBridge.toggleThemeMode();
        }
        this.renderDebugLogs();
      });
      if (this.readerHud) {
        this.readerHud.bindDomEvents(this);
      }
      on('btn-scroll-top', 'click', () => {
        if (typeof globalScope.scrollTo === 'function') {
          globalScope.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      document.addEventListener('keydown', (e) => {
        if (
          this.currentView !== 'reader' ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
        ) {
          return;
        }
        const result = this.reader.handleKeyCommand(e.code);
        if (result !== 'none' && result !== 'fullscreen') {
          this.syncReaderControls();
          this.renderReaderViewport();
        }
      });
      const connectBlog = async () => {
        const inp = document.getElementById('input-blog-origin');
        if (inp && this.feedLoader && typeof this.feedLoader.setSavedBlogOrigin === 'function') {
          inp.value = this.feedLoader.setSavedBlogOrigin(inp.value);
          await this.loadDynamicData();
          this.openCatalog();
        }
      };
      on('btn-connect-blog', 'click', connectBlog);
      on('input-blog-origin', 'keydown', (e) => {
        if (e.key === 'Enter') connectBlog();
      });
      on('btn-apply-disqus', 'click', () => {
        const input = document.getElementById('input-disqus-shortname');
        if (input && this.disqus) {
          this.disqus.setShortname(input.value);
          this.updateDisqus(
            this.disqus.currentIdentifier || `series-${this.activeSeriesId}`,
            document.title
          );
          this.renderDebugLogs();
        }
      });
      on('btn-generate-series', 'click', () => this.triggerGenerator('series'));
      on('btn-generate-chapter', 'click', () => this.triggerGenerator('chapter'));
      on('btn-test-generated', 'click', () => this.testGeneratedInReader());
      on('btn-copy-code', 'click', () => {
        const out = document.getElementById('gen-code-output');
        if (out && navigator.clipboard) navigator.clipboard.writeText(out.value);
      });
      on('btn-refresh-logs', 'click', () => this.renderDebugLogs());
    }
    /**
     * Arama sirasinda katalog gorunumunde degilse katalog gorunumune gecer.
     * @returns {void}
     */
    SwitchToCatalogIfNeeded() {
      if (this.currentView !== 'catalog') {
        this.openCatalog();
      }
    }
    /**
     * Gonderi kodu olusturucuyu calistirir.
     * @param {'series'|'chapter'} mode - Olusturma modu.
     * @returns {Object|null} Uretilen kod nesnesi.
     */
    triggerGenerator(mode) {
      if (!this.generator || !this.themeBridge) return null;
      const res = this.themeBridge.runGeneratorFromDom(this.generator, mode);
      this.renderDebugLogs();
      return res;
    }
    /**
     * Olusturucudaki ornek bolumu aninda okuyucuda test eder.
     * @returns {void}
     */
    testGeneratedInReader() {
      const seriesRes = this.triggerGenerator('series');
      const chapterRes = this.triggerGenerator('chapter');
      if (!seriesRes || !chapterRes) return;
      const sObj = seriesRes.seriesObject;
      sObj.chapters = [chapterRes.chapterObject];
      if (chapterRes.chapterObject.pages[0]) {
        sObj.cover = chapterRes.chapterObject.pages[0];
      }
      this.catalog.upsertSeries(sObj);
      this.renderCatalogView();
      this.openReader(sObj.id, chapterRes.chapterObject.id);
    }
  }
  globalScope.AppController = AppController;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const app = new AppController();
      globalScope.ManowaApp = app;
      app.initDom();
    });
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppController };
  }
})(typeof window !== 'undefined' ? window : globalThis);
