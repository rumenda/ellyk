"use client";
import { useEffect } from "react";
import { toast } from "sonner";

/** Registers the service worker and offers a reload when a new version is ready. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    // Personal cached pages never survive a sign-in/out on a shared phone.
    if (["/login", "/activate"].includes(window.location.pathname)) navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_USER_CACHE" });
    let refreshing = false;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            toast("A new version of Elly K is available", {
              duration: Infinity,
              action: { label: "Update", onClick: () => sw.postMessage({ type: "SKIP_WAITING" }) },
            });
          }
        });
      });
    }).catch(() => { /* SW unsupported or blocked – app still works online */ });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);
  return null;
}
