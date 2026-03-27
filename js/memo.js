/* ========================================
   MEMO.JS - Memo CRUD Operations
   ======================================== */

const MemoManager = (() => {
  const NOTE_TYPE_INFO = {
    free:      { icon: '📝', name: 'フリーノート' },
    checklist: { icon: '☑️', name: 'チェックリスト' },
    bullet:    { icon: '📋', name: '箇条書き' },
    photo:     { icon: '📷', name: 'フォトメモ' },
    voice:     { icon: '🎤', name: 'ボイスメモ' },
    idea:      { icon: '💡', name: 'アイデア' },
    meeting:   { icon: '🏢', name: '会議ノート' },
    markdown:  { icon: '⌨️', name: 'マークダウン' },
    kanban:    { icon: '📊', name: 'カンバン' },
    bookmark:  { icon: '🔗', name: 'ブックマーク' },
    mindmap:   { icon: '🧠', name: 'マインドマップ' },
    journal:   { icon: '📔', name: '日記' }
  };

  /**
   * Create a new memo
   */
  function create(type) {
    const now = new Date().toISOString();
    const memo = {
      id: SmartMemoDB.generateId(),
      type: type || 'free',
      title: '',
      content: getDefaultContent(type),
      category: null,
      tags: [],
      color: 'none',
      pinned: false,
      deleted: false,
      deletedAt: null,
      imageIds: [],
      audioId: null,
      createdAt: now,
      updatedAt: now
    };
    return memo;
  }

  /**
   * Get default content structure based on note type
   */
  function getDefaultContent(type) {
    switch (type) {
      case 'free':
        return { html: '' };
      case 'checklist':
        return { items: [{ id: SmartMemoDB.generateId(), text: '', checked: false }] };
      case 'bullet':
        return { items: [{ id: SmartMemoDB.generateId(), text: '', indent: 0 }] };
      case 'photo':
        return { photos: [], note: '' };
      case 'voice':
        return { audioId: null, text: '', duration: 0 };
      case 'idea':
        return { text: '' };
      case 'meeting':
        return {
          datetime: new Date().toISOString().slice(0, 16),
          attendees: '',
          agenda: '',
          discussion: '',
          decisions: '',
          todos: [{ id: SmartMemoDB.generateId(), text: '', checked: false }]
        };
      case 'markdown':
        return { markdown: '', mode: 'edit' };
      case 'kanban':
        return {
          columns: [
            { id: 'todo', title: 'ToDo', cards: [] },
            { id: 'doing', title: '進行中', cards: [] },
            { id: 'done', title: '完了', cards: [] }
          ]
        };
      case 'bookmark':
        return { url: '', title: '', description: '', thumbnail: '', memo: '' };
      case 'mindmap':
        return {
          nodes: [{ id: 'root', text: 'メインテーマ', x: 0, y: 0, children: [] }],
          zoom: 1,
          pan: { x: 0, y: 0 }
        };
      case 'journal':
        return {
          date: new Date().toISOString().slice(0, 10),
          mood: null,
          html: ''
        };
      default:
        return { html: '' };
    }
  }

  /**
   * Save memo (create or update)
   */
  async function save(memo) {
    memo.updatedAt = new Date().toISOString();
    await SmartMemoDB.put(SmartMemoDB.STORES.MEMOS, memo);
    return memo;
  }

  /**
   * Get all active memos (not deleted)
   */
  async function getAll() {
    const all = await SmartMemoDB.getAll(SmartMemoDB.STORES.MEMOS);
    return all.filter(m => !m.deleted);
  }

  /**
   * Get a single memo
   */
  async function getById(id) {
    return SmartMemoDB.get(SmartMemoDB.STORES.MEMOS, id);
  }

  /**
   * Soft delete a memo (move to trash)
   */
  async function softDelete(id) {
    const memo = await getById(id);
    if (memo) {
      memo.deleted = true;
      memo.deletedAt = new Date().toISOString();
      await save(memo);
    }
    return memo;
  }

  /**
   * Restore memo from trash
   */
  async function restore(id) {
    const memo = await getById(id);
    if (memo) {
      memo.deleted = false;
      memo.deletedAt = null;
      await save(memo);
    }
    return memo;
  }

  /**
   * Permanently delete a memo
   */
  async function permanentDelete(id) {
    const memo = await getById(id);
    if (memo) {
      // Clean up images
      for (const imgId of (memo.imageIds || [])) {
        await SmartMemoDB.remove(SmartMemoDB.STORES.IMAGES, imgId);
      }
      // Clean up audio
      if (memo.audioId) {
        await SmartMemoDB.remove(SmartMemoDB.STORES.AUDIO, memo.audioId);
      }
      await SmartMemoDB.remove(SmartMemoDB.STORES.MEMOS, id);
    }
  }

  /**
   * Get trash items
   */
  async function getTrash() {
    const all = await SmartMemoDB.getAll(SmartMemoDB.STORES.MEMOS);
    return all.filter(m => m.deleted);
  }

  /**
   * Auto-clean trash (30 days)
   */
  async function cleanTrash() {
    const trash = await getTrash();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const memo of trash) {
      if (new Date(memo.deletedAt).getTime() < thirtyDaysAgo) {
        await permanentDelete(memo.id);
      }
    }
  }

  /**
   * Toggle pin
   */
  async function togglePin(id) {
    const memo = await getById(id);
    if (memo) {
      memo.pinned = !memo.pinned;
      await save(memo);
    }
    return memo;
  }

  /**
   * Update color
   */
  async function setColor(id, color) {
    const memo = await getById(id);
    if (memo) {
      memo.color = color;
      await save(memo);
    }
    return memo;
  }

  /**
   * Set category
   */
  async function setCategory(id, categoryId) {
    const memo = await getById(id);
    if (memo) {
      memo.category = categoryId;
      await save(memo);
    }
    return memo;
  }

  /**
   * Set tags
   */
  async function setTags(id, tags) {
    const memo = await getById(id);
    if (memo) {
      memo.tags = tags;
      await save(memo);
    }
    return memo;
  }

  /**
   * Get preview text from content
   */
  function getPreview(memo) {
    const content = memo.content;
    switch (memo.type) {
      case 'free':
      case 'journal':
        return stripHtml(content.html || '').substring(0, 100);
      case 'checklist':
        return (content.items || []).map(i => `${i.checked ? '✓' : '○'} ${i.text}`).join(', ').substring(0, 100);
      case 'bullet':
        return (content.items || []).map(i => i.text).join(', ').substring(0, 100);
      case 'photo':
        return content.note || `写真 ${(content.photos || []).length}枚`;
      case 'voice':
        return content.text || `音声メモ ${formatDuration(content.duration)}`;
      case 'idea':
        return (content.text || '').substring(0, 100);
      case 'meeting':
        return content.agenda || '会議ノート';
      case 'markdown':
        return (content.markdown || '').substring(0, 100);
      case 'kanban':
        const total = content.columns.reduce((a, c) => a + c.cards.length, 0);
        return `${total}件のタスク`;
      case 'bookmark':
        return content.title || content.url || 'ブックマーク';
      case 'mindmap':
        return content.nodes[0]?.text || 'マインドマップ';
      default:
        return '';
    }
  }

  /**
   * Sort memos
   */
  function sort(memos, sortBy = 'updatedAt') {
    const pinned = memos.filter(m => m.pinned);
    const unpinned = memos.filter(m => !m.pinned);

    const sortFn = (a, b) => {
      switch (sortBy) {
        case 'createdAt':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'updatedAt':
        default:
          return new Date(b.updatedAt) - new Date(a.updatedAt);
      }
    };

    pinned.sort(sortFn);
    unpinned.sort(sortFn);
    return [...pinned, ...unpinned];
  }

  /**
   * Filter memos
   */
  function filter(memos, filterType, filterValue) {
    switch (filterType) {
      case 'all':
        return memos;
      case 'uncategorized':
        return memos.filter(m => !m.category);
      case 'pinned':
        return memos.filter(m => m.pinned);
      case 'category':
        return memos.filter(m => m.category === filterValue);
      default:
        if (filterType.startsWith('type-')) {
          const type = filterType.replace('type-', '');
          return memos.filter(m => m.type === type);
        }
        return memos;
    }
  }

  /**
   * Search memos
   */
  function search(memos, query) {
    if (!query) return memos;
    const q = query.toLowerCase();
    return memos.filter(m => {
      const title = (m.title || '').toLowerCase();
      const preview = getPreview(m).toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }

  // Helpers
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'たった今';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
    if (diff < 172800000) return '昨日';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function getTypeInfo(type) {
    return NOTE_TYPE_INFO[type] || NOTE_TYPE_INFO.free;
  }

  return {
    NOTE_TYPE_INFO,
    create,
    save,
    getAll,
    getById,
    softDelete,
    restore,
    permanentDelete,
    getTrash,
    cleanTrash,
    togglePin,
    setColor,
    setCategory,
    setTags,
    getPreview,
    sort,
    filter,
    search,
    formatDate,
    getTypeInfo
  };
})();
