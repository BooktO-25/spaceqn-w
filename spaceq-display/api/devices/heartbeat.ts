import { authenticateDevice } from '../_lib/deviceAuth';
import { firestoreRequest } from '../_lib/firebaseAdmin';

interface RequestLike { method?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const header = req.headers?.authorization;
    const bearer = Array.isArray(header) ? header[0] : header;
    const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : '';
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
    const device = await authenticateDevice(deviceId, token);
    if (!device) return res.status(401).json({ ok: false, error: 'Display credential is invalid. Re-pair this display.' });

    const now = new Date().toISOString();
    const patch = await firestoreRequest(`devices/${encodeURIComponent(deviceId)}?updateMask.fieldPaths=lastSeenAt&updateMask.fieldPaths=lastDeviceApiAt`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: {
        lastSeenAt: { stringValue: now },
        lastDeviceApiAt: { stringValue: now },
      } }),
    });
    if (!patch.ok) throw new Error('Could not update device heartbeat.');
    return res.status(200).json({ ok: true, deviceId, serverTime: now });
  } catch (error) {
    console.error('Device heartbeat failed:', error);
    return res.status(503).json({ ok: false, error: 'Heartbeat service is temporarily unavailable.' });
  }
}
