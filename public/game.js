// =====================================================
// LOVE ZONE WEB - FULL GAME.JS (A: 맵 탐색형 쯔꾸르)
// - 대화 스크립트 엔진(타이핑)
// - 토스트(🔔/♥)
// - 거리 m 토스트 + LoveZone 진입 토스트
// - 페널티(호감도<0 & LoveZone 진입)
// - 타이머: 3초 토스트 → 우상단 HUD
// - NPC: 근접 + SPACE로 대화
// - 저장/불러오기: F5 저장, F9 불러오기
// =====================================================

// ========= DOM UI =========
const box = document.getElementById("box");
const boxTitle = document.getElementById("boxTitle");
const boxText = document.getElementById("boxText");
const boxChoices = document.getElementById("boxChoices");

const toast = document.getElementById("toast");
const toastTitle = document.getElementById("toastTitle");
const toastText = document.getElementById("toastText");
const toastIconL = document.getElementById("toastIconL");
const toastIconR = document.getElementById("toastIconR");

const timerHud = document.getElementById("timerHud");
const timerLabel = document.getElementById("timerLabel");
const timerValue = document.getElementById("timerValue");

let toastTimer = null;
function showToast({ title = "알림", text = "", ms = 1400, icon = "🔔" } = {}) {
  if (!toast || !toastTitle || !toastText) return;

  toastTitle.textContent = title;
  toastText.textContent = text;

  if (toastIconL) toastIconL.textContent = icon;
  if (toastIconR) toastIconR.textContent = icon;

  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), ms);
}

function openBox() { box?.classList.remove("hidden"); }
function closeBox() {
  box?.classList.add("hidden");
  if (boxTitle) boxTitle.textContent = "";
  if (boxText) boxText.textContent = "";
  if (boxChoices) boxChoices.innerHTML = "";
}

function renderChoices(choices, onPick) {
  if (!boxChoices) return;
  boxChoices.innerHTML = "";
  for (const ch of choices) {
    const b = document.createElement("div");
    b.className = "choice";
    b.textContent = ch.label;
    b.onclick = () => onPick(ch);
    boxChoices.appendChild(b);
  }
}

// ========= Game State =========
const state = {
  affection: -20,
  seenLoveZoneIntro: false,
  lastZoneMeters: null,
  lastZoneDistanceToastAt: 0,
  lastPenaltyAt: 0,
  timer: { active: false, secondsLeft: 0, label: "" }
};

function setAff(v) {
  state.affection = v;
  // 상시 표시 안 함(토스트로만)
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function showTimerHud(labelText) {
  if (!timerHud) return;
  timerHud.classList.remove("hidden");
  if (timerLabel) timerLabel.textContent = labelText || "제한 시간";
}
function hideTimerHud() {
  if (!timerHud) return;
  timerHud.classList.add("hidden");
}
function updateTimerHud() {
  if (!timerValue) return;
  timerValue.textContent = formatMMSS(state.timer.secondsLeft);
}

function startTimer(seconds, label) {
  state.timer.active = true;
  state.timer.secondsLeft = seconds;
  state.timer.label = label || "제한 시간";

  // 1) 토스트 3초
  showToast({
    title: "알림",
    icon: "🔔",
    text: `제한 시간 ${formatMMSS(seconds)}`,
    ms: 3000
  });

  // 2) 3초 뒤 HUD로
  setTimeout(() => {
    showTimerHud(state.timer.label);
    updateTimerHud();
  }, 3000);
}

// ========= Script Engine =========
let scripts = null;
let running = null; // { list, i }
let typing = false;
const TYPE_SPEED_MS = 18;
let typingTimer = null;
let locked = false;

function typeText(fullText) {
  typing = true;
  if (boxText) boxText.textContent = "";
  let i = 0;

  if (typingTimer) clearInterval(typingTimer);
  typingTimer = setInterval(() => {
    i += 1;
    if (boxText) boxText.textContent = fullText.slice(0, i);
    if (i >= fullText.length) {
      clearInterval(typingTimer);
      typingTimer = null;
      typing = false;
    }
  }, TYPE_SPEED_MS);
}

function runScript(key) {
  if (!scripts?.[key]) {
    console.warn("스크립트 키 없음:", key);
    return;
  }
  running = { list: scripts[key], i: 0 };
  openBox();
  step();
}

function step(nextKeyFromChoice) {
  if (!running) return;

  if (nextKeyFromChoice) {
    runScript(nextKeyFromChoice);
    return;
  }

  if (running.i >= running.list.length) {
    running = null;
    closeBox();
    locked = false;
    return;
  }

  const cmd = running.list[running.i++];
  handleCmd(cmd);
}

let currentScene = null;

let spawnPoints = {
  classroom: { x: 420, y: 360 },
  hallway: { x: 820, y: 360 },
  rooftop: { x: 1850, y: 250 }
};

function handleCmd(cmd) {
  locked = true;

  if (cmd.type === "alert") {
    if (boxTitle) boxTitle.textContent = cmd.title || "(알림)";
    if (boxChoices) boxChoices.innerHTML = "";
    typeText(cmd.text || "");
    locked = false;
    return;
  }

  if (cmd.type === "choice") {
    if (boxTitle) boxTitle.textContent = cmd.title || "(선택)";
    if (boxText) boxText.textContent = cmd.text || "";
    renderChoices(cmd.choices || [], (ch) => step(ch.next));
    locked = false;
    return;
  }

  if (cmd.type === "setAffection") {
    setAff(cmd.value);

    showToast({
      title: "호감도",
      icon: "♥",
      text: `호감도 ${cmd.value >= 0 ? "+" : ""}${cmd.value}`,
      ms: 1400
    });

    locked = false;
    step();
    return;
  }

  if (cmd.type === "setTimer") {
    startTimer(cmd.seconds || 0, cmd.label || "제한 시간");
    locked = false;
    step();
    return;
  }

  if (cmd.type === "fadeOut") {
    const ms = cmd.ms ?? 400;
    currentScene.cameras.main.fadeOut(ms, 0, 0, 0);
    currentScene.time.delayedCall(ms, () => {
      locked = false;
      step();
    });
    return;
  }

  if (cmd.type === "fadeIn") {
    const ms = cmd.ms ?? 400;
    currentScene.cameras.main.fadeIn(ms, 0, 0, 0);
    currentScene.time.delayedCall(ms, () => {
      locked = false;
      step();
    });
    return;
  }

  if (cmd.type === "teleport") {
    const to = cmd.to;
    const p = spawnPoints[to];
    if (p && player) {
      player.setPosition(p.x, p.y);
      currentScene.cameras.main.centerOn(p.x, p.y);
    }
    locked = false;
    step();
    return;
  }

  if (cmd.type === "goto") {
    locked = false;
    step(cmd.next);
    return;
  }

  locked = false;
  step();
}

// Space로 진행(선택지는 클릭)
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;

  // 박스가 안 열려있으면 무시
  if (box?.classList.contains("hidden")) return;

  // 선택지 있으면 클릭으로만 선택
  if (boxChoices && boxChoices.childElementCount > 0) return;

  // 타이핑 중이면 스킵(완성 표시)만 하고 종료
  if (typing) {
    if (typingTimer) clearInterval(typingTimer);
    typingTimer = null;
    typing = false;
    return;
  }

  if (!locked) step();
});

// 저장/불러오기 (F5 / F9)
const SAVE_KEY = "lovezone_save_v1";

function saveGame() {
  if (!player) return;
  const data = {
    v: 1,
    ts: Date.now(),
    player: { x: player.x, y: player.y },
    affection: state.affection,
    seenLoveZoneIntro: state.seenLoveZoneIntro,
    timer: { ...state.timer }
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  showToast({ title: "알림", icon: "🔔", text: "저장되었습니다.", ms: 900 });
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    showToast({ title: "알림", icon: "🔔", text: "저장 데이터가 없습니다.", ms: 900 });
    return;
  }
  const data = JSON.parse(raw);
  if (data?.v !== 1) return;

  state.affection = data.affection ?? state.affection;
  state.seenLoveZoneIntro = !!data.seenLoveZoneIntro;
  state.timer = data.timer ?? state.timer;

  if (player && data.player) {
    player.setPosition(data.player.x, data.player.y);
    currentScene.cameras.main.centerOn(player.x, player.y);
  }

  if (state.timer.active) {
    showTimerHud(state.timer.label);
    updateTimerHud();
  } else {
    hideTimerHud();
  }

  showToast({ title: "알림", icon: "🔔", text: "불러왔습니다.", ms: 900 });
}

window.addEventListener("keydown", (e) => {
  if (e.code === "F5") { e.preventDefault(); saveGame(); }
  if (e.code === "F9") { e.preventDefault(); loadGame(); }
});

// ========= Phaser Game =========
const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#0b0b0f",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: "arcade", arcade: { debug: false } },
  scene: { preload, create, update }
};

new Phaser.Game(config);

let cursors, wasd, interactKey;
let player, walls, cha, zones;
let npcs = [];
let interactHint = null;
let lastNpcInteractAt = 0;

let lastZoneToastAt = 0;
let didBoot = false;

function preload() {
  this.load.json("ep1", "data/ep1.json");
}

function triggerPenalty(reasonText = "마이너스 호감도로 인해 페널티가 적용됩니다.") {
  const now = Date.now();
  if (now - state.lastPenaltyAt < 3500) return;
  state.lastPenaltyAt = now;

  showToast({ title: "알림", icon: "🔔", text: reasonText, ms: 1200 });

  // 글리치
  if (currentScene?.glitch) {
    currentScene.glitch.setAlpha(0.35);
    currentScene.tweens.add({
      targets: currentScene.glitch,
      alpha: 0,
      duration: 280,
      yoyo: true,
      repeat: 2
    });
  }

  // 예시 페널티: 호감도 추가 하락
  const drop = 2;
  state.affection -= drop;
  showToast({ title: "호감도", icon: "♥", text: `호감도 -${drop}`, ms: 900 });
}

function create() {
  currentScene = this;

  // scripts
  scripts = this.cache.json.get("ep1");
  if (!scripts) {
    console.error("ep1.json 로드 실패: public/data/ep1.json 경로 확인!");
    showToast({ title: "알림", icon: "🔔", text: "스크립트 로드 실패", ms: 1500 });
    return;
  }

  // === 런타임 텍스처 생성 ===
  const g = this.add.graphics();

  // floor
  g.fillStyle(0x1f2937, 1);
  g.fillRect(0, 0, 32, 32);
  g.generateTexture("floor", 32, 32);
  g.clear();

  // wall
  g.fillStyle(0x4b5563, 1);
  g.fillRect(0, 0, 32, 32);
  g.lineStyle(2, 0x111827, 1);
  g.strokeRect(1, 1, 30, 30);
  g.generateTexture("wall", 32, 32);
  g.clear();

  // player
  g.fillStyle(0x00ff66, 1);
  g.fillRoundedRect(0, 0, 30, 30, 8);
  g.lineStyle(3, 0x000000, 1);
  g.strokeRoundedRect(1, 1, 28, 28, 8);
  g.generateTexture("player", 30, 30);
  g.clear();

  // cha
  g.fillStyle(0xff2d9b, 1);
  g.fillRoundedRect(0, 0, 30, 30, 8);
  g.lineStyle(3, 0x000000, 1);
  g.strokeRoundedRect(1, 1, 28, 28, 8);
  g.generateTexture("cha", 30, 30);
  g.clear();

  // npc
  g.fillStyle(0x7bd3ff, 1);
  g.fillRoundedRect(0, 0, 30, 30, 8);
  g.lineStyle(3, 0x000000, 1);
  g.strokeRoundedRect(1, 1, 28, 28, 8);
  g.generateTexture("npc", 30, 30);
  g.destroy();

  // === 월드 ===
  const worldW = 2200;
  const worldH = 1400;

  for (let y = 0; y < worldH; y += 32) {
    for (let x = 0; x < worldW; x += 32) {
      this.add.image(x, y, "floor").setOrigin(0);
    }
  }

  // walls
  walls = this.physics.add.staticGroup();

  // border
  for (let x = 0; x < worldW; x += 32) {
    walls.create(x + 16, 16, "wall");
    walls.create(x + 16, worldH - 16, "wall");
  }
  for (let y = 0; y < worldH; y += 32) {
    walls.create(16, y + 16, "wall");
    walls.create(worldW - 16, y + 16, "wall");
  }

  // simple classroom blocks
  for (let x = 200; x <= 700; x += 32) walls.create(x, 200, "wall");
  for (let y = 200; y <= 520; y += 32) walls.create(200, y, "wall");
  for (let y = 200; y <= 520; y += 32) walls.create(700, y, "wall");

  // player
  player = this.physics.add.sprite(420, 360, "player");
  player.setCollideWorldBounds(true);
  player.body.setSize(26, 26, true);
  player.setDepth(9999);

  // player name tag
  const nameTag = this.add.text(player.x - 14, player.y - 42, "명하", {
    fontSize: "16px",
    color: "#00ff66",
    backgroundColor: "#000000",
    padding: { x: 4, y: 2 }
  }).setDepth(9999);

  // cha
  cha = this.physics.add.staticSprite(1850, 250, "cha");
  cha.setDepth(9999);

  // NPCs
  npcs = [];
  const npcTags = [];

  const addNpc = (x, y, name, scriptKey) => {
    const s = this.physics.add.staticSprite(x, y, "npc").setDepth(9999);
    const tag = this.add.text(x - 20, y - 42, name, {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 4, y: 2 }
    }).setDepth(9999);
    npcs.push({ sprite: s, name, scriptKey });
    npcTags.push({ sprite: s, tag });
  };

  addNpc(520, 360, "안경훈", "talk_kyunghoon");
  addNpc(640, 360, "천상원", "talk_cheonsangwon");

  // collisions
  this.physics.add.collider(player, walls);

  // camera
  this.cameras.main.startFollow(player);
  this.cameras.main.setBounds(0, 0, worldW, worldH);
  this.physics.world.setBounds(0, 0, worldW, worldH);

  // follow tags
  this.events.on("postupdate", () => {
    nameTag.setPosition(player.x - 14, player.y - 42);
    for (const nt of npcTags) nt.tag.setPosition(nt.sprite.x - 20, nt.sprite.y - 42);
  });

  // interact hint
  interactHint = this.add.text(20, 20, "SPACE: 대화", {
    fontSize: "16px",
    color: "#ffffff",
    backgroundColor: "#000000",
    padding: { x: 6, y: 4 }
  }).setDepth(99999);
  interactHint.setScrollFactor(0);
  interactHint.setVisible(false);

  // vignette glow (LoveZone)
  const vignette = this.add.rectangle(0, 0, 960, 540, 0x66ccff, 0);
  vignette.setDepth(99997);
  vignette.setScrollFactor(0);
  this.vignette = vignette;

  // glitch overlay
  const glitch = this.add.rectangle(0, 0, 960, 540, 0xffffff, 0);
  glitch.setDepth(99998);
  glitch.setScrollFactor(0);
  this.glitch = glitch;

  // input
  cursors = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys("W,A,S,D");
  interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  // zones
  zones = [];
  zones.push(makeZone(this, 760, 260, 220, 200, "hallway_tutorial", true));
  zones.push(makeZone(this, 900, 900, 400, 300, "start_find_yeoun", true));
  zones.push(makeZone(this, 1700, 150, 520, 320, "enter_rooftop", true));

  // timer tick (1s)
  this.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => {
      if (!state.timer.active) return;
      state.timer.secondsLeft -= 1;
      if (state.timer.secondsLeft <= 0) {
        state.timer.secondsLeft = 0;
        state.timer.active = false;
        updateTimerHud();
        // TODO: 시간 종료 페널티/배드엔딩 처리
        return;
      }
      updateTimerHud();
    }
  });

  // init ui
  setAff(state.affection);
  updateTimerHud();
  hideTimerHud();

  // start script
  if (!didBoot) {
    didBoot = true;
    runScript("prologue_izakaya");
  }
}

function makeZone(scene, x, y, w, h, scriptKey, once) {
  const zone = scene.add.zone(x + w / 2, y + h / 2, w, h);
  scene.physics.world.enable(zone);
  zone.body.setAllowGravity(false);
  zone.body.setImmovable(true);
  return { zone, scriptKey, once, fired: false };
}

function update() {
  if (!cursors || !wasd || !player) return;

  // 대화 중 이동 막기
  const inBox = !box?.classList.contains("hidden");
  if (inBox) {
    player.setVelocity(0, 0);
    return;
  }

  // 이동
  const speed = 180;
  let vx = 0, vy = 0;

  const left = cursors.left.isDown || wasd.A.isDown;
  const right = cursors.right.isDown || wasd.D.isDown;
  const up = cursors.up.isDown || wasd.W.isDown;
  const down = cursors.down.isDown || wasd.S.isDown;

  if (left) vx -= speed;
  if (right) vx += speed;
  if (up) vy -= speed;
  if (down) vy += speed;
  if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }

  player.setVelocity(vx, vy);

  // 존 트리거
  for (const z of zones) {
    if (z.once && z.fired) continue;

    const rect = new Phaser.Geom.Rectangle(
      z.zone.x - z.zone.width / 2,
      z.zone.y - z.zone.height / 2,
      z.zone.width,
      z.zone.height
    );

    if (Phaser.Geom.Rectangle.Contains(rect, player.x, player.y)) {
      z.fired = true;
      runScript(z.scriptKey);
      break;
    }
  }

  // ===== NPC 상호작용(가까우면 힌트 표시) =====
  let nearestNpc = null;
  let nearestDist = Infinity;

  for (const n of npcs) {
    const d = Phaser.Math.Distance.Between(player.x, player.y, n.sprite.x, n.sprite.y);
    if (d < nearestDist) { nearestDist = d; nearestNpc = n; }
  }

  const CAN_TALK_DIST = 90;
  if (nearestNpc && nearestDist <= CAN_TALK_DIST) {
    interactHint?.setVisible(true);
    interactHint?.setText("SPACE: 대화");
  } else {
    interactHint?.setVisible(false);
  }

  // ===== 연애 지상주의 구역(거리 토스트 + 진입 토스트) =====
  const dist = Phaser.Math.Distance.Between(player.x, player.y, cha.x, cha.y);
  const ZONE_RADIUS_PX = 160;
  const PX_PER_M = 32;
  const inLoveZone = dist <= ZONE_RADIUS_PX;

  // LoveZone glow
  if (currentScene?.vignette) currentScene.vignette.setAlpha(inLoveZone ? 0.08 : 0);

  // ...까지 Xm (존 바깥에서만)
  if (!inLoveZone) {
    const remainingPx = Math.max(0, dist - ZONE_RADIUS_PX);
    const meters = Math.max(1, Math.ceil(remainingPx / PX_PER_M));

    const now = Date.now();
    const canToast = now - state.lastZoneDistanceToastAt > 450;

    if (meters !== state.lastZoneMeters && canToast) {
      state.lastZoneMeters = meters;
      state.lastZoneDistanceToastAt = now;

      showToast({
        title: "알림",
        icon: "🔔",
        text: `연애 지상주의 구역까지 ${meters}m`,
        ms: 650
      });
    }
  } else {
    state.lastZoneMeters = null;
  }

  // 첫 진입 알림
  if (inLoveZone && !state.seenLoveZoneIntro) {
    state.seenLoveZoneIntro = true;
    lastZoneToastAt = Date.now();
    showToast({
      title: "알림",
      icon: "🔔",
      text: "연애 지상주의 구역이 활성화되었습니다.",
      ms: 1200
    });
  }

  // 페널티(호감도<0 & LoveZone 진입)
  if (inLoveZone && state.affection < 0) {
    triggerPenalty("마이너스 호감도로 인해 페널티가 적용됩니다.");
  }

  // 존 안 랜덤 알림(선택)
  if (inLoveZone) {
    const now = Date.now();
    if (state.seenLoveZoneIntro && now - lastZoneToastAt > 5000 && Math.random() < 0.35) {
      lastZoneToastAt = now;
      showToast({
        title: "알림",
        icon: "🔔",
        text: "연애 지상주의 구역이 활성화되었습니다.",
        ms: 900
      });
    }
  }

  // ===== SPACE 상호작용 우선순위: NPC > 세계개변 =====
  if (Phaser.Input.Keyboard.JustDown(interactKey)) {
    const now = Date.now();
    if (now - lastNpcInteractAt < 250) return;

    // 1) NPC 대화
    if (nearestNpc && nearestDist <= CAN_TALK_DIST) {
      lastNpcInteractAt = now;
      runScript(nearestNpc.scriptKey);
      return;
    }

    // 2) 차여운 근처면 world_change
    if (dist <= 80) {
      lastNpcInteractAt = now;
      runScript("world_change");
      return;
    }
  }
}