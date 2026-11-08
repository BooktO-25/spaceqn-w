# SPACEQ Display - Multi-Tenant Digital Signage System

## What was broken

This project (generated in Google AI Studio) built and typechecked fine, but had no
working way for an actual TV/display to show content on its own — the player only
existed as a screen *inside* the logged-in admin dashboard. Fixed:

- Added a standalone kiosk player (`src/components/PublicPlayer.tsx`) that loads
  with `?display=<deviceId>` in the URL, signs in anonymously, and streams just
  that one device's playlist — no dashboard login needed.
- Fixed the "Display URL" button in Device Manager, which built a broken
  `/player/<id>` link (no such route existed) and wasn't even wired to a
  button. It now generates the correct `?display=<id>` URL and copies it.
- Loosened `firestore.rules` just enough for an anonymous kiosk session to read
  its one device, its assigned playlist, and its business's content items, and
  to update only `lastSeenAt`/`status` (heartbeat) — without opening up write
  access or cross-tenant listing.
- Added `firebase.json` / `.firebaserc` — hosting config didn't exist, so there
  was no supported way to deploy this at all.

## 1. Firebase project setup

1. Copy `firebase-applet-config.example.json` to `firebase-applet-config.json`:
   ```bash
   cp firebase-applet-config.example.json firebase-applet-config.json
   ```
2. Open `firebase-applet-config.json` and fill in your Firebase project credentials
   (Project Settings → General → Your apps → SDK config, in the Firebase console).
3. `firebase-applet-config.json` is gitignored — never commit it with real values.
4. In the Firebase console, enable **Authentication → Sign-in method → Anonymous**.
   This is required for the kiosk player (step 3 below) to work.

## 2. Install, build, and deploy

```bash
npm install
npm run build          # outputs to dist/
npm install -g firebase-tools   # one-time
firebase login
firebase deploy --only hosting,firestore:rules
```

This deploys the built app to Firebase Hosting and pushes the updated
`firestore.rules`. After deploying, Firebase gives you a URL like:

```
https://causal-chimera-4k91c.web.app
```

That is your **admin dashboard URL** — open it, sign in (or use "Continue as Demo"),
and manage businesses, devices, content, and playlists there.

## 3. The URL each physical display needs to open

Every TV/display should point its browser (or Android/webOS kiosk browser app) at:

```
https://<your-hosting-url>/?display=<deviceId>
```

You don't need to construct this by hand — in the dashboard, go to
**Devices → find the device card → "Display URL" button**. It copies the exact
link for that device to your clipboard. Set that as the home page / kiosk URL
on the TV's browser and it will boot straight into fullscreen playback with no
login prompt, and reconnect automatically after power loss.

## Known limitations to be aware of

- **"Continue as Demo" mode never writes to Firestore.** It's local-only preview
  data, useful for exploring the UI, but content/devices you create there won't
  sync to real displays. For real use, sign up/sign in with a real account.
- **Device pairing is not fully wired end-to-end.** A device shows a pairing
  code on-screen, but nothing currently validates that code against a real
  unclaimed device record — "pairing" in Device Manager just creates a device
  entry directly. Fine for a single-location setup like SpaceQ; would need
  more work for a real multi-customer product.
- **Anonymous kiosk sessions can list content by business ID once they know it**
  (needed so the display can fetch its playlist's items). Since display URLs
  are unguessable random device IDs and not shared publicly, this is a
  reasonable trade-off for a single-business deployment — just don't post
  display URLs publicly.
