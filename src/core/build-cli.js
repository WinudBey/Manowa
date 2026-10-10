/**
 * @fileoverview Komut satirindan derleme islemini baslatan giris noktasi.
 * Her calistiginda log dosyasini sifirlar ve dist/ ciktilarini uretir.
 */

const { Logger } = require('./logger');
const { ThemeBuilder } = require('./builder');

/**
 * CLI derleme surecini calistirir.
 * @returns {void}
 */
function runBuildCli() {
  const logger = new Logger();
  try {
    const builder = new ThemeBuilder({ logger });
    const result = builder.build();
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

module.exports = { runBuildCli };
