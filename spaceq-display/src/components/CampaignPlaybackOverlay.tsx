import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ContentItem } from '../types';

type ActiveCampaign = {
  id: string;
  businessId: string;
  name: string;
  advertiserName?: string;
  contentId: string;
  deviceIds: string[];
  startDate: string;
  endDate: string;
  playsPerScreenPerDay: number;
  status: string;
};

type Props = {
  deviceId: string;
  businessId: string;
  campaigns: ActiveCampaign[];
  contents: ContentItem[];
  suspended?: boolean;
};

/**
 * Device-local campaign scheduler. Each campaign's daily target is spread
 * evenly through a 10-hour operating window (10:00–20:00 local device time).
 * A small local marker prevents a kiosk refresh from replaying the same slot.
 */
export const CampaignPlaybackOverlay: React.FC<Props> = ({
  deviceId, businessId, campaigns, contents, suspended = false,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [playing, setPlaying] = useState<{ campaign: ActiveCampaign; content: ContentItem; startedAt: string; slotKey: string } | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const eligible = useMemo(() => campaigns.filter(c =>
    c.status === 'ACTIVE' &&
    (c.deviceIds || []).includes(deviceId) &&
    c.startDate <= localDate(now) &&
    c.endDate >= localDate(now) &&
    Number(c.playsPerScreenPerDay) > 0 &&
    contents.some(item => item.id === c.contentId)
  ), [campaigns, contents, deviceId, now]);

  useEffect(() => {
    if (suspended || playing || eligible.length === 0) return;
    const minutes = now.getHours() * 60 + now.getMinutes();
    const windowStart = 10 * 60;
    const windowLength = 10 * 60;
    if (minutes < windowStart || minutes >= windowStart + windowLength) return;

    for (const campaign of eligible) {
      const target = Math.min(3240, Math.max(1, Math.floor(Number(campaign.playsPerScreenPerDay) || 1)));
      const intervalMinutes = windowLength / target;
      const offset = stableHash(campaign.id + deviceId) % Math.max(1, Math.floor(intervalMinutes));
      const elapsed = minutes - windowStart - offset;
      if (elapsed < 0) continue;
      const slotIndex = Math.floor(elapsed / intervalMinutes);
      const slotMinute = windowStart + offset + Math.floor(slotIndex * intervalMinutes);
      const lateness = minutes - slotMinute;
      if (lateness < 0 || lateness > 3) continue;

      const slotKey = `spaceq_campaign_slot_${campaign.id}_${deviceId}_${localDate(now)}_${slotIndex}`;
      if (localStorage.getItem(slotKey)) continue;
      const content = contents.find(item => item.id === campaign.contentId);
      if (!content) continue;

      localStorage.setItem(slotKey, 'started');
      setPlaying({ campaign, content, startedAt: new Date().toISOString(), slotKey });
      break;
    }
  }, [now, eligible, contents, deviceId, suspended, playing]);

  useEffect(() => {
    if (!playing || startedRef.current) return;
    startedRef.current = true;
    const durationSeconds = Math.max(5, Math.min(120, Number(playing.content.durationSeconds) || 10));
    const timer = window.setTimeout(async () => {
      const endedAt = new Date().toISOString();
      const actualDuration = Math.max(0, (Date.parse(endedAt) - Date.parse(playing.startedAt)) / 1000);
      try {
        await addDoc(collection(db, 'campaignPlayLogs'), {
          businessId,
          campaignId: playing.campaign.id,
          campaignName: playing.campaign.name,
          deviceId,
          contentId: playing.content.id,
          contentTitle: playing.content.title,
          scheduledSlot: playing.slotKey,
          startedAt: playing.startedAt,
          endedAt,
          durationSeconds: Math.round(actualDuration * 10) / 10,
          completed: actualDuration >= Math.min(durationSeconds * 0.8, durationSeconds - 1),
          source: 'KIOSK_PLAYER',
          createdAt: endedAt,
        });
        localStorage.setItem(playing.slotKey, 'completed');
      } catch (error) {
        console.warn('Campaign proof-of-play write failed:', error);
        // Keep the slot marked to avoid repeatedly showing an ad when the
        // proof endpoint/rules are unavailable. The next scheduled slot retries.
        localStorage.setItem(playing.slotKey, 'unconfirmed');
      } finally {
        startedRef.current = false;
        setPlaying(null);
      }
    }, durationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, businessId, deviceId]);

  if (!playing) return null;
  const { campaign, content } = playing;
  const style: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 2147483647, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
  return (
    <div style={style} aria-label={`Campaign advertisement: ${campaign.name}`}>
      {content.type === 'IMAGE' ? (
        <img src={content.url} alt={content.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : content.type === 'VIDEO' ? (
        <video src={content.url} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : content.type === 'TEMPLATE' && content.pageContent ? (
        <div style={{ width: '100%', height: '100%' }}><div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}><div style={{ color: '#fff', fontSize: '4vw', fontWeight: 800, textAlign: 'center', padding: '5vw' }}>{content.pageContent.headline || content.title}</div></div></div>
      ) : (
        <div style={{ color: '#fff', fontSize: 28, textAlign: 'center', padding: 32 }}>{content.title}</div>
      )}
      <div style={{ position: 'absolute', left: 12, bottom: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(0,0,0,.55)', color: 'rgba(255,255,255,.65)', fontSize: 10, letterSpacing: 1 }}>
        SPACEQ AD · {campaign.advertiserName || campaign.name}
      </div>
    </div>
  );
};

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}
