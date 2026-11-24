# Football Tahmin Oyunu ⚽

Arkadaşlarla oynamak için geliştirilmiş, tamamen cihaz üzerinde çalışan (sunucusuz, hesapsız, reklamsız) Türkçe çapraz platform (iOS, Android, Web) futbol bilgi ve tahmin oyunu.

## Özellikler

- **Takım Teması & İlk Açılış ("Hangi takımlısın?")**: Süper Lig, Premier League, La Liga, Serie A, Bundesliga ve Ligue 1'deki tüm kulüpler (115 takım) liglere göre gruplanmış ve aranabilir şekilde listelenir. Kulüp armaları/logoları kullanılmaz; yalnızca kulüp renkleriyle erişilebilir (WCAG kontrast kontrollü) vurgu teması uygulanır. "Takımım yok" seçeneği varsayılan futbol yeşili temayı kullanır. Açık ve Koyu tema desteklenir.
- **3 Oyun Modu**:
  1. **TenaBall**: Top 10 futbol listesini tahmin et (5 can, süre sınırı yok, aksan/büyük-küçük harf/küçük yazım hatası toleranslı otomatik ad veya soyad eşleştirme).
  2. **Who Are Ya**: Bulanık futbolcu fotoğrafı her yanlış tahminde netleşir; otomatik tamamlamalı arama, 6 deneme hakkı ve ülke/mevki/doğum yılı/ortak kulüp ipuçları.
  3. **Football Wordle**: Dinamik harf uzunluklu soyad tahmin oyunu (6 hak, Türkçe/aksanlı harf normalizasyonu, çok kelimeli soyad desteği, animasyonlu kutu açılışı ve isteğe bağlı mevki/ülke ipucu).
- **Günlük Mod & Sınırsız Mod**: Günlük bulmaca tarihe dayalı deterministik karıştırma ile tüm oyuncular için aynı seçilir, havuz bitene kadar tekrar etmez ve tamamlandığında yerel gece yarısına kadar kilitlenir.
- **Yerel İstatistikler & Paylaşım**: Her oyun için oynanan oyun, kazanma oranı, mevcut/en iyi seri, tahmin dağılımı ve Wordle tarzı emoji grid paylaşımı.
- **Uzak Soru Güncelleme**: Uygulama açılışında yapılandırılabilir bir raw GitHub URL'sinden (`src/data/remoteSync.ts` içindeki `REMOTE_TENABALL_URL`) güncel TenaBall sorularını çekmeyi dener, şema doğrulaması yapar ve yerel önbelleğe alır; çevrimdışıysa paketli veriyi kullanır.

---

## Kurulum ve Çalıştırma

### Gereksinimler
- Node.js 18+
- npm 9+
- Mobil test için **Expo Go** (iOS / Android) veya Xcode / Android Studio emülatörü

### Bağımlılıkları Yükle
```bash
npm install
```

### Web'de Çalıştır
```bash
npm run web
```

### iOS'ta Çalıştır
```bash
npm run ios
```
*(veya `npm start` çalıştırıp Expo Go ile QR kodu okutun)*

### Android'de Çalıştır
```bash
npm run android
```

### Doğrulama ve Test Scriptleri
```bash
npm run typecheck         # TypeScript tip kontrolü
npm run validate:data     # teams.json, players.json ve tenaball.json şema kontrolü
npm run verify:tenaball   # Kaç TenaBall listesinin henüz doğrulanmadığını raporlar
npm test                  # Birim testleri (normalizasyon, Wordle, günlük döngü)
npm run export:web        # Üretim Web derlemesi (dist/)
```

---

## Proje Yapısı

```text
football-tahmin-oyunu/
├── app/                         # Expo Router ekranları
│   ├── _layout.tsx              # Root layout, ThemeProvider, onboarding yönlendirme, uzak senkronizasyon
│   ├── index.tsx                # Ana ekran (3 oyun kartı, günlük durum & seriler)
│   ├── onboarding.tsx           # "Hangi takımlısın?" aranabilir takım seçimi
│   ├── settings.tsx             # Takım değiştirme, Açık/Koyu/Sistem tema, veri senkronizasyonu, lisanslar
│   └── games/
│       ├── tenaball.tsx
│       ├── who-are-ya.tsx
│       └── wordle.tsx
├── src/
│   ├── components/              # AppContainer, Header, SearchInput, ModeToggle, StatsModal, ResultModal, TeamColorDot
│   ├── data/
│   │   ├── teams.json           # 6 ligden 115 kulüp (yalnızca renk verisi)
│   │   ├── players.json         # 225 futbolcu (Who Are Ya & Wordle ortak havuzu)
│   │   ├── tenaball.json        # 200 TenaBall Top 10 sorusu
│   │   ├── teamRepository.ts
│   │   ├── playerRepository.ts
│   │   ├── tenaballRepository.ts
│   │   └── remoteSync.ts        # Uzak GitHub JSON indirme & şema doğrulama
│   ├── games/
│   │   ├── tenaball/            # TenaBallGame.tsx, tenaballLogic.ts, SlotRow.tsx
│   │   ├── who-are-ya/          # WhoAreYaGame.tsx, whoAreYaLogic.ts, BlurredPlayerPhoto.tsx
│   │   └── wordle/              # WordleGame.tsx, wordleLogic.ts, WordleGrid.tsx, WordleKeyboard.tsx
│   ├── theme/
│   │   └── ThemeContext.tsx     # Sabit nötr + futbol yeşili taban, takım vurgu renkleri, WCAG kontrast
│   ├── types/
│   │   └── index.ts
│   └── utils/                   # normalization.ts, matching.ts, daily.ts, color.ts, storage.ts, share.ts
└── scripts/
    ├── verify-tenaball.mjs      # Doğrulanmamış TenaBall listelerini raporlar
    ├── validate-datasets.mjs    # Tüm JSON veri setlerini doğrular
    └── tests.mjs                # Temel algoritma birim testleri
```

---

## Veri Kaynakları ve Görsel Atıfları

- **Futbolcu Fotoğrafları**: `src/data/players.json` içindeki tüm görsel referansları **Wikimedia Commons** (`Special:FilePath`) üzerinden **Creative Commons (CC BY / CC BY-SA)** veya **Public Domain** lisanslarıyla tanımlıdır. Her görselin lisans ve kaynak bilgisi hem `players.json` içinde saklanır hem de Who Are Ya ekranında doğrudan fotoğrafın altında gösterilir.
- **Kulüp Verileri**: `src/data/teams.json` dosyasında hiçbir kulüp logosu veya arması yer almaz; yalnızca resmi forma/kulüp renkleri (`primaryColor`, `secondaryColor`) kullanılır.
- **TenaBall Listeleri**: Tüm sorular `verified: false` ve `sourceUrl` + `asOf` alanlarıyla gelir. Bir insan tarafından ilgili kaynak URL'si üzerinden doğrulanan listeler `verified: true` olarak güncellenmelidir.

---

## Yeni TenaBall Sorusu Nasıl Eklenir?

1. `src/data/tenaball.json` dosyasını açın ve dizinin sonuna aşağıdaki şemada yeni bir nesne ekleyin (elle alias alanı eklemeyin — eşleştirme motoru ad ve soyadı otomatik tanır):

```json
{
  "id": "tb-201",
  "title": "Süper Lig tarihinde bir sezonda en çok gol atan 10 oyuncu",
  "category": "Süper Lig",
  "difficulty": "orta",
  "answers": [
    "Tanju Çolak",
    "Metin Oktay",
    "Hakan Şükür",
    "Aykut Kocaman",
    "Burak Yılmaz",
    "Mbaye Diagne",
    "Bafétimbi Gomis",
    "Enner Valencia",
    "Mauro Icardi",
    "Alex de Souza"
  ],
  "sourceUrl": "https://en.wikipedia.org/wiki/List_of_S%C3%BCper_Lig_top_scorers",
  "asOf": "2025-05-01",
  "verified": false
}
```

2. Doğrulama scriptini çalıştırın:
```bash
npm run verify:tenaball
```
3. Kaynağı kontrol ettikten sonra ilgili kaydın `verified` alanını `true` yapın.
4. Uzaktan güncelleme için `src/data/remoteSync.ts` dosyasındaki `REMOTE_TENABALL_URL` sabitini kendi GitHub deponuzun raw URL'sine yönlendirin.

---

## 10 Takımlık Örnek Veri (`src/data/teams.json`)

```json
[
  { "id": "galatasaray", "name": "Galatasaray", "league": "Süper Lig", "country": "Türkiye", "primaryColor": "#A90432", "secondaryColor": "#FDB912" },
  { "id": "fenerbahce", "name": "Fenerbahçe", "league": "Süper Lig", "country": "Türkiye", "primaryColor": "#002D72", "secondaryColor": "#FFED00" },
  { "id": "besiktas", "name": "Beşiktaş", "league": "Süper Lig", "country": "Türkiye", "primaryColor": "#111111", "secondaryColor": "#FFFFFF" },
  { "id": "trabzonspor", "name": "Trabzonspor", "league": "Süper Lig", "country": "Türkiye", "primaryColor": "#6C1D45", "secondaryColor": "#3BAFDA" },
  { "id": "arsenal", "name": "Arsenal", "league": "Premier League", "country": "İngiltere", "primaryColor": "#EF0107", "secondaryColor": "#063672" },
  { "id": "liverpool", "name": "Liverpool", "league": "Premier League", "country": "İngiltere", "primaryColor": "#C8102E", "secondaryColor": "#00B2A9" },
  { "id": "real-madrid", "name": "Real Madrid", "league": "La Liga", "country": "İspanya", "primaryColor": "#00529F", "secondaryColor": "#FEBE10" },
  { "id": "barcelona", "name": "FC Barcelona", "league": "La Liga", "country": "İspanya", "primaryColor": "#004D98", "secondaryColor": "#A50044" },
  { "id": "ac-milan", "name": "AC Milan", "league": "Serie A", "country": "İtalya", "primaryColor": "#FB090B", "secondaryColor": "#111111" },
  { "id": "bayern-munich", "name": "Bayern Münih", "league": "Bundesliga", "country": "Almanya", "primaryColor": "#DC052D", "secondaryColor": "#0066B2" }
]
```

## Lisans

Bu proje [LICENSE](./LICENSE) dosyasında belirtilen MIT Lisansı (yer tutucu) kapsamındadır.
