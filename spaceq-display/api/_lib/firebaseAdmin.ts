import { createSign } from 'node:crypto';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  if (typeof parsed.project_id !== 'string' || typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
    throw new Error('Firebase service-account JSON is missing required fields.');
  }
  if (process.env.FIREBASE_PROJECT_ID && parsed.project_id !== process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Firebase Admin credential project does not match FIREBASE_PROJECT_ID.');
  }
  return parsed as ServiceAccount;
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + '.' + claims;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + '.' + base64Url(signer.sign(account.private_key));

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error('Google OAuth token exchange failed.');
  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!token.access_token) throw new Error('Google OAuth did not return an access token.');
  cachedToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in || 3600) * 1000 };
  return token.access_token;
}

export async function firestoreRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const account = loadServiceAccount();
  const token = await getAccessToken(account);
  const safePath = path.replace(/^\/+/, '');
  return fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/databases/(default)/documents/${safePath}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

export function getFirebaseProjectId(): string {
  return loadServiceAccount().project_id;
}
