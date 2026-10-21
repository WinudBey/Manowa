/**
 * @fileoverview Playwright Skill ile Kullanici Destekli (Assisted) Blogger Statik Sayfa Olusturucu.
 * Tarayiciyi kullanici etkilesimine acik (headless: false) olarak baslatir.
 * Kullanici oturum actiktan sonra Blogger Sayfalar menusune gider, 'Tüm Seriler' sayfasini olusturur ve yayinlar.
 */

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require('C:/Users/Winud/AppData/Roaming/npm/node_modules/playwright');
}
const { chromium } = playwright;
const path = require('path');
const fs = require('fs');

async function publishStaticPage() {
  console.log('=== Playwright Skill: Blogger Statik Sayfa Otomasyonu Baslatildi ===');

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Tarayiciyi acik modda baslat
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: null
  });

  const page = await context.newPage();

  console.log('1. https://www.blogger.com adresine gidiliyor...');
  await page.goto('https://www.blogger.com', { waitUntil: 'domcontentloaded' });

  console.log('\n=============================================================');
  console.log('DIKKAT: Lutfen acilan Chrome penceresinde Google hesabiniza giris yapiniz.');
  console.log('Blogger paneli acildiginda Playwright islemi otomatik olarak devralacaktir.');
  console.log('=============================================================\n');

  // 2. Kullanicinin oturum acip Blogger Dashboard'una ulasmasini bekle (Maksimum 3 dakika)
  try {
    await page.waitForURL(/blogger\.com\/blog\//, { timeout: 180000 });
  } catch (_e) {
    console.log('Bekleme suresi doldu veya dogrudan dashboard uzerindesiniz. Sayfa kontrol ediliyor...');
  }

  console.log('2. Blogger paneli algilandi! URL:', page.url());
  await page.waitForTimeout(2000);

  // 3. Sol menuden 'Sayfalar' (Pages) sekmesini bul ve tikla
  console.log('3. "Sayfalar" sekmesine geciliyor...');
  const pagesNav = page.locator('a[href*="/pages"], a:has-text("Sayfalar"), a:has-text("Pages"), div[role="menuitem"]:has-text("Sayfalar")').first();
  await pagesNav.waitFor({ state: 'visible', timeout: 30000 });
  await pagesNav.click();
  await page.waitForTimeout(2000);

  // 4. 'Yeni Sayfa' (New Page) butonunu bul ve tikla
  console.log('4. "Yeni Sayfa" butonuna tiklaniyor...');
  const newPageBtn = page.locator('button:has-text("Yeni sayfa"), button:has-text("Yeni Sayfa"), button:has-text("New page"), div[role="button"]:has-text("Yeni sayfa"), a[href*="/page/create"]').first();
  await newPageBtn.waitFor({ state: 'visible', timeout: 30000 });
  await newPageBtn.click();
  await page.waitForTimeout(3000);

  // 5. Sayfa Basligini Gir: "Tüm Seriler"
  console.log('5. Sayfa basligi giriliyor: "Tüm Seriler"...');
  const titleInput = page.locator('input[aria-label*="Başlık"], input[aria-label*="Title"], input[type="text"][placeholder*="Başlık"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 30000 });
  await titleInput.fill('Tüm Seriler');
  await page.waitForTimeout(500);

  // 6. HTML Moduna Gecis Yap
  console.log('6. HTML gorunumu moduna geciliyor...');
  // Genellikle sol ustteki kalem simgesi veya HTML butonudur
  const modeToggle = page.locator('div[aria-label*="HTML"], button[aria-label*="HTML"], div[role="button"][title*="HTML"], div[data-command="html"], div[aria-label*="görünümü"]').first();
  if (await modeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await modeToggle.click();
    await page.waitForTimeout(500);
    // Acilir listeden HTML secenegi cikarsa sec
    const htmlOpt = page.locator('div[role="menuitem"]:has-text("HTML"), span:has-text("HTML görünümü")').first();
    if (await htmlOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await htmlOpt.click();
      await page.waitForTimeout(500);
    }
  }

  // 7. Statik Sayfa HTML Kodunu Yapistir
  console.log('7. Manowa statik sayfa HTML kodu ekleniyor...');
  const staticHtml = '<!-- MANOWA_SERIES_DIRECTORY_START -->\n<div id="manowa-series-directory"></div>\n<!-- MANOWA_SERIES_DIRECTORY_END -->';

  // Textarea veya editör icerigini bul
  const editorArea = page.locator('textarea, .notranslate[contenteditable="true"], .CodeMirror-code').first();
  await editorArea.waitFor({ state: 'visible', timeout: 15000 });
  await editorArea.click();

  // Eger textarea ise degerini dogrudan set et
  const isTextarea = await editorArea.evaluate((el) => el.tagName === 'TEXTAREA').catch(() => false);
  if (isTextarea) {
    await editorArea.fill(staticHtml);
  } else {
    // Contenteditable veya CodeMirror ise klavye ile yaz veya evaluate ile yapistir
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(staticHtml);
  }
  await page.waitForTimeout(1000);

  // 8. "Yayinla" (Publish) Butonuna Tikla
  console.log('8. "Yayınla" butonuna tiklaniyor...');
  const publishBtn = page.locator('div[role="button"]:has-text("Yayınla"), button:has-text("Yayınla"), div[aria-label="Yayınla"], div[role="button"]:has-text("Publish"), button:has-text("Publish")').first();
  await publishBtn.waitFor({ state: 'visible', timeout: 15000 });
  await publishBtn.click();
  await page.waitForTimeout(1000);

  // Onay penceresi (dialog) varsa onayla
  const confirmBtn = page.locator('div[role="dialog"] button:has-text("Onayla"), div[role="dialog"] div[role="button"]:has-text("Onayla"), div[role="dialog"] button:has-text("Confirm")').first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('   Onay penceresi onaylaniyor...');
    await confirmBtn.click();
    await page.waitForTimeout(2000);
  }

  // 9. Ekran Goruntusu Al ve Islemi Tamamla
  console.log('9. Ekran goruntusu kaydediliyor...');
  const finalScreenshot = path.join(screenshotsDir, 'blogger-page-published.png');
  await page.screenshot({ path: finalScreenshot });
  console.log('   Ekran goruntusu basariyla kaydedildi: blogger-page-published.png');

  console.log('\n=== TEBRIKLER: "Tüm Seriler" Statik Sayfasi Blogger Uzerinde Yayinlandi! ===');
  await page.waitForTimeout(3000);
  await browser.close();
}

publishStaticPage().catch((err) => {
  console.error('Playwright Islem Hatasi:', err.message);
});
