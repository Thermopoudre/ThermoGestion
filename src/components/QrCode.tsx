"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1 }).then(setSrc);
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} className="rounded bg-gray-100" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR code" width={size} height={size} className="rounded" />;
}
