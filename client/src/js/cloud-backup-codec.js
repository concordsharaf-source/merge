export const CLOUD_BACKUP_FORMAT_VERSION = 1;
export const CLOUD_BACKUP_CHUNK_CHAR_LIMIT = 512 * 1024;
export const CLOUD_BACKUP_MAX_ENCODED_BYTES = 12 * 1024 * 1024;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  const sliceSize = 0x8000;
  for (let start = 0; start < bytes.length; start += sliceSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + sliceSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function streamToBytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzip(bytes) {
  if (typeof CompressionStream !== "function") return null;
  return streamToBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")));
}

async function gunzip(bytes) {
  if (typeof DecompressionStream !== "function") throw new Error("هذا المتصفح لا يدعم فك ضغط النسخة السحابية.");
  return streamToBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")));
}

function backupStoreSummary(payload) {
  return Object.fromEntries(Object.entries(payload.stores || {}).map(([name, values]) => [name, Array.isArray(values) ? values.length : 0]));
}

export async function createCloudBackupPackage(payload, {
  chunkCharLimit = CLOUD_BACKUP_CHUNK_CHAR_LIMIT,
  maxEncodedBytes = CLOUD_BACKUP_MAX_ENCODED_BYTES,
  preferCompression = true,
} = {}) {
  if (!Number.isInteger(chunkCharLimit) || chunkCharLimit < 1024) throw new Error("حد تجزئة النسخة غير صالح.");
  const sourceBytes = textEncoder.encode(JSON.stringify(payload));
  let bytes = sourceBytes;
  let encoding = "identity";

  if (preferCompression) {
    try {
      const compressed = await gzip(sourceBytes);
      if (compressed && compressed.length < sourceBytes.length) {
        bytes = compressed;
        encoding = "gzip";
      }
    } catch {
      // تظل النسخة قابلة للحفظ دون الضغط عند غياب دعم المتصفح أو فشل الضغط.
    }
  }

  if (bytes.length > maxEncodedBytes) {
    throw new Error(`حجم النسخة بعد الضغط يتجاوز الحد الآمن (${Math.round(maxEncodedBytes / 1024 / 1024)} ميبيبايت). نزّل نسخة محلية أو خفف البيانات ثم أعد المحاولة.`);
  }

  const base64 = bytesToBase64(bytes);
  const chunks = [];
  for (let start = 0; start < base64.length; start += chunkCharLimit) {
    const index = chunks.length;
    chunks.push({ id: String(index).padStart(4, "0"), index, data: base64.slice(start, start + chunkCharLimit) });
  }

  return {
    metadata: {
      formatVersion: CLOUD_BACKUP_FORMAT_VERSION,
      backupSchema: payload.schema,
      backupVersion: payload.version,
      databaseVersion: payload.databaseVersion,
      exportedAt: payload.exportedAt,
      encoding,
      encodedBytes: bytes.length,
      base64Characters: base64.length,
      chunkCount: chunks.length,
      checksum: await sha256Hex(bytes),
      storeSummary: backupStoreSummary(payload),
    },
    chunks,
  };
}

export async function decodeCloudBackupPackage(metadata, chunks) {
  if (!metadata || metadata.formatVersion !== CLOUD_BACKUP_FORMAT_VERSION) throw new Error("تنسيق النسخة السحابية غير مدعوم.");
  if (!Array.isArray(chunks) || chunks.length !== metadata.chunkCount || !chunks.length) throw new Error("أجزاء النسخة السحابية ناقصة أو غير متطابقة.");
  const ordered = [...chunks].sort((first, second) => first.index - second.index);
  if (ordered.some((chunk, index) => chunk.index !== index || typeof chunk.data !== "string")) throw new Error("ترتيب أجزاء النسخة السحابية غير صالح.");

  let encoded;
  try {
    encoded = base64ToBytes(ordered.map((chunk) => chunk.data).join(""));
  } catch {
    throw new Error("تعذر قراءة أجزاء النسخة السحابية.");
  }
  if (encoded.length !== metadata.encodedBytes) throw new Error("حجم النسخة السحابية لا يطابق بياناتها الوصفية.");
  if (await sha256Hex(encoded) !== metadata.checksum) throw new Error("فشل التحقق من بصمة النسخة السحابية؛ لم تُستعد أي بيانات.");

  let sourceBytes = encoded;
  if (metadata.encoding === "gzip") sourceBytes = await gunzip(encoded);
  else if (metadata.encoding !== "identity") throw new Error("ترميز النسخة السحابية غير معروف.");

  try {
    return JSON.parse(textDecoder.decode(sourceBytes));
  } catch {
    throw new Error("محتوى النسخة السحابية غير صالح.");
  }
}
