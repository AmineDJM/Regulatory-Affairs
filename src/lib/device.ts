/** Lightweight User-Agent parsing + client IP extraction (no dependency). */

export interface DeviceInfo {
  device: string; // desktop | mobile | tablet | unknown
  os: string;
  browser: string;
}

export function parseDevice(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/.test(s)
    ? "tablet"
    : /Mobile|iPhone|iPod|Android.*Mobile|Windows Phone/.test(s)
      ? "mobile"
      : s
        ? "desktop"
        : "unknown";
  const os = /Windows NT/.test(s)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(s)
      ? "macOS"
      : /Android/.test(s)
        ? "Android"
        : /iPhone|iPad|iOS|CPU OS/.test(s)
          ? "iOS"
          : /Linux/.test(s)
            ? "Linux"
            : "—";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /SamsungBrowser/.test(s)
        ? "Samsung Internet"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Firefox\//.test(s)
            ? "Firefox"
            : /Safari\//.test(s)
              ? "Safari"
              : "—";
  return { device, os, browser };
}

export function clientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip");
}
