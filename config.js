// App configuration
// Firebase & Google client IDs are public identifiers (embedded in the APK).
// Restrict the Maps API key to this app's package in Google Cloud Console:
// https://console.cloud.google.com/apis/credentials
//   → restrict to Android app: com.dankenet.presawatch

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCJ-T_cwN6F-8SVOB48fIqqbTJSDtSoGz8",
  authDomain: "presawatch.firebaseapp.com",
  projectId: "presawatch",
  storageBucket: "presawatch.appspot.com",
  messagingSenderId: "344850391677",
  appId: "1:344850391677:web:be62d08cb1fc8e68ce4714",
};

// Web client (type 3) from google-services.json — must match for Firebase Auth
export const GOOGLE_SIGNIN_WEB_CLIENT_ID =
  "344850391677-1tb14ebp1hl2g4calkbnaamo49gle79f.apps.googleusercontent.com";

export const API_URL =
  "https://trashmap-api-presamordor-e0csfsedadffd9ey.canadacentral-01.azurewebsites.net/reports";

// Also referenced in android/app/src/main/AndroidManifest.xml (com.google.android.geo.API_KEY)
// and must be restricted in Google Cloud Console → Credentials to package com.dankenet.presawatch
export const GOOGLE_MAPS_API_KEY = "AIzaSyAo-HNT-KZEs0lhffiKyUUmpIhxoyb_kCM";
