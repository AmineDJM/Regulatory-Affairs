import { randomBytes } from "node:crypto";
import { putBlob, releaseBlob } from "@/lib/drive-storage";

// 60 fichiers de 1 Mo : séquentiel (code actuel) vs pool borné.
async function seq(bufs: Buffer[]) {
  const ids: string[] = [];
  for (const b of bufs) ids.push((await putBlob(b)).blobId);
  return ids;
}
async function pool(bufs: Buffer[], n: number) {
  const ids: string[] = new Array(bufs.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (cursor < bufs.length) { const i = cursor++; ids[i] = (await putBlob(bufs[i])).blobId; }
  }));
  return ids;
}
async function main() {
  for (const mode of ["seq", "pool4", "pool8"] as const) {
    const bufs = Array.from({ length: 60 }, () => randomBytes(1024 * 1024)); // uniques → jamais dédupliqués
    const t = Date.now();
    const ids = mode === "seq" ? await seq(bufs) : await pool(bufs, mode === "pool4" ? 4 : 8);
    console.log(`${mode.padEnd(6)} → ${((Date.now() - t) / 1000).toFixed(1)} s pour 60 fichiers × 1 Mo`);
    for (const id of ids) await releaseBlob(id).catch(() => undefined);
  }
  process.exit(0);
}
void main();
