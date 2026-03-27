/* ========================================
   NOTE-TYPES.JS - 12 Note Style Editor Engine
   ======================================== */

const NoteTypes = (() => {

  /**
   * Render editor UI for a specific note type
   */
  function renderEditor(container, memo) {
    container.innerHTML = '';
    
    // Meta bar
    const meta = document.createElement('div');
    meta.className = 'editor-meta';
    const typeInfo = MemoManager.getTypeInfo(memo.type);
    meta.innerHTML = `
      <span class="editor-meta-type">${typeInfo.icon} ${typeInfo.name}</span>
      <span class="editor-meta-date">${MemoManager.formatDate(memo.updatedAt)}</span>
    `;
    container.appendChild(meta);

    // Title (common for most types except idea)
    if (memo.type !== 'idea') {
      const titleInput = document.createElement('input');
      titleInput.className = 'editor-title';
      titleInput.type = 'text';
      titleInput.placeholder = 'タイトル';
      titleInput.value = memo.title || '';
      titleInput.oninput = () => { memo.title = titleInput.value; };
      container.appendChild(titleInput);
    }

    // Type-specific content
    const editorDiv = document.createElement('div');
    editorDiv.className = `editor-${memo.type}`;
    container.appendChild(editorDiv);

    switch (memo.type) {
      case 'free': renderFree(editorDiv, memo); break;
      case 'checklist': renderChecklist(editorDiv, memo); break;
      case 'bullet': renderBullet(editorDiv, memo); break;
      case 'photo': renderPhoto(editorDiv, memo); break;
      case 'voice': renderVoice(editorDiv, memo); break;
      case 'idea': renderIdea(editorDiv, memo); break;
      case 'meeting': renderMeeting(editorDiv, memo); break;
      case 'markdown': renderMarkdown(editorDiv, memo); break;
      case 'kanban': renderKanban(editorDiv, memo); break;
      case 'bookmark': renderBookmark(editorDiv, memo); break;
      case 'mindmap': renderMindmap(editorDiv, memo); break;
      case 'journal': renderJournal(editorDiv, memo); break;
    }

    // Toolbar
    renderToolbar(memo);
  }

  // ===== FREE NOTE =====
  function renderFree(div, memo) {
    const richText = document.createElement('div');
    richText.className = 'rich-text';
    richText.contentEditable = 'true';
    richText.innerHTML = memo.content.html || '';
    richText.oninput = () => { memo.content.html = richText.innerHTML; };
    div.appendChild(richText);

    // Image attach area
    renderImageAttachArea(div, memo);
  }

  // ===== CHECKLIST =====
  function renderChecklist(div, memo) {
    const PRIORITY_ICONS = ['', '🔴', '🟡', '🟢'];
    const PRIORITY_LABELS = ['なし', '高', '中', '低'];

    // Progress bar
    const progressWrap = document.createElement('div');
    progressWrap.className = 'cl-progress-wrap';
    div.appendChild(progressWrap);

    function updateProgress() {
      const items = memo.content.items || [];
      const total = items.length;
      const done = items.filter(i => i.checked).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      progressWrap.innerHTML = `
        <div class="cl-progress-header">
          <span class="cl-progress-text">${done}/${total} 完了</span>
          <span class="cl-progress-pct">${pct}%</span>
        </div>
        <div class="cl-progress-bar"><div class="cl-progress-fill" style="width:${pct}%"></div></div>
      `;
    }
    updateProgress();

    // Items container
    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'checklist-items';
    div.appendChild(itemsDiv);

    let dragSrcIdx = null;

    function getOrderedItems() {
      const items = memo.content.items || [];
      if (!memo.content.showCompleted) return items.filter(i => !i.checked);
      // Sort: unchecked first, checked at bottom
      const unchecked = items.filter(i => !i.checked);
      const checked = items.filter(i => i.checked);
      return [...unchecked, ...checked];
    }

    function renderItems() {
      itemsDiv.innerHTML = '';
      const ordered = getOrderedItems();
      let hasCheckedDivider = false;

      ordered.forEach((item, displayIdx) => {
        const realIdx = memo.content.items.indexOf(item);

        // Divider between active and completed
        if (item.checked && !hasCheckedDivider && memo.content.showCompleted) {
          hasCheckedDivider = true;
          const divider = document.createElement('div');
          divider.className = 'cl-completed-divider';
          divider.innerHTML = `<span>完了した項目</span>`;
          itemsDiv.appendChild(divider);
        }

        const row = document.createElement('div');
        row.className = `checklist-item ${item.checked ? 'completed' : ''}`;
        row.setAttribute('data-indent', item.indent || 0);
        row.setAttribute('draggable', 'true');
        row.dataset.realIdx = realIdx;

        // Priority indicator
        const priorityClass = item.priority > 0 ? ` cl-priority-${item.priority}` : '';

        // Due date display
        let dueDateHtml = '';
        if (item.dueDate) {
          const isOverdue = new Date(item.dueDate) < new Date() && !item.checked;
          dueDateHtml = `<span class="cl-due ${isOverdue ? 'overdue' : ''}">${formatShortDate(item.dueDate)}</span>`;
        }

        row.innerHTML = `
          <button class="checklist-check ${item.checked ? 'checked' : ''}${priorityClass}">
            <span class="material-icons-round" style="font-size:16px">${item.checked ? 'check' : ''}</span>
          </button>
          <div class="cl-item-content">
            <div class="cl-item-main">
              ${item.priority > 0 ? `<span class="cl-priority-icon">${PRIORITY_ICONS[item.priority]}</span>` : ''}
              <textarea class="checklist-text" rows="1" placeholder="アイテムを入力…">${item.text}</textarea>
            </div>
            ${dueDateHtml ? `<div class="cl-item-meta">${dueDateHtml}</div>` : ''}
          </div>
          <div class="cl-item-actions">
            <button class="cl-more-btn icon-btn-sm"><span class="material-icons-round" style="font-size:18px">more_vert</span></button>
            <span class="material-icons-round checklist-drag">drag_indicator</span>
          </div>
        `;

        // Check toggle
        row.querySelector('.checklist-check').onclick = () => {
          item.checked = !item.checked;
          renderItems();
          updateProgress();
        };

        // Text input
        const textarea = row.querySelector('.checklist-text');
        textarea.oninput = () => {
          item.text = textarea.value;
          autoResize(textarea);
        };
        textarea.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const newItem = { id: SmartMemoDB.generateId(), text: '', checked: false, priority: 0, dueDate: '', indent: item.indent || 0 };
            memo.content.items.splice(realIdx + 1, 0, newItem);
            renderItems();
            updateProgress();
            // Focus next
            setTimeout(() => {
              const rows = itemsDiv.querySelectorAll('.checklist-item');
              for (const r of rows) {
                if (parseInt(r.dataset.realIdx) === realIdx + 1) {
                  r.querySelector('.checklist-text')?.focus();
                  break;
                }
              }
            }, 50);
          }
          if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
              item.indent = Math.max(0, (item.indent || 0) - 1);
            } else {
              item.indent = Math.min(2, (item.indent || 0) + 1);
            }
            renderItems();
            setTimeout(() => {
              const rows = itemsDiv.querySelectorAll('.checklist-item');
              for (const r of rows) {
                if (parseInt(r.dataset.realIdx) === realIdx) {
                  r.querySelector('.checklist-text')?.focus();
                  break;
                }
              }
            }, 50);
          }
          if (e.key === 'Backspace' && !textarea.value && memo.content.items.length > 1) {
            e.preventDefault();
            memo.content.items.splice(realIdx, 1);
            renderItems();
            updateProgress();
          }
        };

        // More button - popup for priority/date
        row.querySelector('.cl-more-btn').onclick = (e) => {
          e.stopPropagation();
          showItemMenu(row, item, realIdx);
        };

        // Drag events
        row.addEventListener('dragstart', (e) => {
          dragSrcIdx = realIdx;
          row.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => {
          row.classList.remove('drag-over');
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.classList.remove('drag-over');
          const targetIdx = realIdx;
          if (dragSrcIdx !== null && dragSrcIdx !== targetIdx) {
            const [moved] = memo.content.items.splice(dragSrcIdx, 1);
            memo.content.items.splice(targetIdx, 0, moved);
            renderItems();
          }
          dragSrcIdx = null;
        });
        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
          dragSrcIdx = null;
        });

        itemsDiv.appendChild(row);
        autoResize(textarea);
      });
    }
    renderItems();

    // Item context menu
    function showItemMenu(anchorRow, item, idx) {
      // Remove existing menu
      document.querySelector('.cl-item-menu')?.remove();

      const menu = document.createElement('div');
      menu.className = 'cl-item-menu';
      menu.innerHTML = `
        <div class="cl-menu-section">
          <span class="cl-menu-label">優先度</span>
          <div class="cl-priority-picker">
            ${[0,1,2,3].map(p => `<button class="cl-priority-opt ${item.priority === p ? 'active' : ''}" data-p="${p}">${p === 0 ? '⚪' : PRIORITY_ICONS[p]} ${PRIORITY_LABELS[p]}</button>`).join('')}
          </div>
        </div>
        <div class="cl-menu-section">
          <span class="cl-menu-label">期限日</span>
          <input type="date" class="cl-date-input" value="${item.dueDate || ''}">
        </div>
        <div class="cl-menu-section">
          <button class="cl-delete-item-btn">🗑️ 削除</button>
        </div>
      `;

      menu.querySelectorAll('.cl-priority-opt').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          item.priority = parseInt(btn.dataset.p);
          menu.remove();
          renderItems();
        };
      });

      menu.querySelector('.cl-date-input').onchange = (e) => {
        item.dueDate = e.target.value;
        menu.remove();
        renderItems();
      };

      menu.querySelector('.cl-delete-item-btn').onclick = (e) => {
        e.stopPropagation();
        if (memo.content.items.length > 1) {
          memo.content.items.splice(idx, 1);
          menu.remove();
          renderItems();
          updateProgress();
        }
      };

      anchorRow.appendChild(menu);

      // Close on outside click
      const close = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 10);
    }

    // Actions bar
    const actions = document.createElement('div');
    actions.className = 'checklist-actions';
    actions.innerHTML = `
      <button class="checklist-action-btn" id="cl-add-item"><span class="material-icons-round" style="font-size:16px;vertical-align:middle">add</span> 追加</button>
      <button class="checklist-action-btn" id="cl-check-all">全て完了</button>
      <button class="checklist-action-btn" id="cl-uncheck-all">全て未完了</button>
      <button class="checklist-action-btn" id="cl-toggle-completed">
        ${memo.content.showCompleted !== false ? '完了を隠す' : '完了を表示'}
      </button>
      <button class="checklist-action-btn" id="cl-clear">クリア</button>
    `;
    div.appendChild(actions);

    actions.querySelector('#cl-add-item').onclick = () => {
      memo.content.items.push({ id: SmartMemoDB.generateId(), text: '', checked: false, priority: 0, dueDate: '', indent: 0 });
      renderItems();
      updateProgress();
      const lastRow = itemsDiv.lastElementChild;
      if (lastRow) lastRow.querySelector('.checklist-text')?.focus();
    };
    actions.querySelector('#cl-check-all').onclick = () => {
      memo.content.items.forEach(i => i.checked = true);
      renderItems();
      updateProgress();
    };
    actions.querySelector('#cl-uncheck-all').onclick = () => {
      memo.content.items.forEach(i => i.checked = false);
      renderItems();
      updateProgress();
    };
    actions.querySelector('#cl-toggle-completed').onclick = () => {
      memo.content.showCompleted = !(memo.content.showCompleted !== false);
      renderItems();
      actions.querySelector('#cl-toggle-completed').textContent = memo.content.showCompleted ? '完了を隠す' : '完了を表示';
    };
    actions.querySelector('#cl-clear').onclick = () => {
      if (confirm('チェック済みのアイテムを削除しますか？')) {
        memo.content.items = memo.content.items.filter(i => !i.checked);
        if (memo.content.items.length === 0) {
          memo.content.items = [{ id: SmartMemoDB.generateId(), text: '', checked: false, priority: 0, dueDate: '', indent: 0 }];
        }
        renderItems();
        updateProgress();
      }
    };
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d - now;
    const days = Math.ceil(diff / 86400000);
    if (days === 0) return '今日';
    if (days === 1) return '明日';
    if (days < 0) return `${Math.abs(days)}日前`;
    if (days <= 7) return `${days}日後`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ===== BULLET LIST =====
  function renderBullet(div, memo) {
    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'bullet-items';
    div.appendChild(itemsDiv);

    const markers = ['●', '○', '■', '▪'];

    function renderItems() {
      itemsDiv.innerHTML = '';
      const items = memo.content.items || [];
      items.forEach((item, idx) => {
        const indent = item.indent || 0;
        const row = document.createElement('div');
        row.className = 'bullet-item';
        row.setAttribute('data-indent', indent);
        row.innerHTML = `
          <span class="bullet-marker">${markers[Math.min(indent, 3)]}</span>
          <textarea class="bullet-text" rows="1" placeholder="入力…">${item.text}</textarea>
        `;
        const textarea = row.querySelector('.bullet-text');
        textarea.oninput = () => {
          item.text = textarea.value;
          autoResize(textarea);
        };
        textarea.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const newItem = { id: SmartMemoDB.generateId(), text: '', indent };
            memo.content.items.splice(idx + 1, 0, newItem);
            renderItems();
            const nextRow = itemsDiv.children[idx + 1];
            if (nextRow) nextRow.querySelector('.bullet-text').focus();
          }
          if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
              item.indent = Math.max(0, (item.indent || 0) - 1);
            } else {
              item.indent = Math.min(3, (item.indent || 0) + 1);
            }
            renderItems();
            const currentRow = itemsDiv.children[idx];
            if (currentRow) currentRow.querySelector('.bullet-text').focus();
          }
          if (e.key === 'Backspace' && !textarea.value && items.length > 1) {
            e.preventDefault();
            memo.content.items.splice(idx, 1);
            renderItems();
          }
        };
        itemsDiv.appendChild(row);
        autoResize(textarea);
      });
    }
    renderItems();
  }

  // ===== PHOTO MEMO =====
  function renderPhoto(div, memo) {
    const carousel = document.createElement('div');
    carousel.className = 'photo-carousel';
    div.appendChild(carousel);

    async function renderPhotos() {
      carousel.innerHTML = '';
      const photos = memo.content.photos || [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const url = await ImageManager.getImageUrl(p.imageId);
        if (!url) continue;
        const item = document.createElement('div');
        item.className = 'photo-item';
        item.innerHTML = `
          <img src="${url}" alt="写真">
          <button class="photo-delete" data-idx="${i}"><span class="material-icons-round" style="font-size:18px">close</span></button>
        `;
        const caption = document.createElement('input');
        caption.className = 'photo-caption';
        caption.type = 'text';
        caption.placeholder = 'キャプション…';
        caption.value = p.caption || '';
        caption.oninput = () => { p.caption = caption.value; };
        item.appendChild(caption);
        item.querySelector('.photo-delete').onclick = async () => {
          await ImageManager.deleteImage(p.imageId);
          memo.content.photos.splice(i, 1);
          memo.imageIds = memo.imageIds.filter(id => id !== p.imageId);
          renderPhotos();
        };
        carousel.appendChild(item);
      }
      // Add button
      const addBtn = document.createElement('button');
      addBtn.className = 'photo-add-btn';
      addBtn.innerHTML = `<span class="material-icons-round">add_a_photo</span><span>追加</span>`;
      addBtn.onclick = async () => {
        const images = await ImageManager.pickImage();
        for (const img of images) {
          const imgId = await ImageManager.saveImage(img);
          memo.content.photos.push({ imageId: imgId, caption: '' });
          memo.imageIds.push(imgId);
        }
        renderPhotos();
      };
      carousel.appendChild(addBtn);
    }
    renderPhotos();

    // Note text
    const noteArea = document.createElement('textarea');
    noteArea.className = 'voice-text-supplement';
    noteArea.placeholder = 'メモ…';
    noteArea.value = memo.content.note || '';
    noteArea.oninput = () => { memo.content.note = noteArea.value; };
    div.appendChild(noteArea);
  }

  // ===== VOICE MEMO =====
  function renderVoice(div, memo) {
    const recorder = document.createElement('div');
    recorder.className = 'voice-recorder';
    div.appendChild(recorder);

    const waveDiv = document.createElement('div');
    waveDiv.className = 'voice-waveform';
    const canvas = document.createElement('canvas');
    waveDiv.appendChild(canvas);

    const recordBtn = document.createElement('button');
    recordBtn.className = 'record-btn';
    recordBtn.innerHTML = '<span class="material-icons-round" style="font-size:36px">mic</span>';

    let startTime = 0;

    recordBtn.onclick = async () => {
      if (AudioManager.getIsRecording()) {
        const blob = await AudioManager.stopRecording();
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '<span class="material-icons-round" style="font-size:36px">mic</span>';
        if (blob) {
          const duration = (Date.now() - startTime) / 1000;
          const audioId = await AudioManager.saveAudio(blob, duration);
          memo.content.audioId = audioId;
          memo.content.duration = duration;
          memo.audioId = audioId;
          renderPlayer();
        }
      } else {
        startTime = Date.now();
        const started = await AudioManager.startRecording((data, len) => {
          drawWaveform(canvas, data, len);
        });
        if (started) {
          recordBtn.classList.add('recording');
          recordBtn.innerHTML = '<span class="material-icons-round" style="font-size:36px">stop</span>';
        }
      }
    };

    recorder.appendChild(recordBtn);
    recorder.appendChild(waveDiv);

    // Player (if audio exists)
    const playerDiv = document.createElement('div');
    div.appendChild(playerDiv);

    async function renderPlayer() {
      playerDiv.innerHTML = '';
      if (!memo.content.audioId) return;
      const url = await AudioManager.getAudioUrl(memo.content.audioId);
      if (!url) return;
      const audio = new Audio(url);
      const player = document.createElement('div');
      player.className = 'voice-player';
      player.innerHTML = `
        <button class="voice-player-btn"><span class="material-icons-round">play_arrow</span></button>
        <div class="voice-progress"><div class="voice-progress-fill"></div></div>
        <span class="voice-time">${AudioManager.formatTime(memo.content.duration || 0)}</span>
      `;
      const playBtn = player.querySelector('.voice-player-btn');
      const progress = player.querySelector('.voice-progress');
      const progressFill = player.querySelector('.voice-progress-fill');
      const timeDisplay = player.querySelector('.voice-time');
      let playing = false;

      playBtn.onclick = () => {
        if (playing) {
          audio.pause();
          playing = false;
          playBtn.innerHTML = '<span class="material-icons-round">play_arrow</span>';
        } else {
          audio.play();
          playing = true;
          playBtn.innerHTML = '<span class="material-icons-round">pause</span>';
        }
      };
      audio.ontimeupdate = () => {
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = pct + '%';
        timeDisplay.textContent = AudioManager.formatTime(audio.currentTime);
      };
      audio.onended = () => {
        playing = false;
        playBtn.innerHTML = '<span class="material-icons-round">play_arrow</span>';
        progressFill.style.width = '0%';
        timeDisplay.textContent = AudioManager.formatTime(memo.content.duration);
      };
      progress.onclick = (e) => {
        const pct = e.offsetX / progress.offsetWidth;
        audio.currentTime = pct * audio.duration;
      };
      playerDiv.appendChild(player);
    }
    renderPlayer();

    // Text supplement
    const textArea = document.createElement('textarea');
    textArea.className = 'voice-text-supplement';
    textArea.placeholder = 'テキスト補足…';
    textArea.value = memo.content.text || '';
    textArea.oninput = () => { memo.content.text = textArea.value; };
    div.appendChild(textArea);
  }

  // ===== IDEA MEMO =====
  function renderIdea(div, memo) {
    div.innerHTML = `
      <span class="idea-icon">💡</span>
      <textarea class="idea-input" placeholder="閃きを書き留めよう…">${memo.content.text || ''}</textarea>
      <button class="idea-save-btn">保存して戻る</button>
    `;
    const textarea = div.querySelector('.idea-input');
    textarea.oninput = () => {
      memo.content.text = textarea.value;
      memo.title = textarea.value.split('\n')[0].substring(0, 30) || 'アイデア';
    };
    textarea.focus();
    div.querySelector('.idea-save-btn').onclick = () => {
      if (typeof App !== 'undefined') App.saveAndBack();
    };
  }

  // ===== MEETING NOTE =====
  function renderMeeting(div, memo) {
    const fields = [
      { key: 'datetime', icon: '📅', label: '日時', type: 'datetime-local' },
      { key: 'attendees', icon: '👥', label: '参加者', type: 'textarea' },
      { key: 'agenda', icon: '📌', label: '議題', type: 'textarea' },
      { key: 'discussion', icon: '💬', label: '議論内容', type: 'textarea' },
      { key: 'decisions', icon: '✅', label: '決定事項', type: 'textarea' }
    ];

    const fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'meeting-fields';

    fields.forEach(f => {
      const field = document.createElement('div');
      field.className = 'meeting-field';
      field.innerHTML = `
        <div class="meeting-field-header">
          <span class="meeting-field-icon">${f.icon}</span>
          <span class="meeting-field-label">${f.label}</span>
          <span class="material-icons-round meeting-field-toggle">expand_more</span>
        </div>
        <div class="meeting-field-body"></div>
      `;
      const header = field.querySelector('.meeting-field-header');
      header.onclick = () => field.classList.toggle('collapsed');

      const body = field.querySelector('.meeting-field-body');
      if (f.type === 'datetime-local') {
        const input = document.createElement('input');
        input.type = 'datetime-local';
        input.value = memo.content[f.key] || '';
        input.oninput = () => { memo.content[f.key] = input.value; };
        body.appendChild(input);
      } else {
        const textarea = document.createElement('textarea');
        textarea.rows = 3;
        textarea.placeholder = `${f.label}を入力…`;
        textarea.value = memo.content[f.key] || '';
        textarea.oninput = () => {
          memo.content[f.key] = textarea.value;
          autoResize(textarea);
        };
        body.appendChild(textarea);
      }
      fieldsDiv.appendChild(field);
    });

    // TODO section with checklist
    const todoField = document.createElement('div');
    todoField.className = 'meeting-field';
    todoField.innerHTML = `
      <div class="meeting-field-header">
        <span class="meeting-field-icon">📝</span>
        <span class="meeting-field-label">TODO</span>
        <span class="material-icons-round meeting-field-toggle">expand_more</span>
      </div>
      <div class="meeting-field-body" id="meeting-todos"></div>
    `;
    todoField.querySelector('.meeting-field-header').onclick = () => todoField.classList.toggle('collapsed');
    fieldsDiv.appendChild(todoField);
    div.appendChild(fieldsDiv);

    // Render todos
    const todosDiv = todoField.querySelector('#meeting-todos');
    function renderTodos() {
      todosDiv.innerHTML = '';
      (memo.content.todos || []).forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = `checklist-item ${item.checked ? 'completed' : ''}`;
        row.innerHTML = `
          <button class="checklist-check ${item.checked ? 'checked' : ''}">
            <span class="material-icons-round" style="font-size:16px">${item.checked ? 'check' : ''}</span>
          </button>
          <textarea class="checklist-text" rows="1" placeholder="TODOを入力…">${item.text}</textarea>
        `;
        row.querySelector('.checklist-check').onclick = () => { item.checked = !item.checked; renderTodos(); };
        const ta = row.querySelector('.checklist-text');
        ta.oninput = () => { item.text = ta.value; autoResize(ta); };
        ta.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            memo.content.todos.splice(idx + 1, 0, { id: SmartMemoDB.generateId(), text: '', checked: false });
            renderTodos();
          }
        };
        todosDiv.appendChild(row);
        autoResize(ta);
      });
    }
    renderTodos();
  }

  // ===== MARKDOWN =====
  function renderMarkdown(div, memo) {
    const controls = document.createElement('div');
    controls.className = 'md-controls';
    controls.innerHTML = `
      <button class="md-tab active" data-mode="edit">編集</button>
      <button class="md-tab" data-mode="preview">プレビュー</button>
    `;
    div.appendChild(controls);

    const editor = document.createElement('textarea');
    editor.className = 'md-editor';
    editor.value = memo.content.markdown || '';
    editor.placeholder = '# マークダウンで書こう\n\n- リスト\n- **太字**\n- `コード`';
    editor.oninput = () => { memo.content.markdown = editor.value; };
    div.appendChild(editor);

    const preview = document.createElement('div');
    preview.className = 'md-preview';
    preview.style.display = 'none';
    div.appendChild(preview);

    controls.querySelectorAll('.md-tab').forEach(tab => {
      tab.onclick = () => {
        controls.querySelectorAll('.md-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.dataset.mode;
        if (mode === 'edit') {
          editor.style.display = '';
          preview.style.display = 'none';
        } else {
          editor.style.display = 'none';
          preview.style.display = '';
          preview.innerHTML = simpleMarkdown(memo.content.markdown || '');
        }
      };
    });
  }

  // ===== KANBAN =====
  function renderKanban(div, memo) {
    const board = document.createElement('div');
    board.className = 'kanban-board';
    div.appendChild(board);

    function render() {
      board.innerHTML = '';
      (memo.content.columns || []).forEach((col) => {
        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-column';
        colDiv.innerHTML = `
          <div class="kanban-column-header">
            <span class="kanban-column-title">${col.title}</span>
            <span class="kanban-column-count">${col.cards.length}</span>
          </div>
        `;
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'kanban-cards';
        
        col.cards.forEach((card, ci) => {
          const cardEl = document.createElement('div');
          cardEl.className = 'kanban-card';
          cardEl.textContent = card.text;
          cardEl.contentEditable = 'true';
          cardEl.oninput = () => { card.text = cardEl.textContent; };
          cardEl.onkeydown = (e) => {
            if (e.key === 'Backspace' && !cardEl.textContent) {
              e.preventDefault();
              col.cards.splice(ci, 1);
              render();
            }
          };
          cardsDiv.appendChild(cardEl);
        });

        colDiv.appendChild(cardsDiv);

        const addBtn = document.createElement('button');
        addBtn.className = 'kanban-add-btn';
        addBtn.innerHTML = '<span class="material-icons-round" style="font-size:18px">add</span>追加';
        addBtn.onclick = () => {
          col.cards.push({ id: SmartMemoDB.generateId(), text: '新しいタスク' });
          render();
        };
        colDiv.appendChild(addBtn);
        board.appendChild(colDiv);
      });
    }
    render();
  }

  // ===== BOOKMARK =====
  function renderBookmark(div, memo) {
    div.innerHTML = `
      <div class="bookmark-input-row">
        <input type="url" class="bookmark-url-input" placeholder="URLを入力…" value="${memo.content.url || ''}">
        <button class="bookmark-fetch-btn">取得</button>
      </div>
      <div class="bookmark-card-area"></div>
      <textarea class="bookmark-memo" placeholder="ひとことメモ…">${memo.content.memo || ''}</textarea>
    `;

    const urlInput = div.querySelector('.bookmark-url-input');
    const fetchBtn = div.querySelector('.bookmark-fetch-btn');
    const cardArea = div.querySelector('.bookmark-card-area');
    const memoArea = div.querySelector('.bookmark-memo');

    urlInput.oninput = () => { memo.content.url = urlInput.value; };
    memoArea.oninput = () => { memo.content.memo = memoArea.value; };

    fetchBtn.onclick = () => {
      memo.content.url = urlInput.value;
      memo.content.title = memo.content.title || urlInput.value;
      memo.title = memo.title || urlInput.value;
      renderBookmarkCard(cardArea, memo);
    };

    if (memo.content.url) renderBookmarkCard(cardArea, memo);
  }

  function renderBookmarkCard(container, memo) {
    container.innerHTML = `
      <div class="bookmark-preview-card">
        <div class="bookmark-preview-info">
          <input class="bookmark-preview-title" style="width:100%;border:none;background:transparent;color:var(--text-primary);font-size:0.9rem;font-weight:600;outline:none;font-family:inherit" placeholder="タイトル" value="${memo.content.title || ''}">
          <textarea class="bookmark-preview-desc" style="width:100%;border:none;background:transparent;color:var(--text-secondary);font-size:0.78rem;outline:none;resize:none;font-family:inherit" rows="2" placeholder="説明">${memo.content.description || ''}</textarea>
          <a class="bookmark-preview-url" href="${memo.content.url}" target="_blank">${memo.content.url}</a>
        </div>
      </div>
    `;
    container.querySelector('.bookmark-preview-title').oninput = (e) => {
      memo.content.title = e.target.value;
      memo.title = e.target.value;
    };
    container.querySelector('.bookmark-preview-desc').oninput = (e) => {
      memo.content.description = e.target.value;
    };
  }

  // ===== MINDMAP =====
  function renderMindmap(div, memo) {
    const BRANCH_COLORS = ['#7c5cfc','#ef5350','#42a5f5','#66bb6a','#ffa726','#ab47bc','#26c6da','#ec407a','#8d6e63'];

    const container = document.createElement('div');
    container.className = 'mindmap-container';
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    div.appendChild(container);

    // Inline edit input (overlay)
    const editInput = document.createElement('input');
    editInput.className = 'mm-inline-edit';
    editInput.style.display = 'none';
    container.appendChild(editInput);

    const controls = document.createElement('div');
    controls.className = 'mindmap-controls';
    controls.innerHTML = `
      <button class="mindmap-control-btn" id="mm-add"><span class="material-icons-round" style="font-size:18px">add_circle_outline</span>追加</button>
      <button class="mindmap-control-btn mm-delete-btn" id="mm-delete"><span class="material-icons-round" style="font-size:18px">delete_outline</span>削除</button>
      <button class="mindmap-control-btn" id="mm-layout"><span class="material-icons-round" style="font-size:18px">account_tree</span></button>
      <button class="mindmap-control-btn" id="mm-zoom-in"><span class="material-icons-round" style="font-size:18px">zoom_in</span></button>
      <button class="mindmap-control-btn" id="mm-zoom-out"><span class="material-icons-round" style="font-size:18px">zoom_out</span></button>
    `;
    div.appendChild(controls);

    let selectedNodeId = 'root';
    let layoutMode = memo.content.layoutMode || 'radial'; // radial, tree, horizontal
    const LAYOUT_MODES = ['radial', 'tree', 'horizontal'];
    const LAYOUT_LABELS = { radial: '放射状', tree: 'ツリー', horizontal: '横配置' };

    function drawMap() {
      const ctx = canvas.getContext('2d');
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 2;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const nodes = memo.content.nodes || [];
      const zoom = memo.content.zoom || 1;
      const panX = (memo.content.pan?.x || 0);
      const panY = (memo.content.pan?.y || 0);
      const centerX = rect.width / 2 + panX;
      const centerY = rect.height / 2 + panY;

      const root = nodes.find(n => n.id === 'root');
      if (!root) return;

      const rootX = centerX;
      const rootY = centerY;
      root._x = rootX;
      root._y = rootY;

      const children = nodes.filter(n => n.id !== 'root');
      const radius = 130 * zoom;

      // Layout children
      if (layoutMode === 'radial') {
        const angleStep = children.length > 0 ? (2 * Math.PI) / children.length : 0;
        children.forEach((child, i) => {
          const angle = angleStep * i - Math.PI / 2;
          child._x = rootX + Math.cos(angle) * radius;
          child._y = rootY + Math.sin(angle) * radius;
          child._color = BRANCH_COLORS[i % BRANCH_COLORS.length];
        });
      } else if (layoutMode === 'tree') {
        const spacingX = 90 * zoom;
        const startX = rootX - ((children.length - 1) * spacingX) / 2;
        children.forEach((child, i) => {
          child._x = startX + i * spacingX;
          child._y = rootY + 120 * zoom;
          child._color = BRANCH_COLORS[i % BRANCH_COLORS.length];
        });
      } else { // horizontal
        const spacingY = 60 * zoom;
        const startY = rootY - ((children.length - 1) * spacingY) / 2;
        children.forEach((child, i) => {
          child._x = rootX + 160 * zoom;
          child._y = startY + i * spacingY;
          child._color = BRANCH_COLORS[i % BRANCH_COLORS.length];
        });
      }

      // Draw bezier connections
      children.forEach(child => {
        ctx.strokeStyle = child._color || BRANCH_COLORS[0];
        ctx.lineWidth = 2.5 * zoom;
        ctx.beginPath();
        ctx.moveTo(rootX, rootY);
        if (layoutMode === 'horizontal') {
          const cpx = rootX + (child._x - rootX) * 0.5;
          ctx.bezierCurveTo(cpx, rootY, cpx, child._y, child._x, child._y);
        } else if (layoutMode === 'tree') {
          const cpy = rootY + (child._y - rootY) * 0.5;
          ctx.bezierCurveTo(rootX, cpy, child._x, cpy, child._x, child._y);
        } else {
          const midX = (rootX + child._x) / 2;
          const midY = (rootY + child._y) / 2;
          ctx.quadraticCurveTo(midX + (Math.random()-0.5)*10, midY + (Math.random()-0.5)*10, child._x, child._y);
        }
        ctx.stroke();
      });

      // Draw root node
      drawNode(ctx, rootX, rootY, root.text, root.id === selectedNodeId, zoom, '#7c5cfc', true);

      // Draw child nodes
      children.forEach(child => {
        drawNode(ctx, child._x, child._y, child.text, child.id === selectedNodeId, zoom * 0.9, child._color, false);
      });
    }

    function drawNode(ctx, x, y, text, selected, scale, color, isRoot) {
      const fontSize = (isRoot ? 13 : 11.5) * scale;
      ctx.font = `600 ${fontSize}px "Noto Sans JP", sans-serif`;
      const textWidth = ctx.measureText(text.substring(0, 15)).width;
      const w = Math.max(70 * scale, textWidth + 28 * scale);
      const h = (isRoot ? 38 : 32) * scale;
      const r = isRoot ? 14 : 10;

      // Shadow
      ctx.shadowColor = selected ? color : 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = selected ? 12 : 4;
      ctx.shadowOffsetY = 2;

      // Fill
      ctx.fillStyle = selected ? color : (getComputedStyle(document.body).getPropertyValue('--surface-2').trim() || '#2a2a45');
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
      ctx.fill();

      // Color accent bar for non-root
      if (!isRoot && !selected) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, 4, h, [r, 0, 0, r]);
        ctx.fill();
      }

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Text
      ctx.fillStyle = selected ? '#fff' : (getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#e8e8f0');
      ctx.font = `600 ${fontSize}px "Noto Sans JP", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.substring(0, 15), x, y);

      // Store bounds for hit testing
      const node = memo.content.nodes.find(n => n.text === text);
      if (node) { node._w = w; node._h = h; }
    }

    function findNodeAt(px, py) {
      const nodes = memo.content.nodes || [];
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n._x === undefined) continue;
        const w = (n._w || 70) / 2;
        const h = (n._h || 32) / 2;
        if (px >= n._x - w && px <= n._x + w && py >= n._y - h && py <= n._y + h) {
          return n;
        }
      }
      return null;
    }

    // Tap = select
    canvas.onclick = (e) => {
      const r = container.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const node = findNodeAt(x, y);
      if (node) {
        selectedNodeId = node.id;
        drawMap();
      }
    };

    // Double tap = inline edit
    canvas.ondblclick = (e) => {
      const node = memo.content.nodes.find(n => n.id === selectedNodeId);
      if (!node || node._x === undefined) return;

      const r = container.getBoundingClientRect();
      editInput.style.display = 'block';
      editInput.style.left = (node._x - 50) + 'px';
      editInput.style.top = (node._y - 14) + 'px';
      editInput.value = node.text;
      editInput.focus();
      editInput.select();

      const finish = () => {
        if (editInput.value.trim()) {
          node.text = editInput.value.trim();
          if (node.id === 'root') memo.title = node.text;
        }
        editInput.style.display = 'none';
        drawMap();
      };
      editInput.onblur = finish;
      editInput.onkeydown = (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); finish(); }
        if (ke.key === 'Escape') { editInput.style.display = 'none'; }
      };
    };

    // Touch: pan & pinch zoom
    let lastTouchDist = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isPanning = false;

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastTouchDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
      } else if (e.touches.length === 1) {
        const r = container.getBoundingClientRect();
        const tx = e.touches[0].clientX - r.left;
        const ty = e.touches[0].clientY - r.top;
        const hit = findNodeAt(tx, ty);
        if (!hit) {
          isPanning = true;
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }
      }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        const delta = (dist - lastTouchDist) * 0.005;
        memo.content.zoom = Math.max(0.4, Math.min(2.5, (memo.content.zoom || 1) + delta));
        lastTouchDist = dist;
        drawMap();
      } else if (isPanning && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        memo.content.pan = memo.content.pan || { x: 0, y: 0 };
        memo.content.pan.x += dx;
        memo.content.pan.y += dy;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        drawMap();
      }
    }, { passive: false });

    container.addEventListener('touchend', () => { isPanning = false; });

    // Controls
    controls.querySelector('#mm-add').onclick = () => {
      const newNode = {
        id: SmartMemoDB.generateId(),
        text: '新しいノード',
        x: 0, y: 0,
        children: []
      };
      memo.content.nodes.push(newNode);
      selectedNodeId = newNode.id;
      drawMap();
    };

    controls.querySelector('#mm-delete').onclick = () => {
      if (selectedNodeId === 'root') return; // Can't delete root
      const idx = memo.content.nodes.findIndex(n => n.id === selectedNodeId);
      if (idx > -1) {
        memo.content.nodes.splice(idx, 1);
        selectedNodeId = 'root';
        drawMap();
      }
    };

    controls.querySelector('#mm-layout').onclick = () => {
      const currentIdx = LAYOUT_MODES.indexOf(layoutMode);
      layoutMode = LAYOUT_MODES[(currentIdx + 1) % LAYOUT_MODES.length];
      memo.content.layoutMode = layoutMode;
      controls.querySelector('#mm-layout').innerHTML = `<span class="material-icons-round" style="font-size:18px">account_tree</span>${LAYOUT_LABELS[layoutMode]}`;
      drawMap();
    };

    controls.querySelector('#mm-zoom-in').onclick = () => {
      memo.content.zoom = Math.min(2.5, (memo.content.zoom || 1) + 0.2);
      drawMap();
    };
    controls.querySelector('#mm-zoom-out').onclick = () => {
      memo.content.zoom = Math.max(0.4, (memo.content.zoom || 1) - 0.2);
      drawMap();
    };

    // Update layout button label
    controls.querySelector('#mm-layout').innerHTML = `<span class="material-icons-round" style="font-size:18px">account_tree</span>${LAYOUT_LABELS[layoutMode]}`;

    // Initial draw
    setTimeout(drawMap, 100);
    window.addEventListener('resize', drawMap);
  }

  // ===== JOURNAL =====
  function renderJournal(div, memo) {
    const header = document.createElement('div');
    header.className = 'journal-header';
    header.innerHTML = `
      <input type="date" class="journal-date-input" value="${memo.content.date || new Date().toISOString().slice(0, 10)}">
      <div class="journal-mood-selector">
        ${['😊','😃','😐','😔','😢'].map((m, i) =>
          `<button class="mood-btn ${memo.content.mood === i ? 'selected' : ''}" data-mood="${i}">${m}</button>`
        ).join('')}
      </div>
    `;
    div.appendChild(header);

    header.querySelector('.journal-date-input').onchange = (e) => {
      memo.content.date = e.target.value;
    };
    header.querySelectorAll('.mood-btn').forEach(btn => {
      btn.onclick = () => {
        header.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        memo.content.mood = parseInt(btn.dataset.mood);
      };
    });

    const body = document.createElement('div');
    body.className = 'journal-body';
    body.contentEditable = 'true';
    body.innerHTML = memo.content.html || '';
    body.oninput = () => { memo.content.html = body.innerHTML; };
    div.appendChild(body);

    renderImageAttachArea(div, memo);
  }

  // ===== COMMON TOOLBAR =====
  function renderToolbar(memo) {
    let toolbar = document.querySelector('.editor-toolbar');
    if (toolbar) toolbar.remove();

    toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';

    const buttons = [
      { icon: 'palette', action: 'color', title: 'カラー' },
      { icon: 'label', action: 'category', title: 'カテゴリ/タグ' },
      { divider: true },
      { icon: 'image', action: 'attach-image', title: '画像添付' },
      { divider: true },
      { icon: 'push_pin', action: 'pin', title: 'ピン留め', active: memo.pinned },
      { icon: 'delete_outline', action: 'delete', title: '削除' }
    ];

    // Add rich text buttons for free/journal types
    if (memo.type === 'free' || memo.type === 'journal') {
      const richButtons = [
        { icon: 'format_bold', action: 'bold', title: '太字' },
        { icon: 'format_italic', action: 'italic', title: '斜体' },
        { icon: 'format_list_bulleted', action: 'ul', title: '箇条書き' },
        { icon: 'format_list_numbered', action: 'ol', title: '番号リスト' },
        { divider: true }
      ];
      buttons.unshift(...richButtons);
    }

    buttons.forEach(b => {
      if (b.divider) {
        const d = document.createElement('div');
        d.className = 'toolbar-divider';
        toolbar.appendChild(d);
      } else {
        const btn = document.createElement('button');
        btn.className = `toolbar-btn ${b.active ? 'active' : ''}`;
        btn.title = b.title;
        btn.innerHTML = `<span class="material-icons-round" style="font-size:20px">${b.icon}</span>`;
        btn.onclick = () => handleToolbarAction(b.action, memo);
        toolbar.appendChild(btn);
      }
    });
    document.querySelector('.app').appendChild(toolbar);
  }

  function handleToolbarAction(action, memo) {
    switch (action) {
      case 'bold': document.execCommand('bold'); break;
      case 'italic': document.execCommand('italic'); break;
      case 'ul': document.execCommand('insertUnorderedList'); break;
      case 'ol': document.execCommand('insertOrderedList'); break;
      case 'color':
        document.getElementById('color-picker-sheet').classList.add('open');
        break;
      case 'category':
        if (typeof App !== 'undefined') App.openCategorySheet(memo);
        break;
      case 'attach-image':
        handleImageAttach(memo);
        break;
      case 'pin':
        memo.pinned = !memo.pinned;
        renderToolbar(memo);
        break;
      case 'delete':
        if (confirm('このメモを削除しますか？')) {
          if (typeof App !== 'undefined') App.deleteMemo(memo.id);
        }
        break;
    }
  }

  async function handleImageAttach(memo) {
    const images = await ImageManager.pickImage();
    for (const img of images) {
      const imgId = await ImageManager.saveImage(img);
      memo.imageIds.push(imgId);
    }
    // Refresh attach area if visible
    const area = document.querySelector('.image-attach-area');
    if (area) renderImageAttachInner(area, memo);
  }

  // Common image attachment area
  function renderImageAttachArea(parentDiv, memo) {
    const area = document.createElement('div');
    area.className = 'image-attach-area';
    parentDiv.appendChild(area);
    renderImageAttachInner(area, memo);
  }

  async function renderImageAttachInner(area, memo) {
    area.innerHTML = '';
    if (memo.imageIds && memo.imageIds.length > 0) {
      const grid = document.createElement('div');
      grid.className = 'image-attach-grid';
      for (const imgId of memo.imageIds) {
        const url = await ImageManager.getThumbUrl(imgId);
        if (!url) continue;
        const item = document.createElement('div');
        item.className = 'image-attach-item';
        item.innerHTML = `
          <img src="${url}" alt="添付画像">
          <button class="image-remove-btn" data-id="${imgId}">✕</button>
        `;
        item.querySelector('.image-remove-btn').onclick = async () => {
          await ImageManager.deleteImage(imgId);
          memo.imageIds = memo.imageIds.filter(id => id !== imgId);
          renderImageAttachInner(area, memo);
        };
        grid.appendChild(item);
      }
      area.appendChild(grid);
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'image-add-trigger';
    addBtn.innerHTML = '<span class="material-icons-round" style="font-size:20px">add_photo_alternate</span>画像を追加';
    addBtn.onclick = async () => {
      const images = await ImageManager.pickImage();
      for (const img of images) {
        const imgId = await ImageManager.saveImage(img);
        memo.imageIds.push(imgId);
      }
      renderImageAttachInner(area, memo);
    };
    area.appendChild(addBtn);
  }

  // ===== HELPERS =====
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  function drawWaveform(canvas, data, bufferLength) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#7c5cfc';
    ctx.beginPath();
    const sliceWidth = rect.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128.0;
      const y = (v * rect.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();
  }

  // Simple markdown parser (no library needed for basic features)
  function simpleMarkdown(text) {
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n/g, '<br>');
    return html;
  }

  return {
    renderEditor
  };
})();
