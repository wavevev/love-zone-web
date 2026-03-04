// ========= DOM UI =========
const box = document.getElementById("box");
const boxTitle = document.getElementById("boxTitle");
const boxText = document.getElementById("boxText");
const boxChoices = document.getElementById("boxChoices");

const affEl = document.getElementById("aff");
const zoneStateEl = document.getElementById("zoneState");
const timerEl = document.getElementById("timer");

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
  affection: -20, // 차여운 ONLY
  flags: {},
  loveZone: false,
  timer: { active: false, secondsLeft: 0, label: "" }
};

function setAff(v) {
  state.affection = v;
  affEl.textContent = String(v);
}

function startTimer(seconds, label) {
  state.timer.active = true;
  state.timer.secondsLeft = seconds;
  state.timer.label = label || "제한 시간";
  updateTimerUI();
}
function stopTimer() {
  state.timer.active = false;
  timerEl.textContent = "";
}
function updateTimerUI() {
  if (!state.timer.active) return;
  const s = Math.max(0, state.timer.secondsLeft);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  timerEl.textContent = `${state.timer.label}: ${mm}:${ss}`;
}

// ========= Script Engine (쯔꾸르 이벤트 커맨드 느낌) =========
let scripts = null;
let running = null; // { list, i }
let locked = false; // UI 진행 잠금

async function loadScripts(scene) {
  const res = await fetch("./data/ep1.json");
  scripts = await res.json();
}

function runScript(key) {
  if (!scripts?.[key]) return;
  running = { list: scripts[key], i: 0 };
  openBox();
  step();
}

function step(nextKeyFromChoice) {
  if (!running) return;

  // 선택지에서 next로 넘어오면 스크립트 전환
  if (nextKeyFromChoice) {
    runScript(nextKeyFromChoice);
    return;
  }

  // 끝
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
    boxText.textContent = cmd.text || "";
    boxChoices.innerHTML = "";
    locked = false;
    return;
  }

  if (cmd.type === "choice") {
    boxTitle.textContent = cmd.title || "(선택)";
    boxText.textContent = cmd.text || "";
    renderChoices(cmd.choices || [], (ch) => {
      // 선택 결과로 다음 스크립트로 이동
      step(ch.next);
    });
    locked = false;
    return;
  }

  if (cmd.type === "setAffection") {
    setAff(cmd.value);
    locked = false;
    step(); // 즉시 다음
    return;
  }

  if (cmd.type === "setTimer") {
    startTimer(cmd.seconds || 0, cmd.label || "제한 시간");
    locked = false;
    step();
    return;
  }

  // 모르는 커맨드는 그냥 넘김
  locked = false;
  step();
}

// Space로 대화 진행(선택지 있을 땐 클릭)
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  // 박스가 열려있고, 선택지가 없을 때만 다음
  if (!box.classList.contains("hidden") && boxChoices.childElementCount === 0 && !locked) {
    step();
  }
});

// ========= Phaser Game =========
const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#0b0b0f",
  physics: { default: "arcade", arcade: { debug: false } },
  scene: { preload, create, update }
};

new Phaser.Game(config);

let cursors, wasd, interactKey;
let player, walls, cha, zones;
let lastZoneToastAt = 0;
let didBoot = false;

function preload() {
  // 외부 이미지 없이, 런타임으로 텍스처 만들 거라 여기선 스크립트만 로드
}

async function create() {
  await loadScripts(this);

  // === 런타임 텍스처 생성(초보용: 파일 없어도 보이게) ===
  const g = this.add.graphics();

  // floor
  g.fillStyle(0x111827, 1);
  g.fillRect(0, 0, 32, 32);
  g.generateTexture("floor", 32, 32);
  g.clear();

  // wall
  g.fillStyle(0x374151, 1);
  g.fillRect(0, 0, 32, 32);
  g.lineStyle(2, 0x111827, 1);
  g.strokeRect(1, 1, 30, 30);
  g.generateTexture("wall", 32, 32);
  g.clear();

// player (형광 초록 + 테두리)
g.fillStyle(0x00ff66, 1);
g.fillRoundedRect(0, 0, 30, 30, 8);
g.lineStyle(3, 0x000000, 1);
g.strokeRoundedRect(1, 1, 28, 28, 8);
g.generateTexture("player", 30, 30);
g.clear();

// cha(차여운) (형광 핑크 + 테두리)
g.fillStyle(0xff2d9b, 1);
g.fillRoundedRect(0, 0, 30, 30, 8);
g.lineStyle(3, 0x000000, 1);
g.strokeRoundedRect(1, 1, 28, 28, 8);
g.generateTexture("cha", 30, 30);
g.clear();

  // === 월드 ===
  const worldW = 2200;
  const worldH = 1400;

  // 바닥 타일 깔기
  for (let y = 0; y < worldH; y += 32) {
    for (let x = 0; x < worldW; x += 32) {
      this.add.image(x, y, "floor").setOrigin(0);
    }
  }

  // 벽(충돌)
  walls = this.physics.add.staticGroup();

  // 테두리 벽
  for (let x = 0; x < worldW; x += 32) {
    walls.create(x + 16, 16, "wall");
    walls.create(x + 16, worldH - 16, "wall");
  }
  for (let y = 0; y < worldH; y += 32) {
    walls.create(16, y + 16, "wall");
    walls.create(worldW - 16, y + 16, "wall");
  }

  // 간단 구역 벽(교실/복도 느낌)
  // 교실 블럭
  for (let x = 200; x <= 700; x += 32) walls.create(x, 200, "wall");
  for (let y = 200; y <= 520; y += 32) walls.create(200, y, "wall");
  for (let y = 200; y <= 520; y += 32) walls.create(700, y, "wall");
  // 복도 입구(틈)
  // (벽을 일부러 뚫어둔 느낌)

  // === 플레이어 ===
  player = this.physics.add.sprite(420, 360, "player");
  player.setCollideWorldBounds(true);
  player.body.setSize(26, 26, true);

  // 디버그용: 플레이어 이름표 (무조건 보이게)
const nameTag = this.add.text(player.x - 14, player.y - 42, "명하", {
  fontSize: "16px",
  color: "#00ff66",
  backgroundColor: "#000000",
  padding: { x: 4, y: 2 }
});
nameTag.setDepth(9999);
player.setDepth(9999);

// 매 프레임 따라다니게
this.events.on("postupdate", () => {
  nameTag.setPosition(player.x - 14, player.y - 42);
});

  // === 차여운(일단 옥상에 배치: 에피1 초반 마지막) ===
  cha = this.physics.add.staticSprite(1850, 250, "cha");

  // 충돌
  this.physics.add.collider(player, walls);

  // 카메라
  this.cameras.main.startFollow(player);
  this.cameras.main.setZoom(2);
  this.cameras.main.setBounds(0, 0, worldW, worldH);
  this.physics.world.setBounds(0, 0, worldW, worldH);

  // 입력
  cursors = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys("W,A,S,D");
  interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  // === 이벤트 존(쯔꾸르식 트리거) ===
  zones = [];

  // 교실 각성: 시작하자마자 boot 실행
  // 복도 튜토리얼 존
  zones.push(makeZone(this, 760, 260, 220, 200, "hallway_tutorial", "튜토리얼", true));

  // 차여운 찾기 시작(운동장 느낌 위치)
  zones.push(makeZone(this, 900, 900, 400, 300, "start_find_yeoun", "차여운 찾기", true));

  // 옥상 진입 알림
  zones.push(makeZone(this, 1700, 150, 520, 320, "enter_rooftop", "옥상 진입", true));

  // 세계개변(차여운 근처에서 스페이스 누르면)
  // (이건 존이 아니라 상호작용 트리거로 처리)

  // 시작 스크립트
  if (!didBoot) {
    didBoot = true;
    runScript("boot");
  }

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
        // 여기서 나중에 실패 페널티 연출 넣으면 됨
      }
    }
  });

  // 초기 호감도 UI
  setAff(state.affection);
}

function makeZone(scene, x, y, w, h, scriptKey, name, once) {
  const zone = scene.add.zone(x + w/2, y + h/2, w, h);
  scene.physics.world.enable(zone);
  zone.body.setAllowGravity(false);
  zone.body.setImmovable(true);

  return { zone, scriptKey, name, once, fired: false };
}

function update(time) {
  // UI 박스 열려 있으면 이동 막기(쯔꾸르 느낌)
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

  // 존 트리거 체크
  for (const z of zones) {
    if (z.once && z.fired) continue;
    if (Phaser.Geom.Rectangle.Contains(
      new Phaser.Geom.Rectangle(z.zone.x - z.zone.width/2, z.zone.y - z.zone.height/2, z.zone.width, z.zone.height),
      player.x, player.y
    )) {
      z.fired = true;
      runScript(z.scriptKey);
      break;
    }
  }

  // === 연애 지상주의 구역(차여운 반경 5m) ===
  // “m”는 실제 단위가 아니라 게임 단위라서,
  // 여기선 초보-friendly로 160px(약 5m 느낌)로 잡았어. 나중에 타일 기준으로 재조정 가능.
  const dist = Phaser.Math.Distance.Between(player.x, player.y, cha.x, cha.y);
  const inLoveZone = dist <= 160;

  state.loveZone = inLoveZone;
  zoneStateEl.textContent = inLoveZone ? "연애 지상주의 구역: ON" : "연애 지상주의 구역: OFF";

  // “근처만 가도 가끔 뜬다” = 확률 + 쿨다운
  if (inLoveZone) {
    const now = Date.now();
    if (now - lastZoneToastAt > 5000) { // 5초 쿨다운
      if (Math.random() < 0.35) { // 35% 확률
        lastZoneToastAt = now;
        // 박스 방해 최소화: 알림 한 줄만
        boxTitle.textContent = "(알림)";
        boxText.textContent = "연애 지상주의 구역이 활성화되었습니다.";
        boxChoices.innerHTML = "";
        openBox();
        // 1.2초 후 자동 닫기
        setTimeout(() => { if (boxChoices.childElementCount === 0) closeBox(); }, 1200);
      }
    }
  }

  // === 차여운과 상호작용(에피1 초반 마지막 “세계개변”) ===
  // 차여운 근처(80px)에서 스페이스 누르면 world_change 실행
  if (Phaser.Input.Keyboard.JustDown(interactKey)) {
    if (dist <= 80) {
      runScript("world_change");
    }
  }
}