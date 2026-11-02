# Get By Boat — Flutter mobile app (Milestone 1)

Android-first Flutter project, with iOS support planned. This is a starter implementation, not yet a store-ready app.

## Included
- Responsive Explore Boats screen with sea-blue branding
- Country filter (the 14 Get By Boat countries) and basic name/location search
- Live read-only listings from the existing Supabase project, respecting RLS
- Boat detail screen
- Email/password sign up, sign in, sign out via existing Supabase Auth
- Loading, empty, and error states

## Setup (MacBook)
1. Install Flutter SDK, Android Studio, Android SDK and an Android emulator.
2. From repository root, run:
   ```sh
   flutter create --platforms=android,ios --org net.getbyboat mobile
   cd mobile
   flutter pub get
   flutter run
   ```
3. In Android Studio, select a running emulator or connected phone.
4. Once dependencies resolve, commit `mobile/pubspec.lock` for reproducible builds.

The Flutter CLI command generates the native Android and iOS runner files; these are not present yet. Keep the existing `lib/main.dart` and `pubspec.yaml` during setup. Do not replace them if prompted.

## Security notes
- The mobile app contains only the Supabase publishable key, never service-role or secret keys.
- Access to profiles and reservations must continue to be controlled by server-side RLS.
- Do not expose pickup coordinates/full addresses until the booking/payment rules permit them.
- Do not implement payments or booking insertion by calculating totals on-device. Reuse secured server-side booking flows.
- Google and Apple OAuth are not enabled here; they require provider configuration.
- Existing database has no published boats yet, so an empty list is currently expected.
- Search is initially limited to 100 recent published boats and is filtered locally; add database-backed pagination and geo_place search before launch.

## Next milestones
1. Native Android runner, emulator build and tests
2. Production-ready search using geo_places / geo_place_names
3. Customer account, favourites and booking request flow
4. Owner dashboard, availability and messaging
5. Notifications, maps, payments, privacy/deletion, Play Store compliance

Development status: initial source committed; Flutter SDK was unavailable in the current environment, so it has not been compiled or tested on a device.
