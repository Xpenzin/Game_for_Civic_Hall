'use strict';

/* ---------- Grid ---------- */

const TILE = 64;
const COLS = 15;
const ROWS = 10;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function computeBlockedTiles(pathTiles) {
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

function buildWaypoints(pathTiles) {
  return pathTiles.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));
}

/* ---------- Tower definitions (with upgrade levels + unique abilities) ---------- */

const towerTypes = {
  firewall: {
    label: 'Firewall', icon: '🧱', color: '#39ff88', special: 'slow', maxCount: 8,
    desc: 'Filters and rate-limits traffic, slowing threats as they pass — the classic perimeter defense. Strong vs Worms & DDoS. Upgrading improves the slow effect and hardens it against being overwhelmed.',
    levels: [
      { cost: 50, range: 115, fireRate: 700, damage: 9, slowPct: 0.30, slowDuration: 1000, resistance: 0.25, upgradeCost: 70 },
      { range: 122, fireRate: 650, damage: 12, slowPct: 0.45, slowDuration: 1400, resistance: 0.40, upgradeCost: 110 },
      { range: 130, fireRate: 600, damage: 16, slowPct: 0.60, slowDuration: 1900, resistance: 0.55 }
    ]
  },
  antivirus: {
    label: 'Antivirus', icon: '💉', color: '#4da3ff', special: 'root', maxCount: 5,
    desc: 'Scans for malicious signatures and abnormal behavior, and can quarantine an infected host in place. Strongest vs Trojans and Ransomware — real EDR tools are built to catch exactly this. Upgrading raises damage and the chance to fully root (quarantine) a target.',
    levels: [
      { cost: 75, range: 100, fireRate: 900, damage: 22, rootChance: 0.18, rootDuration: 700, resistance: 0.30, upgradeCost: 90 },
      { range: 108, fireRate: 820, damage: 30, rootChance: 0.28, rootDuration: 950, resistance: 0.45, upgradeCost: 140 },
      { range: 115, fireRate: 750, damage: 40, rootChance: 0.40, rootDuration: 1250, resistance: 0.60 }
    ]
  },
  spamfilter: {
    label: 'Spam Filter', icon: '📧', color: '#ffd24d', special: 'instakill', maxCount: 8,
    desc: 'Analyzes sender reputation and message patterns. Has a chance to instantly block a recognized Phishing attempt outright, like a blocklist match. Upgrading raises that chance. Useless against file-based malware.',
    levels: [
      { cost: 40, range: 135, fireRate: 500, damage: 7, instaKillChance: 0.30, resistance: 0.15, upgradeCost: 55 },
      { range: 145, fireRate: 450, damage: 9, instaKillChance: 0.45, resistance: 0.30, upgradeCost: 90 },
      { range: 155, fireRate: 400, damage: 12, instaKillChance: 0.60, resistance: 0.45 }
    ]
  },
  encryption: {
    label: 'Encryption/IDS', icon: '🔐', color: '#c084ff', special: 'splash', maxCount: 3,
    desc: 'Deep packet inspection and anomaly detection that catches what signatures miss (splash damage to nearby traffic). Strongest vs Zero-days specifically — behavior-based detection is the standard real-world defense against unknown exploits. Expensive and slow, but hardest to take down.',
    levels: [
      { cost: 110, range: 95, fireRate: 1400, damage: 40, splashRadius: 60, splashPct: 0.5, resistance: 0.50, upgradeCost: 120 },
      { range: 102, fireRate: 1250, damage: 55, splashRadius: 72, splashPct: 0.6, resistance: 0.65, upgradeCost: 180 },
      { range: 110, fireRate: 1100, damage: 72, splashRadius: 85, splashPct: 0.7, resistance: 0.80 }
    ]
  }
};

/* ---------- Enemy definitions ----------
   `effectiveness` gives each defense's real-world-researched damage multiplier
   against this threat (1.8 = primary/purpose-built control, 1.0 = neutral/some
   generic relevance, 0.6 = limited/secondary relevance, 0.35 = minimal-to-none).
   `effectivenessNotes` is the one-line rationale shown in the in-game Field Manual. */

const enemyTypes = {
  phishing: {
    label: 'Phishing Email', icon: '🎣', hp: 40, speed: 95, bounty: 8,
    effectiveness: { firewall: 0.6, antivirus: 0.6, spamfilter: 1.8, encryption: 0.35 },
    effectivenessNotes: {
      firewall: 'NGFW URL/DNS filtering can block already-known-bad phishing links, but doesn’t stop the social-engineering deception itself.',
      antivirus: 'Endpoint AV can catch a malicious attachment riding along with the email, but not a convincing fake login page or a request to wire money.',
      spamfilter: 'Primary control. Secure email gateways score sender reputation and scan links/attachments — the actual purpose-built defense against phishing.',
      encryption: 'Encryption and anomaly-based IDS act on data/network behavior after the fact; neither has much bearing on stopping a deceptive email from being opened.'
    },
    disables: null,
    tip: 'Phishing tricks people into revealing info or clicking bad links. Real defense: verify the sender and never click suspicious links.'
  },
  trojan: {
    label: 'Trojan', icon: '🐴', hp: 70, speed: 62, bounty: 12,
    effectiveness: { firewall: 0.6, antivirus: 1.8, spamfilter: 0.6, encryption: 0.6 },
    effectivenessNotes: {
      firewall: 'Can block a known-bad download source or the trojan’s command-and-control callback, but can’t stop an already-downloaded file from running.',
      antivirus: 'Primary control. Signature and heuristic scanning of executables is the classic, purpose-built antivirus use case.',
      spamfilter: 'Only relevant if the trojan arrived as an email attachment — irrelevant if it came from a website, USB drive, or bundled software.',
      encryption: 'Behavior-based IDS/EDR can flag a trojan’s unusual runtime activity even without a matching file signature.'
    },
    disables: null,
    tip: 'Trojans disguise themselves as legitimate software. Real defense: only install software from trusted, verified sources.'
  },
  worm: {
    label: 'Worm', icon: '🪱', hp: 55, speed: 78, bounty: 10,
    effectiveness: { firewall: 1.8, antivirus: 0.6, spamfilter: 0.35, encryption: 0.6 },
    effectivenessNotes: {
      firewall: 'Primary control. Worms self-propagate by exploiting open network ports/services — segmentation and blocking those ports (as with blocking SMB during WannaCry) is the standard real response.',
      antivirus: 'Can catch a worm’s file payload, but fast-spreading worms exploit a vulnerability directly and can outrun signature updates entirely.',
      spamfilter: 'Most modern worms spread over the network, not by email, so spam filtering has little relevance (older mass-mailer worms were the exception).',
      encryption: 'Anomaly-based IDS can flag the unusual scanning/propagation traffic a worm generates, even without knowing the exact exploit.'
    },
    disables: 'antivirus', disableRange: 85, disableChance: 0.5, disableInterval: 1000, disableDuration: 2200,
    tip: 'Worms self-replicate and spread across networks without help — often faster than antivirus signatures can catch. Real defense: keep systems patched so known holes stay closed.'
  },
  ddos: {
    label: 'DDoS Packet', icon: '📶', hp: 26, speed: 120, bounty: 6,
    effectiveness: { firewall: 1.8, antivirus: 0.35, spamfilter: 0.35, encryption: 0.6 },
    effectivenessNotes: {
      firewall: 'Primary (baseline) control. Rate limiting and connection filtering at the network edge is the first layer of DDoS mitigation.',
      antivirus: 'Traditional file-scanning antivirus has no visibility into network traffic floods — this isn’t something it’s built to detect at all.',
      spamfilter: 'Email filtering is unrelated to a volumetric network attack.',
      encryption: 'IDS/anomaly detection can recognize abnormal traffic spikes, but a truly large DDoS usually needs dedicated scrubbing/CDN capacity beyond any single appliance.'
    },
    disables: 'firewall', disableRange: 85, disableChance: 0.55, disableInterval: 1000, disableDuration: 1800,
    tip: 'DDoS floods a target with traffic until it falls over — even the firewall meant to stop it can be overwhelmed. Real defense: rate limiting plus redundant, layered mitigation.'
  },
  ransomware: {
    label: 'Ransomware', icon: '🔒', hp: 170, speed: 42, bounty: 26,
    effectiveness: { firewall: 0.6, antivirus: 1.8, spamfilter: 0.6, encryption: 0.6 },
    effectivenessNotes: {
      firewall: 'Can block the ransomware’s command-and-control or exfiltration traffic, but does nothing to stop local files from being encrypted once the malware is already running.',
      antivirus: 'Primary control. Modern EDR/antivirus watches for the mass file-encryption behavior ransomware exhibits and can isolate (quarantine) the host before it spreads — the most effective real-time technical control.',
      spamfilter: 'Ransomware is frequently delivered via a phishing email, so filtering that initial message has real preventive value — but nothing once the payload is already running.',
      encryption: 'Anomaly detection can flag the unusual mass file-modification pattern, but encryption itself is what the attacker is doing to you — it isn’t a defense against it. (The real best defense, not modeled by any tower here: regular offline backups.)'
    },
    disables: 'antivirus', disableRange: 85, disableChance: 0.4, disableInterval: 1500, disableDuration: 2500,
    tip: 'Ransomware encrypts your files and demands payment. Real EDR can spot the encryption behavior and isolate the host, but regular offline backups are what make the ransom irrelevant even if it gets through — which is why ransomware often tries to disable security tools and delete backups first.'
  },
  zeroday: {
    label: 'Zero-day Exploit', icon: '💀', hp: 520, speed: 34, bounty: 150,
    effectiveness: { firewall: 0.35, antivirus: 0.35, spamfilter: 0.35, encryption: 1.8 },
    effectivenessNotes: {
      firewall: 'By definition there’s no existing rule for an unknown exploit, so a standard firewall ruleset has little to match against.',
      antivirus: 'Signature-based antivirus explicitly cannot detect an exploit that has never been seen before.',
      spamfilter: 'Not typically an email-based vector, so spam filtering is largely irrelevant here.',
      encryption: 'Primary control. With no signature to match, real-world zero-day defense leans on anomaly/behavior-based detection — spotting that something is wrong without knowing exactly what. This is why defense-in-depth architectures lean on this layer specifically for novel threats.'
    },
    disables: 'any', disableRange: 100, disableChance: 0.7, disableInterval: 900, disableDuration: 3200,
    tip: 'Zero-days exploit unknown vulnerabilities with no existing patch or signature, and can knock out any single defense. Real defense leans on anomaly/behavior-based detection plus layered, defense-in-depth security so no one failure means total compromise.'
  }
};

/* ---------- Levels (maps) ---------- */

function wave(groups) { return { groups }; }
function g(type, count, gap) { return { type, count, gap }; }

const levelDefs = [
  {
    id: 1, name: 'Home Network', icon: '🏠',
    blurb: 'A small home network. Learn the basics of layered defense against everyday threats.',
    startMoney: 150,
    hpMultiplier: 1, speedMultiplier: 1,
    pathTiles: [[-1, 1], [3, 1], [3, 4], [11, 4], [11, 7], [15, 7]],
    waves: [
      wave([g('phishing', 6, 650)]),
      wave([g('phishing', 4, 600), g('trojan', 3, 800)]),
      wave([g('worm', 5, 700), g('phishing', 4, 500)]),
      wave([g('ddos', 8, 300), g('trojan', 3, 800)]),
      wave([g('trojan', 5, 650), g('worm', 5, 650), g('phishing', 3, 500)]),
      wave([g('ransomware', 2, 1400), g('ddos', 6, 350), g('trojan', 3, 600)])
    ]
  },
  {
    id: 2, name: 'Corporate LAN', icon: '🏢',
    blurb: 'A busier corporate network with more chokepoints — and ransomware shows up early.',
    startMoney: 170,
    hpMultiplier: 1.25, speedMultiplier: 1.05,
    pathTiles: [[-1, 2], [2, 2], [2, 7], [6, 7], [6, 1], [9, 1], [9, 8], [13, 8], [13, 3], [15, 3]],
    waves: [
      wave([g('phishing', 8, 500), g('ddos', 4, 350)]),
      wave([g('trojan', 5, 600), g('worm', 5, 600)]),
      wave([g('ransomware', 2, 1300), g('phishing', 6, 450)]),
      wave([g('ddos', 10, 280), g('worm', 6, 550)]),
      wave([g('trojan', 6, 550), g('ransomware', 2, 1200), g('phishing', 5, 400)]),
      wave([g('ransomware', 3, 1100), g('ddos', 8, 300), g('worm', 6, 500), g('trojan', 5, 550)])
    ]
  },
  {
    id: 3, name: 'Cloud Data Center', icon: '☁️',
    blurb: 'High-value cloud infrastructure. Zero-days hit hard, fast, and can disable anything.',
    startMoney: 200,
    hpMultiplier: 1.55, speedMultiplier: 1.12,
    pathTiles: [[-1, 5], [1, 5], [1, 1], [4, 1], [4, 8], [7, 8], [7, 2], [10, 2], [10, 6], [13, 6], [13, 1], [15, 1]],
    waves: [
      wave([g('phishing', 8, 450), g('trojan', 5, 550), g('ddos', 6, 300)]),
      wave([g('worm', 8, 500), g('ransomware', 2, 1200)]),
      wave([g('zeroday', 1, 0), g('ddos', 8, 280), g('trojan', 5, 500)]),
      wave([g('ransomware', 4, 1000), g('worm', 8, 450), g('phishing', 6, 400)]),
      wave([g('zeroday', 1, 0), g('ransomware', 3, 1000), g('ddos', 10, 260)]),
      wave([g('zeroday', 2, 4000), g('ransomware', 4, 900), g('ddos', 10, 260), g('worm', 8, 420), g('trojan', 6, 480), g('phishing', 6, 380)])
    ]
  }
];

levelDefs.forEach(lvl => {
  lvl.waypoints = buildWaypoints(lvl.pathTiles);
  lvl.blockedTiles = computeBlockedTiles(lvl.pathTiles);
  lvl.serverTile = lvl.pathTiles[lvl.pathTiles.length - 2];
});

/* ---------- Game state ---------- */

const MAX_BREACHES = 3;

const state = {
  screen: 'intro', // intro | levelSelect | playing | result
  level: null,
  money: 0,
  breaches: 0,
  currentWave: 0,
  waveInProgress: false,
  spawnQueue: [],
  spawnTimer: 0,
  towers: new Map(),
  enemies: [],
  effects: [],
  clock: 0,
  paused: false,
  manualTab: 'defenses',
  selectedTowerType: null,
  selectedPlacedKey: null,
  lastResult: null
};

const HIGH_SCORE_PREFIX = 'firewallDefenseHighScore_lvl';

function getBest(levelId) {
  return Number(localStorage.getItem(HIGH_SCORE_PREFIX + levelId) || 0);
}
function setBest(levelId, value) {
  const best = Math.max(getBest(levelId), value);
  localStorage.setItem(HIGH_SCORE_PREFIX + levelId, String(best));
  return best;
}

/* ---------- DOM refs ---------- */

const moneyEl = document.getElementById('money');
const breachesEl = document.getElementById('breaches');
const waveEl = document.getElementById('wave');
const totalWavesEl = document.getElementById('total-waves');
const levelNameStat = document.getElementById('level-name-stat');
const startWaveBtn = document.getElementById('start-wave-btn');
const menuBtn = document.getElementById('menu-btn');
const infoTitle = document.getElementById('info-title');
const infoBody = document.getElementById('info-body');
const sellBtn = document.getElementById('sell-btn');
const upgradeBtn = document.getElementById('upgrade-btn');
const intelFeed = document.getElementById('intel-feed');
const overlay = document.getElementById('overlay');
const overlayBox = document.getElementById('overlay-box');
const manualBtn = document.getElementById('manual-btn');
const manualOverlay = document.getElementById('manual-overlay');
const manualCloseBtn = document.getElementById('manual-close-btn');
const manualContent = document.getElementById('manual-content');
const manualTabBtns = document.querySelectorAll('.manual-tab-btn');

/* ---------- Overlay screens ---------- */

function showOverlay() { overlay.classList.remove('hidden'); }
function hideOverlay() { overlay.classList.add('hidden'); }

function renderIntro() {
  state.screen = 'intro';
  overlayBox.innerHTML = `
    <h2>Firewall Defense</h2>
    <p>Malicious traffic is inbound toward your servers. Deploy defenses along the network path
    to stop each threat before it reaches the end. Different defenses counter different threats,
    have unique abilities, and can be upgraded — just like real defense-in-depth security.
    Some threats can even disable a defense temporarily, so don't rely on just one layer.</p>
    <div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
      <button class="overlay-btn" id="btn-to-levels">Choose a Network</button>
      <button class="overlay-btn" id="btn-intro-manual" style="background:#1a2a24; color:var(--text); border:1px solid var(--border);">📖 Field Manual</button>
    </div>
  `;
  showOverlay();
  document.getElementById('btn-to-levels').addEventListener('click', renderLevelSelect);
  document.getElementById('btn-intro-manual').addEventListener('click', openManual);
}

function renderLevelSelect() {
  state.screen = 'levelSelect';
  const cards = levelDefs.map(lvl => {
    const best = getBest(lvl.id);
    const bestText = best === 0 ? 'Not attempted yet' : (best >= lvl.waves.length ? 'Secured! 🎉' : `Best: Wave ${best}/${lvl.waves.length}`);
    return `
      <div class="level-card">
        <div style="font-size:2rem;">${lvl.icon}</div>
        <div class="level-card-info">
          <h3>${lvl.name}</h3>
          <p>${lvl.blurb}</p>
          <div class="level-best">${bestText}</div>
        </div>
        <button class="level-play-btn" data-level="${lvl.id}">Deploy</button>
      </div>
    `;
  }).join('');
  overlayBox.innerHTML = `
    <h2>Select a Network</h2>
    <div class="level-grid">${cards}</div>
    <button class="overlay-btn" id="btn-select-manual" style="background:#1a2a24; color:var(--text); border:1px solid var(--border);">📖 Field Manual</button>
  `;
  showOverlay();
  document.getElementById('btn-select-manual').addEventListener('click', openManual);
  overlayBox.querySelectorAll('.level-play-btn').forEach(btn => {
    btn.addEventListener('click', () => startLevel(Number(btn.dataset.level)));
  });
}

function renderResult(won) {
  state.screen = 'result';
  const lvl = state.level;
  const result = won ? lvl.waves.length : state.currentWave - 1;
  const best = setBest(lvl.id, result);
  const title = won ? 'Network Secured! 🎉' : 'Network Down — Try Again';
  const text = won
    ? `You survived all ${lvl.waves.length} waves on ${lvl.name}. Layered defenses beat any single tool.`
    : `${MAX_BREACHES} threats broke through on wave ${state.currentWave} of ${lvl.name}. One defense alone wasn't enough to cover every gap.`;
  overlayBox.innerHTML = `
    <h2>${title}</h2>
    <p>${text}</p>
    <p class="highscore-line">Best on ${lvl.name}: Wave ${best}/${lvl.waves.length}</p>
    <div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
      <button class="overlay-btn" id="btn-retry">Try Again</button>
      <button class="overlay-btn" id="btn-levels">Level Select</button>
    </div>
  `;
  showOverlay();
  document.getElementById('btn-retry').addEventListener('click', () => startLevel(lvl.id));
  document.getElementById('btn-levels').addEventListener('click', renderLevelSelect);
}

/* ---------- Level flow ---------- */

function startLevel(levelId) {
  const lvl = levelDefs.find(l => l.id === levelId);
  state.level = lvl;
  state.money = lvl.startMoney;
  state.breaches = 0;
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
  levelNameStat.textContent = `${lvl.icon} ${lvl.name}`;
  totalWavesEl.textContent = lvl.waves.length;
  updateHUD();
  updateShopUI();
  hideOverlay();
  state.screen = 'playing';
}

menuBtn.addEventListener('click', () => {
  if (state.screen === 'playing') renderLevelSelect();
});

/* ---------- Shop wiring ---------- */

document.querySelectorAll('.tower-card').forEach(card => {
  card.addEventListener('click', () => {
    if (state.screen !== 'playing') return;
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
  state.money += Math.floor(tower.invested * 0.6);
  state.towers.delete(state.selectedPlacedKey);
  state.selectedPlacedKey = null;
  resetInfoPanel();
  updateHUD();
  updateShopUI();
});

upgradeBtn.addEventListener('click', () => {
  if (!state.selectedPlacedKey) return;
  const tower = state.towers.get(state.selectedPlacedKey);
  if (!tower) return;
  const def = towerTypes[tower.type];
  const curLevel = def.levels[tower.levelIndex];
  if (tower.levelIndex >= def.levels.length - 1) return;
  const cost = curLevel.upgradeCost;
  if (state.money < cost) return;
  state.money -= cost;
  tower.invested += cost;
  tower.levelIndex++;
  showPlacedTowerInfo(tower);
  updateHUD();
});

canvas.addEventListener('click', (e) => {
  if (state.screen !== 'playing') return;
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
  if (state.level.blockedTiles.has(key)) return;
  const def = towerTypes[state.selectedTowerType];
  if (countByType(state.selectedTowerType) >= def.maxCount) return;
  const lvl0 = def.levels[0];
  if (state.money < lvl0.cost) return;

  state.money -= lvl0.cost;
  state.towers.set(key, {
    type: state.selectedTowerType,
    col, row,
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
    levelIndex: 0,
    invested: lvl0.cost,
    cooldown: 0,
    disabledUntil: 0,
    flashUntil: 0
  });
  updateHUD();
  updateShopUI();
  showTowerShopInfo(state.selectedTowerType);
});

function countByType(type) {
  let n = 0;
  for (const t of state.towers.values()) if (t.type === type) n++;
  return n;
}

function updateShopUI() {
  document.querySelectorAll('.tower-card').forEach(card => {
    const type = card.dataset.tower;
    const def = towerTypes[type];
    const count = countByType(type);
    const badge = card.querySelector(`[data-tower-count="${type}"]`);
    if (badge) badge.textContent = `${count}/${def.maxCount}`;
    card.classList.toggle('maxed', count >= def.maxCount);
  });
}

/* ---------- Info panel ---------- */

function resetInfoPanel() {
  infoTitle.textContent = 'Select a defense';
  infoBody.textContent = 'Click a defense card above, then click an open tile on the grid to deploy it. Click a placed tower to see details, upgrade it, or sell it.';
  sellBtn.style.display = 'none';
  upgradeBtn.style.display = 'none';
}

function specialSummary(type, lvl) {
  if (type === 'firewall') return `Slows enemies ${Math.round(lvl.slowPct * 100)}% for ${(lvl.slowDuration / 1000).toFixed(1)}s.`;
  if (type === 'antivirus') return `${Math.round(lvl.rootChance * 100)}% chance to quarantine (root) for ${(lvl.rootDuration / 1000).toFixed(1)}s.`;
  if (type === 'spamfilter') return `${Math.round(lvl.instaKillChance * 100)}% chance to instantly block a Phishing threat.`;
  if (type === 'encryption') return `Splash ${Math.round(lvl.splashPct * 100)}% damage in a ${lvl.splashRadius}px radius; ignores resistance.`;
  return '';
}

function showTowerShopInfo(type) {
  const def = towerTypes[type];
  const lvl = def.levels[0];
  const count = countByType(type);
  let text = def.desc + ' ' + specialSummary(type, lvl);
  if (count >= def.maxCount) text += ` (Max ${def.maxCount} deployed — sell one to build another.)`;
  infoTitle.textContent = `${def.icon} ${def.label} — $${lvl.cost}`;
  infoBody.textContent = text;
  sellBtn.style.display = 'none';
  upgradeBtn.style.display = 'none';
}

function showPlacedTowerInfo(tower) {
  const def = towerTypes[tower.type];
  const lvl = def.levels[tower.levelIndex];
  infoTitle.textContent = `${def.icon} ${def.label} — Lv${tower.levelIndex + 1}/${def.levels.length}`;
  infoBody.textContent = `${def.desc} ${specialSummary(tower.type, lvl)} DMG ${lvl.damage} | Range ${lvl.range} | Rate ${lvl.fireRate}ms | Resist ${Math.round(lvl.resistance * 100)}%`;
  sellBtn.style.display = 'block';
  sellBtn.textContent = `Sell for $${Math.floor(tower.invested * 0.6)}`;
  if (tower.levelIndex < def.levels.length - 1) {
    upgradeBtn.style.display = 'block';
    upgradeBtn.textContent = `Upgrade to Lv${tower.levelIndex + 2} ($${lvl.upgradeCost})`;
    upgradeBtn.disabled = state.money < lvl.upgradeCost;
  } else {
    upgradeBtn.style.display = 'block';
    upgradeBtn.textContent = 'Max level';
    upgradeBtn.disabled = true;
  }
}

/* ---------- Intel feed ---------- */

function addIntel(headline, tip, kind) {
  const div = document.createElement('div');
  div.className = 'intel-item' + (kind ? ' ' + kind : '');
  div.innerHTML = `<b>${headline}</b><br>${tip}`;
  intelFeed.prepend(div);
  while (intelFeed.children.length > 40) intelFeed.removeChild(intelFeed.lastChild);
}

/* ---------- Wave spawning ---------- */

function startWave() {
  if (state.screen !== 'playing' || state.waveInProgress || state.currentWave >= state.level.waves.length) return;
  state.waveInProgress = true;
  state.currentWave++;
  const wv = state.level.waves[state.currentWave - 1];
  state.spawnQueue = [];
  wv.groups.forEach(gr => {
    for (let i = 0; i < gr.count; i++) state.spawnQueue.push({ type: gr.type, gap: gr.gap });
  });
  state.spawnTimer = 0;
  updateHUD();
  startWaveBtn.disabled = true;
}

function spawnEnemy(type) {
  const def = enemyTypes[type];
  const lvl = state.level;
  const wp = lvl.waypoints;
  state.enemies.push({
    type, def,
    hp: def.hp * lvl.hpMultiplier,
    maxHp: def.hp * lvl.hpMultiplier,
    x: wp[0].x, y: wp[0].y,
    wpIndex: 1,
    progress: 0,
    phase: Math.random() * Math.PI * 2,
    slowUntil: 0, slowPct: 0,
    rootUntil: 0,
    hitFlashUntil: 0,
    nextDisableCheck: state.clock + (def.disableInterval || 0)
  });
}

startWaveBtn.addEventListener('click', startWave);

/* ---------- Combat ---------- */

function damageMultiplier(enemyDef, towerType) {
  return enemyDef.effectiveness[towerType];
}

function isPrimaryCounter(enemyDef, towerType) {
  return enemyDef.effectiveness[towerType] >= 1.5;
}

function killEnemy(enemy) {
  state.money += Math.round(enemy.def.bounty * state.level.hpMultiplier);
  addIntel(`Blocked: ${enemy.def.label}`, enemy.def.tip, '');
  const idx = state.enemies.indexOf(enemy);
  if (idx !== -1) state.enemies.splice(idx, 1);
}

function breachEnemy(enemy) {
  state.breaches++;
  const remaining = MAX_BREACHES - state.breaches;
  addIntel(
    `BREACH: ${enemy.def.label} reached the server! (${state.breaches}/${MAX_BREACHES})`,
    remaining > 0
      ? `${enemy.def.tip} ${remaining} more breach${remaining === 1 ? '' : 'es'} and this network goes down.`
      : enemy.def.tip,
    'breach'
  );
  const idx = state.enemies.indexOf(enemy);
  if (idx !== -1) state.enemies.splice(idx, 1);
  if (state.breaches >= MAX_BREACHES) {
    endLevel(false);
  }
}

function applyDamage(tower, def, lvl, target) {
  const mult = damageMultiplier(target.def, tower.type);

  if (tower.type === 'spamfilter' && isPrimaryCounter(target.def, 'spamfilter') && Math.random() < lvl.instaKillChance) {
    target.hp = 0;
  } else {
    target.hp -= lvl.damage * mult;
  }
  target.hitFlashUntil = state.clock + 150;

  if (tower.type === 'firewall') {
    if (target.slowUntil < state.clock + lvl.slowDuration) {
      target.slowUntil = state.clock + lvl.slowDuration;
      target.slowPct = Math.max(target.slowPct, lvl.slowPct);
    }
  } else if (tower.type === 'antivirus') {
    if (Math.random() < lvl.rootChance) target.rootUntil = state.clock + lvl.rootDuration;
  } else if (tower.type === 'encryption') {
    for (const other of state.enemies) {
      if (other === target) continue;
      const d = Math.hypot(other.x - target.x, other.y - target.y);
      if (d <= lvl.splashRadius) {
        const m = damageMultiplier(other.def, 'encryption');
        other.hp -= lvl.damage * lvl.splashPct * m;
        other.hitFlashUntil = state.clock + 150;
      }
    }
  }

  if (target.hp <= 0) killEnemy(target);
}

/* ---------- Update loop ---------- */

let lastTime = null;

function update(dt) {
  state.clock += dt * 1000;
  const lvl = state.level;

  // Spawning
  if (state.waveInProgress && state.spawnQueue.length > 0) {
    state.spawnTimer -= dt * 1000;
    if (state.spawnTimer <= 0) {
      const next = state.spawnQueue.shift();
      spawnEnemy(next.type);
      state.spawnTimer = next.gap;
    }
  }

  // Move enemies + disable ability
  for (const enemy of state.enemies.slice()) {
    if (enemy.wpIndex >= lvl.waypoints.length) continue;

    // disable-tower ability
    if (enemy.def.disables && state.clock >= enemy.nextDisableCheck) {
      enemy.nextDisableCheck = state.clock + enemy.def.disableInterval;
      let target = null, bestDist = Infinity;
      for (const tower of state.towers.values()) {
        if (enemy.def.disables !== 'any' && tower.type !== enemy.def.disables) continue;
        if (tower.disabledUntil > state.clock) continue;
        const d = Math.hypot(tower.x - enemy.x, tower.y - enemy.y);
        if (d <= enemy.def.disableRange && d < bestDist) { target = tower; bestDist = d; }
      }
      if (target && Math.random() < enemy.def.disableChance) {
        const towerLvl = towerTypes[target.type].levels[target.levelIndex];
        const duration = Math.max(500, enemy.def.disableDuration * (1 - towerLvl.resistance));
        target.disabledUntil = state.clock + duration;
        state.effects.push({ kind: 'zap', x1: enemy.x, y1: enemy.y, x2: target.x, y2: target.y, life: 250, maxLife: 250 });
        addIntel(`${enemy.def.label} disabled a ${towerTypes[target.type].label}!`, `A single defense going offline is exactly why real networks use layered, redundant security.`, 'disable');
      }
    }

    let speedMult = 1;
    if (enemy.rootUntil > state.clock) speedMult = 0;
    else if (enemy.slowUntil > state.clock) speedMult = 1 - enemy.slowPct;

    if (speedMult > 0) {
      const target = lvl.waypoints[enemy.wpIndex];
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      const step = enemy.def.speed * lvl.speedMultiplier * speedMult * dt;
      if (step >= dist) {
        enemy.x = target.x;
        enemy.y = target.y;
        enemy.wpIndex++;
        enemy.progress = enemy.wpIndex * 100000;
        if (enemy.wpIndex >= lvl.waypoints.length) {
          breachEnemy(enemy);
          continue;
        }
      } else {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
        enemy.progress = enemy.wpIndex * 100000 - dist;
      }
    }
  }

  // Towers fire
  for (const tower of state.towers.values()) {
    if (tower.disabledUntil > state.clock) continue;
    tower.cooldown -= dt * 1000;
    if (tower.cooldown > 0) continue;
    const def = towerTypes[tower.type];
    const lvl2 = def.levels[tower.levelIndex];
    let best = null;
    for (const enemy of state.enemies) {
      const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (d <= lvl2.range) {
        if (!best || enemy.progress > best.progress) best = enemy;
      }
    }
    if (best) {
      applyDamage(tower, def, lvl2, best);
      tower.cooldown = lvl2.fireRate;
      tower.flashUntil = state.clock + 150;
      state.effects.push({ kind: 'shot', x1: tower.x, y1: tower.y, x2: best.x, y2: best.y, color: def.color, life: 120, maxLife: 120 });
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
    addIntel(`Wave ${state.currentWave} cleared!`, `+$${bonus} bonus deployed to your defense budget.`, '');
    if (state.currentWave >= lvl.waves.length) {
      endLevel(true);
    } else {
      startWaveBtn.disabled = false;
    }
  }

  updateHUD();
  if (state.selectedPlacedKey && state.towers.has(state.selectedPlacedKey)) {
    showPlacedTowerInfo(state.towers.get(state.selectedPlacedKey));
  }
}

function endLevel(won) {
  state.screen = 'result';
  renderResult(won);
}

/* ---------- Rendering ---------- */

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.screen !== 'playing' || !state.level) return;
  const lvl = state.level;

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
  for (const key of lvl.blockedTiles) {
    const [c, r] = key.split(',').map(Number);
    ctx.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
  }

  // server icon
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const st = lvl.serverTile;
  ctx.fillText('💻', st[0] * TILE + TILE + TILE / 2, st[1] * TILE + TILE / 2);

  // towers
  for (const tower of state.towers.values()) {
    const def = towerTypes[tower.type];
    const tlvl = def.levels[tower.levelIndex];
    const disabled = tower.disabledUntil > state.clock;

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, tlvl.range, 0, Math.PI * 2);
    ctx.fill();

    const flashAmt = Math.max(0, (tower.flashUntil - state.clock) / 150);
    const scale = 1 + flashAmt * 0.35;

    ctx.save();
    ctx.translate(tower.x, tower.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = disabled ? '#241414' : '#0f1c17';
    ctx.strokeStyle = disabled ? '#ff4d4d' : def.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = disabled ? 0.55 : 1;
    ctx.fillRect(-TILE / 2 + 6, -TILE / 2 + 6, TILE - 12, TILE - 12);
    ctx.strokeRect(-TILE / 2 + 6, -TILE / 2 + 6, TILE - 12, TILE - 12);
    ctx.font = '26px monospace';
    ctx.fillStyle = disabled ? '#996' : '#fff';
    ctx.fillText(def.icon, 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();

    // level pips
    for (let i = 0; i <= tower.levelIndex; i++) {
      ctx.fillStyle = def.color;
      ctx.fillRect(tower.x - 12 + i * 8, tower.y + TILE / 2 - 10, 5, 5);
    }

    if (disabled) {
      ctx.font = '14px monospace';
      ctx.fillStyle = '#ff4d4d';
      ctx.fillText('⚠', tower.x, tower.y - TILE / 2 + 4);
    }
  }

  // effects
  for (const eff of state.effects) {
    if (eff.kind === 'zap') {
      ctx.strokeStyle = '#ffcf5c';
      ctx.globalAlpha = Math.max(eff.life / eff.maxLife, 0);
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = eff.color;
      ctx.globalAlpha = Math.max(eff.life / eff.maxLife, 0);
      ctx.lineWidth = 2;
    }
    ctx.beginPath();
    ctx.moveTo(eff.x1, eff.y1);
    ctx.lineTo(eff.x2, eff.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // enemies
  for (const enemy of state.enemies) {
    const rooted = enemy.rootUntil > state.clock;
    const slowed = !rooted && enemy.slowUntil > state.clock;
    const bob = rooted ? 0 : Math.sin(state.clock / 150 + enemy.phase) * 3;

    if (rooted) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(enemy.x, enemy.y + bob, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    } else if (slowed) {
      ctx.strokeStyle = '#7fd4ff';
      ctx.beginPath(); ctx.arc(enemy.x, enemy.y + bob, 15, 0, Math.PI * 2); ctx.stroke();
    }

    const hitFlash = Math.max(0, (enemy.hitFlashUntil - state.clock) / 150);
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${hitFlash * 0.6})`;
      ctx.beginPath(); ctx.arc(enemy.x, enemy.y + bob, 14, 0, Math.PI * 2); ctx.fill();
    }

    ctx.font = '24px monospace';
    ctx.fillText(enemy.def.icon, enemy.x, enemy.y + bob);
    const barW = 30;
    ctx.fillStyle = '#300';
    ctx.fillRect(enemy.x - barW / 2, enemy.y + bob - 22, barW, 5);
    ctx.fillStyle = '#39ff88';
    ctx.fillRect(enemy.x - barW / 2, enemy.y + bob - 22, barW * Math.max(enemy.hp / enemy.maxHp, 0), 5);
  }
}

function loop(ts) {
  if (lastTime === null) lastTime = ts;
  let dt = (ts - lastTime) / 1000;
  lastTime = ts;
  if (dt > 0.05) dt = 0.05;
  try {
    if (state.screen === 'playing' && !state.paused) update(dt);
    render();
  } catch (err) {
    console.error('Game loop error (continuing):', err);
  }
  requestAnimationFrame(loop);
}

/* ---------- HUD ---------- */

function updateHUD() {
  moneyEl.textContent = state.money;
  breachesEl.textContent = `${state.breaches}/${MAX_BREACHES}`;
  waveEl.textContent = state.currentWave;
}

/* ---------- Field Manual (interactive reference, driven by live game data) ---------- */

const TIER_LABELS = [
  { min: 1.5, cls: 'tier-primary', label: 'Primary control' },
  { min: 0.9, cls: 'tier-neutral', label: 'Some relevance' },
  { min: 0.5, cls: 'tier-limited', label: 'Limited relevance' },
  { min: 0, cls: 'tier-minimal', label: 'Minimal / not applicable' }
];
function tierFor(mult) {
  return TIER_LABELS.find(t => mult >= t.min);
}

function openManual() {
  if (state.screen === 'playing') state.paused = true;
  manualOverlay.classList.remove('hidden');
  renderManualTab(state.manualTab);
}
function closeManual() {
  state.paused = false;
  manualOverlay.classList.add('hidden');
}
manualBtn.addEventListener('click', openManual);
manualCloseBtn.addEventListener('click', closeManual);
manualTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    manualTabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.manualTab = btn.dataset.tab;
    renderManualTab(state.manualTab);
  });
});

function renderManualTab(tab) {
  if (tab === 'defenses') renderManualDefenses();
  else if (tab === 'threats') renderManualThreats();
  else renderManualMatrix();
}

function renderManualDefenses() {
  manualContent.innerHTML = Object.entries(towerTypes).map(([key, def]) => {
    const rows = def.levels.map((lvl, i) => `
      <tr>
        <td>Lv${i + 1}</td>
        <td>${i === 0 ? '$' + lvl.cost : '$' + def.levels[i - 1].upgradeCost}</td>
        <td>${lvl.range}</td>
        <td>${lvl.fireRate}ms</td>
        <td>${lvl.damage}</td>
        <td>${Math.round(lvl.resistance * 100)}%</td>
        <td>${specialSummary(key, lvl)}</td>
      </tr>`).join('');
    return `
      <div class="manual-entry">
        <h3>${def.icon} ${def.label} <span style="font-weight:normal; color:var(--text-dim); font-size:0.8rem;">(max ${def.maxCount} deployed)</span></h3>
        <p>${def.desc}</p>
        <table>
          <tr><th>Level</th><th>Cost</th><th>Range</th><th>Rate</th><th>DMG</th><th>Resist</th><th>Ability at this level</th></tr>
          ${rows}
        </table>
      </div>`;
  }).join('');
}

function renderManualThreats() {
  manualContent.innerHTML = Object.entries(enemyTypes).map(([key, def]) => {
    const disableInfo = def.disables
      ? `<p><b>Disable ability:</b> ${Math.round(def.disableChance * 100)}% chance every ${(def.disableInterval / 1000).toFixed(1)}s to disable ${def.disables === 'any' ? 'any nearby defense' : 'a nearby ' + towerTypes[def.disables].label} for up to ${(def.disableDuration / 1000).toFixed(1)}s (reduced by that defense's resistance stat).</p>`
      : `<p><b>Disable ability:</b> none.</p>`;
    return `
      <div class="manual-entry">
        <h3>${def.icon} ${def.label}</h3>
        <p><b>HP</b> ${def.hp} | <b>Speed</b> ${def.speed} | <b>Bounty</b> $${def.bounty} | Reaching the server counts as 1 of your ${MAX_BREACHES} allowed breaches</p>
        <p><b>Real-world threat:</b> ${def.tip}</p>
        ${disableInfo}
      </div>`;
  }).join('');
}

function renderManualMatrix() {
  const towerKeys = Object.keys(towerTypes);
  const header = `<tr><th></th>${towerKeys.map(t => `<th>${towerTypes[t].icon}<br>${towerTypes[t].label}</th>`).join('')}</tr>`;
  const rows = Object.entries(enemyTypes).map(([ekey, edef]) => {
    const cells = towerKeys.map(tkey => {
      const mult = edef.effectiveness[tkey];
      const tier = tierFor(mult);
      return `<td class="${tier.cls}" data-enemy="${ekey}" data-tower="${tkey}">${mult.toFixed(2)}x</td>`;
    }).join('');
    return `<tr><td class="matrix-row-label">${edef.icon} ${edef.label}</td>${cells}</tr>`;
  }).join('');
  manualContent.innerHTML = `
    <p style="color:var(--text-dim); font-size:0.82rem;">Click any cell for the real-world rationale behind that matchup. Multipliers reflect researched effectiveness: <span style="color:#baffd4;">1.8x = primary/purpose-built control</span>, <span style="color:#ffe6a3;">1.0x = some relevance</span>, <span style="color:#ffcf9e;">0.6x = limited</span>, <span style="color:#ffb3b3;">0.35x = minimal-to-none</span>.</p>
    <table class="matrix-table">${header}${rows}</table>
    <div id="matrix-explainer">Click a cell in the table above to see why.</div>
  `;
  manualContent.querySelectorAll('.matrix-table td[data-enemy]').forEach(cell => {
    cell.addEventListener('click', () => {
      const ekey = cell.dataset.enemy, tkey = cell.dataset.tower;
      const edef = enemyTypes[ekey], tdef = towerTypes[tkey];
      const mult = edef.effectiveness[tkey];
      const tier = tierFor(mult);
      document.getElementById('matrix-explainer').innerHTML =
        `<b>${tdef.icon} ${tdef.label} vs ${edef.icon} ${edef.label} — ${mult.toFixed(2)}x (${tier.label})</b><br>${edef.effectivenessNotes[tkey]}`;
    });
  });
}

/* ---------- Init ---------- */

(function init() {
  updateShopUI();
  renderIntro();
  requestAnimationFrame(loop);
})();
