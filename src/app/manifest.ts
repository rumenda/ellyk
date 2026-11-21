import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Elly K Driving School",
    short_name: "Elly K",
    description: "Your lessons, payments and NTSA progress.",
    start_url: "/app?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#0e7566",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pay fees", url: "/app/payments", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My schedule", url: "/app/schedule", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
