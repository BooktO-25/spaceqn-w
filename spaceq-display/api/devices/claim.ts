import { firestoreRequest } from '../_lib/firebaseAdmin';

interface RequestLike { method?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }

function fieldString(fields: Record<string, any> | undefined, key: string): string {
  return fields?.[key]?.stringValue || '';
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const authHeader = req.headers?.authorization;
    const bearer = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const idToken = bearer?.startsWith('Bearer ') ? bearer.slice(7) : '';
    if (!idToken) return res.status(401).json({ ok: false, error: 'Sign-in required.' });

    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) throw new Error('Firebase API key is not configured for server verification.');
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }),
    });
    if (!lookup.ok) return res.status(401).json({ ok: false, error: 'Your session is invalid or expired. Sign in again.' });
    const identity = await lookup.json() as { users?: Array<{ localId?: string; email?: string }> };
    const uid = identity.users?.[0]?.localId;
    if (!uid) return res.status(401).json({ ok: false, error: 'Could not verify the signed-in user.' });

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const locationId = typeof body.locationId === 'string' ? body.locationId : '';
    const playlistId = typeof body.playlistId === 'string' ? body.playlistId : '';
    const assignedPlaylistIds = Array.isArray(body.assignedPlaylistIds)
      ? body.assignedPlaylistIds.filter((v): v is string => typeof v === 'string').slice(0, 30)
      : [playlistId];
    const orientation = body.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE';
    if (!/^\d{6}$/.test(code) || !name || name.length > 100 || !locationId || !playlistId) {
      return res.status(400).json({ ok: false, error: 'Invalid device claim details.' });
    }

    const userResponse = await firestoreRequest(`users/${encodeURIComponent(uid)}`);
    if (!userResponse.ok) return res.status(403).json({ ok: false, error: 'Your account profile is unavailable.' });
    const userDoc = await userResponse.json() as { fields?: Record<string, any> };
    const role = fieldString(userDoc.fields, 'role');
    const businessId = fieldString(userDoc.fields, 'businessId');
    if (!['BUSINESS_OWNER', 'MANAGER', 'SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(role)) {
      return res.status(403).json({ ok: false, error: 'Your role cannot pair displays.' });
    }
    const requestedBusinessId = typeof body.businessId === 'string' ? body.businessId : '';
    if (!requestedBusinessId || (role !== 'SUPER_ADMIN' && requestedBusinessId !== businessId)) {
      return res.status(403).json({ ok: false, error: 'You cannot pair a display outside your business.' });
    }

    const deviceResponse = await firestoreRequest(`devices/${encodeURIComponent(code)}`);
    if (deviceResponse.status === 404) return res.status(404).json({ ok: false, error: 'No display found with that pairing code.' });
    if (!deviceResponse.ok) throw new Error('Could not read the pairing record.');
    const deviceDoc = await deviceResponse.json() as { fields?: Record<string, any>; updateTime?: string };
    const fields = deviceDoc.fields || {};
    if (fieldString(fields, 'status') !== 'PAIRING' || fieldString(fields, 'businessId') !== '') {
      return res.status(409).json({ ok: false, error: 'This pairing code has already been used.' });
    }
    if (!deviceDoc.updateTime) throw new Error('Pairing record is missing its update version.');

    const values: Record<string, unknown> = {
      name, businessId: requestedBusinessId, locationId,
      activePlaylistId: playlistId,
      assignedPlaylistIds,
      layoutMode: 'SINGLE',
      zones: [],
      zoneWeights: [],
      status: 'ONLINE',
      orientation,
      lastSeenAt: new Date().toISOString(),
      tags: ['New Display', orientation],
    };
    const encodedFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string') encodedFields[key] = { stringValue: value };
      else if (typeof value === 'boolean') encodedFields[key] = { booleanValue: value };
      else if (typeof value === 'number') encodedFields[key] = { integerValue: String(value) };
      else if (Array.isArray(value)) encodedFields[key] = { arrayValue: { values: value.map(v => ({ stringValue: v })) } };
      else if (value && typeof value === 'object') encodedFields[key] = { mapValue: { fields: {} } };
    }
    const updateMask = Object.keys(values).map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
    const patch = await firestoreRequest(`devices/${encodeURIComponent(code)}?${updateMask}&currentDocument.updateTime=${encodeURIComponent(deviceDoc.updateTime)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: encodedFields }),
    });
    if (patch.status === 409 || patch.status === 400) return res.status(409).json({ ok: false, error: 'The display was claimed by another session. Refresh and try again.' });
    if (!patch.ok) throw new Error('Firestore rejected the device claim.');
    return res.status(200).json({ ok: true, deviceId: code, name });
  } catch (error) {
    console.error('Device claim failed:', error);
    return res.status(503).json({ ok: false, error: 'The server could not complete device pairing. Please retry.' });
  }
}
