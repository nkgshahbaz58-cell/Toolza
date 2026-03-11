/* ============================================
   TurboRush — Leaderboard System
   ============================================ */

const LB_KEY = 'turborush_leaderboard';

/**
 * Save a score to the leaderboard.
 * @param {number} trackId
 * @param {string} playerName
 * @param {number} timeMs  — total race time in milliseconds
 * @param {string} carName — name of the car used
 */
function saveScore(trackId, playerName, timeMs, carName) {
  const data = _loadAll();
  const key = String(trackId);

  if (!data[key]) data[key] = [];

  data[key].push({
    name: playerName || 'Anonymous',
    time: timeMs,
    car: carName || 'Unknown',
    date: new Date().toISOString()
  });

  // Sort ascending (fastest first) and keep top 20
  data[key].sort((a, b) => a.time - b.time);
  data[key] = data[key].slice(0, 20);

  localStorage.setItem(LB_KEY, JSON.stringify(data));
}

/**
 * Get scores for a specific track.
 * @param {number} trackId
 * @param {number} limit — max results (default 10)
 * @returns {Array}
 */
function getScores(trackId, limit = 10) {
  const data = _loadAll();
  const key = String(trackId);
  return (data[key] || []).slice(0, limit);
}

/**
 * Clear all leaderboard data.
 */
function clearLeaderboard() {
  localStorage.removeItem(LB_KEY);
}

/**
 * Format milliseconds as a human-readable lap time.
 * @param {number} ms
 * @returns {string}
 */
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const millis = Math.floor((ms % 1000) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

/**
 * Render a leaderboard table into the specified container element.
 * @param {string} containerId
 * @param {number} trackId
 */
function renderLeaderboardTable(containerId, trackId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const scores = getScores(trackId, 10);

  if (scores.length === 0) {
    container.innerHTML = `
      <div style="padding: 60px; text-align: center; color: rgba(255,255,255,0.4);">
        <div style="font-size: 3rem; margin-bottom: 16px;">🏁</div>
        <p style="font-size: 1.1rem;">No times recorded yet.</p>
        <p style="font-size: 0.9rem; margin-top: 8px;">Be the first to set a record!</p>
      </div>`;
    return;
  }

  let html = `<table class="leaderboard-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>Racer</th>
        <th>Car</th>
        <th>Time</th>
      </tr>
    </thead>
    <tbody>`;

  scores.forEach((entry, idx) => {
    const rankClass = idx < 3 ? ` rank-${idx + 1}` : '';
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
    html += `
      <tr class="${rankClass}">
        <td class="rank-text">${medal} #${idx + 1}</td>
        <td>${_escapeHtml(entry.name)}</td>
        <td style="color: rgba(255,255,255,0.5);">${_escapeHtml(entry.car)}</td>
        <td style="font-family: 'Outfit', monospace; font-weight: 700; color: var(--primary);">${formatTime(entry.time)}</td>
      </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

/* --- Internal Helpers --- */

function _loadAll() {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY)) || {};
  } catch {
    return {};
  }
}

function _escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
