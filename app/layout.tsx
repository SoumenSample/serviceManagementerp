import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ESP SOLUTIONS",
  description: "UPS / Inverter AMC, Repair & Service Management - Engineer PWA",
  manifest: "/manifest.webmanifest",
  applicationName: "ESP Soln",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ESP Soln" },
  formatDetection: { telephone: false },
  themeColor: "#059669",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});}`,
          }}
        />
      </body>
    </html>
  );
}
