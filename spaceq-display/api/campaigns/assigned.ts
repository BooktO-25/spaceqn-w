import { authenticateDevice } from '../_lib/deviceAuth';
import { firestoreRequest } from '../_lib/firebaseAdmin';

interface RequestLike { method?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }

function str(fields: Record<string, any> | undefined, key: string): string {
  return fields?.[key]?.stringValue || '';
}
function num(fields: Record<string, any> | undefined, key: string): number {
  return Number(fields?.[key]?.integerValue ?? fields?.[key]?.doubleValue ?? 0);
}
function indiaDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Returns only campaigns allocated to this authenticated screen for today. */
export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const header = req.headers?.authorization;
    const bearer = Array.isArray(header) ? header[0] : header;
    const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : '';
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
    const device = await authenticateDevice(deviceId, token);
    if (!device) return res.status(401).json({ ok: false, error: 'Display credential is invalid.' });

    const day = indiaDate();
    const schedulesResponse = await firestoreRequest(`campaignSchedules/${encodeURIComponent('')}`);
    // The Firestore REST API has no collection-list operation at this path.
    // Campaign IDs are therefore supplied by the device's lightweight index
    // document, maintained by the booking workflow.
    if (schedulesResponse.ok) { /* reserved for forward-compatible index reads */ }
    const indexResponse = await firestoreRequest(`deviceCampaignIndex/${encodeURIComponent(deviceId)}`);
    if (indexResponse.status === 404) return res.status(200).json({ ok: true, date: day, campaigns: [] });
    if (!indexResponse.ok) throw new Error('Could not load screen campaign index.');
    const indexDoc = await indexResponse.json() as { fields?: Record<string, any> };
    const ids = indexDoc.fields?.campaignIds?.arrayValue?.values || [];
    const campaigns: Array<{ campaignId: string; name: string; creativeUrl: string; durationSeconds: number; plannedPlays: number; completedPlays: number }> = [];

    for (const entry of ids.slice(0, 100)) {
      const campaignId = entry.stringValue;
      if (!campaignId || !/^[A-Za-z0-9_-]{1,128}$/.test(campaignId)) continue;
      const scheduleId = `${campaignId}_${deviceId}`;
      const [scheduleResponse, campaignResponse, dailyResponse] = await Promise.all([
        firestoreRequest(`campaignSchedules/${encodeURIComponent(scheduleId)}`),
        firestoreRequest(`campaigns/${encodeURIComponent(campaignId)}`),
        firestoreRequest(`campaignDailyDelivery/${encodeURIComponent(`${campaignId}_${deviceId}_${day}`)}`),
      ]);
      if (!scheduleResponse.ok || !campaignResponse.ok) continue;
      const scheduleDoc = await scheduleResponse.json() as { fields?: Record<string, any> };
      const campaignDoc = await campaignResponse.json() as { fields?: Record<string, any> };
      const schedule = scheduleDoc.fields || {};
      const campaign = campaignDoc.fields || {};
      const plannedPlays = Number(schedule.datePlays?.mapValue?.fields?.[day]?.integerValue || 0);
      let completedPlays = 0;
      if (dailyResponse.ok) {
        const dailyDoc = await dailyResponse.json() as { fields?: Record<string, any> };
        completedPlays = num(dailyDoc.fields, 'completedPlays');
      } else if (dailyResponse.status !== 404) {
        throw new Error('Could not load daily campaign delivery.');
      }
      if (str(schedule, 'businessId') !== device.businessId ||
          str(schedule, 'screenId') !== deviceId ||
          !['published', 'live'].includes(str(schedule, 'status')) ||
          str(campaign, 'businessId') !== device.businessId ||
          !['scheduled', 'live'].includes(str(campaign, 'status')) ||
          day < str(campaign, 'startDate') || day > str(campaign, 'endDate') ||
          plannedPlays <= completedPlays) continue;
      const creativeUrl = str(campaign, 'creativeUrl');
      const durationSeconds = num(campaign, 'creativeDurationSeconds');
      if (!/^https:\/\//i.test(creativeUrl) || ![10, 15, 20, 30, 60].includes(durationSeconds)) continue;
      campaigns.push({
        campaignId,
        name: str(campaign, 'name'),
        creativeUrl,
        durationSeconds,
        plannedPlays,
        completedPlays,
      });
    }
    return res.status(200).json({ ok: true, date: day, campaigns });
  } catch (error) {
    console.error('Assigned campaign lookup failed:', error);
    return res.status(503).json({ ok: false, error: 'Campaign schedule service is temporarily unavailable.' });
  }
}
