// Enregistrement de fichiers : partage (Drive, mail…) si le téléphone le permet, sinon téléchargement.
// Renvoie 'shared', 'downloaded' ou 'cancelled'.
export async function saveFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  let file = null;
  try { file = new File([blob], filename, { type: mime }); } catch (e) { file = null; }
  if (file && navigator.canShare && navigator.share) {
    let can = false;
    try { can = navigator.canShare({ files: [file] }); } catch (e) { can = false; }
    if (can) {
      try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
      catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        // autre refus du partage : on bascule sur le téléchargement
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return 'downloaded';
}

export function readText(file) {
  if (file.text) return file.text();
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsText(file); });
}
