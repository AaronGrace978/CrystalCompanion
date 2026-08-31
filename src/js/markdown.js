(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inline(s) {
    let t = escapeHtml(s);
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    t = t.replace(/_([^_]+)_/g, '<em>$1</em>');
    return t;
  }

  function renderMarkdown(md) {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inList = false;

    function closeList() {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
    }

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        closeList();
        continue;
      }
      if (/^###\s+/.test(line)) {
        closeList();
        out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`);
      } else if (/^##\s+/.test(line)) {
        closeList();
        out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`);
      } else if (/^#\s+/.test(line)) {
        closeList();
        out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`);
      } else if (/^[-*]\s+/.test(line)) {
        if (!inList) {
          out.push('<ul>');
          inList = true;
        }
        out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      } else {
        closeList();
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    closeList();
    return out.join('\n');
  }

  /** Lightweight glow formatting for chat bubbles */
  function formatChat(text) {
    let t = escapeHtml(text);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/^### (.+)$/gm, '<strong>$1</strong>');
    t = t.replace(/^## (.+)$/gm, '<strong>$1</strong>');
    t = t.replace(/^# (.+)$/gm, '<strong>$1</strong>');
    t = t.replace(/^- (.+)$/gm, '• $1');
    return t;
  }

  window.CrystalMD = { renderMarkdown, formatChat, escapeHtml };
})();
