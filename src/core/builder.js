/**
 * @fileoverview Moduler CSS, JS ve sablon dosyalarini birlestirerek Blogger XML temasini
 * (dist/theme.xml) ve yerel onizleme dosyasini (dist/preview.html) ureten derleme modulu.
 * Ayrica 1000 satir siniri kuralini otomatik olarak denetler.
 */

const fs = require('fs');
const path = require('path');
const { Logger } = require('./logger');

/**
 * Bir kaynak dosyanin asmamasi gereken maksimum satir sayisi.
 * @type {number}
 */
const MAX_LINES_PER_FILE = 1000;

/**
 * Proje modullerini derleyen sinif.
 */
class ThemeBuilder {
  /**
   * ThemeBuilder nesnesini yapilandirir.
   * @param {Object} [options={}] - Derleme secenekleri.
   * @param {string} [options.rootDir] - Proje kok dizini.
   * @param {Logger} [options.logger] - Kullanilacak logger nesnesi.
   */
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.resolve(__dirname, '../..');
    this.srcDir = path.join(this.rootDir, 'src');
    this.distDir = path.join(this.rootDir, 'dist');
    this.logger = options.logger || new Logger();
  }

  /**
   * Verilen dosyanin satir sayisini kontrol eder ve 1000 satiri asarsa hata firlatir.
   * @param {string} filePath - Kontrol edilecek dosyanin tam yolu.
   * @param {string} content - Dosya icerigi.
   * @returns {number} Dosyanin satir sayisi.
   * @throws {Error} Dosya 1000 satiri gecerse hata firlatir.
   */
  validateLineLimit(filePath, content) {
    const lineCount = content.split(/\r?\n/).length;
    const relativePath = path.relative(this.rootDir, filePath);
    this.logger.debug(`Satir siniri kontrol ediliyor: ${relativePath}`, { lineCount });

    if (lineCount > MAX_LINES_PER_FILE) {
      const errorMsg = `Satir siniri ihlali: ${relativePath} (${lineCount} satir > ${MAX_LINES_PER_FILE}).`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    return lineCount;
  }

  /**
   * Canli Blogger temasi (theme.xml) icin <!-- DEV_ONLY_START --> ve <!-- DEV_ONLY_END -->
   * arasindaki gelistirici araci bloklarini temizler.
   * @param {string} htmlContent - Ham HTML icerigi.
   * @returns {string} Gelistirici bloklarindan arindirilmis HTML icerigi.
   */
  stripDevOnlyBlocks(htmlContent) {
    if (!htmlContent) {
      return '';
    }
    return String(htmlContent)
      .replace(/<!--\s*DEV_ONLY_START\s*-->[\s\S]*?<!--\s*DEV_ONLY_END\s*-->/g, '')
      .trim();
  }

  /**
   * Belirtilen dizindeki belirli uzantili dosyalari alfabetik veya verilen siraya gore okur.
   * @param {string} subDir - src altindaki klasor adi (orn. 'styles', 'scripts').
   * @param {string} extension - Dosya uzantisi (orn. '.css', '.js').
   * @param {Array<string>} [priorityFiles=[]] - Ilk sirada yuklenmesi gereken dosya adlari.
   * @param {Array<string>} [excludedFiles=[]] - Haric tutulacak dosya adlari.
   * @returns {string} Birlestirilmis dosya icerikleri.
   */
  bundleDirectory(subDir, extension, priorityFiles = [], excludedFiles = []) {
    const targetDir = path.join(this.srcDir, subDir);
    if (!fs.existsSync(targetDir)) {
      this.logger.warn(`Dizin bulunamadi, atlaniyor: ${targetDir}`);
      return '';
    }

    const allFiles = fs
      .readdirSync(targetDir)
      .filter((file) => file.endsWith(extension) && !excludedFiles.includes(file));
    const orderedFiles = [
      ...priorityFiles.filter((file) => allFiles.includes(file)),
      ...allFiles.filter((file) => !priorityFiles.includes(file)).sort()
    ];

    this.logger.info(`${subDir} modulleri birlestiriliyor.`, { files: orderedFiles });

    const chunks = orderedFiles.map((fileName) => {
      const fullPath = path.join(targetDir, fileName);
      const content = fs.readFileSync(fullPath, 'utf8');
      this.validateLineLimit(fullPath, content);
      return `/* === MODULE: ${subDir}/${fileName} === */\n${content.trim()}`;
    });

    return chunks.join('\n\n');
  }

  /**
   * Blogger XML ve yerel onizleme HTML dosyalarini derler ve dist/ klasorune yazar.
   * @param {string} [bodyContent=null] - Ana govdeye eklenecek ek HTML/XML parcalari.
   * @returns {{ themeXmlPath: string, previewHtmlPath: string }} Uretilen dosya yollari.
   */
  build(bodyContent = null) {
    this.logger.info('Derleme islemi baslatildi.');

    if (!fs.existsSync(this.distDir)) {
      fs.mkdirSync(this.distDir, { recursive: true });
      this.logger.debug(`Cikti dizini olusturuldu: ${this.distDir}`);
    }

    const baseXmlPath = path.join(this.srcDir, 'templates', 'base.xml');
    const previewShellPath = path.join(this.srcDir, 'templates', 'preview-shell.html');
    const bodyContentPath = path.join(this.srcDir, 'templates', 'body-content.html');

    const baseXml = fs.readFileSync(baseXmlPath, 'utf8');
    const previewShell = fs.readFileSync(previewShellPath, 'utf8');

    this.validateLineLimit(baseXmlPath, baseXml);
    this.validateLineLimit(previewShellPath, previewShell);

    let resolvedBody = bodyContent;
    if (resolvedBody === null) {
      if (fs.existsSync(bodyContentPath)) {
        resolvedBody = fs.readFileSync(bodyContentPath, 'utf8');
        this.validateLineLimit(bodyContentPath, resolvedBody);
      } else {
        resolvedBody = '';
      }
    }

    const styleOrder = [
      'variables.css',
      'loaders.css',
      'cards.css',
      'directory.css',
      'series-page.css',
      'hero-slider.css',
      'sidebar.css',
      'search.css',
      'generator.css',
      'layout.css',
      'reader.css',
      'reader-novel.css'
    ];
    const scriptOrder = [
      'client-logger.js',
      'svg-icons.js',
      'disqus-loader.js',
      'blogger-feed-loader.js',
      'catalog-controller.js',
      'user-library.js',
      'series-page.js',
      'directory-page.js',
      'hero-slider.js',
      'sidebar-controller.js',
      'loader-controller.js',
      'novel-font-loader.js',
      'slice-merger.js',
      'reading-engine.js',
      'reader-hud.js',
      'post-generator.js',
      'router-controller.js',
      'blogger-theme-bridge.js',
      'search-controller.js',
      'app-init.js'
    ];

    // Canli Tema (theme.xml) icin gelistirici modullerini ve DEV_ONLY bloklarini temizle
    const themeStylesBundle = this.bundleDirectory('styles', '.css', styleOrder, [
      'generator.css',
      'reader-next.css'
    ]);
    const themeScriptsBundle = this.bundleDirectory('scripts', '.js', scriptOrder, [
      'post-generator.js',
      'reader-next-controller.js'
    ]);
    const themeBody = this.stripDevOnlyBlocks(resolvedBody);

    // Yerel Onizleme (preview.html) icin tum gelistirici araclarini koru
    const previewStylesBundle = this.bundleDirectory('styles', '.css', styleOrder, [
      'reader-next.css'
    ]);
    const previewScriptsBundle = this.bundleDirectory('scripts', '.js', scriptOrder, [
      'reader-next-controller.js'
    ]);

    // Blogger XML ciktisini olustur
    const finalXml = baseXml
      .replace('/* {{STYLES}} */', themeStylesBundle)
      .replace('<!-- {{BODY_CONTENT}} -->', themeBody)
      .replace('// {{SCRIPTS}}', themeScriptsBundle);

    // Yerel onizleme HTML ciktisini olustur
    const finalPreview = previewShell
      .replace('/* {{STYLES}} */', previewStylesBundle)
      .replace('<!-- {{BODY_CONTENT}} -->', resolvedBody)
      .replace('// {{SCRIPTS}}', previewScriptsBundle);

    const themeXmlPath = path.join(this.distDir, 'theme.xml');
    const previewHtmlPath = path.join(this.distDir, 'preview.html');
    const personalXmlPath = path.join(this.distDir, 'theme.personal.xml');
    const readerPreviewHtmlPath = path.join(this.distDir, 'reader-preview.html');

    fs.writeFileSync(themeXmlPath, finalXml, 'utf8');
    fs.writeFileSync(previewHtmlPath, finalPreview, 'utf8');

    // Bagimsiz yeni okuyucu test dosyasini (dist/reader-preview.html) olustur
    const readerShellPath = path.join(this.srcDir, 'templates', 'reader-preview-shell.html');
    if (fs.existsSync(readerShellPath)) {
      const readerShell = fs.readFileSync(readerShellPath, 'utf8');
      this.validateLineLimit(readerShellPath, readerShell);
      const readerStyles = this.bundleDirectory(
        'styles',
        '.css',
        ['variables.css', 'loaders.css', 'reader.css', 'reader-next.css'],
        ['cards.css', 'series-page.css', 'hero-slider.css', 'sidebar.css', 'generator.css', 'layout.css']
      );
      const readerScripts = this.bundleDirectory(
        'scripts',
        '.js',
        ['client-logger.js', 'svg-icons.js', 'loader-controller.js', 'reading-engine.js', 'reader-next-controller.js'],
        [
          'disqus-loader.js',
          'blogger-feed-loader.js',
          'catalog-controller.js',
          'user-library.js',
          'series-page.js',
          'hero-slider.js',
          'sidebar-controller.js',
          'post-generator.js',
          'router-controller.js',
          'blogger-theme-bridge.js',
          'app-init.js'
        ]
      );
      const finalReaderPreview = readerShell
        .replace('/* {{READER_STYLES}} */', readerStyles)
        .replace('// {{READER_SCRIPTS}}', readerScripts);
      fs.writeFileSync(readerPreviewHtmlPath, finalReaderPreview, 'utf8');
    }

    if (fs.existsSync(personalXmlPath)) {
      const existingPersonal = fs.readFileSync(personalXmlPath, 'utf8');
      const cfgMatch = existingPersonal.match(
        /(\/\*\s*===\s*LOCAL PERSONAL CONFIG\s*===\s*\*\/[\s\S]*?)(?=\/\*\s*===\s*MODULE:)/
      );
      const personalHeader = cfgMatch ? cfgMatch[1] : '';
      const updatedPersonal = personalHeader
        ? finalXml.replace('//<![CDATA[\n', `//<![CDATA[\n${personalHeader}`)
        : finalXml;
      fs.writeFileSync(personalXmlPath, updatedPersonal, 'utf8');
    }

    this.logger.info('Derleme basariyla tamamlandi.', {
      themeXmlPath,
      previewHtmlPath,
      readerPreviewHtmlPath
    });

    return { themeXmlPath, previewHtmlPath, readerPreviewHtmlPath };
  }
}

module.exports = {
  ThemeBuilder,
  MAX_LINES_PER_FILE
};
