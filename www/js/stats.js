// 统计记录模块
const STATS_KEY = 'eyecare_stats';

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { today: '', count: 0, total: 0 };
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordRest() {
  const today = new Date().toLocaleDateString('zh-CN');
  let stats = loadStats();

  if (stats.today !== today) {
    stats.today = today;
    stats.count = 0;
  }

  stats.count++;
  stats.total++;
  saveStats(stats);
  updateStatBadge(stats.count);
  return stats;
}

function updateStatBadge(count) {
  document.getElementById('today-count').textContent = count;

  const stats = loadStats();
  const today = new Date().toLocaleDateString('zh-CN');
  if (stats.today !== today) {
    document.getElementById('today-count').textContent = '0';
  }
}

function getTodayCount() {
  const stats = loadStats();
  const today = new Date().toLocaleDateString('zh-CN');
  return stats.today === today ? stats.count : 0;
}
