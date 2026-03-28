/* ========================================
   REMINDER.JS - Due-date notification manager
   ======================================== */

const ReminderManager = (() => {
  const SETTING_ENABLED = 'reminders_enabled';
  const SETTING_NOTIFIED = 'reminders_notified';
  const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  const MAX_NOTIFICATIONS_PER_CHECK = 5;

  let checkInterval = null;

  /**
   * Initialize: start checking if previously enabled
   */
  async function init() {
    if (!('Notification' in window)) return;
    const enabled = await SmartMemoDB.getSetting(SETTING_ENABLED);
    if (enabled && Notification.permission === 'granted') {
      startChecking();
    }
  }

  /**
   * Enable reminders: request permission then start
   */
  async function enable() {
    if (!('Notification' in window)) return false;
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission === 'granted') {
      await SmartMemoDB.setSetting(SETTING_ENABLED, true);
      startChecking();
      return true;
    }
    await SmartMemoDB.setSetting(SETTING_ENABLED, false);
    return false;
  }

  /**
   * Disable reminders
   */
  async function disable() {
    await SmartMemoDB.setSetting(SETTING_ENABLED, false);
    stopChecking();
  }

  function startChecking() {
    stopChecking();
    check();
    checkInterval = setInterval(check, CHECK_INTERVAL_MS);
  }

  function stopChecking() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  /**
   * Check all checklist memos for due items and fire notifications
   */
  async function check() {
    if (Notification.permission !== 'granted') return;

    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 2);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // Load notified set
    const raw = await SmartMemoDB.getSetting(SETTING_NOTIFIED);
    const notified = new Set(raw ? JSON.parse(raw) : []);

    const memos = await MemoManager.getAll();
    let count = 0;

    for (const memo of memos) {
      if (memo.type !== 'checklist') continue;
      const items = memo.content.items || [];
      const memoTitle = memo.title || 'チェックリスト';

      for (const item of items) {
        if (!item.dueDate || item.checked) continue;
        if (item.dueDate > today) continue; // Future

        const key = `${item.id}:${today}`;
        if (notified.has(key)) continue;

        const isOverdue = item.dueDate < today;
        const body = isOverdue
          ? `「${item.text}」の期限が過ぎています`
          : `「${item.text}」の期限は今日です`;

        new Notification(`📋 ${memoTitle}`, {
          body,
          icon: 'icons/icon-192.png',
          tag: key
        });

        notified.add(key);
        count++;
        if (count >= MAX_NOTIFICATIONS_PER_CHECK) break;
      }
      if (count >= MAX_NOTIFICATIONS_PER_CHECK) break;
    }

    if (count > 0) {
      // Persist, pruning old entries
      const filtered = [...notified].filter(k => {
        const parts = k.split(':');
        return parts[parts.length - 1] >= cutoffStr;
      });
      await SmartMemoDB.setSetting(SETTING_NOTIFIED, JSON.stringify(filtered));
    }
  }

  async function isEnabled() {
    return !!(await SmartMemoDB.getSetting(SETTING_ENABLED));
  }

  return { init, enable, disable, check, isEnabled };
})();
