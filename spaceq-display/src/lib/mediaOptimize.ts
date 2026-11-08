/**
 * Rewrites a Cloudinary delivery URL to add an on-the-fly transformation,
 * WITHOUT touching the original stored asset. Only affects playback; the
 * `content.url` saved in Firestore stays the original, full-quality file.
 *
 * Why this exists: a raw 4K (or higher) IMAGE straight off a phone/camera
 * is often a huge multi-MB file. A modern laptop/desktop decodes that
 * without breaking a sweat — which is why it can look perfect in the
 * dashboard's "Preview" — but a lot of commercial signage TVs run cheap
 * embedded/Android-TV browsers with much weaker decoders. Fed the same raw
 * file, they can stutter or fall back to a blurrier software-decoded path.
 *
 * f_auto:   serves the best format for the requesting browser (WebP/AVIF)
 *           instead of whatever the original upload happened to be.
 * q_auto:   Cloudinary's perceptual auto-quality — trims file size in ways
 *           that are normally invisible to the eye.
 * w_3840,c_limit: caps delivery at true 4K and never upscales.
 *
 * IMPORTANT — video is deliberately left untouched. Image transforms are
 * near-instant even uncached, but a *video* transform is a real transcode
 * job on Cloudinary's end — the first request for a given transformation
 * combination can block for a long time waiting on that to finish, which is
 * exactly what caused playback to go from instant to very slow after this
 * was first added. The safer trade for video is to serve the original file
 * as-is; browsers/TVs already stream video progressively regardless.
 */
export function optimizeMediaUrl(url: string, _kind: 'IMAGE' | 'VIDEO'): string {
  // SPACEQ policy: deliver the original uploaded asset. The display may scale
  // it to the physical screen, but the delivery URL is never recompressed,
  // quality-reduced, or format-converted by SPACEQ.
  return url;
}


/** Adds a deterministic revision token so a kiosk does not reuse a browser-cached
 * copy after an existing asset is replaced at the same URL. */
export function cacheBustMediaUrl(url: string, revision?: string): string {
  if (!revision) return url;
  try {
    const u = new URL(url, window.location.href);
    u.searchParams.set('spaceq_v', revision);
    return u.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}spaceq_v=${encodeURIComponent(revision)}`;
  }
}
