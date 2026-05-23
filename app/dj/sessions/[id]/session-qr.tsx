'use client'

import QRCode from 'react-qr-code'

export default function SessionQR({ url }: { url: string }) {
  return (
    <div className="shrink-0 rounded-lg bg-white p-2">
      <QRCode value={url} size={80} />
    </div>
  )
}
