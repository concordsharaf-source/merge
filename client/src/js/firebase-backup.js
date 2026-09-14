import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc } from "firebase/firestore";
import { CLOUD_BACKUP_MAX_ENCODED_BYTES, createCloudBackupPackage, decodeCloudBackupPackage } from "./cloud-backup-codec.js";
import { shortRandomId } from "./ids.js";

export const CLOUD_BACKUP_RETENTION_LIMIT = 3;

// إعداد عميل Firebase علني بطبيعته؛ حماية البيانات تعتمد على Firebase Auth وقواعد Firestore المقيدة بالمالك.
const publicFirebaseConfig = {
  apiKey: "AIzaSyDQxnFIU1RFSmzpuEcN8UroQO9WfjsQwZw",
  authDomain: "hesabi-backup.firebaseapp.com",
  projectId: "hesabi-backup",
  storageBucket: "hesabi-backup.firebasestorage.app",
  messagingSenderId: "1060015017841",
  appId: "1:1060015017841:web:b19a9d31e79cf0476c30d0",
};

function firebaseConfig() {
  const configured = import.meta.env.VITE_FIREBASE_CONFIG_JSON;
  if (!configured) return publicFirebaseConfig;
  try { return { ...publicFirebaseConfig, ...JSON.parse(configured) }; }
  catch { return publicFirebaseConfig; }
}

let servicesPromise;
async function getServices() {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig());
      const auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
      return { auth, firestore: getFirestore(app) };
    })().catch((error) => { servicesPromise = null; throw error; });
  }
  return servicesPromise;
}

function readableAuthError(error) {
  const messages = {
    "auth/email-already-in-use": "هذا البريد مستخدم مسبقًا لحساب نسخ سحابية.",
    "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحين.",
    "auth/invalid-email": "أدخل بريدًا إلكترونيًا صحيحًا.",
    "auth/weak-password": "كلمة المرور ضعيفة؛ استخدم 6 أحرف على الأقل.",
    "auth/network-request-failed": "تعذر الاتصال بالإنترنت. تبقى بيانات جهازك المحلية متاحة.",
    "auth/operation-not-allowed": "فعّل Email/Password من Firebase Authentication ثم أعد المحاولة.",
    "auth/user-not-found": "لا يوجد حساب نسخ سحابية بهذا البريد. استخدم إنشاء وربط مرة واحدة.",
    "auth/wrong-password": "كلمة مرور النسخ السحابية غير صحيحة. استخدم استعادة كلمة المرور.",
    "auth/too-many-requests": "تكررت المحاولات؛ انتظر قليلًا ثم أعد المحاولة.",
  };
  return messages[error?.code] || error?.message || "تعذر إكمال تسجيل الدخول السحابي.";
}

function ownerRef(firestore, uid) { return doc(firestore, "backupOwners", uid); }
function backupRef(firestore, uid, backupId) { return doc(firestore, "backupOwners", uid, "backups", backupId); }
function backupId() { return `backup_${new Date().toISOString().replace(/[:.]/g, "-")}_${shortRandomId()}`; }

async function requireUser() {
  const { auth, firestore } = await getServices();
  if (!auth.currentUser) throw new Error("اربط حساب النسخ السحابية أولًا.");
  return { auth, firestore, user: auth.currentUser };
}

export async function getCloudBackupUser() {
  const { auth } = await getServices();
  const user = auth.currentUser;
  return user ? { uid: user.uid, email: user.email || "" } : null;
}

export async function registerCloudBackupUser(email, password) {
  try {
    const { auth } = await getServices();
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    return { uid: result.user.uid, email: result.user.email || "" };
  } catch (error) { throw new Error(readableAuthError(error)); }
}

export async function resetCloudBackupPassword(email) {
  try {
    const { auth } = await getServices();
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) { throw new Error(readableAuthError(error)); }
}

export async function signInCloudBackupUser(email, password) {
  try {
    const { auth } = await getServices();
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { uid: result.user.uid, email: result.user.email || "" };
  } catch (error) { throw new Error(readableAuthError(error)); }
}

export async function signOutCloudBackupUser() {
  const { auth } = await getServices();
  await signOut(auth);
}

export async function listCloudBackups() {
  const { firestore, user } = await requireUser();
  const snapshots = await getDocs(collection(ownerRef(firestore, user.uid), "backups"));
  return snapshots.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((backup) => backup.status === "complete")
    .sort((first, second) => String(second.createdAtClient).localeCompare(String(first.createdAtClient)));
}

export async function deleteCloudBackup(backupIdToDelete) {
  const { firestore, user } = await requireUser();
  const target = backupRef(firestore, user.uid, backupIdToDelete);
  const chunks = await getDocs(collection(target, "chunks"));
  for (const chunk of chunks.docs) await deleteDoc(chunk.ref);
  await deleteDoc(target);
}

async function enforceRetention() {
  const backups = await listCloudBackups();
  await Promise.all(backups.slice(CLOUD_BACKUP_RETENTION_LIMIT).map((backup) => deleteCloudBackup(backup.id)));
}

export async function uploadCloudBackup(payload, { storeName = "حسابي" } = {}) {
  const { firestore, user } = await requireUser();
  const packed = await createCloudBackupPackage(payload, { maxEncodedBytes: CLOUD_BACKUP_MAX_ENCODED_BYTES });
  const id = backupId();
  const target = backupRef(firestore, user.uid, id);
  const createdAtClient = new Date().toISOString();
  const metadata = {
    ...packed.metadata,
    id,
    status: "uploading",
    createdAtClient,
    storeName: String(storeName).slice(0, 80),
  };

  await setDoc(ownerRef(firestore, user.uid), { uid: user.uid, updatedAtClient: createdAtClient }, { merge: true });
  await setDoc(target, metadata);
  try {
    for (const chunk of packed.chunks) {
      await setDoc(doc(target, "chunks", chunk.id), { index: chunk.index, data: chunk.data, charCount: chunk.data.length });
    }
    await setDoc(target, { status: "complete", completedAtClient: new Date().toISOString() }, { merge: true });
    await enforceRetention();
    return { ...metadata, status: "complete" };
  } catch (error) {
    try { await deleteCloudBackup(id); } catch { /* قد تبقى نسخة غير مكتملة إذا انقطع الاتصال أثناء التنظيف. */ }
    throw error;
  }
}

export async function readCloudBackup(backupIdToRead) {
  const { firestore, user } = await requireUser();
  const target = backupRef(firestore, user.uid, backupIdToRead);
  const snapshot = await getDoc(target);
  if (!snapshot.exists() || snapshot.data().status !== "complete") throw new Error("النسخة السحابية غير موجودة أو لم يكتمل رفعها.");
  const metadata = { id: snapshot.id, ...snapshot.data() };
  const chunkSnapshot = await getDocs(collection(target, "chunks"));
  const chunks = chunkSnapshot.docs.map((chunk) => chunk.data());
  return { metadata, payload: await decodeCloudBackupPackage(metadata, chunks) };
}
