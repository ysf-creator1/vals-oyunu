# Vals — Oyun Tasarım ve Geliştirme Dokümanı

Bu doküman Claude Code'a verilmek üzere yazıldı. Hedef: aşağıda tarif edilen bulmaca oyununu baştan sona, oynanabilir ve yayınlanabilir halde geliştirmek.

Kod, değişken adları ve commit mesajları İngilizce; arayüz metinleri Türkçe (İngilizce dil dosyası da hazır olsun).

---

## 1. Özet

- **Tür:** Tek kişilik mantık bulmacası, mobil öncelikli.
- **Tek cümle:** Tahtadaki bütün taşları 1-2-3 ritmiyle sıçrayarak tek bir yolda gez.
- **Oturum süresi:** Bölüm başına 20 saniye ile 3,5 dakika arası.
- **Platform:** Mobil öncelikli web uygulaması (PWA). Dikey ekran, tek elle kullanım.
- **İçerik:** 7 öğretici bölüm, 480 kampanya bölümü (12 zorluk bandı × 40), günlük bulmaca, sonsuz mod.
- **Zorluk:** Varsayılan olarak otomatik uyarlanır; oyuncu isterse elle seçer.
- **Para kazanma:** v1'de yok. Reklam, uygulama içi satın alma, can/enerji sistemi yok.

---

## 2. Kurallar (kesin tanım)

### 2.1 Tahta ve taşlar

- Tahta `W × H` hücrelik bir ızgaradır. Koordinat `(x, y)`, `x` soldan sağa, `y` yukarıdan aşağıya, sıfırdan başlar.
- Bazı hücrelerde taş vardır. Bir hücrede en fazla bir taş bulunur.
- Taş türleri:

| Kod | Ad | Şekil | Etkisi |
| --- | --- | --- | --- |
| `P` | Düz taş | Daire | Ritim bir adım ilerler |
| `R` | Ters taş | Baklava (45° dönmüş kare) | Ritmin yönü tersine döner, sonra bir adım ilerler |
| `H` | Durak taşı | Kare | Ritim ilerlemez, aynı sıçrama boyu bir kez daha kullanılır |

### 2.2 Hareket

1. Oyuncu başlangıç taşında başlar. Başlangıç taşı her zaman düz taştır.
2. Her hamle bir sıçramadır: yatay ya da dikey, düz çizgide, tam olarak `L` hücre uzaklıktaki bir taşa.
3. İnilen taş daha önce ziyaret edilmemiş olmalıdır.
4. Sıçrama sırasında başka taşların (ziyaret edilmiş ya da edilmemiş) üzerinden geçmek serbesttir. Yollar kesişebilir ve üst üste binebilir.
5. İlk sıçramanın boyu `L = 1`, ritim yönü `d = +1`.
6. Bir taşa inildikten sonra bir sonraki sıçrama boyu taşın türüne göre belirlenir:
   - `P`: `L = next(L, d)`
   - `R`: `d = -d`, sonra `L = next(L, d)`
   - `H`: `L` ve `d` değişmez
7. `next(L, +1)`: 1→2→3→1. `next(L, -1)`: 1→3→2→1.
8. Tüm taşlar ziyaret edildiğinde bölüm çözülür.

Örnek (ters taş): 2'lik sıçramayla ters taşa inildi. Yön tersine döner, sıradaki boy 1 olur; ardından 3, 2, 1, 3…

Örnek (durak taşı): 1'lik sıçramayla durak taşına inildi. Sıradaki sıçrama yine 1'dir; ondan sonra ritim kaldığı yerden sürer.

### 2.3 Başlangıç

- **Açık başlangıç:** Başlangıç taşı işaretlidir (kolay ve orta bantlar).
- **Gizli başlangıç:** Oyuncu başlangıcı kendi seçer; yalnızca düz taş seçilebilir (zor bantlar).

### 2.4 Tek çözüm garantisi

Oyundaki her bölümün tam olarak bir çözümü vardır (gizli başlangıçta tüm düz taşlar başlangıç adayı sayılarak). Bunu üreteç garanti eder (Bölüm 9). Bu garanti ipucu sisteminin temelidir: çözümden sapan her yol kesinlikle çıkmazdır.

---

## 3. Uzman incelemeleri

Prototip üzerinde altı rolle yapılan incelemenin notları. Kararlar Bölüm 4'te toplandı.

### 3.1 UX/UI uzmanı

- Prototipte "sıradaki sıçrama" yalnızca yazıyla veriliyor. Ritim, tahtanın üstünde üç vuruşluk görsel bir göstergeyle (① ② ③, aktif olan dolu, yön oku ile) verilmeli.
- Noktalı ızgarada mesafe saymak zor. Hücre çizgileri soluk ama görünür olmalı.
- Hatalı dokunuşta kırmızı yazı yetmez. Aktif taştan dört yöne, gereken boyda soluk "cetvel" çizgileri kısa süre gösterilmeli; taş hafifçe titremeli.
- Çıkmaz durumu (yapılabilecek hamle kalmaması) oyuncuya hemen bildirilmeli. İlk test kullanıcısı bölümü bitirip bitirmediğinden emin olamadı; kazanma anı da çıkmaz anı da belirsizdi.
- Kazanma anı net olmalı: yol baştan sona kısa bir animasyonla "çalınır", ardından sonuç kartı gelir.
- Kontroller başparmak bölgesinde, ekranın altında olmalı. Dokunma hedefi en az 44 pt.
- Renge bağımlı bilgi olmamalı; taş türleri şekille ayrılıyor, bu korunmalı.
- Geri alma iki yolla yapılabilmeli: düğmeyle ve son basılan taşa tekrar dokunarak.
- Aynı hizada üst üste binen sıçramalar kavisli yaylarla çizilmeli, yay yönü sırayla değişmeli.

### 3.2 Testçi A — 9 yaşında, gündelik oyuncu

- Kuralı yazıdan okumadı; ilk üç bölümde deneyerek öğrendi. Öğretici yazısız, yaparak öğreten türden olmalı.
- "Ters taş"ı ilk görüşte anlamadı. Her özel taş kendi tanıtım bölümüyle, tek başına gelmeli.
- 3 birim saymakta zorlandı; hücre çizgileri ve cetvel geri bildirimi şart.
- Soyut taşlar yerine kurbağa ve nilüfer temasını istedi. Tema seçeneği motivasyonu artırır.
- Süre baskısı görünce bıraktı. Süre varsayılan olarak ekranda görünmemeli.

### 3.3 Testçi B — 27 yaşında, mobil bulmaca oyuncusu

- Bölümler arası geçiş tek dokunuş olmalı; araya ekran girmemeli.
- Kolay bölümleri sıkıcı buldu, hemen zor bölüm istedi. Hızlı oyuncuyu hızla yukarı taşıyan otomatik zorluk ve elle seçim gerekli.
- Günlük bulmaca ve seri sayacı istedi; sonucu arkadaşına göndermek istedi.
- Gizli başlangıçlı bölümleri en keyifli kısım olarak gördü.
- İstatistik (ortalama süre, ipucusuz çözüm oranı) istedi.

### 3.4 Testçi C — 62 yaşında, gazete bulmacası çözücüsü

- Yazılar ve taşlar büyük, karşıtlık yüksek olmalı. Yazı boyutu ayarı istedi.
- Süre baskısı ve ceza istemiyor; geri almanın bedelsiz olması önemli.
- Kuralları istediği an tekrar okuyabileceği bir "Nasıl oynanır" sayfası istedi.
- Animasyonların kapatılabilmesini istedi.
- İpucunun cevabı doğrudan vermesi yerine önce yön göstermesini tercih etti.

### 3.5 Oyun tasarımcısı

- Çekirdek mekanik sağlam: tek kural, iki özel taş, derinlik sıra seçiminden geliyor.
- Rastgele serpiştirilen taşlar çoğunlukla "zorunlu yol" üretiyor (ölçüm: karar noktası ortancası 1). Üreteç, karar noktası ve arama ağacı büyüklüğü için alt sınır uygulamalı.
- Küçük tahtada düz taşlarla çeşitlilik çok az (ölçüm: 4×4 tahtada 5 düz taşla simetriler hariç yalnızca 17 farklı tek çözümlü bölüm). Bu yüzden kampanya 6×6 tahtada oynanmalı; kolaylık taş sayısının azlığından gelmeli.
- Aynı hat üzerinde üçten fazla sıçramanın üst üste bindiği bölümler okunaksız; üreteç bunları elemeli.
- Yıldızlar süreye bağlanmamalı; süre cezası denemeyi caydırır. Süre yalnızca otomatik zorluk için ölçülmeli.
- Geri alma cezasız olmalı; bulmacanın doğası deneme-yanılma.
- Mekanikler teker teker tanıtılmalı: düz → durak → ters → gizli başlangıç.
- v1 sonrası için aday mekanikler: duvar (üzerinden uçulamaz), çift taş (iki kez basılır), 1-2-3-4 ritmi. v1 kapsamına alınmamalı.

### 3.6 Bağlılık (alışkanlık) uzmanı

Hedef, oyuncunun isteyerek geri dönmesi. Oyuncuyu sıkıştıran karanlık kalıplar kullanılmayacak; çocuk oyuncular da hedef kitlede.

- **Kısa döngü:** Bölüm bitince tek dokunuşla sıradaki bölüm. "Bir tane daha" hissi buradan gelir.
- **Günlük bulmaca:** Herkese aynı bölüm, günde bir tane. Geri dönmek için doğal bir neden.
- **Seri:** Günlük bulmaca çözülen ardışık gün sayısı. Haftada bir gün otomatik "seri koruması" olsun; tek gün kaçırmak seriyi bozmasın.
- **Ustalık hissi:** Zorluk bandı yükseldikçe unvan değişsin (Çırak, Dansçı, Solist, Maestro).
- **Koleksiyon:** Kilometre taşlarında yeni görsel tema açılsın.
- **Paylaşım:** Günlük bulmaca sonucu için çözümü ele vermeyen bir özet metni.
- **Ses kimliği:** Sıçrama boyları üç farklı nota; çözülen bölüm kısa bir melodi olarak geri çalınsın. Oyunun akılda kalan imzası bu olur.
- **Kullanılmayacaklar:** Can/enerji sistemi, sahte geri sayım, kaybetme korkusu üzerine kurulu bildirim, ödüllü reklam, rastgele ödül kutusu.

---

## 4. Toplanmış kararlar

| # | Karar | Kaynak |
| --- | --- | --- |
| 1 | Kampanya tahtası sabit 6×6; öğretici 4×4 | Tasarımcı, üreteç ölçümü |
| 2 | Hücre çizgileri görünür, ritim göstergesi tahtanın üstünde | UX, Testçi A, C |
| 3 | Hatalı dokunuşta cetvel geri bildirimi | UX, Testçi A |
| 4 | Hamle kalmadığında anında "çıkmaz" bildirimi | UX, ilk kullanıcı testi |
| 5 | Süre varsayılan gizli; yalnızca otomatik zorluk için ölçülür | Testçi A, C, Tasarımcı |
| 6 | Geri alma sınırsız ve cezasız | Testçi C, Tasarımcı |
| 7 | Yıldızlar ipucu kullanımına bağlı, süreye değil | Tasarımcı |
| 8 | Üç kademeli ipucu: durum → yön → taş | Testçi C |
| 9 | Mekanikler sırayla ve kendi tanıtım bölümüyle gelir | Testçi A, Tasarımcı |
| 10 | Otomatik zorluk + her an elle seçim | Testçi B, ürün sahibi |
| 11 | Günlük bulmaca, seri, unvan, tema, paylaşım | Bağlılık uzmanı, Testçi B |
| 12 | Notalı ses kimliği, kapatılabilir | Bağlılık uzmanı |
| 13 | Yazı boyutu, yüksek karşıtlık, azaltılmış hareket ayarları | Testçi C |
| 14 | Karanlık kalıp, reklam, satın alma yok | Bağlılık uzmanı |
| 15 | Yeni mekanikler (duvar, çift taş, 4'lü ritim) v1 dışında | Tasarımcı |

---

## 5. Ekranlar ve akış

### 5.1 Ana ekran

- Büyük birincil düğme: **Devam et** (otomatik modda sıradaki bölüm).
- **Günlük bulmaca** kartı: bugünün durumu (çözülmedi / çözüldü) ve seri sayısı.
- İkincil girişler: **Bölümler**, **Sonsuz mod**, **İstatistik**, **Ayarlar**, **Nasıl oynanır**.
- İlk açılışta ana ekran yerine doğrudan öğretici başlar.

### 5.2 Oyun ekranı

Yukarıdan aşağıya:

1. **Üst şerit:** Geri (ana ekran), bölüm etiketi ("Orta · 37"), ilerleme (ziyaret edilen / toplam taş).
2. **Ritim göstergesi:** Üç vuruş yan yana (① ② ③). Sıradaki sıçrama boyu dolu ve büyük. Yön normalken ok sağa, tersken sola bakar. Durak taşına inildiğinde aktif vuruş kısa bir "tekrar" işareti gösterir.
3. **Tahta:** Kare, ekran genişliğine sığar. Soluk hücre çizgileri.
4. **Mesaj satırı:** Tek satır, kısa (çıkmaz bildirimi, ipucu metni).
5. **Alt kontroller:** **Geri al**, **Yardım**, **Sıfırla**. Ortadaki Yardım.

### 5.3 Tahta çizimi

- **Düz taş:** Daire. **Ters taş:** Baklava. **Durak taşı:** Köşeleri hafif yuvarlak kare.
- **Başlangıç taşı (açık başlangıç):** Çevresinde ikinci bir halka.
- **Ziyaret edilmiş taş:** Dolu; içinde ziyaret sıra numarası.
- **Aktif taş (üzerinde durulan):** Vurgu renginde kalın çerçeve, hafif nefes animasyonu.
- **Yol:** Sıçramalar vurgu renginde kavisli yaylar. Yay yönü hamle sırasına göre dönüşümlü. Sıçrama animasyonu 180–250 ms.
- **İpucu işareti:** Hedef taşın çevresinde kesikli halka.
- **Yardımcı vurgu (ayar):** Açıkken, o an geçerli hedef olan taşlar hafifçe parlar. Varsayılan: öğretici ve K1 bandında açık, diğerlerinde kapalı. Ayar seçenekleri: Otomatik / Açık / Kapalı.

### 5.4 Etkileşim

- **Taşa dokunma:** Geçerliyse sıçra. Geçersizse cetvel geri bildirimi ve kısa mesaj ("Bu taş aynı hizada tam 2 birim uzakta değil").
- **Son basılan taşa dokunma:** Bir hamle geri al.
- **Geri al:** Bir hamle geri. Basılı tutma: başa sar.
- **Sıfırla:** Bölümü baştan başlat (onay sormadan; geri alınabilir olsun diye son yol bir kez "İleri al" ile geri getirilebilir).
- **Gizli başlangıçta ilk dokunuş:** Başlangıç taşını seçer. Tek taş seçiliyken ona tekrar dokunmak seçimi kaldırır.
- **Çıkmaz:** Geçerli hamle kalmadıysa ve bölüm bitmediyse mesaj satırında "Çıkmaz. Geri al." yazar, Geri al düğmesi iki kez nabız atar. Hamle varken yolun çözüme varıp varamayacağı söylenmez; bu yalnızca Yardım ile öğrenilir.

### 5.5 Bölüm sonu kartı

- Yolun baştan sona notalarla çalındığı kısa animasyon (azaltılmış hareket açıksa atlanır).
- Yıldızlar (Bölüm 8.2), süre (ayar açıksa), varsa "Hızlı çözüm" rozeti.
- Birincil düğme: **Sıradaki bölüm**. İkincil: **Tekrar oyna**, **Ana ekran**.
- Zorluk bandı değişiyorsa kart bunu bildirir (Bölüm 7.4).

### 5.6 Bölümler ekranı

- Üç sekme: **Kolay**, **Orta**, **Zor**. Her sekmede 4 bant × 40 bölüm, ızgara halinde numaralar ve kazanılan yıldızlar.
- Tüm sekmeler ve bantlar baştan açıktır; kilit yok. Bir bantta bölümler sırayla açılır, ama oyuncu bandın ilk bölümüne her zaman girebilir.
- Üstte **Zorluk: Otomatik / Elle** seçimi (Bölüm 7).

### 5.7 Nasıl oynanır

Tek sayfa, dört küçük canlandırmalı örnek: ritim, durak taşı, ters taş, gizli başlangıç. Öğreticiyi yeniden oynama düğmesi.

### 5.8 Ayarlar

Ses (aç/kapa), titreşim, süreyi göster, yardımcı vurgu, yazı boyutu (normal/büyük), yüksek karşıtlık, azaltılmış hareket, tema, dil (TR/EN), ilerlemeyi sıfırla (onaylı).

### 5.9 İstatistik

Çözülen bölüm sayısı (bant bazında), ipucusuz çözüm oranı, bant bazında ortalama süre, en uzun seri, mevcut unvan.

---

## 6. Öğretici

İlk açılışta zorunlu, sonra "Nasıl oynanır"dan tekrar oynanabilir. 4×4 tahta. Her bölümde tek satır yönlendirme; yardımcı vurgu açık. Hepsi tek çözümlü ve doğrulanmıştır.

| No | Öğrettiği | Taşlar `(x, y, tür)` — ilk taş başlangıç | Çözüm (taş indeksleri) |
| --- | --- | --- | --- |
| T1 | 1 sonra 2 | `(0,1,P) (1,1,P) (3,1,P)` | 0,1,2 |
| T2 | 1, 2, 3 | `(0,0,P) (1,0,P) (3,0,P) (3,3,P)` | 0,1,2,3 |
| T3 | Ritim başa döner | `(0,0,P) (1,0,P) (3,0,P) (3,3,P) (2,3,P)` | 0,1,2,3,4 |
| T4 | Karar ve geri alma | `(2,3,P) (3,3,P) (1,3,P) (3,0,P) (1,1,P) (3,1,P)` | 0,2,1,3,5,4 |
| T5 | Durak taşı | `(0,0,P) (1,0,H) (1,1,P) (3,1,P) (0,1,P) (0,2,P)` | 0,1,2,3,4,5 |
| T6 | Ters taş | `(0,0,P) (1,0,P) (3,0,R) (3,1,P) (0,1,P) (0,3,P)` | 0,1,2,3,4,5 |
| T7 | Gizli başlangıç | `(2,3,P) (2,2,P) (0,2,P) (3,2,P) (3,1,P)` — başlangıç işaretsiz | 0,1,2,3,4 |

Yönlendirme metinleri:

- T1: "İlk sıçrama 1 birim, ikincisi 2."
- T2: "Üçüncü sıçrama 3 birim."
- T3: "Ritim başa döner: 1, 2, 3, 1…"
- T4: "İki seçenek var. Yanlış yola girersen geri al."
- T5: "Kare taş aynı boyu bir kez daha tekrarlatır."
- T6: "Baklava taş ritmi tersine çevirir: 3, 2, 1…"
- T7: "Bu kez başlangıcı sen bul."

T5 ve T6 oyun akışında, ilgili mekanik ilk kez karşılaşılmadan hemen önce gösterilir (T5: K3'e girerken, T6: O1'e girerken, T7: Z1'e girerken). İlk açılışta yalnızca T1–T4 oynanır.

---

## 7. Zorluk yapısı ve otomatik uyarlama

### 7.1 Bantlar

Üç seviye, her biri dört bant. Her bantta 40 bölüm; toplam 480. Tüm kampanya tahtaları 6×6.

| Bant | Seviye | Taş | Ters | Durak | Başlangıç | En az karar noktası | Arama ağacı (düğüm) alt sınırı | Hedef süre (sn) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | Kolay | 6 | 0 | 0 | Açık | 1 | — | 20 |
| K2 | Kolay | 7 | 0 | 0 | Açık | 1 | 10 | 30 |
| K3 | Kolay | 8 | 0 | 1 | Açık | 2 | — | 40 |
| K4 | Kolay | 9 | 0 | 1 | Açık | 2 | 14 | 50 |
| O1 | Orta | 10 | 1 | 0 | Açık | 2 | 16 | 60 |
| O2 | Orta | 11 | 1 | 1 | Açık | 3 | 20 | 75 |
| O3 | Orta | 12 | 1 | 1 | Açık | 3 | 28 | 90 |
| O4 | Orta | 12 | 2 | 1 | Açık | 3 | 34 | 110 |
| Z1 | Zor | 12 | 1 | 1 | Gizli | 3 | 90 | 120 |
| Z2 | Zor | 13 | 2 | 1 | Gizli | 3 | 130 | 150 |
| Z3 | Zor | 14 | 2 | 2 | Gizli | 4 | 190 | 180 |
| Z4 | Zor | 15 | 2 | 2 | Gizli | 4 | 260 | 210 |

Tanımlar:

- **Karar noktası:** Çözüm yolu üzerinde, birden fazla geçerli hamlenin bulunduğu adım sayısı.
- **Arama ağacı:** Derinlik öncelikli tam aramada gezilen düğüm sayısı (gizli başlangıçta tüm düz başlangıçların toplamı). Zorluğun ana ölçüsü.
- **Hedef süre:** İlk tahmindir, oyuncu verisiyle ölçülmedi. Tek bir yapılandırma dosyasında tutulmalı ve kolayca ayarlanabilmeli.

Bu ayarlarla referans üreteç 480 bölümü yaklaşık 1 saniyede üretti; ölçülen arama ağacı ortancaları K1'de 8, O1'de 20, O4'te 38, Z1'de 115, Z4'te 340.

### 7.2 Çözüm sınıflandırması

Her çözülen bölüm üç sınıftan birine girer:

- **Hızlı:** Süre ≤ hedef süre ve ipucu kullanılmadı.
- **Normal:** Hızlı ya da Zorlandı değil.
- **Zorlandı:** Süre > 2,5 × hedef süre, ya da 2 ve üzeri ipucu kullanıldı, ya da bölüm atlandı.

Süre, tahta göründüğü andan çözüme kadar ölçülür. Uygulama arka plana geçince ve 60 saniye hiç dokunuş olmayınca sayaç durur.

### 7.3 Otomatik mod (varsayılan)

Oyuncunun bir "mevcut bandı" vardır; başlangıçta K1. Devam et düğmesi mevcut bandın çözülmemiş ilk bölümünü açar.

- **Yükselme:** Mevcut bantta oynanan son 3 bölümün en az 2'si Hızlı ise bir üst banda geç. Bandın kalan bölümleri Bölümler ekranında durur.
- **Hızlı yükselme:** Art arda 3 bölüm, hedef sürenin yarısından kısa sürede ve ipucusuz çözülürse iki bant birden atla (aynı seviyenin son bandını geçmeyecek şekilde; seviye sınırı her zaman tek adımda aşılır).
- **Doğal ilerleme:** Bandın 40 bölümü bittiyse bir üst banda geç.
- **Yavaşlama önerisi:** Art arda 2 bölüm Zorlandı ise bölüm sonu kartında bir kez öner: "Biraz daha hafif bölümler ister misin?" Oyuncu kabul ederse bir alt banda in. Zorla düşürme yok. Öneri reddedilirse aynı bantta 5 bölüm boyunca tekrar sorulmaz.
- Yeni bir mekaniğin başladığı banda ilk girişte ilgili öğretici bölüm gösterilir.

### 7.4 Seviye geçişi

Bant geçişi aynı seviye içindeyse sessizdir. Seviye değişiyorsa (K4→O1, O4→Z1) bölüm sonu kartında kutlama gösterilir: "Orta seviyeye geçtin" ve unvan değişimi. Kartta ikincil seçenek: "Kolayda kal". Bu seçilirse otomatik mod o seviyenin son bandında kalır; oyuncu Bölümler ekranından istediği zaman yükseltir.

### 7.5 Elle mod

Bölümler ekranından herhangi bir banda girilebilir. Oyuncu bir bandı elle seçtiğinde mevcut bant o olur ve "Zorluk: Elle" durumuna geçilir; otomatik yükselme ve yavaşlama önerisi durur. Otomatiğe dönmek tek dokunuş.

---

## 8. İpucu ve puanlama

### 8.1 Yardım düğmesi

Her bölümde sınırsız ve bedelsiz. Aynı durumda art arda basıldıkça kademe ilerler; oyuncu hamle yapınca kademe sıfırlanır.

- **Yol yanlışsa (mevcut yol çözümün başlangıcı değilse):** "N. hamle çıkmaza götürüyor." mesajı ve **Oraya geri sar** düğmesi. Geri sarma oyuncunun onayıyla yapılır.
- **Yol doğruysa:**
  1. kademe: "Doğru yoldasın."
  2. kademe: Yön ve boy: "Şimdi 2 birim sola."
  3. kademe: Hedef taş kesikli halkayla işaretlenir.
- Özel taş sonrası açıklama eklenir: "Ters taşa bastın, ritim artık geri sayıyor." / "Durak taşı aynı boyu tekrarlatır."
- Gizli başlangıçta, henüz taş seçilmemişken: 1. kademe "Başlangıç taşı tahtanın üst yarısında" gibi bir bölge ipucu, 2. kademe taşı işaretler.

Bölüm başına "ipucu sayısı", 2. ve 3. kademeye ulaşılan farklı adımların ve yanlış yol bildirimlerinin toplamıdır. 1. kademe sayılmaz.

### 8.2 Yıldızlar

- 3 yıldız: ipucu sayısı 0.
- 2 yıldız: ipucu sayısı 1 veya 2.
- 1 yıldız: çözüldü.

Geri alma ve sıfırlama yıldızı etkilemez. Bölüm tekrar oynanırsa en iyi sonuç saklanır.

**Hızlı çözüm rozeti:** Hedef sürenin altında ve ipucusuz çözüm. Yalnızca olumlu geri bildirim; yokluğu vurgulanmaz.

---

## 9. Bölüm üretimi

### 9.1 Yöntem

Rastgele taş serpip çözüm aramak verimsizdir. Kullanılacak yöntem "önce yolu kur":

1. Taş türlerini sırala: ilk ve son taş her zaman düz; ters ve durak taşları aradaki konumlara rastgele dağıtılır.
2. Rastgele bir hücreden başla. Her adımda ritmin gerektirdiği boyda, tahta içinde kalan ve boş bir hücreye rastgele yönde sıçra, oraya taşı koy. Yer kalmazsa baştan dene.
3. Ortaya çıkan yerleşimi çöz. Tam olarak bir çözüm yoksa at.
4. Kalite süzgeçleri: karar noktası alt sınırı, arama ağacı alt/üst sınırı, aynı birim kenarın üzerinden en fazla 2 sıçrama geçmesi.
5. Sekiz simetri (dönme ve yansıma) altında daha önce üretilmiş bir yerleşimle aynıysa at.
6. Taşların dizi sırasını karıştır (dizi sırası çözümü ele vermesin); açık başlangıçta başlangıç taşı indeks 0'da kalır.

### 9.2 Ne zaman üretilir

- **Kampanya (480 bölüm):** Derleme zamanında, sabit tohumla, `scripts/generate-levels.ts` ile üretilip `src/data/levels.json` içine yazılır. Dosya depoya işlenir; böylece bölümler sürümler arasında değişmez.
- **Günlük bulmaca:** Çalışma zamanında, tohum = `YYYYMMDD` (UTC değil, oyuncunun yerel tarihi). Herkes aynı tarihte aynı bölümü görür. Bant haftanın gününe göre döner: Pzt K4, Sal O1, Çar O2, Per O3, Cum O4, Cmt Z1, Paz Z2.
- **Sonsuz mod:** Çalışma zamanında, oyuncunun seçtiği seviyeden rastgele bantla. Üretim telefonda milisaniyeler sürer.

Çalışma zamanı ve derleme zamanı aynı üreteç modülünü kullanır. Rastgelelik için tohumlanabilir bir üreteç (ör. mulberry32) kullanılmalı; `Math.random` kullanılmamalı.

Not: K1 ve K2 bantlarında farklı bölüm sayısı sınırlıdır (ölçüm: K2'de yaklaşık 180). Kampanya için yeterli; sonsuz mod bu iki bandı kullanmamalı.

### 9.3 Bölüm veri biçimi

```json
{
  "id": "O2-017",
  "band": "O2",
  "w": 6,
  "h": 6,
  "stones": [[1, 4, "P"], [0, 2, "R"], [0, 4, "H"]],
  "start": 0,
  "solution": [0, 7, 2, 6, 5, 3, 4, 1, 8],
  "nodes": 26,
  "decisions": 3
}
```

`start` gizli başlangıçta `null`. `solution` taş indekslerinin ziyaret sırasıdır.

### 9.4 Referans uygulama (Python, çalıştırılıp doğrulandı)

Aşağıdaki kod motorun, çözücünün ve üretecin referansıdır. TypeScript'e bire bir taşınmalı. Sondaki bölüm 12 bant için 40'ar bölüm üretir, her birini bağımsız olarak yeniden çözer ve üç test fikstürünü doğrular.

```python
"""Vals referans motoru + bolum ureteci. Saf Python 3, bagimlilik yok."""
import random

def next_len(L, d):                 # ritim: d=+1 -> 1,2,3,1...  d=-1 -> 3,2,1,3...
    return L % 3 + 1 if d == 1 else (L - 2) % 3 + 1

def apply_stone(kind, L, d):        # tasa inince sonraki sicrama boyu ve yon
    if kind == 'P': return next_len(L, d), d
    if kind == 'R': return next_len(L, -d), -d
    return L, d                     # 'H' durak: ayni boy tekrar

def legal_moves(stones, cur, visited, L):
    x, y = stones[cur][0], stones[cur][1]
    out = []
    for j, (a, b, _) in enumerate(stones):
        if visited >> j & 1: continue
        if (a == x and abs(b - y) == L) or (b == y and abs(a - x) == L):
            out.append(j)
    return out

def solve(stones, start, cap=2):
    """start: tas indeksi. Donus: (cozumler, gezilen dugum sayisi)."""
    n, sols, nodes = len(stones), [], [0]
    def rec(cur, visited, L, d, path):
        nodes[0] += 1
        if len(path) == n: sols.append(path[:]); return
        if len(sols) >= cap: return
        for j in legal_moves(stones, cur, visited, L):
            L2, d2 = apply_stone(stones[j][2], L, d)
            path.append(j); rec(j, visited | 1 << j, L2, d2, path); path.pop()
    rec(start, 1 << start, 1, 1, [start])
    return sols, nodes[0]

def solve_level(stones, start):
    """start None ise gizli baslangic: tum duz taslar denenir."""
    starts = [start] if start is not None else [i for i, s in enumerate(stones) if s[2] == 'P']
    sols, total = [], 0
    for s in starts:
        so, nd = solve(stones, s); sols += so; total += nd
        if len(sols) > 1: break
    return sols, total

def metrics(stones, sol):
    n, L, d, visited, decisions, cover = len(stones), 1, 1, 1 << sol[0], 0, {}
    for i in range(1, n):
        if len(legal_moves(stones, sol[i - 1], visited, L)) > 1: decisions += 1
        a, b = stones[sol[i - 1]], stones[sol[i]]
        if a[1] == b[1]:
            for x in range(min(a[0], b[0]), max(a[0], b[0])):
                cover[('h', x, a[1])] = cover.get(('h', x, a[1]), 0) + 1
        else:
            for y in range(min(a[1], b[1]), max(a[1], b[1])):
                cover[('v', a[0], y)] = cover.get(('v', a[0], y), 0) + 1
        L, d = apply_stone(stones[sol[i]][2], L, d); visited |= 1 << sol[i]
    return decisions, max(cover.values())

def build_walk(W, H, n, nR, nH, rnd):
    """Cozum yolunu ritme uyarak rastgele yuruyup taslari yerlestirir."""
    kinds = ['P'] * n
    mid = list(range(1, n - 1)); rnd.shuffle(mid)   # ilk ve son tas hep duz
    for i in mid[:nR]: kinds[i] = 'R'
    for i in mid[nR:nR + nH]: kinds[i] = 'H'
    pos = [(rnd.randrange(W), rnd.randrange(H))]; used = {pos[0]}; L, d = 1, 1
    for i in range(1, n):
        x, y = pos[-1]
        c = [p for p in ((x + L, y), (x - L, y), (x, y + L), (x, y - L))
             if 0 <= p[0] < W and 0 <= p[1] < H and p not in used]
        if not c: return None
        p = rnd.choice(c); pos.append(p); used.add(p)
        L, d = apply_stone(kinds[i], L, d)
    return [(pos[i][0], pos[i][1], kinds[i]) for i in range(n)]

def canonical(W, H, stones):
    """8 simetri altinda ayni olan yerlesimleri tek anahtara indirger (kare tahta)."""
    keys = []
    for t in range(8):
        pts = []
        for x, y, k in stones:
            if t & 1: x = W - 1 - x
            if t & 2: y = H - 1 - y
            if t & 4: x, y = y, x
            pts.append((x, y, k))
        keys.append(tuple(sorted(pts)))
    return min(keys)

def generate(band, rnd, seen):
    W, H, n, nR, nH, hidden, min_dec, min_nodes, max_nodes = band
    for _ in range(300_000):
        stones = build_walk(W, H, n, nR, nH, rnd)
        if not stones: continue
        start = None if hidden else 0
        sols, nodes = solve_level(stones, start)
        if len(sols) != 1: continue
        dec, overlap = metrics(stones, sols[0])
        if dec < min_dec or not (min_nodes <= nodes <= max_nodes) or overlap > 2: continue
        key = canonical(W, H, stones)
        if key in seen: continue
        seen.add(key)
        order = list(range(n)); rnd.shuffle(order)       # tas sirasi cozumu ele vermesin
        if not hidden: order.remove(0); order.insert(0, 0)
        inv = {old: new for new, old in enumerate(order)}
        return dict(w=W, h=H, stones=[list(stones[o]) for o in order],
                    start=None if hidden else 0, solution=[inv[i] for i in sols[0]],
                    nodes=nodes, decisions=dec)
    raise RuntimeError('bant cok dar: yeni benzersiz bolum bulunamadi')

#        W  H  n  R  H gizli minDec minNodes maxNodes
BANDS = {
 'K1': (6, 6, 6, 0, 0, False, 1, 0, 99),    'K2': (6, 6, 7, 0, 0, False, 1, 10, 99),
 'K3': (6, 6, 8, 0, 1, False, 2, 0, 99),    'K4': (6, 6, 9, 0, 1, False, 2, 14, 99),
 'O1': (6, 6, 10, 1, 0, False, 2, 16, 99),  'O2': (6, 6, 11, 1, 1, False, 3, 20, 99),
 'O3': (6, 6, 12, 1, 1, False, 3, 28, 999), 'O4': (6, 6, 12, 2, 1, False, 3, 34, 999),
 'Z1': (6, 6, 12, 1, 1, True, 3, 90, 9999), 'Z2': (6, 6, 13, 2, 1, True, 3, 130, 9999),
 'Z3': (6, 6, 14, 2, 2, True, 4, 190, 9999),'Z4': (6, 6, 15, 2, 2, True, 4, 260, 9999),
}

if __name__ == '__main__':
    import time, json
    rnd = random.Random(20261114); t0 = time.time(); total = 0
    for name, band in BANDS.items():
        seen, t = set(), time.time()
        lv = [generate(band, rnd, seen) for _ in range(40)]
        for l in lv:                                    # bagimsiz dogrulama
            sols, _ = solve_level([tuple(s) for s in l['stones']], l['start'])
            assert len(sols) == 1 and sols[0] == l['solution']
        total += len(lv)
        ns = sorted(l['nodes'] for l in lv)
        print(f"{name}: 40 bolum, {time.time()-t:.2f} sn, dugum medyan {ns[20]}, en cok {ns[-1]}")
    print('toplam', total, 'bolum,', round(time.time() - t0, 1), 'sn')
    # test fikstürleri
    fx = [
      ([(2,3,'P'),(3,3,'P'),(1,3,'P'),(3,0,'P'),(1,1,'P'),(3,1,'P')], 0, [0,2,1,3,5,4]),
      ([(1,4,'P'),(0,2,'R'),(0,4,'P'),(3,1,'P'),(0,1,'P'),(3,3,'P'),(3,4,'P'),(2,4,'P'),(3,2,'P')], 0, [0,7,2,6,5,3,4,1,8]),
      ([(1,0,'P'),(5,0,'P'),(4,4,'P'),(3,3,'P'),(2,0,'P'),(3,2,'P'),(3,0,'R'),(3,1,'P'),(4,0,'H'),(0,0,'P'),(4,2,'P'),(4,1,'P')], None, [0,9,4,1,8,6,3,7,11,2,10,5]),
    ]
    for st, s, sol in fx:
        sols, nodes = solve_level(st, s); assert sols == [sol], sols
        print('fikstur tamam, dugum', nodes)
```

---

## 10. Bağlılık sistemleri

### 10.1 Günlük bulmaca

- Günde bir bölüm; Bölüm 9.2'deki tohum ve bant kuralı.
- Çözülünce ana ekrandaki kart "çözüldü" olur, bir sonraki bulmacaya kalan süre gösterilmez (geri sayım baskısı yok); yalnızca "Yarın yeni bulmaca" yazar.
- Geçmiş günler oynanamaz (v1).

### 10.2 Seri

- Günlük bulmacanın çözüldüğü ardışık gün sayısı.
- Her takvim haftasında bir kaçırılan gün seriyi bozmaz (otomatik koruma; oyuncudan işlem istenmez).
- Seri bozulduğunda suçlayıcı dil kullanılmaz; en uzun seri İstatistik'te saklanır.

### 10.3 Unvanlar

Oyuncunun en az 10 bölüm çözdüğü en yüksek seviyeye göre: başlangıçta **Çırak**, Kolay'da **Dansçı**, Orta'da **Solist**, Zor'da **Maestro**.

### 10.4 Temalar

Yalnızca görsel; kurallar değişmez. Taş şekilleri her temada ayırt edilebilir kalmalı.

| Tema | Açılma koşulu | Görsel |
| --- | --- | --- |
| Klasik | Baştan açık | Geometrik taşlar |
| Nilüfer | 25 bölüm | Yapraklar ve sıçrayan kurbağa |
| Takımyıldız | 100 bölüm | Yıldızlar, yol takımyıldız çizgisi |
| Adalar | 7 günlük seri | Adalar ve vapur |

### 10.5 Paylaşım

Günlük bulmaca çözülünce "Paylaş" düğmesi. Çözümü ele vermeyen düz metin üretir ve panoya kopyalar ya da sistem paylaşım sayfasını açar:

```
Vals · 14 Kasım · Zor
⭐⭐⭐ · 2:41 · Seri 6
```

### 10.6 Ses

Web Audio ile sentezlenir; ses dosyası yok.

- Sıçrama boyları üç nota: 1 → Do, 2 → Mi, 3 → Sol. Ters yöndeyken bir oktav aşağı.
- Bölüm çözülünce yol baştan sona hızlıca çalınır, ardından kısa bir akor.
- Hatalı dokunuş: kısa, boğuk tek ses. Varsayılan ses açık; ilk dokunuşa kadar ses bağlamı başlatılmaz.

### 10.7 Bildirim

v1'de bildirim yok.

---

## 11. Görsel tasarım ve erişilebilirlik

- Sade, düz yüzeyler; tek vurgu rengi (yol ve aktif taş). Açık ve koyu tema sistem ayarını izler.
- Taş türü her zaman şekille ayrılır; renk ikincil.
- Metin karşıtlığı en az 4,5:1. Yüksek karşıtlık ayarında çizgiler kalınlaşır, soluk tonlar kaldırılır.
- Yazı boyutu ayarı: normal / büyük (yaklaşık %125).
- Azaltılmış hareket: sistem ayarını izler ve ayrıca ayarlardan açılabilir; sıçrama animasyonu anlık geçişe döner, bitiş animasyonu atlanır.
- Ekran okuyucu: her taş için etiket ("3. sütun, 2. satır, ters taş, ziyaret edilmedi"); ritim göstergesi canlı bölge olarak duyurulur.
- Dokunma hedefleri en az 44 pt. 6×6 tahta 320 pt genişlikte hücre başına yaklaşık 53 pt verir.
- Klavye desteği (masaüstü): ok tuşlarıyla yön seçip sıçrama, `Z` geri al, `R` sıfırla, `H` yardım.

---

## 12. Teknik mimari

### 12.1 Teknoloji

- Vite + React + TypeScript.
- Tahta SVG ile çizilir.
- Durum yönetimi: hafif bir store (Zustand) ya da `useReducer`. Oyun motoru saf fonksiyonlardan oluşur ve arayüzden bağımsızdır.
- Kalıcılık: `localStorage`, sürümlü tek anahtar. Sunucu yok, hesap yok.
- PWA: çevrimdışı çalışır, ana ekrana eklenebilir (vite-plugin-pwa).
- Testler: Vitest.
- İleride mağaza sürümü istenirse Capacitor ile sarılabilecek şekilde platforma özel API kullanılmamalı.

### 12.2 Klasör yapısı

```
src/
  engine/        rules.ts, solver.ts, generator.ts, rng.ts, hint.ts
  progression/   bands.ts, adaptive.ts, stars.ts, daily.ts, streak.ts
  data/          levels.json, tutorial.ts
  ui/            screens/, board/, components/, theme/
  audio/         synth.ts
  i18n/          tr.ts, en.ts
  store/         game.ts, profile.ts, settings.ts
scripts/         generate-levels.ts
tests/
```

### 12.3 Motor arayüzü

```ts
type Kind = 'P' | 'R' | 'H';
type Stone = [x: number, y: number, kind: Kind];
interface Level { id: string; band: BandId; w: number; h: number;
  stones: Stone[]; start: number | null; solution: number[];
  nodes: number; decisions: number; }
interface Rhythm { len: 1 | 2 | 3; dir: 1 | -1; }

rhythmAfter(level: Level, path: number[]): Rhythm
legalMoves(level: Level, path: number[]): number[]
tryMove(level: Level, path: number[], stone: number): { ok: true; path: number[] } | { ok: false; reason: 'visited' | 'distance' | 'notPlainStart' }
isSolved(level: Level, path: number[]): boolean
isDeadEnd(level: Level, path: number[]): boolean
solve(level: Level, cap?: number): { solutions: number[][]; nodes: number }
hint(level: Level, path: number[]): Hint   // Bölüm 8.1
generate(band: BandConfig, rng: Rng, seen: Set<string>): Level
```

Ritim durumu saklanmaz; her zaman `path` üzerinden yeniden hesaplanır. Geri alma, yolun son elemanını çıkarmaktır.

### 12.4 Kalıcı veri

```ts
interface Profile {
  version: 1;
  mode: 'auto' | 'manual';
  currentBand: BandId;
  stayInTier: boolean;                       // "Kolayda kal" seçimi
  results: Record<string, { stars: 1|2|3; bestMs: number; fast: boolean }>;
  recent: { levelId: string; band: BandId; cls: 'fast'|'normal'|'struggled'; ms: number }[];  // son 10
  easierOfferCooldown: number;
  tutorialSeen: string[];
  daily: { lastSolved: string | null; streak: number; best: number; freezeUsedWeek: string | null };
  themesUnlocked: string[];
  settings: Settings;
}
```

Bölüm ortasında uygulama kapanırsa mevcut yol saklanır ve geri dönüldüğünde kaldığı yerden sürer.

---

## 13. Kabul ölçütleri

### 13.1 Motor testleri (fikstürler)

Aşağıdaki üç bölüm tek çözümlüdür; çözücü tam olarak bu çözümü ve bu düğüm sayısını vermelidir.

| Ad | Tahta | Taşlar | Başlangıç | Çözüm | Düğüm |
| --- | --- | --- | --- | --- | --- |
| F1 | 4×4 | `(2,3,P) (3,3,P) (1,3,P) (3,0,P) (1,1,P) (3,1,P)` | 0 | 0,2,1,3,5,4 | 10 |
| F2 | 5×5 | `(1,4,P) (0,2,R) (0,4,P) (3,1,P) (0,1,P) (3,3,P) (3,4,P) (2,4,P) (3,2,P)` | 0 | 0,7,2,6,5,3,4,1,8 | 22 |
| F3 | 6×6 | `(1,0,P) (5,0,P) (4,4,P) (3,3,P) (2,0,P) (3,2,P) (3,0,R) (3,1,P) (4,0,H) (0,0,P) (4,2,P) (4,1,P)` | gizli | 0,9,4,1,8,6,3,7,11,2,10,5 | 194 |

Ek testler:

- Ritim: `P` ile 1→2→3→1; `R` sonrası 2'den 1'e, 1'den 3'e; `H` sonrası boy değişmez.
- Öğretici T1–T7 tek çözümlü ve tablodaki çözümle aynı.
- `levels.json` içindeki 480 bölümün her biri: tek çözümlü, kayıtlı çözümle aynı, bant süzgeçlerini sağlıyor, kimlikler benzersiz, simetri altında yinelenen yok.
- Aynı tohumla üreteç aynı bölümleri verir.
- Günlük bulmaca aynı tarih için aynı bölümü verir.

### 13.2 Uyarlama testleri

- Son 3 bölümün 2'si Hızlı → bir bant yükselir.
- Art arda 3 çok hızlı çözüm → iki bant, seviye sınırını aşmadan.
- Art arda 2 Zorlandı → öneri bir kez çıkar; ret sonrası 5 bölüm çıkmaz.
- Elle modda otomatik geçiş olmaz.
- "Kolayda kal" seçiliyken K4'ten O1'e geçilmez.

### 13.3 Deneyim ölçütleri

- İlk açılıştan ilk bölümün çözülmesine kadar hiçbir metin okumak zorunlu değil.
- Bölüm sonundan sıradaki bölümün ilk hamlesine tek dokunuş.
- 360 pt genişlikte tüm dokunma hedefleri en az 44 pt.
- Çevrimdışı açılır ve oynanır.
- Açık ve koyu temada tüm metinler okunur.
- Uygulama kapatılıp açıldığında ilerleme, ayarlar ve yarım kalan bölüm korunur.

---

## 14. Geliştirme sırası

1. Motor, çözücü, üreteç ve testleri (Bölüm 9.4'ün TypeScript karşılığı; fikstürler geçmeli).
2. `generate-levels` betiği ve `levels.json`.
3. Oyun ekranı: tahta, ritim göstergesi, sıçrama, geri alma, çıkmaz bildirimi, kazanma.
4. Öğretici.
5. İpucu sistemi ve yıldızlar.
6. Bantlar, otomatik uyarlama, Bölümler ekranı, profil kalıcılığı.
7. Günlük bulmaca, seri, unvan, paylaşım.
8. Ses, temalar, ayarlar, erişilebilirlik.
9. PWA, sonsuz mod, İstatistik, İngilizce dil dosyası.

Her adımın sonunda çalışan ve test edilmiş bir sürüm olmalı.

---

## 15. Kapsam dışı (v1)

- Hesap, bulut kaydı, lider tablosu.
- Reklam, satın alma, bildirim.
- Yeni taş türleri (duvar, çift taş), 1-2-3-4 ritmi, 6×6 dışı kampanya tahtaları.
- Bölüm editörü ve oyuncu yapımı bölümler.
- Geçmiş günlük bulmacalar.
