# Get By Boat for Android

This is a Google Play Android app for the existing https://getbyboat.net/ marketplace. It uses Android's Trusted Web Activity (TWA), **not** an embedded WebView. Chrome renders the current website (including search, owner dashboard, booking, and Google OAuth) in a full-screen Android experience.

## Project

- App name: Get By Boat
- Permanent package ID: `net.getbyboat.app` (confirm it is available in Play Console before first upload)
- minSdk 24, compileSdk/targetSdk 36 (Android 16)
- Java 17, Gradle 8.13, Android Gradle Plugin 8.13.2
- Android Browser Helper 2.7.4
- Online connection required. The service worker only caches a public shell fallback; signed-in bookings cannot be managed offline.

## Build

Open the `android/` folder in Android Studio. Or install Java 17, Android SDK API 36 and Gradle 8.13:

```bash
cd android
gradle :app:assembleDebug
gradle :app:bundleRelease
```

The GitHub Actions **Android app build** workflow produces a test APK and an **unsigned** release AAB. The AAB is not ready for Play Console until signed.

To sign a release build, provide the local environment variables (never commit the keystore):

- `ANDROID_KEYSTORE_PATH` — absolute path to your upload-key keystore
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Then run `gradle :app:bundleRelease` again. Back up the upload key securely. Play App Signing uses a different signing certificate.

## IMPORTANT: Verify ownership of getbyboat.net

After creating the Google Play app and enrolling in Play App Signing:

1. In **Play Console > App integrity > App signing**, copy the **SHA-256 certificate fingerprint of the app signing key** (NOT the upload key).
2. Publish `public/.well-known/assetlinks.json` on the WEBSITE with this exact JSON (replace the fingerprint):
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "net.getbyboat.app",
       "sha256_cert_fingerprints": ["AA:BB:...:ZZ"]
     }
   }]
   ```
3. Confirm `https://getbyboat.net/.well-known/assetlinks.json` responds HTTP 200 with `application/json`. Do not deploy a placeholder fingerprint.
4. Install from a Play internal test track. With verified Digital Asset Links, it will open without Chrome's top toolbar. Until then it falls back to Custom Tabs.
5. Test navigation/back, Google login and email login, owner/customer permissions, booking requests, messages, upload of owner documents, password reset, external payment redirects, offline/reconnect, and rotation on real Android devices.

## Play publishing checklist

- Google Play Developer account and verified identity.
- Valid privacy policy, account deletion flow, Data Safety disclosure, content rating, screenshots, 512 x 512 Play Store icon, 1024 x 500 feature graphic, support contact.
- Real PNG app icons (192/512 and maskable) should be supplied in addition to the included SVG before final publication for broad PWA compatibility.
- Signed AAB, tested in internal testing. Newer personal developer accounts may require 12 testers for 14 continuous days before production (check current Play Console requirements).
- Check Google Pay/Stripe billing policy for physical boat rental services and any applicable regions.

Do not publish until a full app/user-data/privacy/payment QA has passed. Web updates on getbyboat.net are immediately reflected in the Android app.
