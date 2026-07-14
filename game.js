'use strict';

/* ---------- Grid / Path setup ---------- */

const TILE = 64;
const COLS = 15;
const ROWS = 10;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Path defined as tile waypoints; -1 / COLS are just off-screen spawn/exit points.
const pathTiles = [[-1, 1], [3, 1], [3, 4], [11, 4], [11, 7], [15, 7]];
const waypoints = pathTiles.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));

function computeBlockedTiles() {
  const set = new Set();
  for (let i = 0; i < pathTiles.length - 1; i++) {
    const [c1, r1] = pathTiles[i];
    const [c2, r2] = pathTiles[i + 1];
    if (r1 === r2) {
      const lo = Math.min(c1, c2), hi = Math.max(c1, c2);
      for (let c = lo; c <= hi; c++) if (c >= 0 && c < COLS) set.add(c + ',' + r1);
    } else if (c1 === c2) {
      const lo = Math.min(r1, r2), hi = Math.max(r1, r2);
      for (let r = lo; r <= hi; r++) if (c1 >= 0 && c1 < COLS) set.add(c1 + ',' + r);
    }
  }
  return set;
}
const blockedTiles = computeBlockedTiles();

/* ---------- Definitions: towers & threats ---------- */

const towerTypes = {
  firewall: {
    label: 'Firewall', icon: '🧱', color: '#39ff88', cost: 50,
    range: 115, fireRate: 700, damage: 12,
    desc: 'Filters network traffic by rule — the classic perimeter defense. Strong against Worms and DDoS floods, but does little against threats already disguised as legitimate files.'
  },
  antivirus: {
    label: 'Antivirus', icon: '💉', color: '#4da3ff', cost: 75,
    range: 100, fireRate: 900, damage: 18,
    desc: 'Scans for known malicious code signatures. Strong against Trojans, but signature-based detection struggles against fast-spreading Worms.'
  },
  spamfilter: {
    label: 'Spam Filter', icon: '📧', color: '#ffd24d', cost: 40,
    range: 135, fireRate: 500, damage: 8,
    desc: 'Analyzes sender reputation and message patterns before threats reach an inbox. Devastating against Phishing, but useless against file-based malware like Trojans.'
  },
  encryption: {
    label: 'Encryption/IDS', icon: '🔐', color: '#c084ff', cost: 110,
    range: 95, fireRate: 1400, damage: 48,
    desc: 'Protects data at rest and flags anomalous behavior. Strong against Ransomware and novel Zero-day threats, but slow to act — best paired with faster defenses.'
  }
};

const enemyTypes = {
  phishing: {
    label: 'Phishing Email', icon: '🎣', color: '#ffe08a', hp: 40, speed: 95, bounty: 8, breachDamage: 1,
    weakness: 'spamfilter', resistance: 'encryption',
    tip: 'Phishing tricks people into revealing info or clicking bad links. Real defense: verify the sender and never click suspicious links.'
  },
  trojan: {
    label: 'Trojan', icon: '🐴', color: '#ff9f6e', hp: 70, speed: 62, bounty: 12, breachDamage: 1,
    weakness: 'antivirus', resistance: 'spamfilter',
    tip: 'Trojans disguise themselves as legitimate software. Real defense: only install software from trusted, verified sources.'
  },
  worm: {
    label: 'Worm', icon: '🪱', color: '#8affc1', hp: 55, speed: 78, bounty: 10, breachDamage: 1,
    weakness: 'firewall', resistance: 'antivirus',
    tip: 'Worms self-replicate and spread across networks without help. Real defense: keep systems patched so known holes stay closed.'
  },
  ddos: {
    label: 'DDoS Packet', icon: '📶', color: '#7fd4ff', hp: 26, speed: 120, bounty: 6, breachDamage: 1,
    weakness: 'firewall', resistance: 'spamfilter',
    tip: 'DDoS attacks flood a target with traffic until it falls over. Real defense: rate limiting and traffic filtering at the network edge.'
  },
  ransomware: {
    label: 'Ransomware', icon: '🔒', color: '#ff6b6b', hp: 170, speed: 42, bounty: 26, breachDamage: 2,
    weakness: 'encryption', resistance: 'firewall',
    tip: 'Ransomware encrypts your files and demands payment. Real defense: regular offline backups make the ransom irrelevant.'
  },
  zeroday: {
    label: 'Zero-day Exploit', icon: '💀', color: '#ff3df0', hp: 520, speed: 34, bounty: 150, breachDamage: 5,
    weakness: null, resistance: 'all',
    tip: 'Zero-days exploit unknown vulnerabilities with no existing patch. Real defense: layered, defense-in-depth security so no single wall failing means total compromise.'
  }
};

const waves = [
  { groups: [{ type: 'phishing', count: 6, gap: 650 }] },
  { groups: [{ type: 'phishing', count: 4, gap: 600 }, { type: 'trojan', count: 3, gap: 800 }] },
  { groups: [{ type: 'worm', count: 5, gap: 700 }, { type: 'phishing', count: 4, gap: 500 }] },
  { groups: [{ type: 'ddos', count: 8, gap: 300 }, { type: 'trojan', count: 3, gap: 800 }] },
  { groups: [{ type: 'trojan', count: 5, gap: 650 }, { type: 'worm', count: 5, gap: 650 }, { type: 'phishing', count: 3, gap: 500 }] },
  { groups: [{ type: 'ransomware', count: 2, gap: 1400 }, { type: 'ddos', count: 6, gap: 350 }] },
  { groups: [{ type: 'ransomware', count: 3, gap: 1300 }, { type: 'worm', count: 6, gap: 550 }, { type: 'trojan', count: 4, gap: 650 }, { type: 'phishing', count: 4, gap: 450 }] },
  { groups: [{ type: 'zeroday', count: 1, gap: 0 }, { type: 'ransomware', count: 2, gap: 1200 }, { type: 'ddos', count: 8, gap: 300 }, { type: 'trojan', count: 4, gap: 600 }] }
];

/* ---------- Game state ---------- */

const state = {
  money: 150,
  lives: 20,
  currentWave: 0,
  waveInProgress: false,
  spawnQueue: [],
  spawnTimer: 0,
  towers: new Map(), // "col,row" -> tower
  enemies: [],
  effects: [],
  started: false,
  everStarted: false,
  selectedTowerType: null,
  selectedPlacedKey: null
};

const HIGH_SCORE_KEY = 'firewallDefenseHighScore';

/* ---------- DOM refs ---------- */

const moneyEl = document.getElementById('money');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const totalWavesEl = document.getElementById('total-waves');
const startWaveBtn = document.getElementById('start-wave-btn');
const infoTitle = document.getElementById('info-title');
const infoBody = document.getElementById('info-body');
const sellBtn = document.getElementById('sell-btn');
const intelFeed = document.getElementById('intel-feed');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayHighscore = document.getElementById('overlay-highscore');
const overlayBtn = document.getElementById('overlay-btn');

totalWavesEl.textContent = waves.length;

/* ---------- UI wiring ---------- */

document.querySelectorAll('.tower-card').forEach(card => {
  card.addEventListener('click', () => {
    const type = card.dataset.tower;
    if (state.selectedTowerType === type) {
      state.selectedTowerType = null;
      card.classList.remove('selected');
      resetInfoPanel();
      return;
    }
    document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
    state.selectedTowerType = type;
    state.selectedPlacedKey = null;
    card.classList.add('selected');
    showTowerShopInfo(type);
  });
});

sellBtn.addEventListener('click', () => {
  if (!state.selectedPlacedKey) return;
  const tower = state.towers.get(state.selectedPlacedKey);
  if (!tower) return;
  state.money += Math.floor(tower.def.cost * 0.7);
  state.towers.delete(state.selectedPlacedKey);
  state.selectedPlacedKey = null;
  resetInfoPanel();
  updateHUD();
});

startWaveBtn.addEventListener('click', startWave);

overlayBtn.addEventListener('click', () => {
  if (state.everStarted) resetGame();
  startGame();
});

canvas.addEventListener('click', (e) => {
  if (!state.started) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(mx / TILE);
  const row = Math.floor(my / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  const key = col + ',' + row;

  if (state.towers.has(key)) {
    state.selectedTowerType = null;
    document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
    state.selectedPlacedKey = key;
    showPlacedTowerInfo(state.towers.get(key));
    return;
  }

  if (!state.selectedTowerType) return;
  if (blockedTiles.has(key)) return;
  const def = towerTypes[state.selectedTowerType];
  if (state.money < def.cost) return;

  state.money -= def.cost;
  state.towers.set(key, {
    type: state.selectedTowerType,
    def,
    col, row,
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
    cooldown: 0
  });
  updateHUD();
});

/* ---------- Info panel helpers ---------- */

function resetInfoPanel() {
  infoTitle.textContent = 'Select a defense';
  infoBody.textContent = 'Click a defense card above, then click an open tile on the grid to deploy it. Click a placed tower to see details or sell it.';
  sellBtn.style.display = 'none';
}

function showTowerShopInfo(type) {
  const def = towerTypes[type];
  infoTitle.textContent = `${def.icon} ${def.label} — $${def.cost}`;
  infoBody.textContent = def.desc;
  sellBtn.style.display = 'none';
}

function showPlacedTowerInfo(tower) {
  const def = tower.def;
  infoTitle.textContent = `${def.icon} ${def.label} (deployed)`;
  infoBody.textContent = def.desc;
  sellBtn.style.display = 'block';
  sellBtn.textContent = `Sell for $${Math.floor(def.cost * 0.7)}`;
}

/* ---------- Intel feed ---------- */

function addIntel(headline, tip, isBreach) {
  const div = document.createElement('div');
  div.className = 'intel-item' + (isBreach ? ' breach' : '');
  div.innerHTML = `<b>${headline}</b><br>${tip}`;
  intelFeed.prepend(div);
  while (intelFeed.children.length > 40) intelFeed.removeChild(intelFeed.lastChild);
}

/* ---------- Wave spawning ---------- */

function startWave() {
  if (!state.started || state.waveInProgress || state.currentWave >= waves.length) return;
  state.waveInProgress = true;
  state.currentWave++;
  const wave = waves[state.currentWave - 1];
  state.spawnQueue = [];
  wave.groups.forEach(g => {
    for (let i = 0; i < g.count; i++) state.spawnQueue.push({ type: g.type, gap: g.gap });
  });
  state.spawnTimer = 0;
  updateHUD();
  startWaveBtn.disabled = true;
}

function spawnEnemy(type) {
  const def = enemyTypes[type];
  state.enemies.push({
    type, def,
    hp: def.hp, maxHp: def.hp,
    x: waypoints[0].x, y: waypoints[0].y,
    wpIndex: 1,
    progress: 0
  });
}

/* ---------- Combat ---------- */

function damageMultiplier(enemyDef, towerType) {
  if (enemyDef.weakness === towerType) return 1.8;
  if (enemyDef.resistance === towerType || enemyDef.resistance === 'all') return 0.4;
  return 1.0;
}

function killEnemy(enemy) {
  state.money += enemy.def.bounty;
  addIntel(`Blocked: ${enemy.def.label}`, enemy.def.tip, false);
  const idx = state.enemies.indexOf(enemy);
  if (idx !== -1) state.enemies.splice(idx, 1);
}

function breachEnemy(enemy) {
  state.lives -= enemy.def.breachDamage;
  addIntel(`BREACH: ${enemy.def.label} reached the server!`, enemy.def.tip, true);
  const idx = state.enemies.indexOf(enemy);
  if (idx !== -1) state.enemies.splice(idx, 1);
  if (state.lives <= 0) {
    state.lives = 0;
    endGame(false);
  }
}

/* ---------- Update loop ---------- */

let lastTime = null;

function update(dt) {
  // Spawning
  if (state.waveInProgress && state.spawnQueue.length > 0) {
    state.spawnTimer -= dt * 1000;
    if (state.spawnTimer <= 0) {
      const next = state.spawnQueue.shift();
      spawnEnemy(next.type);
      state.spawnTimer = next.gap;
    }
  }

  // Move enemies
  for (const enemy of state.enemies.slice()) {
    if (enemy.wpIndex >= waypoints.length) continue;
    const target = waypoints[enemy.wpIndex];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const step = enemy.def.speed * dt;
    if (step >= dist) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.wpIndex++;
      enemy.progress = enemy.wpIndex * 100000;
      if (enemy.wpIndex >= waypoints.length) {
        breachEnemy(enemy);
        continue;
      }
    } else {
      enemy.x += (dx / dist) * step;
      enemy.y += (dy / dist) * step;
      enemy.progress = enemy.wpIndex * 100000 - dist;
    }
  }

  // Towers fire
  for (const tower of state.towers.values()) {
    tower.cooldown -= dt * 1000;
    if (tower.cooldown > 0) continue;
    let best = null;
    for (const enemy of state.enemies) {
      const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (d <= tower.def.range) {
        if (!best || enemy.progress > best.progress) best = enemy;
      }
    }
    if (best) {
      const mult = damageMultiplier(best.def, tower.type);
      best.hp -= tower.def.damage * mult;
      tower.cooldown = tower.def.fireRate;
      state.effects.push({ x1: tower.x, y1: tower.y, x2: best.x, y2: best.y, color: tower.def.color, life: 120, maxLife: 120 });
      if (best.hp <= 0) killEnemy(best);
    }
  }

  // Effects
  for (const eff of state.effects.slice()) {
    eff.life -= dt * 1000;
    if (eff.life <= 0) state.effects.splice(state.effects.indexOf(eff), 1);
  }

  // Wave cleared?
  if (state.waveInProgress && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.waveInProgress = false;
    const bonus = 40 + state.currentWave * 10;
    state.money += bonus;
    addIntel(`Wave ${state.currentWave} cleared!`, `+$${bonus} bonus deployed to your defense budget.`, false);
    if (state.currentWave >= waves.length) {
      endGame(true);
    } else {
      startWaveBtn.disabled = false;
    }
  }

  updateHUD();
}

/* ---------- Rendering ---------- */

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // grid
  ctx.strokeStyle = 'rgba(57,255,136,0.06)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, ROWS * TILE); ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * TILE); ctx.lineTo(COLS * TILE, r * TILE); ctx.stroke();
  }

  // path tiles
  ctx.fillStyle = 'rgba(57,255,136,0.10)';
  for (const key of blockedTiles) {
    const [c, r] = key.split(',').map(Number);
    ctx.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
  }

  // server / goal marker
  const serverTile = pathTiles[pathTiles.length - 2];
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💻', (serverTile[0] + 1) * TILE + TILE / 2, serverTile[1] * TILE + TILE / 2);

  // towers
  for (const tower of state.towers.values()) {
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, tower.def.range, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f1c17';
    ctx.strokeStyle = tower.def.color;
    ctx.lineWidth = 2;
    ctx.fillRect(tower.col * TILE + 6, tower.row * TILE + 6, TILE - 12, TILE - 12);
    ctx.strokeRect(tower.col * TILE + 6, tower.row * TILE + 6, TILE - 12, TILE - 12);
    ctx.font = '26px monospace';
    ctx.fillText(tower.def.icon, tower.x, tower.y);
  }

  // effects (laser hits)
  for (const eff of state.effects) {
    ctx.strokeStyle = eff.color;
    ctx.globalAlpha = Math.max(eff.life / eff.maxLife, 0);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(eff.x1, eff.y1);
    ctx.lineTo(eff.x2, eff.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // enemies
  for (const enemy of state.enemies) {
    ctx.font = '24px monospace';
    ctx.fillText(enemy.def.icon, enemy.x, enemy.y);
    const barW = 30;
    ctx.fillStyle = '#300';
    ctx.fillRect(enemy.x - barW / 2, enemy.y - 22, barW, 5);
    ctx.fillStyle = '#39ff88';
    ctx.fillRect(enemy.x - barW / 2, enemy.y - 22, barW * Math.max(enemy.hp / enemy.maxHp, 0), 5);
  }
}

function loop(ts) {
  if (lastTime === null) lastTime = ts;
  let dt = (ts - lastTime) / 1000;
  lastTime = ts;
  if (dt > 0.05) dt = 0.05;
  if (state.started) update(dt);
  render();
  requestAnimationFrame(loop);
}

/* ---------- HUD ---------- */

function updateHUD() {
  moneyEl.textContent = state.money;
  livesEl.textContent = state.lives;
  waveEl.textContent = state.currentWave;
}

/* ---------- Game flow ---------- */

function startGame() {
  overlay.classList.add('hidden');
  state.started = true;
  state.everStarted = true;
}

function resetGame() {
  state.money = 150;
  state.lives = 20;
  state.currentWave = 0;
  state.waveInProgress = false;
  state.spawnQueue = [];
  state.spawnTimer = 0;
  state.towers.clear();
  state.enemies = [];
  state.effects = [];
  state.selectedTowerType = null;
  state.selectedPlacedKey = null;
  document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
  resetInfoPanel();
  intelFeed.innerHTML = '';
  startWaveBtn.disabled = false;
  updateHUD();
}

function endGame(won) {
  state.started = false;
  const best = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  const result = won ? waves.length : state.currentWave - 1;
  const newBest = Math.max(best, result);
  localStorage.setItem(HIGH_SCORE_KEY, String(newBest));

  overlayTitle.textContent = won ? 'Network Secured! 🎉' : 'Server Breached 💥';
  overlayText.textContent = won
    ? `You survived all ${waves.length} waves using layered, defense-in-depth security. That's exactly how real security teams stop attackers: no single tool catches everything.`
    : `Your server went down on wave ${state.currentWave}. Real security works the same way — one defense alone isn't enough. Try mixing defenses to counter every kind of threat.`;
  overlayHighscore.textContent = `Best result: Wave ${newBest}/${waves.length}`;
  overlayBtn.textContent = 'Play Again';
  overlay.classList.remove('hidden');
}

/* ---------- Init ---------- */

(function init() {
  const best = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  overlayHighscore.textContent = best > 0 ? `Best result: Wave ${best}/${waves.length}` : '';
  updateHUD();
  requestAnimationFrame(loop);
})();
