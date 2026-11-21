import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Elly K Driving School", template: "%s · Elly K" },
  description: "Motorcycle rider training in Kenya – lessons, payments and NTSA progress in one place.",
  applicationName: "Elly K",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Elly K", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e7566",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-KE">
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4500 }} />
        <ServiceWorker />
      </body>
    </html>
  );
}
