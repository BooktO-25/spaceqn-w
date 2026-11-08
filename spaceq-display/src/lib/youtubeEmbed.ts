/**
 * Converts whatever YouTube URL a business owner pasted in — a watch link,
 * a youtu.be short link, a /shorts/ link, a /live/ link, or an already-valid
 * /embed/ link — into a proper embeddable URL. YouTube's watch page itself
 * refuses to load inside an iframe (it sends X-Frame-Options/CSP headers
 * blocking it), so only the /embed/{videoId} form actually plays; every
 * other shape just silently fails, which is exactly the bug this fixes.
 * Returns null if no video ID could be found, so the caller can show a
 * clear error instead of a blank iframe.
 */
export function toYouTubeEmbedUrl(rawUrl: string): string | null {
  let id = '';
  try {
    const u = new URL(rawUrl);
    if (u.pathname.startsWith('/embed/')) {
      id = u.pathname.split('/embed/')[1]?.split('/')[0] || '';
    } else if (u.hostname.includes('youtu.be')) {
      id = u.pathname.slice(1).split('/')[0];
    } else if (u.pathname.includes('/shorts/')) {
      id = u.pathname.split('/shorts/')[1]?.split('/')[0] || '';
    } else if (u.pathname.includes('/live/')) {
      id = u.pathname.split('/live/')[1]?.split('/')[0] || '';
    } else {
      id = u.searchParams.get('v') || '';
    }
  } catch {
    return null;
  }

  if (!id) return null;

  // playlist=<id> is required to make loop=1 actually loop a single video
  // (without it, YouTube's loop param is a no-op) — important for signage
  // that needs to keep replaying unattended.
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: id,
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}
