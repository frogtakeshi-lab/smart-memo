/* ========================================
   SEARCH.JS - Full-text search
   ======================================== */

const SearchManager = (() => {

  function search(memos, query) {
    if (!query || !query.trim()) return memos;
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/);

    return memos.filter(memo => {
      const searchable = buildSearchText(memo).toLowerCase();
      return terms.every(term => searchable.includes(term));
    }).sort((a, b) => {
      // Prioritize title matches
      const aTitle = (a.title || '').toLowerCase().includes(q) ? 1 : 0;
      const bTitle = (b.title || '').toLowerCase().includes(q) ? 1 : 0;
      return bTitle - aTitle;
    });
  }

  function buildSearchText(memo) {
    const parts = [memo.title || ''];
    const c = memo.content;

    switch (memo.type) {
      case 'free':
      case 'journal':
        parts.push(stripHtml(c.html || ''));
        break;
      case 'checklist':
        (c.items || []).forEach(i => parts.push(i.text));
        break;
      case 'bullet':
        (c.items || []).forEach(i => parts.push(i.text));
        break;
      case 'photo':
        parts.push(c.note || '');
        (c.photos || []).forEach(p => parts.push(p.caption || ''));
        break;
      case 'voice':
        parts.push(c.text || '');
        break;
      case 'idea':
        parts.push(c.text || '');
        break;
      case 'meeting':
        parts.push(c.attendees || '', c.agenda || '', c.discussion || '', c.decisions || '');
        (c.todos || []).forEach(t => parts.push(t.text));
        break;
      case 'markdown':
        parts.push(c.markdown || '');
        break;
      case 'kanban':
        (c.columns || []).forEach(col => col.cards.forEach(card => parts.push(card.text)));
        break;
      case 'bookmark':
        parts.push(c.url || '', c.title || '', c.description || '', c.memo || '');
        break;
      case 'mindmap':
        (c.nodes || []).forEach(n => parts.push(n.text));
        break;
    }

    // Add tags
    if (memo.tags) parts.push(...memo.tags);

    return parts.join(' ');
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  return { search };
})();
