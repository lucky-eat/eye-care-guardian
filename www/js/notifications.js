// 通知提醒模块
let alertActive = false;
let alertSilenced = false;
let alertBeepInterval = null;
let alertVibrateInterval = null;
let autoRestartInterval = null;
let autoRestartSeconds = 0;

function showAlert() {
  if (alertActive) return;
  const s = loadSettings();
  if (isInDNDPeriod()) return;

  alertActive = true;
  alertSilenced = false;

  // 显示弹窗
  const overlay = document.getElementById('alert-overlay');
  document.getElementById('alert-sub').textContent =
    '你已经连续看了 ' + s.selectedMinutes + ' 分钟屏幕';
  overlay.classList.add('show');

  // 隐藏自动倒计时区域（等用户静音后再显示）
  document.getElementById('alert-auto-countdown').style.display = 'none';
  document.getElementById('alert-actions').style.display = 'flex';

  // 声音/振动
  if (s.alertMode === 'sound' || s.alertMode === 'both') startBeeping();
  if (s.alertMode === 'vibrate' || s.alertMode === 'both') startVibrating(s.vibrateCount);

  sendSystemNotification(s.selectedMinutes);
}

function hideAlert() {
  document.getElementById('alert-overlay').classList.remove('show');
  silenceAlert();
  stopAutoRestartCountdown();
  alertActive = false;
  // 恢复 UI
  document.getElementById('alert-auto-countdown').style.display = 'none';
  document.getElementById('alert-actions').style.display = 'flex';
}

// ---- 静音 ----

function silenceAlert() {
  alertSilenced = true;
  stopBeeping();
  stopVibrating();

  // 用户静音后：如果开了自动重新计时，开始休息倒计时
  const s = loadSettings();
  if (s.autoRestart && alertActive) {
    startAutoRestartCountdown(s.restDuration);
  }
}

// ---- 自动重新计时 ----

function startAutoRestartCountdown(totalSeconds) {
  stopAutoRestartCountdown();
  autoRestartSeconds = totalSeconds;

  // 切换到倒计时 UI
  const countdownEl = document.getElementById('alert-auto-countdown');
  const actionsEl = document.getElementById('alert-actions');
  if (countdownEl) countdownEl.style.display = 'flex';
  if (actionsEl) actionsEl.style.display = 'none';

  document.getElementById('auto-countdown-text').textContent = autoRestartSeconds;
  updateAutoRestRing(1);

  autoRestartInterval = setInterval(() => {
    autoRestartSeconds--;
    document.getElementById('auto-countdown-text').textContent = autoRestartSeconds;
    updateAutoRestRing(autoRestartSeconds / totalSeconds);

    if (autoRestartSeconds <= 0) {
      stopAutoRestartCountdown();
      hideAlert();
      recordRest();
      // 自动开始下一轮计时
      const s2 = loadSettings();
      resetTimer(s2.selectedMinutes);
      startTimer();
    }
  }, 1000);
}

function stopAutoRestartCountdown() {
  if (autoRestartInterval) {
    clearInterval(autoRestartInterval);
    autoRestartInterval = null;
  }
}

function updateAutoRestRing(fraction) {
  const circleLen = 2 * Math.PI * 34;
  const el = document.getElementById('auto-rest-progress');
  if (el) {
    el.style.strokeDasharray = circleLen;
    el.style.strokeDashoffset = circleLen * (1 - fraction);
  }
}

// ---- 声音 ----

function startBeeping() {
  stopBeeping();
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    alertBeepInterval = setInterval(() => {
      if (alertSilenced) { clearInterval(alertBeepInterval); return; }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    }, 1500);
  } catch (e) { /* ignore */ }
}

function stopBeeping() {
  if (alertBeepInterval) { clearInterval(alertBeepInterval); alertBeepInterval = null; }
}

// ---- 振动 ----

function startVibrating(count) {
  stopVibrating();
  if (!navigator.vibrate) return;
  if (count === 0) {
    try { navigator.vibrate(5000); } catch (e) { /* ignore */ }
    return;
  }
  let buzzes = 0;
  alertVibrateInterval = setInterval(() => {
    if (alertSilenced) { clearInterval(alertVibrateInterval); return; }
    if (buzzes >= count) { clearInterval(alertVibrateInterval); return; }
    try { navigator.vibrate(300); } catch (e) { /* ignore */ }
    buzzes++;
  }, 1500);
}

function stopVibrating() {
  if (alertVibrateInterval) { clearInterval(alertVibrateInterval); alertVibrateInterval = null; }
  try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { /* ignore */ }
}

// ---- 系统通知 ----

function sendSystemNotification(mins) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('护眼小卫士', {
        body: '该休息一下眼睛了！已连续看屏幕 ' + mins + ' 分钟',
        tag: 'eyecare-rest',
        vibrate: [300, 200, 300, 200, 300],
      });
    } catch (e) { /* ignore */ }
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ---- 按钮事件 ----

document.addEventListener('DOMContentLoaded', () => {
  // 点击弹窗内容 → 静音
  const alertContent = document.getElementById('alert-content');
  if (alertContent) {
    alertContent.addEventListener('click', (e) => {
      e.stopPropagation();
      silenceAlert();
    });
  }

  // 点击遮罩层 → 静音
  const overlay = document.getElementById('alert-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      silenceAlert();
    });
  }
});

function setupVolumeKeyListener() {
  document.addEventListener('volumeupbutton', silenceAlert);
  document.addEventListener('volumedownbutton', silenceAlert);
}

function setupFlipDetection() {
  if ('DeviceOrientationEvent' in window) {
    window.addEventListener('deviceorientation', (e) => {
      if (!alertActive || alertSilenced) return;
      if (Math.abs(e.beta) > 80) silenceAlert();
    });
  }
}
