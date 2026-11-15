import { createHash, timingSafeEqual } from 'node:crypto';
import { firestoreRequest } from './firebaseAdmin';

type DeviceRecord = {
  fields?: Record<string, any>;
  updateTime?: string;
};

function stringField(fields: Record<string, any> | undefined, key: string): string {
  return fields?.[key]?.stringValue || '';
}

export async function authenticateDevice(deviceId: string, token: string) {
  if (!/^\d{6}$/.test(deviceId) || !/^[a-f0-9]{64}$/.test(token)) return null;
  const response = await firestoreRequest(`devices/${encodeURIComponent(deviceId)}`);
  if (!response.ok) return null;
  const record = await response.json() as DeviceRecord;
  const storedHash = stringField(record.fields, 'deviceTokenHash');
  if (!/^[a-f0-9]{64}$/.test(storedHash)) return null;
  const suppliedHash = createHash('sha256').update(token, 'utf8').digest();
  const expectedHash = Buffer.from(storedHash, 'hex');
  if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(expectedHash, suppliedHash)) return null;
  const businessId = stringField(record.fields, 'businessId');
  if (!businessId || stringField(record.fields, 'status') === 'PAIRING') return null;
  return { deviceId, businessId, updateTime: record.updateTime || '' };
}
