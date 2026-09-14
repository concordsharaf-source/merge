import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const backup = await readFile(new URL("../client/src/js/firebase-backup.js", import.meta.url), "utf8");
const sync = await readFile(new URL("../client/src/js/firebase-sync.js", import.meta.url), "utf8");

test("شاشة البداية تفصل دخول الجهاز المساعد عن فتح متجر جديد", () => {
  assert.match(app, /data-action="assistant-login"/);
  assert.match(app, /function openAssistantEntryDialog/);
  assert.match(app, /requestAssistantDevice/);
  assert.doesNotMatch(app, /crypto\.randomUUID/);
  assert.match(app, /normalizeAccountName/);
  assert.match(app, /const matches = state\.accounts\.filter/);
  assert.match(backup, /from \"firebase\/app\"/);
  assert.match(backup, /getAuth/);
  assert.match(sync, /from \"firebase\/app\"/);
  assert.match(sync, /signInAnonymously/);
  assert.match(sync, /import \{ getApp, getApps, initializeApp \} from "firebase\/app"/);
  assert.match(app, /applySyncChanges\(state\.cloud\.identity\.bootstrapChanges\)/);
  assert.doesNotMatch(app, /restoreBackup\(mergeRemoteChanges\(current, state\.cloud\.identity\.bootstrapChanges\)\)/);
});

test("قواعد Firestore تحافظ على النسخ وتضيف حماية المتجر", () => {
  assert.match(rules, /match \/backupOwners\/{userId}/);
  assert.match(rules, /match \/storeDirectory\/{emailKey}/);
  assert.match(rules, /match \/stores\/{storeId}/);
  assert.match(rules, /match \/pairRequests\/{requestId}/);
  assert.match(rules, /match \/operations\/{operationId}/);
  assert.match(rules, /request\.resource\.data\.pairingCode is string/);
  assert.match(rules, /data\.usedAt == null/);
  assert.match(rules, /allow read, write: if false/);
});
