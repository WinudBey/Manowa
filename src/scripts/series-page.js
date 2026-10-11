/**
 * @fileoverview Baştan tasarlanan Seri Bilgileri Sayfası (SeriesPageController) modülü.
 * Bulanık arka planlı seri vitrini, yapılandırılmış meta veri tablosu, temizlenmiş özet,
 * bölüm içi anlık arama/sıralama ve benzer seriler öneri şeridini yönetir.
 */

(function (globalScope) {
  'use strict';

  const iconFn =
    (globalScope.ManowaIcons && globalScope.ManowaIcons.get) ||
    (typeof require === 'function' ? require('./svg-icons').getSvgIcon : () => '');

  /**
   * Blogger şablonlarındaki yer tutucu özet ifadeleri.
   * @type {RegExp}
   */
  const PLACEHOLDER_SYNOPSIS_REGEX =
    /buraya serinin özet hikayesini|yepyeni tasarımla çok profesyonel|örnek özet metni/i;

  /**
   * Seri açıklaması için varsayılan maksimum karakter sınırı (~3 satır).
   * @type {number}
   */
  const DEFAULT_SYNOPSIS_MAX_LENGTH = 165;

  /**
   * Seri tanıtım sayfasını, bölüm arama/sıralama araçlarını ve benzer serileri yöneten sınıf.
   */
  class SeriesPageController {
    /**
     * SeriesPageController nesnesini başlatır.
     * @param {Object} [options={}] - Yapılandırma seçenekleri.
     * @param {Object} [options.logger=null] - Logger nesnesi.
     * @param {number} [options.synopsisMaxLength=165] - Özet kısaltma karakter sınırı.
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.chapterSortOrder = options.chapterSortOrder || 'desc';
      this.chapterSearchQuery = '';
      this.activeSeriesId = '';
      this.synopsisMaxLength = options.synopsisMaxLength || DEFAULT_SYNOPSIS_MAX_LENGTH;
      this.activeSynopsisFull = '';
      this.activeSynopsisPreview = '';
      this.isSynopsisExpanded = false;
      this._log('debug', 'SeriesPageController baslatildi.');
    }

    /**
     * Vektörel SVG ikon üretici yardımcı metod.
     * @param {string} name - İkon adı.
     * @returns {string} SVG HTML dizgesi.
     */
    _icon(name) {
      const fn = (globalScope.ManowaIcons && globalScope.ManowaIcons.get) || iconFn;
      return typeof fn === 'function' ? fn(name) : '';
    }

    /**
     * İç loglama yardımcı metodu.
     * @param {'debug'|'info'|'warn'|'error'} level - Log seviyesi.
     * @param {string} msg - Log mesajı.
     * @param {Object|null} [meta=null] - Ek veri.
     * @returns {void}
     */
    _log(level, msg, meta = null) {
      if (this.logger && typeof this.logger[level] === 'function') {
        this.logger[level](msg, meta);
      }
    }

    /**
     * HTML öznitelikleri içinde kullanılacak metinleri güvenli şekilde kaçırır.
     * @param {string} text - Ham metin.
     * @returns {string} Kaçırılmış güvenli metin.
     */
    _escapeAttr(text) {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    /**
     * Seri özet metnini şablon yer tutucularından temizler.
     * @param {string} rawText - Ham özet metni.
     * @param {Object} series - Seri nesnesi.
     * @returns {string} Temizlenmiş özet metni.
     */
    cleanSynopsis(rawText, series = {}) {
      const text = String(rawText || '').trim();
      if (!text || PLACEHOLDER_SYNOPSIS_REGEX.test(text)) {
        const genres = Array.isArray(series.genres) ? series.genres.join(', ') : 'Genel';
        const count = Array.isArray(series.chapters) ? series.chapters.length : 0;
        return `${series.title || 'Bu seri'}, ${genres} kategorilerinde yer alan güncel bir ${series.type || 'Manhwa'} eseridir. Arşivimizde şu an ${count} Türkçe çeviri bölümü mevcuttur.`;
      }
      return text;
    }

    /**
     * Seri özetini uzunluk sınırına göre kontrol eder ve gerekirse kelime bütünlüğünü koruyarak kısaltır.
     * @param {string} rawText - Ham özet metni.
     * @param {Object} [series={}] - Seri nesnesi.
     * @param {number} [maxLength=this.synopsisMaxLength] - Maksimum karakter sınırı.
     * @returns {{ isLong: boolean, previewText: string, fullText: string }} Özet önizleme bilgisi.
     */
    formatSynopsisPreview(rawText, series = {}, maxLength = this.synopsisMaxLength) {
      const fullText = this.cleanSynopsis(rawText, series);
      const limit = Number(maxLength) > 0 ? Number(maxLength) : DEFAULT_SYNOPSIS_MAX_LENGTH;
      if (fullText.length <= limit) {
        return {
          isLong: false,
          previewText: fullText,
          fullText
        };
      }
      const sliced = fullText.slice(0, limit);
      const lastSpace = sliced.lastIndexOf(' ');
      const cutIndex = lastSpace > Math.floor(limit * 0.65) ? lastSpace : limit;
      const cleanCut = sliced.slice(0, cutIndex).replace(/[.,;:\-\s]+$/, '');
      return {
        isLong: true,
        previewText: `${cleanCut}...`,
        fullText
      };
    }

    /**
     * Uzun seri özetinin daraltılmış ("Devamını Oku") ve genişletilmiş ("Daha Az Göster") durumunu değiştirir.
     * @param {Element|null} [cardEl=null] - Özet kartı DOM düğümü.
     * @param {Element|null} [btnEl=null] - Tıklanan düğme DOM düğümü.
     * @returns {boolean} Yeni genişletilmişlik durumu (true: açık, false: daraltılmış).
     */
    toggleSynopsis(cardEl = null, btnEl = null) {
      const textEl =
        (cardEl && typeof cardEl.querySelector === 'function'
          ? cardEl.querySelector('#series-synopsis-text, .detail-synopsis')
          : null) ||
        (typeof document !== 'undefined' ? document.getElementById('series-synopsis-text') : null);
      const toggleBtn =
        btnEl ||
        (cardEl && typeof cardEl.querySelector === 'function'
          ? cardEl.querySelector('#btn-toggle-synopsis, .series-synopsis-toggle')
          : null) ||
        (typeof document !== 'undefined' ? document.getElementById('btn-toggle-synopsis') : null);

      const currentExpanded =
        toggleBtn && typeof toggleBtn.getAttribute === 'function'
          ? toggleBtn.getAttribute('aria-expanded') === 'true'
          : Boolean(this.isSynopsisExpanded);
      const nextExpanded = !currentExpanded;
      this.isSynopsisExpanded = nextExpanded;

      if (textEl) {
        const fullText =
          (typeof textEl.getAttribute === 'function' && textEl.getAttribute('data-full-text')) ||
          this.activeSynopsisFull ||
          textEl.textContent;
        const shortText =
          (typeof textEl.getAttribute === 'function' && textEl.getAttribute('data-short-text')) ||
          this.activeSynopsisPreview ||
          textEl.textContent;
        textEl.textContent = nextExpanded ? fullText : shortText;
        if (textEl.classList) {
          textEl.classList.toggle('is-collapsed', !nextExpanded);
          textEl.classList.toggle('is-expanded', nextExpanded);
        }
      }

      if (toggleBtn) {
        if (typeof toggleBtn.setAttribute === 'function') {
          toggleBtn.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
        }
        toggleBtn.textContent = nextExpanded ? 'Daha Az Göster' : 'Devamını Oku';
      }

      this._log('debug', 'Seri ozeti gorunumu degistirildi.', {
        seriesId: this.activeSeriesId,
        expanded: nextExpanded
      });
      return nextExpanded;
    }

    /**
     * Okuma motoru kodunu kullanıcı dostu Türkçe etikete dönüştürür.
     * @param {string} mode - Motor kodu ('webtoon', 'single', 'double', 'novel').
     * @returns {string} Türkçe motor adı.
     */
    formatReaderModeLabel(mode) {
      const m = String(mode || 'webtoon').toLowerCase();
      if (m === 'single') return 'Tek Sayfa (Manga)';
      if (m === 'double') return 'Çift Sayfa (Kitap)';
      if (m === 'novel') return 'Novel (Metin Modu)';
      return 'Webtoon (Dikey Şerit)';
    }

    /**
     * Kaynak dil kodunu tam açıklamaya dönüştürür.
     * @param {string} langCode - Dil kodu ('KR', 'JP', 'CN', 'EN').
     * @returns {string} Açıklamalı dil metni.
     */
    formatSourceLangLabel(langCode) {
      const code = String(langCode || 'KR').toUpperCase();
      const map = {
        KR: 'Korece (KR)',
        JP: 'Japonca (JP)',
        CN: 'Çince (CN)',
        EN: 'İngilizce (EN)'
      };
      return map[code] || code;
    }

    /**
     * Bölüm arama sorgusunu günceller.
     * @param {string} query - Arama metni veya bölüm numarası.
     * @returns {void}
     */
    setChapterSearchQuery(query) {
      this.chapterSearchQuery = String(query || '').trim();
      this._log('debug', 'Bolum arama sorgusu guncellendi.', {
        seriesId: this.activeSeriesId,
        query: this.chapterSearchQuery
      });
    }

    /**
     * Bölüm sıralama yönünü değiştirir ('desc' <-> 'asc').
     * @returns {'desc'|'asc'} Yeni sıralama yönü.
     */
    toggleSortOrder() {
      this.chapterSortOrder = this.chapterSortOrder === 'desc' ? 'asc' : 'desc';
      this._log('info', 'Bolum siralama yonu degistirildi.', {
        order: this.chapterSortOrder
      });
      return this.chapterSortOrder;
    }

    /**
     * Aktif serinin bölümlerini sıralanmış ve arama sorgusuna göre filtrelenmiş olarak döndürür.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {string} seriesId - Seri kimliği.
     * @returns {Array<Object>} Filtrelenmiş bölüm listesi.
     */
    getFilteredChapters(catalog, seriesId) {
      if (!catalog || !seriesId) {
        return [];
      }
      const sorted = catalog.getSortedChapters(seriesId, this.chapterSortOrder);
      if (!this.chapterSearchQuery) {
        return sorted;
      }
      const q = this.chapterSearchQuery.toLowerCase();
      return sorted.filter((ch) => {
        const numMatch = String(ch.number || '').toLowerCase().includes(q);
        const titleMatch = String(ch.title || '').toLowerCase().includes(q);
        return numMatch || titleMatch;
      });
    }

    /**
     * Seçilen seriye tür ve kategori bakımından en yakın benzer serileri döndürür.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object} currentSeries - Aktif seri nesnesi.
     * @param {number} [limit=4] - Maksimum öneri sayısı.
     * @returns {Array<Object>} Benzer seri listesi.
     */
    getRelatedSeries(catalog, currentSeries, limit = 4) {
      if (!catalog || !Array.isArray(catalog.seriesList) || !currentSeries) {
        return [];
      }
      const targetGenres = new Set(
        (currentSeries.genres || []).map((g) => String(g).toLowerCase())
      );
      const candidates = catalog.seriesList
        .filter((s) => s.id !== currentSeries.id)
        .map((s) => {
          let score = 0;
          if (s.type === currentSeries.type) score += 2;
          (s.genres || []).forEach((g) => {
            if (targetGenres.has(String(g).toLowerCase())) score += 3;
          });
          score += Math.min(2, (s.chapters || []).length * 0.1);
          return { series: s, score };
        });

      candidates.sort((a, b) => b.score - a.score);
      return candidates.slice(0, Math.max(1, limit)).map((item) => item.series);
    }

    /**
     * Seri detay vitrin ve bilgi kartı (#series-detail-box) için HTML üretir.
     * @param {Object} series - Seri nesnesi.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object|null} library - UserLibrary nesnesi.
     * @param {Object|null} savedProgress - Kullanıcının bu serideki kayıtlı okuma ilerlemesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {string} Seri detay HTML içeriği.
     */
    renderSeriesDetailHtml(series, catalog, library, savedProgress, computeUrlFn) {
      if (!series) {
        return '';
      }
      const isFav =
        library && typeof library.isFavorite === 'function'
          ? library.isFavorite(series.id)
          : false;
      const sortedAsc = catalog ? catalog.getSortedChapters(series.id, 'asc') : [];
      const totalChapters = sortedAsc.length;
      const firstChapter = sortedAsc[0] || null;
      const latestChapter = sortedAsc[totalChapters - 1] || null;

      const resumeChapterObj =
        savedProgress && savedProgress.chapterId
          ? sortedAsc.find((c) => c.id === savedProgress.chapterId) || firstChapter
          : null;

      const firstHref = firstChapter ? computeUrlFn('reader', series.id, firstChapter.id) : '#';
      const latestHref = latestChapter ? computeUrlFn('reader', series.id, latestChapter.id) : '#';
      const resumeHref = resumeChapterObj
        ? computeUrlFn('reader', series.id, resumeChapterObj.id)
        : '#';

      const genresHtml = (series.genres || [])
        .map(
          (g) =>
            `<button class="series-genre-pill" type="button" data-series-genre="${g}" title="${g} kategorisindeki serileri filtrele">${this._icon('tag')} ${g}</button>`
        )
        .join('');

      const synopsisInfo = this.formatSynopsisPreview(series.synopsis, series);
      this.activeSynopsisFull = synopsisInfo.fullText;
      this.activeSynopsisPreview = synopsisInfo.previewText;
      this.isSynopsisExpanded = false;
      const latestDate =
        latestChapter && latestChapter.date
          ? latestChapter.date
          : series.publishedDate || 'Güncel';
      const authorText = series.author || 'Bilinmiyor';
      const artistText = series.artist || 'Bilinmiyor';
      const translatorText = series.translator || 'Bilinmiyor';
      const editorText = series.editor || 'Bilinmiyor';
      const rawAlt = String(series.altTitle || '').trim();
      const altTitleText = /isteğe bağlı|alternatif isimler/.test(
        rawAlt.toLocaleLowerCase('tr-TR')
      )
        ? ''
        : rawAlt;

      return `<div class="series-hero-card">
        <div class="series-backdrop" style="background-image: url('${series.cover || ''}');"></div>
        <div class="series-backdrop-overlay"></div>

        <div class="series-detail-header">
          <div class="series-poster-col">
            <div class="series-poster-frame">
              <img class="detail-cover" src="${series.cover}" alt="${series.title}" />
            </div>
            <div class="series-poster-quick-actions">
              <button class="icon-btn series-fav-btn ${isFav ? 'is-fav' : ''}" type="button" data-action="toggle-fav" data-series="${series.id}">
                ${isFav ? `${this._icon('heart-filled')} Kitaplığımda` : `${this._icon('heart')} Kitaplığa Ekle`}
              </button>
              <button class="icon-btn series-share-btn" id="btn-copy-series-url" type="button" title="Seri Bağlantısını Kopyala">
                ${this._icon('link')} Paylaş
              </button>
            </div>
          </div>

          <div class="series-info-col detail-info">
            <h1 class="series-main-title">${series.title}</h1>
            ${altTitleText ? `<div class="detail-alt-title">${altTitleText}</div>` : ''}

            <div class="series-genre-list detail-badges">
              ${genresHtml}
            </div>

            <div class="series-synopsis-card">
              <div class="series-synopsis-title">${this._icon('book')} Seri Özeti</div>
              <p class="detail-synopsis ${synopsisInfo.isLong ? 'is-collapsed' : ''}" id="series-synopsis-text" data-full-text="${this._escapeAttr(synopsisInfo.fullText)}" data-short-text="${this._escapeAttr(synopsisInfo.previewText)}">${synopsisInfo.previewText}</p>
              ${
                synopsisInfo.isLong
                  ? `<button class="series-synopsis-toggle" id="btn-toggle-synopsis" type="button" aria-expanded="false">Devamını Oku</button>`
                  : ''
              }
            </div>

            <div class="detail-actions series-cta-bar">
              ${
                firstChapter
                  ? `<a class="primary-btn series-cta-btn" href="${firstHref}" data-action="read" data-series="${series.id}" data-chapter="${firstChapter.id}">${this._icon('play')} İlk Bölümü Oku (Bölüm ${firstChapter.number})</a>`
                  : ''
              }
              ${
                latestChapter && latestChapter.id !== (firstChapter && firstChapter.id)
                  ? `<a class="icon-btn series-cta-secondary" href="${latestHref}" data-action="read" data-series="${series.id}" data-chapter="${latestChapter.id}">${this._icon('flame')} Son Bölüm (Bölüm ${latestChapter.number})</a>`
                  : ''
              }
              ${
                resumeChapterObj && savedProgress
                  ? `<a class="icon-btn series-cta-resume" href="${resumeHref}" data-action="read" data-series="${series.id}" data-chapter="${resumeChapterObj.id}">${this._icon('clock')} Devam Et: Bölüm ${resumeChapterObj.number} (Sayfa ${Number(savedProgress.pageIndex || 0) + 1})</a>`
                  : ''
              }
            </div>
          </div>

          <aside class="series-meta-col" aria-label="Seri Bilgi Izgarası">
            <div class="series-meta-grid">
              <div class="series-meta-card">
                <span class="series-meta-label">${this._icon('layers')} Toplam Bölüm</span>
                <strong class="series-meta-value">${totalChapters} Bölüm</strong>
              </div>
              <div class="series-meta-card">
                <span class="series-meta-label">${this._icon('sparkles')} Durum</span>
                <strong class="series-meta-value">${series.status || 'Devam Ediyor'}</strong>
              </div>
              <div class="series-meta-card">
                <span class="series-meta-label">${this._icon('user')} Yazar</span>
                <strong class="series-meta-value">${authorText}</strong>
              </div>
              <div class="series-meta-card">
                <span class="series-meta-label">${this._icon('pen')} Çizer</span>
                <strong class="series-meta-value">${artistText}</strong>
              </div>
              <div class="series-meta-card">
                <span class="series-meta-label">${this._icon('globe')} Çevirmen</span>
                <strong class="series-meta-value">${translatorText}</strong>
              </div>
              <div class="series-meta-card">
                <span class="series-meta-label">${this._icon('wrench')} Editör</span>
                <strong class="series-meta-value">${editorText}</strong>
              </div>
              <div class="series-meta-card">
                <span class="series-meta-label">${this._icon('clock')} Son Güncelleme</span>
                <strong class="series-meta-value">${latestDate}</strong>
              </div>
              <div class="series-meta-card">
                <span class="series-meta-label">${this._icon('award')} Arşiv Puanı</span>
                <strong class="series-meta-value">${series.rating || '9.6'} / 10</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>`;
    }

    /**
     * Bölüm yayın tarihini 1 aya (30 güne) kadar göreceli ("Bugün", "X gün önce", "1 ay önce"),
     * 30 günden eski ise normal tarih ("YYYY-AA-GG") formatında döndürür.
     * @param {string} dateStr - Bölüm tarihi ('YYYY-MM-DD' veya ISO dizgesi).
     * @param {Date|string} [nowDate=new Date()] - Referans güncel tarih.
     * @returns {string} Formatlanmış tarih metni.
     */
    formatRelativeChapterDate(dateStr, nowDate = new Date()) {
      const raw = String(dateStr || '').trim();
      if (!raw) {
        return 'Güncel';
      }
      const parseToUtcMidnight = (val) => {
        if (val instanceof Date && !Number.isNaN(val.getTime())) {
          return Date.UTC(val.getFullYear(), val.getMonth(), val.getDate());
        }
        const str = String(val || '').trim();
        const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (ymd) {
          return Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
        }
        const parsed = new Date(str);
        if (!Number.isNaN(parsed.getTime())) {
          return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
        return NaN;
      };

      const targetUtc = parseToUtcMidnight(raw);
      const nowUtc = parseToUtcMidnight(nowDate);
      if (Number.isNaN(targetUtc) || Number.isNaN(nowUtc)) {
        return raw;
      }
      const diffDays = Math.floor((nowUtc - targetUtc) / 86400000);
      if (diffDays <= 0) {
        return 'Bugün';
      }
      if (diffDays < 30) {
        return `${diffDays} gün önce`;
      }
      if (diffDays === 30) {
        return '1 ay önce';
      }
      return raw.slice(0, 10);
    }

    /**
     * Bölüm listesi ızgarası (#chapter-list-grid) için kompakt kutu ve göreceli tarihli HTML üretir.
     * @param {string} seriesId - Seri kimliği.
     * @param {Array<Object>} chapters - Sıralanmış/filtrelenmiş bölüm listesi.
     * @param {Object|null} savedProgress - Kullanıcının kayıtlı ilerlemesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @param {Date|string} [nowDate=new Date()] - Göreceli tarih hesabı için referans tarih.
     * @returns {string} Bölüm listesi HTML içeriği.
     */
    renderChapterListHtml(seriesId, chapters, savedProgress, computeUrlFn, nowDate = new Date()) {
      if (!Array.isArray(chapters) || chapters.length === 0) {
        if (this.chapterSearchQuery) {
          return `<div class="disqus-status-note">"${this.chapterSearchQuery}" aramasıyla eşleşen bölüm bulunamadı.</div>`;
        }
        return `<div class="disqus-status-note">Bu seri için henüz bölüm eklenmemiş.</div>`;
      }
      return chapters
        .map((ch) => {
          const isRead = Boolean(savedProgress && savedProgress.chapterId === ch.id);
          const chHref = computeUrlFn('reader', seriesId, ch.id);
          const relDate = this.formatRelativeChapterDate(ch.date, nowDate);
          return `<a class="chapter-item-btn chapter-card-item chapter-compact-box ${isRead ? 'is-read' : ''}" href="${chHref}" data-action="read" data-series="${seriesId}" data-chapter="${ch.id}" title="Bölüm ${ch.number} (${ch.date || 'Güncel'})">
            <div class="chapter-box-top">
              <strong class="chapter-title-text">Bölüm ${ch.number}</strong>
              ${
                isRead
                  ? `<span class="chapter-read-badge" title="Son Okunan" aria-label="Son Okunan">${this._icon('check')}</span>`
                  : ''
              }
            </div>
            <div class="chapter-box-bottom">
              <span class="chapter-sub-meta">${relDate}</span>
              <span class="chapter-open-pill">Oku</span>
            </div>
          </a>`;
        })
        .join('');
    }

    /**
     * Benzer / Önerilen seriler şeridi (#series-related-grid) için HTML üretir.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object} currentSeries - Aktif seri nesnesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {string} Benzer seriler HTML içeriği.
     */
    renderRelatedSeriesHtml(catalog, currentSeries, computeUrlFn) {
      const related = this.getRelatedSeries(catalog, currentSeries, 4);
      if (related.length === 0) {
        return '';
      }
      return related
        .map((s) => {
          const href = computeUrlFn('series', s.id);
          const chCount = (s.chapters || []).length;
          return `<a class="series-related-card" href="${href}" data-action="detail" data-series="${s.id}">
            <img class="series-related-thumb" src="${s.cover}" alt="${s.title}" loading="lazy" />
            <div class="series-related-info">
              <span class="series-related-type">${s.type || 'Manhwa'} • ${s.sourceLang || 'KR'}</span>
              <strong class="series-related-title">${s.title}</strong>
              <span class="series-related-meta">${this._icon('layers')} ${chCount} Bölüm • ${s.status || 'Devam Ediyor'}</span>
            </div>
          </a>`;
        })
        .join('');
    }

    /**
     * Seri sayfasının tüm DOM bileşenlerini günceller.
     * @param {Object} series - Aktif seri nesnesi.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object|null} library - UserLibrary nesnesi.
     * @param {Object|null} readingEngine - ReadingEngine nesnesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {void}
     */
    renderIntoDom(series, catalog, library, readingEngine, computeUrlFn) {
      if (typeof document === 'undefined' || !series) {
        return;
      }
      if (this.activeSeriesId !== series.id) {
        this.activeSeriesId = series.id;
        this.chapterSearchQuery = '';
        const searchInp = document.getElementById('input-chapter-search');
        if (searchInp) searchInp.value = '';
      }

      const breadcrumbTitle = document.getElementById('series-breadcrumb-title');
      if (breadcrumbTitle) breadcrumbTitle.textContent = series.title;

      const savedProgress =
        readingEngine && typeof readingEngine.getProgress === 'function'
          ? readingEngine.getProgress(series.id)
          : null;

      const detailBox = document.getElementById('series-detail-box');
      if (detailBox) {
        detailBox.innerHTML = this.renderSeriesDetailHtml(
          series,
          catalog,
          library,
          savedProgress,
          computeUrlFn
        );
      }

      this.renderChaptersIntoDom(catalog, readingEngine, computeUrlFn);

      const relatedSec = document.getElementById('series-related-section');
      const relatedGrid = document.getElementById('series-related-grid');
      if (relatedSec && relatedGrid) {
        const relHtml = this.renderRelatedSeriesHtml(catalog, series, computeUrlFn);
        relatedGrid.innerHTML = relHtml;
        relatedSec.classList.toggle('hidden', !relHtml);
      }
    }

    /**
     * Yalnızca bölüm listesi ızgarasını ve bölüm sayacı etiketini DOM üzerinde günceller.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object|null} readingEngine - ReadingEngine nesnesi.
     * @param {Function} computeUrlFn - URL hesaplama fonksiyonu.
     * @returns {void}
     */
    renderChaptersIntoDom(catalog, readingEngine, computeUrlFn) {
      if (typeof document === 'undefined' || !this.activeSeriesId || !catalog) {
        return;
      }
      const listGrid = document.getElementById('chapter-list-grid');
      const countBadge = document.getElementById('series-chapter-count');
      const sortBtn = document.getElementById('btn-sort-chapters');
      const filtered = this.getFilteredChapters(catalog, this.activeSeriesId);
      const total = (catalog.getSortedChapters(this.activeSeriesId, 'asc') || []).length;

      if (countBadge) {
        countBadge.textContent =
          this.chapterSearchQuery && filtered.length !== total
            ? `${filtered.length} / ${total} Bölüm`
            : `${total} Bölüm`;
      }
      if (sortBtn) {
        sortBtn.innerHTML =
          this.chapterSortOrder === 'desc'
            ? `${this._icon('sort')} Sıralama: Yeni → Eski`
            : `${this._icon('sort')} Sıralama: Eski → Yeni`;
      }
      if (listGrid) {
        const saved =
          readingEngine && typeof readingEngine.getProgress === 'function'
            ? readingEngine.getProgress(this.activeSeriesId)
            : null;
        listGrid.innerHTML = this.renderChapterListHtml(
          this.activeSeriesId,
          filtered,
          saved,
          computeUrlFn
        );
      }
    }

    /**
     * Seri sayfası üzerindeki bölüm arama, sıralama, kategori seçimi ve bağlantı paylaşım olaylarını bağlar.
     * @param {Object} [callbacks={}] - Geri çağırım fonksiyonları.
     * @param {Function} [callbacks.onChapterUpdate] - Bölüm listesi değiştiğinde çağrılır.
     * @param {Function} [callbacks.onGenreSelect] - Seri üzerindeki kategori etiketine tıklandığında çağrılır.
     * @returns {void}
     */
    bindDomEvents(callbacks = {}) {
      if (typeof document === 'undefined') {
        return;
      }
      const searchInp = document.getElementById('input-chapter-search');
      if (searchInp) {
        searchInp.addEventListener('input', (e) => {
          this.setChapterSearchQuery(e.target.value);
          if (typeof callbacks.onChapterUpdate === 'function') {
            callbacks.onChapterUpdate();
          }
        });
      }

      const sortBtn = document.getElementById('btn-sort-chapters');
      if (sortBtn) {
        sortBtn.addEventListener('click', () => {
          this.toggleSortOrder();
          if (typeof callbacks.onChapterUpdate === 'function') {
            callbacks.onChapterUpdate();
          }
        });
      }

      const viewSeries = document.getElementById('view-series');
      if (viewSeries) {
        viewSeries.addEventListener('click', (e) => {
          const synopsisBtn = e.target.closest('#btn-toggle-synopsis, .series-synopsis-toggle');
          if (synopsisBtn) {
            e.preventDefault();
            const cardEl = synopsisBtn.closest('.series-synopsis-card');
            this.toggleSynopsis(cardEl, synopsisBtn);
            return;
          }

          const genreBtn = e.target.closest('[data-series-genre]');
          if (genreBtn) {
            e.preventDefault();
            const genre = genreBtn.getAttribute('data-series-genre');
            if (genre && typeof callbacks.onGenreSelect === 'function') {
              callbacks.onGenreSelect(genre);
            }
            return;
          }

          const copyBtn = e.target.closest('#btn-copy-series-url');
          if (copyBtn) {
            e.preventDefault();
            const shareUrl =
              typeof globalScope.location !== 'undefined' ? globalScope.location.href : '';
            if (shareUrl && typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(shareUrl);
            }
            copyBtn.innerHTML = `${this._icon('check')} Kopyalandı`;
            this._log('info', 'Seri baglantisi panoya kopyalandi.', { url: shareUrl });
          }
        });
      }
    }
  }

  globalScope.SeriesPageController = SeriesPageController;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SeriesPageController };
  }
})(typeof window !== 'undefined' ? window : globalThis);
