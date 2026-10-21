/**
 * @fileoverview Coklu parcalara (dilimlere) bolunmus Manga sayfalarini
 * tek bir HTML5 Canvas uzerinde kesintisiz birlestiren ve onbellege alan modul.
 */

(function (globalScope) {
  'use strict';

  /**
   * Bolunmus sayfa dilimlerini tek bir Canvas uzerinde birlestiren sinif.
   */
  class SliceMerger {
    /**
     * SliceMerger nesnesini baslatir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     * @param {Object} [options.logger=null] - Loglama nesnesi.
     * @param {number} [options.maxCacheSize=25] - Maksimum onbellek sayfa sayisi.
     */
    constructor(options = {}) {
      this.logger = options.logger || null;
      this.cache = new Map();
      this.inProgress = new Map();
      this.maxCacheSize = Number(options.maxCacheSize) || 25;
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
     * Gorsel URL'sinden "01_01", "01_02", "02-01" gibi bolunmus sayfa grup anahtarini cikarir.
     * @param {string} rawUrl - Gorsel URL dizgesi.
     * @returns {string|null} Mantiksal sayfa grup anahtari veya null.
     */
    static extractSliceGroupKey(rawUrl) {
      const rawStr = String(rawUrl || '');
      const cleanPath = rawStr.split(/[?#]/)[0];
      const hashPath = rawStr.includes('#') ? rawStr.split('#').pop() : '';
      const candidates = [cleanPath, hashPath, rawStr];

      for (const candidate of candidates) {
        const lastSegMatch = String(candidate || '').match(/([^/?#&]+)$/);
        if (!lastSegMatch) continue;
        let fileName = lastSegMatch[1];
        try { fileName = decodeURIComponent(fileName); } catch (_err) {}
        const baseName = fileName.replace(/\.(?:webp|jpe?g|png|gif|avif|bmp|svg)$/i, '').trim();
        const sliceMatch =
          baseName.match(/^(?:sayfa[_-]?|page[_-]?|p)?(\d+)[_](\d+)$/i) ||
          baseName.match(/^(\d{2,})[-_](\d{2,})$/);
        if (sliceMatch) return `page:${Number(sliceMatch[1])}`;
      }
      return null;
    }

    /**
     * Ham URL listesini ardisik mantiksal tam sayfa gruplarina donusturur.
     * @param {Array<string>} [rawPages=[]] - Ham URL dizisi.
     * @returns {Array<Array<string>>} Gruplanmis sayfa dilimleri.
     */
    static groupSlicedPages(rawPages = []) {
      if (!Array.isArray(rawPages) || rawPages.length === 0) return [];
      const groups = [];
      let currentGroup = [];
      let currentKey = null;

      rawPages.forEach((url) => {
        const key = SliceMerger.extractSliceGroupKey(url);
        if (key && key === currentKey && currentGroup.length > 0) {
          currentGroup.push(url);
        } else {
          currentGroup = [url];
          currentKey = key;
          groups.push(currentGroup);
        }
      });

      return groups;
    }

    /**
     * Dilim URL dizisinden onbellek anahtari olusturur.
     * @param {Array<string>} sliceUrls - Gorsel dilim URL dizisi.
     * @returns {string} Onbellek anahtari.
     */
    getCacheKey(sliceUrls) {
      if (!Array.isArray(sliceUrls)) return '';
      return sliceUrls.join('|');
    }

    /**
     * Verilen dilim grubunun onbellekte olup olmadigini sorgular.
     * @param {Array<string>} sliceUrls - Dilim URL dizisi.
     * @returns {boolean} Onbellekte mevcutsa true.
     */
    isCached(sliceUrls) {
      const key = this.getCacheKey(sliceUrls);
      return Boolean(key && this.cache.has(key));
    }

    /**
     * Tum bellek onbellegini ve surdurulen yuklemeleri sifirlar.
     * @returns {void}
     */
    clearCache() {
      this.cache.clear();
      this.inProgress.clear();
      this._log('debug', 'SliceMerger onbellegi temizlendi.');
    }

    /**
     * LRU politikasiyla onbellege oge ekler.
     * @private
     * @param {string} cacheKey - Onbellek anahtari.
     * @param {Object} entry - Onbellek kaydi.
     * @returns {void}
     */
    _putCache(cacheKey, entry) {
      if (!cacheKey) return;
      if (this.cache.has(cacheKey)) {
        this.cache.delete(cacheKey);
      } else if (this.cache.size >= this.maxCacheSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(cacheKey, entry);
    }

    /**
     * Arka plan canvas nesnesi uzerine dilimleri cizer.
     * @private
     * @param {Object} data - Yuklenen gorsel verileri.
     * @returns {HTMLCanvasElement|null} Olusturulan bellek canvas'i.
     */
    _createOffscreenCanvas(data) {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return null;
      }
      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = data.width;
        offscreen.height = data.height;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return null;
        let currentY = 0;
        for (const img of data.images) {
          const imgW = img.naturalWidth || img.width || data.width;
          const imgH = img.naturalHeight || img.height || 0;
          const offsetX = Math.max(0, Math.round((data.width - imgW) / 2));
          ctx.drawImage(img, offsetX, currentY, imgW, imgH);
          currentY += imgH;
        }
        return offscreen;
      } catch (_err) {
        return null;
      }
    }

    /**
     * Onbellek kaydini hedef DOM canvas nesnesine aktarir.
     * @private
     * @param {HTMLCanvasElement} targetCanvas - Hedef canvas elemani.
     * @param {Object} entry - Onbellek verisi.
     * @returns {boolean} Basarili ise true.
     */
    _drawIntoCanvas(targetCanvas, entry) {
      if (!targetCanvas || typeof targetCanvas.getContext !== 'function' || !entry) {
        return false;
      }
      targetCanvas.width = entry.width;
      targetCanvas.height = entry.height;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return false;

      if (entry.offscreen) {
        ctx.drawImage(entry.offscreen, 0, 0);
      } else if (Array.isArray(entry.images)) {
        let currentY = 0;
        for (const img of entry.images) {
          const imgW = img.naturalWidth || img.width || entry.width;
          const imgH = img.naturalHeight || img.height || 0;
          const offsetX = Math.max(0, Math.round((entry.width - imgW) / 2));
          ctx.drawImage(img, offsetX, currentY, imgW, imgH);
          currentY += imgH;
        }
      }
      targetCanvas.setAttribute('data-stitched', 'true');
      targetCanvas.classList.add('stitched-ready');
      return true;
    }

    /**
     * Tek bir gorseli asenkron cozme (async decode) destegiyle yukler.
     * @param {string} url - Gorsel URL'si.
     * @returns {Promise<HTMLImageElement>} Yuklenen Image nesnesi.
     */
    loadImage(url) {
      return new Promise((resolve, reject) => {
        if (typeof Image === 'undefined') {
          return reject(new Error('Image constructor bulunamadi (Node ortami)'));
        }
        let settled = false;
        const doResolve = (targetImg) => {
          if (settled) return;
          settled = true;
          resolve(targetImg);
        };
        const doReject = (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        };

        const img = new Image();
        if ('decoding' in img) {
          img.decoding = 'async';
        }
        img.onload = () => {
          if (typeof img.decode === 'function') {
            img.decode().then(() => doResolve(img)).catch(() => doResolve(img));
          } else {
            doResolve(img);
          }
        };
        img.onerror = () => {
          doReject(new Error(`Gorsel yuklenemedi: ${url}`));
        };
        img.src = url;
        if (img.complete && (img.naturalWidth || img.width)) {
          doResolve(img);
        }
      });
    }

    /**
     * Verilen tum dilimleri paralel yukler ve birlesik boyutlari hesaplar.
     * @param {Array<string>} sliceUrls - Dilim URL dizisi.
     * @returns {Promise<{ images: Array<HTMLImageElement>, width: number, height: number }>}
     */
    async loadAllSlices(sliceUrls) {
      const images = await Promise.all(sliceUrls.map((url) => this.loadImage(url)));
      let maxWidth = 0;
      let totalHeight = 0;

      for (const img of images) {
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        if (w > maxWidth) maxWidth = w;
        totalHeight += h;
      }

      return {
        images,
        width: Math.max(1, maxWidth),
        height: Math.max(1, totalHeight)
      };
    }

    /**
     * Dilimleri arka planda onceden indirip hafizada birlestirir (Preload).
     * @param {Array<string>} sliceUrls - Birlestirilecek dilim URL dizisi.
     * @returns {Promise<Object|null>} Onbellek kaydi Promise nesnesi.
     */
    async preload(sliceUrls) {
      if (typeof Image === 'undefined' || !Array.isArray(sliceUrls) || sliceUrls.length <= 1) return null;
      const cacheKey = this.getCacheKey(sliceUrls);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      if (this.inProgress.has(cacheKey)) {
        return this.inProgress.get(cacheKey);
      }

      const loadPromise = (async () => {
        try {
          const data = await this.loadAllSlices(sliceUrls);
          const offscreen = this._createOffscreenCanvas(data);
          const entry = {
            width: data.width,
            height: data.height,
            images: data.images,
            offscreen
          };
          this._putCache(cacheKey, entry);
          return entry;
        } catch (err) {
          this._log('warn', 'Parca on yukleme basarisiz oldu', { error: err.message });
          return null;
        } finally {
          this.inProgress.delete(cacheKey);
        }
      })();

      this.inProgress.set(cacheKey, loadPromise);
      return loadPromise;
    }

    /**
     * DOM uzerindeki canvas elemanina dilimleri cizer.
     * Onbellekte varsa aninda 0ms gecikmeyle aktarir.
     * @param {HTMLCanvasElement} canvas - Hedef canvas elemani.
     * @param {Array<string>} sliceUrls - Birlestirilecek dilim URL dizisi.
     * @returns {Promise<boolean>} Basarili ise true.
     */
    async stitchCanvas(canvas, sliceUrls) {
      if (!canvas || !Array.isArray(sliceUrls) || sliceUrls.length === 0) {
        return false;
      }
      if (typeof canvas.getContext !== 'function') {
        return false;
      }

      const cacheKey = this.getCacheKey(sliceUrls);

      // Hizli yol: Bellek onbelleginden aninda aktarim (0ms)
      if (this.cache.has(cacheKey)) {
        const cachedEntry = this.cache.get(cacheKey);
        this._putCache(cacheKey, cachedEntry);
        return this._drawIntoCanvas(canvas, cachedEntry);
      }

      this._log('debug', 'Parca birlestirme baslatildi', {
        sliceCount: sliceUrls.length,
        cacheKey
      });

      try {
        let loadPromise = this.inProgress.get(cacheKey);
        if (!loadPromise) {
          loadPromise = (async () => {
            const data = await this.loadAllSlices(sliceUrls);
            const offscreen = this._createOffscreenCanvas(data);
            const entry = {
              width: data.width,
              height: data.height,
              images: data.images,
              offscreen
            };
            this._putCache(cacheKey, entry);
            return entry;
          })();
          this.inProgress.set(cacheKey, loadPromise);
        }

        const entry = await loadPromise;
        this.inProgress.delete(cacheKey);

        const ok = this._drawIntoCanvas(canvas, entry);
        if (ok) {
          this._log('info', 'Parcalar basariyla birlestirildi', {
            width: entry.width,
            height: entry.height,
            sliceCount: sliceUrls.length
          });
        }
        return ok;
      } catch (err) {
        this.inProgress.delete(cacheKey);
        this._log('warn', 'Parca birlestirme basarisiz oldu, fallback devrede', {
          error: err.message
        });
        return false;
      }
    }
  }

  globalScope.SliceMerger = SliceMerger;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SliceMerger };
  }
})(typeof window !== 'undefined' ? window : global);

