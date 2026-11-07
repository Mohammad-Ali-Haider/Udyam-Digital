# Udyam Digital

A kirana-store onboarding prototype for Android and responsive web. It covers language selection, business profile, an AI advisor, bundle recommendations, editable quotes, demo checkout, consent and document verification, order confirmation, and simulated installation tracking.

The interface supports English and Hindi, with Dark, Light, and System themes. Both clients use the same local backend.

**For the current Android demo, the phone and the computer running the backend must be on the same Wi-Fi network, or on a local network that allows them to reach each other. Keep the backend running throughout the demo.** The installed APK does not need Metro, but onboarding, OCR, quotes, and orders still need the backend.

## Requirements

- Git and access to this repository, which is currently private.
- Node.js **24.x** and npm. Development was verified with Node.js 24.12 and npm 11.
- Internet access for the initial dependency installation and OCR-language download.
- An OpenRouter API key only if you want live AI responses. The labelled **Demo advisor** works without a key.
- Android Studio and its Android SDK/JDK only if you want to build an APK yourself. They are not required to run the website or backend.

Run the commands below from the repository root, where `package.json` is located. The application is already at the root; there is no additional `prototype/` directory after cloning.

## Quick start: backend and website

### 1. Clone and install

```sh
git clone https://github.com/Mohammad-Ali-Haider/Udyam-Digital.git
cd Udyam-Digital
npm ci
```

### 2. Create the backend environment file

On Windows PowerShell:

```powershell
Copy-Item apps/server/.env.example apps/server/.env
```

On macOS/Linux:

```sh
cp apps/server/.env.example apps/server/.env
```

Do this once on a fresh clone. Do not overwrite an existing configured `.env` file. For the default local demo, keep:

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4.1-mini
HOST=0.0.0.0
PORT=3001
WEB_ORIGINS=http://localhost:8081,http://localhost:3001
DEMO_CONTROLS=true
```

`HOST=0.0.0.0` lets the backend accept connections from your phone. It is a listening address, not the address you enter in the app or browser.

### 3. Prepare data and build

```sh
npm run ocr:prepare
npm run seed
npm run build
npm start
```

- `ocr:prepare` downloads the English OCR language file into `.runtime/ocr`. Repeat runs reuse the existing file.
- `seed` initializes the SQLite schema and checks the supplied catalogue and mock registries. Startup also applies the schema automatically.
- `build` compiles the backend and exports the website.
- `start` serves the compiled backend and exported website from the same process.

Open **http://localhost:3001** on the computer. Check backend health at **http://localhost:3001/api/v1/health**.

Leave this terminal open. Use `Ctrl+C` to stop the backend. On subsequent runs, `npm start` is enough unless the source has changed; rebuild after source changes.

## Connect an Android phone over Wi-Fi

1. Start the backend using the quick-start instructions above.
2. Connect the phone and computer to the same Wi-Fi network. A wired computer also works if it is on the same reachable LAN. Guest networks may block communication between devices.
3. Find the computer's local IPv4 address. On Windows, run `ipconfig` and look under the active **Wireless LAN adapter Wi-Fi**. Use that adapter's IPv4 address, not a VPN or virtual adapter address.
4. From the phone's browser, open the health URL using that address. For example, if the computer's address is `192.168.1.25`, open:

   ```text
   http://192.168.1.25:3001/api/v1/health
   ```

5. Install the APK, open its settings using the gear icon, and go to **Demo connection**. Enter the base URL in **Backend URL**, then tap **Save connection**:

   ```text
   http://192.168.1.25:3001
   ```

   Do not append `/api/v1` or `/health` to the app's Backend URL.

6. Keep the computer awake, connected to the network, and running the backend while using the app.

**Replace `192.168.1.25` with your own computer's address.** On a phone, `localhost` refers to the phone itself. If the computer's IP changes after reconnecting to Wi-Fi, update **Demo connection** again; no APK rebuild is needed.

The phone can also open the complete website at `http://<computer-IP>:3001`. Android and each browser have separate sessions, so opening the website does not resume the APK's journey.

### If the phone cannot connect

- First check the health URL on the computer, then on the phone.
- Confirm `HOST=0.0.0.0`, port `3001`, and the correct active-network IPv4 address.
- On Windows, allow Node.js through the firewall on the **Private** network profile, or allow inbound TCP port `3001` on that profile. Keep the firewall enabled.
- Check for guest-network/client isolation or a VPN that prevents local-network access.
- Make sure the computer has not gone to sleep and the backend terminal has not closed.

This setup uses local HTTP for the prototype. Remote use requires a separately hosted backend and HTTPS configuration; pushing the repository to GitHub does not host the API.

## Enable live AI with OpenRouter

Edit **`apps/server/.env`**:

```dotenv
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

Restart the backend after changing the file. The provider account needs model access and available credits. A different model must support the structured-response format used by the advisor.

The key stays on the backend. Do not put it in `apps/client/.env` or an `EXPO_PUBLIC_*` variable. Environment files are ignored by Git.

Without a key, or if the provider times out or returns an invalid response, the backend uses the labelled **Demo advisor**. If the client cannot reach the backend itself, it shows a retry state instead. A configured key or a passing fallback test does not prove that a live provider call succeeded; verify a live advisor response separately.

To make an explicit real-provider check from the repository root:

```powershell
npm run test:live-ai
```

This sends one synthetic advisor request to OpenRouter, so it requires internet access and may use provider credits. It uses an isolated in-memory database, checks persisted `live` mode, verifies server-calculated prices, and confirms rejection of unknown products, ineligible products and missing dependencies. It prints only safe verification metadata, never the key or provider response body. An empty key, provider failure or invalid response reports a blocker instead of a live success. `npm test` separately verifies deterministic and mocked-provider behavior without requiring live access.

## Build and install the Android APK

The APK is generated locally and ignored by Git. A fresh clone does not contain it. You can use a separately supplied demo APK, or build one on Windows:

```powershell
npm run android:apk
```

The current build script expects:

- Android Studio's bundled JDK at `C:/Program Files/Android/Android Studio/jbr`.
- The Android SDK at `%LOCALAPPDATA%/Android/Sdk`, with the required SDK licences accepted.
- SDK components required by the generated Expo project. The verified build used JDK 21, Android platform/build tools 37, and NDK `27.1.12297006`.

If your installations use different locations, adjust the paths in [`scripts/build-android.ps1`](scripts/build-android.ps1). The first build may need to download Android/Gradle dependencies and can take time.

The script generates the native Android project, builds a signed release APK, verifies its signature, and writes:

```text
artifacts/Udyam-Digital.apk
```

It uses a short build staging directory such as `C:\ud-apk` to avoid Windows native-compiler path limits. The source remains in this repository. If the script reports that the staging directory belongs to another task, choose another short staging path in the script rather than deleting an unfamiliar directory.

Transfer the APK to the phone and open it to install, allowing installation from that source when Android requests it. Alternatively, with ADB and USB debugging authorized:

```sh
adb install -r artifacts/Udyam-Digital.apk
```

The APK includes its JavaScript bundle, fonts, and images. **It opens without Metro**, but server-dependent features require the running backend and the Wi-Fi setup above. Configure the connection in the app after installation.

The signing key and password live in ignored `.runtime/signing/` files. Keep them privately if you want future APKs to update the same installation. A build signed with another key requires uninstalling the previous app before installation, which can remove its local progress.

## Development mode

Complete the installation, environment, and OCR setup first. For web development, use two terminals at the repository root:

```sh
# Terminal 1: backend with automatic restart, port 3001
npm run dev:server
```

```sh
# Terminal 2: Expo web development server, normally port 8081
npm run dev:web
```

Open **http://localhost:8081**. Keep port `8081` available: the current web API adapter recognizes that development port and sends requests to port `3001`. The packaged website uses its own origin instead.

For native development, copy `apps/client/.env.example` to `apps/client/.env` and set `EXPO_PUBLIC_API_BASE_URL` to the computer's LAN base URL. This is public connection configuration. `npm run dev` starts the backend and Expo together; `npm run android -w @udyam/client` creates/runs the native development build when an Android development target is available. Development builds use Metro; the release APK does not.

The release build script excludes `.env` files from its staging copy. Use **Demo connection** to configure a release APK. The website uses same-origin API requests when packaged and does not use the native backend URL preference.

If you open the Expo development website from another device, add its exact web origin, such as `http://192.168.1.25:8081`, to the comma-separated `WEB_ORIGINS` list and restart the backend. This extra development origin is unnecessary when using the packaged site at port `3001`.

## Suggested demo walkthrough

1. Choose English or Hindi, then select **Use sample kirana** on the business-profile screen.
2. Answer the advisor's questions and review the recommended bundle.
3. Edit quantities or products, review the server-calculated quote, and accept demo checkout. No payment details are collected.
4. Give KYC consent. Use the synthetic samples, or upload the matching JPEG/PNG fixtures from [`apps/server/tests/fixtures`](apps/server/tests/fixtures).
5. Try the expired address sample to see a correction flow, then replace it with the valid address sample. Use the matching registration and signatory samples as well.
6. Confirm the order, refresh the page to check saved progress, and use the labelled demo controls to advance installation through activation.

Keep `DEMO_CONTROLS=true` for this walkthrough. Use **Settings → Reset this journey** to delete the current session's demo data and start again.

## Data, scope and verification

- The supplied catalogue and GSTIN/Udyam registries are synthetic. Registry lookups and serviceability are mocked; installation is explicitly simulated.
- KYC date checks use **15 July 2026**, not today's date. Address proofs must be no more than 90 days old and cannot be future-dated relative to that reference date. The synthetic GSTIN PAN `X` and Udyam district `00` conventions are supported.
- The prepared OCR language is English, matching the demo fixtures. Hindi interface support does not imply Hindi document OCR support.
- SQLite data persists in `.runtime/udyam.sqlite`. Sessions expire after seven days of inactivity. Cross-device continuation and accounts are outside this prototype.
- Automated server tests and browser journeys have been verified, along with the release APK's signature and embedded bundle. Physical-phone behaviour and a live OpenRouter call still need separate verification with device access and a working key.

## Checks

```sh
npm run check
npm run lint -w @udyam/client
npm test
```

Prepare OCR assets before running tests. For repeatable fallback tests, use a demo setup with `OPENROUTER_API_KEY` left blank.

For browser end-to-end checks, first run `npm run build` and leave `npm start` running in another terminal. The script uses an installed Microsoft Edge browser:

```sh
npm run test:web
```

It defaults to `http://127.0.0.1:3001`. Optional environment variables are `TEST_BASE_URL` and `TEST_WIDTH`. Screenshots go into ignored `artifacts/screenshots/`.

## Repository layout

```text
apps/client/       Expo Android app and responsive web target
apps/server/       Fastify API, catalogue, registries, migrations and tests
packages/shared/   Shared API contracts and validation
scripts/           OCR preparation, Android packaging and browser checks
.runtime/          Ignored database, OCR assets and signing material
artifacts/         Ignored APKs and test screenshots
```

### Common setup issues

| Symptom | What to check |
| --- | --- |
| Website is missing or returns 404 | Run `npm run build` before `npm start`. Do not open the exported `index.html` directly; serve it through the backend. |
| KYC cannot process a sample | Run `npm run ocr:prepare` with internet access, then restart the backend. |
| AI keeps showing Demo advisor | Check the server key, model access, credits and internet connection, then restart the backend. |
| Phone cannot reach the backend | Check the LAN IP, health URL, Wi-Fi, firewall and whether the backend is still running. |
| Web development requests go to the wrong port | Keep Expo web on `8081`, or use the packaged website on `3001`. |
| Native dependency installation fails | Use Node.js 24.x and rerun `npm ci`. Native packages may need local compiler tooling if a prebuilt binary is unavailable. |
| APK cannot update an existing installation | Use the same signing key, or uninstall the old app before installing the differently signed APK. |
