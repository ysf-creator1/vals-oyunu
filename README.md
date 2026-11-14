# Vals

Tek kişilik mantık bulmacası: tahtadaki bütün taşları **1-2-3 ritmiyle** sıçrayarak tek bir yolda gez.
Mobil öncelikli, çevrimdışı çalışan web uygulaması (PWA). Tasarım dokümanı: [vals-oyun-tasarimi.md](vals-oyun-tasarimi.md).

## Oyna

- GitHub Pages: https://ysf-creator1.github.io/vals-oyunu/
- Oracle sunucusu: https://vals.130-61-214-155.sslip.io

## Geliştirme

```bash
npm install
npm run dev          # geliştirme sunucusu
npm test             # motor, 480 bölüm doğrulaması, uyarlama ve seri testleri
npm run build        # dist/ içine üretim derlemesi
npm run gen:levels   # src/data/levels.json'u sabit tohumla yeniden üretir
```

## Yayın

- **GitHub Pages:** `main` dalına her push'ta GitHub Actions test eder, derler ve yayınlar (`.github/workflows/pages.yml`).
- **Oracle:** `scripts/deploy-oracle.sh` derler ve `/srv/vals` içine kopyalar. Caddy bloğu: `infra/Caddyfile.vals`.

## Yapı

```
src/engine/       kurallar, çözücü, üreteç, tohumlu rastgelelik, ipucu (arayüzden bağımsız saf fonksiyonlar)
src/progression/  bantlar, otomatik zorluk, yıldızlar, günlük bulmaca, seri, unvan/tema
src/data/         levels.json (480 kampanya bölümü), öğretici
src/store/        Zustand durumu + localStorage (tek, sürümlü anahtar: vals:v1)
src/ui/           ekranlar, SVG tahta, temalar
src/audio/        Web Audio sentezleyici (ses dosyası yok)
src/i18n/         tr.ts, en.ts — oyunun adı yalnızca `app.name` anahtarında
```

Oyunun adını değiştirmek için: `src/i18n/tr.ts` ve `en.ts` içindeki `app.name`, `index.html` başlığı ve `vite.config.ts` içindeki manifest adı.
