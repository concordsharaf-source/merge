/**
 * اختبار مرجعي لنواة Web Push (client/src/js/push-relay.js) — بـ node فقط، بلا متصفح.
 *
 * نولّد زوج VAPID واشتراكًا بكودنا، نشفّر ونوقّع، ثم نفكّ التشفير ونتحقّق من التوقيع
 * باشتقاق RFC8291 مكتوبًا بشكل مستقل (HMAC يدوي قياسي) وبمفتاح Node. نجاحه يعني أن
 * ما يستقبله مزوّد الدفع مطابق لـ RFC8188/8291/8292.
 *
 * لماذا لا نستخدم crypto.hkdfSync كمرجع؟ لأنه لا يطبّق HKDF‑Extract القياسي (يستخدم IKM
 * كمفتاح HMAC مباشرةً)، وأي مطابقة به تعطي نتيجة خاطئة. وhttp_ece لا يصلح فكًّا لأنه
 * يفترض ترتيب رأس مختلفًا عن RFC8188 (rs قبل keyid).
 *
 * التشغيل: pnpm push:relay   أو   node scripts/push-relay-reference.test.mjs
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const relay = await import(`${here}../client/src/js/push-relay.js`);

/** تحقّق ECDSA بـ Node: التوقيع الخام r‖s يحتاج dsaEncoding داخل كائن المفتاح. */
const keyVerifySha256 = (publicKey, message, raw) =>
  crypto.verify("sha256", message, { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(raw));
/** ترميز صحيح لعدد صحيح DER: يُضاف صفر الإشارة فقط عندما تكون القيمة ≥ 2⁷. */
const derEncodeInt = (hex) => {
  const bytes = Buffer.from(hex, "hex");
  const content = bytes[0] > 0x7f ? Buffer.concat([Buffer.from([0x00]), bytes]) : bytes;
  return Buffer.concat([Buffer.from([0x02, content.length]), content]);
};

const text = (value) => new TextEncoder().encode(value);
const nul = (value) => Buffer.concat([Buffer.from(value, "utf8"), Buffer.from([0])]);
const extract = (saltBytes, ikmBytes) => crypto.createHmac("sha256", saltBytes).update(ikmBytes).digest();
function expand(prkBytes, infoBytes, length) {
  let out = Buffer.alloc(0);
  let previous = Buffer.alloc(0);
  for (let counter = 1; out.length < length; counter += 1) {
    previous = crypto.createHmac("sha256", prkBytes).update(Buffer.concat([previous, infoBytes, Buffer.from([counter])])).digest();
    out = Buffer.concat([out, previous]);
  }
  return out.subarray(0, length);
}

test("ثوابت P‑256 سليمة والنقطة العامة تُشتق من d وحده", async () => {
  assert.equal(relay.curveIsSane(), true);
  const pair = await relay.generateVapidKeypair();
  assert.match(pair.publicKey, /^[A-Za-z0-9_-]{87}$/, "المفتاح العام = 87 محرف base64url (65 بايت: 21 ثلاثية + بايتان → 87)");
  const derived = relay.derivePublicKey(pair.privateKey);
  assert.equal(derived.uncompressed, pair.publicKey, "اشتقاق d → النقطة العامة يجب أن يطابق المفتاح المُصدَّر من Web Crypto");
  const spki = Buffer.concat([Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex"), Buffer.from(pair.publicKey, "base64url")]);
  const publicKey = crypto.createPublicKey({ key: spki, format: "der", type: "spki" });
  assert.deepEqual(publicKey.export({ format: "jwk" }), { kty: "EC", crv: "P-256", x: derived.x, y: derived.y }, "المفتاح العام من DER يطابق الإحداثيات المشتقة");
  const message = new TextEncoder().encode("hesabi-curve-probe");
  const signKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: pair.privateKey, x: derived.x, y: derived.y, ext: true, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, message));
  assert.equal(raw.length, 64);
  assert.equal(Buffer.from(relay.toRawSignature(raw)).equals(Buffer.from(raw)), true, "مطبّع التوقيع لا يغيّر الخام");
  const bufferBacked = Buffer.from(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, message)); // توقيع آخر، ECDSA غير حدّي
  const normalizedFromBuffer = relay.toRawSignature(bufferBacked);
  assert.equal(normalizedFromBuffer.length, 64);
  assert.equal(normalizedFromBuffer.every((byte) => Number.isInteger(byte)), true, "ناتج المطبّع بايتات لا أصفار إزاحة");
  assert.equal(keyVerifySha256(publicKey, message, raw), true, "المفتاح المشتق والخاص المشتق منه زوج واحد");
});

test("SHA‑256 النقي يطابق Node على كل أطوال الحشو", () => {
  for (const length of [0, 1, 3, 55, 56, 63, 64, 65, 119, 128, 129, 576, 1000]) {
    const data = crypto.randomBytes(length);
    assert.deepEqual(Buffer.from(relay.sha256(data)), crypto.createHash("sha256").update(data).digest(), `اختلاف عند الطول ${length}`);
  }
  assert.equal(Buffer.from(relay.sha256(text("abc"))).toString("hex"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("HMAC و HKDF يطابقان المرجع القياسي", async () => {
  const message = text("مرحبا، حسابي — اختبار على نص عربي وأرقام 12345".repeat(9));
  assert.deepEqual(Buffer.from(await relay.hmacSha256(text("key"), message)), crypto.createHmac("sha256", "key").update(message).digest());
  const reference = expand(extract(text("salt"), message), text("info"), 42);
  assert.deepEqual(Buffer.from(await relay.hkdf(message, text("salt"), text("info"), 42)), reference);
});

test("رحلة الإشعار كاملة: تشفيرنا يُفكّ بمرجع RFC8291 وتوقيعنا يتحقّق بـ k=", async () => {
  const vapid = await relay.generateVapidKeypair();
  const uaPair = crypto.createECDH("prime256v1");
  uaPair.generateKeys();
  const authSecret = crypto.randomBytes(16);

  let received = null;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received = { headers: req.headers, raw: Buffer.concat(chunks) };
      res.writeHead(201, { location: "/m/xyz" });
      res.end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    const payload = JSON.stringify({ title: "تنبيه مخزون", body: "نفد «أرز بسمتي ٥ كجم»", topic: "stock-out", url: "/inventory" });
    const subscription = {
      endpoint: `http://127.0.0.1:${port}/push/P1`,
      keys: { p256dh: uaPair.getPublicKey("base64url"), auth: authSecret.toString("base64url") },
    };
    const request = await relay.buildPushRequest({ payload, subscription, vapid: { ...vapid, subject: "mailto:owner@example.com", ttlSeconds: 604800 } });

    assert.equal(request.headers["Content-Type"], "application/octet-stream");
    assert.equal(request.headers["Content-Encoding"], "aes128gcm");
    assert.equal(request.headers.TTL, "604800");
    assert.match(request.headers["Crypto-Key"], /^dh=[A-Za-z0-9_-]{87}$/);
    const response = await fetch(request.endpoint, { method: "POST", headers: request.headers, body: request.body });
    assert.equal(response.status, 201);

    // الرأس (RFC8188) ثم فكّ التشفير بالاشتقاق المرجعي
    const message = received.raw;
    const salt = message.subarray(0, 16);
    const keylen = message[16];
    const aswe = message.subarray(17, 17 + keylen);
    const rs = message.readUInt32BE(17 + keylen);
    const cipher = message.subarray(21 + keylen);
    assert.equal(keylen, 65, "معرّف المفتاح = نقطة غير مضغوطة");
    assert.equal(aswe.length, 65);
    assert.ok(rs >= cipher.length, "rs يجب أن يغطي السجل");
    assert.equal(message.length, 21 + keylen + cipher.length, "لا ذيول بعد السجل الوحيد");
    assert.deepEqual(Buffer.from(request.encryption.aswePublic), Buffer.from(aswe), "المفتاح في الرأس هو المُعلن في Crypto-Key");

    const ecdhShared = Buffer.from(uaPair.computeSecret(Buffer.from(aswe)));
    const contextHash = crypto.createHash("sha256").update(Buffer.concat([nul("WebPush: info"), Buffer.from(uaPair.getPublicKey()), Buffer.from(aswe)])).digest();
    const ikmRef = expand(extract(contextHash, ecdhShared), Buffer.alloc(0), 32);
    const prkRef = extract(salt, ikmRef);
    const cek = expand(prkRef, nul("Content-Encoding: aes128gcm"), 16);
    const nonce = expand(prkRef, nul("Content-Encoding: nonce"), 12);
    const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
    decipher.setAuthTag(cipher.subarray(cipher.length - 16));
    const plain = Buffer.concat([decipher.update(cipher.subarray(0, cipher.length - 16)), decipher.final()]);
    assert.equal(plain.at(-1), 2, "حشو نهاية الرسالة 0x02");
    assert.equal(plain.subarray(0, plain.length - 1).toString("utf8"), payload, "الحمولة تصل حرفية (عربية + JSON)");

    // توقيع VAPID
    const auth = /^vapid t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+), k="([A-Za-z0-9_-]+)"$/.exec(received.headers.authorization);
    assert.ok(auth, "ترويسة Authorization بصيغة RFC8292");
    const [headerB64, claimsB64, signatureB64] = auth[1].split(".");
    assert.deepEqual(JSON.parse(Buffer.from(headerB64, "base64url").toString()), { typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(Buffer.from(claimsB64, "base64url").toString());
    assert.equal(claims.aud, `http://127.0.0.1:${port}`);
    assert.equal(claims.sub, "mailto:owner@example.com");
    assert.ok(claims.exp > Math.floor(Date.now() / 1000));
    const rawSig = Buffer.from(signatureB64, "base64url");
    assert.equal(rawSig.length, 64, "JWA/ES256 يريد r‖s الخام لا DER");
    assert.equal(auth[2], vapid.publicKey, 'k="…" هو مفتاح VAPID العام المُستعمل');
    const spki = Buffer.concat([Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex"), Buffer.from(auth[2], "base64url")]);
    const verifyKey = crypto.createPublicKey({ key: spki, format: "der", type: "spki" });
    assert.equal(keyVerifySha256(verifyKey, Buffer.from(`${headerB64}.${claimsB64}`), rawSig), true, "التوقيع يتحقّق بالمفتاح المعلن (r‖s أو DER)");
    assert.equal(keyVerifySha256(verifyKey, Buffer.from(`${headerB64}.${claimsB64}.`), rawSig), false, "العبث بالحمولة يُبطل التوقيع");
    const tampered = Buffer.from(rawSig);
    tampered[7] ^= 0x01;
    assert.equal(keyVerifySha256(verifyKey, Buffer.from(`${headerB64}.${claimsB64}`), tampered), false, "توقيع مُعدَّل لا يتحقّق");

    // Urgency: عالية للتنبيه المهمّ فقط
    const urgentRequest = await relay.buildPushRequest({ payload, subscription, vapid: { ...vapid, urgent: true } });
    assert.equal(urgentRequest.headers.Urgency, "high");
    assert.equal(request.headers.Urgency, "normal");
  } finally {
    server.close();
  }
});

test("الحالات المعطلة تُرفض بصوت عالٍ بدل أن تسكت", async () => {
  const vapid = await relay.generateVapidKeypair();
  const uaPair = crypto.createECDH("prime256v1");
  uaPair.generateKeys();
  const subscription = { endpoint: "https://example.com/p/1", keys: { p256dh: uaPair.getPublicKey("base64url"), auth: crypto.randomBytes(16).toString("base64url") } };
  await assert.rejects(() => relay.encryptPush({ payload: "×".repeat(5000), p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }), /الحد/, "الحمولة الطويلة يجب أن تُرفض صراحةً");
  await assert.rejects(() => relay.encryptPush({ payload: "x", p256dh: subscription.keys.p256dh, auth: "AAAA" }), /auth/, "مفتاح auth قصير");
  await assert.rejects(() => relay.encryptPush({ payload: "x", p256dh: "AAAA", auth: subscription.keys.auth }), /p256dh/, "p256dh غير مضغوط");
  await assert.rejects(() => relay.buildPushRequest({ payload: "x", subscription: { endpoint: "" }, vapid }), /اشتراك ناقص/);
  await assert.rejects(() => relay.signVapidJwt({ privateKey: vapid.privateKey, audience: "", subject: "mailto:a@b.c" }), /audience/);
});

test("collapseAlerts يدمج ولا يلفق", async () => {
  const { collapseAlerts } = relay;
  assert.equal(collapseAlerts([]), null);
  assert.equal(collapseAlerts([{ body: "" }]), null, "بلا عنوان ولا متن لا إشعار");
  const single = collapseAlerts([{ title: "نفاد", body: "خزين منخفض", key: "stock:p1" }]);
  assert.equal(single.title, "نفاد");
  assert.equal(single.tag, "stock:p1", "tag الفرادة يبقى ليسكت التكرار نفسه");
  const many = collapseAlerts(Array.from({ length: 9 }, (unused, index) => ({ title: "تحديث", body: `بند ${index + 1}`, topic: "sync" })));
  assert.match(many.body, /\(\+5\)$/, "الزائد عن الحد يُذكر عددًا لا يُحذف");
  assert.equal(many.topics.join(","), "sync");
});

test("sendToSubscriptions لا يرفع استثناءً أبدًا ويحذف الميّت", async () => {
  const vapid = await relay.generateVapidKeypair();
  const uaPair = crypto.createECDH("prime256v1");
  uaPair.generateKeys();
  const keys = { p256dh: uaPair.getPublicKey("base64url"), auth: crypto.randomBytes(16).toString("base64url") };
  const statuses = { "https://push/a": 201, "https://push/b": 410, "https://push/c": 500 };
  const calls = [];
  const fetchImpl = async (endpoint) => {
    calls.push(endpoint);
    if (endpoint.includes("d")) throw new Error("network down");
    const status = statuses[endpoint];
    return { ok: status === 201, status, text: async () => "boom" };
  };
  const alerts = Object.keys(statuses).map((endpoint) => ({ subscription: { endpoint, keys }, payload: { title: "ت" } }));
  alerts.push({ subscription: { endpoint: "https://push/d", keys }, payload: { title: "ت" } });
  alerts.push({ subscription: null, payload: { title: "ت" } }, { subscription: { endpoint: "https://push/broken", keys: {} }, payload: {} });
  const result = await relay.sendToSubscriptions({ alerts, vapid, fetchImpl });
  assert.equal(result.sent, 1, "الناجح واحد");
  assert.deepEqual(result.unsubscribed, ["https://push/b"], "410 يعني اشتراكًا ميّتًا");
  assert.equal(result.failed, 2, "500 واستثناء الشبكة");
  assert.equal(result.skipped, 2, "اشتراك ناقص/broken يُتخطّى بلا طلب");
  assert.equal(calls.length, 4, "لا طلب على اشتراك بلا endpoint");
  const empty = await relay.sendToSubscriptions({ alerts: [], vapid, fetchImpl });
  assert.deepEqual({ sent: empty.sent, failed: empty.failed }, { sent: 0, failed: 0 });
});

test("مطبّع التوقيع يحترم صفر الإشارة في DER", () => {
  const derOf = (rHex, sHex) => {
    const body = Buffer.concat([derEncodeInt(rHex), derEncodeInt(sHex)]);
    return Buffer.concat([Buffer.from(body.length < 0x80 ? [0x30, body.length] : [0x30, 0x81, body.length]), body]);
  };
  const smallR = "00" + "11".repeat(31); // r < 2^248: DER القياسي يحفظ الصفر أول بايت
  const bigR = "aa".repeat(32); // r ≥ 2^255: DER يفرض صفر إشارة ⇒ 33 بايتًا، يُحذف منها بايت واحد لا أكثر
  assert.equal(Buffer.from(relay.toRawSignature(derOf(smallR, "22".repeat(32)))).subarray(0, 32).toString("hex"), smallR, "r صغير لا يُبتر");
  assert.equal(Buffer.from(relay.toRawSignature(derOf(bigR, "ff".repeat(32)))).subarray(32, 64).toString("hex"), "ff".repeat(32), "s الكبير يُقرأ كاملًا");
  assert.equal(Buffer.from(relay.toRawSignature(derOf(bigR, "ff".repeat(32)))).subarray(0, 32).toString("hex"), bigR, "بايت الإشارة فقط يُزال من r الكبير");
  assert.throws(() => relay.toRawSignature(new Uint8Array(70)), /غير متوقع|غير صالح/, "بيانات عشوائية لا تُقرأ كتوقيع");
  // فخّ 풀 الـ Buffer في Node: مُصفّح مُجمَّع لا يبدأ من الصفر يجب أن يُقرأ كما هو
  const pool = Buffer.alloc(300);
  const view = Buffer.from(derOf(smallR, "22".repeat(32)));
  view.copy(pool, 137);
  const pooled = pool.subarray(137, 137 + view.length);
  assert.ok(pooled.byteOffset > 0, "نحتاج فعلًا مُصفّحًا غير مبتدئ من صفر المخزن");
  assert.equal(Buffer.from(relay.toRawSignature(pooled)).subarray(0, 32).toString("hex"), smallR, "قراءة مُصفّح مجمَّع صحيحة");
});
