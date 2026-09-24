import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from "../../firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const bucket = firebaseConfig.storageBucket?.startsWith("gs://")
  ? firebaseConfig.storageBucket
  : `gs://${firebaseConfig.storageBucket}`;
export const storage = getStorage(app, bucket);
