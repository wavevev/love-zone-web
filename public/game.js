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

let toastTimer = null;
function showToast({ title = "알림", text = "", ms = 1400, icon = "🔔" } = {}) {
  toastTitle.textContent = title;
  toastText.textContent = text;

  if (toastIconL) toastIconL.textContent = icon;
  if (toastIconR) toastIconR.textContent = icon;

  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), ms);
}

let currentScene = null;
let spawnPoints = {
  classroom: { x: 420, y: 360 },
  hallway: { x: 820, y: 360 },
  rooftop: { x: 1850, y: 250 }
};

function openBox() { box.classList.remove("hidden"); }
function closeBox() {
  box.classList.add("hidden");
  boxTitle.textContent = "";
  boxText.textContent = "";
  boxChoices.innerHTML = "";
}

function renderChoices(choices, onPick) {
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
  loveZone: false,
  seenLoveZoneIntro: false,
  lastZoneMeters: null,
  lastZoneDistanceToastAt: 0,
  timer: { active: false, secondsLeft: 0, label: "" }
};

function setAff(v) {
  state.affection = v;
  // ✅ 상시 표시 안 함
}

function startTimer(seconds, label) {
  state.timer.active = true;
  state.timer.secondsLeft = seconds;
  state.timer.label = label || "제한 시간";
  updateTimerUI();
}
function updateTimerUI() {
  if (!state.timer.active) { timerEl.textContent = ""; return; }
  const s = Math.max(0, state.timer.secondsLeft);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  timerEl.textContent = `${state.timer.label}: ${mm}:${ss}`;
}

// ========= Script Engine =========
let scripts = null;
let running = null; // { list, i }
let typing = false;
const TYPE_SPEED_MS = 18; // 숫자 낮을수록 빨라짐(12~25 추천)
let typingTimer = null;

function typeText(fullText) {
  typing = true;
  boxText.textContent = "";
  let i = 0;

  if (typingTimer) clearInterval(typingTimer);

  typingTimer = setInterval(() => {
    i += 1;
    boxText.textContent = fullText.slice(0, i);
    if (i >= fullText.length) {
      clearInterval(typingTimer);
      typingTimer = null;
      typing = false;
    }
  }, TYPE_SPEED_MS);
}
let locked = false;

function runScript(key) {
  if (!scripts?.[key]) return;
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

function handleCmd(cmd) {
  locked = true;

  if (cmd.type === "alert") {
  boxTitle.textContent = cmd.title || "(알림)";
  boxChoices.innerHTML = "";
  typeText(cmd.text || "");
  locked = false;
  return;
}

  if (cmd.type === "choice") {
    boxTitle.textContent = cmd.title || "(선택)";
    boxText.textContent = cmd.text || "";
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
      // 카메라도 즉시 따라오게
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
  if (box.classList.contains("hidden")) return;

  // 선택지 있으면 클릭으로만 선택
  if (boxChoices.childElementCount > 0) return;

  // 타이핑 중이면 "즉시 전체 표시"
  if (typing) {
    if (typingTimer) clearInterval(typingTimer);
    typingTimer = null;
    typing = false;

    // 현재 커맨드의 전체 문장을 그대로 보여주고 싶은데
    // 간단하게는 '지금 boxText가 타이핑 중이니' 그냥 스킵은 하지 않고
    // 다음 step은 한 번 더 Space 눌렀을 때 진행하도록 함.
    // (그래서 여기서는 return)
    return;
  }

  if (!locked) step();
});

// ========= Phaser Game =========
const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#0b0b0f",

  // ✅ 화면에 맞춰 가운데 + 비율 유지
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  physics: { default: "arcade", arcade: { debug: false } },
  scene: { preload, create, update }
};

new Phaser.Game(config);

let cursors, wasd, interactKey;
let player, walls, cha, zones;
let lastZoneToastAt = 0;
let didBoot = false;

function preload() {
  // ✅ Phaser 방식으로 JSON 로드 (fetch/async 안 씀)
  this.load.json("ep1", "data/ep1.json");
}

function create() {
    currentScene = this;

  // ✅ JSON 가져오기
  scripts = this.cache.json.get("ep1");

  if (!scripts) {
  console.error("ep1.json 로드 실패: public/data/ep1.json 경로 확인!");
  showToast({ title: "알림", icon: "🔔", text: "스크립트 로드 실패", ms: 1500 });
  return;
}

  // === 런타임 텍스처 생성(파일 없어도 보이게) ===
  const g = this.add.graphics();

  // floor (조금 더 밝게)
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

  // player (형광 초록)
  g.fillStyle(0x00ff66, 1);
  g.fillRoundedRect(0, 0, 30, 30, 8);
  g.lineStyle(3, 0x000000, 1);
  g.strokeRoundedRect(1, 1, 28, 28, 8);
  g.generateTexture("player", 30, 30);
  g.clear();

  // cha (형광 핑크)
  g.fillStyle(0xff2d9b, 1);
  g.fillRoundedRect(0, 0, 30, 30, 8);
  g.lineStyle(3, 0x000000, 1);
  g.strokeRoundedRect(1, 1, 28, 28, 8);
  g.generateTexture("cha", 30, 30);
  g.destroy();

  // === 월드 ===
  const worldW = 2200;
  const worldH = 1400;

  for (let y = 0; y < worldH; y += 32) {
    for (let x = 0; x < worldW; x += 32) {
      this.add.image(x, y, "floor").setOrigin(0);
    }
  }

  // 벽
  walls = this.physics.add.staticGroup();

  // 테두리
  for (let x = 0; x < worldW; x += 32) {
    walls.create(x + 16, 16, "wall");
    walls.create(x + 16, worldH - 16, "wall");
  }
  for (let y = 0; y < worldH; y += 32) {
    walls.create(16, y + 16, "wall");
    walls.create(worldW - 16, y + 16, "wall");
  }

  // 간단 교실 블럭
  for (let x = 200; x <= 700; x += 32) walls.create(x, 200, "wall");
  for (let y = 200; y <= 520; y += 32) walls.create(200, y, "wall");
  for (let y = 200; y <= 520; y += 32) walls.create(700, y, "wall");

  // === 플레이어 ===
  player = this.physics.add.sprite(420, 360, "player");
  player.setCollideWorldBounds(true);
  player.body.setSize(26, 26, true);
  player.setDepth(9999);

  // 이름표(무조건 보이게)
  const nameTag = this.add.text(player.x - 14, player.y - 42, "명하", {
    fontSize: "16px",
    color: "#00ff66",
    backgroundColor: "#000000",
    padding: { x: 4, y: 2 }
  });
  nameTag.setDepth(9999);

  // === 차여운 ===
  cha = this.physics.add.staticSprite(1850, 250, "cha");
  cha.setDepth(9999);

  // 충돌
  this.physics.add.collider(player, walls);

  // 카메라
  this.cameras.main.startFollow(player);
  this.cameras.main.setBounds(0, 0, worldW, worldH);
  this.physics.world.setBounds(0, 0, worldW, worldH);

  // 이름표 따라가기
  this.events.on("postupdate", () => {
    nameTag.setPosition(player.x - 14, player.y - 42);
  });

  // 입력
  cursors = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys("W,A,S,D");
  interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  // 이벤트 존
  zones = [];
  zones.push(makeZone(this, 760, 260, 220, 200, "hallway_tutorial", true));
  zones.push(makeZone(this, 900, 900, 400, 300, "start_find_yeoun", true));
  zones.push(makeZone(this, 1700, 150, 520, 320, "enter_rooftop", true));

  // 타이머 1초 감소
  this.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => {
      if (!state.timer.active) return;
      state.timer.secondsLeft -= 1;
      updateTimerUI();
      if (state.timer.secondsLeft <= 0) {
        state.timer.secondsLeft = 0;
        updateTimerUI();
      }
    }
  });

  // 초기 UI
  setAff(state.affection);
  updateTimerUI();

  // 시작 스크립트
  if (!didBoot) {
    didBoot = true;
    runScript("prologue_izakaya");
  }
}

function makeZone(scene, x, y, w, h, scriptKey, once) {
  const zone = scene.add.zone(x + w/2, y + h/2, w, h);
  scene.physics.world.enable(zone);
  zone.body.setAllowGravity(false);
  zone.body.setImmovable(true);
  return { zone, scriptKey, once, fired: false };
}

function update() {
  if (!cursors || !wasd || !player) return;

  // 대화 중 이동 막기
  const inBox = !box.classList.contains("hidden");
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

// ===== 연애 지상주의 구역(거리 토스트 + 진입 토스트) =====
const dist = Phaser.Math.Distance.Between(player.x, player.y, cha.x, cha.y);

// 진입 반경(현재 160px = 5m 느낌)
const ZONE_RADIUS_PX = 160;

// 1m 환산(타일 32px 기준)
const PX_PER_M = 32;

// LoveZone 진입 여부
const inLoveZone = dist <= ZONE_RADIUS_PX;

// (1) "…까지 Xm" 거리 토스트: 존 바깥에서만, 숫자 바뀔 때만
if (!inLoveZone) {
  const remainingPx = Math.max(0, dist - ZONE_RADIUS_PX);
  const meters = Math.max(1, Math.ceil(remainingPx / PX_PER_M));

  // 너무 자주 뜨지 않게(최소 간격 450ms)
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
  // 존 안에 들어오면 거리 표시 리셋(다시 나갔다 들어올 때 자연스럽게)
  state.lastZoneMeters = null;
}

// (2) 존 "처음 진입" 토스트는 100% 1번
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

// (3) 존 안에서는 가끔 다시 뜨는 확률 토스트(선택)
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

  // ✅ 첫 진입은 무조건 1번 뜸
  if (!state.seenLoveZoneIntro) {
    state.seenLoveZoneIntro = true;
    lastZoneToastAt = now;

    boxTitle.textContent = "(알림)";
    boxText.textContent = "연애 지상주의 구역이 활성화되었습니다.";
    boxChoices.innerHTML = "";
    openBox();
    setTimeout(() => { if (boxChoices.childElementCount === 0) closeBox(); }, 1200);
  }
  // 이후에는 확률 + 쿨다운
  else if (now - lastZoneToastAt > 5000 && Math.random() < 0.35) {
    lastZoneToastAt = now;

    boxTitle.textContent = "(알림)";
    boxText.textContent = "연애 지상주의 구역이 활성화되었습니다.";
    boxChoices.innerHTML = "";
    openBox();
    setTimeout(() => { if (boxChoices.childElementCount === 0) closeBox(); }, 1200);
  }
}

  // 차여운 근처 상호작용: 세계개변
  if (Phaser.Input.Keyboard.JustDown(interactKey)) {
    if (dist <= 80) runScript("world_change");
  }