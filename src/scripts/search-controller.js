/**
 * @fileoverview Arama cubuguna yazilan girdileri dinleyerek canli, erisilebilir ve klavye destekli
 * bir acilir liste kutusu (Listbox / Combobox) uretip yoneten moduler arama denetleyicisi (SearchController).
 * W3C WAI-ARIA Combobox standartlarina, Turkce karakter normalizasyonuna ve otomatik DEBUG loglamasina tam uyumludur.
 */

(function (globalScope) {
  'use strict';

  /**
   * HTML karakterlerini XSS guvenligi icin kacis dizilerine donusturur.
   * @param {string} str - Temizlenecek metin.
   * @returns {string} Guvenli HTML metni.
   */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Turkce karakterleri kucuk harfe donusturup aksanlardan arindirarak arama icin normallestirir.
   * @param {string} str - Ham metin.
   * @returns {string} Normallestirilmis kucuk harfli metin.
   */
  function normalizeSearchText(str) {
    return String(str || '')
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Karakteri arama normalizasyonu icin 1'e 1 karsiligina donusturur.
   * @param {string} ch - Tek bir karakter.
   * @returns {string} Normallestirilmis tek karakter.
   */
  function toNormalizedChar(ch) {
    const lower = String(ch || '').toLocaleLowerCase('tr');
    const map = {
      'ı': 'i', 'i': 'i',
      'ğ': 'g', 'g': 'g',
      'ü': 'u', 'u': 'u',
      'ş': 's', 's': 's',
      'ö': 'o', 'o': 'o',
      'ç': 'c', 'c': 'c',
      'â': 'a', 'î': 'i', 'û': 'u',
      'é': 'e', 'è': 'e'
    };
    return map[lower] || lower;
  }

  /**
   * Metin icinde sorgu ile eslesen kisimlari guvenli sekilde <mark class="search-highlight"> ile sarar.
   * Orijinal harf buyuklugunu ve ozel karakterleri (XSS) korur.
   * @param {string} text - Orijinal kaynak metin.
   * @param {string} query - Arama sorgusu.
   * @returns {string} Vurgulanmis HTML dizgesi.
   */
  function highlightMatch(text, query) {
    if (!text) return '';
    const cleanText = String(text);
    const cleanQuery = normalizeSearchText(query);
    if (!cleanQuery) return escapeHtml(cleanText);

    let normText = '';
    for (let i = 0; i < cleanText.length; i++) {
      normText += toNormalizedChar(cleanText[i]);
    }

    const matchIdx = normText.indexOf(cleanQuery);
    if (matchIdx === -1) {
      return escapeHtml(cleanText);
    }

    const before = cleanText.slice(0, matchIdx);
    const matched = cleanText.slice(matchIdx, matchIdx + cleanQuery.length);
    const after = cleanText.slice(matchIdx + cleanQuery.length);

    return `${escapeHtml(before)}<mark class="search-highlight">${escapeHtml(matched)}</mark>${highlightMatch(after, query)}`;
  }

  /**
   * Arama sonuclari acilir liste kutusunu yoneten sinif.
   */
  class SearchController {
    /**
     * SearchController nesnesini yapilandirir.
     * @param {Object} [options={}] - Yapilandirma ayarlari.
     * @param {HTMLInputElement|string} [options.input='input-search'] - Arama input ogesi veya id degeri.
     * @param {HTMLElement|string} [options.listbox='search-results-listbox'] - Listbox kapsayici ogesi veya id degeri.
     * @param {HTMLElement|string} [options.container='header-search-box'] - Ust arama kapsayici ogesi veya id degeri.
     * @param {Function} [options.getSeriesList] - Katalogdaki serileri donduren fonksiyon.
     * @param {Function} [options.onSelect] - Bir seri secildiginde calisacak geri cagirim.
     * @param {Function} [options.onViewAll] - Tum sonuclar goruntulenmek istendiginde calisacak geri cagirim.
     * @param {Object} [options.logger=null] - Loglama nesnesi.
     * @param {number} [options.maxResults=8] - Acilir listede gosterilecek azami seri sayisi.
     * @param {number} [options.minQueryLength=1] - Aramanin tetiklenmesi icin gereken asgari karakter sayisi.
     */
    constructor(options = {}) {
      this.options = options;
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.getSeriesList =
        typeof options.getSeriesList === 'function' ? options.getSeriesList : () => [];
      this.onSelect = typeof options.onSelect === 'function' ? options.onSelect : null;
      this.onViewAll = typeof options.onViewAll === 'function' ? options.onViewAll : null;
      this.maxResults = typeof options.maxResults === 'number' ? options.maxResults : 8;
      this.minQueryLength =
        typeof options.minQueryLength === 'number' ? options.minQueryLength : 1;

      this.inputEl = null;
      this.listboxEl = null;
      this.containerEl = null;

      this.isOpen = false;
      this.activeIndex = -1;
      this.currentResults = [];
      this.currentQuery = '';

      this._boundInput = this._handleInput.bind(this);
      this._boundKeyDown = this._handleKeyDown.bind(this);
      this._boundFocus = this._handleFocus.bind(this);
      this._boundDocumentClick = this._handleDocumentClick.bind(this);
      this._boundListboxClick = this._handleListboxClick.bind(this);

      this._initElements();
      this._log('debug', 'SearchController baslatildi.', {
        maxResults: this.maxResults,
        minQueryLength: this.minQueryLength
      });
    }

    /**
     * Ic loglama yardimcisi.
     * @param {'debug'|'info'|'warn'|'error'} level - Log seviyesi.
     * @param {string} msg - Mesaj.
     * @param {Object|null} [meta=null] - Ek veri nesnesi.
     * @returns {void}
     */
    _log(level, msg, meta = null) {
      if (this.logger && typeof this.logger[level] === 'function') {
        this.logger[level](msg, meta);
      }
    }

    /**
     * DOM ogelerini cozumler ve baglantilari kurar.
     * @returns {boolean} Ogeler basariyla baglandiysa true.
     */
    _initElements() {
      const resolveEl = (elOrId) => {
        if (!elOrId) return null;
        if (typeof elOrId === 'string') {
          if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
            return document.getElementById(elOrId);
          }
          return null;
        }
        if (typeof elOrId === 'object') return elOrId;
        return null;
      };

      this.inputEl = resolveEl(this.options.input || 'input-search');
      this.listboxEl = resolveEl(this.options.listbox || 'search-results-listbox');
      this.containerEl = resolveEl(this.options.container || 'header-search-box');

      if (!this.listboxEl && this.containerEl && typeof document !== 'undefined' && typeof document.createElement === 'function') {
        // Listbox DOM'da yoksa dinamik olarak olustur
        this.listboxEl = document.createElement('div');
        this.listboxEl.id = 'search-results-listbox';
        this.listboxEl.className = 'search-results-listbox hidden';
        this.listboxEl.setAttribute('role', 'listbox');
        this.listboxEl.setAttribute('aria-label', 'Arama Sonuçları');
        this.containerEl.appendChild(this.listboxEl);
      }

      if (this.inputEl) {
        if (typeof this.inputEl.setAttribute === 'function') {
          this.inputEl.setAttribute('role', 'combobox');
          this.inputEl.setAttribute('aria-autocomplete', 'list');
          this.inputEl.setAttribute('aria-expanded', 'false');
          this.inputEl.setAttribute('autocomplete', 'off');
          if (this.listboxEl && this.listboxEl.id) {
            this.inputEl.setAttribute('aria-controls', this.listboxEl.id);
          }
        }

        if (typeof this.inputEl.removeEventListener === 'function') {
          this.inputEl.removeEventListener('input', this._boundInput);
          this.inputEl.removeEventListener('keydown', this._boundKeyDown);
          this.inputEl.removeEventListener('focus', this._boundFocus);
        }

        if (typeof this.inputEl.addEventListener === 'function') {
          this.inputEl.addEventListener('input', this._boundInput);
          this.inputEl.addEventListener('keydown', this._boundKeyDown);
          this.inputEl.addEventListener('focus', this._boundFocus);
        }
      }

      if (this.listboxEl) {
        if (typeof this.listboxEl.removeEventListener === 'function') {
          this.listboxEl.removeEventListener('click', this._boundListboxClick);
        }
        if (typeof this.listboxEl.addEventListener === 'function') {
          this.listboxEl.addEventListener('click', this._boundListboxClick);
        }
      }

      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.removeEventListener('pointerdown', this._boundDocumentClick);
        document.addEventListener('pointerdown', this._boundDocumentClick);
      }

      return Boolean(this.inputEl && this.listboxEl);
    }

    /**
     * Verilen sorguya gore serileri filtreler ve uygunluk sirasina gore dizer.
     * @param {string} query - Arama sorgusu.
     * @returns {Array<Object>} Filtrelenmis ve puanlanmis seri listesi.
     */
    searchSeries(query) {
      const clean = normalizeSearchText(query);
      if (!clean) return [];

      const list = this.getSeriesList();
      if (!Array.isArray(list) || list.length === 0) return [];

      const matches = [];

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const titleNorm = normalizeSearchText(item.title);
        const altNorm = normalizeSearchText(item.altTitle);
        const typeNorm = normalizeSearchText(item.type);
        const statusNorm = normalizeSearchText(item.status);
        const genresNorm = normalizeSearchText((item.genres || []).join(' '));

        let score = 0;

        if (titleNorm === clean) {
          score = 100;
        } else if (titleNorm.startsWith(clean)) {
          score = 80;
        } else if (titleNorm.includes(clean)) {
          score = 60;
        } else if (altNorm && (altNorm.startsWith(clean) || altNorm.includes(clean))) {
          score = 40;
        } else if (genresNorm.includes(clean)) {
          score = 30;
        } else if (typeNorm.includes(clean) || statusNorm.includes(clean)) {
          score = 20;
        }

        if (score > 0) {
          matches.push({ item, score });
        }
      }

      matches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.item.title || '').localeCompare(String(b.item.title || ''), 'tr');
      });

      return matches.map((m) => m.item);
    }

    /**
     * Arama girdi olayini (input) isler.
     * @param {Event} e - Girdi olayi.
     * @returns {void}
     */
    _handleInput(e) {
      const val = e && e.target ? e.target.value : '';
      this.executeSearch(val);
    }

    /**
     * Arama islemini baslatir ve listbox bilesenini gunceller.
     * @param {string} query - Arama sorgusu.
     * @returns {void}
     */
    executeSearch(query) {
      this.currentQuery = String(query || '').trim();

      if (this.currentQuery.length < this.minQueryLength) {
        this.close();
        this.currentResults = [];
        return;
      }

      this.currentResults = this.searchSeries(this.currentQuery);
      this._log('debug', 'Canli arama calistirildi.', {
        query: this.currentQuery,
        foundCount: this.currentResults.length
      });

      this.render();
      this.open();
    }

    /**
     * Odaklanma (focus) olayini isler.
     * @returns {void}
     */
    _handleFocus() {
      if (this.inputEl && this.inputEl.value.trim().length >= this.minQueryLength) {
        this.executeSearch(this.inputEl.value);
      }
    }

    /**
     * Klavye tuslarini (ArrowDown, ArrowUp, Enter, Escape) dinler ve yonetir.
     * @param {KeyboardEvent} e - Klavye olayi.
     * @returns {void}
     */
    _handleKeyDown(e) {
      if (!this.isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        if (this.inputEl && this.inputEl.value.trim().length >= this.minQueryLength) {
          e.preventDefault();
          this.executeSearch(this.inputEl.value);
          return;
        }
      }

      if (!this.isOpen) return;

      const totalItems = this._getTotalInteractiveItemsCount();
      if (totalItems === 0 && e.key !== 'Escape') return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.setActiveIndex(this.activeIndex < totalItems - 1 ? this.activeIndex + 1 : 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.setActiveIndex(this.activeIndex > 0 ? this.activeIndex - 1 : totalItems - 1);
          break;
        case 'Enter':
          e.preventDefault();
          this._selectCurrentActive();
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
        case 'Tab':
          this.close();
          break;
        default:
          break;
      }
    }

    /**
     * Etkilesimli secenek sayisini (sonuclar + varsa "tumunu gor" satiri) dondurur.
     * @returns {number} Toplam etkilesimli secenek sayisi.
     */
    _getTotalInteractiveItemsCount() {
      if (!this.currentResults || this.currentResults.length === 0) return 0;
      const count = Math.min(this.currentResults.length, this.maxResults);
      // Sonuclar varsa en altta "Tum sonuclari katalogda gor" butonu da 1 secenektir
      return count + 1;
    }

    /**
     * Aktif secenek indeksini gunceller ve ekranda odaklanmasini saglar.
     * @param {number} newIndex - Yeni aktif indeks.
     * @returns {void}
     */
    setActiveIndex(newIndex) {
      this.activeIndex = newIndex;
      if (!this.listboxEl) return;

      const items = this.listboxEl.querySelectorAll('[role="option"]');
      items.forEach((item, idx) => {
        const isActive = idx === this.activeIndex;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
          if (this.inputEl) {
            this.inputEl.setAttribute('aria-activedescendant', item.id);
          }
          if (typeof item.scrollIntoView === 'function') {
            item.scrollIntoView({ block: 'nearest' });
          }
        }
      });

      if (this.activeIndex === -1 && this.inputEl) {
        this.inputEl.removeAttribute('aria-activedescendant');
      }
    }

    /**
     * O an aktif olan secenegi calistirir.
     * @returns {void}
     */
    _selectCurrentActive() {
      if (this.activeIndex === -1) {
        // Hicbir oge secilmemisse ilk ogeyi sec veya tumunu gor calistir
        if (this.currentResults.length > 0) {
          this.selectSeries(this.currentResults[0].id);
        } else if (this.onViewAll) {
          this.triggerViewAll();
        }
        return;
      }

      const totalResults = Math.min(this.currentResults.length, this.maxResults);
      if (this.activeIndex < totalResults) {
        const chosen = this.currentResults[this.activeIndex];
        if (chosen) {
          this.selectSeries(chosen.id);
        }
      } else {
        // En alttaki "Tum sonuclari katalogda gor" satiri secildi
        this.triggerViewAll();
      }
    }

    /**
     * Bir seriyi secer, ayrinti sayfasina yonlendirir ve listbox'i kapatir.
     * @param {string} seriesId - Seri kimligi.
     * @returns {void}
     */
    selectSeries(seriesId) {
      this._log('info', 'Listbox uzerinden seri secildi.', { seriesId });
      const targetSeries = (this.getSeriesList() || []).find((s) => s.id === seriesId);
      this.close();

      if (this.inputEl) {
        this.inputEl.value = '';
      }

      if (typeof this.onSelect === 'function') {
        this.onSelect(seriesId, targetSeries);
      }
    }

    /**
     * "Tum sonuclari katalogda gor" aksiyonunu tetikler.
     * @returns {void}
     */
    triggerViewAll() {
      const q = this.currentQuery;
      this._log('info', 'Tum sonuclari katalogda gor secildi.', { query: q });
      this.close();

      if (typeof this.onViewAll === 'function') {
        this.onViewAll(q, this.currentResults.length);
      }
    }

    /**
     * Listbox ici tiklamalari delegasyon ile dinler.
     * @param {MouseEvent} e - Tiklama olayi.
     * @returns {void}
     */
    _handleListboxClick(e) {
      if (!e || !e.target) return;

      const viewAllBtn = e.target.closest('[data-action="view-all"]');
      if (viewAllBtn) {
        e.preventDefault();
        this.triggerViewAll();
        return;
      }

      const itemEl = e.target.closest('[data-series-id]');
      if (itemEl) {
        e.preventDefault();
        const id = itemEl.getAttribute('data-series-id');
        if (id) {
          this.selectSeries(id);
        }
      }
    }

    /**
     * Arama kutusu disina tiklandiginda listbox'i kapatir.
     * @param {PointerEvent|MouseEvent} e - Tiklama olayi.
     * @returns {void}
     */
    _handleDocumentClick(e) {
      if (!this.isOpen) return;
      if (this.containerEl && this.containerEl.contains(e.target)) return;
      if (this.listboxEl && this.listboxEl.contains(e.target)) return;
      this.close();
    }

    /**
     * Listbox acilir kutusunu acar.
     * @returns {void}
     */
    open() {
      if (!this.listboxEl) return;
      this.isOpen = true;
      this.listboxEl.classList.remove('hidden');
      if (this.inputEl) {
        this.inputEl.setAttribute('aria-expanded', 'true');
      }
    }

    /**
     * Listbox acilir kutusunu kapatir.
     * @returns {void}
     */
    close() {
      if (!this.listboxEl) return;
      this.isOpen = false;
      this.activeIndex = -1;
      this.listboxEl.classList.add('hidden');
      if (this.inputEl) {
        this.inputEl.setAttribute('aria-expanded', 'false');
        this.inputEl.removeAttribute('aria-activedescendant');
      }
    }

    /**
     * Listbox icerigini DOM icinde olusturur ve cizer.
     * @returns {void}
     */
    render() {
      if (!this.listboxEl) return;

      const results = this.currentResults;
      const query = this.currentQuery;

      if (results.length === 0) {
        this.listboxEl.innerHTML = `
          <div class="search-empty-state" role="status">
            <svg aria-hidden="true" class="ui-icon search-empty-icon" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            <div class="search-empty-text">
              <strong>"${escapeHtml(query)}"</strong> için sonuç bulunamadı.
            </div>
            <div class="search-empty-hint">Farklı anahtar kelimeler veya tür isimleri deneyebilirsiniz.</div>
          </div>
        `;
        return;
      }

      const visibleList = results.slice(0, this.maxResults);
      const totalCount = results.length;
      const cleanQuery = normalizeSearchText(query);

      const itemsHtml = visibleList
        .map((series, idx) => {
          const optId = `search-opt-${series.id || idx}`;
          const cover = series.cover || '';
          const chaptersCount = Array.isArray(series.chapters) ? series.chapters.length : 0;
          const type = series.type || 'Manhwa';
          const status = series.status || 'Devam Ediyor';

          const hasTitleMatch = normalizeSearchText(series.title).includes(cleanQuery);
          const hasAltMatch =
            Boolean(series.altTitle) && normalizeSearchText(series.altTitle).includes(cleanQuery);
          const hasTypeMatch = normalizeSearchText(type).includes(cleanQuery);
          const hasStatusMatch = normalizeSearchText(status).includes(cleanQuery);
          const hasGenreMatch = (series.genres || []).some((g) =>
            normalizeSearchText(g).includes(cleanQuery)
          );

          // Baslik vurgulama
          const titleHtml = highlightMatch(series.title, query);

          // Alternatif ad vurgulama
          const altHtml = series.altTitle ? highlightMatch(series.altTitle, query) : '';

          // Tur etiketleri siralamasi ve vurgusu
          let displayGenres = (series.genres || []).slice();
          if (hasGenreMatch) {
            displayGenres.sort((a, b) => {
              const aM = normalizeSearchText(a).includes(cleanQuery);
              const bM = normalizeSearchText(b).includes(cleanQuery);
              if (aM && !bM) return -1;
              if (!aM && bM) return 1;
              return 0;
            });
          }
          displayGenres = displayGenres.slice(0, 3);

          const genresHtml = displayGenres
            .map((g) => {
              const isGMatch = normalizeSearchText(g).includes(cleanQuery);
              return `<span class="search-genre-tag ${isGMatch ? 'is-matched' : ''}">${highlightMatch(g, query)}</span>`;
            })
            .join('');

          // Tur ve durum rozetleri
          const typeHtml = hasTypeMatch
            ? `<span class="search-badge badge-type is-matched">${highlightMatch(type, query)}</span>`
            : `<span class="search-badge badge-type">${escapeHtml(type)}</span>`;

          const statusHtml = hasStatusMatch
            ? `<span class="search-badge badge-status is-matched">${highlightMatch(status, query)}</span>`
            : `<span class="search-badge badge-status">${escapeHtml(status)}</span>`;

          // Eslesme ana baslikta degilse nereden eslestigini acikca goster
          let matchContextHtml = '';
          if (!hasTitleMatch) {
            if (hasAltMatch) {
              matchContextHtml = `<div class="search-match-source"><span class="search-match-label">Alternatif Ad:</span>${altHtml}</div>`;
            } else if (hasGenreMatch) {
              matchContextHtml = `<div class="search-match-source"><span class="search-match-label">Kategori Eşleşmesi</span></div>`;
            }
          }

          return `
            <div class="search-result-item" role="option" id="${escapeHtml(optId)}" data-series-id="${escapeHtml(series.id)}" aria-selected="false">
              <div class="search-result-thumb">
                ${
                  cover
                    ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(series.title)}" loading="lazy" onerror="this.style.display='none';" />`
                    : `<div class="search-thumb-fallback">#</div>`
                }
              </div>
              <div class="search-result-info">
                <div class="search-result-title">${titleHtml}</div>
                ${series.altTitle && !matchContextHtml ? `<div class="search-result-alt">${altHtml}</div>` : ''}
                ${matchContextHtml}
                <div class="search-result-meta">
                  ${typeHtml}
                  ${statusHtml}
                  <span class="search-badge badge-chapter">${chaptersCount} Bölüm</span>
                </div>
                ${
                  genresHtml
                    ? `<div class="search-result-genres">${genresHtml}</div>`
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

      const footerHtml = `
        <div class="search-result-footer" role="option" id="search-opt-view-all" data-action="view-all" aria-selected="false">
          <span class="search-footer-label">Tüm sonuçları katalogda gör (${totalCount} seri)</span>
          <svg aria-hidden="true" class="ui-icon" fill="none" height="14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>
      `;

      this.listboxEl.innerHTML = `
        <div class="search-results-list" role="presentation">
          ${itemsHtml}
        </div>
        ${footerHtml}
      `;
    }

    /**
     * Tum olay dinleyicilerini temizler ve bellek sizintisini onler.
     * @returns {void}
     */
    destroy() {
      if (this.inputEl) {
        this.inputEl.removeEventListener('input', this._boundInput);
        this.inputEl.removeEventListener('keydown', this._boundKeyDown);
        this.inputEl.removeEventListener('focus', this._boundFocus);
      }
      if (this.listboxEl) {
        this.listboxEl.removeEventListener('click', this._boundListboxClick);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', this._boundDocumentClick);
      }
      this.close();
      this._log('debug', 'SearchController yok edildi.');
    }
  }

  globalScope.SearchController = SearchController;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SearchController,
      normalizeSearchText,
      escapeHtml,
      highlightMatch,
      toNormalizedChar
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
