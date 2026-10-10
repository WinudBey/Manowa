/**
 * @fileoverview Faz 1 birim testleri: Logger, ClientLogger ve ThemeBuilder modullerini dogrular.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Logger } = require('../src/core/logger');
const { ClientLogger } = require('../src/scripts/client-logger');
const { ThemeBuilder, MAX_LINES_PER_FILE } = require('../src/core/builder');

const TEST_LOG_PATH = path.resolve(__dirname, '../logs/test-app.log');

test('Logger: Baslatildiginda eski loglari temizlemeli ve DEBUG kaydi yazmali', () => {
  // Onceden eski veri yaz
  const dir = path.dirname(TEST_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TEST_LOG_PATH, 'ESKI_LOG_VERISI\n', 'utf8');

  // Yeni logger baslat (otomatik temizleme aktif)
  const logger = new Logger(TEST_LOG_PATH, true);
  logger.info('Test info mesaji', { step: 1 });
  logger.warn('Test warn mesaji');
  logger.error('Test error mesaji');

  const content = fs.readFileSync(TEST_LOG_PATH, 'utf8');
  assert.equal(content.includes('ESKI_LOG_VERISI'), false, 'Eski log verisi silinmis olmali');
  assert.equal(content.includes('[DEBUG] Logger baslatildi'), true);
  assert.equal(content.includes('[INFO] Test info mesaji'), true);
  assert.equal(content.includes('[WARN] Test warn mesaji'), true);
  assert.equal(content.includes('[ERROR] Test error mesaji'), true);
});

test('ClientLogger: Tarayici logger baslatildiginda kayitlari sifirlamali ve seviyeleri kaydetmeli', () => {
  const clientLogger = new ClientLogger('test_manowa_logs');
  // Ilk baslangicta sadece 1 adet DEBUG baslangic kaydi bulunur
  assert.equal(clientLogger.getEntries().length, 1);

  clientLogger.info('Okuma motoru hazir', { mode: 'webtoon' });
  assert.equal(clientLogger.getEntries().length, 2);
  assert.equal(clientLogger.getEntries()[1].level, 'INFO');

  clientLogger.clearLogs();
  assert.equal(clientLogger.getEntries().length, 0);
});

test('ThemeBuilder: 1000 satir sinirini asan dosyada hata firlatmali', () => {
  const logger = new Logger(TEST_LOG_PATH, true);
  const builder = new ThemeBuilder({ logger });

  const validContent = 'satir\n'.repeat(100);
  const lineCount = builder.validateLineLimit('src/styles/test.css', validContent);
  assert.equal(lineCount, 101);

  const oversizedContent = 'satir\n'.repeat(MAX_LINES_PER_FILE + 5);
  assert.throws(() => {
    builder.validateLineLimit('src/styles/oversized.css', oversizedContent);
  }, /Satir siniri ihlali/);
});

test('ThemeBuilder: theme.xml ve preview.html dosyalarini basariyla derlemeli', () => {
  const logger = new Logger(TEST_LOG_PATH, true);
  const builder = new ThemeBuilder({ logger });
  const { themeXmlPath, previewHtmlPath } = builder.build('<div id="test-marker">Manowa Test</div>');

  assert.equal(fs.existsSync(themeXmlPath), true);
  assert.equal(fs.existsSync(previewHtmlPath), true);

  const xmlContent = fs.readFileSync(themeXmlPath, 'utf8');
  assert.equal(xmlContent.includes('--bg-primary'), true, 'CSS degiskenleri XML icine gomulmeli');
  assert.equal(xmlContent.includes('ClientLogger'), true, 'JS modulleri XML icine gomulmeli');
  assert.equal(xmlContent.includes('id="test-marker"'), true, 'Govde icerigi gomulmeli');
});
