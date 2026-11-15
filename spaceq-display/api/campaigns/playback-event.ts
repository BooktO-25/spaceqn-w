import { authenticateDevice } from '../_lib/deviceAuth';
import { firestoreCommit, firestoreRequest, getFirebaseProjectId } from '../_lib/firebaseAdmin';

interface RequestLike { method?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }

function str(fields: Record<string, any> | undefined, key: string): string {
  return fields?.[key]?.stringValue || '';
}
function num(fields: Record<string, any> | undefined, key: string): number {
  const value = fields?.[key]?.integerValue ?? fields?.[key]?.doubleValue;
  return Number(value || 0);
}
function valueString(value: string) { return { stringValue: value }; }
function valueNumber(value: number) { return { integerValue: String(value) }; }
function documentName(projectId: string, collection: string, id: string) {
  return `projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
}
function indiaDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

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

    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
    const creativeUrl = typeof body.creativeUrl === 'string' ? body.creativeUrl : '';
    const startedAt = typeof body.startedAt === 'string' ? body.startedAt : '';
    const completedAt = typeof body.completedAt === 'string' ? body.completedAt : '';
    const actualDurationSeconds = Number(body.actualDurationSeconds);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId) || !/^[A-Za-z0-9_-]{1,128}$/.test(campaignId) ||
        !creativeUrl || creativeUrl.length > 2048 || !startedAt || !completedAt) {
      return res.status(400).json({ ok: false, error: 'Playback event is missing required fields.' });
    }
    const startMs = Date.parse(startedAt);
    const endMs = Date.parse(completedAt);
    const now = Date.now();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs ||
        endMs > now + 120_000 || endMs < now - 7 * 24 * 60 * 60 * 1000 ||
        !Number.isFinite(actualDurationSeconds) || actualDurationSeconds <= 0 ||
        Math.abs((endMs - startMs) / 1000 - actualDurationSeconds) > 5) {
      return res.status(400).json({ ok: false, error: 'Playback timing is invalid.' });
    }

    const campaignResponse = await firestoreRequest(`campaigns/${encodeURIComponent(campaignId)}`);
    if (campaignResponse.status === 404) return res.status(404).json({ ok: false, error: 'Campaign not found.' });
    if (!campaignResponse.ok) throw new Error('Could not read campaign.');
    const campaignDoc = await campaignResponse.json() as { fields?: Record<string, any> };
    const campaign = campaignDoc.fields || {};
    const status = str(campaign, 'status');
    if (str(campaign, 'businessId') !== device.businessId ||
        !['scheduled', 'live'].includes(status) ||
        str(campaign, 'creativeUrl') !== creativeUrl) {
      return res.status(403).json({ ok: false, error: 'Campaign is not active or assigned to this business and creative.' });
    }
    const expectedDuration = num(campaign, 'creativeDurationSeconds');
    if (!expectedDuration || actualDurationSeconds < expectedDuration * 0.9) {
      return res.status(400).json({ ok: false, error: 'Playback did not reach the campaign completion threshold.' });
    }
    const day = indiaDate(completedAt);
    const startDate = str(campaign, 'startDate');
    const endDate = str(campaign, 'endDate');
    if (day < startDate || day > endDate) return res.status(403).json({ ok: false, error: 'Playback is outside the campaign date range.' });

    const scheduleId = `${campaignId}_${deviceId}`;
    const scheduleResponse = await firestoreRequest(`campaignSchedules/${encodeURIComponent(scheduleId)}`);
    if (!scheduleResponse.ok) return res.status(403).json({ ok: false, error: 'No screen allocation exists for this campaign.' });
    const scheduleDoc = await scheduleResponse.json() as { fields?: Record<string, any> };
    const schedule = scheduleDoc.fields || {};
    const datePlays = schedule.datePlays?.mapValue?.fields || {};
    const plannedForDate = Number(datePlays[day]?.integerValue || 0);
    if (str(schedule, 'businessId') !== device.businessId ||
        str(schedule, 'screenId') !== deviceId ||
        !['published', 'live'].includes(str(schedule, 'status')) ||
        plannedForDate <= 0) {
      return res.status(403).json({ ok: false, error: 'No active campaign plays are scheduled for this screen today.' });
    }

    const projectId = getFirebaseProjectId();
    const dailyId = `${campaignId}_${deviceId}_${day}`;
    const dailyResponse = await firestoreRequest(`campaignDailyDelivery/${encodeURIComponent(dailyId)}`);
    let dailyCompleted = 0;
    let dailyUpdateTime = '';
    if (dailyResponse.ok) {
      const dailyDoc = await dailyResponse.json() as { fields?: Record<string, any>; updateTime?: string };
      dailyCompleted = num(dailyDoc.fields, 'completedPlays');
      dailyUpdateTime = dailyDoc.updateTime || '';
    } else if (dailyResponse.status !== 404) {
      throw new Error('Could not read the daily delivery counter.');
    }
    if (dailyCompleted >= plannedForDate) {
      return res.status(409).json({ ok: false, error: 'The scheduled play quantity for this screen and date has already been delivered.' });
    }
    const eventFields = {
      eventId: valueString(eventId),
      campaignId: valueString(campaignId),
      businessId: valueString(device.businessId),
      screenId: valueString(deviceId),
      creativeUrl: valueString(creativeUrl),
      startedAt: valueString(new Date(startMs).toISOString()),
      completedAt: valueString(new Date(endMs).toISOString()),
      actualDurationSeconds: { doubleValue: actualDurationSeconds },
      expectedDurationSeconds: valueNumber(expectedDuration),
      localDate: valueString(day),
      evidenceType: valueString('device-reported-browser-playback'),
      receivedAt: valueString(new Date().toISOString()),
    };
    const campaignName = documentName(projectId, 'campaigns', campaignId);
    const scheduleName = documentName(projectId, 'campaignSchedules', scheduleId);
    const allocationName = documentName(projectId, 'campaignAllocations', scheduleId);
    const eventName = documentName(projectId, 'playbackEvents', eventId);
    const dailyName = documentName(projectId, 'campaignDailyDelivery', dailyId);
    const incrementWrite = (name: string) => ({
      transform: {
        document: name,
        fieldTransforms: [{ fieldPath: 'completedPlays', increment: valueNumber(1) }],
      },
    });
    const dailyWrite = dailyUpdateTime
      ? {
          transform: {
            document: dailyName,
            fieldTransforms: [{ fieldPath: 'completedPlays', increment: valueNumber(1) }],
          },
          currentDocument: { updateTime: dailyUpdateTime },
        }
      : {
          update: { name: dailyName, fields: {
            businessId: valueString(device.businessId),
            campaignId: valueString(campaignId),
            screenId: valueString(deviceId),
            localDate: valueString(day),
            completedPlays: valueNumber(1),
          } },
          currentDocument: { exists: false },
        };
    const commit = await firestoreCommit([
      { update: { name: eventName, fields: eventFields }, currentDocument: { exists: false } },
      incrementWrite(campaignName),
      incrementWrite(scheduleName),
      incrementWrite(allocationName),
      dailyWrite,
    ]);
    if (commit.status === 409 || commit.status === 400) {
      return res.status(409).json({ ok: false, duplicate: true, error: 'This playback event was already received or could not be committed.' });
    }
    if (!commit.ok) throw new Error('Firestore rejected playback event commit.');
    return res.status(201).json({ ok: true, eventId, campaignId, screenId: deviceId, localDate: day, evidenceType: 'device-reported-browser-playback' });
  } catch (error) {
    console.error('Playback event ingestion failed:', error);
    return res.status(503).json({ ok: false, error: 'Playback event service is temporarily unavailable.' });
  }
}
