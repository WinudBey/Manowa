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
      this.disqus =
        deps.disqus || (globalScope.DisqusLoader ? new globalScope.DisqusLoader() : null);
      this.generator =
        deps.generator || (globalScope.PostGenerator ? new globalScope.PostGenerator() : null);
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
      this.siteBaseTitle = 'Manhwa Arşiv';
      this.currentView = 'catalog';
      this.activeSeriesId = '';
      this.activeChapterId = '';
      this.chapterSortOrder = 'desc';
    }
    /**
     * Tarayici DOM baslatmasini, ust baslik entegrasyonunu ve dinamik Blogger veri cekimini calistirir.
     * @returns {Promise<void>}
     */
    async initDom() {
      if (typeof document === 'undefined') return;
      if (document.title) {
        this.siteBaseTitle = document.title.split(' - ')[0].trim() || 'Manhwa Arşiv';
      }
      this.integrateHeaderBar();
      this.bindEvents();
      await this.loadDynamicData();
      this.renderDebugLogs();
    }
    /**
     * Ust kontrol cubugunu (#top-app-bar) Blogger site basliginin (#site-header-inner) icine tasir.
     * @returns {void}
     */
    integrateHeaderBar() {
      if (typeof document === 'undefined') return;
      const headerInner =
        document.getElementById('site-header-inner') ||
        document.querySelector('.site-header .header-inner');
      const topAppBar = document.getElementById('top-app-bar');
      if (headerInner && topAppBar && topAppBar.parentElement !== headerInner) {
        topAppBar.classList.add('in-header');
        headerInner.appendChild(topAppBar);
      }
    }
    /**
     * Hedef gorunum icin Blogger URL'sini uretir.
     * @param {'catalog'|'series'|'reader'|'generator'} viewName - Hedef gorunum.
     * @param {string} [seriesId=''] - Seri kimligi.
     * @param {string} [chapterId=''] - Bolum kimligi.
     * @returns {string} Hedef URL.
     */
    computeTargetUrl(viewName, seriesId = '', chapterId = '') {
      if (!this.router) return '/';
      return this.router.computeTargetUrl(this.catalog, viewName, seriesId, chapterId);
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
      if (this.router) {
        this.router.syncBrowserHistory(stateObj, pageTitle, targetUrl, options);
      }
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
      if (loadedCount === 0) {
        loadedCount = this.ingestBloggerPostsFromDom();
      }
      const firstSeries =
        this.catalog && this.catalog.seriesList.length > 0 ? this.catalog.seriesList[0] : null;
      if (firstSeries) {
        this.activeSeriesId = firstSeries.id;
        const firstCh = this.catalog.getSortedChapters(firstSeries.id, 'asc')[0];
        this.activeChapterId = firstCh ? firstCh.id : '';
      }
      this.updateHeroShowcase();
      this.renderCatalogView();
      const routed = this.handleUrlRouting(undefined, {
        updateHistory: false,
        replaceInitialState: true
      });
      if (!routed) {
        const homeUrl = this.computeTargetUrl('catalog');
        this.syncBrowserHistory(
          { view: 'catalog', seriesId: '', chapterId: '' },
          this.siteBaseTitle,
          homeUrl,
          { updateHistory: true, replace: true }
        );
        this.updateDisqus('manowa-home', this.siteBaseTitle);
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
      let count = 0;
      const seriesNodes = document.querySelectorAll('.manowa-series-post');
      seriesNodes.forEach((node) => {
        const id = node.getAttribute('data-series-id');
        if (!id) return;
        const existing = this.catalog.getSeriesById(id);
        this.catalog.upsertSeries({
          id,
          title: node.getAttribute('data-title') || id,
          altTitle: node.getAttribute('data-alt-title') || '',
          sourceLang: node.getAttribute('data-source-lang') || 'KR',
          type: node.getAttribute('data-type') || 'Manhwa',
          defaultReaderMode: node.getAttribute('data-reader-mode') || 'webtoon',
          status: node.getAttribute('data-status') || 'Devam Ediyor',
          translator: node.getAttribute('data-translator') || 'Manhwa Arşiv',
          rating: '9.6',
          genres: (node.getAttribute('data-genres') || 'Aksiyon').split(',').map((s) => s.trim()),
          cover: node.getAttribute('data-cover') || '',
          synopsis: node.textContent.trim(),
          chapters: existing ? existing.chapters : []
        });
        count++;
      });
      return count;
    }
    /**
     * Ana sayfadaki Hero (Vitrin) alanini katalogdaki ilk gercek seriyle dinamik gunceller.
     * @returns {void}
     */
    updateHeroShowcase() {
      if (typeof document === 'undefined' || !this.catalog) return;
      const featured =
        this.catalog.seriesList.find((s) => s.chapters && s.chapters.length > 0) ||
        this.catalog.seriesList[0];
      if (!featured) return;
      if (!this.activeSeriesId) this.activeSeriesId = featured.id;
      const firstChapter = this.catalog.getSortedChapters(featured.id, 'asc')[0];
      if (!this.activeChapterId && firstChapter) this.activeChapterId = firstChapter.id;
      const badgeEl = document.getElementById('hero-badge');
      const titleEl = document.getElementById('hero-title');
      const descEl = document.getElementById('hero-desc');
      const coverEl = document.getElementById('hero-cover-img');
      const readBtn = document.getElementById('btn-hero-read');
      const detailBtn = document.getElementById('btn-hero-detail');
      if (badgeEl) {
        badgeEl.textContent = `🔥 ${featured.type || 'Seri'} • ${featured.status || 'Güncel'} • ${(featured.chapters || []).length} Bölüm`;
      }
      if (titleEl) titleEl.textContent = featured.title;
      if (descEl) descEl.textContent = featured.synopsis || `${featured.title} serisini hemen okuyun.`;
      if (coverEl && featured.cover) {
        coverEl.src = featured.cover;
        coverEl.alt = featured.title;
        coverEl.classList.remove('hidden');
      }
      if (detailBtn) {
        detailBtn.setAttribute('href', this.computeTargetUrl('series', featured.id));
        detailBtn.setAttribute('data-action', 'detail');
        detailBtn.setAttribute('data-series', featured.id);
      }
      if (readBtn) {
        if (firstChapter) {
          readBtn.setAttribute('href', this.computeTargetUrl('reader', featured.id, firstChapter.id));
          readBtn.setAttribute('data-action', 'read');
          readBtn.setAttribute('data-series', featured.id);
          readBtn.setAttribute('data-chapter', firstChapter.id);
        } else {
          readBtn.setAttribute('href', this.computeTargetUrl('series', featured.id));
          readBtn.setAttribute('data-action', 'detail');
          readBtn.setAttribute('data-series', featured.id);
        }
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
        if (resolved.view === 'reader') {
          this.openReader(resolved.seriesId, resolved.chapterId, routeOpts);
          return true;
        }
        if (resolved.view === 'series') {
          this.openSeriesDetail(resolved.seriesId, routeOpts);
          return true;
        }
        if (resolved.view === 'generator') {
          this.openGenerator(routeOpts);
          return true;
        }
      }
      if (options.openCatalogOnRoot) {
        this.openCatalog({ updateHistory: false });
      }
      return false;
    }
    /**
     * Tarayici Geri / Ileri (popstate) olayini isler ve ilgili gorunume gecis yapar.
     * @param {PopStateEvent|Object} [event] - PopState olayi.
     * @returns {void}
     */
    handlePopState(event) {
      const state = event && event.state ? event.state : null;
      if (this.logger) {
        this.logger.info('Tarayici Geri/Ileri (popstate) olayi isleniyor.', { state });
      }
      if (state && state.view) {
        if (state.view === 'reader' && state.seriesId && state.chapterId) {
          this.openReader(state.seriesId, state.chapterId, { updateHistory: false });
          return;
        }
        if (state.view === 'series' && state.seriesId) {
          this.openSeriesDetail(state.seriesId, { updateHistory: false });
          return;
        }
        if (state.view === 'generator') {
          this.openGenerator({ updateHistory: false });
          return;
        }
        if (state.view === 'catalog') {
          this.openCatalog({ updateHistory: false });
          return;
        }
      }
      const routed = this.handleUrlRouting(undefined, {
        updateHistory: false,
        openCatalogOnRoot: true
      });
      if (!routed) {
        this.openCatalog({ updateHistory: false });
      }
    }
    /**
     * Aktif gorunumu degistirir ('catalog', 'series', 'reader', 'generator').
     * @param {string} viewName - Hedef gorunum.
     * @returns {void}
     */
    switchView(viewName) {
      this.currentView = viewName;
      if (typeof document === 'undefined') return;
      const views = {
        catalog: document.getElementById('view-catalog'),
        series: document.getElementById('view-series'),
        reader: document.getElementById('view-reader'),
        generator: document.getElementById('view-generator')
      };
      Object.keys(views).forEach((key) => {
        if (views[key]) views[key].classList.toggle('hidden', key !== viewName);
      });
      const navCatalog = document.getElementById('nav-catalog');
      const navGen = document.getElementById('nav-generator');
      if (navCatalog) navCatalog.classList.toggle('active', viewName === 'catalog');
      if (navGen) navGen.classList.toggle('active', viewName === 'generator');
      if (viewName !== 'reader' && this.reader) this.reader.stopAutoScroll();
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
      const targetUrl = this.computeTargetUrl('catalog');
      this.syncBrowserHistory(
        { view: 'catalog', seriesId: '', chapterId: '' },
        this.siteBaseTitle,
        targetUrl,
        options
      );
      this.updateDisqus('manowa-home', this.siteBaseTitle);
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
      grid.innerHTML = list
        .map((series) => {
          const seriesHref = this.computeTargetUrl('series', series.id);
          const latestChapters = this.catalog.getSortedChapters(series.id, 'desc').slice(0, 2);
          const chaptersHtml =
            latestChapters.length > 0
              ? latestChapters
                  .map((ch) => {
                    const chHref = this.computeTargetUrl('reader', series.id, ch.id);
                    return (
                      `<a class="chapter-mini-btn" href="${chHref}" data-action="read" data-series="${series.id}" data-chapter="${ch.id}">` +
                      `<span>Bölüm ${ch.number}</span><span>${ch.date}</span></a>`
                    );
                  })
                  .join('')
              : `<a class="chapter-mini-btn" href="${seriesHref}" data-action="detail" data-series="${series.id}"><span>Seri Sayfası</span><span>Detay</span></a>`;
          return `<article class="series-card">
            <a class="card-cover-wrap" href="${seriesHref}" data-action="detail" data-series="${series.id}">
              <img class="card-cover" src="${series.cover}" alt="${series.title}" loading="lazy" />
              <span class="lang-badge lang-${series.sourceLang}">${series.sourceLang}</span>
              <span class="type-badge">${series.type}</span>
            </a>
            <div class="card-body">
              <a class="card-title" href="${seriesHref}" data-action="detail" data-series="${series.id}">${series.title}</a>
              <div class="card-meta">
                <span>📚 ${(series.chapters || []).length} Bölüm</span>
                <span>${series.status}</span>
              </div>
              <div class="card-chapters">${chaptersHtml}</div>
            </div>
          </article>`;
        })
        .join('');
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
      if (typeof document === 'undefined') return;
      const breadcrumbTitle = document.getElementById('series-breadcrumb-title');
      if (breadcrumbTitle) breadcrumbTitle.textContent = series.title;
      const detailBox = document.getElementById('series-detail-box');
      const savedProgress = this.reader ? this.reader.getProgress(series.id) : null;
      const sortedAsc = this.catalog.getSortedChapters(series.id, 'asc');
      const firstChapter = sortedAsc[0];
      const latestChapter = sortedAsc[sortedAsc.length - 1];
      const resumeChapterId = savedProgress
        ? savedProgress.chapterId
        : firstChapter
          ? firstChapter.id
          : '';
      if (detailBox) {
        const genresHtml = (series.genres || [])
          .map((g) => `<span class="meta-tag">${g}</span>`)
          .join('');
        const firstHref = firstChapter
          ? this.computeTargetUrl('reader', series.id, firstChapter.id)
          : '#';
        const latestHref = latestChapter
          ? this.computeTargetUrl('reader', series.id, latestChapter.id)
          : '#';
        const resumeHref = resumeChapterId
          ? this.computeTargetUrl('reader', series.id, resumeChapterId)
          : '#';
        detailBox.innerHTML = `<div class="series-detail-header">
          <img class="detail-cover" src="${series.cover}" alt="${series.title}" />
          <div class="detail-info">
            <h1>${series.title}</h1>
            <div class="detail-alt-title">${series.altTitle || ''}</div>
            <div class="detail-badges">
              <span class="meta-tag">Tür: ${series.type}</span>
              <span class="meta-tag">Durum: ${series.status}</span>
              <span class="meta-tag">Motor: ${(series.defaultReaderMode || 'webtoon').toUpperCase()}</span>
              ${series.year ? `<span class="meta-tag">Yıl: ${series.year}</span>` : ''}
              ${genresHtml}
            </div>
            <p class="detail-synopsis">${series.synopsis}</p>
            <div class="detail-actions">
              ${firstChapter ? `<a class="primary-btn" href="${firstHref}" data-action="read" data-series="${series.id}" data-chapter="${firstChapter.id}">📖 İlk Bölümü Oku (Bölüm ${firstChapter.number})</a>` : ''}
              ${latestChapter && latestChapter.id !== (firstChapter && firstChapter.id) ? `<a class="icon-btn" href="${latestHref}" data-action="read" data-series="${series.id}" data-chapter="${latestChapter.id}">🔥 Son Bölüm (Bölüm ${latestChapter.number})</a>` : ''}
              ${savedProgress && resumeChapterId ? `<a class="icon-btn" href="${resumeHref}" data-action="read" data-series="${series.id}" data-chapter="${resumeChapterId}">⏳ Kaldığım Yerden Devam Et (Sayfa ${savedProgress.pageIndex + 1})</a>` : ''}
            </div>
          </div>
        </div>`;
      }
      this.renderChapterList();
      this.updateDisqus(`series-${series.id}`, `${series.title} - Seri Yorumları`);
    }
    /**
     * Aktif serinin bolum listesini gercek Blogger URL baglantilariyla olusturur.
     * @returns {void}
     */
    renderChapterList() {
      if (typeof document === 'undefined') return;
      const listGrid = document.getElementById('chapter-list-grid');
      if (!listGrid || !this.catalog) return;
      const chapters = this.catalog.getSortedChapters(this.activeSeriesId, this.chapterSortOrder);
      const saved = this.reader ? this.reader.getProgress(this.activeSeriesId) : null;
      if (chapters.length === 0) {
        listGrid.innerHTML = `<div class="disqus-status-note">Bu seri için henüz bölüm eklenmemiş.</div>`;
        return;
      }
      listGrid.innerHTML = chapters
        .map((ch) => {
          const isRead = saved && saved.chapterId === ch.id;
          const chHref = this.computeTargetUrl('reader', this.activeSeriesId, ch.id);
          return `<a class="chapter-item-btn ${isRead ? 'is-read' : ''}" href="${chHref}" data-action="read" data-series="${this.activeSeriesId}" data-chapter="${ch.id}">
            <span><strong>Bölüm ${ch.number}</strong> - ${ch.title}</span>
            <span style="font-size: 0.78rem; color: var(--text-secondary);">${isRead ? '✓ Okundu' : ch.date}</span>
          </a>`;
        })
        .join('');
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
        this.reader.setDirection(series.sourceLang === 'JP' ? 'rtl' : 'ltr');
        this.reader.loadChapter({
          seriesId: series.id,
          chapterId: chapter.id,
          pages: chapter.pages,
          htmlContent: chapter.htmlContent || '',
          defaultMode: chapter.isNovel ? 'novel' : (series.defaultReaderMode || 'webtoon')
        });
      }
      if (typeof document === 'undefined') return;
      const seriesHref = this.computeTargetUrl('series', series.id);
      const seriesTitleEl = document.getElementById('reader-series-title');
      const footerSeriesBtn = document.getElementById('btn-footer-series');
      const chapterTitleEl = document.getElementById('reader-chapter-title');
      const noteBox = document.getElementById('translator-note-box');
      const selectChapter = document.getElementById('select-chapter');
      if (seriesTitleEl) {
        seriesTitleEl.textContent = `← ${series.title}`;
        seriesTitleEl.setAttribute('href', seriesHref);
        seriesTitleEl.setAttribute('data-action', 'detail');
        seriesTitleEl.setAttribute('data-series', series.id);
      }
      if (footerSeriesBtn) {
        footerSeriesBtn.setAttribute('href', seriesHref);
        footerSeriesBtn.setAttribute('data-action', 'detail');
        footerSeriesBtn.setAttribute('data-series', series.id);
      }
      if (chapterTitleEl) chapterTitleEl.textContent = chapter.title;
      if (noteBox) {
        if (chapter.translatorNote) {
          noteBox.textContent = `📝 Çevirmen Notu: ${chapter.translatorNote}`;
          noteBox.classList.remove('hidden');
        } else {
          noteBox.classList.add('hidden');
        }
      }
      if (selectChapter) {
        const sortedAsc = this.catalog.getSortedChapters(series.id, 'asc');
        selectChapter.innerHTML = sortedAsc
          .map(
            (c) =>
              `<option value="${c.id}" ${c.id === chapter.id ? 'selected' : ''}>Bölüm ${c.number}: ${c.title}</option>`
          )
          .join('');
      }
      this.syncReaderControls();
      this.renderReaderViewport();
      this.updateDisqus(`chapter-${chapter.id}`, `${series.title} - ${chapter.title}`);
    }
    /**
     * Okuyucu kontrol cubugunu motor durumuyla esitler.
     * @returns {void}
     */
    syncReaderControls() {
      if (typeof document === 'undefined' || !this.reader) return;
      const state = this.reader.getState();
      const modeSelect = document.getElementById('select-mode');
      const dirSelect = document.getElementById('select-direction');
      const gapSelect = document.getElementById('select-gap');
      const zoomLabel = document.getElementById('zoom-label');
      if (modeSelect) modeSelect.value = state.mode;
      if (dirSelect) dirSelect.value = state.direction;
      if (gapSelect) gapSelect.value = String(state.gap);
      if (zoomLabel) zoomLabel.textContent = `${state.zoom}%`;
    }
    /**
     * Okuma motoru goruntuleme alanini (viewport) aktif moda gore cizer.
     * @returns {void}
     */
    renderReaderViewport() {
      if (typeof document === 'undefined') return;
      const viewport = document.getElementById('reader-viewport');
      const progressBar = document.getElementById('reader-progress-bar');
      const pageCounter = document.getElementById('page-counter');
      if (!viewport || !this.reader) return;
      const state = this.reader.getState();
      viewport.className = `reader-viewport mode-${state.mode} ${state.protectImages ? 'protect-images' : ''}`;
      viewport.style.setProperty('--reader-zoom', `${Math.round((state.zoom / 100) * 800)}px`);
      viewport.style.setProperty('--page-gap', `${state.gap}px`);
      if (state.mode === 'novel' || (state.totalPages === 0 && this.reader.htmlContent)) {
        viewport.innerHTML = `<article class="novel-content-box">${this.reader.htmlContent}</article>`;
      } else if (state.mode === 'double') {
        const imgs = state.visibleIndices
          .map(
            (idx) =>
              `<img class="reader-page-item" src="${this.reader.pages[idx]}" alt="Sayfa ${idx + 1}" />`
          )
          .join('');
        viewport.innerHTML = `<div class="double-page-grid">${imgs}</div>`;
      } else {
        viewport.innerHTML = state.visibleIndices
          .map(
            (idx) =>
              `<img class="reader-page-item" src="${this.reader.pages[idx]}" alt="Sayfa ${idx + 1}" loading="lazy" />`
          )
          .join('');
      }
      if (progressBar) progressBar.style.width = `${state.progressPercent}%`;
      if (pageCounter) {
        if (state.mode === 'novel') {
          pageCounter.textContent = 'Novel Metin Modu';
        } else if (state.mode === 'webtoon') {
          pageCounter.textContent = `Webtoon Şerit (${state.totalPages} Sayfa)`;
        } else {
          pageCounter.textContent = `Sayfa ${state.currentIndex + 1} / ${state.totalPages}`;
        }
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
     * Disqus yorum basligini gunceller.
     * @param {string} identifier - Konu kimligi.
     * @param {string} title - Konu basligi.
     * @returns {void}
     */
    updateDisqus(identifier, title) {
      if (typeof document === 'undefined' || !this.disqus) return;
      const statusEl = document.getElementById('disqus-status');
      this.disqus.loadThread({ identifier, title }, statusEl);
    }
    /**
     * Gelistirici DEBUG log panelini gunceller.
     * @returns {void}
     */
    renderDebugLogs() {
      if (typeof document === 'undefined') return;
      const listEl = document.getElementById('debug-log-list');
      if (!listEl || !this.logger || typeof this.logger.getEntries !== 'function') return;
      const entries = this.logger.getEntries().slice(-15).reverse();
      listEl.innerHTML = entries
        .map((e) => `<div>[${e.timestamp}] <strong>[${e.level}]</strong> ${e.message}</div>`)
        .join('');
    }
    /**
     * Tum kullanici arayuzu olay dinleyicilerini ve tarayici popstate (Geri/Ileri) dinleyicisini baglar.
     * @returns {void}
     */
    bindEvents() {
      if (typeof globalScope.addEventListener === 'function') {
        globalScope.addEventListener('popstate', (ev) => this.handlePopState(ev));
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
        }
      });
      const on = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
      };
      on('btn-gen-close', 'click', () => this.openCatalog());
      on('nav-generator', 'click', () => this.openGenerator());
      on('nav-random', 'click', () => {
        const all = this.catalog.seriesList;
        const pick = all[Math.floor(Math.random() * all.length)];
        if (pick) this.openSeriesDetail(pick.id);
      });
      on('input-search', 'input', (e) => {
        this.catalog.setSearchQuery(e.target.value);
        this.SwitchToCatalogIfNeeded();
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
        const html = document.documentElement;
        const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', next);
        if (this.logger) this.logger.info('Tema modu degistirildi.', { theme: next });
        this.renderDebugLogs();
      });
      on('btn-sort-chapters', 'click', (e) => {
        this.chapterSortOrder = this.chapterSortOrder === 'desc' ? 'asc' : 'desc';
        e.target.textContent =
          this.chapterSortOrder === 'desc'
            ? '⇅ Sıralama: Yeni → Eski'
            : '⇅ Sıralama: Eski → Yeni';
        this.renderChapterList();
      });
      on('select-chapter', 'change', (e) => this.openReader(this.activeSeriesId, e.target.value));
      on('select-mode', 'change', (e) => {
        this.reader.setMode(e.target.value);
        this.renderReaderViewport();
      });
      on('select-direction', 'change', (e) => {
        this.reader.setDirection(e.target.value);
        this.renderReaderViewport();
      });
      on('select-gap', 'change', (e) => {
        this.reader.setGap(Number(e.target.value));
        this.renderReaderViewport();
      });
      on('btn-zoom-in', 'click', () => {
        this.reader.setZoom(this.reader.zoom + 15);
        this.syncReaderControls();
        this.renderReaderViewport();
      });
      on('btn-zoom-out', 'click', () => {
        this.reader.setZoom(this.reader.zoom - 15);
        this.syncReaderControls();
        this.renderReaderViewport();
      });
      on('btn-autoscroll', 'click', (e) => {
        const active = this.reader.toggleAutoScroll();
        e.target.classList.toggle('active', active);
        e.target.textContent = active ? '⏸ Durdur' : '▶️ Oto-Kaydır';
      });
      on('btn-protect', 'click', (e) => {
        this.reader.protectImages = !this.reader.protectImages;
        e.target.classList.toggle('active', this.reader.protectImages);
        this.renderReaderViewport();
      });
      on('btn-fullscreen', 'click', () => {
        const wrap = document.getElementById('reader-wrapper');
        if (wrap && wrap.requestFullscreen) {
          if (!document.fullscreenElement) wrap.requestFullscreen();
          else document.exitFullscreen();
        }
      });
      on('btn-next-page', 'click', () => {
        if (this.reader.nextPage()) this.renderReaderViewport();
      });
      on('btn-prev-page', 'click', () => {
        if (this.reader.prevPage()) this.renderReaderViewport();
      });
      on('btn-next-chapter', 'click', () => this.navigateChapter(1));
      on('btn-prev-chapter', 'click', () => this.navigateChapter(-1));
      document.addEventListener('keydown', (e) => {
        if (
          this.currentView !== 'reader' ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
        ) {
          return;
        }
        const result = this.reader.handleKeyCommand(e.code);
        if (result !== 'none') {
          this.syncReaderControls();
          this.renderReaderViewport();
        }
      });
      on('btn-apply-disqus', 'click', () => {
        const input = document.getElementById('input-disqus-shortname');
        if (input && this.disqus) {
          this.disqus.setShortname(input.value);
          this.updateDisqus(this.disqus.currentIdentifier || 'manowa-home', document.title);
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
      if (!this.generator) return null;
      const title = (document.getElementById('gen-series-title') || {}).value || 'Yeni Seri';
      const sourceLang = (document.getElementById('gen-source-lang') || {}).value || 'KR';
      const chapterNumber = (document.getElementById('gen-chapter-num') || {}).value || 1;
      const readerMode = (document.getElementById('gen-reader-mode') || {}).value || 'webtoon';
      const translatorNote = (document.getElementById('gen-translator-note') || {}).value || '';
      const pages = (document.getElementById('gen-pages-input') || {}).value || '';
      const res =
        mode === 'series'
          ? this.generator.generateSeriesPost({
              title,
              sourceLang,
              defaultReaderMode: readerMode
            })
          : this.generator.generateChapterPost({
              seriesTitle: title,
              chapterNumber,
              readerMode,
              translatorNote,
              pages
            });
      const outEl = document.getElementById('gen-code-output');
      const labelsEl = document.getElementById('gen-labels-info');
      if (outEl) outEl.value = res.html;
      if (labelsEl) labelsEl.textContent = `Önerilen Blogger Etiketleri: ${res.labels}`;
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
