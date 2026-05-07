// 主入口模块
let currentPage = 'page-main';

function openPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
    currentPage = pageId;
  }

  if (pageId === 'page-dnd') {
    initDNDPage();
  } else if (pageId === 'page-settings') {
    initSettingsPage();
  } else if (pageId === 'page-main') {
    refreshMainPage();
  }
}

function initSettingsPage() {
  const s = loadSettings();

  selectStartupMode(s.startupMode);
  if (s.startupMode === 'scheduled') {
    document.getElementById('daily-startup-time').value = s.dailyStartupTime;
  }

  selectAlertMode(s.alertMode);

  document.getElementById('vibrate-count').value = s.vibrateCount;

  applyAutoRestartUI(s.autoRestart, s.restDuration);
}

function toggleAutoRestart() {
  const checked = document.getElementById('auto-restart-switch').checked;
  const duration = parseInt(document.getElementById('rest-duration').value) || 20;
  saveSettings({ autoRestart: checked, restDuration: duration });
  applyAutoRestartUI(checked, duration);
}

function saveAutoRestartSettings() {
  const duration = parseInt(document.getElementById('rest-duration').value) || 20;
  const clamped = Math.max(10, Math.min(120, duration));
  document.getElementById('rest-duration').value = clamped;
  document.getElementById('hint-duration').textContent = clamped;
  saveSettings({ restDuration: clamped });
}

function applyAutoRestartUI(enabled, duration) {
  document.getElementById('auto-restart-switch').checked = enabled;
  document.getElementById('rest-duration-row').style.display = enabled ? 'flex' : 'none';
  document.getElementById('auto-restart-hint').style.display = enabled ? 'block' : 'none';
  document.getElementById('rest-duration').value = duration;
  document.getElementById('hint-duration').textContent = duration;
}

function updateDNDBanner() {
  const banner = document.getElementById('dnd-active-banner');
  const rangeEl = document.getElementById('dnd-active-range');
  if (!banner || !rangeEl) return;
  if (isInDNDPeriod()) {
    const s = loadSettings();
    banner.style.display = 'block';
    rangeEl.textContent = s.dndStart + ' - ' + s.dndEnd;
  } else {
    banner.style.display = 'none';
  }
}

function selectStartupMode(mode) {
  const scheduled = document.getElementById('startup-scheduled-label');
  const detect = document.getElementById('startup-detect-label');
  const timeRow = document.getElementById('startup-time-row');

  if (scheduled) scheduled.classList.toggle('active', mode === 'scheduled');
  if (detect) detect.classList.toggle('active', mode === 'detect');
  if (timeRow) timeRow.style.display = mode === 'scheduled' ? 'flex' : 'none';

  saveSettings({ startupMode: mode });

  // 更新系统级每日启动闹钟
  if (mode === 'scheduled') {
    const s = loadSettings();
    const [h, m] = (s.dailyStartupTime || '09:00').split(':').map(Number);
    Notif.scheduleDailyStartup(h, m);
  } else {
    Notif.cancelDailyStartup();
  }
}

function selectAlertMode(mode) {
  const labels = {
    vibrate: 'alert-vibrate-label',
    sound: 'alert-sound-label',
    both: 'alert-both-label',
  };

  Object.entries(labels).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', key === mode);
  });

  const vRow = document.getElementById('vibrate-count-row');
  if (vRow) vRow.style.display = mode === 'sound' ? 'none' : 'flex';

  saveSettings({ alertMode: mode });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const s = loadSettings();

  // 检查今日是否已激活
  const today = new Date().toLocaleDateString('zh-CN');
  if (s.todayDate !== today) {
    s.activeToday = false;
    s.todayDate = today;
    saveSettings(s);
  }

  // 显示初始界面
  updateStatBadge(getTodayCount());
  showTip();

  // 高亮当前预设
  document.querySelectorAll('.preset-card').forEach(c => {
    if (parseInt(c.dataset.minutes) === s.selectedMinutes) {
      c.classList.add('active');
    }
  });

  // 初始化计时器
  resetTimer(s.selectedMinutes);

  // 初始化指示器
  updateDNDIndicator();
  updateDNDBanner();

  // 请求通知权限（Android 13+ 运行时权限）
  requestNotificationPermission();
  requestNativeNotificationPermission();

  // Capacitor 通知监听（系统级闹钟点击回调）
  setupNotificationListeners();

  // App 前后台切换处理
  setupAppResumeHandler();

  // 启动翻转检测
  setupFlipDetection();

  // 每日启动提醒（系统级重复闹钟）
  if (s.startupMode === 'scheduled') {
    const [h, m] = (s.dailyStartupTime || '09:00').split(':').map(Number);
    Notif.scheduleDailyStartup(h, m);
  }

  // 检查每日启动
  checkDailyStartup();

  // 定时检查（每15秒刷新DND状态，每60秒检查每日启动）
  setInterval(() => {
    updateDNDBanner();
    updateDNDIndicator();
  }, 15000);
  setInterval(() => {
    checkDailyStartup();
  }, 60000);
});

function checkDailyStartup() {
  const s = loadSettings();
  const today = new Date().toLocaleDateString('zh-CN');

  if (s.todayDate !== today) {
    s.activeToday = false;
    s.todayDate = today;
    saveSettings(s);
  }

  if (s.activeToday) return;

  if (s.startupMode === 'scheduled') {
    const now = new Date();
    const target = timeToMinutes(s.dailyStartupTime);
    const current = now.getHours() * 60 + now.getMinutes();

    if (Math.abs(current - target) <= 5) {
      sendStartupNotification('scheduled');
    }
  } else if (s.startupMode === 'detect') {
    if (document.visibilityState === 'visible') {
      if (!window._startupDetectTimer) {
        window._startupDetectTimer = setTimeout(() => {
          if (document.visibilityState === 'visible') {
            sendStartupNotification('detect');
          }
          window._startupDetectTimer = null;
        }, 60000);
      }
    }
  }
}

function sendStartupNotification(mode) {
  const s = loadSettings();
  if (s.activeToday) return;

  const body = mode === 'scheduled'
    ? '新的一天，点击启动护眼计划'
    : '检测到你在用手机，需要启动护眼吗？';

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification('护眼小卫士', {
        body: body,
        tag: 'eyecare-startup',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🌿</text></svg>',
        data: { type: 'startup' },
      });

      n.onclick = () => {
        window.focus();
        activateToday();
      };
    } catch (e) { /* ignore */ }
  }

  const now = Date.now();
  if (window._lastStartupNotify && now - window._lastStartupNotify < 600000) return;
  window._lastStartupNotify = now;
}

function activateToday() {
  saveSettings({ activeToday: true, todayDate: new Date().toLocaleDateString('zh-CN') });
  if (timerState === 'idle') {
    startTimer();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateStatBadge(getTodayCount());
    checkDailyStartup();
    if (typeof syncTimerFromBackground === 'function') syncTimerFromBackground();
  }
});

navigator.serviceWorker?.addEventListener('message', (event) => {
  if (event.data === 'activate') {
    activateToday();
  }
});
