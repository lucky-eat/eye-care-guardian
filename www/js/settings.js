// 设置读写模块
const SETTINGS_KEY = 'eyecare_settings';

const defaults = {
  selectedMinutes: 20,
  alertMode: 'both',
  vibrateCount: 3,
  dndEnabled: false,
  dndStart: '23:00',
  dndEnd: '09:00',
  startupMode: 'scheduled',
  dailyStartupTime: '09:00',
  autoRestart: false,
  restDuration: 20,
  activeToday: false,
  todayDate: '',
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch (e) { /* ignore */ }
  return { ...defaults };
}

function saveSettings(partial) {
  const current = loadSettings();
  const merged = { ...current, ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch (e) { /* ignore */ }
  // 同步全局 settings
  settings = merged;
  return merged;
}

// 全局 settings —— 始终与 localStorage 一致
let settings = loadSettings();
