# REAiL Wallet Shield

## Project info

This is a native cross-platform mobile app created with [Rork](https://rork.com)

**Platform**: Native iOS & Android app, exportable to web
**Framework**: Expo Router + React Native

---

## Quick Start (Windows — Node + npm, no Bun required)

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | LTS (20+) | [nodejs.org](https://nodejs.org/) or `winget install OpenJS.NodeJS.LTS` |
| **npm** | ships with Node | — |
| **Git** | any | [git-scm.com](https://git-scm.com/) |
| **PowerShell** | 5.1+ (built-in) | — |

> **Bun is NOT required.** All scripts use `npx` instead of `bunx`.

### 1. Clone & Install

```powershell
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
```

### 2. Start the App

```powershell
# Rork tunnel (recommended for device testing)
npm run start

# Web preview
npm run start-web

# Or use Expo directly
npm run expo:start
npm run expo:start:tunnel
npm run expo:start:web
```

### 3. Supabase CLI (database & Edge Functions)

The Supabase CLI is installed as a devDependency — no global install needed.

```powershell
# Link to your Supabase project (interactive)
npm run supabase:link

# Push all pending migrations
npm run supabase:push

# Deploy all Edge Functions
npm run supabase:functions:deploy
```

### 4. Full Deploy (one command)

Set environment variables, then run the deploy script:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<your-access-token>"
$env:SUPABASE_PROJECT_REF  = "<your-project-ref>"

npm run deploy
```

The deploy script will: git pull -> validate env -> npm install (if needed) -> supabase db push -> deploy all Edge Functions -> start the app.

### 5. Run Tests

```powershell
$env:SUPABASE_PROJECT_URL = "https://<ref>.supabase.co"
$env:SUPABASE_ANON_KEY    = "eyJ..."
$env:FUNCTIONS_BASE_URL   = "https://<ref>.supabase.co/functions/v1"

npm run test
```

---

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run start` | Start with Rork tunnel (device preview) |
| `npm run start-web` | Start web preview with Rork tunnel |
| `npm run expo:start` | Plain npx expo start |
| `npm run expo:start:tunnel` | Expo start with tunnel |
| `npm run expo:start:web` | Expo start web only |
| `npm run supabase:link` | Link Supabase project |
| `npm run supabase:push` | Push DB migrations |
| `npm run supabase:functions:deploy` | Deploy all Edge Functions |
| `npm run test` | Run Edge Function test suite |
| `npm run deploy` | Full deploy script (PowerShell) |
| `npm run lint` | ESLint check |

---

## Troubleshooting

### AVG / Avast / Corporate AV quarantines bun.exe

This project **does not require Bun**. All scripts use Node + npm + npx. If your AV previously quarantined bun.exe:

1. **Uninstall Bun** (if installed): delete `%USERPROFILE%\.bun` and remove it from your PATH.
2. **Clear npm cache** (optional): `npm cache clean --force`
3. **Delete node_modules and reinstall**:
   ```powershell
   Remove-Item -Recurse -Force node_modules
   npm install
   ```
4. If AV flags anything in `node_modules`, add an exclusion for your project folder or contact your IT team to whitelist Node.js.

### npx supabase not found or fails

```powershell
# Ensure supabase CLI is installed as devDep
npm install
# Verify it works
npx supabase --version
```

### App not loading on device

1. Ensure your phone and computer are on the same WiFi network.
2. Use tunnel mode: `npm run start` (tunnel is enabled by default).
3. Check if your firewall is blocking the connection.

### Build failing

1. Clear cache: `npx expo start --clear`
2. Delete node_modules and reinstall:
   ```powershell
   Remove-Item -Recurse -Force node_modules
   npm install
   ```
3. Check [Expo's troubleshooting guide](https://docs.expo.dev/troubleshooting/build-errors/)

### PowerShell execution policy

If scripts/deploy.ps1 or scripts/tests.ps1 won't run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Testing on Device

### On your phone (Recommended)

1. **iOS**: Download the [Rork app from the App Store](https://apps.apple.com/app/rork) or [Expo Go](https://apps.apple.com/app/expo-go/id982107779)
2. **Android**: Download the [Expo Go app from Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
3. Run `npm run start` and scan the QR code

### In your browser

Run `npm run start-web` to test in a web browser. Note: The browser preview is great for quick testing, but some native features may not be available.

### iOS Simulator / Android Emulator

```powershell
npx expo start --ios
npx expo start --android
```

---

## Deploy to App Stores

### Publish to App Store (iOS)

```powershell
npm install -g @expo/eas-cli
eas build:configure
eas build --platform ios
eas submit --platform ios
```

For detailed instructions, visit [Expo's App Store deployment guide](https://docs.expo.dev/submit/ios/).

### Publish to Google Play (Android)

```powershell
eas build --platform android
eas submit --platform android
```

For detailed instructions, visit [Expo's Google Play deployment guide](https://docs.expo.dev/submit/android/).

---

## Technologies

- **React Native** — Cross-platform native mobile framework
- **Expo** — React Native platform (SDK 54)
- **Expo Router** — File-based routing
- **TypeScript** — Type-safe JavaScript
- **React Query** — Server state management
- **Supabase** — PostgreSQL + Edge Functions + Auth
- **Lucide React Native** — Icons

## Project Structure

```
project-root/
  app/                    # App screens (Expo Router)
    (tabs)/               # Tab navigation screens
    s/[token]/            # Public share pages (wallet shield)
    _layout.tsx           # Root layout
    +not-found.tsx        # 404 screen
  components/             # Shared components
  constants/              # App constants
  contexts/               # React context providers
  hooks/                  # Custom hooks
  lib/                    # Library setup (Supabase client, etc.)
  scripts/
    deploy.ps1            # Full deploy script
    tests.ps1             # Edge Function test suite
  supabase/
    functions/            # Deno Edge Functions
    migrations/           # SQL migrations
    ROUTES.md             # API documentation
  types/                  # TypeScript types
  utils/                  # Utility modules
  app.json                # Expo configuration
  package.json            # Dependencies and scripts (npm, no Bun)
```
<<<<<<< HEAD

## Custom Development Builds

For advanced native features, you'll need to create a Custom Development Build instead of using Expo Go.

### **When do you need a Custom Development Build?**

- **Native Authentication**: Face ID, Touch ID, Apple Sign In, Google Sign In
- **In-App Purchases**: App Store and Google Play subscriptions
- **Advanced Native Features**: Third-party SDKs, platform-specifc features (e.g. Widgets on iOS)
- **Background Processing**: Background tasks, location tracking

### **Creating a Custom Development Build**

```bash
# Install EAS CLI
bun i -g @expo/eas-cli

# Configure your project for development builds
eas build:configure

# Create a development build for your device
eas build --profile development --platform ios
eas build --profile development --platform android

# Install the development build on your device and start developing
bun start --dev-client
```

**Learn more:**

- [Development Builds Introduction](https://docs.expo.dev/develop/development-builds/introduction/)
- [Creating Development Builds](https://docs.expo.dev/develop/development-builds/create-a-build/)
- [Installing Development Builds](https://docs.expo.dev/develop/development-builds/installation/)

## Advanced Features

### **Add a Database**

Integrate with backend services:

- **Supabase** - PostgreSQL database with real-time features
- **Firebase** - Google's mobile development platform
- **Custom API** - Connect to your own backend

### **Add Authentication**

Implement user authentication:

**Basic Authentication (works in Expo Go):**

- **Expo AuthSession** - OAuth providers (Google, Facebook, Apple) - [Guide](https://docs.expo.dev/guides/authentication/)
- **Supabase Auth** - Email/password and social login - [Integration Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- **Firebase Auth** - Comprehensive authentication solution - [Setup Guide](https://docs.expo.dev/guides/using-firebase/)

**Native Authentication (requires Custom Development Build):**

- **Apple Sign In** - Native Apple authentication - [Implementation Guide](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- **Google Sign In** - Native Google authentication - [Setup Guide](https://docs.expo.dev/guides/google-authentication/)

### **Add Push Notifications**

Send notifications to your users:

- **Expo Notifications** - Cross-platform push notifications
- **Firebase Cloud Messaging** - Advanced notification features

### **Add Payments**

Monetize your app:

**Web & Credit Card Payments (works in Expo Go):**

- **Stripe** - Credit card payments and subscriptions - [Expo + Stripe Guide](https://docs.expo.dev/guides/using-stripe/)
- **PayPal** - PayPal payments integration - [Setup Guide](https://developer.paypal.com/docs/checkout/mobile/react-native/)

**Native In-App Purchases (requires Custom Development Build):**

- **RevenueCat** - Cross-platform in-app purchases and subscriptions - [Expo Integration Guide](https://www.revenuecat.com/docs/expo)
- **Expo In-App Purchases** - Direct App Store/Google Play integration - [Implementation Guide](https://docs.expo.dev/versions/latest/sdk/in-app-purchases/)

**Paywall Optimization:**

- **Superwall** - Paywall A/B testing and optimization - [React Native SDK](https://docs.superwall.com/docs/react-native)
- **Adapty** - Mobile subscription analytics and paywalls - [Expo Integration](https://docs.adapty.io/docs/expo)

## I want to use a custom domain - is that possible?

For web deployments, you can use custom domains with:

- **EAS Hosting** - Custom domains available on paid plans
- **Netlify** - Free custom domain support
- **Vercel** - Custom domains with automatic SSL

For mobile apps, you'll configure your app's deep linking scheme in `app.json`.

## Troubleshooting

### **App not loading on device?**

1. Make sure your phone and computer are on the same WiFi network
2. Try using tunnel mode: `bun start -- --tunnel`
3. Check if your firewall is blocking the connection

### **Build failing?**

1. Clear your cache: `bunx expo start --clear`
2. Delete `node_modules` and reinstall: `rm -rf node_modules && bun install`
3. Check [Expo's troubleshooting guide](https://docs.expo.dev/troubleshooting/build-errors/)

### **Need help with native features?**

- Check [Expo's documentation](https://docs.expo.dev/) for native APIs
- Browse [React Native's documentation](https://reactnative.dev/docs/getting-started) for core components
- Visit [Rork's FAQ](https://rork.com/faq) for platform-specific questions

## About Rork

Rork builds fully native mobile apps using React Native and Expo - the same technology stack used by Discord, Shopify, Coinbase, Instagram, and nearly 30% of the top 100 apps on the App Store.

Your Rork app is production-ready and can be published to both the App Store and Google Play Store. You can also export your app to run on the web, making it truly cross-platform.

## Supabase Operations (Windows)

Use PowerShell 5+ commands (no `pwsh` requirement):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\doctor.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\sb-deploy-all.ps1 -ProjectRef favpzctusdjnnoyoabrz
powershell -ExecutionPolicy Bypass -File .\scripts\tests.ps1
```

If health checks return `404` for `/functions/v1/<fn>?health=1`, verify you deployed that function and linked the correct project ref.
=======
>>>>>>> origin/main
