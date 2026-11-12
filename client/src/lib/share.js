// Sending documents: WhatsApp (wa.me link built by the server), native share sheet, copy link.
export function openWhatsApp(link) {
  window.open(link, '_blank', 'noopener');
}

export async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; } catch { /* cancelled */ }
  }
  return copyText(url || text);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}
