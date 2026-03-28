/* ========================================
   APP.JS - Main Application Controller
   ======================================== */

const App = (() => {
  let currentView = 'home';
  let currentMemo = null;
  let currentFilter = 'all';
  let currentFilterValue = null;
  let currentSort = 'updatedAt';
  let searchQuery = '';
  let autoSaveTimer = null;

  /**
   * Initialize the app
   */
  async function init() {
    try {
      await SmartMemoDB.init();
      await loadSettings();
      await MemoManager.cleanTrash();
      await refreshList();
      setupEventListeners();
      hideSplash();
    } catch (err) {
      console.error('App init error:', err);
    }
  }

  async function loadSettings() {
    const theme = await SmartMemoDB.getSetting('theme');
    if (theme) {
      document.body.dataset.theme = theme;
      document.getElementById('theme-toggle').checked = theme === 'dark';
    }
    const layout = await SmartMemoDB.getSetting('layout');
    if (layout) UI.setLayout(layout);
  }

  function hideSplash() {
    setTimeout(() => {
      const splash = document.getElementById('splash-screen');
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 500);
    }, 800);
  }

  /**
   * Event Listeners
   */
  function setupEventListeners() {
    // Bottom nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = () => {
        const view = item.dataset.view;
        switchView(view);
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
      };
    });

    // FAB
    document.getElementById('fab').onclick = () => {
      openNoteTypeSheet();
    };

    // Note type selection
    document.querySelectorAll('.note-type-btn').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.type;
        closeSheet('note-type-sheet');
        createNewMemo(type);
      };
    });

    // Back button
    document.getElementById('btn-back').onclick = () => {
      if (currentView === 'editor') {
        saveAndBack();
      } else {
        switchView('settings');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector('.nav-item[data-view="settings"]').classList.add('active');
      }
    };

    // Search
    document.getElementById('btn-search-toggle').onclick = () => {
      const bar = document.getElementById('search-bar');
      bar.classList.toggle('hidden');
      if (!bar.classList.contains('hidden')) {
        document.getElementById('search-input').focus();
      } else {
        searchQuery = '';
        document.getElementById('search-input').value = '';
        refreshList();
      }
    };
    document.getElementById('btn-search-close').onclick = () => {
      document.getElementById('search-bar').classList.add('hidden');
      searchQuery = '';
      document.getElementById('search-input').value = '';
      refreshList();
    };
    document.getElementById('search-input').oninput = (e) => {
      searchQuery = e.target.value;
      refreshList();
    };

    // Layout toggle
    document.getElementById('btn-layout-toggle').onclick = () => {
      UI.cycleLayout();
      SmartMemoDB.setSetting('layout', UI.getCurrentLayout());
      refreshList();
    };

    // More menu
    document.getElementById('btn-more').onclick = (e) => {
      e.stopPropagation();
      const menu = document.getElementById('more-menu');
      menu.classList.toggle('hidden');
    };
    document.querySelectorAll('.menu-item').forEach(item => {
      item.onclick = () => {
        const action = item.dataset.action;
        if (action.startsWith('sort-')) {
          currentSort = action.replace('sort-', '');
          if (currentSort === 'updated') currentSort = 'updatedAt';
          if (currentSort === 'created') currentSort = 'createdAt';
          refreshList();
        }
        document.getElementById('more-menu').classList.add('hidden');
      };
    });

    // Close menu on click outside
    document.addEventListener('click', () => {
      document.getElementById('more-menu').classList.add('hidden');
    });

    // Filter chips
    document.querySelectorAll('.chip[data-filter]').forEach(chip => {
      chip.onclick = () => {
        currentFilter = chip.dataset.filter;
        currentFilterValue = null;
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        refreshList();
      };
    });

    // Theme toggle
    document.getElementById('theme-toggle').onchange = (e) => {
      const theme = e.target.checked ? 'dark' : 'light';
      document.body.dataset.theme = theme;
      SmartMemoDB.setSetting('theme', theme);
    };

    // Default layout select
    document.getElementById('default-layout-select').onchange = (e) => {
      UI.setLayout(e.target.value);
      SmartMemoDB.setSetting('layout', e.target.value);
      refreshList();
    };

    // Sheet overlays
    document.querySelectorAll('.sheet-overlay').forEach(overlay => {
      overlay.onclick = () => {
        const sheet = overlay.closest('.bottom-sheet');
        sheet.classList.remove('open');
      };
    });

    // Color picker
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.onclick = () => {
        const color = dot.dataset.color;
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
        if (currentMemo) {
          currentMemo.color = color;
        }
        closeSheet('color-picker-sheet');
      };
    });

    // Export
    document.getElementById('setting-export').onclick = async () => {
      const data = await SmartMemoDB.exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-memo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.showToast('エクスポートしました');
    };

    // Import
    document.getElementById('setting-import').onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const data = JSON.parse(text);
          await SmartMemoDB.importData(data);
          await refreshList();
          UI.showToast('インポートしました');
        } catch (err) {
          UI.showToast('インポートに失敗しました');
        }
      };
      input.click();
    };

    // Trash
    document.getElementById('setting-trash').onclick = () => {
      switchView('trash');
    };
  }

  /**
   * View switching
   */
  function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');

    // Show/hide elements
    const fab = document.getElementById('fab');
    const filterChips = document.getElementById('filter-chips');
    const backBtn = document.getElementById('btn-back');
    const title = document.getElementById('top-bar-title');
    const searchBtn = document.getElementById('btn-search-toggle');
    const layoutBtn = document.getElementById('btn-layout-toggle');
    const moreBtn = document.getElementById('btn-more');

    if (view === 'home') {
      fab.classList.remove('hidden');
      filterChips.classList.remove('hidden');
      backBtn.classList.add('hidden');
      title.textContent = 'Smart Memo';
      searchBtn.classList.remove('hidden');
      layoutBtn.classList.remove('hidden');
      moreBtn.classList.remove('hidden');
      removeToolbar();
      refreshList();
    } else if (view === 'editor') {
      fab.classList.add('hidden');
      filterChips.classList.add('hidden');
      backBtn.classList.remove('hidden');
      title.textContent = currentMemo ? MemoManager.getTypeInfo(currentMemo.type).name : '編集';
      searchBtn.classList.add('hidden');
      layoutBtn.classList.add('hidden');
      moreBtn.classList.add('hidden');
    } else if (view === 'categories') {
      fab.classList.add('hidden');
      filterChips.classList.add('hidden');
      backBtn.classList.add('hidden');
      title.textContent = 'カテゴリ';
      searchBtn.classList.add('hidden');
      layoutBtn.classList.add('hidden');
      moreBtn.classList.add('hidden');
      removeToolbar();
      renderCategoriesView();
    } else if (view === 'settings') {
      fab.classList.add('hidden');
      filterChips.classList.add('hidden');
      backBtn.classList.add('hidden');
      title.textContent = '設定';
      searchBtn.classList.add('hidden');
      layoutBtn.classList.add('hidden');
      moreBtn.classList.add('hidden');
      removeToolbar();
      updateTrashCount();
    } else if (view === 'trash') {
      fab.classList.add('hidden');
      filterChips.classList.add('hidden');
      backBtn.classList.remove('hidden');
      title.textContent = 'ゴミ箱';
      searchBtn.classList.add('hidden');
      layoutBtn.classList.add('hidden');
      moreBtn.classList.add('hidden');
      removeToolbar();
      renderTrashView();
    }

    // Scroll to top
    document.querySelector('.main-content').scrollTop = 0;
  }

  /**
   * Refresh memo list
   */
  async function refreshList() {
    let memos = await MemoManager.getAll();
    memos = MemoManager.filter(memos, currentFilter, currentFilterValue);
    if (searchQuery) {
      memos = SearchManager.search(memos, searchQuery);
    }
    memos = MemoManager.sort(memos, currentSort);
    await UI.renderMemoList(memos);
  }

  /**
   * Create new memo
   */
  async function createNewMemo(type) {
    const memo = MemoManager.create(type);
    await MemoManager.save(memo);
    currentMemo = memo;
    openEditorView();
  }

  /**
   * Open editor
   */
  async function openEditor(id) {
    const memo = await MemoManager.getById(id);
    if (!memo) return;
    currentMemo = memo;
    openEditorView();
  }

  function startAutoSave() {
    stopAutoSave();
    autoSaveTimer = setInterval(async () => {
      if (currentMemo) {
        await MemoManager.save(currentMemo);
      }
    }, 3000);
  }

  function stopAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  function openEditorView() {
    switchView('editor');
    const container = document.getElementById('editor-container');
    NoteTypes.renderEditor(container, currentMemo);
    startAutoSave();
  }

  /**
   * Save current memo and go back
   */
  async function saveAndBack() {
    stopAutoSave();
    if (currentMemo) {
      // Auto-set title from content if empty
      if (!currentMemo.title) {
        currentMemo.title = generateAutoTitle(currentMemo);
      }
      await MemoManager.save(currentMemo);
      currentMemo = null;
    }
    switchView('home');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-view="home"]').classList.add('active');
  }

  function generateAutoTitle(memo) {
    const preview = MemoManager.getPreview(memo);
    if (preview) return preview.substring(0, 30);
    return MemoManager.getTypeInfo(memo.type).name;
  }

  /**
   * Delete memo
   */
  async function deleteMemo(id) {
    stopAutoSave();
    await MemoManager.softDelete(id);
    currentMemo = null;
    switchView('home');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-view="home"]').classList.add('active');
    UI.showToast('メモを削除しました');
  }

  /**
   * Note type sheet
   */
  function openNoteTypeSheet() {
    document.getElementById('note-type-sheet').classList.add('open');
  }

  /**
   * Category sheet
   */
  async function openCategorySheet(memo) {
    const sheet = document.getElementById('category-sheet');
    const catList = document.getElementById('category-select-list');
    const tagList = document.getElementById('tag-list');

    // Categories
    const categories = await CategoryManager.getAllCategories();
    catList.innerHTML = '';
    const noneBtn = document.createElement('button');
    noneBtn.className = `category-select-item ${!memo.category ? 'selected' : ''}`;
    noneBtn.textContent = '未分類';
    noneBtn.onclick = () => {
      memo.category = null;
      sheet.classList.remove('open');
    };
    catList.appendChild(noneBtn);

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `category-select-item ${memo.category === cat.id ? 'selected' : ''}`;
      btn.textContent = cat.name;
      btn.onclick = () => {
        memo.category = cat.id;
        sheet.classList.remove('open');
      };
      catList.appendChild(btn);
    });

    // New category
    document.getElementById('btn-add-category').onclick = async () => {
      const input = document.getElementById('new-category-input');
      const name = input.value.trim();
      if (!name) return;
      const cat = await CategoryManager.createCategory(name);
      memo.category = cat.id;
      input.value = '';
      sheet.classList.remove('open');
    };

    // Tags
    const tags = await CategoryManager.getAllTags();
    tagList.innerHTML = '';
    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = `tag-item ${memo.tags.includes(tag.id) ? 'selected' : ''}`;
      btn.textContent = `#${tag.name}`;
      btn.onclick = () => {
        if (memo.tags.includes(tag.id)) {
          memo.tags = memo.tags.filter(t => t !== tag.id);
        } else {
          memo.tags.push(tag.id);
        }
        btn.classList.toggle('selected');
      };
      tagList.appendChild(btn);
    });

    // New tag
    document.getElementById('btn-add-tag').onclick = async () => {
      const input = document.getElementById('new-tag-input');
      const name = input.value.trim();
      if (!name) return;
      const tag = await CategoryManager.createTag(name);
      memo.tags.push(tag.id);
      input.value = '';
      openCategorySheet(memo); // Refresh
    };

    sheet.classList.add('open');
  }

  /**
   * Categories view
   */
  async function renderCategoriesView() {
    const container = document.getElementById('category-list');
    container.innerHTML = '';

    const categories = await CategoryManager.getAllCategories();
    const allMemos = await MemoManager.getAll();

    // Uncategorized count
    const uncatCount = allMemos.filter(m => !m.category).length;
    const uncatItem = createCategoryItem('未分類', uncatCount, null, () => {
      currentFilter = 'uncategorized';
      switchView('home');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelector('.nav-item[data-view="home"]').classList.add('active');
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      document.querySelector('.chip[data-filter="uncategorized"]')?.classList.add('active');
    });
    container.appendChild(uncatItem);

    for (const cat of categories) {
      const count = allMemos.filter(m => m.category === cat.id).length;
      const item = createCategoryItem(cat.name, count, cat.id, () => {
        currentFilter = 'category';
        currentFilterValue = cat.id;
        switchView('home');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector('.nav-item[data-view="home"]').classList.add('active');
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      });
      container.appendChild(item);
    }

    // Add category button
    const addRow = document.createElement('div');
    addRow.className = 'add-category-row';
    addRow.style.padding = '16px 0';
    addRow.innerHTML = `
      <input type="text" class="sheet-input" placeholder="新しいカテゴリ…" id="cat-view-input">
      <button class="btn-accent-sm" id="cat-view-add">追加</button>
    `;
    container.appendChild(addRow);
    addRow.querySelector('#cat-view-add').onclick = async () => {
      const input = addRow.querySelector('#cat-view-input');
      const name = input.value.trim();
      if (!name) return;
      await CategoryManager.createCategory(name);
      input.value = '';
      renderCategoriesView();
    };
  }

  function createCategoryItem(name, count, id, onClick) {
    const item = document.createElement('div');
    item.className = 'settings-item';
    item.innerHTML = `
      <span class="material-icons-round">folder</span>
      <span class="settings-label">${name}</span>
      <span class="settings-badge">${count}</span>
      <span class="material-icons-round settings-arrow">chevron_right</span>
    `;
    item.onclick = onClick;
    return item;
  }

  function closeSheet(id) {
    document.getElementById(id).classList.remove('open');
  }

  function removeToolbar() {
    const toolbar = document.querySelector('.editor-toolbar');
    if (toolbar) toolbar.remove();
  }

  async function renderTrashView() {
    const list = document.getElementById('trash-list');
    const emptyState = document.getElementById('trash-empty-state');
    const footer = document.getElementById('trash-footer');
    list.innerHTML = '';

    const trash = await MemoManager.getTrash();
    trash.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    if (trash.length === 0) {
      emptyState.classList.remove('hidden');
      footer.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    footer.classList.remove('hidden');

    for (const memo of trash) {
      const typeInfo = MemoManager.getTypeInfo(memo.type);
      const preview = MemoManager.getPreview(memo);
      const deletedDate = MemoManager.formatDate(memo.deletedAt);
      const title = memo.title || typeInfo.name;

      const item = document.createElement('div');
      item.className = 'trash-card';
      item.innerHTML = `
        <div class="trash-card-info">
          <div class="trash-card-header">
            <span class="memo-type-icon"></span>
            <span class="memo-title"></span>
          </div>
          <p class="memo-preview"></p>
          <span class="trash-card-date"></span>
        </div>
        <div class="trash-card-actions">
          <button class="btn-restore" aria-label="復元">
            <span class="material-icons-round">restore</span>
          </button>
          <button class="btn-perm-delete" aria-label="完全削除">
            <span class="material-icons-round">delete_forever</span>
          </button>
        </div>
      `;
      item.querySelector('.memo-type-icon').textContent = typeInfo.icon;
      item.querySelector('.memo-title').textContent = title;
      item.querySelector('.memo-preview').textContent = preview;
      item.querySelector('.trash-card-date').textContent = `削除: ${deletedDate}`;

      item.querySelector('.btn-restore').onclick = async () => {
        await MemoManager.restore(memo.id);
        updateTrashCount();
        renderTrashView();
        UI.showToast('メモを復元しました');
      };
      item.querySelector('.btn-perm-delete').onclick = async () => {
        await MemoManager.permanentDelete(memo.id);
        updateTrashCount();
        renderTrashView();
        UI.showToast('完全に削除しました');
      };

      list.appendChild(item);
    }

    document.getElementById('btn-empty-trash').onclick = async () => {
      if (confirm(`${trash.length}件のメモを完全に削除しますか？`)) {
        for (const memo of trash) {
          await MemoManager.permanentDelete(memo.id);
        }
        updateTrashCount();
        renderTrashView();
        UI.showToast('ゴミ箱を空にしました');
      }
    };
  }

  async function updateTrashCount() {
    const trash = await MemoManager.getTrash();
    const badge = document.getElementById('trash-count');
    if (badge) badge.textContent = trash.length;
  }

  return {
    init,
    refreshList,
    openEditor,
    saveAndBack,
    deleteMemo,
    openCategorySheet
  };
})();

// Start the app
document.addEventListener('DOMContentLoaded', App.init);
