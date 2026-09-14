import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../client/src/js/database.js";

test("شراء كرتون يحدث مخزون الحبات وسعر المنتج وبيانات التعبئة في معاملة واحدة", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج تعبئة اختبار", unit: "حبة", purchasePrice: 10, salePrice: 15, quantity: 2, minimumStock: 1 });
  const purchase = await db.createPurchase({
    items: [{ productId: product.id, packageUnit: "كرتون", packageQuantity: 2, unitsPerPackage: 24, packageCost: 1200, salePrice: 65 }],
  });
  const updated = await db.getProduct(product.id);
  const saved = await db.getPurchase(purchase.id);

  assert.equal(updated.quantity, 50);
  assert.equal(updated.purchasePrice, 50);
  assert.equal(updated.salePrice, 65);
  assert.equal(updated.purchasePackageUnit, "كرتون");
  assert.equal(updated.unitsPerPackage, 24);
  assert.equal(saved.total, 2400);
  assert.deepEqual(saved.items.map(({ packageUnit, packageQuantity, unitsPerPackage, packageCost, quantity, unitCost, total, salePrice }) => ({ packageUnit, packageQuantity, unitsPerPackage, packageCost, quantity, unitCost, total, salePrice })), [{ packageUnit: "كرتون", packageQuantity: 2, unitsPerPackage: 24, packageCost: 1200, quantity: 48, unitCost: 50, total: 2400, salePrice: 65 }]);
  await db.resetAllData();
});

test("يجد المنتج بالكود الداخلي دون الاعتماد على الباركود", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج كود داخلي", internalCode: "INT-440", unit: "حبة", purchasePrice: 10, salePrice: 20, quantity: 1, minimumStock: 0 });
  const found = await db.findProductByInternalCode(" INT-440 ");
  assert.equal(found?.id, product.id);
  assert.equal(await db.findProductByInternalCode("INT-NOT-FOUND"), null);
  await db.resetAllData();
});
