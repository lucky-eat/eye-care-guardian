// Capacitor 原生桥接层
// 在浏览器中静默降级；在 Android 上使用系统级 AlarmManager

const ALARM_ID = 991;
const STARTUP_ID = 992;

function isNative() {
  try {
    return !!(window.Capacitor?.Plugins?.LocalNotifications);
  } catch (e) { return false; }
}

const Notif = {
  async schedule(secondsFromNow, title, body) {
    if (!isNative()) return;
    try {
      const { LocalNotifications } = window.Capacitor.Plugins;
      await LocalNotifications.schedule({
        notifications: [{
          id: ALARM_ID,
          title: title,
          body: body,
          schedule: { at: new Date(Date.now() + secondsFromNow * 1000) },
          channelId: 'eyecare-alert',
        }]
      });
    } catch (e) { /* ignore */ }
  },

  async cancel() {
    if (!isNative()) return;
    try {
      const { LocalNotifications } = window.Capacitor.Plugins;
      await LocalNotifications.cancel({ notifications: [{ id: ALARM_ID }] });
    } catch (e) { /* ignore */ }
  },

  async scheduleDailyStartup(hour, minute) {
    if (!isNative()) return;
    try {
      const { LocalNotifications } = window.Capacitor.Plugins;

      // 计算今天目标时间
      const now = new Date();
      const at = new Date(now);
      at.setHours(hour, minute, 0, 0);
      if (at <= now) at.setDate(at.getDate() + 1);

      await LocalNotifications.schedule({
        notifications: [{
          id: STARTUP_ID,
          title: '护眼小卫士',
          body: '新的一天，点击启动护眼计划',
          schedule: {
            at: at,
            every: 'day',
          },
          channelId: 'eyecare-startup',
        }]
      });
    } catch (e) { /* ignore */ }
  },

  async cancelDailyStartup() {
    if (!isNative()) return;
    try {
      const { LocalNotifications } = window.Capacitor.Plugins;
      await LocalNotifications.cancel({ notifications: [{ id: STARTUP_ID }] });
    } catch (e) { /* ignore */ }
  },
};

// 监听通知事件（仅在 Capacitor 环境生效）
function setupNotificationListeners() {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = window.Capacitor.Plugins;

    // 通知触发时（即使 App 在前台也会触发此事件）
    LocalNotifications.addListener('localNotificationReceived', (notif) => {
      if (notif.notification.id === ALARM_ID) {
        // 在前台 → 显示全屏弹窗
        if (document.visibilityState === 'visible') {
          if (typeof showAlert === 'function') showAlert();
        }
      }
    });

    // 用户点击通知 → 打开 App
    LocalNotifications.addListener('localNotificationActionPerformed', (notif) => {
      if (notif.notification.id === ALARM_ID) {
        if (typeof showAlert === 'function') showAlert();
      }
      if (notif.notification.id === STARTUP_ID) {
        if (typeof activateToday === 'function') activateToday();
      }
    });
  } catch (e) { /* ignore */ }
}

// App 恢复前台时同步计时器
function setupAppResumeHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateStatBadge(getTodayCount());
      if (typeof checkDailyStartup === 'function') checkDailyStartup();
      if (typeof syncTimerFromBackground === 'function') syncTimerFromBackground();
    }
  });
}
