/**
 * مُرحِّل إشعارات حسابي — تشفير Web Push وتوقيع VAPID في الطبقتين (browser + node).
 *
 * لماذا من العميل؟ المزامنة عندنا offline-first: قد لا يوجد خادم يعمل لحظة الحدث، بينما
 * جهاز المتجر الذي نفّذ العملية يعمل. فالجهاز نفسه يبعث الإشعار لبقية أجهزته مباشرةً إلى
 * الـ endpoint الذي أعاده المتصفح — وهو fcm.googleapis.com على أندرويد، لذا يصل والتطبيق مغلق.
 * صفر اعتماديات، والملف نفسه يعمل في Node ليُختبر بلا متصفح.
 *
 * المعايير: RFC8188 (aes128gcm) · RFC8291 (التشفير) · RFC8292 (VAPID/JWS ES256).
 */

const enc = new TextEncoder();

/* ============================ SHA‑256 ============================ */
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const rotr32 = (x, n) => (x >>> n) | (x << (32 - n));

function sha256(bytes) {
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 9 + 63) >> 6) << 6) || 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  view.setUint32(padded.length - 4, bitLen >>> 0);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i += 1) {
      // الأقواس ليست زينة: '+' تسبق '>>>'، وأي إهمال يفسد الدوران كله.
      const bigSigma0 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const smallSigma0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      let t1 = h + bigSigma0; t1 >>>= 0;
      t1 = (t1 + ch) >>> 0; t1 = (t1 + K256[i]) >>> 0; t1 = (t1 + w[i]) >>> 0;
      const t2 = (smallSigma0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i += 1) H[i] = (H[i] + next[i]) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) odv.setUint32(i * 4, H[i] >>> 0);
  return out;
}

const toBytes = (value) => (typeof value === "string" ? enc.encode(value) : value);
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** HMAC‑SHA256 عبر Web Crypto، مع مسار نقي احتياطًا. */
async function hmacSha256(keyBytes, message) {
  const key = toBytes(keyBytes);
  const data = toBytes(message);
  if (globalThis.crypto?.subtle) {
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
  }
  let material = key;
  if (material.length > 64) material = sha256(material);
  const pad = (n) => {
    const out = new Uint8Array(64);
    out.fill(n);
    out.set(material);
    return out;
  };
  return sha256(concat(pad(0x5c), sha256(concat(pad(0x36), data))));
}

/** HKDF‑SHA256 (RFC5869). */
async function hkdf(ikm, salt, info, length) {
  return hkdfExpand(await hmacSha256(toBytes(salt), toBytes(ikm)), toBytes(info), length);
}
async function hkdfExpand(prk, info, length) {
  const out = new Uint8Array(length);
  let previous = new Uint8Array(0);
  let filled = 0;
  for (let counter = 1; filled < length; counter += 1) {
    previous = await hmacSha256(prk, concat(previous, info, new Uint8Array([counter])));
    out.set(previous.subarray(0, Math.min(previous.length, length - filled)), filled);
    filled += previous.length;
  }
  return out;
}

/* ============================ base64url ============================ */
const base64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decodeBase64Url = (value) => {
  const normal = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

/* ============================ P‑256 ============================ */
/**
 * ثوابت prime256v1 (SEC2 §2.4.2 / NIST P‑256). لا تُحرَّر يدويًا مرة أخرى:
 * SANE_POINT يتحقّق أن G على المنحنى، وأي تحريف يوقف كل إرسال بدل أن يُنتج
 * مفاتيح خاطئة تُرفض عند التسليم بعد أسبوع.
 */
const CURVE = {
  p: 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn,
  n: 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n,
  a: 0xffffffff00000001000000000000000000000000fffffffffffffffffffffffcn, // −3
  b: 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn,
  gx: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
  gy: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
};
const modp = (x) => ((x % CURVE.p) + CURVE.p) % CURVE.p;
const modn = (x) => ((x % CURVE.n) + CURVE.n) % CURVE.n;
function invMod(x, m) {
  let [oldR, r] = [((x % m) + m) % m, m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % m) + m) % m;
}
function pointDouble(point) {
  if (!point || point[1] === 0n) return null;
  const s = modp(modp(3n * point[0] * point[0] + CURVE.a) * invMod(modp(2n * point[1]), CURVE.p));
  const x = modp(s * s - 2n * point[0]);
  return [x, modp(s * (point[0] - x) - point[1])];
}
function pointAdd(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left[0] === right[0]) return modp(left[1] + right[1]) === 0n ? null : pointDouble(left);
  const s = modp(modp(right[1] - left[1]) * invMod(modp(right[0] - left[0]), CURVE.p));
  const x = modp(s * s - left[0] - right[0]);
  return [x, modp(s * (left[0] - x) - left[1])];
}
function scalarMul(scalar, point) {
  let result = null;
  let addend = point;
  let k = modn(scalar);
  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend);
    addend = pointDouble(addend);
    k >>= 1n;
  }
  return result;
}
/** تحقّق ذاتي: G يجب أن تحقق y² = x³ + ax + b (mod p) — يكشف أي تحريف للثوابت. */
function curveIsSane() {
  const lhs = modp(CURVE.gy * CURVE.gy);
  const rhs = modp(CURVE.gx * CURVE.gx * CURVE.gx + CURVE.a * CURVE.gx + CURVE.b);
  return lhs === rhs;
}
const to32Bytes = (value) => {
  const out = new Uint8Array(32);
  let rest = value;
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
};
const fromBytes = (bytes) => bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
/** يشتق النقطة العامة من d وحده — لأن JWK في VAPID يحمل d فقط. */
function derivePublicKey(privateKeyBase64Url) {
  if (!curveIsSane()) throw new Error("ثوابت منحنى P‑256 محرفة — راجع CURVE");
  const point = scalarMul(fromBytes(decodeBase64Url(privateKeyBase64Url)), [CURVE.gx, CURVE.gy]);
  if (!point) throw new Error("مفتاح VAPID خاص غير صالح (d ≡ 0)");
  const x = to32Bytes(point[0]);
  const y = to32Bytes(point[1]);
  return { x: base64Url(x), y: base64Url(y), xBytes: x, yBytes: y, uncompressed: base64Url(concat(new Uint8Array([0x04]), x, y)) };
}

/**
 * يوحّد التوقيع إلى r‖s الخام (64 بايت) كما يطلب JWS/ES256.
 * Web Crypto تُعيد الخام مباشرةً (64 بايت)، و Node/OpenSSL يُعيدان DER — فنُطبّع الاثنين.
 */
function toRawSignature(signature) {
  // نُوحّد النوع إلى Uint8Array: الناتج لا يعتمد على نوع المُدخَل (Buffer أو ArrayBuffer أو قسيم)
  // في Node الـ Buffer تسكن 풀ًا مشتركًا: new Uint8Array(buf) يقرأ من بداية المخزن كله
  // لا من byteOffset، فيرى بايتات غريبة. slice يُعتمد على نوعه فينسخ المحتوى بأمان في الطبقتين.
  const bytes = signature instanceof ArrayBuffer ? new Uint8Array(signature) : Uint8Array.prototype.slice.call(signature);
  // التعرّف على DER أوّلًا: التوقيع الخام قد يبدأ صدفةًا بـ 0x30 (نحو 0.4% من المفاتيح) وطوله 64،
  // فاختبار الطول وحده كان يُرجعه كما هو ويترك DER يُقرأ كخام — فشل صامت عند التسليم.
  if (bytes[0] === 0x30 && bytes.length > 64 && bytes.length <= 72) {
    let i = 1;
    if (bytes[i] >= 0x81) throw new Error("رأس DER غير مطابق لتوقيع ECDSA/P‑256"); // 72 حدّ أقصى ⇒ صيغة قصيرة دائمًا
    i += 1;
    const readInt = () => {
    if (bytes[i] !== 0x02) throw new Error("DER غير صالح داخل التوقيع");
    const length = bytes[i + 1];
    // نحذف صفر الإشارة من نسخة Uint8Array جديدة صراحةً: Buffer.subarray يُبقي الإزاحة
    // فيصبح slice(1) بلا أثر (يقفز إلى عنصر ما قبل الرأس) — فخّ صامت لا يظهر في المتصفح.
    const value = Uint8Array.prototype.slice.call(bytes, i + 2, i + 2 + length);
    i += 2 + length;
    const unsigned = value.length === 33 && value[0] === 0x00 ? value.subarray(1) : value;
    if (unsigned.length > 32) throw new Error("مكوّنة توقيع أطول من 32 بايت");
      return unsigned.length === 32 ? unsigned : concat(new Uint8Array(32 - unsigned.length), unsigned);
    };
    return concat(readInt(), readInt());
  }
  if (bytes.length !== 64) throw new Error("توقيع ECDSA بحجم غير متوقع وليس DER");
  return bytes;
}

/* مرمِّز DER صغير — الطول يُحسَب من المحتوى، فاحتمال التحريف اليدوي يختفي. */
const derLen = (n) => (n < 0x80 ? new Uint8Array([n]) : new Uint8Array([0x81, n & 0xff]));
const der = (tag, contents) => concat(new Uint8Array([tag]), derLen(contents.length), contents);
const derInt = (value) => der(0x02, new Uint8Array([value]));

/**
 * يبني PKCS#8 لزوج P‑256 من d والنقطة العامة المشتقة. نستخدم DER بدل JWK لأن
 * Web Crypto تطلب في JWK الخاص x و y صراحةً، وترفض ext:false مع مفتاح غير قابل
 * للاستخراج — والمفتاح الخاص لا يجب أن يكون قابلًا للاستخراج في صفحة ويب أصلًا.
 */
function pkcs8FromPrivate(dBytes, publicKeyPointBytes) {
  const algorithm = der(0x30, concat(der(0x06, new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01])), der(0x06, new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]))));
  const ecPrivateKey = der(
    0x30,
    concat(derInt(1), der(0x04, dBytes), der(0xa1, der(0x03, concat(new Uint8Array([0x00]), publicKeyPointBytes)))),
  );
  return der(0x30, concat(derInt(0), algorithm, der(0x04, ecPrivateKey)));
}

/* ============================ توليد المفاتيح ============================ */
/**
 * يولّد زوج VAPID (ES256/P‑256). السرّ يبقى في ذاكرة الجهاز الباعث ولا يُصدَّر أبدًا.
 * لا حاجة لـ `web-push` ولا لخادم: Web Crypto تكفي، وهي نفس الخوارزمية حرفيًا.
 */
async function generateVapidKeypair() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  if (publicRaw.length !== 65) throw new Error("المفتاح العام غير مضغوط كما يتطلب Web Push");
  return { privateKey: jwk.d, publicKey: base64Url(publicRaw) };
}

/* ============================ VAPID ============================ */
/** يبني ترويسة Authorization: vapid t=…, k=… موقّعة ES256. */
async function signVapidJwt({ privateKey, publicKey, audience, subject, ttlSeconds = 43200, now = Math.floor(Date.now() / 1000) }) {
  if (!audience) throw new Error("VAPID يحتاج audience = أصل الـ endpoint");
  const derived = derivePublicKey(privateKey);
  const publicUncompressed = publicKey || derived.uncompressed;
  const header = base64Url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64Url(enc.encode(JSON.stringify({ aud: audience, exp: now + ttlSeconds, iat: now, sub: subject || "mailto:hesabi@localhost" })));
  const input = concat(enc.encode(`${header}.${claims}`));
  const pkcs8 = pkcs8FromPrivate(decodeBase64Url(privateKey), concat(new Uint8Array([0x04]), derived.xBytes, derived.yBytes));
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, input);
  return { jwt: `${header}.${claims}.${base64Url(toRawSignature(signature))}`, publicKey: publicUncompressed };
}

/* ============================ RFC8291 ============================ */
/**
 * يشفّر حمولة لاشتراك واحد بصيغة RFC8188 aes128gcm.
 * الحدّ rs−(salt+keyid+rs+tag) نطبّقه صراحةً: الرفض هنا أوضح من رفض المزوّد.
 */
async function encryptPush({ payload, p256dh, auth, salt, recordSize = 4096 }) {
  const plaintext = typeof payload === "string" ? enc.encode(payload) : toBytes(payload);
  const headerLength = 16 + 1 + 65 + 4;
  const maxPlain = recordSize - headerLength - 16 - 1;
  if (plaintext.length > maxPlain) throw new Error(`حمولة الإشعار ${plaintext.length} بايت تتجاوز الحد ${maxPlain}`);

  const realSalt = salt && salt.length === 16 ? salt : crypto.getRandomValues(new Uint8Array(16));
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const aswePublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const uaPublic = decodeBase64Url(p256dh);
  const authSecret = decodeBase64Url(auth);
  if (uaPublic.length !== 65) throw new Error("p256dh يجب أن يكون 65 بايت غير مضغوط");
  if (authSecret.length < 16) throw new Error("مفتاح auth قصير — اشتراك تالف، يلزم إعادة اشتراك");

  const peer = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // RFC8291 §3.4: ikm = ECDH(aswe_priv, ua_pub)، و salt = HKDF‑Extract بملح = SHA256("WebPush: info\0"‖ua_pub‖aswe_pub)
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: peer }, pair.privateKey, 256));
  const hash = sha256(concat(enc.encode("WebPush: info\u0000"), uaPublic, aswePublic));
  const ikm = await hkdf(ecdhSecret, hash, new Uint8Array(0), 32);
  const prk = await hmacSha256(realSalt, ikm);
  const cek = await hkdfExpand(prk, enc.encode("Content-Encoding: aes128gcm\u0000"), 16);
  const nonce = await hkdfExpand(prk, enc.encode("Content-Encoding: nonce\u0000"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipherText = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))));

  const body = concat(
    realSalt,
    new Uint8Array([aswePublic.length]),
    aswePublic,
    new Uint8Array([(recordSize >>> 24) & 0xff, (recordSize >>> 16) & 0xff, (recordSize >>> 8) & 0xff, recordSize & 0xff]),
    cipherText,
  );
  // aswePrivate لأغراض الاختبار المرجعي فقط (فكّ التشفير في الاختبار)؛ لا يُستخدم في الإنتاج.
  const aswePrivate = decodeBase64Url((await crypto.subtle.exportKey("jwk", pair.privateKey)).d);
  return { body, salt: realSalt, aswePublic, aswePrivate, recordSize };
}

/**
 * يبني طلبًا كاملًا لجهاز واحد: endpoint + ترويسات + جسم، جاهزًا لـ fetch.
 * يُعيد أيضًا ناتج التشفير — لأغراض الاختبار المرجعي فقط.
 */
async function buildPushRequest({ payload, subscription, vapid }) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) throw new Error("اشتراك ناقص");
  const url = new URL(subscription.endpoint);
  const encryption = await encryptPush({ payload, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth });
  const { body, aswePublic } = encryption;
  const { jwt, publicKey } = await signVapidJwt({
    privateKey: vapid.privateKey,
    publicKey: vapid.publicKey,
    audience: `${url.protocol}//${url.host}`,
    subject: vapid.subject,
    ttlSeconds: vapid.ttlSeconds,
  });
  return {
    endpoint: subscription.endpoint,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: String(vapid.ttl ?? 604800),
      Urgency: vapid.urgent ? "high" : "normal",
      "Crypto-Key": `dh=${base64Url(aswePublic)}`,
      Authorization: `vapid t=${jwt}, k="${publicKey}"`,
    },
    body,
    encryption,
  };
}

/* ============================ الإرسال لجماعة ============================ */
/**
 * يبعث نفس الحمولة (مشفّرة لكل اشتراك على حدة) إلى قائمة اشتراكات أجهزة المتجر.
 * - لا ينتظر أحدًا: كل محاولة تُبتلع، والفشل لا يرفع استثناءً (الإشعار تكميلي دائمًا).
 * - 404/410 = اشتراك ميّت → يُعاد في unsubscribed ليُحذف من السجل.
 * - حدّ التزامن يمنع إغراق مزوّد الدفع عند كثرة الأجهزة.
 */
async function sendToSubscriptions({ alerts, vapid, concurrency = 4, fetchImpl = (typeof fetch !== "undefined" ? fetch : undefined), timeoutMs = 8000 }) {
  const result = { sent: 0, failed: 0, skipped: 0, unsubscribed: [], errors: [] };
  if (!fetchImpl || !alerts?.length) return { ...result, skipped: alerts?.length ?? 0 };
  const usable = alerts.filter((a) => a && (a.subscription || a.endpoint) && a.payload !== undefined);
  const queue = [...usable];
  result.skipped += alerts.length - usable.length;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
    while (queue.length) {
      const alert = queue.shift();
      const subscription = alert?.subscription ?? alert;
      try {
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) { result.skipped += 1; continue; }
        const request = await buildPushRequest({ payload: JSON.stringify(alert.payload ?? {}), subscription, vapid });
        const signal = AbortSignal?.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
        const response = await fetchImpl(request.endpoint, { method: "POST", headers: request.headers, body: request.body, signal });
        if (response.status === 404 || response.status === 410) {
          result.unsubscribed.push(subscription.endpoint);
        } else if (!response.ok) {
          result.failed += 1;
          result.errors.push(`${response.status} ${(await response.text().catch(() => "")).slice(0, 160)}`);
        } else {
          result.sent += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.errors.push(String(error?.message || error).slice(0, 160));
      }
    }
  });
  await Promise.all(workers);
  return result;
}

/** دمج تنبيهات اللحظة نفسها في إشعار واحد حتى لا تنهال عشرة تنبيهات على كل جهاز. */
function collapseAlerts(alerts, { maxPerNotification = 4 } = {}) {
  const valid = (alerts || []).filter((a) => a && (a.title || a.body));
  if (!valid.length) return null;
  const first = valid[0];
  if (valid.length === 1) return { ...first, tag: first.key || first.tag || "hesabi-alert" };
  const extra = valid.slice(maxPerNotification);
  const lines = valid.slice(0, maxPerNotification).map((a) => a.body || a.title);
  return {
    ...first,
    title: first.title || "حسابي",
    body: lines.join(" · ") + (extra.length ? ` (+${extra.length})` : ""),
    tag: `hesabi-batch-${valid.length}`,
    topics: [...new Set(valid.map((a) => a.topic).filter(Boolean))],
  };
}

export {
  sha256,
  hkdfExpand,
  generateVapidKeypair,
  sendToSubscriptions,
  collapseAlerts,
  hmacSha256,
  hkdf,
  base64Url,
  decodeBase64Url,
  curveIsSane,
  derivePublicKey,
  pkcs8FromPrivate,
  toRawSignature,
  signVapidJwt,
  encryptPush,
  buildPushRequest,
};
