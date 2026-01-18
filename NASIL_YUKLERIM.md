# Jeoloji Pusulası - Telefonunuza Yükleme Talimatları

## 📱 ADIM ADIM KURULUM

### Yöntem 1: USB ile Kurulum (Basit)

1. **Dosyaları Hazırlayın:**
   - Bu klasördeki TÜM dosyaları telefonunuza kopyalayacaksınız
   - Dosyalar: index.html, style.css, app.js, manifest.json, icon-192.png, icon-512.png

2. **Telefonunuza Aktarın:**
   - USB kablo ile telefonunuzu bilgisayara bağlayın
   - Telefon dahili belleğinde yeni bir klasör oluşturun (örn: "JeolojiPusulasi")
   - Bu klasördeki TÜM dosyaları telefondaki klasöre kopyalayın

3. **Uygulamayı Açın:**
   - Telefonunuzda bir dosya yöneticisi uygulaması açın
   - Kopyaladığınız klasöre gidin
   - "index.html" dosyasına dokunun
   - "Chrome" veya başka bir tarayıcı seçin
   - Uygulama açılacak!

4. **Ana Ekrana Ekleyin (İsteğe Bağlı):**
   - Chrome menüsünü açın (⋮)
   - "Ana ekrana ekle" seçeneğini seçin
   - Artık telefonunuzda bir uygulama gibi görünecek

### ⚠️ ÖNEMLİ UYARI
- Dosyalardan bu şekilde açıldığında GPS ve pusula sensörleri düzgün çalışmayabilir
- Düzgün çalışması için HTTPS gereklidir

---

## 🌐 Yöntem 2: GitHub Pages ile Kurulum (ÖNERİLEN - Sensörler için)

Bu yöntemle uygulamanız internette yayınlanacak ve sensörler düzgün çalışacak:

1. **GitHub Hesabı Oluşturun:**
   - github.com adresine gidin
   - Ücretsiz hesap oluşturun

2. **Repository Oluşturun:**
   - "New Repository" butonuna tıklayın
   - İsim: "jeoloji-pusulasi"
   - Public seçin
   - "Create repository"

3. **Dosyaları Yükleyin:**
   - "uploading an existing file" linkine tıklayın
   - Bu klasördeki TÜM dosyaları sürükleyip bırakın
   - "Commit changes" butonuna tıklayın

4. **GitHub Pages'i Aktifleştirin:**
   - Repository'nizde "Settings" sekmesine gidin
   - Sol menüden "Pages"e tıklayın
   - "Source" altında "main/master" seçin
   - "Save" butonuna tıklayın
   - 1-2 dakika bekleyin

5. **Uygulamanızı Açın:**
   - Size verilen URL'yi telefonunuzda Chrome ile açın
   - Örnek: https://kullaniciadi.github.io/jeoloji-pusulasi
   - GPS ve pusula izinlerini verin
   - Ana ekrana ekleyebilirsiniz!

---

## 🔄 GÜNCELLEME NASIL YAPILIR?

Uygulamada bir değişiklik yaptığınızda (veya benim yaptığım düzeltmeleri yüklemek istediğinizde):

1.  GitHub repository sayfanıza gidin.
2.  **"Add file"** > **"Upload files"** butonuna tıklayın.
3.  Güncellenen dosyaları (genellikle `app.js` ve `sw.js`) kutucuğa sürükleyin.
4.  En alttaki **"Commit changes"** butonuna tıklayın.
5.  Telefonunuzda uygulamayı açıp **sayfayı yenileyin**. Yeni sürüm otomatik olarak yüklenecektir.

---

## 🚀 Alternatif: Netlify Drop (En Kolay Online Yöntem)

1. Netlify Drop sayfasını açın: https://app.netlify.com/drop
2. Bu klasörü sürükleyip bırakın
3. Size verilen URL'yi telefonunuzda açın
4. Hazır!

---

## 📝 İçindekiler

Uygulamanız şu dosyalardan oluşuyor:
- index.html - Ana sayfa
- style.css - Tasarım
- app.js - Uygulama mantığı  
- manifest.json - PWA ayarları
- icon-192.png - Küçük icon
- icon-512.png - Büyük icon

## ✅ Test Etmek İçin

Bilgisayarınızda test etmek için:
- index.html dosyasına çift tıklayın
- Chrome ile açılacak
- Masaüstünde sensörler olmadığı için simülasyon modu çalışacak

Telefonunuzda gerçek GPS ve pusula sensörleri çalışacak!

---

**Sorularınız için yardıma hazırım!**
