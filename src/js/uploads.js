import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase.js";
import { fileToDataUrl } from "./util.js";

/**
 * Upload a blob to Cloud Storage and return its download URL. If Storage is
 * unavailable and the file is a small image, fall back to an inline data URL
 * so the feature keeps working (the caller opts in with allowInline).
 */
export async function uploadFile(path, blob, { allowInline = false } = {}) {
  try {
    const r = ref(storage, path);
    await uploadBytes(r, blob, { contentType: blob.type || undefined });
    return await getDownloadURL(r);
  } catch (err) {
    console.warn("[storage] upload failed:", err?.code || err);
    if (err?.code === "storage/unauthorized") {
      throw new Error("The upload was refused. Check the file type and size, or that your account is on the alumni list.");
    }
    if (allowInline && blob.size < 700 * 1024 && String(blob.type).startsWith("image/")) {
      return await fileToDataUrl(blob);
    }
    throw new Error("Upload failed. Check your connection and try again.");
  }
}

/** A storage-safe file name: keeps the extension, drops anything odd. */
export function safeName(name) {
  return String(name || "file").replace(/[^\w.\-]+/g, "_").slice(-80);
}
