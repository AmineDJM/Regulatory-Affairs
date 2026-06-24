"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/** Logs a page-view with time-on-page when the user leaves each page. */
function send(path: string, durationMs: number) {
  try {
    const data = JSON.stringify({ path, durationMs });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/activity", new Blob([data], { type: "text/plain" }));
    } else {
      fetch("/api/activity", { method: "POST", body: data, keepalive: true });
    }
  } catch {
    /* best-effort */
  }
}

export function ActivityTracker() {
  const pathname = usePathname();
  const ref = React.useRef({ path: pathname, start: Date.now() });

  // On navigation, log the page we are leaving with its dwell time.
  React.useEffect(() => {
    const prev = ref.current;
    if (prev.path !== pathname) {
      send(prev.path, Date.now() - prev.start);
      ref.current = { path: pathname, start: Date.now() };
    }
  }, [pathname]);

  // On tab close / hide, flush the current page.
  React.useEffect(() => {
    const flush = () => {
      const p = ref.current;
      send(p.path, Date.now() - p.start);
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
