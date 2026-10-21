/**
 * @fileoverview Blogger Kalici URL (Permalink), History API (pushState / replaceState)
 * ve Tarayici Geri/Ileri Tusu (popstate) yonlendirme mantigini yoneten modul.
 */
(function (globalScope) {
  'use strict';
  /**
   * Verilen URL dizgesinden kucuk harfli pathname kismini cikarir.
   * @param {string} rawUrl - Ham URL veya yol.
   * @returns {string} Normalize edilmis pathname.
   */
  function extractPathname(rawUrl) {
    if (!rawUrl) return '';
    const str = String(rawUrl).trim();
    try {
      if (str.startsWith('http://') || str.startsWith('https://')) {
        return new URL(str).pathname.toLowerCase().replace(/\/+$/, '') || '/';
      }
    } catch (_err) {
      // Gecersiz URL durumunda alt satirdan devam et
    }
    const clean = str.split('?')[0].split('#')[0].toLowerCase();
    return clean.replace(/\/+$/, '') || '/';
  }
  /**
   * Blogger URL uretimi, History API senkronizasyonu ve rota cozumlemesini yoneten sinif.
   */
  class RouterController {
    /**
     * RouterController nesnesini yapilandirir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.historyObj =
        options.historyObj || (typeof history !== 'undefined' ? history : null);
      this.locationObj =
        options.locationObj || (typeof location !== 'undefined' ? location : null);
    }
    /**
     * Ortamin yerel dosya onizlemesi (file: veya preview.html) olup olmadigini belirler.
     * @returns {boolean} Yerel onizleme ise true.
     */
    isLocalPreviewEnv() {
      const loc = this.locationObj;
      if (!loc) return false;
      if (loc.protocol === 'file:') return true;
      const pathname = String(loc.pathname || '').toLowerCase();
      return pathname.endsWith('/preview.html') || pathname.endsWith('\\preview.html');
    }
    /**
     * Hedef gorunum, seri veya bolum icin gercek Blogger URL'sini veya yedek rotayi uretir.
     * @param {Object|null} catalog - Katalog denetleyicisi.
     * @param {'catalog'|'series'|'reader'|'generator'} viewName - Hedef gorunum.
     * @param {string} [seriesId=''] - Seri kimligi.
     * @param {string} [chapterId=''] - Bolum kimligi.
     * @returns {string} Hedef URL veya yol.
     */
    computeTargetUrl(catalog, viewName, seriesId = '', chapterId = '') {
      const isPreview = this.isLocalPreviewEnv();
      if (viewName === 'catalog') {
        return isPreview ? '#catalog' : '/';
      }
      if (viewName === 'directory') {
        return isPreview ? '#seriler' : '/?gorunum=seriler';
      }
      if (viewName === 'bookmarks') {
        return isPreview ? '#kitaplik' : '/?gorunum=kitaplik';
      }
      if (viewName === 'history') {
        return isPreview ? '#gecmis' : '/?gorunum=gecmis';
      }
      if (viewName === 'generator') {
        return isPreview ? '#olusturucu' : '/?gorunum=olusturucu';
      }
      if (viewName === 'page') {
        if (isPreview) {
          return (this.locationObj && this.locationObj.hash && this.locationObj.hash.startsWith('#sayfa'))
            ? this.locationObj.hash
            : '#sayfa';
        }
        if (this.locationObj && this.locationObj.pathname && this.locationObj.pathname.includes('/p/')) {
          return this.locationObj.pathname + (this.locationObj.search || '');
        }
        return seriesId ? `/p/${seriesId}.html` : '/?gorunum=sayfa';
      }
      if (viewName === 'series' && seriesId) {
        const series = catalog ? catalog.getSeriesById(seriesId) : null;
        if (series && series.url && !isPreview) {
          try {
            const parsed = new URL(series.url);
            return parsed.pathname + parsed.search;
          } catch (_err) {
            if (series.url.startsWith('/')) return series.url;
          }
        }
        return isPreview
          ? `#seri/${encodeURIComponent(seriesId)}`
          : `/?seri=${encodeURIComponent(seriesId)}`;
      }
      if (viewName === 'reader' && seriesId && chapterId) {
        const series = catalog ? catalog.getSeriesById(seriesId) : null;
        const chapter =
          series && Array.isArray(series.chapters)
            ? series.chapters.find((c) => c.id === chapterId)
            : null;
        if (chapter && chapter.url && !isPreview) {
          try {
            const parsed = new URL(chapter.url);
            return parsed.pathname + parsed.search;
          } catch (_err) {
            if (chapter.url.startsWith('/')) return chapter.url;
          }
        }
        return isPreview
          ? `#oku/${encodeURIComponent(seriesId)}/${encodeURIComponent(chapterId)}`
          : `/?seri=${encodeURIComponent(seriesId)}&bolum=${encodeURIComponent(chapterId)}`;
      }
      return isPreview ? '#catalog' : '/';
    }
    /**
     * Tarayici adres cubugunu (URL), sayfa basligini ve History API gecmisini gunceller.
     * @param {Object} stateObj - History state nesnesi ({ view, seriesId, chapterId }).
     * @param {string} pageTitle - Yeni sayfa basligi.
     * @param {string} targetUrl - Yeni URL veya yol.
     * @param {Object} [options={}] - Gecmis guncelleme secenekleri.
     * @returns {void}
     */
    syncBrowserHistory(stateObj, pageTitle, targetUrl, options = {}) {
      const updateHistory = options.updateHistory !== undefined ? options.updateHistory : true;
      const replace = Boolean(options.replace);
      if (typeof document !== 'undefined' && pageTitle) {
        document.title = pageTitle;
      }
      if (!updateHistory || !this.historyObj) {
        return;
      }
      try {
        if (replace && typeof this.historyObj.replaceState === 'function') {
          this.historyObj.replaceState(stateObj, pageTitle, targetUrl);
          return;
        }
        if (typeof this.historyObj.pushState === 'function') {
          const cur = this.historyObj.state;
          const isSame =
            cur &&
            cur.view === stateObj.view &&
            (cur.seriesId || '') === (stateObj.seriesId || '') &&
            (cur.chapterId || '') === (stateObj.chapterId || '');
          if (!isSame) {
            this.historyObj.pushState(stateObj, pageTitle, targetUrl);
            if (this.logger && typeof this.logger.info === 'function') {
              this.logger.info('Tarayici URL pushState ile degistirildi.', {
                targetUrl,
                state: stateObj
              });
            }
          }
        }
      } catch (err) {
        if (this.logger && typeof this.logger.warn === 'function') {
          this.logger.warn('History pushState hatasi.', { error: err.message });
        }
      }
    }
    /**
     * Verilen URL'yi cozumleyerek hangi gorunumun acilmasi gerektigini dondurur.
     * @param {Object|null} catalog - Katalog denetleyicisi.
     * @param {string} [currentUrl] - Kontrol edilecek URL.
     * @returns {{ matched: boolean, view: string, seriesId: string, chapterId: string }}
     */
    resolveUrlRoute(catalog, currentUrl) {
      const empty = { matched: false, view: 'catalog', seriesId: '', chapterId: '' };
      if (!catalog) return empty;
      const href = currentUrl || (this.locationObj ? this.locationObj.href : '');
      if (!href) return empty;
      const hashIndex = href.indexOf('#');
      if (hashIndex >= 0) {
        const hashVal = href.slice(hashIndex + 1);
        if (hashVal.startsWith('oku/')) {
          const parts = hashVal.slice(4).split('/');
          if (parts.length >= 2) {
            return {
              matched: true,
              view: 'reader',
              seriesId: decodeURIComponent(parts[0]),
              chapterId: decodeURIComponent(parts[1])
            };
          }
        } else if (hashVal.startsWith('seri/')) {
          const sId = decodeURIComponent(hashVal.slice(5));
          if (sId) {
            return { matched: true, view: 'series', seriesId: sId, chapterId: '' };
          }
        } else if (hashVal === 'seriler' || hashVal === 'tum-seriler' || hashVal === 'dizin') {
          return { matched: true, view: 'directory', seriesId: '', chapterId: '' };
        } else if (hashVal === 'kitaplik') {
          return { matched: true, view: 'bookmarks', seriesId: '', chapterId: '' };
        } else if (hashVal === 'gecmis') {
          return { matched: true, view: 'history', seriesId: '', chapterId: '' };
        } else if (hashVal === 'olusturucu') {
          return { matched: true, view: 'generator', seriesId: '', chapterId: '' };
        } else if (hashVal === 'sayfa' || hashVal.startsWith('sayfa/')) {
          return { matched: true, view: 'page', seriesId: '', chapterId: '' };
        }
      }
      try {
        const baseOrigin =
          this.locationObj && this.locationObj.origin && this.locationObj.origin.startsWith('http')
            ? this.locationObj.origin
            : 'https://example.blogspot.com';
        const parsedUrl = new URL(href, baseOrigin);
        const qSeri = parsedUrl.searchParams.get('seri');
        const qBolum = parsedUrl.searchParams.get('bolum');
        const qGorunum = parsedUrl.searchParams.get('gorunum');
        if (qGorunum === 'seriler' || qGorunum === 'tum-seriler' || qGorunum === 'dizin') {
          return { matched: true, view: 'directory', seriesId: '', chapterId: '' };
        }
        if (qGorunum === 'kitaplik') {
          return { matched: true, view: 'bookmarks', seriesId: '', chapterId: '' };
        }
        if (qGorunum === 'gecmis') {
          return { matched: true, view: 'history', seriesId: '', chapterId: '' };
        }
        if (qGorunum === 'olusturucu') {
          return { matched: true, view: 'generator', seriesId: '', chapterId: '' };
        }
        if (qGorunum === 'sayfa') {
          return { matched: true, view: 'page', seriesId: '', chapterId: '' };
        }
        if (qSeri && qBolum) {
          return { matched: true, view: 'reader', seriesId: qSeri, chapterId: qBolum };
        }
        if (qSeri) {
          return { matched: true, view: 'series', seriesId: qSeri, chapterId: '' };
        }
      } catch (_err) {
        // Pathname kontrolune gec
      }
      if (!href.includes('.html')) {
        return empty;
      }
      const targetPath = extractPathname(href);
      if (targetPath.endsWith('/preview.html') || targetPath === '/' || targetPath === '') {
        return empty;
      }
      if (targetPath.includes('/p/seriler') || targetPath.includes('/p/tum-seriler') || targetPath.includes('/p/dizin')) {
        return { matched: true, view: 'directory', seriesId: '', chapterId: '' };
      }
      if (targetPath.includes('/p/')) {
        return { matched: true, view: 'page', seriesId: '', chapterId: '' };
      }
      if (typeof document !== 'undefined') {
        const metaPage = document.querySelector('meta[name="is-static-page"]');
        if (metaPage && metaPage.getAttribute('content') === 'true') {
          return { matched: true, view: 'page', seriesId: '', chapterId: '' };
        }
        if (document.getElementById('blogger-static-page-raw')) {
          return { matched: true, view: 'page', seriesId: '', chapterId: '' };
        }
      }
      for (const series of catalog.seriesList) {
        for (const ch of series.chapters || []) {
          if (ch.url && extractPathname(ch.url) === targetPath) {
            return { matched: true, view: 'reader', seriesId: series.id, chapterId: ch.id };
          }
        }
        if (series.url && extractPathname(series.url) === targetPath) {
          return { matched: true, view: 'series', seriesId: series.id, chapterId: '' };
        }
      }
      for (const series of catalog.seriesList) {
        if (targetPath.includes(series.id)) {
          const bolumMatch = targetPath.match(/bolum-(\d+)/);
          if (bolumMatch) {
            const targetNo = Number(bolumMatch[1]);
            const foundCh = (series.chapters || []).find((c) => c.number === targetNo);
            if (foundCh) {
              return { matched: true, view: 'reader', seriesId: series.id, chapterId: foundCh.id };
            }
          }
          return { matched: true, view: 'series', seriesId: series.id, chapterId: '' };
        }
      }
      return empty;
    }
  }
  globalScope.RouterController = RouterController;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RouterController, extractPathname };
  }
})(typeof window !== 'undefined' ? window : globalThis);
