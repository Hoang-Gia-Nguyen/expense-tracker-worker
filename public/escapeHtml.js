export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function safeColor(value, fallback = '#808080') {
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(String(value)) ? value : fallback;
}
