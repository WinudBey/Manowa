/**
 * @fileoverview Uygulama genelinde DEBUG seviyesine kadar kayit tutan loglama modulu.
 * Proje her baslatildiginda mevcut log dosyasini temizler ve yeni oturum kaydi acar.
 */

const fs = require('fs');
const path = require('path');

/**
 * Desteklenen log seviyeleri ve sayisal oncelikleri.
 * @enum {number}
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Varsayilan log dosyasi yolu.
 * @type {string}
 */
const DEFAULT_LOG_FILE = path.resolve(__dirname, '../../logs/app.log');

/**
 * Loglama islemlerini yoneten sinif.
 */
class Logger {
  /**
   * Logger sinifini baslatir.
   * @param {string} [logFilePath=DEFAULT_LOG_FILE] - Loglarin yazilacagi dosya yolu.
   * @param {boolean} [clearOnStart=true] - Baslangicta log dosyasinin temizlenip temizlenmeyecegi.
   */
  constructor(logFilePath = DEFAULT_LOG_FILE, clearOnStart = true) {
    this.logFilePath = logFilePath;
    this.initialized = false;
    if (clearOnStart) {
      this.initLogger();
    }
  }

  /**
   * Log dizinini olusturur ve eski log dosyasini temizler.
   * @returns {void}
   */
  initLogger() {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    // Proje her baslatildiginda eski loglari temizle
    const header = `=== LOG OTURUMU BASLADI: ${new Date().toISOString()} ===\n`;
    fs.writeFileSync(this.logFilePath, header, { encoding: 'utf8' });
    this.initialized = true;
    this.debug('Logger baslatildi ve eski log dosyasi temizlendi.');
  }

  /**
   * Belirtilen seviyede log mesaji yazar.
   * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} level - Log seviyesi.
   * @param {string} message - Kaydedilecek aciklama mesaji.
   * @param {Object} [meta=null] - Ek baglamsal veri.
   * @returns {string} Formatlanmis log satiri.
   */
  log(level, message, meta = null) {
    if (!this.initialized) {
      this.initLogger();
    }
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` | META: ${JSON.stringify(meta)}` : '';
    const formattedLine = `[${timestamp}] [${level}] ${message}${metaString}\n`;

    fs.appendFileSync(this.logFilePath, formattedLine, { encoding: 'utf8' });
    return formattedLine.trim();
  }

  /**
   * DEBUG seviyesinde detayli gelistirici kaydi yazar.
   * @param {string} message - Log mesaji.
   * @param {Object} [meta=null] - Ek veri.
   * @returns {string} Formatlanmis log satiri.
   */
  debug(message, meta = null) {
    return this.log('DEBUG', message, meta);
  }

  /**
   * INFO seviyesinde genel bilgilendirme kaydi yazar.
   * @param {string} message - Log mesaji.
   * @param {Object} [meta=null] - Ek veri.
   * @returns {string} Formatlanmis log satiri.
   */
  info(message, meta = null) {
    return this.log('INFO', message, meta);
  }

  /**
   * WARN seviyesinde uyari kaydi yazar.
   * @param {string} message - Log mesaji.
   * @param {Object} [meta=null] - Ek veri.
   * @returns {string} Formatlanmis log satiri.
   */
  warn(message, meta = null) {
    return this.log('WARN', message, meta);
  }

  /**
   * ERROR seviyesinde hata kaydi yazar.
   * @param {string} message - Log mesaji.
   * @param {Object} [meta=null] - Ek veri.
   * @returns {string} Formatlanmis log satiri.
   */
  error(message, meta = null) {
    return this.log('ERROR', message, meta);
  }
}

module.exports = {
  Logger,
  LOG_LEVELS,
  DEFAULT_LOG_FILE
};
