@echo off
chcp 65001 >nul
echo ========================================================
echo  Manowa - Blogger Tum Seriler Sayfasi Otomatik Yayimlayici
echo ========================================================
echo.
echo Playwright tarayicisi baslatiliyor...
echo Lutfen acilacak pencerede Google hesabiniza giris yapiniz.
echo Giris yaptiginizda sayfa otomatik olusturulacaktir.
echo.
node tests/publish-static-page-playwright.js
echo.
echo Islem tamamlandi. Pencereyi kapatmak icin bir tusa basiniz.
pause >nul
