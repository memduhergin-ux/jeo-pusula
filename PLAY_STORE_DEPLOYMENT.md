# Google Play Store Yükleme Rehberi

Bu rehber, JeoCompass uygulamasını (PWA) Google Play Store'a yüklemek için gerekli adımları içerir.

## 1. Ön Hazırlık (Zaten Yapıldı ✅)
- Uygulamanız GitHub Pages üzerinde yayınlandı: `https://memduhergin-ux.github.io/jeo-pusula/`
- Manifest dosyası ve ikonlar hazır.
- **Asset Links** dosyası hazır (`.well-known/assetlinks.json`).

## 2. Android Paketini Oluşturma (PWABuilder Kullanarak)
Uygulamayı bir Android uygulamasına (.aab formatı) dönüştürmemiz gerekiyor. Bunun için Microsoft'un ücretsiz aracı PWABuilder'ı kullanacağız.

1.  **PWABuilder'a Git:** [https://www.pwabuilder.com/](https://www.pwabuilder.com/) adresini açın.
2.  **URL Gir:** Site adresinizi (`https://memduhergin-ux.github.io/jeo-pusula/`) kutuya yapıştırın ve **Start** butonuna basın.
3.  **Analiz:** Sistem sitenizi analiz edecek. "Manifest", "Service Worker" ve "Security" alanlarının **yeşil tik** olduğundan emin olun.
4.  **Paket Oluştur:** "Build My PWA" butonuna tıklayın.
5.  **Android Seç:** Android kartındaki **Store Package** butonuna tıklayın.

### ⚠️ Önemli Ayarlar (Signing Key)
Burada "Signing Key" (İmza Anahtarı) oluşturmanız veya mevcut olanı yüklemeniz istenecek.

-   **Package ID:** `io.github.memduhergin_ux.twa`
-   **App Name:** JeoCompass
-   **Signing Key:**
    -   PWABuilder üzerinden oluşturduğunuz `.keystore` dosyasını saklayın.
-   **SHA-256 Fingerprint:**
    -   Bizim `assetlinks.json` dosyamıza işlediğimiz yeni parmak izi:
        `C2:24:79:D5:77:7F:F1:BD:60:C4:58:D0:18:F0:EB:7C:4C:F9:B0:BD:F7:2A:6B:EA:CC:92:5F:5C:37:49:C7:CA`

6.  **İndir:** Ayarları tamamladıktan sonra "Download" butonuna basarak `.zip` dosyasını indirin. İçinde `.aab` (Android App Bundle) dosyası olacak.

## 3. Google Play Console'a Yükleme

1.  **Play Console'a Girin:** [https://play.google.com/console](https://play.google.com/console) adresine gidin.
2.  **Uygulama Seç/Oluştur:** JeoCompass uygulamasını seçin veya "Uygulama Oluştur" diyerek yeni bir tane açın.
3.  **Üretim (Production):** Sol menüden "Üretim" (Production) sekmesine gelin.
4.  **Yeni Sürüm:** "Yeni sürüm oluştur" (Create new release) butonuna basın.
5.  **App Bundle Yükle:** İndirdiğiniz `.aab` dosyasını buraya sürükleyip bırakın.
6.  **İnceleme:** Sürüm notlarını girin (örneğin: "Analysis tools update and bug fixes") ve "İncele" (Review) butonuna basın.
7.  **Yayınla:** Hata yoksa "Üretime Başla" (Start rollout to production) diyerek yayına alın.

## 4. Doğrulama (Asset Links)
Google Play, uygulamanızı ilk açtığında sitenizdeki `assetlinks.json` dosyasını kontrol eder.
-   Eğer parmak izleri eşleşirse, uygulamanız tarayıcı adres çubuğu OLMADAN (tam ekran) açılır.
-   Eşleşmezse, üstte adres çubuğu görünür.

**Not:** Play Store incelemesi birkaç gün sürebilir.
