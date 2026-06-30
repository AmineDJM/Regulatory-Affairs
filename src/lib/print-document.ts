/**
 * Impression d'un document de la plateforme. Charge l'aperçu **même-origine**
 * (`/api/documents/[id]`) dans un iframe caché et déclenche l'impression — fiable
 * pour PDF et images. Repli : ouverture dans un nouvel onglet si l'iframe ne peut
 * pas être imprimé (type non affichable). À appeler depuis un gestionnaire client.
 */
export function printDocument(id: string) {
  const url = `/api/documents/${id}`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };
  document.body.appendChild(frame);
  window.setTimeout(() => {
    try { document.body.removeChild(frame); } catch { /* déjà retiré */ }
  }, 60000);
}
