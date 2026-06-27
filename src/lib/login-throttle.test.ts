import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkLockout, recordFailure, clearAttempts, MAX_FAILURES } from "./login-throttle";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const EMAIL = "__throttletest__@t.dz";

suite("Login throttle — verrouillage anti-bruteforce", () => {
  afterAll(async () => {
    await prisma.loginAttempt.deleteMany({ where: { email: { contains: "__throttletest__" } } }).catch(() => {});
  });

  it("ne verrouille pas en dessous du seuil", async () => {
    await clearAttempts(EMAIL);
    for (let i = 1; i < MAX_FAILURES; i++) {
      const r = await recordFailure(EMAIL, "1.2.3.4");
      expect(r.lockedNow).toBe(false);
      expect(r.failures).toBe(i);
    }
    expect((await checkLockout(EMAIL)).locked).toBe(false);
  });

  it("verrouille au seuil atteint et le signale une seule fois", async () => {
    await clearAttempts(EMAIL);
    let last;
    for (let i = 0; i < MAX_FAILURES; i++) last = await recordFailure(EMAIL, "1.2.3.4");
    expect(last!.lockedNow).toBe(true);
    expect(last!.until).toBeInstanceOf(Date);
    const lock = await checkLockout(EMAIL);
    expect(lock.locked).toBe(true);
    expect(lock.until!.getTime()).toBeGreaterThan(Date.now());

    // Un échec supplémentaire pendant le verrou ne « re-déclenche » pas l'alerte.
    const again = await recordFailure(EMAIL, "1.2.3.4");
    expect(again.lockedNow).toBe(false);
  });

  it("une connexion réussie réinitialise le compteur", async () => {
    await clearAttempts(EMAIL);
    expect((await checkLockout(EMAIL)).locked).toBe(false);
    const row = await prisma.loginAttempt.findUnique({ where: { email: EMAIL } });
    expect(row).toBeNull();
  });
});
