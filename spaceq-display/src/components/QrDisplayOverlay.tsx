import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type QrConfig = {
  size?: number;
  x?: number;
  y?: number;
  foreground?: string;
  background?: string;
  label?: string;
  showLabel?: boolean;
};

export const QrDisplayOverlay: React.FC<{ config: QrConfig; url: string }> = ({ config, url }) => {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: config.foreground || '#102A43',
        light: config.background || '#FFFFFF',
      },
    }).then(result => {
      if (active) setImageUrl(result);
    }).catch(error => console.warn('Could not generate display QR:', error));
    return () => { active = false; };
  }, [url, config.foreground, config.background]);

  const size = Math.max(90, Math.min(300, Number(config.size) || 150));
  const background = config.background || '#FFFFFF';
  const foreground = config.foreground || '#102A43';

  if (!imageUrl) return null;

  return (
    <div
      className="pointer-events-none absolute flex flex-col items-center rounded-xl p-2.5 shadow-2xl"
      style={{
        zIndex: 2147483647,
        left: `${config.x ?? 88}%`,
        top: `${config.y ?? 72}%`,
        width: size,
        transform: 'translate(-50%, -50%)',
        backgroundColor: background,
      }}
    >
      <img src={imageUrl} alt="Scan to open SPACEQ information page" className="block h-auto w-full"/>
      {config.showLabel !== false && config.label && (
        <span className="mt-2 w-full text-center text-[11px] font-extrabold leading-tight" style={{ color: foreground }}>
          {config.label}
        </span>
      )}
    </div>
  );
};
