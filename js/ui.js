/* ========================================
   UI.JS - UI operations & rendering
   ======================================== */

const UI = (() => {
  let currentLayout = 'card';

  function setLayout(layout) {
    currentLayout = layout;
    const list = document.getElementById('memo-list');
    list.className = `memo-list layout-${layout}`;
    // Update layout button icon
    const btn = document.getElementById('btn-layout-toggle');
    const icons = { card: 'view_agenda', grid: 'grid_view', list: 'view_list' };
    btn.querySelector('.material-icons-round').textContent = icons[layout] || 'grid_view';
  }

  function cycleLayout() {
    const order = ['card', 'grid', 'list'];
    const idx = order.indexOf(currentLayout);
    setLayout(order[(idx + 1) % order.length]);
  }

  async function renderMemoList(memos) {
    const list = document.getElementById('memo-list');
    const empty = document.getElementById('empty-state');
    list.innerHTML = '';

    if (memos.length === 0) {
      empty.classList.remove('hidden');
      list.style.display = 'none';
      return;
    }

    empty.classList.add('hidden');
    list.style.display = '';

    const allTags = await CategoryManager.getAllTags();
    const tagMap = new Map(allTags.map(t => [t.id, t.name]));

    for (const memo of memos) {
      const card = await createMemoCard(memo, tagMap);
      list.appendChild(card);
    }
  }

  async function createMemoCard(memo, tagMap = new Map()) {
    const card = document.createElement('div');
    card.className = 'memo-card';
    card.dataset.id = memo.id;
    if (memo.color && memo.color !== 'none') {
      card.dataset.color = memo.color;
    }

    const typeInfo = MemoManager.getTypeInfo(memo.type);
    const preview = MemoManager.getPreview(memo);
    const date = MemoManager.formatDate(memo.updatedAt);
    const title = memo.title || typeInfo.name;

    // Thumbnail for photo/journal types
    let thumbHtml = '';
    if ((memo.type === 'photo' && memo.content.photos?.length > 0) ||
        (memo.imageIds && memo.imageIds.length > 0)) {
      const imgId = memo.type === 'photo'
        ? memo.content.photos[0]?.imageId
        : memo.imageIds[0];
      if (imgId) {
        const thumbUrl = await ImageManager.getThumbUrl(imgId);
        if (thumbUrl) thumbHtml = `<img class="memo-thumb" src="${thumbUrl}" alt="">`;
      }
    }

    card.innerHTML = `
      ${thumbHtml}
      <div class="memo-card-header">
        <span class="memo-type-icon">${typeInfo.icon}</span>
        <span class="memo-title">${escHtml(title)}</span>
        ${memo.pinned ? '<span class="material-icons-round memo-pin-icon">push_pin</span>' : ''}
      </div>
      <p class="memo-preview">${escHtml(preview)}</p>
      <div class="memo-card-footer">
        <span class="memo-date">${date}</span>
      </div>
    `;

    // Tags
    if (memo.tags && memo.tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'memo-tags';
      memo.tags.forEach(tagId => {
        const tagEl = document.createElement('span');
        tagEl.className = 'memo-tag';
        tagEl.textContent = `#${tagMap.get(tagId) || tagId}`;
        tagsDiv.appendChild(tagEl);
      });
      card.insertBefore(tagsDiv, card.querySelector('.memo-card-footer'));
    }

    // Click to open
    card.onclick = () => {
      if (typeof App !== 'undefined') App.openEditor(memo.id);
    };

    // Swipe support
    setupSwipe(card, memo);

    return card;
  }

  function setupSwipe(card, memo) {
    let startX = 0, currentX = 0, swiping = false;

    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      swiping = true;
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!swiping) return;
      currentX = e.touches[0].clientX;
      const diff = currentX - startX;
      if (Math.abs(diff) > 10) {
        card.style.transform = `translateX(${diff * 0.5}px)`;
        card.style.transition = 'none';
      }
    }, { passive: true });

    card.addEventListener('touchend', async () => {
      if (!swiping) return;
      swiping = false;
      const diff = currentX - startX;
      card.style.transition = 'transform 0.3s ease';
      card.style.transform = '';

      if (diff < -80) {
        // Swipe left - delete
        await MemoManager.softDelete(memo.id);
        showToast('メモを削除しました', '元に戻す', async () => {
          await MemoManager.restore(memo.id);
          if (typeof App !== 'undefined') App.refreshList();
        });
        if (typeof App !== 'undefined') App.refreshList();
      } else if (diff > 80) {
        // Swipe right - pin
        await MemoManager.togglePin(memo.id);
        showToast(memo.pinned ? 'ピン留めを解除' : 'ピン留めしました');
        if (typeof App !== 'undefined') App.refreshList();
      }
    });
  }

  function showToast(message, actionText, actionFn) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    const actionBtn = document.getElementById('toast-action');

    msgEl.textContent = message;
    if (actionText && actionFn) {
      actionBtn.textContent = actionText;
      actionBtn.classList.remove('hidden');
      actionBtn.onclick = () => {
        actionFn();
        toast.classList.add('hidden');
      };
    } else {
      actionBtn.classList.add('hidden');
    }

    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    setLayout,
    cycleLayout,
    renderMemoList,
    showToast,
    getCurrentLayout: () => currentLayout
  };
})();
