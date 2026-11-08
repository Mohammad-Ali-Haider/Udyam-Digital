# Udyam Digital

A kirana-store prototype for Android and responsive web. It connects an adaptive advisor, editable quotes, consent and document verification to partner assistance, staff-managed installation, activated services, sample statements and support tickets. External registries and telecom activation remain simulated.

The interface supports English and Hindi, with Dark, Light, and System themes. Both clients use the same local backend.

The advisor has an independent live cart and an **Ask Udyam** chat bubble. Desktop shows the conversation beside the cart; phones open a chat panel with **Back to cart**. Use suggested questions or type your own. Confirmed additions/removals animate, and monthly cost, one-time setup and budget remaining update from server results. **Make it cheaper** removes optional extras; essential requirements are retained and an impossible budget is explained. **Review this cart** proceeds to the editable bundle and checkout. Discussion does not accept a quote or place an order.

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
npm run staff:setup
npm run demo:fixtures
npm run build
npm start
```

- `ocr:prepare` downloads the English OCR language file into `.runtime/ocr`. Repeat runs reuse the existing file.
- `seed` initializes the SQLite schema and checks the supplied catalogue and mock registries. Startup also applies the schema automatically.
- `staff:setup` generates three distinct local passwords, preserves existing configured passwords, and writes a private `.runtime/demo-staff-access.txt` file. Do not commit or publish it. Restart the backend after changing passwords.
- `demo:fixtures` optionally adds eight labelled synthetic scenarios without overwriting ordinary journeys. Fixtures demonstrate queues; they are not evidence of live AI or OCR execution.
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

Download the signed APK from [GitHub Releases](https://github.com/Mohammad-Ali-Haider/Udyam-Digital/releases/latest). Previous published versions remain available in the [release history](https://github.com/Mohammad-Ali-Haider/Udyam-Digital/releases). Repository access is required while this repository is private. Each release includes a SHA-256 checksum for its APK.

The APK contains its application bundle and opens without Metro. Backend features still require the backend running on your computer and the phone connected to the same Wi-Fi, using the computer's LAN address as described above. OpenRouter runs through that backend. Physical-phone verification remains pending your own testing.

Generated APKs are ignored by Git and are attached to releases instead; a fresh clone contains the source, not the APK. To build one on Windows:

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
2. Answer the advisor's questions, try **Make it cheaper**, and review the essential/recommended alternatives.
3. Use **Get help from a partner**, review the sharing notice and opt in. An optional separate permission allows follow-up after ten minutes without progress. Assistance is in-app only.
4. Open **http://localhost:3001/staff** in another browser/tab. Sign in as `operations`, assign the assistance case to `partner-a`, then sign in as that partner to reply. The customer receives the message automatically.
5. Edit quantities or products, review the server-calculated quote, and accept demo checkout. No payment details are collected.
6. Give KYC consent. Use the synthetic samples, or upload the matching JPEG/PNG fixtures from [`apps/server/tests/fixtures`](apps/server/tests/fixtures).
7. Try the expired address sample to see a correction flow, then replace it with the valid address sample. Use the matching registration and signatory samples as well.
8. Confirm the customer order. In the staff **Installation** queue, open the order, assign a partner if needed, schedule a future window and fictional team, start installation and complete simulated activation. A delay requires a reason and moves estimates one day. Customers cannot advance installation themselves.
9. The customer opens **Home / Services / Bills / Support**. For P01 plus one P19, the initial sample statement is ₹1,598 monthly + ₹2,500 one-time setup = ₹4,098 excluding taxes. It is not a tax invoice. Download CSV or print from the website; no payment is collected.
10. Create a support ticket. Operations can assign it; staff reply and resolve with a message. The customer can reply or reopen it. Refresh both views to verify persisted state.

Keep `DEMO_CONTROLS=true` for synthetic document shortcuts. Use **Settings → Reset this journey** to delete the current session, including its assistance, services, statements and tickets. Other customer journeys remain independent.

## Staff access and operations

The staff portal is web-only and works on desktop, tablet and phone browsers. The APK remains customer-focused. Open `/staff` directly; it does not create a customer session. Customer and staff cookies are independent even in the same browser.

| Username | Role | Scope |
| --- | --- | --- |
| `operations` | Operations | All eligible queues; assignments, installations and tickets |
| `partner-a` | Partner | Only records currently assigned to this account |
| `partner-b` | Partner | Only records currently assigned to this account |

Passwords come from `STAFF_OPERATIONS_PASSWORD`, `STAFF_PARTNER_A_PASSWORD`, and `STAFF_PARTNER_B_PASSWORD` in `apps/server/.env`, with at least 12 characters each. SQLite stores salted password hashes; staff cookies expire after eight hours. Login is throttled and mutations validate the browser origin. There is no default public password. `npm run staff:setup` creates local credentials automatically.

Only opted-in pre-order journeys appear in assistance queues. Private notes never appear in customer responses. Staff can request replacement evidence or profile corrections, but cannot force KYC approval or retrieve discarded original images. Follow-up priority is a disclosed rule-based score, not an AI conversion prediction.

## Upgrading and rollback

Stop the backend before replacing a build. Startup applies ordered migrations and creates an ignored `.runtime/udyam.sqlite.before-v*-backup` before changing an existing database. Existing quotes and order prices are preserved. Activated legacy orders receive services and exactly one initial sample statement.

The expanded UI requires the **v1.1.1 APK (version code 3)** and matching backend/web build. The old APK does not acquire new screens automatically. Keep the same ignored signing key to install the update without uninstalling. Previous APKs and website packages are preserved locally under `artifacts/rollback/`. To roll back a database, stop the server and restore the matching pre-migration backup together with the matching old backend; do not combine an old server with a newer database.

## Data, scope and verification

- The supplied catalogue and GSTIN/Udyam registries are synthetic. Registry lookups and serviceability are mocked; installation is explicitly simulated.
- KYC date checks use **15 July 2026**, not today's date. Address proofs must be no more than 90 days old and cannot be future-dated relative to that reference date. The synthetic GSTIN PAN `X` and Udyam district `00` conventions are supported.
- The prepared OCR language is English, matching the demo fixtures. Hindi interface support does not imply Hindi document OCR support.
- The supplied K01 cancelled registration and K03 matching/mismatched address cases are exercised with real OCR. K05 has a documented recognition limitation: Tesseract reads `Z` as `7`, so it requests replacement even for the matching profile. The independent semantic expectations and observed limitation are recorded in `apps/server/tests/fixtures/supplied-expectations.json`; the system does not alter an identifier to force approval. Use the matching `demo-*` fixtures for the successful walkthrough.
- SQLite data persists in `.runtime/udyam.sqlite`. Sessions expire after seven days of inactivity. Cross-device continuation and accounts are outside this prototype.
- Automated server tests, the connected browser journey and a separate real OpenRouter request have been verified. Physical Android installation, camera/file permissions, keyboard/back handling and device-level download behavior remain for the team to test. Build/signature checks do not substitute for that phone test.

## Checks

```sh
npm run check
npm run lint -w @udyam/client
npm test
```

Prepare OCR assets before running tests. For repeatable fallback tests, use a demo setup with `OPENROUTER_API_KEY` left blank.

For browser end-to-end checks, first run `npm run build`, then leave `npm run test:server` running in another terminal. This isolated in-memory backend uses verification-only staff credentials and the deterministic advisor. It never changes the ordinary demo database. The script uses an installed Microsoft Edge browser:

```sh
npm run test:web
npm run test:advisor
```

It defaults to `http://127.0.0.1:3003` and checks 360, 768, 1024 and 1440 px. `TEST_BASE_URL` can override that isolated test server. Screenshots go into ignored `artifacts/screenshots/`. Stop the verification server with Ctrl+C afterwards. Use `npm run test:live-ai` separately for one real synthetic OpenRouter request; it requires credits and never prints the key.

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
