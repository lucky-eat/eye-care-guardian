// 计时器模块
let timerInterval = null;
let timerSeconds = 0;
let timerTotal = 0;
let timerState = 'idle'; // 'idle' | 'running' | 'paused'
let timerStartTime = null;  // Date, when the current run started

const circumference = 2 * Math.PI * 90; // ~565.49

function selectPreset(minutes, el) {
  if (timerState === 'running') {
    if (!confirm('计时器正在运行，切换预设将重置计时，确定吗？')) return;
  }

  document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');

  saveSettings({ selectedMinutes: minutes });
  resetTimer(minutes);
}

function openCustomDialog() {
  const s = loadSettings();
  document.getElementById('custom-minutes').value = s.selectedMinutes;
  document.getElementById('custom-dialog-overlay').classList.add('show');
}

function closeCustomDialog() {
  document.getElementById('custom-dialog-overlay').classList.remove('show');
}

function adjustCustomMinutes(delta) {
  const input = document.getElementById('custom-minutes');
  let v = parseInt(input.value) || 25;
  v = Math.max(1, Math.min(120, v + delta));
  input.value = v;
}

function confirmCustomTimer() {
  const minutes = parseInt(document.getElementById('custom-minutes').value) || 25;
  const clamped = Math.max(1, Math.min(120, minutes));
  closeCustomDialog();

  document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  saveSettings({ selectedMinutes: clamped });
  resetTimer(clamped);
}

function resetTimer(minutes) {
  stopTimer();
  timerSeconds = minutes * 60;
  timerTotal = timerSeconds;
  timerState = 'idle';
  updateTimerDisplay();
  updateRing(1);
  setTimerStatus('就绪，点击开始', '');
  bindControlButton();
  const restBtn = document.getElementById('btn-rest');
  if (restBtn) restBtn.disabled = true;
}

function startTimer() {
  if (timerState === 'running') return;

  // 自动激活今日护眼
  const s = loadSettings();
  const today = new Date().toLocaleDateString('zh-CN');
  if (!s.activeToday || s.todayDate !== today) {
    s.activeToday = true;
    s.todayDate = today;
    saveSettings(s);
  }

  if (timerSeconds <= 0) {
    timerSeconds = timerTotal;
  }

  timerState = 'running';
  timerStartTime = new Date();
  setTimerStatus('计时中', 'running');
  bindControlButton();
  const restBtn = document.getElementById('btn-rest');
  if (restBtn) restBtn.disabled = false;

  // 系统级闹钟（锁屏/后台也能触发，传入提醒设置）
  Notif.schedule(timerSeconds,
    '护眼小卫士',
    '该休息一下眼睛了！已连续看屏幕 ' + (timerTotal / 60) + ' 分钟',
    s.alertMode,
    s.vibrateCount);

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    updateRing(timerSeconds / timerTotal);

    if (timerSeconds <= 0) {
      stopTimer();
      if (document.visibilityState === 'visible') {
        showAlert();
      }
      setTimerStatus('时间到！', '');
      bindControlButton();
      const rb = document.getElementById('btn-rest');
      if (rb) rb.disabled = false;
    }
  }, 1000);
}

function pauseTimer() {
  if (timerState !== 'running') return;
  timerState = 'paused';
  clearInterval(timerInterval);
  timerInterval = null;
  Notif.cancel();
  setTimerStatus('已暂停', 'paused');
  bindControlButton();
}

function resumeTimer() {
  if (timerState !== 'paused') return;
  timerState = 'running';
  setTimerStatus('计时中', 'running');
  bindControlButton();

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    updateRing(timerSeconds / timerTotal);

    if (timerSeconds <= 0) {
      stopTimer();
      showAlert();
      setTimerStatus('时间到！', '');
      bindControlButton();
      const rb = document.getElementById('btn-rest');
      if (rb) rb.disabled = false;
    }
  }, 1000);
}

function stopTimer() {
  timerState = 'idle';
  clearInterval(timerInterval);
  timerInterval = null;
  Notif.cancel(); // 取消系统级闹钟
}

function bindControlButton() {
  const btn = document.getElementById('btn-pause');
  if (!btn) return;
  btn.disabled = false;

  if (timerState === 'idle') {
    btn.textContent = '▶ 开始';
    btn.className = 'btn-circle btn-start';
    btn.onclick = startTimer;
  } else if (timerState === 'running') {
    btn.textContent = '⏸ 暂停';
    btn.className = 'btn-circle btn-pause';
    btn.onclick = pauseTimer;
  } else if (timerState === 'paused') {
    btn.textContent = '▶ 继续';
    btn.className = 'btn-circle btn-resume';
    btn.onclick = resumeTimer;
  }
}

function restDone() {
  hideAlert();
  recordRest();
  const s = loadSettings();
  resetTimer(s.selectedMinutes);

  document.querySelectorAll('.preset-card').forEach(c => {
    c.classList.remove('active');
    if (parseInt(c.dataset.minutes) === s.selectedMinutes) {
      c.classList.add('active');
    }
  });

  // 如果开启了自动重新计时，直接开始下一轮
  if (s.autoRestart) {
    startTimer();
  }
}

function snoozeAlert() {
  hideAlert();
  timerSeconds = 5 * 60;
  timerTotal = timerSeconds;
  timerState = 'idle';
  updateTimerDisplay();
  updateRing(1);
  startTimer();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  const display = document.getElementById('timer-display');
  if (display) display.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  const label = document.getElementById('timer-label');
  if (label) label.textContent = (loadSettings().selectedMinutes) + '分钟';
}

function updateRing(fraction) {
  const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));
  const ring = document.getElementById('ring-progress');
  if (ring) ring.style.strokeDashoffset = offset;
}

function setTimerStatus(text, cls) {
  const el = document.getElementById('timer-status');
  if (!el) return;
  el.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  el.appendChild(dot);
  el.appendChild(document.createTextNode(' ' + text));
  el.className = 'timer-status ' + (cls || '');
}

// 确保每次回到主页面时按钮绑定正确
function refreshMainPage() {
  bindControlButton();
  updateDNDIndicator();
  updateDNDBanner();
  updateStatBadge(getTodayCount());
  showTip();
}

// App 从后台恢复时同步计时器显示
function syncTimerFromBackground() {
  if (timerState !== 'running' || !timerStartTime) return;

  const elapsed = Math.floor((Date.now() - timerStartTime.getTime()) / 1000);
  const remaining = timerTotal - elapsed;

  if (remaining <= 0) {
    // 闹钟应该已经触发了（系统通知 + 可能的 Capacitor 回调）
    // 显示弹窗（如果还没显示）
    stopTimer();
    Notif.cancel();
    if (!alertActive) {
      showAlert();
    }
    setTimerStatus('时间到！', '');
    bindControlButton();
    const rb = document.getElementById('btn-rest');
    if (rb) rb.disabled = false;
    return;
  }

  // 还在计时中：用实际剩余秒数更新
  timerSeconds = remaining;
  updateTimerDisplay();
  updateRing(timerSeconds / timerTotal);
  bindControlButton();
}

document.addEventListener('DOMContentLoaded', () => {
  const restBtn = document.getElementById('btn-rest');
  if (restBtn) restBtn.onclick = restDone;
  const snoozeBtn = document.getElementById('btn-snooze');
  if (snoozeBtn) snoozeBtn.onclick = snoozeAlert;
  const doneBtn = document.getElementById('btn-done');
  if (doneBtn) doneBtn.onclick = restDone;
});
