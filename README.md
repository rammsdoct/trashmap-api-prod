# PresaWatch

Map-based community reporting app. Built with React Native (bare workflow) + Firebase Auth + Google Maps.

---

## Espanol

### Requisitos

Instala esto antes de empezar:

1. Node.js (recomendado via `nvm`)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# reinicia tu terminal, luego:
nvm install --lts
nvm use --lts
```

2. Android SDK

Instala Android Studio y durante la configuracion incluye:
- Android SDK (API 35)
- Android SDK Build-Tools 35.0.0
- NDK 27.1.12297006 (SDK Manager -> SDK Tools -> NDK (Side by side))

Luego agrega `ANDROID_HOME` en tu shell (`~/.bashrc` o `~/.zshrc`):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Windows (PowerShell):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\\Android\\Sdk"
$env:PATH = "$env:PATH;$env:ANDROID_HOME\\platform-tools"
```

3. JDK 17

```bash
# Ubuntu / Debian
sudo apt install openjdk-17-jdk
```

Verifica: `java -version` debe mostrar `openjdk 17`.

---

### Instalacion

```bash
git clone <repo-url>
cd trashmap-api-prod
npm install
```

---

### Correr en Android

Necesitas un emulador corriendo o un dispositivo conectado con USB debugging.

Emulador: Android Studio -> Device Manager -> Pixel API 35 AVD.

Abre dos terminales:

```bash
# Terminal 1 - bundler
npm start

# Terminal 2 - build e instalar APK
npm run android
```

En dispositivos fisicos, conecta Metro con:

```bash
adb reverse tcp:8081 tcp:8081
```

### Configuracion

Toda la config vive en `config.js`. El repo ya trae valores de desarrollo.

Si quieres usar tus propias credenciales, actualiza:

| Key | Donde obtenerlo |
|-----|----------------|
| `FIREBASE_CONFIG` | Firebase console -> Project settings -> Your apps |
| `GOOGLE_SIGNIN_WEB_CLIENT_ID` | Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Web Client |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console -> APIs & Services -> Credentials |
| `API_URL` | Tu backend |

---

### Release (opcional)

Para generar un APK de release firmado:

1. Crea un keystore:

```bash
keytool -genkeypair -v \
  -keystore ~/presawatch-release.keystore \
  -storepass <STORE_PASS> \
  -alias presawatch \
  -keypass <KEY_PASS> \
  -dname "CN=PresaWatch,O=PresaWatch,C=MX" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

2. Crea `android/keystore.properties`:

```
storeFile=release.keystore
storePassword=...
keyAlias=presawatch
keyPassword=...
```

3. Copia el keystore a `android/release.keystore`.

4. Build:

```bash
cd android
./gradlew assembleRelease
```

Windows (PowerShell):

```powershell
cd android
./gradlew.bat assembleRelease
```

5. Agrega el SHA-1 de release en Firebase (para Google Sign-In):

```bash
keytool -list -v -keystore android/release.keystore -alias presawatch
```

---

### CI - GitHub Actions

Cada push/PR a `main` corre `.github/workflows/android.yml` y genera un APK de release.

Secrets requeridos:
- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `RELEASE_STORE_PASSWORD`
- `RELEASE_KEY_ALIAS`
- `RELEASE_KEY_PASSWORD`

Para crear `ANDROID_RELEASE_KEYSTORE_BASE64`:

```bash
base64 -w 0 android/release.keystore
```

Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android\\release.keystore"))
```

---

### Troubleshooting

Si `./gradlew clean` falla con `externalNativeBuildCleanDebug`, borra caches nativos y vuelve a compilar:

```bash
rm -rf android/app/.cxx android/app/build
cd android
./gradlew assembleDebug
```

Windows (PowerShell):

```powershell
rmdir /s /q android\\app\\.cxx android\\app\\build
cd android
./gradlew.bat assembleDebug
```

---

## English

### Prerequisites

Install these first:

1. Node.js (recommended via `nvm`)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# restart your terminal, then:
nvm install --lts
nvm use --lts
```

2. Android SDK

Install Android Studio and include:
- Android SDK (API 35)
- Android SDK Build-Tools 35.0.0
- NDK 27.1.12297006 (SDK Manager -> SDK Tools -> NDK (Side by side))

Then set `ANDROID_HOME` in your shell (`~/.bashrc` or `~/.zshrc`):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Windows (PowerShell):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\\Android\\Sdk"
$env:PATH = "$env:PATH;$env:ANDROID_HOME\\platform-tools"
```

3. JDK 17

```bash
# Ubuntu / Debian
sudo apt install openjdk-17-jdk
```

Verify: `java -version` should show `openjdk 17`.

---

### Setup

```bash
git clone <repo-url>
cd trashmap-api-prod
npm install
```

---

### Run on Android

You need a running emulator or a connected device with USB debugging.

Emulator: Android Studio -> Device Manager -> Pixel API 35 AVD.

Open two terminals:

```bash
# Terminal 1 - bundler
npm start

# Terminal 2 - build and install APK
npm run android
```

For physical devices, connect Metro with:

```bash
adb reverse tcp:8081 tcp:8081
```

### Configuration

All config lives in `config.js`. The repo ships with dev values.

If you want your own credentials, update:

| Key | Where to get it |
|-----|----------------|
| `FIREBASE_CONFIG` | Firebase console -> Project settings -> Your apps |
| `GOOGLE_SIGNIN_WEB_CLIENT_ID` | Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Web Client |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console -> APIs & Services -> Credentials |
| `API_URL` | Your backend |

---

### Release (optional)

To produce a signed release APK:

1. Generate a keystore:

```bash
keytool -genkeypair -v \
  -keystore ~/presawatch-release.keystore \
  -storepass <STORE_PASS> \
  -alias presawatch \
  -keypass <KEY_PASS> \
  -dname "CN=PresaWatch,O=PresaWatch,C=MX" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

2. Create `android/keystore.properties`:

```
storeFile=release.keystore
storePassword=...
keyAlias=presawatch
keyPassword=...
```

3. Copy the keystore to `android/release.keystore`.

4. Build:

```bash
cd android
./gradlew assembleRelease
```

Windows (PowerShell):

```powershell
cd android
./gradlew.bat assembleRelease
```

5. Add the release SHA-1 in Firebase (for Google Sign-In):

```bash
keytool -list -v -keystore android/release.keystore -alias presawatch
```

---

### CI - GitHub Actions

Every push/PR to `main` runs `.github/workflows/android.yml` and builds a release APK.

Required secrets:
- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `RELEASE_STORE_PASSWORD`
- `RELEASE_KEY_ALIAS`
- `RELEASE_KEY_PASSWORD`

To create `ANDROID_RELEASE_KEYSTORE_BASE64`:

```bash
base64 -w 0 android/release.keystore
```

Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android\\release.keystore"))
```

---

### Troubleshooting

If `./gradlew clean` fails with `externalNativeBuildCleanDebug`, remove native caches and rebuild:

```bash
rm -rf android/app/.cxx android/app/build
cd android
./gradlew assembleDebug
```

Windows (PowerShell):

```powershell
rmdir /s /q android\\app\\.cxx android\\app\\build
cd android
./gradlew.bat assembleDebug
```
