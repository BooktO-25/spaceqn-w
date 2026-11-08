# SPACEQ Display 2.3 — Per-item media framing

Each PlaylistItem can now store optional `framing`:
- fit: COVER or CONTAIN
- zoom: 1.0–3.0
- positionX: 0–100
- positionY: 0–100
- rotation: 0/90/180/270

The original uploaded file is never modified. Framing is rendered by the
playlist/grid player, so the same source asset can have different framing in
different playlist items/zones.

Use Playlist Builder → Frame on any playlist item.
