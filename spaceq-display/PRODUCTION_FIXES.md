# SPACEQ Display 2.2.0 — Production Sync & Player Hardening

## Live player reliability
- Playlist edits keep a fresh `updatedAt` revision and are written to Firestore before the local dashboard state is committed.
- Kiosk playlist subscriptions rebuild from the actual referenced content IDs, not only playlist IDs.
- Active media elements remount when a content revision changes.
- Media URLs receive a deterministic `spaceq_v` cache-buster based on `updatedAt`, preventing a browser/TV from replaying an old asset at the same URL.
- Playback state is reset and clamped when playlists are reordered, shortened, or replaced.
- Portrait/split rendering uses the measured stage instead of fragile viewport dimensions.

## Remote troubleshooting
- Devices now support a unique remote `syncCommandId`.
- Device Manager includes a **Sync Now** control.
- The kiosk acknowledges the command, shows a sync overlay, then performs a clean browser reload.
- The completed command is recorded so a reload cannot trigger the same sync repeatedly.
- Dashboard shows last sync status/time and the last error when available.
- Firestore rules restrict kiosk sync acknowledgements to the command issued to that device.

## Operational safety
- The old watchdog that could erase a healthy kiosk's local pairing identity after a quiet Firestore period remains removed.
- Pairing identity is only reset when the device document is actually deleted.
- No database migration is required for the new optional sync fields.

## Verification
- All 33 TypeScript/TSX source files were parsed successfully with the TypeScript compiler's transpilation parser.
- `package.json` and `package-lock.json` parse successfully.
- A full dependency-backed Vite build could not be run in this environment because `node_modules` is not installed and package installation is unavailable here.


## 2.2.1 — no-flicker live synchronization

- Removed hard browser reload from the remote device Sync command.
- Remote Sync now acknowledges the command without destroying the running WebView/media tree.
- PlayerPane keeps the last renderable frame while Firestore delivers a newly referenced asset.
- Incoming IMAGE/VIDEO assets are preloaded before becoming visible.
- Playlist edits preserve the currently playing content when it still exists in the edited playlist.
- Playback does not advance while the newly selected content is still being downloaded.
- The old "Syncing display content..." blank state is only used before the first playable frame.
