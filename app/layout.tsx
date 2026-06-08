import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WarehouseAI — Intelligent Warehouse Management System',
  description: 'AI-powered warehouse management with demand forecasting, real-time inventory tracking, and intelligent alerts.',
  keywords: 'warehouse management, demand forecasting, inventory, AI, supply chain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
