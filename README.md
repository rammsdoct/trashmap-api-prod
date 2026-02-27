# PresaWatch

Map-based community reporting app. Built with React Native (bare workflow) + Firebase.

---

## Prerequisites

Install these before anything else.

### 1. Node.js

Use [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# restart your terminal, then:
nvm install --lts
nvm use --lts
```

### 2. Android SDK

Install [Android Studio](https://developer.android.com/studio). During setup, make sure to install:
- Android SDK (API 35)
- Android SDK Build-Tools 35.0.0
- NDK **27.1.12297006** (SDK Manager → SDK Tools → NDK (Side by side))

Then set `ANDROID_HOME` in your shell profile (`~/.bashrc` or `~/.zshrc`):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 3. JDK 17

Android builds require JDK 17.

```bash
# Ubuntu / Debian
sudo apt install openjdk-17-jdk
```

Verify: `java -version` should show `openjdk 17`.

---

## Setup

```bash
git clone <repo-url>
cd trashmap-api-prod
npm install
```

---

## Running on Android

You need a running emulator or a connected device with USB debugging enabled.

**Start an emulator:** Android Studio → Device Manager → launch a Pixel API 35 AVD.

Then open **two terminals**:

```bash
# Terminal 1 — start the JS bundler
npm start

# Terminal 2 — build and install the APK
npm run android
```

After the first install, you only need `npm start` to develop — the APK stays on the device. Reload with `r` in the Metro terminal or shake the device → Reload.

> This is a bare React Native project — no Expo Go. A native build is required.

---

## Configuration

All config lives in `config.js`. The file ships with working dev values — no setup needed to run.

If you are setting up a new environment (staging, production), update these values in `config.js`:

| Key | Where to get it |
|-----|----------------|
| `FIREBASE_CONFIG` | Firebase console → Project settings → Your apps |
| `GOOGLE_SIGNIN_WEB_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Web Client |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console → APIs & Services → Credentials |
| `API_URL` | Your backend endpoint |

The Maps key is also referenced in `android/app/src/main/AndroidManifest.xml`. Restrict it in Google Cloud Console to prevent unauthorized usage:

1. Cloud Console → Credentials → find the Maps key → Edit
2. Application restrictions → **Android apps**
3. Add package `com.dankenet.presawatch` + your debug SHA-1

Get your debug SHA-1:

```bash
cd android && ./gradlew signingReport
```

---

## CI — GitHub Actions

Every push/PR to `main` triggers `.github/workflows/android.yml`, which builds a release APK. Download the artifact from the Actions tab (kept for 30 days).
