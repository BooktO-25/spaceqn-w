import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (_req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const db = getAdminDb();
    await db.collection('_system').doc('campaign-api-health').get();
    return res.status(200).json({ ok: true, service: 'campaign-api', firebaseAdmin: 'connected' });
  } catch (error) {
    // Do not return credential details or raw SDK errors to the public caller.
    console.error('Campaign API health check failed:', error);
    return res.status(503).json({ ok: false, service: 'campaign-api', error: 'Firebase Admin is not available. Check UAT server environment configuration.' });
  }
}
