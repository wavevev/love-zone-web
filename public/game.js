// =====================================================
// LOVE ZONE WEB - FULL GAME.JS (A: 맵 탐색형)
// 요구사항 반영:
// 1) 타이핑 중 Space => 문장 전체 즉시 출력 (멈춤 X)
// 2) 토스트 중앙
// 3) 거리토스트만 상단/짧게, 나머지 4초 중앙
// 4) ESC로 대화 강제 종료
// 5) 선배 대화 후 학교로 이동(샘플 ep1.json에 포함)
// 6) 선배 NPC 추가
// 7) 미션 시스템 추가 (토스트 + M 미션로그)
// 8) 장소 이동 추가 (포탈 근처 Space => 이동 메뉴)
// 9) NPC 호감도는 이번엔 미포함
// =====================================================

// ========= DOM UI =========
const box = document.getElementById("box");
const boxTitle = document.getElementById("boxTitle");
const boxText = document.getElementById("boxText");
const boxChoices = document.getElementById("boxChoices");
const boxPrompt = document.getElementById("boxPrompt");
function showPrompt() { boxPrompt?.classList.remove("hidden"); }
function hidePrompt() { boxPrompt?.classList.add("hidden"); }

const toast = document.getElementById("toast");
const toastTitle = document.getElementById("toastTitle");
const toastText = document.getElementById("toastText");
const toastIconL = document.getElementById("toastIconL");
const toastIconR = document.getElementById("toastIconR");

const timerHud = document.getElementById("timerHud");
const timerLabel = document.getElementById("timerLabel");
const timerValue = document.getElementById("timerValue");

// ========= Toast =========
let toastTimer = null;
function showToast({
  title = "알림",
  text = "",
  ms = 4000,              // 기본 4초
  icon = "🔔",
  position = "center"     // 기본 중앙
} = {}) {
  if (!toast || !toastTitle || !toastText) return;

  toastTitle.textContent = title;
  toastText.textContent = text;

  if (toastIconL) toastIconL.textContent = icon;
  if (toastIconR) toastIconR.textContent = icon;

  toast.classList.remove("hidden");

  // 위치 클래스
  toast.classList.remove("toast-center", "toast-top");
  toast.classList.add(position === "top" ? "toast-top" : "toast-center");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), ms);
}

// ========= Box =========
function openBox() {
  box?.classList.remove("hidden");
  hidePrompt();
}
function closeBox() {
  box?.classList.add("hidden");
  if (boxTitle) boxTitle.textContent = "";
  if (boxText) boxText.textContent = "";
  if (boxChoices) boxChoices.innerHTML = "";
  hidePrompt();
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

  // LoveZone
  seenLoveZoneIntro: false,
  lastZoneMeters: null,
  lastZoneDistanceToastAt: 0,
  lastZoneToastAt: 0,

  // penalty
  lastPenaltyAt: 0,

  // timer
  timer: { active: false, secondsLeft: 0, label: "" },

  // missions
  mainMission: "",
  missions: {} // id: { text, status: "active"|"done"|"fail" }
};

function setAff(v) {
  state.affection = v; // 상시표시 X
}

// ========= Timer HUD =========
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

  // 토스트 3초 (중앙)
  showToast({
    title: "알림",
    icon: "🔔",
    text: `제한 시간 ${formatMMSS(seconds)}`,
    ms: 3000,
    position: "center"
  });

  // 3초 후 HUD로 전환
  setTimeout(() => {
    showTimerHud(state.timer.label);
    updateTimerHud();
  }, 3000);
}

// ========= Missions =========
function setMainMission(text) {
  state.mainMission = text || "";
  if (text) showToast({ title: "미션", icon: "🔔", text: `메인 미션\n${text}` });
}
function addMission(id, text) {
  if (!id) return;
  state.missions[id] = { text: text || id, status: "active" };
  showToast({ title: "미션", icon: "🔔", text: `서브 미션 추가\n${state.missions[id].text}` });
}
function completeMission(id) {
  if (!id || !state.missions[id]) return;
  state.missions[id].status = "done";
  showToast({ title: "미션", icon: "🔔", text: `서브 미션 완료\n${state.missions[id].text}` });
}
function failMission(id) {
  if (!id || !state.missions[id]) return;
  state.missions[id].status = "fail";
  showToast({ title: "미션", icon: "🔔", text: `서브 미션 실패\n${state.missions[id].text}` });
}
function openMissionLog() {
  openBox();
  if (boxTitle) boxTitle.textContent = "(미션)";
  if (boxChoices) boxChoices.innerHTML = "";

  let lines = [];
  if (state.mainMission) lines.push(`메인: ${state.mainMission}`);
  const ids = Object.keys(state.missions);
  if (ids.length === 0) lines.push("서브 미션: 없음");
  else {
    lines.push("서브:");
    for (const id of ids) {
      const m = state.missions[id];
      const mark = m.status === "done" ? "✅" : (m.status === "fail" ? "❌" : "•");
      lines.push(`${mark} ${m.text}`);
    }
  }
  if (boxText) boxText.textContent = lines.join("\n");
}

// ========= Script Engine =========
let scripts = null;
let running = null; // { list, i }
let typing = false;
const TYPE_SPEED_MS = 18;
let typingTimer = null;
let currentTypingFullText = "";
let locked = false;

function typeText(fullText) {
  typing = true;
  currentTypingFullText = fullText || "";
  hidePrompt();
  if (boxText) boxText.textContent = "";
  let i = 0;

  if (typingTimer) clearInterval(typingTimer);
  typingTimer = setInterval(() => {
    i += 1;
    if (boxText) boxText.textContent = currentTypingFullText.slice(0, i);
    if (i >= currentTypingFullText.length) {
      clearInterval(typingTimer);
      typingTimer = null;
      typing = false;
      showPrompt(); // ✅ 문장 다 찍히면 ▼ 표시
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
  izakaya:   { x: 300,  y: 360 },
  classroom: { x: 1280, y: 360 },
  hallway:   { x: 1500, y: 360 },
  yard:      { x: 1750, y: 900 },
  rooftop:   { x: 1850, y: 250 },
  crosswalk: { x: 1120, y: 1050 }
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
    hidePrompt();           // ✅ 선택지면 ▼ 안 보이게
    renderChoices(cmd.choices || [], (ch) => step(ch.next));
    locked = false;
    return;
  }

  if (cmd.type === "setAffection") {
    setAff(cmd.value);

    showToast({
      title: "호감도",
      icon: "♥",
      text: `호감도 ${cmd.value >= 0 ? "+" : ""}${cmd.value}`
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

  // missions
  if (cmd.type === "setMainMission") {
    setMainMission(cmd.text || "");
    locked = false;
    step();
    return;
  }
  if (cmd.type === "addMission") {
    addMission(cmd.id, cmd.text);
    locked = false;
    step();
    return;
  }
  if (cmd.type === "completeMission") {
    completeMission(cmd.id);
    locked = false;
    step();
    return;
  }
  if (cmd.type === "failMission") {
    failMission(cmd.id);
    locked = false;
    step();
    return;
  }

  if (cmd.type === "fadeOut") {
    const ms = cmd.ms ?? 400;
    currentScene.cameras.main.fadeOut(ms, 0, 0, 0);
    currentScene.time.delayedCall(ms, () => { locked = false; step(); });
    return;
  }

  if (cmd.type === "fadeIn") {
    const ms = cmd.ms ?? 400;
    currentScene.cameras.main.fadeIn(ms, 0, 0, 0);
    currentScene.time.delayedCall(ms, () => { locked = false; step(); });
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

// ========= Key controls =========

// Space: 대화 진행
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;

  // 박스가 닫혀있으면 여기서는 무시(맵 상호작용은 Phaser update에서 처리)
  if (box?.classList.contains("hidden")) return;

  // 선택지 있으면 클릭으로만
  if (boxChoices && boxChoices.childElementCount > 0) return;

  // ✅ 타이핑 중이면: 문장 전체 즉시 출력
  if (typing) {
    if (typingTimer) clearInterval(typingTimer);
    typingTimer = null;
    typing = false;
    if (boxText) boxText.textContent = currentTypingFullText;
    showPrompt(); // ✅ 스킵하면 즉시 ▼
    return;
  }

  if (!locked) step();
});

// ESC: 대화 강제 종료
window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape") return;

  if (box && !box.classList.contains("hidden")) {
    if (typingTimer) clearInterval(typingTimer);
    typingTimer = null;
    typing = false;

    running = null;
    locked = false;
    closeBox();
  }
});

// M: 미션 로그
window.addEventListener("keydown", (e) => {
  if (e.code !== "KeyM") return;
  openMissionLog();
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
    timer: { ...state.timer },
    mainMission: state.mainMission,
    missions: state.missions
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  showToast({ title: "알림", icon: "🔔", text: "저장되었습니다." });
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    showToast({ title: "알림", icon: "🔔", text: "저장 데이터가 없습니다." });
    return;
  }
  const data = JSON.parse(raw);
  if (data?.v !== 1) return;

  state.affection = data.affection ?? state.affection;
  state.seenLoveZoneIntro = !!data.seenLoveZoneIntro;
  state.timer = data.timer ?? state.timer;
  state.mainMission = data.mainMission ?? state.mainMission;
  state.missions = data.missions ?? state.missions;

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

  showToast({ title: "알림", icon: "🔔", text: "불러왔습니다." });
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
let portals = [];
let interactHint = null;
let lastInteractAt = 0;

function preload() {
  this.load.json("ep1", "data/ep1.json");
  this.load.tilemapTiledJSON("map_school", "maps/school.json");
  this.load.image("tiles_school", "tilesets/school_tiles.png");
  this.load.spritesheet("taemyeongha","images/taemyeongha_sheet.png",{ frameWidth:32, frameHeight:48 });
  this.load.spritesheet("chayeoun","images/chayeoun_sheet.png",{ frameWidth:32, frameHeight:48 });
  this.load.spritesheet("cheonsangwon","images/cheonsangwon_sheet.png",{ frameWidth:32, frameHeight:48 });
  this.load.spritesheet("angyeonghun","images/angyeonghun_sheet.png",{ frameWidth:32, frameHeight:48 });
  this.load.spritesheet("senbae","images/senbae_sheet.png",{ frameWidth:32, frameHeight:48 });
}

// ========= Penalty =========
function triggerPenalty(reasonText = "마이너스 호감도로 인해 페널티가 적용됩니다.") {
  const now = Date.now();
  if (now - state.lastPenaltyAt < 3500) return;
  state.lastPenaltyAt = now;

  showToast({ title: "알림", icon: "🔔", text: reasonText });

  // 글리치
  if (currentScene?.glitch) {
    currentScene.glitch.setAlpha(0.35);
    currentScene.tweens.add({
      targets: currentScene.glitch,
      alpha: 0,
      duration: 260,
      yoyo: true,
      repeat: 2
    });
  }

  // 예시 페널티: 호감도 추가 하락
  const drop = 2;
  state.affection -= drop;
  showToast({ title: "호감도", icon: "♥", text: `호감도 -${drop}` });
}

// ========= Travel Menu =========
function openTravelMenu(title, options) {
  // options: [{ label, to }]
  openBox();
  if (boxTitle) boxTitle.textContent = title || "(이동)";
  if (boxText) boxText.textContent = "어디로 이동할까?";
  renderChoices(options, (ch) => {
    closeBox();
    // 순간이동
    const p = spawnPoints[ch.to];
    if (p && player) {
      currentScene.cameras.main.fadeOut(220, 0, 0, 0);
      currentScene.time.delayedCall(220, () => {
        player.setPosition(p.x, p.y);
        currentScene.cameras.main.centerOn(p.x, p.y);
        currentScene.cameras.main.fadeIn(220, 0, 0, 0);
      });
    }
  });
}

// ========= Create =========
function create() {
  currentScene = this;

  // scripts
  scripts = this.cache.json.get("ep1");
  if (!scripts) {
    console.error("ep1.json 로드 실패: public/data/ep1.json 경로 확인!");
    showToast({ title: "알림", icon: "🔔", text: "스크립트 로드 실패" });
    return;
  }

  function create() {
  currentScene = this;

  // scripts
  scripts = this.cache.json.get("ep1");
  if (!scripts) return;

  // ✅ 타일맵 만들기
  const map = this.make.tilemap({ key: "map_school" });

  // ✅ Tiled에서 tileset 이름이 뭔지 정확히 맞춰야 함
  // 예: Tiled에서 tileset 이름이 "school_tiles" 라면 아래처럼
  const tileset = map.addTilesetImage("school_tiles", "tiles_school");

  // ✅ 레이어 만들기 (Tiled 레이어 이름 그대로)
  const ground = map.createLayer("Ground", tileset, 0, 0);
  const wallsLayer = map.createLayer("Walls", tileset, 0, 0);

  // ✅ 충돌 (타일 속성 collides=true 로 지정했을 때)
  wallsLayer.setCollisionByProperty({ collides: true });

  // 월드 크기 = 타일맵 크기
  this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  // 플레이어 생성
  player = this.physics.add.sprite(200, 200, "player");
  player.setCollideWorldBounds(true);

  // ✅ 충돌 연결
  this.physics.add.collider(player, wallsLayer);

  // 카메라
  this.cameras.main.startFollow(player);

  // 나머지(입력, 스크립트 시작 등) 계속...
  runScript("prologue_izakaya");
}

  // === runtime textures ===
  const g = this.add.graphics();

  // floors (두 맵 느낌)
  g.fillStyle(0x1b1020, 1); g.fillRect(0, 0, 32, 32); g.generateTexture("floor_izakaya", 32, 32); g.clear();
  g.fillStyle(0x1f2937, 1); g.fillRect(0, 0, 32, 32); g.generateTexture("floor_school", 32, 32); g.clear();

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
  g.clear();

  // portal
  g.fillStyle(0xffd24a, 1);
  g.fillRoundedRect(0, 0, 30, 30, 6);
  g.lineStyle(3, 0x000000, 1);
  g.strokeRoundedRect(1, 1, 28, 28, 6);
  g.generateTexture("portal", 30, 30);
  g.destroy();

  // === world ===
  const worldW = 2400;
  const worldH = 1400;

  // 맵 구역:
  // - 이자카야(왼쪽) 0~900
  // - 학교(오른쪽) 900~2400
  for (let y = 0; y < worldH; y += 32) {
    for (let x = 0; x < worldW; x += 32) {
      const tex = (x < 900) ? "floor_izakaya" : "floor_school";
      this.add.image(x, y, tex).setOrigin(0);
    }
  }

  // walls
  walls = this.physics.add.staticGroup();
  for (let x = 0; x < worldW; x += 32) {
    walls.create(x + 16, 16, "wall");
    walls.create(x + 16, worldH - 16, "wall");
  }
  for (let y = 0; y < worldH; y += 32) {
    walls.create(16, y + 16, "wall");
    walls.create(worldW - 16, y + 16, "wall");
  }

  // 교실 느낌 벽(학교쪽)
  for (let x = 1200; x <= 1700; x += 32) walls.create(x, 200, "wall");
  for (let y = 200; y <= 520; y += 32) walls.create(1200, y, "wall");
  for (let y = 200; y <= 520; y += 32) walls.create(1700, y, "wall");

  // player
  player = this.physics.add.sprite(spawnPoints.izakaya.x, spawnPoints.izakaya.y, "taemyeongha", 0);
  player.setScale(1); // 필요하면 0.9, 0.8로 더 줄여도 됨
  player.setCollideWorldBounds(true);
  player.body.setSize(18, 28, true); // 32x48에 맞춰 충돌 박스 작게
  player.setDepth(9999);

  this.anims.create({ key:"walk_down",  frames:this.anims.generateFrameNumbers("taemyeongha",{ start:0, end:2 }), frameRate:10, repeat:-1 });
  this.anims.create({ key:"walk_left",  frames:this.anims.generateFrameNumbers("taemyeongha",{ start:3, end:5 }), frameRate:10, repeat:-1 });
  this.anims.create({ key:"walk_right", frames:this.anims.generateFrameNumbers("taemyeongha",{ start:6, end:8 }), frameRate:10, repeat:-1 });
  this.anims.create({ key:"walk_up",    frames:this.anims.generateFrameNumbers("taemyeongha",{ start:9, end:11}), frameRate:10, repeat:-1 });

  // name tag
  const nameTag = this.add.text(player.x - 14, player.y - 42, "명하", {
    fontSize: "16px",
    color: "#00ff66",
    backgroundColor: "#000000",
    padding: { x: 4, y: 2 }
  }).setDepth(9999);

  // cha (옥탑방 쪽)
  cha = this.physics.add.staticSprite(spawnPoints.rooftop.x, spawnPoints.rooftop.y, "chayeoun", 0);
  cha.setScale(1);
  cha.setDepth(9999);

  // NPCs
  npcs = [];
  const npcTags = [];

  const addNpc = (x, y, name, scriptKey, spriteKey="npc") => {
  const s = this.physics.add.staticSprite(x, y, spriteKey, 0).setDepth(9999);
  s.setScale(1);

  const tag = this.add.text(x - 20, y - 42, name, {
    fontSize: "16px",
    color: "#ffffff",
    backgroundColor: "#000000",
    padding: { x: 4, y: 2 }
  }).setDepth(9999);

  npcs.push({ sprite: s, name, scriptKey });
  npcTags.push({ sprite: s, tag });
};

  addNpc(420, 360, "선배", "talk_senbae", "senbae");
  addNpc(1380, 360, "안경훈", "talk_kyunghoon", "angyeonghun");
  addNpc(1560, 360, "천상원", "talk_cheonsangwon", "cheonsangwon");

  // Portals (장소 이동)
  portals = [];
  const addPortal = (x, y, label, menuTitle, options) => {
    const s = this.physics.add.staticSprite(x, y, "portal").setDepth(9999);
    const tag = this.add.text(x - 28, y - 42, label, {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 4, y: 2 }
    }).setDepth(9999);

    portals.push({ sprite: s, tag, label, menuTitle, options });
  };

  // 이자카야 -> 학교 포탈(샘플)
  addPortal(820, 360, "문", "(이동)", [
    { label: "학교(교실)", to: "classroom" },
    { label: "학교(복도)", to: "hallway" }
  ]);

  // 학교 내 이동 포탈들(샘플)
  addPortal(1300, 560, "계단", "(이동)", [
    { label: "복도", to: "hallway" },
    { label: "운동장", to: "yard" },
    { label: "옥상", to: "rooftop" }
  ]);

  addPortal(1750, 980, "정문", "(이동)", [
    { label: "횡단보도", to: "crosswalk" },
    { label: "교실", to: "classroom" }
  ]);

  // collisions
  this.physics.add.collider(player, walls);

  // camera
  this.cameras.main.startFollow(player);
  this.cameras.main.setBounds(0, 0, worldW, worldH);
  this.physics.world.setBounds(0, 0, worldW, worldH);

  // tags follow
  this.events.on("postupdate", () => {
    nameTag.setPosition(player.x - 14, player.y - 42);
    for (const nt of npcTags) nt.tag.setPosition(nt.sprite.x - 20, nt.sprite.y - 42);
    for (const p of portals) p.tag.setPosition(p.sprite.x - 28, p.sprite.y - 42);
  });

  // interact hint
  interactHint = this.add.text(20, 20, "SPACE: 상호작용", {
    fontSize: "16px",
    color: "#ffffff",
    backgroundColor: "#000000",
    padding: { x: 6, y: 4 }
  }).setDepth(99999);
  interactHint.setScrollFactor(0);
  interactHint.setVisible(false);

  // LoveZone glow
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

  // zones (스토리 트리거)
  zones = [];
  zones.push(makeZone(this, 1220, 260, 220, 200, "hallway_tutorial", true));     // 교실근처
  zones.push(makeZone(this, 1700, 900, 400, 300, "start_find_yeoun", true));     // 운동장쪽
  zones.push(makeZone(this, 1680, 150, 520, 320, "enter_rooftop", true));        // 옥상쪽

  // timer tick
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

  // init
  updateTimerHud();
  hideTimerHud();

  // start prologue
  runScript("prologue_izakaya");
}

function makeZone(scene, x, y, w, h, scriptKey, once) {
  const zone = scene.add.zone(x + w/2, y + h/2, w, h);
  scene.physics.world.enable(zone);
  zone.body.setAllowGravity(false);
  zone.body.setImmovable(true);
  return { zone, scriptKey, once, fired: false };
}

// ========= Update =========
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

  // zones
  for (const z of zones) {
    if (z.once && z.fired) continue;
    const rect = new Phaser.Geom.Rectangle(
      z.zone.x - z.zone.width/2,
      z.zone.y - z.zone.height/2,
      z.zone.width,
      z.zone.height
    );
    if (Phaser.Geom.Rectangle.Contains(rect, player.x, player.y)) {
      z.fired = true;
      runScript(z.scriptKey);
      break;
    }
  }

  // nearest NPC / Portal
  let nearest = null; // { type, ref, dist }
  const CAN_INTERACT_DIST = 90;

  for (const n of npcs) {
    const d = Phaser.Math.Distance.Between(player.x, player.y, n.sprite.x, n.sprite.y);
    if (!nearest || d < nearest.dist) nearest = { type: "npc", ref: n, dist: d };
  }
  for (const p of portals) {
    const d = Phaser.Math.Distance.Between(player.x, player.y, p.sprite.x, p.sprite.y);
    if (!nearest || d < nearest.dist) nearest = { type: "portal", ref: p, dist: d };
  }

  if (nearest && nearest.dist <= CAN_INTERACT_DIST) {
    interactHint?.setVisible(true);
    interactHint?.setText(nearest.type === "portal" ? "SPACE: 이동" : "SPACE: 대화");
  } else {
    interactHint?.setVisible(false);
  }

  // LoveZone (차여운 반경)
  const dist = Phaser.Math.Distance.Between(player.x, player.y, cha.x, cha.y);
  const ZONE_RADIUS_PX = 160;
  const PX_PER_M = 32;
  const inLoveZone = dist <= ZONE_RADIUS_PX;

  if (currentScene?.vignette) currentScene.vignette.setAlpha(inLoveZone ? 0.08 : 0);

  // 거리 토스트(상단, 짧게) - 예외 규칙
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
        ms: 650,
        position: "top"
      });
    }
  } else {
    state.lastZoneMeters = null;
  }

  // 진입 토스트(중앙 4초)
  if (inLoveZone && !state.seenLoveZoneIntro) {
    state.seenLoveZoneIntro = true;
    state.lastZoneToastAt = Date.now();
    showToast({ title: "알림", icon: "🔔", text: "연애 지상주의 구역이 활성화되었습니다." });
  }

  // 페널티
  if (inLoveZone && state.affection < 0) {
    triggerPenalty("마이너스 호감도로 인해 페널티가 적용됩니다.");
  }

  // SPACE 상호작용
  if (Phaser.Input.Keyboard.JustDown(interactKey)) {
    const now = Date.now();
    if (now - lastInteractAt < 250) return;
    lastInteractAt = now;

    // 1) 포탈
    if (nearest && nearest.type === "portal" && nearest.dist <= CAN_INTERACT_DIST) {
      openTravelMenu(nearest.ref.menuTitle, nearest.ref.options);
      return;
    }

    // 2) NPC
    if (nearest && nearest.type === "npc" && nearest.dist <= CAN_INTERACT_DIST) {
      runScript(nearest.ref.scriptKey);
      return;
    }

    // 3) 차여운 근처 world_change
    if (dist <= 80) {
      runScript("world_change");
      return;
    }
  }
  
  if (vx === 0 && vy === 0) {
  player.anims.stop();
} else {
  if (Math.abs(vx) > Math.abs(vy)) {
    player.anims.play(vx > 0 ? "walk_right" : "walk_left", true);
  } else {
    player.anims.play(vy > 0 ? "walk_down" : "walk_up", true);
  }
}
}