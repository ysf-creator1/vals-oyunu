/* Vals — kullanım olayları ve canlı rapor sunucusu (Oracle'da, Caddy arkasında 127.0.0.1:8791)
 *
 * POST /api/olay        oyundan gelen olaylar (tek nesne ya da dizi; text/plain JSON, sendBeacon)
 * GET  /api/rapor       rapor sayfası (veri içermez)
 * GET  /api/rapor/veri  olaylar + yaklaşık konum (JSON); "X-Anahtar" başlığı gerekir
 * GET  /api/durum       sağlık denetimi
 * POST /api/yedek       ilerleme yedeği: {profil} yeni kod üretir, {kod, profil} o kodun yedeğini günceller → {kod, z}
 * POST /api/yedek/al    {kod} → {profil, z}; yanlış kod denemeleri IP başına sınırlı
 * GET  /api/sure?s=BÖLÜM&c=CİHAZ   bölüm sonu kıyası: diğer oyuncuların en iyi ve ortalama süresi (sorulan cihaz hariç)
 * GET  /api/sure?b=BANT&c=CİHAZ    sonsuz mod: o banttaki çözümlerin ortalaması
 *
 * Kayıt: VERI/olaylar/YYYY-MM-DD.jsonl (UTC günü), 400 gün saklanır.
 * Kişisel veri azaltma: tam IP saklanmaz (IPv4 a.b.c.0, IPv6 ilk 3 bölüm); ad ya da hesap yok.
 * Rapor anahtarı: VERI/rapor-anahtar.txt (ilk açılışta oluşur). Link: https://…/api/rapor#k=ANAHTAR
 * Konum: DB-IP Lite şehir veritabanı (VERI/geo/dbip-city-lite.mmdb, ayda bir yenilenir; CC BY 4.0).
 */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = +(process.env.PORT || 8791);
const VERI = process.env.VERI || path.join(__dirname, 'veri');
const DIR = path.join(VERI, 'olaylar');
const GEO = path.join(VERI, 'geo', 'dbip-city-lite.mmdb');
const KEY_FILE = path.join(VERI, 'rapor-anahtar.txt');
const PAGE = path.join(__dirname, 'rapor.html');
const KEEP_DAYS = 400;
const ORIGINS = ['https://ysf-creator1.github.io', 'https://vals.130-61-214-155.sslip.io'];
const TURLER = new Set(['acilis', 'basla', 'bitti', 'birakti', 'yardim', 'ekran', 'ayar', 'sifirla', 'kolay_teklif', 'kademede_kal', 'oturum', 'hata_js', 'yedek', 'ana_ekran']);
const YEDEK = path.join(VERI, 'yedek');

fs.mkdirSync(DIR, { recursive: true });
fs.mkdirSync(YEDEK, { recursive: true });
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------- kayıt ----------
let buf = [];
function flush() {
  if (!buf.length) return;
  const byDay = {};
  for (const [d, line] of buf) (byDay[d] = byDay[d] || []).push(line);
  buf = [];
  for (const d in byDay) {
    try { fs.appendFileSync(path.join(DIR, d + '.jsonl'), byDay[d].join('')); } catch (e) { log('[olay] yazma hatası', e.message); }
  }
}
setInterval(flush, 2000).unref();
setInterval(() => {
  try {
    for (const n of fs.readdirSync(DIR)) {
      const m = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(n);
      if (m && Date.now() - Date.parse(m[1]) > KEEP_DAYS * 864e5) fs.unlinkSync(path.join(DIR, n));
    }
    // 400 gündür hiç güncellenmeyen yedekler silinir.
    for (const n of fs.readdirSync(YEDEK)) {
      const f = path.join(YEDEK, n);
      if (Date.now() - fs.statSync(f).mtimeMs > KEEP_DAYS * 864e5) fs.unlinkSync(f);
    }
  } catch (e) { }
}, 6 * 3600e3).unref();

function ipKisa(ip) {
  ip = String(ip || '').replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.0');
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::';
  return '';
}
function sistem(ua) {
  ua = String(ua || '');
  const os = /iPhone|iPod/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Diğer';
  const br = /SamsungBrowser/.test(ua) ? 'Samsung' : /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Diğer';
  return { os, tarayici: br };
}
// Yalnız düz alanlar: kısa anahtar, kısa metin, sonlu sayı, doğru/yanlış.
function temizle(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const tur = String(e.tur || '');
  if (!TURLER.has(tur)) return null;
  const o = {};
  let n = 0;
  for (const [k, v] of Object.entries(e)) {
    if (k === 'tur' || k === 'z' || k === 'ip' || !/^[a-z0-9_]{1,16}$/.test(k) || ++n > 24) continue;
    if (typeof v === 'string') o[k] = v.slice(0, 40);
    else if (typeof v === 'number' && Number.isFinite(v)) o[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') o[k] = v;
  }
  if (o.cihaz && !/^[0-9a-f]{12}$/.test(o.cihaz)) delete o.cihaz;
  o.tur = tur;
  return o;
}

// ---------- süre kıyası ----------
// Bölüm → cihaz → { ilk: ilk çözüm süresi, en: yardımsız en iyi süre }. Sonsuz modda bölümler tek seferlik:
// bant → cihaz → { top, n }. Açılışta kayıtlardan kurulur, gelen her "bitti" ile güncellenir.
const sureler = new Map();
const bantSure = new Map();
function sureEkle(o) {
  if (o.tur !== 'bitti' || !o.cihaz || !o.seviye || o.mod === 'tutorial') return;
  const ms = typeof o.ms === 'number' ? o.ms : typeof o.sn === 'number' ? o.sn * 1000 : 0;
  if (!(ms >= 500 && ms <= 3 * 3600e3)) return;
  if (o.mod === 'endless') {
    if (!o.bant) return;
    let m = bantSure.get(o.bant);
    if (!m) bantSure.set(o.bant, (m = new Map()));
    const r = m.get(o.cihaz) || { top: 0, n: 0 };
    r.top += ms; r.n++;
    m.set(o.cihaz, r);
    return;
  }
  let m = sureler.get(o.seviye);
  if (!m) sureler.set(o.seviye, (m = new Map()));
  const r = m.get(o.cihaz) || { ilk: ms, en: Infinity };
  if (!o.ipucu) r.en = Math.min(r.en, ms);
  m.set(o.cihaz, r);
}
function sureKiyas(q) {
  const ben = String(q.get('c') || '');
  const s = q.get('s'), b = q.get('b');
  if (s) {
    let n = 0, top = 0, en = Infinity, enN = 0;
    for (const [c, r] of sureler.get(s) || []) {
      if (c === ben) continue;
      n++; top += r.ilk;
      if (r.en < Infinity) { enN++; en = Math.min(en, r.en); }
    }
    return { n, ort: n ? Math.round(top / n) : null, en: enN ? en : null, enN };
  }
  if (b) {
    let n = 0, top = 0, kisi = 0;
    for (const [c, r] of bantSure.get(b) || []) {
      if (c === ben) continue;
      kisi++; n += r.n; top += r.top;
    }
    return { n: kisi, ort: n ? Math.round(top / n) : null, en: null, enN: 0 };
  }
  return null;
}
try {
  for (const n of fs.readdirSync(DIR).sort()) {
    if (!/\.jsonl$/.test(n)) continue;
    for (const line of fs.readFileSync(path.join(DIR, n), 'utf8').split('\n')) {
      if (line.includes('"bitti"')) { try { sureEkle(JSON.parse(line)); } catch (e) { } }
    }
  }
} catch (e) { log('[sure] okunamadı', e.message); }

// IP başına sınır: 10 dakikada 600 olay
const hits = new Map();
setInterval(() => hits.clear(), 10 * 60e3).unref();

function olayAl(req, res, head) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  let size = 0, body = '';
  req.on('data', (c) => { size += c.length; if (size > 16384) { req.destroy(); return; } body += c; });
  req.on('end', () => {
    res.writeHead(204, head); res.end();
    let arr;
    try { arr = JSON.parse(body); } catch (e) { return; }
    if (!Array.isArray(arr)) arr = [arr];
    const n = (hits.get(ip) || 0) + arr.length;
    hits.set(ip, n);
    if (n > 600) return;
    const now = new Date(), day = now.toISOString().slice(0, 10), z = now.toISOString(), ipk = ipKisa(ip);
    let sys = null;
    for (const raw of arr.slice(0, 40)) {
      const o = temizle(raw);
      if (!o) continue;
      if (o.tur === 'acilis') Object.assign(o, sys || (sys = sistem(req.headers['user-agent'])));
      buf.push([day, JSON.stringify(Object.assign(o, { z, ip: ipk })) + '\n']);
      sureEkle(o);
    }
  });
}

// ---------- ilerleme yedeği ----------
// Kod hesap yerine geçer: 12 harf/rakam (karışan 0/O, 1/I/L yok), 31^12 ≈ 2^59 olasılık. Dosya adı kodun özeti,
// kod düz hâliyle hiçbir yerde saklanmaz. Kod dışında kişisel bilgi yok: yalnız oyunun ilerleme kaydı.
const KOD_HARF = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const kodTemiz = (k) => { const x = String(k || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); return /^[2-9A-HJKMNP-Z]{12}$/.test(x) ? x : null; };
const kodBicim = (k) => k.match(/.{4}/g).join('-');
const kodDosya = (k) => path.join(YEDEK, crypto.createHash('sha256').update('vals-yedek:' + k).digest('hex') + '.json');
const yedekSay = new Map();
setInterval(() => yedekSay.clear(), 3600e3).unref();
function sinir(ip, tur, max) { const k = tur + ip, n = (yedekSay.get(k) || 0) + 1; yedekSay.set(k, n); return n > max; }

function govdeOku(req, max, cb) {
  let size = 0, body = '', asti = false;
  req.on('data', (c) => { size += c.length; if (size > max) { asti = true; req.destroy(); return; } body += c; });
  req.on('end', () => { if (asti) return cb(null); try { cb(JSON.parse(body)); } catch (e) { cb(null); } });
}
function yedekYaz(req, res, head, ip) {
  const json = (code, o) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, head)); res.end(JSON.stringify(o)); };
  govdeOku(req, 300000, (b) => {
    if (!b || typeof b.profil !== 'object' || !b.profil || Array.isArray(b.profil)) return json(400, { hata: 'profil gerekli' });
    let kod = null;
    if (b.kod) {
      if ((yedekSay.get('yanlis' + ip) || 0) >= 30) return json(429, { hata: 'çok fazla deneme' });
      kod = kodTemiz(b.kod);
      if (!kod || !fs.existsSync(kodDosya(kod))) { sinir(ip, 'yanlis', 1); return json(404, { hata: 'kod yok' }); }
      if (sinir(ip, 'yaz', 2000)) return json(429, { hata: 'çok sık' });
    } else {
      if (sinir(ip, 'yeni', 20)) return json(429, { hata: 'çok sık' });
      do { kod = Array.from({ length: 12 }, () => KOD_HARF[crypto.randomInt(KOD_HARF.length)]).join(''); } while (fs.existsSync(kodDosya(kod)));
    }
    const z = new Date().toISOString();
    const f = kodDosya(kod), tmp = f + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify({ z, profil: b.profil }), { mode: 0o600 });
      fs.renameSync(tmp, f);
    } catch (e) { log('[yedek] yazma hatası', e.message); return json(500, { hata: 'yazılamadı' }); }
    json(200, { kod: kodBicim(kod), z });
  });
}
function yedekAl(req, res, head, ip) {
  const json = (code, o) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, head)); res.end(JSON.stringify(o)); };
  govdeOku(req, 2000, (b) => {
    if ((yedekSay.get('yanlis' + ip) || 0) >= 30) return json(429, { hata: 'çok fazla deneme, bir saat sonra tekrar dene' });
    const kod = b && kodTemiz(b.kod);
    let d = null;
    try { if (kod) d = JSON.parse(fs.readFileSync(kodDosya(kod), 'utf8')); } catch (e) { }
    if (!d) { sinir(ip, 'yanlis', 30); return void setTimeout(() => json(404, { hata: 'kod yok' }), 400); }
    json(200, { kod: kodBicim(kod), z: d.z, profil: d.profil });
  });
}

// ---------- rapor ----------
function anahtar() {
  try { const k = fs.readFileSync(KEY_FILE, 'utf8').trim(); if (k.length >= 16) return k; } catch (e) { }
  const k = crypto.randomBytes(18).toString('base64url');
  fs.mkdirSync(VERI, { recursive: true });
  fs.writeFileSync(KEY_FILE, k + '\n', { mode: 0o600 });
  log('[rapor] yeni anahtar oluşturuldu:', KEY_FILE);
  return k;
}
anahtar();
const esit = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function readAll() {
  flush();
  const out = [];
  for (const n of fs.readdirSync(DIR).sort()) {
    if (!/\.jsonl$/.test(n)) continue;
    for (const line of fs.readFileSync(path.join(DIR, n), 'utf8').split('\n')) {
      if (!line) continue;
      try { out.push(JSON.parse(line)); } catch (e) { }
    }
  }
  return out;
}

function download(url, dest) {
  return new Promise((res, rej) => {
    https.get(url, (r) => {
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      const tmp = dest + '.tmp';
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      r.pipe(zlib.createGunzip()).pipe(fs.createWriteStream(tmp)).on('finish', () => { fs.renameSync(tmp, dest); res(); }).on('error', rej);
    }).on('error', rej);
  });
}
let geo = null, geoAt = 0;
const ipCache = new Map();
async function getGeo() {
  if (geo && Date.now() - geoAt < 864e5) return geo;
  try {
    const old = !fs.existsSync(GEO) || Date.now() - fs.statSync(GEO).mtimeMs > 35 * 864e5;
    if (old) {
      const d = new Date();
      for (const k of [0, 1]) {
        const x = new Date(d.getFullYear(), d.getMonth() - k, 1);
        const m = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
        try { await download(`https://download.db-ip.com/free/dbip-city-lite-${m}.mmdb.gz`, GEO); break; } catch (e) { }
      }
    }
    if (fs.existsSync(GEO)) {
      const { Reader } = require('maxmind');
      geo = new Reader(fs.readFileSync(GEO));
    }
  } catch (e) { log('[geo]', e.message); }
  geoAt = Date.now();
  ipCache.clear();
  return geo;
}
const UL = { Turkey: 'Türkiye', Türkiye: 'Türkiye', Germany: 'Almanya', Netherlands: 'Hollanda', 'The Netherlands': 'Hollanda', 'United States': 'ABD', 'United Kingdom': 'İngiltere', France: 'Fransa', Sweden: 'İsveç', Azerbaijan: 'Azerbaycan', Cyprus: 'Kıbrıs', Austria: 'Avusturya', Belgium: 'Belçika', Switzerland: 'İsviçre', Ireland: 'İrlanda', Finland: 'Finlandiya' };
const TR_AD = { Istanbul: 'İstanbul', Izmir: 'İzmir', Igdir: 'Iğdır' };
const trAd = (s) => { s = String(s || '').replace(/ Province$/, ''); return TR_AD[s] || s; };
function konum(g, ip) {
  if (ipCache.has(ip)) return ipCache.get(ip);
  let out = null;
  try {
    const r = g && g.get(ip.replace(/::$/, '::1').replace(/\.0$/, '.1'));
    if (r) {
      const nm = (o) => o && o.names && (o.names.tr || o.names.en);
      const u = r.country && r.country.names && r.country.names.en;
      out = { sh: trAd(nm(r.city)) || '?', il: trAd(nm(r.subdivisions && r.subdivisions[0])) || '', ul: UL[u] || nm(r.country) || '?' };
    }
  } catch (e) { }
  ipCache.set(ip, out);
  return out;
}
async function veri() {
  const g = await getGeo();
  const olaylar = readAll().map((e) => {
    const o = Object.assign({}, e);
    delete o.ip;
    if (e.ip) { Object.assign(o, konum(g, e.ip) || {}); o.ag = crypto.createHash('sha256').update(e.ip).digest('hex').slice(0, 8); }
    return o;
  });
  return { uretildi: new Date().toISOString(), konum: !!g, olaylar };
}

// ---------- HTTP ----------
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0].replace(/\/+$/, '');
  const origin = req.headers.origin;
  const head = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' };
  if (p === '/api/olay') {
    const cors = Object.assign({}, head, ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' } : {});
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method === 'POST') return olayAl(req, res, cors);
    res.writeHead(405, cors); return res.end();
  }
  if (p === '/api/sure') {
    const cors = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, head, ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {});
    const d = sureKiyas(new URL(req.url, 'http://x').searchParams);
    res.writeHead(d ? 200 : 400, cors); return res.end(JSON.stringify(d || { hata: 's ya da b gerekli' }));
  }
  if (p === '/api/yedek' || p === '/api/yedek/al') {
    const cors = Object.assign({}, head, ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' } : {});
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method !== 'POST') { res.writeHead(405, cors); return res.end(); }
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    return p === '/api/yedek' ? yedekYaz(req, res, cors, ip) : yedekAl(req, res, cors, ip);
  }
  if (p === '/api/durum') { res.writeHead(200, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, head)); return res.end('ok'); }
  if (p === '/api/rapor') {
    return fs.readFile(PAGE, (err, b) => {
      if (err) { res.writeHead(500, head); return res.end('rapor sayfası yok'); }
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, head)); res.end(b);
    });
  }
  if (p === '/api/rapor/veri') {
    if (!esit(req.headers['x-anahtar'], anahtar())) {
      return void setTimeout(() => { res.writeHead(401, Object.assign({ 'Content-Type': 'application/json' }, head)); res.end('{"hata":"anahtar yanlış"}'); }, 800);
    }
    return void veri().then((d) => {
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, head)); res.end(JSON.stringify(d));
    }, (e) => { res.writeHead(500, head); res.end(JSON.stringify({ hata: e.message })); });
  }
  res.writeHead(404, head); res.end();
});
server.listen(PORT, '127.0.0.1', () => log(`Vals olay sunucusu 127.0.0.1:${PORT}, veri ${VERI}`));
process.on('SIGTERM', () => { flush(); process.exit(0); });
