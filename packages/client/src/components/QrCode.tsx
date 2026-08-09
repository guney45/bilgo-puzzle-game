import { QRCodeSVG } from 'qrcode.react';

interface QrCodeProps {
  value: string;
  size?: number;
}

export function QrCode({ value, size = 144 }: QrCodeProps) {
  return (
    <div className="inline-block rounded-lg bg-white p-2">
      <QRCodeSVG value={value} size={size} marginSize={0} level="M" />
    </div>
  );
}
