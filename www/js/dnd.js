// 免打扰管理模块
//
// 两种免打扰（互不干扰，独立存储）：
//   1. 定时免打扰 — 每日重复时段 → localStorage eyecare_settings.dndEnabled/dndStart/dndEnd
//   2. 快捷免打扰 — 一次性时间段 → localStorage eyecare_quick_dnd {start, until}
//
// 主界面横幅始终显示「当前正在生效」的免打扰信息。

const QUICK_DND_KEY = 'eyecare_quick_dnd';

function loadQuickDND() {
  try {
    const raw = localStorage.getItem(QUICK_DND_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const start = new Date(data.start);
    const until = new Date(data.until);
    if (!isNaN(start) && !isNaN(until)) return { start, until };
  } catch (e) { /* ignore */ }
  return null;
}

function saveQuickDND(start, until) {
  if (start && until) {
    localStorage.setItem(QUICK_DND_KEY, JSON.stringify({
      start: start.toISOString(),
      until: until.toISOString()
    }));
  } else {
    localStorage.removeItem(QUICK_DND_KEY);
  }
}

// ---- 核心：当前是否在免打扰 ----

function isInDNDPeriod() {
  const now = new Date();

  // 1. 快捷免打扰（有 start 和 until 两个边界）
  const qd = loadQuickDND();
  if (qd) {
    if (now >= qd.start && now < qd.until) return true;
    if (now >= qd.until) {
      // 已完全过期，自动清除
      saveQuickDND(null, null);
    }
  }

  // 2. 定时免打扰
  const s = loadSettings();
  if (!s.dndEnabled) return false;

  const startMin = timeToMinutes(s.dndStart);
  const endMin = timeToMinutes(s.dndEnd);
  const curMin = now.getHours() * 60 + now.getMinutes();

  if (startMin > endMin) {
    return curMin >= startMin || curMin < endMin;
  }
  return curMin >= startMin && curMin < endMin;
}

function timeToMinutes(ts) {
  if (!ts) return 0;
  const [h, m] = ts.split(':').map(Number);
  return h * 60 + (m || 0);
}

// ---- 定时免打扰开关 ----

function toggleDND() {
  const checked = document.getElementById('dnd-master-switch').checked;
  saveSettings({ dndEnabled: checked });
  updateDNDPreview();
  refreshAllDNDUI();
}

function updateDNDPreview() {
  const el = document.getElementById('dnd-preview');
  if (!el) return;
  const s = loadSettings();
  if (s.dndEnabled) {
    el.textContent = '\u{1F6CF} ' + s.dndStart + ' - ' + s.dndEnd + ' 期间自动静音';
  } else {
    el.textContent = '定时免打扰已关闭（时间设置仍保留）';
  }
}

function saveDNDSettings() {
  const startEl = document.getElementById('dnd-start');
  const endEl = document.getElementById('dnd-end');
  if (startEl && endEl) {
    saveSettings({ dndStart: startEl.value, dndEnd: endEl.value });
  }
  updateDNDPreview();
}

// ---- 快捷免打扰 ----

function quickDND(type) {
  const now = new Date();
  let start, until;

  switch (type) {
    case 'tonight': {
      // 今晚 → 从今晚 22:00 到明早 8:00
      start = new Date(now);
      start.setHours(22, 0, 0, 0);
      // 如果现在已经过了 22:00，start 就是现在（已经晚上）
      if (start <= now) start = now;

      until = new Date(now);
      until.setDate(until.getDate() + 1);
      until.setHours(8, 0, 0, 0);
      break;
    }

    case 'nap': {
      // 午休 → 从现在到 13:30
      until = new Date(now);
      until.setHours(13, 30, 0, 0);
      if (until <= now) {
        alert('今日午休时间已过，无需免打扰');
        return;
      }
      start = now;
      break;
    }

    case 'movie': {
      // 观影 → 从现在到 2 小时后
      start = now;
      until = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      break;
    }

    default:
      return;
  }

  if (!until || until <= now) return;

  saveQuickDND(start, until);
  refreshAllDNDUI();
}

function cancelQuickDND() {
  saveQuickDND(null, null);
  refreshAllDNDUI();
}

// ---- UI ----

function refreshAllDNDUI() {
  updateDNDIndicator();
  updateDNDBanner();

  // 如果当前在免打扰时段，取消未触发的系统闹钟
  if (isInDNDPeriod() && typeof Notif !== 'undefined') {
    Notif.cancel();
  }
}

function updateDNDIndicator() {
  const el = document.getElementById('dnd-indicator');
  if (!el) return;
  el.textContent = isInDNDPeriod() ? '\u{1F515}' : '\u{1F514}';
  el.className = isInDNDPeriod() ? 'dnd-on' : 'dnd-off';
}

function updateDNDBanner() {
  const banner = document.getElementById('dnd-active-banner');
  const rangeEl = document.getElementById('dnd-active-range');
  if (!banner || !rangeEl) return;

  const now = new Date();
  const info = getActiveDNDInfo();

  if (info) {
    banner.style.display = 'block';
    let html = info.label;
    if (info.cancelable) {
      html += ' <span style="text-decoration:underline;cursor:pointer;color:#E65100;" onclick="cancelQuickDND()">[取消]</span>';
    }
    rangeEl.innerHTML = html;
  } else {
    banner.style.display = 'none';
  }
}

function getActiveDNDInfo() {
  const now = new Date();

  // 快捷免打扰
  const qd = loadQuickDND();
  if (qd && now >= qd.start && now < qd.until) {
    const untilStr = qd.until.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const isTomorrow = qd.until.toDateString() !== now.toDateString();
    return {
      label: '快捷免打扰 · 到 ' + (isTomorrow ? '明天 ' : '') + untilStr,
      cancelable: true
    };
  }

  // 定时免打扰
  const s = loadSettings();
  if (s.dndEnabled) {
    const startMin = timeToMinutes(s.dndStart);
    const endMin = timeToMinutes(s.dndEnd);
    const curMin = now.getHours() * 60 + now.getMinutes();
    let inRange = false;
    if (startMin > endMin) {
      inRange = curMin >= startMin || curMin < endMin;
    } else {
      inRange = curMin >= startMin && curMin < endMin;
    }
    if (inRange) {
      return {
        label: '定时免打扰 · ' + s.dndStart + ' - ' + s.dndEnd,
        cancelable: false
      };
    }
  }

  return null;
}

// ---- 页面初始化 ----

function initDNDPage() {
  const s = loadSettings();
  document.getElementById('dnd-master-switch').checked = s.dndEnabled;
  document.getElementById('dnd-start').value = s.dndStart;
  document.getElementById('dnd-end').value = s.dndEnd;
  updateDNDPreview();
  updateDNDIndicator();
}
