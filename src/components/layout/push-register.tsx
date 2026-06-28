"use client";

import * as React from "react";
import { Bell, BellRing, Loader2, Check } from "lucide-react";

// Convertit la clé publique VAPID (base64url) en Uint8Array pour PushManager.
function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getKey(): Promise<{ enabled: boolean; publicKey: string } | null> {
  try {
    const r = await fetch("/api/push/key", { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function subscribe(publicKey: string): Promise<boolean> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) });
  }
  const res = await fetch("/api/push/subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()),
  });
  return res.ok;
}

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Silencieux : enregistre le SW et (ré)abonne l'appareil si la permission est déjà accordée. */
export function PushRegister() {
  React.useEffect(() => {
    if (!supported()) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (Notification.permission !== "granted") return;
    getKey().then((k) => { if (k?.enabled && k.publicKey) subscribe(k.publicKey).catch(() => {}); });
  }, []);
  return null;
}

/** Bouton visible : demande la permission puis abonne l'appareil aux notifications push. */
export function EnablePushButton() {
  const [state, setState] = React.useState<"idle" | "busy" | "on" | "denied" | "unsupported" | "disabled">("idle");

  React.useEffect(() => {
    if (!supported()) { setState("unsupported"); return; }
    getKey().then((k) => {
      if (!k?.enabled) { setState("disabled"); return; }
      if (Notification.permission === "granted") setState("on");
      else if (Notification.permission === "denied") setState("denied");
    });
  }, []);

  async function enable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "idle"); return; }
      const k = await getKey();
      if (!k?.enabled || !k.publicKey) { setState("disabled"); return; }
      const ok = await subscribe(k.publicKey);
      setState(ok ? "on" : "idle");
    } catch { setState("idle"); }
  }

  if (state === "unsupported" || state === "disabled") return null;
  if (state === "on") {
    return <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-medium text-success"><Check className="h-4 w-4" /> Notifications activées sur cet appareil</span>;
  }
  if (state === "denied") {
    return <span className="text-sm text-muted-foreground">Notifications bloquées par le navigateur — autorisez-les dans les réglages du site.</span>;
  }
  return (
    <button onClick={enable} disabled={state === "busy"}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
      Activer les notifications sur cet appareil
    </button>
  );
}
