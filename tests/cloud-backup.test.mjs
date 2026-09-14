import assert from "node:assert/strict";
import test from "node:test";
import { createCloudBackupPackage, decodeCloudBackupPackage } from "../client/src/js/cloud-backup-codec.js";

const backupPayload = {
  schema: "hesabi-backup",
  version: 1,
  databaseVersion: 7,
  exportedAt: "2026-08-22T00:00:00.000Z",
  stores: {
    settings: [{ id: "app", storeName: "متجر الاختبار" }],
    products: [{ id: "product-1", name: "صنف تجريبي", quantity: 5, notes: "ن".repeat(900) }],
    meta: [{ id: "invoiceSequence", value: 2 }],
  },
};

test("يجزئ النسخة السحابية ويعيدها مع الحفاظ على المحتوى والبصمة", async () => {
  const packed = await createCloudBackupPackage(backupPayload, { chunkCharLimit: 1024, preferCompression: false });
  assert.ok(packed.chunks.length > 1);
  assert.equal(packed.metadata.chunkCount, packed.chunks.length);
  assert.equal(packed.metadata.storeSummary.products, 1);
  assert.deepEqual(await decodeCloudBackupPackage(packed.metadata, packed.chunks), backupPayload);
});

test("يرفض الاستعادة عند تغيير جزء من النسخة قبل لمس IndexedDB", async () => {
  const packed = await createCloudBackupPackage(backupPayload, { chunkCharLimit: 1024, preferCompression: false });
  const tampered = packed.chunks.map((chunk) => ({ ...chunk }));
  tampered[0].data = `${tampered[0].data.slice(0, -1)}${tampered[0].data.endsWith("A") ? "B" : "A"}`;
  await assert.rejects(() => decodeCloudBackupPackage(packed.metadata, tampered), /بصمة النسخة السحابية|حجم النسخة السحابية/);
});

test("يحجب النسخ التي تتجاوز الحد التشغيلي قبل محاولة الرفع", async () => {
  await assert.rejects(
    () => createCloudBackupPackage(backupPayload, { maxEncodedBytes: 10, preferCompression: false }),
    /يتجاوز الحد الآمن/,
  );
});
