/**
 * @fileoverview Blogger Tema Ozellestiricisi (Theme Designer), kalici Koyu/Acik tema modu,
 * ust baslik cubugu, Yan Panel (Sidebar) Gadget yerlesimi ve gelistirici araci koprusu.
 */

(function (globalScope) {
  'use strict';

  /**
   * Kullanicinin sectigi tema modunu saklamak icin kullanilan localStorage anahtari.
   * @type {string}
   */
  const THEME_STORAGE_KEY = 'manowa_theme_mode';

  /**
   * Blogger XML sablonu ile onyuz bilesenlerini birbirine baglayan kopru sinifi.
   */
  class BloggerThemeBridge {
    /**
     * BloggerThemeBridge nesnesini yapilandirir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     * @param {Object} [options.logger] - Kullanilacak logger nesnesi.
     * @param {Object} [options.storage] - Ozellestirilmis depolama nesnesi (testler icin).
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.storage =
        options.storage ||
        (typeof globalScope.localStorage !== 'undefined' ? globalScope.localStorage : null);
    }

    /**
     * Tema modunu ('dark' veya 'light') gecerli formata normalize eder.
     * @param {string} rawMode - Ham tema modu degeri.
     * @returns {'dark'|'light'} Normalize edilmis tema modu.
     */
    normalizeThemeMode(rawMode) {
      const cleaned = String(rawMode || '')
        .trim()
        .toLowerCase();
      return cleaned === 'light' ? 'light' : 'dark';
    }

    /**
     * Kullanicinin localStorage uzerinde kayitli tema tercihini okur.
     * @returns {'dark'|'light'|null} Kayitli tema modu veya yoksa null.
     */
    getSavedThemeMode() {
      if (!this.storage || typeof this.storage.getItem !== 'function') {
        return null;
      }
      try {
        const saved = this.storage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          return saved;
        }
      } catch (_err) {
        // Gizli sekme veya depolama erisim engeli durumunda sessizce gec
      }
      return null;
    }

    /**
     * Kullanicinin tema modu tercihini localStorage uzerine kaydeder.
     * @param {'dark'|'light'} mode - Kaydedilecek tema modu.
     * @returns {boolean} Kayit basariliysa true.
     */
    saveThemeMode(mode) {
      const normalized = this.normalizeThemeMode(mode);
      if (!this.storage || typeof this.storage.setItem !== 'function') {
        return false;
      }
      try {
        this.storage.setItem(THEME_STORAGE_KEY, normalized);
        return true;
      } catch (_err) {
        return false;
      }
    }

    /**
     * Blogger Yerlesim (Layout) yapilandirma widget'indan metin degerini okur ve temizler.
     * @param {string} elementId - Hedef DOM eleman kimligi.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {string} Temizlenmis metin degeri.
     */
    readLayoutWidgetText(elementId, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || typeof targetDoc.getElementById !== 'function') {
        return '';
      }
      const el = targetDoc.getElementById(elementId);
      if (!el) {
        return '';
      }
      const raw =
        typeof el.textContent === 'string'
          ? el.textContent
          : String(el.innerHTML || '').replace(/<[^>]*>/g, '');
      return raw.trim();
    }

    /**
     * Blogger Yerlesim widget'indan (#blogger-cfg-theme-mode), <meta id="manowa-theme-mode-meta">
     * etiketinden veya <html> uzerinden varsayilan tema modunu cozumler.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {'dark'|'light'} Varsayilan tema modu.
     */
    resolveDefaultThemeMode(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc) {
        return 'dark';
      }
      const widgetMode = this.readLayoutWidgetText('blogger-cfg-theme-mode', targetDoc);
      if (widgetMode) {
        return this.normalizeThemeMode(widgetMode);
      }
      const metaEl =
        typeof targetDoc.getElementById === 'function'
          ? targetDoc.getElementById('manowa-theme-mode-meta')
          : null;
      const metaContent =
        metaEl && typeof metaEl.getAttribute === 'function'
          ? metaEl.getAttribute('content')
          : '';
      if (metaContent && metaContent.trim()) {
        return this.normalizeThemeMode(metaContent);
      }
      const htmlEl = targetDoc.documentElement;
      const htmlAttr =
        htmlEl && typeof htmlEl.getAttribute === 'function'
          ? htmlEl.getAttribute('data-theme')
          : '';
      return this.normalizeThemeMode(htmlAttr || 'dark');
    }

    /**
     * Blogger Yerlesim (Layout) ekranindaki Tema Degiskenleri widget'larini
     * (Disqus Shortname, Hero Gecis Suresi, Alt Bilgi Slogani, Ekibe Katil ve Discord Linkleri) okur ve uygular.
     * @param {Object} [targets={}] - Hedef denetleyiciler ({ disqus, heroSlider }).
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {{ disqusShortname: string, themeMode: string, heroIntervalMs: number, footerText: string, recruitUrl: string, discordUrl: string }} Uygulanan degerler.
     */
    applyLayoutConfigWidgets(targets = {}, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      const disqusShortname = this.readLayoutWidgetText('blogger-cfg-disqus', targetDoc);
      if (disqusShortname && targets.disqus && typeof targets.disqus.setShortname === 'function') {
        targets.disqus.setShortname(disqusShortname);
      }

      const intervalRaw = this.readLayoutWidgetText('blogger-cfg-hero-interval', targetDoc);
      const parsedInterval = Number(intervalRaw);
      const heroIntervalMs =
        Number.isFinite(parsedInterval) && parsedInterval >= 1000 ? parsedInterval : 6000;
      if (targets.heroSlider && Number.isFinite(parsedInterval) && parsedInterval >= 1000) {
        targets.heroSlider.intervalMs = heroIntervalMs;
      }

      const footerText = this.readLayoutWidgetText('blogger-cfg-footer-text', targetDoc);
      if (footerText && targetDoc && typeof targetDoc.getElementById === 'function') {
        const sloganEl = targetDoc.getElementById('footer-slogan-text');
        if (sloganEl) {
          sloganEl.textContent = footerText;
        }
      }

      const applyBannerHref = (bannerId, rawUrl) => {
        if (!rawUrl || !targetDoc || typeof targetDoc.getElementById !== 'function') return;
        const bannerEl = targetDoc.getElementById(bannerId);
        if (!bannerEl) return;
        if (typeof bannerEl.setAttribute === 'function') {
          bannerEl.setAttribute('href', rawUrl);
          if (/^https?:\/\//i.test(rawUrl)) {
            bannerEl.setAttribute('target', '_blank');
            bannerEl.setAttribute('rel', 'noopener noreferrer');
          }
        } else {
          bannerEl.href = rawUrl;
        }
      };

      const recruitUrl = this.readLayoutWidgetText('blogger-cfg-recruit-url', targetDoc);
      applyBannerHref('banner-join-team', recruitUrl);

      const discordUrl = this.readLayoutWidgetText('blogger-cfg-discord-url', targetDoc);
      applyBannerHref('banner-join-discord', discordUrl);

      return {
        disqusShortname,
        themeMode: this.resolveDefaultThemeMode(targetDoc),
        heroIntervalMs,
        footerText,
        recruitUrl,
        discordUrl
      };
    }

    /**
     * Belirtilen tema modunu <html> etiketine uygular.
     * @param {'dark'|'light'} mode - Uygulanacak tema modu.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {'dark'|'light'} Uygulanan tema modu.
     */
    applyThemeMode(mode, doc) {
      const normalized = this.normalizeThemeMode(mode);
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (targetDoc && targetDoc.documentElement) {
        targetDoc.documentElement.setAttribute('data-theme', normalized);
      }
      if (this.logger && typeof this.logger.debug === 'function') {
        this.logger.debug('Blogger tema modu uygulandi.', { theme: normalized });
      }
      return normalized;
    }

    /**
     * Baslangic tema modunu (once localStorage, yoksa Blogger Özelleştirici varsayilani) yukler.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {'dark'|'light'} Baslatilan tema modu.
     */
    initThemeMode(doc) {
      const savedMode = this.getSavedThemeMode();
      const initialMode = savedMode || this.resolveDefaultThemeMode(doc);
      return this.applyThemeMode(initialMode, doc);
    }

    /**
     * Koyu ve Acik tema arasinda gecis yapar ve secimi kalici olarak kaydeder.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {'dark'|'light'} Yeni aktif tema modu.
     */
    toggleThemeMode(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      const htmlEl = targetDoc ? targetDoc.documentElement : null;
      const current =
        htmlEl && typeof htmlEl.getAttribute === 'function'
          ? htmlEl.getAttribute('data-theme')
          : 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      this.applyThemeMode(next, targetDoc);
      this.saveThemeMode(next);
      if (this.logger && typeof this.logger.info === 'function') {
        this.logger.info('Tema modu degistirildi.', { theme: next });
      }
      return next;
    }

    /**
     * Ust kontrol cubugunu (#top-app-bar) Blogger site basliginin (#site-header-inner) icine tasir.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {boolean} Tasima islemi yapildiysa true.
     */
    integrateHeaderBar(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc) return false;
      const headerInner =
        targetDoc.getElementById('site-header-inner') ||
        (typeof targetDoc.querySelector === 'function'
          ? targetDoc.querySelector('.site-header .header-inner')
          : null);
      const topAppBar = targetDoc.getElementById('top-app-bar');
      if (headerInner && topAppBar && topAppBar.parentElement !== headerInner) {
        topAppBar.classList.add('in-header');
        headerInner.appendChild(topAppBar);
        return true;
      }
      return false;
    }

    /**
     * Blogger Yerlesim / Ozellestirici uzerinden eklenen Yan Panel Gadget bolumunu
     * (#sidebar-gadgets-section) sag yan panelin (#home-sidebar) icine tasir.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {boolean} Tasima islemi yapildiysa true.
     */
    integrateSidebarGadgets(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || typeof targetDoc.getElementById !== 'function') return false;
      const sidebarEl = targetDoc.getElementById('home-sidebar');
      const gadgetsSection = targetDoc.getElementById('sidebar-gadgets-section');
      if (sidebarEl && gadgetsSection && gadgetsSection.parentElement !== sidebarEl) {
        sidebarEl.appendChild(gadgetsSection);
        if (this.logger && typeof this.logger.debug === 'function') {
          this.logger.debug('Blogger yan panel gadget alani #home-sidebar icine tasindi.');
        }
        return true;
      }
      return false;
    }

    /**
     * Gelistirici DEBUG log panelini gunceller.
     * @param {Object} [logger] - Log nesnesi.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {void}
     */
    renderDebugLogs(logger, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      const activeLogger = logger || this.logger;
      if (!targetDoc || typeof targetDoc.getElementById !== 'function') return;
      const listEl = targetDoc.getElementById('debug-log-list');
      if (!listEl || !activeLogger || typeof activeLogger.getEntries !== 'function') return;
      const entries = activeLogger.getEntries().slice(-15).reverse();
      listEl.innerHTML = entries
        .map((e) => `<div>[${e.timestamp}] <strong>[${e.level}]</strong> ${e.message}</div>`)
        .join('');
    }

    /**
     * Gelistirici gonderi olusturucu form verilerini okuyup cikti uretir.
     * @param {Object} generator - PostGenerator nesnesi.
     * @param {'series'|'chapter'} mode - Olusturma modu.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {Object|null} Uretilen kod nesnesi.
     */
    runGeneratorFromDom(generator, mode, doc) {
      if (!generator) return null;
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      const getVal = (id, fallback) => {
        const el = targetDoc && targetDoc.getElementById ? targetDoc.getElementById(id) : null;
        return (el && el.value) || fallback;
      };
      const title = getVal('gen-series-title', 'Yeni Seri');
      const sourceLang = getVal('gen-source-lang', 'KR');
      const chapterNumber = getVal('gen-chapter-num', 1);
      const readerMode = getVal('gen-reader-mode', 'webtoon');
      const translatorNote = getVal('gen-translator-note', '');
      const pages = getVal('gen-pages-input', '');
      const res =
        mode === 'series'
          ? generator.generateSeriesPost({ title, sourceLang, defaultReaderMode: readerMode })
          : generator.generateChapterPost({
              seriesTitle: title,
              chapterNumber,
              readerMode,
              translatorNote,
              pages
            });
      if (targetDoc && targetDoc.getElementById) {
        const outEl = targetDoc.getElementById('gen-code-output');
        const labelsEl = targetDoc.getElementById('gen-labels-info');
        if (outEl) outEl.value = res.html;
        if (labelsEl) labelsEl.textContent = `Önerilen Blogger Etiketleri: ${res.labels}`;
      }
      return res;
    }

    /**
     * DOM uzerindeki .manowa-series-post dugumlerinden katalog serilerini yukler.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {string} [siteBaseTitle='Manowa'] - Site basligi.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {number} Islenen seri sayisi.
     */
    ingestDomSeriesNodes(catalog, siteBaseTitle = 'Manowa', doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || !catalog || typeof targetDoc.querySelectorAll !== 'function') return 0;
      let count = 0;
      const seriesNodes = targetDoc.querySelectorAll('.manowa-series-post');
      seriesNodes.forEach((node) => {
        const id = node.getAttribute('data-series-id');
        if (!id) return;
        const existing = catalog.getSeriesById(id);
        catalog.upsertSeries({
          id,
          title: node.getAttribute('data-title') || id,
          altTitle: node.getAttribute('data-alt-title') || '',
          sourceLang: node.getAttribute('data-source-lang') || 'KR',
          type: node.getAttribute('data-type') || 'Manhwa',
          defaultReaderMode: node.getAttribute('data-reader-mode') || 'webtoon',
          status: node.getAttribute('data-status') || 'Devam Ediyor',
          translator: node.getAttribute('data-translator') || siteBaseTitle,
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
  }

  globalScope.BloggerThemeBridge = BloggerThemeBridge;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BloggerThemeBridge, THEME_STORAGE_KEY };
  }
})(typeof window !== 'undefined' ? window : globalThis);
