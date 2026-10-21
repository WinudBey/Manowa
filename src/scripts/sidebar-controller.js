/**
 * @fileoverview Ana sayfa sag yan panel (Sidebar) bilesenlerini yoneten modul (SidebarController).
 * Populer & One Cikan Seriler siralamasi, Kategoriler bulutu ve Hizli Kitaplik / Arsiv Ozetini uretir.
 */

(function (globalScope) {
  'use strict';

  const EXCLUDED_GENRE_TYPES = ['manhwa', 'manga', 'manhua', 'novel', 'webcomic', 'seri', 'bölüm'];

  /**
   * Ana sayfa yan panelini (Sidebar) yoneten sinif.
   */
  class SidebarController {
    /**
     * SidebarController nesnesini yapilandirir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     * @param {Object} [options.logger=null] - Loglayici nesnesi.
     * @param {number} [options.topLimit=5] - Populer listedeki maksimum seri sayisi.
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.topLimit = typeof options.topLimit === 'number' ? options.topLimit : 5;
      this.topFilter = 'ALL';
      this._log('debug', 'SidebarController baslatildi.', { topLimit: this.topLimit });
    }

    /**
     * Ic loglama yardimcisi.
     * @param {'debug'|'info'|'warn'|'error'} level - Log seviyesi.
     * @param {string} msg - Log mesaji.
     * @param {Object|null} [meta=null] - Ek veri.
     * @returns {void}
     */
    _log(level, msg, meta = null) {
      if (this.logger && typeof this.logger[level] === 'function') {
        this.logger[level](msg, meta);
      }
    }

    /**
     * SVG ikon yardimcisini dondurur.
     * @param {string} name - Ikon adi.
     * @returns {string} SVG dizgesi.
     */
    _icon(name) {
      if (globalScope.ManowaIcons && typeof globalScope.ManowaIcons.get === 'function') {
        return globalScope.ManowaIcons.get(name);
      }
      if (typeof require === 'function') {
        try {
          return require('./svg-icons').getSvgIcon(name);
        } catch (_err) {
          return '';
        }
      }
      return '';
    }

    /**
     * Populer seriler sekme filtresini degistirir ('ALL', 'Manhwa', 'Manga', 'Novel').
     * @param {string} filterType - Yeni filtre turu.
     * @returns {string} Aktif filtre turu.
     */
    setTopFilter(filterType) {
      this.topFilter = String(filterType || 'ALL').trim();
      this._log('debug', 'Sidebar populer seri filtresi degistirildi.', {
        topFilter: this.topFilter
      });
      return this.topFilter;
    }

    /**
     * Katalog icindeki serileri bolum sayisi ve puana gore siralayarak dondurur.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {string} [typeFilter=this.topFilter] - Tur filtresi ('ALL', 'Manhwa', 'Manga', 'Novel').
     * @param {number} [limit=this.topLimit] - Maksimum kayit sayisi.
     * @returns {Array<Object>} Siralanmis populer seriler.
     */
    getTopSeries(catalog, typeFilter = this.topFilter, limit = this.topLimit) {
      if (!catalog || !Array.isArray(catalog.seriesList)) {
        return [];
      }
      const normFilter = String(typeFilter || 'ALL').trim().toUpperCase();
      const filtered = catalog.seriesList.filter((series) => {
        if (normFilter === 'ALL') {
          return true;
        }
        return (
          String(series.type || '').toUpperCase() === normFilter ||
          String(series.sourceLang || '').toUpperCase() === normFilter
        );
      });

      filtered.sort((a, b) => {
        const chDiff = (b.chapters || []).length - (a.chapters || []).length;
        if (chDiff !== 0) {
          return chDiff;
        }
        return parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
      });

      return filtered.slice(0, Math.max(1, limit));
    }

    /**
     * Katalogdaki tum serilerden kategori (genre) isimlerini ve seri sayilarini cikarir.
     * @param {Object} catalog - CatalogController nesnesi.
     * @returns {Array<{ name: string, count: number }>} Kategori ve sayac listesi.
     */
    getGenreCounts(catalog) {
      if (!catalog || !Array.isArray(catalog.seriesList)) {
        return [];
      }
      const map = new Map();
      catalog.seriesList.forEach((series) => {
        const seenInSeries = new Set();
        (series.genres || []).forEach((rawGenre) => {
          const clean = String(rawGenre || '').trim();
          const lower = clean.toLowerCase();
          if (!clean || EXCLUDED_GENRE_TYPES.includes(lower) || seenInSeries.has(lower)) {
            return;
          }
          seenInSeries.add(lower);
          const existing = map.get(lower);
          if (existing) {
            existing.count += 1;
          } else {
            map.set(lower, { name: clean, count: 1 });
          }
        });
      });

      return Array.from(map.values()).sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name, 'tr');
      });
    }

    /**
     * Toplam seri, toplam bolum ve favori seri istatistiklerini hesaplar.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object|null} [library=null] - UserLibrary nesnesi.
     * @returns {{ totalSeries: number, totalChapters: number, favoriteCount: number }}
     */
    getArchiveStats(catalog, library = null) {
      const seriesList = catalog && Array.isArray(catalog.seriesList) ? catalog.seriesList : [];
      const totalSeries = seriesList.length;
      const totalChapters = seriesList.reduce(
        (sum, s) => sum + (Array.isArray(s.chapters) ? s.chapters.length : 0),
        0
      );
      const favoriteCount =
        library && typeof library.getFavoriteIds === 'function'
          ? library.getFavoriteIds().length
          : 0;
      return { totalSeries, totalChapters, favoriteCount };
    }

    /**
     * Populer & One Cikan Seriler listesi icin HTML uretir.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Function} computeUrlFn - URL olusturucu fonksiyon.
     * @returns {string} HTML dizgesi.
     */
    renderTopSeriesHtml(catalog, computeUrlFn) {
      const resolveUrl = typeof computeUrlFn === 'function' ? computeUrlFn : () => '#';
      const list = this.getTopSeries(catalog, this.topFilter, this.topLimit);
      if (list.length === 0) {
        return `<div class="sidebar-empty-note">Bu filtrede seri bulunamadı.</div>`;
      }
      return list
        .map((series, idx) => {
          const rankNum = String(idx + 1).padStart(2, '0');
          const rankClass = idx < 3 ? `rank-top-${idx + 1}` : '';
          const href = resolveUrl('series', series.id);
          const chCount = (series.chapters || []).length;
          return `<a class="sidebar-rank-item" href="${href}" data-action="detail" data-series="${series.id}">
            <span class="sidebar-rank-badge ${rankClass}">${rankNum}</span>
            <img class="sidebar-rank-thumb" src="${series.cover || 'https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak'}" alt="${(series.title || 'Seri').replace(/"/g, '&quot;')}" loading="lazy" onload="this.classList.add('is-loaded');" onerror="this.onerror=null;this.src='https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak';this.classList.add('is-loaded');" />
            <div class="sidebar-rank-info">
              <strong class="sidebar-rank-title">${series.title}</strong>
              <div class="sidebar-rank-meta">
                <span class="sidebar-rank-type">${series.type || 'Seri'}</span>
                <span>${this._icon('layers')} ${chCount} Bölüm</span>
              </div>
            </div>
          </a>`;
        })
        .join('');
    }

    /**
     * Kategoriler / Tur Bulutu kutusu icin HTML uretir.
     * @param {Object} catalog - CatalogController nesnesi.
     * @returns {string} HTML dizgesi.
     */
    renderGenresHtml(catalog) {
      const genres = this.getGenreCounts(catalog);
      const activeGenre = (catalog && catalog.activeGenre) || 'ALL';
      const totalCount = catalog && Array.isArray(catalog.seriesList) ? catalog.seriesList.length : 0;

      const allPill = `<button class="sidebar-genre-chip ${activeGenre === 'ALL' ? 'active' : ''}" type="button" data-sidebar-genre="ALL">
        <span>Tümü</span>
        <span class="sidebar-genre-count">${totalCount}</span>
      </button>`;

      const genrePills = genres
        .map((g) => {
          const isActive = activeGenre.toLowerCase() === g.name.toLowerCase();
          return `<button class="sidebar-genre-chip ${isActive ? 'active' : ''}" type="button" data-sidebar-genre="${g.name}">
            <span>${g.name}</span>
            <span class="sidebar-genre-count">${g.count}</span>
          </button>`;
        })
        .join('');

      return allPill + genrePills;
    }

    /**
     * Hizli Kitapligim ve Arsiv Ozeti kutusu icin HTML uretir.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object|null} library - UserLibrary nesnesi.
     * @param {Function} computeUrlFn - URL olusturucu fonksiyon.
     * @returns {string} HTML dizgesi.
     */
    renderQuickLibraryHtml(catalog, library, computeUrlFn) {
      const resolveUrl = typeof computeUrlFn === 'function' ? computeUrlFn : () => '#';
      const stats = this.getArchiveStats(catalog, library);
      const favSeries =
        library && typeof library.getFavoriteSeries === 'function'
          ? library.getFavoriteSeries(catalog).slice(0, 3)
          : [];

      const statsHtml = `<div class="sidebar-stats-grid">
        <div class="sidebar-stat-box">
          <strong class="sidebar-stat-val">${stats.totalSeries}</strong>
          <span class="sidebar-stat-lbl">Seri</span>
        </div>
        <div class="sidebar-stat-box">
          <strong class="sidebar-stat-val">${stats.totalChapters}</strong>
          <span class="sidebar-stat-lbl">Bölüm</span>
        </div>
        <div class="sidebar-stat-box">
          <strong class="sidebar-stat-val">${stats.favoriteCount}</strong>
          <span class="sidebar-stat-lbl">Kitaplık</span>
        </div>
      </div>`;

      const favListHtml =
        favSeries.length > 0
          ? `<div class="sidebar-fav-mini-list">` +
            favSeries
              .map((s) => {
                const sHref = resolveUrl('series', s.id);
                return `<a class="sidebar-fav-mini-item" href="${sHref}" data-action="detail" data-series="${s.id}">
                  <img class="sidebar-fav-mini-thumb" src="${s.cover || 'https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak'}" alt="${(s.title || 'Seri').replace(/"/g, '&quot;')}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak';" />
                  <span class="sidebar-fav-mini-title">${s.title}</span>
                  <span class="sidebar-fav-mini-count">${(s.chapters || []).length} Böl.</span>
                </a>`;
              })
              .join('') +
            `</div>`
          : `<div class="sidebar-empty-note">Favori serilerinize hızlı erişmek için kartlardaki ${this._icon('heart')} düğmesini kullanın.</div>`;

      return statsHtml + favListHtml;
    }

    /**
     * Tarayici DOM icindeki Sidebar bilesenlerini gunceller.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object|null} library - UserLibrary nesnesi.
     * @param {Function} computeUrlFn - URL olusturucu fonksiyon.
     * @returns {void}
     */
    renderIntoDom(catalog, library, computeUrlFn) {
      if (typeof document === 'undefined' || !catalog) {
        return;
      }
      const topListEl = document.getElementById('sidebar-top-list');
      if (topListEl) {
        topListEl.innerHTML = this.renderTopSeriesHtml(catalog, computeUrlFn);
        topListEl.querySelectorAll('.sidebar-rank-thumb').forEach((img) => {
          if (img.complete && img.naturalWidth > 0) {
            img.classList.add('is-loaded');
          }
        });
      }
      const genresListEl = document.getElementById('sidebar-genres-list');
      if (genresListEl) {
        genresListEl.innerHTML = this.renderGenresHtml(catalog);
      }
      const quickLibEl = document.getElementById('sidebar-quick-library-body');
      if (quickLibEl) {
        quickLibEl.innerHTML = this.renderQuickLibraryHtml(catalog, library, computeUrlFn);
      }
    }

    /**
     * Sidebar uzerindeki sekme ve kategori filtre tiklamalarini baglar.
     * @param {Object} callbacks - Geri bildirim islevleri ({ onTopFilterChange, onGenreSelect }).
     * @returns {void}
     */
    bindDomEvents(callbacks = {}) {
      if (typeof document === 'undefined') {
        return;
      }
      const sidebarEl = document.getElementById('home-sidebar');
      if (!sidebarEl) {
        return;
      }
      sidebarEl.addEventListener('click', (ev) => {
        const tabBtn = ev.target.closest('[data-sidebar-tab]');
        if (tabBtn) {
          ev.preventDefault();
          const tabVal = tabBtn.getAttribute('data-sidebar-tab') || 'ALL';
          this.setTopFilter(tabVal);
          sidebarEl
            .querySelectorAll('[data-sidebar-tab]')
            .forEach((b) => b.classList.toggle('active', b === tabBtn));
          if (typeof callbacks.onTopFilterChange === 'function') {
            callbacks.onTopFilterChange(tabVal);
          }
          return;
        }
        const genreBtn = ev.target.closest('[data-sidebar-genre]');
        if (genreBtn) {
          ev.preventDefault();
          const genreVal = genreBtn.getAttribute('data-sidebar-genre') || 'ALL';
          if (typeof callbacks.onGenreSelect === 'function') {
            callbacks.onGenreSelect(genreVal);
          }
        }
      });
    }
  }

  globalScope.SidebarController = SidebarController;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SidebarController };
  }
})(typeof window !== 'undefined' ? window : globalThis);
