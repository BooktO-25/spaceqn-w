import cloudinaryConfig from '../../cloudinary-config.json';

export interface UploadResult {
  url: string;
  bytes: number;
}

/**
 * Uploads a file straight from the browser to Cloudinary using an UNSIGNED
 * upload preset — no backend, no API secret exposed, and no Firebase Storage
 * (which now requires a linked billing/Blaze account even for free usage).
 *
 * Setup (one-time, free, no credit card):
 *   1. Create a free account at https://cloudinary.com
 *   2. Copy your "Cloud name" from the dashboard.
 *   3. Settings → Upload → Upload presets → Add upload preset →
 *      set Signing Mode to "Unsigned" → Save. Copy the preset name.
 *   4. Put both values into cloudinary-config.json in the project root.
 */
export function uploadToCloudinary(
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    if (
      !cloudinaryConfig.cloudName ||
      cloudinaryConfig.cloudName === 'YOUR_CLOUDINARY_CLOUD_NAME' ||
      !cloudinaryConfig.uploadPreset ||
      cloudinaryConfig.uploadPreset === 'YOUR_UNSIGNED_UPLOAD_PRESET'
    ) {
      reject(new Error('Cloudinary is not configured yet. Fill in cloudinary-config.json with your cloud name and unsigned upload preset.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
          resolve({ url: res.secure_url as string, bytes: (res.bytes as number) || file.size });
        } else {
          reject(new Error(res.error?.message || 'Upload failed. Check your Cloudinary preset is set to Unsigned.'));
        }
      } catch {
        reject(new Error('Unexpected response from Cloudinary.'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(formData);
  });
}
