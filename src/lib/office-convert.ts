import { onlyofficeConfigured, onlyofficeServerUrl, appBaseUrl, signJwt } from "@/lib/onlyoffice";

/**
 * Conversion de documents (ex. **docx → PDF**) via le service `ConvertService.ashx`
 * du Document Server OnlyOffice. **Serveur uniquement.**
 *
 * **Inerte** tant qu'OnlyOffice (`ONLYOFFICE_URL` + `ONLYOFFICE_JWT_SECRET`) et l'URL
 * publique de l'app (`APP_URL`) ne sont pas configurés : aucune route active. Le
 * Document Server télécharge le fichier source via `srcUrl` (qui doit lui être
 * joignable — on utilise notre route signée `/api/onlyoffice/file`).
 */

export function convertConfigured(): boolean {
  return onlyofficeConfigured() && Boolean(appBaseUrl());
}

interface ConvertOpts {
  /** URL du fichier source, joignable par le Document Server (serveur-à-serveur). */
  srcUrl: string;
  /** Extension du fichier source (ex. "docx", "xlsx", "pptx"). */
  fromExt: string;
  /** Format de sortie (défaut "pdf"). */
  outputType?: string;
  /** Clé unique du document (change à chaque version → pas de cache obsolète). */
  key: string;
}

interface ConvertResponse {
  error?: number;
  endConvert?: boolean;
  fileUrl?: string;
  percent?: number;
}

/** Convertit un document et renvoie le binaire résultat (ex. PDF). Lève en cas d'échec. */
export async function convertDocument(opts: ConvertOpts): Promise<Buffer> {
  const server = onlyofficeServerUrl();
  const params = {
    async: false,
    filetype: opts.fromExt,
    outputtype: opts.outputType ?? "pdf",
    key: opts.key,
    title: `convert.${opts.fromExt}`,
    url: opts.srcUrl,
  };
  // JWT activé : le corps porte le jeton signant les paramètres.
  const token = signJwt(params, 120);

  const res = await fetch(`${server}/ConvertService.ashx`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...params, token }),
  });
  if (!res.ok) throw new Error(`ConvertService HTTP ${res.status}`);

  const data = (await res.json()) as ConvertResponse;
  if (typeof data.error === "number" && data.error !== 0) {
    throw new Error(`ConvertService erreur ${data.error}`);
  }
  if (!data.endConvert || !data.fileUrl) throw new Error("Conversion incomplète.");

  const fileRes = await fetch(data.fileUrl);
  if (!fileRes.ok) throw new Error(`Téléchargement du fichier converti HTTP ${fileRes.status}`);
  return Buffer.from(await fileRes.arrayBuffer());
}
