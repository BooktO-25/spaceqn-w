# SPACEQ Main 2.2.2

Pairs with Pure Player 2.10.

- Saves/restores the last complete device/playlist/content snapshot.
- Proactively prefetches assigned image/video assets through the native player.
- Preloads the next media item to reduce transition gaps.
- Removes the visible remote Syncing overlay.
- Never full-reloads the player for a sync command/network restore.
- Delivers original Cloudinary URLs without q_auto/f_auto/w_3840.
- Raises UI upload selection limit to 1GB. Upload remains direct browser -> Cloudinary;
  actual Cloudinary account/preset/network limits still apply.
