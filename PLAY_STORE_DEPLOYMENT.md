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

-   **Package ID:** `com.jeocompass.app` (Bu ID, `assetlinks.json` içindekiyle AYNI olmalıdır!)
-   **App Name:** JeoCompass
-   **Signing Key:**
    -   Eğer daha önce bir key oluşturduysanız "Use existing key" diyerek onu yükleyin.
    -   **Eğer ilk defa yüklüyorsanız:** "Create new key" seçeneğini kullanın.
    -   **ÇOK ÖNEMLİ:** Oluşturulan **Signing Key (Keystore) dosyasını ve şifrelerini güvenli bir yere kaydedin!** Kaybederseniz uygulamayı bir daha güncelleyemezsiniz.
-   **SHA-256 Fingerprint:**
    -   Bizim `assetlinks.json` dosyamızdaki parmak izi:
        `0D:A2:A9:27:A0:27:63:9E:82:B3:D6:47:E1:C8:E8:3B:88:2F:28:0F:21:A4:C3:33:D1:C8:9A:6A:B7:96:29:45`
    -   Eğer yeni bir key oluşturursanız, PWABuilder size **yeni bir SHA-256 parmak izi** verecektir.
    -   **Eğer parmak izi değişirse:** Yeni parmak izini kopyalayıp projenizdeki `.well-known/assetlinks.json` dosyasına yapıştırmalı ve GitHub'a tekrar yüklemelisiniz.

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
