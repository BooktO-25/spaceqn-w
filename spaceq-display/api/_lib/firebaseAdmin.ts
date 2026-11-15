import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

function loadServiceAccount() {
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
  return parsed as { project_id: string; client_email: string; private_key: string };
}

export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;
  const serviceAccount = loadServiceAccount();
  const expectedProject = process.env.FIREBASE_PROJECT_ID;
  if (expectedProject && serviceAccount.project_id !== expectedProject) {
    throw new Error('Firebase Admin credential project does not match FIREBASE_PROJECT_ID.');
  }
  adminApp = getApps().find(app => app.name === 'spaceq-campaign-admin')
    || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id }, 'spaceq-campaign-admin');
  adminDb = getFirestore(adminApp);
  return adminDb;
}
