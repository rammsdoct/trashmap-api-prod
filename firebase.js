import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJ-T_cwN6F-8SVOB48fIqqbTJSDtSoGz8",
  authDomain: "presawatch.firebaseapp.com",
  projectId: "presawatch",
  storageBucket: "presawatch.appspot.com",
  messagingSenderId: "344850391677",
  appId: "1:344850391677:web:be62d08cb1fc8e68ce4714",
};

const app = initializeApp(firebaseConfig);

// ✅ Auth y Firestore estándar (recomendado en Expo)
export const auth = getAuth(app);
export const db = getFirestore(app)