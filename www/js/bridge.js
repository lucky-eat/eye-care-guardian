// 原生桥接层
// 使用自定义 Capacitor AlarmPlugin（Android AlarmManager + BroadcastReceiver）
// 在浏览器中降级为使用 Capacitor Local Notifications（如果可用）或静默跳过

const ALARM_ID = 991;

function isNative() {
  try {
    return !!(window.Capacitor?.Plugins);
  } catch (e) { return false; }
}

function hasAlarmPlugin() {
  try {
    return !!(window.Capacitor?.Plugins?.AlarmPlugin);
  } catch (e) { return false; }
}

const Notif = {
  async schedule(secondsFromNow, title, body) {
    // 优先使用原生 AlarmPlugin（最可靠）
    if (hasAlarmPlugin()) {
      try {
        await window.Capacitor.Plugins.AlarmPlugin.schedule({
          seconds: secondsFromNow,
          title: title,
          body: body
        });
        return;
      } catch (e) { /* fall through */ }
    }

    // 降级：Capacitor Local Notifications
    if (isNative()) {
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
    }
  },

  async cancel() {
    if (hasAlarmPlugin()) {
      try {
        await window.Capacitor.Plugins.AlarmPlugin.cancel({});
        return;
      } catch (e) { /* fall through */ }
    }

    if (isNative()) {
      try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        await LocalNotifications.cancel({ notifications: [{ id: ALARM_ID }] });
      } catch (e) { /* ignore */ }
    }
  },

  async scheduleDailyStartup(hour, minute) {
    if (!isNative()) return;
    try {
      const { LocalNotifications } = window.Capacitor.Plugins;
      const now = new Date();
      const at = new Date(now);
      at.setHours(hour, minute, 0, 0);
      if (at <= now) at.setDate(at.getDate() + 1);

      await LocalNotifications.schedule({
        notifications: [{
          id: 992,
          title: '护眼小卫士',
          body: '新的一天，点击启动护眼计划',
          schedule: { at: at, every: 'day' },
          channelId: 'eyecare-startup',
        }]
      });
    } catch (e) { /* ignore */ }
  },

  async cancelDailyStartup() {
    if (!isNative()) return;
    try {
      const { LocalNotifications } = window.Capacitor.Plugins;
      await LocalNotifications.cancel({ notifications: [{ id: 992 }] });
    } catch (e) { /* ignore */ }
  },
};

function setupNotificationListeners() {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = window.Capacitor.Plugins;

    LocalNotifications.addListener('localNotificationReceived', (notif) => {
      if (notif.notification.id === ALARM_ID) {
        if (document.visibilityState === 'visible' && typeof showAlert === 'function') {
          showAlert();
        }
      }
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (notif) => {
      if (notif.notification.id === ALARM_ID) {
        if (typeof showAlert === 'function') showAlert();
      }
      if (notif.notification.id === 992) {
        if (typeof activateToday === 'function') activateToday();
      }
    });
  } catch (e) { /* ignore */ }
}

function setupAppResumeHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateStatBadge(getTodayCount());
      if (typeof checkDailyStartup === 'function') checkDailyStartup();
      if (typeof syncTimerFromBackground === 'function') syncTimerFromBackground();
    }
  });
}
