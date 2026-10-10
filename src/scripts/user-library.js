/**
 * @fileoverview Kullanici kitapligi (Favoriler / Bookmarks), okuma gecmisi listesi ve
 * son eklenen bolumler akisini yoneten modul.
 */

(function (globalScope) {
  'use strict';

  /**
   * Favori serileri, okuma gecmisini ve son eklenen bolumleri yoneten sinif.
   */
  class UserLibrary {
    /**
     * UserLibrary nesnesini baslatir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.storage =
        options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      this.favoritesKey = options.favoritesKey || 'manowa_favorites';
      this.historyKey = options.historyKey || 'manowa_reading_history';
      this._log('debug', 'UserLibrary baslatildi.');
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
     * Kayitli favori seri kimliklerini (ID) dondurur.
     * @returns {Array<string>} Favori seri ID listesi.
     */
    getFavoriteIds() {
      if (!this.storage) {
        return [];
      }
      try {
        const raw = this.storage.getItem(this.favoritesKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (_err) {
        return [];
      }
    }

    /**
     * Belirtilen serinin favorilerde olup olmadigini kontrol eder.
     * @param {string} seriesId - Seri kimligi.
     * @returns {boolean} Favoride ise true.
     */
    isFavorite(seriesId) {
      if (!seriesId) {
        return false;
      }
      return this.getFavoriteIds().includes(seriesId);
    }

    /**
     * Seriyi favorilere ekler veya favorilerden cikarir.
     * @param {string} seriesId - Seri kimligi.
     * @returns {boolean} Islem sonrasi favori durumu (eklendiyse true, cikarildiysa false).
     */
    toggleFavorite(seriesId) {
      if (!seriesId) {
        return false;
      }
      const list = this.getFavoriteIds();
      const idx = list.indexOf(seriesId);
      let added = false;
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.unshift(seriesId);
        added = true;
      }

      if (this.storage) {
        try {
          this.storage.setItem(this.favoritesKey, JSON.stringify(list));
        } catch (_err) {
          // Depolama hatasini yoksay
        }
      }
      this._log('info', added ? 'Seri kitapliga eklendi.' : 'Seri kitapliktan cikarildi.', {
        seriesId,
        totalFavorites: list.length
      });
      return added;
    }

    /**
     * Katalog icindeki favori serilerin tam nesne listesini dondurur.
     * @param {Object} catalog - CatalogController nesnesi.
     * @returns {Array<Object>} Favori seri nesneleri.
     */
    getFavoriteSeries(catalog) {
      if (!catalog || !Array.isArray(catalog.seriesList)) {
        return [];
      }
      const favIds = this.getFavoriteIds();
      return favIds
        .map((id) => catalog.getSeriesById(id))
        .filter((series) => Boolean(series));
    }

    /**
     * Tum serilerdeki bolumleri tarayarak en son yayinlanan bolumleri dondurur.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {number} [limit=8] - Maksimum bolum sayisi.
     * @returns {Array<Object>} Son eklenen bolum listesi.
     */
    getLatestChapters(catalog, limit = 8) {
      if (!catalog || !Array.isArray(catalog.seriesList)) {
        return [];
      }
      const items = [];
      catalog.seriesList.forEach((series) => {
        if (!Array.isArray(series.chapters)) {
          return;
        }
        series.chapters.forEach((ch) => {
          items.push({
            seriesId: series.id,
            seriesTitle: series.title,
            seriesCover: series.cover || '',
            seriesType: series.type || 'Seri',
            sourceLang: series.sourceLang || 'KR',
            chapterId: ch.id,
            number: Number(ch.number) || 0,
            title: ch.title || `Bölüm ${ch.number}`,
            date: ch.date || '',
            isNovel: Boolean(ch.isNovel)
          });
        });
      });

      items.sort((a, b) => {
        const dateCompare = String(b.date).localeCompare(String(a.date));
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return b.number - a.number;
      });

      return items.slice(0, Math.max(1, limit));
    }

    /**
     * Kullanicinin okuma gecmisini katalog verileriyle zenginlestirerek en yeniden eskiye dondurur.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object} [readingEngine=null] - ReadingEngine nesnesi.
     * @returns {Array<Object>} Zenginlestirilmis gecmis listesi.
     */
    getRecentHistoryList(catalog, readingEngine = null) {
      if (!catalog) {
        return [];
      }
      let rawHistory = {};
      if (readingEngine && typeof readingEngine.getAllHistory === 'function') {
        rawHistory = readingEngine.getAllHistory();
      } else if (this.storage) {
        try {
          const raw = this.storage.getItem(this.historyKey);
          rawHistory = raw ? JSON.parse(raw) : {};
        } catch (_err) {
          rawHistory = {};
        }
      }

      const entries = Object.values(rawHistory || {});
      const enriched = entries
        .map((entry) => {
          const series = catalog.getSeriesById(entry.seriesId);
          if (!series || !Array.isArray(series.chapters)) {
            return null;
          }
          const chapter = series.chapters.find((c) => c.id === entry.chapterId);
          if (!chapter) {
            return null;
          }
          return {
            seriesId: series.id,
            seriesTitle: series.title,
            seriesCover: series.cover || '',
            seriesType: series.type || 'Seri',
            chapterId: chapter.id,
            chapterNumber: chapter.number,
            chapterTitle: chapter.title || `Bölüm ${chapter.number}`,
            pageIndex: Number(entry.pageIndex) || 0,
            updatedAt: entry.updatedAt || ''
          };
        })
        .filter(Boolean);

      enriched.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return enriched;
    }

    /**
     * Tum okuma gecmisini temizler.
     * @returns {void}
     */
    clearHistory() {
      if (this.storage) {
        try {
          this.storage.removeItem(this.historyKey);
        } catch (_err) {
          // Depolama hatasini yoksay
        }
      }
      this._log('info', 'Okuma gecmisi temizlendi.');
    }

    /**
     * Ana sayfadaki Son Eklenen Bolumler izgarasi icin HTML uretir.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @param {number} [limit=6] - Gosterilecek bolum sayisi.
     * @returns {string} HTML icerigi.
     */
    renderLatestChaptersHtml(catalog, computeUrlFn, limit = 6) {
      const latest = this.getLatestChapters(catalog, limit);
      if (latest.length === 0) {
        return '';
      }
      return latest
        .map((item) => {
          const chHref = computeUrlFn('reader', item.seriesId, item.chapterId);
          return `<a class="latest-chapter-card" href="${chHref}" data-action="read" data-series="${item.seriesId}" data-chapter="${item.chapterId}">
            <img class="latest-chapter-thumb" src="${item.seriesCover}" alt="${item.seriesTitle}" loading="lazy" />
            <div class="latest-chapter-info">
              <span class="latest-series-name">${item.seriesTitle}</span>
              <span class="latest-chapter-badge">Bölüm ${item.number}</span>
              <span class="latest-chapter-date">${item.date || 'Yeni'} • ${item.seriesType}</span>
            </div>
          </a>`;
        })
        .join('');
    }

    /**
     * Ana sayfadaki Kaldigin Yerden Devam Et seridi icin HTML uretir.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object} readingEngine - ReadingEngine nesnesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {string} HTML icerigi.
     */
    renderContinueReadingHtml(catalog, readingEngine, computeUrlFn) {
      const historyList = this.getRecentHistoryList(catalog, readingEngine).slice(0, 4);
      if (historyList.length === 0) {
        return '';
      }
      return historyList
        .map((item) => {
          const readHref = computeUrlFn('reader', item.seriesId, item.chapterId);
          return `<a class="continue-card" href="${readHref}" data-action="read" data-series="${item.seriesId}" data-chapter="${item.chapterId}">
            <img class="continue-thumb" src="${item.seriesCover}" alt="${item.seriesTitle}" loading="lazy" />
            <div class="continue-info">
              <strong class="continue-title">${item.seriesTitle}</strong>
              <span class="continue-meta">Bölüm ${item.chapterNumber} • Sayfa ${item.pageIndex + 1}</span>
            </div>
            <span class="continue-play">▶</span>
          </a>`;
        })
        .join('');
    }

    /**
     * Katalog veya Kitapligim gorunumu icin seri kartlari HTML dizgesini uretir.
     * @param {Array<Object>} seriesList - Gosterilecek seri dizisi.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {string} Seri kartlari HTML icerigi.
     */
    renderSeriesCardListHtml(seriesList, catalog, computeUrlFn) {
      if (!Array.isArray(seriesList) || seriesList.length === 0) {
        return '';
      }
      return seriesList
        .map((series) => {
          const seriesHref = computeUrlFn('series', series.id);
          const isFav = this.isFavorite(series.id);
          const latestChapters = catalog
            ? catalog.getSortedChapters(series.id, 'desc').slice(0, 2)
            : [];
          const chaptersHtml =
            latestChapters.length > 0
              ? latestChapters
                  .map((ch) => {
                    const chHref = computeUrlFn('reader', series.id, ch.id);
                    return (
                      `<a class="chapter-mini-btn" href="${chHref}" data-action="read" data-series="${series.id}" data-chapter="${ch.id}">` +
                      `<span>Bölüm ${ch.number}</span><span>${ch.date}</span></a>`
                    );
                  })
                  .join('')
              : `<a class="chapter-mini-btn" href="${seriesHref}" data-action="detail" data-series="${series.id}"><span>Seri Sayfası</span><span>Detay</span></a>`;

          return `<article class="series-card">
            <div class="card-cover-wrap">
              <a href="${seriesHref}" data-action="detail" data-series="${series.id}" style="display:block;width:100%;height:100%;">
                <img class="card-cover" src="${series.cover}" alt="${series.title}" loading="lazy" />
              </a>
              <span class="lang-badge lang-${series.sourceLang}">${series.sourceLang}</span>
              <span class="type-badge">${series.type}</span>
              <button class="fav-card-btn ${isFav ? 'is-fav' : ''}" type="button" data-action="toggle-fav" data-series="${series.id}" title="${isFav ? 'Kitaplıktan Çıkar' : 'Kitaplığa Ekle'}">${isFav ? '❤️' : '🤍'}</button>
            </div>
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
     * Okuma Gecmisim sayfasi (#view-history) icin liste HTML icerigini uretir.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object} readingEngine - ReadingEngine nesnesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {string} Gecmis listesi HTML icerigi.
     */
    renderHistoryListHtml(catalog, readingEngine, computeUrlFn) {
      const list = this.getRecentHistoryList(catalog, readingEngine);
      if (list.length === 0) {
        return `<div class="disqus-status-note">Henüz okuma geçmişiniz bulunmuyor. Bir bölüm okuduğunuzda otomatik olarak burada listelenir.</div>`;
      }
      return list
        .map((item) => {
          const readHref = computeUrlFn('reader', item.seriesId, item.chapterId);
          return `<a class="continue-card" href="${readHref}" data-action="read" data-series="${item.seriesId}" data-chapter="${item.chapterId}">
            <img class="continue-thumb" src="${item.seriesCover}" alt="${item.seriesTitle}" loading="lazy" />
            <div class="continue-info">
              <strong class="continue-title">${item.seriesTitle}</strong>
              <span class="continue-meta">Bölüm ${item.chapterNumber}: ${item.chapterTitle} • Kaldığın Sayfa: ${item.pageIndex + 1}</span>
            </div>
            <span class="continue-play">▶ Devam Et</span>
          </a>`;
        })
        .join('');
    }

    /**
     * Seri detay kutusu (#series-detail-box) icin HTML icerigini uretir.
     * @param {Object} series - Seri nesnesi.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object|null} savedProgress - Kayitli ilerleme.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {string} Seri detay HTML icerigi.
     */
    renderSeriesDetailHtml(series, catalog, savedProgress, computeUrlFn) {
      const isFav = this.isFavorite(series.id);
      const sortedAsc = catalog ? catalog.getSortedChapters(series.id, 'asc') : [];
      const firstChapter = sortedAsc[0];
      const latestChapter = sortedAsc[sortedAsc.length - 1];
      const resumeChapterId = savedProgress
        ? savedProgress.chapterId
        : firstChapter
          ? firstChapter.id
          : '';
      const genresHtml = (series.genres || [])
        .map((g) => `<span class="meta-tag">${g}</span>`)
        .join('');
      const firstHref = firstChapter ? computeUrlFn('reader', series.id, firstChapter.id) : '#';
      const latestHref = latestChapter ? computeUrlFn('reader', series.id, latestChapter.id) : '#';
      const resumeHref = resumeChapterId ? computeUrlFn('reader', series.id, resumeChapterId) : '#';

      return `<div class="series-detail-header">
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
            <button class="icon-btn" type="button" data-action="toggle-fav" data-series="${series.id}">${isFav ? '❤️ Kitaplığımda' : '🤍 Kitaplığa Ekle'}</button>
          </div>
        </div>
      </div>`;
    }

    /**
     * Seri sayfasindaki bolum listesi (#chapter-list-grid) icin HTML uretir.
     * @param {string} seriesId - Seri kimligi.
     * @param {Array<Object>} chapters - Siralanmis bolumler.
     * @param {Object|null} savedProgress - Kayitli ilerleme.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {string} Bolum listesi HTML icerigi.
     */
    renderChapterListHtml(seriesId, chapters, savedProgress, computeUrlFn) {
      if (!Array.isArray(chapters) || chapters.length === 0) {
        return `<div class="disqus-status-note">Bu seri için henüz bölüm eklenmemiş.</div>`;
      }
      return chapters
        .map((ch) => {
          const isRead = savedProgress && savedProgress.chapterId === ch.id;
          const chHref = computeUrlFn('reader', seriesId, ch.id);
          return `<a class="chapter-item-btn ${isRead ? 'is-read' : ''}" href="${chHref}" data-action="read" data-series="${seriesId}" data-chapter="${ch.id}">
            <span><strong>Bölüm ${ch.number}</strong> - ${ch.title}</span>
            <span style="font-size: 0.78rem; color: var(--text-secondary);">${isRead ? '✓ Okundu' : ch.date}</span>
          </a>`;
        })
        .join('');
    }
  }

  globalScope.UserLibrary = UserLibrary;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UserLibrary };
  }
})(typeof window !== 'undefined' ? window : globalThis);
