import { describe, it, expect } from "vitest";
import type { SessionUser } from "@/lib/rbac";
import {
  roomName, roomUrl, genSlug, genPublicToken, publicMeetUrl, canViewMeeting, canManageMeeting,
} from "./meetings";

const mkUser = (id: string, role: SessionUser["role"]): SessionUser =>
  ({ id, role } as unknown as SessionUser);

describe("meetings helpers", () => {
  it("roomName préfixe le slug (espace de noms partagé)", () => {
    expect(roomName("abc123")).toBe("AdventumOS-abc123");
  });

  it("roomUrl encode la salle et gère audio/affichage", () => {
    const u = roomUrl("abc123", { video: true });
    expect(u).toContain("meet.jit.si/AdventumOS-abc123");
    expect(u).not.toContain("startWithVideoMuted");

    const audio = roomUrl("abc123", { video: false });
    expect(audio).toContain("#config.startWithVideoMuted=true");

    const named = roomUrl("abc123", { display: "Amine D" });
    expect(named).toContain("userInfo.displayName=");
  });

  it("genSlug / genPublicToken : url-safe, non vides et uniques", () => {
    const a = genSlug(), b = genSlug();
    const t = genPublicToken();
    expect(a).toMatch(/^[a-z0-9]+$/);
    expect(a).not.toBe(b);
    expect(t.length).toBeGreaterThanOrEqual(16);
    expect(t).not.toMatch(/[+/=]/);
  });

  it("publicMeetUrl construit un lien absolu propre", () => {
    expect(publicMeetUrl("tok", "https://app.example.com/")).toBe("https://app.example.com/meet/tok");
  });

  it("accès : organisateur, participant et vue globale ; refus sinon", () => {
    const meeting = { organizerId: "org", participants: [{ userId: "part" }] };
    expect(canViewMeeting(mkUser("org", "MEDICAL_DELEGATE"), meeting)).toBe(true);
    expect(canViewMeeting(mkUser("part", "MEDICAL_DELEGATE"), meeting)).toBe(true);
    expect(canViewMeeting(mkUser("autre", "MEDICAL_DELEGATE"), meeting)).toBe(false);
    // Vue globale (Direction / Super Admin) voit tout.
    expect(canViewMeeting(mkUser("dir", "DIRECTION"), meeting)).toBe(true);

    // Gestion : organisateur ou vue globale uniquement.
    expect(canManageMeeting(mkUser("org", "MEDICAL_DELEGATE"), meeting)).toBe(true);
    expect(canManageMeeting(mkUser("part", "MEDICAL_DELEGATE"), meeting)).toBe(false);
    expect(canManageMeeting(mkUser("dir", "SUPER_ADMIN"), meeting)).toBe(true);
  });
});
