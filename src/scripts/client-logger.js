/**
 * @fileoverview Tarayici (Client-Side) ortaminda DEBUG seviyesine kadar kayit tutan modul.
 * Sayfa her baslatildiginda eski oturum loglarini temizler ve yeni kayit acar.
 */

(function (globalScope) {
  'use strict';

  /**
   * Tarayici ici log kayitlarini yoneten nesne.
   */
  class ClientLogger {
    /**
     * ClientLogger nesnesini baslatir ve eski kayitlari sifirlar.
     * @param {string} [storageKey='manowa_debug_logs'] - Oturum kayit anahtari.
     */
    constructor(storageKey = 'manowa_debug_logs') {
      this.storageKey = storageKey;
      this.entries = [];
      this.clearLogs();
      this.debug('ClientLogger baslatildi. Eski oturum loglari temizlendi.');
    }

    /**
     * Mevcut log dizisini ve sessionStorage kaydini temizler.
     * @returns {void}
     */
    clearLogs() {
      this.entries = [];
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(this.storageKey);
        }
      } catch (_err) {
        // Gizli sekme veya erisim kisitlamalarinda sessizce devam et
      }
    }

    /**
     * Belirtilen seviyede log kaydi ekler.
     * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} level - Log seviyesi.
     * @param {string} message - Aciklama mesaji.
     * @param {Object|null} [data=null] - Ek veri nesnesi.
     * @returns {Object} Olusturulan log kaydi.
     */
    write(level, message, data = null) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        data: data
      };
      this.entries.push(entry);

      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(this.storageKey, JSON.stringify(this.entries));
        }
      } catch (_err) {
        // Depolama siniri asilirsa bellekte tutmaya devam et
      }

      if (typeof console !== 'undefined') {
        const prefix = `[Manowa][${entry.timestamp}][${level}]`;
        if (level === 'ERROR' && console.error) {
          console.error(prefix, message, data || '');
        } else if (level === 'WARN' && console.warn) {
          console.warn(prefix, message, data || '');
        } else if (console.log) {
          console.log(prefix, message, data || '');
        }
      }

      return entry;
    }

    /**
     * DEBUG seviyesinde kayit yazar.
     * @param {string} message - Log mesaji.
     * @param {Object|null} [data=null] - Ek veri.
     * @returns {Object} Log kaydi.
     */
    debug(message, data = null) {
      return this.write('DEBUG', message, data);
    }

    /**
     * INFO seviyesinde kayit yazar.
     * @param {string} message - Log mesaji.
     * @param {Object|null} [data=null] - Ek veri.
     * @returns {Object} Log kaydi.
     */
    info(message, data = null) {
      return this.write('INFO', message, data);
    }

    /**
     * WARN seviyesinde kayit yazar.
     * @param {string} message - Log mesaji.
     * @param {Object|null} [data=null] - Ek veri.
     * @returns {Object} Log kaydi.
     */
    warn(message, data = null) {
      return this.write('WARN', message, data);
    }

    /**
     * ERROR seviyesinde kayit yazar.
     * @param {string} message - Log mesaji.
     * @param {Object|null} [data=null] - Ek veri.
     * @returns {Object} Log kaydi.
     */
    error(message, data = null) {
      return this.write('ERROR', message, data);
    }

    /**
     * Tum aktif oturum loglarini dondurur.
     * @returns {Array<Object>} Log listesi.
     */
    getEntries() {
      return this.entries.slice();
    }
  }

  const instance = new ClientLogger();
  globalScope.ManowaLogger = instance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ClientLogger, ManowaLogger: instance };
  }
})(typeof window !== 'undefined' ? window : globalThis);
