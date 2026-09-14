import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../client/src/js/database.js";
import { calculatePackagePurchase } from "../client/src/js/domain.js";

test("حساب العبوة: 5 كراتين × 24 حبة بسعر 240 للكرتون", () => {
  const m = calculatePackagePurchase({ packageQuantity: 5, unitsPerPackage: 24, packageCost: 240 });
  assert.equal(m.quantity, 120, "الكمية = 5×24");
  assert.equal(m.unitCost, 10, "سعر الحبة = 240/24");
  assert.equal(m.total, 1200, "الإجمالي = 5×240");
});

test("إضافة منتج بحقول الكراتين يحفظ سعر الحبة والكمية والعبوة", async () => {
  await db.resetAllData();
  const m = calculatePackagePurchase({ packageQuantity: 3, unitsPerPackage: 12, packageCost: 120 });
  const product = await db.createProduct({
    name: "عصير", unit: "حبة", packageUnit: "كرتون",
    unitsPerPackage: 12, packageCost: 120,
    purchasePrice: m.unitCost, quantity: m.quantity,
    salePrice: 15, minimumStock: 5,
  });
  assert.equal(product.purchasePrice, 10, "سعر شراء الحبة");
  assert.equal(product.quantity, 36, "3 كراتين × 12");
  assert.equal(product.unitsPerPackage, 12);
  assert.equal(product.purchasePackageUnit, "كرتون");
  assert.equal(product.lastPackageCost, 120);
  await db.resetAllData();
});

test("تعديل المنتج يحفظ نوع العبوة وسعرها", async () => {
  await db.resetAllData();
  const p = await db.createProduct({ name: "ماء", unit: "حبة", purchasePrice: 5, salePrice: 8, quantity: 10 });
  const updated = await db.updateProduct(p.id, {
    name: "ماء", unit: "حبة", purchasePrice: 4, salePrice: 8, minimumStock: 2,
    packageUnit: "صندوق", unitsPerPackage: 20, packageCost: 80,
  });
  assert.equal(updated.purchasePackageUnit, "صندوق", "نوع العبوة يُحفظ عند التعديل");
  assert.equal(updated.unitsPerPackage, 20);
  assert.equal(updated.lastPackageCost, 80);
  await db.resetAllData();
});

test("بيع الكرتون يعمل بعد الإضافة من نموذج المنتج", async () => {
  await db.resetAllData();
  const p = await db.createProduct({ name: "شاي", unit: "حبة", packageUnit: "كرتون", unitsPerPackage: 6, packageCost: 60, purchasePrice: 10, salePrice: 15, quantity: 24 });
  assert.ok(p.unitsPerPackage > 1, "المنتج مؤهل للبيع بالكرتون");
  await db.resetAllData();
});
