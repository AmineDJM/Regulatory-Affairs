"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

interface Geo {
  lat: number;
  lng: number;
  acc: number;
}

/** Logs a page-view with time-on-page, precise geolocation and device when available. */
function send(path: string, durationMs: number, geo: Geo | null, dev: string | null) {
  try {
    const data = JSON.stringify({ path, durationMs, lat: geo?.lat, lng: geo?.lng, accuracy: geo?.acc, dev });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/activity", new Blob([data], { type: "text/plain" }));
    } else {
      fetch("/api/activity", { method: "POST", body: data, keepalive: true });
    }
  } catch {
    /* best-effort */
  }
}

type UAData = {
  getHighEntropyValues?: (hints: string[]) => Promise<{ platform?: string; model?: string; platformVersion?: string }>;
};

export function ActivityTracker() {
  const pathname = usePathname();
  const ref = React.useRef({ path: pathname, start: Date.now() });
  const geoRef = React.useRef<Geo | null>(null);
  const devRef = React.useRef<string | null>(null);

  // Request precise geolocation (browser consent) + high-entropy device once per session.
  React.useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          geoRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        },
        () => {
          /* denied or unavailable → IP-based geolocation remains the fallback */
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
      );
    }
    const uad = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
    uad?.getHighEntropyValues?.(["model", "platform", "platformVersion"])
      .then((v) => {
        devRef.current = [v.platform, v.model].filter(Boolean).join(" ").trim() || null;
      })
      .catch(() => undefined);
  }, []);

  // On navigation, log the page we are leaving with its dwell time.
  React.useEffect(() => {
    const prev = ref.current;
    if (prev.path !== pathname) {
      send(prev.path, Date.now() - prev.start, geoRef.current, devRef.current);
      ref.current = { path: pathname, start: Date.now() };
    }
  }, [pathname]);

  // On tab close / hide, flush the current page.
  React.useEffect(() => {
    const flush = () => {
      const p = ref.current;
      send(p.path, Date.now() - p.start, geoRef.current, devRef.current);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
