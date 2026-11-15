import React, { useState, useEffect, useRef } from 'react';
import { Playlist, ContentItem } from '../types';
import { Tv } from 'lucide-react';
import { toYouTubeEmbedUrl } from '../lib/youtubeEmbed';
import { optimizeMediaUrl, cacheBustMediaUrl } from '../lib/mediaOptimize';
import { PageContentRenderer } from './PageContentRenderer';

export interface CampaignAd { campaignId: string; name: string; creativeUrl: string; durationSeconds: number; plannedPlays: number; completedPlays: number; }

interface PlayerPaneProps {
  playlist?: Playlist;
  contents: ContentItem[];
  /** Reports the currently-showing slide up to a parent that wants to show
   * a status ticker (only the dashboard preview chrome uses this). */
  onStatusChange?: (status: { index: number; total: number; title: string; durationSeconds: number }) => void;
  /** Visual label shown in a small corner badge — used in split layouts so
   * each zone is identifiable at a glance ("Zone 1", "Zone 2", ...). */
  zoneLabel?: string;
  /** Fires whenever a new content item actually becomes the active item —
   * used by the real kiosk to record playback telemetry. Not used by the
   * dashboard preview. */
  onPlaybackStart?: (event: { contentId: string; title: string; durationSeconds: number }) => void;
  campaigns?: CampaignAd[];
  onCampaignComplete?: (event: { campaignId: string; creativeUrl: string; startedAt: string; completedAt: string; actualDurationSeconds: number }) => void;
}

export const PlayerPane: React.FC<PlayerPaneProps> = ({ playlist, contents, onStatusChange, zoneLabel, onPlaybackStart, campaigns = [], onCampaignComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackOrder, setPlaybackOrder] = useState<number[]>([]);
  const [orderCursor, setOrderCursor] = useState(0);
  const [activeCampaign, setActiveCampaign] = useState<CampaignAd | null>(null);
  const [campaignCursor, setCampaignCursor] = useState(0);
  const [playlistPlaysSinceAd, setPlaylistPlaysSinceAd] = useState(0);
  const campaignStartedAtRef = useRef<number>(0);

  const playlistItems = playlist?.items || [];

  const buildPlaybackOrder = (length: number, shuffle: boolean): number[] => {
    const order = Array.from({ length }, (_, i) => i);
    if (!shuffle) return order;
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };
  const activeIndex = playlistItems.length > 0 ? Math.min(currentIndex, playlistItems.length - 1) : 0;
  const activePlaylistItem = playlistItems[activeIndex];
  const candidateContent = contents.find(c => c.id === activePlaylistItem?.contentId);

  // Keep the last renderable frame alive while Firestore is delivering the
  // newly referenced content. Playlist and content documents arrive on
  // separate listeners, so briefly having no matching ContentItem is normal.
  // Rendering a "Syncing..." screen during that gap causes visible flicker.
  const displayedContentRef = useRef<ContentItem | null>(null);
  const [displayedContent, setDisplayedContent] = useState<ContentItem | null>(null);

  useEffect(() => {
    if (candidateContent) {
      displayedContentRef.current = candidateContent;
      setDisplayedContent(candidateContent);
    } else if (playlistItems.length === 0) {
      displayedContentRef.current = null;
      setDisplayedContent(null);
    }
  }, [candidateContent?.id, candidateContent?.updatedAt, playlistItems.length]);

  // Use the stable displayed content while a new asset is being delivered.
  const activeContent = displayedContent;
  const currentDurationSeconds = Math.max(
    1,
    activePlaylistItem?.customDurationSeconds || activeContent?.durationSeconds || 10
  );

  const playbackDurationSeconds = activeCampaign?.durationSeconds || currentDurationSeconds;
  const framing = activePlaylistItem?.framing;
  const mediaFrameStyle: React.CSSProperties = framing ? {
    objectFit: framing.fit === 'CONTAIN' ? 'contain' : 'cover',
    objectPosition: `${framing.positionX ?? 50}% ${framing.positionY ?? 50}%`,
    transform: `scale(${framing.zoom ?? 1}) rotate(${framing.rotation ?? 0}deg)`,
    transformOrigin: 'center center',
  } : {
    objectFit: 'cover',
    objectPosition: '50% 50%',
  };

  // A playlist document keeps the same ID when its contents are edited. Reset
  // playback whenever the playlist revision or item structure changes so a
  // device can never continue from a stale index/content after an edit.
  const playlistRevision = playlist
    ? `${playlist.id}:${playlist.updatedAt || ''}:${playlist.items.map(i => `${i.id}:${i.contentId}:${i.order}:${i.customDurationSeconds || ''}`).join('|')}`
    : 'empty';

  useEffect(() => {
    const nextOrder = buildPlaybackOrder(playlistItems.length, Boolean(playlist?.shuffle));

    if (playlistItems.length === 0) {
      setPlaybackOrder([]);
      setOrderCursor(0);
      setCurrentIndex(0);
      return;
    }

    // Do not jump back to item #1 every time a playlist document changes.
    // Preserve the currently playing content whenever it still exists in the
    // edited playlist. This makes dashboard edits effectively atomic from the
    // viewer's perspective.
    const previousContentId = playlistItems[currentIndex]?.contentId;
    const preservedIndex = previousContentId
      ? playlistItems.findIndex(item => item.contentId === previousContentId)
      : -1;

    const targetIndex = preservedIndex >= 0 ? preservedIndex : (nextOrder[0] ?? 0);
    const targetCursor = Math.max(0, nextOrder.indexOf(targetIndex));

    setPlaybackOrder(nextOrder);
    setOrderCursor(targetCursor);
    setCurrentIndex(targetIndex);
  }, [playlistRevision]); // eslint-disable-line react-hooks/exhaustive-deps

  // Defensive clamp for deletions/reordering that shrink the playlist while
  // the player is between timers.
  useEffect(() => {
    if (playlistItems.length === 0) {
      setCurrentIndex(0);
      setPlaybackOrder([]);
      setOrderCursor(0);
      return;
    }

    const validOrder = playbackOrder.filter(index => index < playlistItems.length);
    if (validOrder.length !== playlistItems.length) {
      const nextOrder = buildPlaybackOrder(playlistItems.length, Boolean(playlist?.shuffle));
      setPlaybackOrder(nextOrder);
      setOrderCursor(0);
      setCurrentIndex(nextOrder[0] ?? 0);
      return;
    }

    if (currentIndex >= playlistItems.length) {
      setCurrentIndex(validOrder[orderCursor] ?? validOrder[0] ?? 0);
    }
  }, [playlistItems.length, currentIndex, playbackOrder, orderCursor, playlist?.shuffle]);

  // Auto-advance. Loop and Shuffle are real playlist controls: shuffle creates
  // a randomized pass, and loop starts a fresh pass when the current pass ends.
  useEffect(() => {
    if (activeCampaign) {
      const timer = setTimeout(() => {
        const completedAtMs = Date.now();
        const startedAtMs = campaignStartedAtRef.current || (completedAtMs - activeCampaign.durationSeconds * 1000);
        onCampaignComplete?.({
          campaignId: activeCampaign.campaignId,
          creativeUrl: activeCampaign.creativeUrl,
          startedAt: new Date(startedAtMs).toISOString(),
          completedAt: new Date(completedAtMs).toISOString(),
          actualDurationSeconds: Math.max(0.1, (completedAtMs - startedAtMs) / 1000),
        });
        setActiveCampaign(null);
        let nextOrder = playbackOrder;
        let nextCursor = orderCursor + 1;
        if (nextCursor >= nextOrder.length) {
          nextOrder = buildPlaybackOrder(playlistItems.length, Boolean(playlist?.shuffle));
          nextCursor = 0;
          setPlaybackOrder(nextOrder);
        }
        const nextIndex = nextOrder[nextCursor];
        if (typeof nextIndex === 'number') { setOrderCursor(nextCursor); setCurrentIndex(nextIndex); }
      }, playbackDurationSeconds * 1000);
      return () => clearTimeout(timer);
    }
    if (playlistItems.length === 0 || playbackOrder.length === 0) return;
    if (playlist?.loop === false && orderCursor >= playbackOrder.length - 1) return;

    const timer = setTimeout(() => {
      if (campaigns.length > 0 && playlistPlaysSinceAd >= 4) {
        const selected = campaigns[campaignCursor % campaigns.length];
        setActiveCampaign(selected);
        campaignStartedAtRef.current = Date.now();
        setCampaignCursor(value => value + 1);
        setPlaylistPlaysSinceAd(0);
        return;
      }
      setPlaylistPlaysSinceAd(value => value + 1);
      let nextOrder = playbackOrder;
      let nextCursor = orderCursor + 1;

      if (nextCursor >= nextOrder.length) {
        nextOrder = buildPlaybackOrder(playlistItems.length, Boolean(playlist?.shuffle));
        nextCursor = 0;
        setPlaybackOrder(nextOrder);
      }

      const nextIndex = nextOrder[nextCursor];
      if (typeof nextIndex === 'number') {
        setOrderCursor(nextCursor);
        setCurrentIndex(nextIndex);
      }
    }, currentDurationSeconds * 1000);

    return () => clearTimeout(timer);
  }, [orderCursor, playbackOrder, playlistItems.length, playbackDurationSeconds, playlist?.loop, playlist?.shuffle, activeCampaign, campaigns, playlistPlaysSinceAd, campaignCursor]);

  useEffect(() => {
    onStatusChange?.({
      index: activeIndex,
      total: playlistItems.length || 1,
      title: activeContent?.title || 'System Idle',
      durationSeconds: currentDurationSeconds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeContent?.id, playlistItems.length, currentDurationSeconds]);

  useEffect(() => {
    if (activeContent?.id) {
      onPlaybackStart?.({
        contentId: activeContent.id,
        title: activeContent.title,
        durationSeconds: currentDurationSeconds,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContent?.id]);

  const nextPlaylistIndex = playbackOrder.length > 0
    ? playbackOrder[(orderCursor + 1) % playbackOrder.length]
    : undefined;
  const nextItem = typeof nextPlaylistIndex === 'number' ? playlistItems[nextPlaylistIndex] : undefined;
  const nextContent = nextItem ? contents.find(c => c.id === nextItem.contentId) : undefined;

  useEffect(() => {
    if (!nextContent?.url) return;
    const url = cacheBustMediaUrl(
      optimizeMediaUrl(nextContent.url, nextContent.type === 'IMAGE' ? 'IMAGE' : 'VIDEO'),
      nextContent.updatedAt
    );
    try { (window as any).SpaceQNative?.cacheMedia?.(url); } catch {}
  }, [nextContent?.id, nextContent?.url, nextContent?.updatedAt]);

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden">
      {zoneLabel && (
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/50 text-white/70 text-[10px] font-bold tracking-wide zone-label-autohide">
          {zoneLabel}
        </div>
      )}

      {nextContent && (
        <div className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
          {nextContent.type === 'IMAGE' && (
            <img
              src={cacheBustMediaUrl(optimizeMediaUrl(nextContent.url, 'IMAGE'), nextContent.updatedAt)}
              alt=""
              width="1"
              height="1"
            />
          )}
          {nextContent.type === 'VIDEO' && (
            <video
              src={cacheBustMediaUrl(optimizeMediaUrl(nextContent.url, 'VIDEO'), nextContent.updatedAt)}
              preload="auto"
              muted
              playsInline
            />
          )}
        </div>
      )}

      {activeCampaign ? (
        <div className="w-full h-full flex items-center justify-center bg-black">
          {/\.(mp4|webm|mov)(\?|#|$)/i.test(activeCampaign.creativeUrl) ? (
            <video key={activeCampaign.campaignId} src={activeCampaign.creativeUrl} autoPlay muted playsInline className="w-full h-full object-contain" />
          ) : (
            <img key={activeCampaign.campaignId} src={activeCampaign.creativeUrl} alt={activeCampaign.name} className="w-full h-full object-contain" />
          )}
        </div>
      ) : activeContent ? (
        <div className="w-full h-full flex items-center justify-center relative">
          {activeContent.type === 'TEMPLATE' && activeContent.pageContent && (
            <div key={`${activeContent.id}:${activeContent.updatedAt || activeContent.url}`} className="w-full h-full transition-fade">
              <PageContentRenderer page={activeContent.pageContent} />
            </div>
          )}

          {activeContent.type === 'IMAGE' && (() => {
            const effect = activeContent.transitionEffect || 'FADE';
            const effectClass =
              effect === 'SLIDE' ? 'transition-slide' :
              effect === 'ZOOM' ? 'transition-zoom' :
              effect === 'NONE' ? '' : 'transition-fade';
            return (
              <img
                key={`${activeContent.id}:${activeContent.updatedAt || activeContent.url}`}
                src={cacheBustMediaUrl(optimizeMediaUrl(activeContent.url, 'IMAGE'), activeContent.updatedAt)}
                alt={activeContent.title}
                className={`w-full h-full ${effectClass}`}
                style={{
                  ...mediaFrameStyle,
                  ...(effect === 'ZOOM' ? { animationDuration: `${currentDurationSeconds}s` } : {}),
                }}
              />
            );
          })()}

          {activeContent.type === 'VIDEO' && (
            <video
              key={`${activeContent.id}:${activeContent.updatedAt || activeContent.url}`}
              src={cacheBustMediaUrl(optimizeMediaUrl(activeContent.url, 'VIDEO'), activeContent.updatedAt)}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="w-full h-full"
              style={mediaFrameStyle}
            />
          )}

          {activeContent.type === 'WEBSITE' && (
            <iframe
              key={`${activeContent.id}:${activeContent.updatedAt || activeContent.url}`}
              src={cacheBustMediaUrl(activeContent.url, activeContent.updatedAt)}
              className="w-full h-full border-0"
              title="Website Signage"
            />
          )}

          {activeContent.type === 'YOUTUBE' && (
            toYouTubeEmbedUrl(activeContent.url) ? (
              <iframe
                key={`${activeContent.id}:${activeContent.updatedAt || activeContent.url}`}
                src={cacheBustMediaUrl(toYouTubeEmbedUrl(activeContent.url)!, activeContent.updatedAt)}
                className="w-full h-full border-0 pointer-events-none"
                title="YouTube Signage"
                allow="autoplay; encrypted-media; picture-in-picture"
              />
            ) : (
              <div className="text-center p-8 text-amber-400 space-y-2">
                <Tv className="w-10 h-10 mx-auto text-amber-500/60" />
                <p className="text-sm font-bold">Couldn't read this YouTube link</p>
                <p className="text-xs text-slate-500 break-all max-w-md mx-auto">{activeContent.url}</p>
                <p className="text-[11px] text-slate-500">Paste the normal video URL (e.g. youtube.com/watch?v=... or youtu.be/...)</p>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="text-center p-8 text-slate-400 space-y-2">
          <Tv className="w-12 h-12 mx-auto text-slate-600 animate-pulse" />
          {playlist && playlistItems.length > 0 ? (
            <>
              <p className="text-sm font-bold">Preparing display…</p>
              <p className="text-xs text-slate-500">Waiting for the first media item.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">No Playlist Content Assigned</p>
              <p className="text-xs text-slate-500">Assign a playlist in the SPACEQ dashboard to begin playback.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
