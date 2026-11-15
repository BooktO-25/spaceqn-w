import { firestoreRequest } from '../_lib/firebaseAdmin';

interface RequestLike { method?: string }
interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const response = await firestoreRequest('_system/campaign-api-health');
    // A 404 is a valid connectivity response: the collection/document need not exist.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Firestore returned HTTP ${response.status}.`);
    }
    return res.status(200).json({ ok: true, service: 'campaign-api', firestore: 'connected' });
  } catch (error) {
    console.error('Campaign API health check failed:', error);
    return res.status(503).json({
      ok: false,
      service: 'campaign-api',
      error: 'Firebase server connection is unavailable. Check the UAT server environment configuration.',
    });
  }
}
