/**
 * @fileoverview Komut satirindan derleme islemini baslatan giris noktasi.
 * Her calistiginda log dosyasini sifirlar, dist/ ciktilarini uretir ve
 * yerel gelistirme ortaminda (CI disinda) dosyalari yerel Git indeksine (git add) kaydeder.
 */

const { execFileSync } = require('child_process');
const { Logger } = require('./logger');
const { ThemeBuilder } = require('./builder');

/**
 * Yerel gelistirme ortaminda derlenen kaynak ve cikti dosyalarini Git indeksine (stage) kaydeder.
 * Bu islem commit veya push yapmaz; yalnizca IDE geri almalarina karsi yerel durumu korur.
 * @param {string} rootDir - Proje kok dizini.
 * @param {Logger} logger - Logger nesnesi.
 * @returns {boolean} Indeksleme basariliysa true.
 */
function stageLocalBuildFiles(rootDir, logger) {
  if (process.env.CI) {
    return false;
  }
  try {
    execFileSync('git', ['add', 'src', 'tests', 'dist'], {
      cwd: rootDir,
      stdio: 'ignore'
    });
    logger.debug('Yerel kaynak ve derleme dosyalari Git indeksine (stage) kaydedildi.');
    return true;
  } catch (err) {
    logger.warn('Yerel Git indeksleme atlandi.', { message: err.message });
    return false;
  }
}

/**
 * CLI derleme surecini calistirir.
 * @returns {void}
 */
function runBuildCli() {
  const logger = new Logger();
  try {
    const builder = new ThemeBuilder({ logger });
    const result = builder.build();
    stageLocalBuildFiles(builder.rootDir, logger);
    console.log('Derleme tamamlandi:', result.themeXmlPath);
  } catch (error) {
    logger.error('Derleme sirasinda kritik hata olustu.', { message: error.message });
    console.error('Derleme hatasi:', error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runBuildCli();
}

module.exports = { runBuildCli, stageLocalBuildFiles };

