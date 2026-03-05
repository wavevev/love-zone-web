// =====================================================
// LOVE ZONE WEB - FULL GAME.JS (A: 런타임 맵 탐색형) - 안정 통버전
// - 32x48 캐릭터 시트 적용
// - 발바닥 기준 정렬(쯔꾸르 느낌)
// - 토스트 중앙/상단 규칙
// - 대화 타이핑 스킵 정상
// - ESC 대화 종료
// - 미션 시스템(토스트 + M 로그)
// - 포탈 이동(근처 SPACE)
// =====================================================

// ========= DOM UI =========
const box = document.getElementById("box");
const boxTitle = document.getElementById("boxTitle");
const boxText = document.getElementById("boxText");
const boxChoices = document.getElementById("boxChoices");
const boxPrompt = document.getElementById("boxPrompt");
const toast = document.getElementById("toast");
const toastTitle = document.getElementById("toastTitle");
const toastText = document.getElementById("toastText");
const toastIconL = document.getElementById("toastIconL");
const toastIconR = document.getElementById("toastIconR");
const timerHud = document.getElementById("timerHud");
const timerLabel = document.getElementById("timerLabel");
const timerValue = document.getElementById("timerValue");

function showPrompt(){ boxPrompt?.classList.remove("hidden"); }
function hidePrompt(){ boxPrompt?.classList.add("hidden"); }

// ========= Toast =========
let toastTimer = null;
function showToast({
  title="알림",
  text="",
  icon="🔔",
  ms=4000,
  position="center" // "center" | "top"
}={}){
  if(!toast) return;
  toastTitle.textContent = title;
  toastText.textContent = text;
  if(toastIconL) toastIconL.textContent = icon;
  if(toastIconR) toastIconR.textContent = icon;

  toast.classList.remove("hidden");
  toast.classList.remove("toast-center","toast-top");
  toast.classList.add(position==="top" ? "toast-top":"toast-center");

  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toast.classList.add("hidden"), ms);
}

// ========= Box =========
function openBox(){
  box?.classList.remove("hidden");
  hidePrompt();
}
function closeBox(){
  box?.classList.add("hidden");
  if(boxTitle) boxTitle.textContent = "";
  if(boxText) boxText.textContent = "";
  if(boxChoices) boxChoices.innerHTML = "";
  hidePrompt();
}
function renderChoices(choices, onPick){
  if(!boxChoices) return;
  boxChoices.innerHTML = "";
  for(const ch of choices){
    const b = document.createElement("div");
    b.className = "choice";
    b.textContent = ch.label;
    b.onclick = ()=> onPick(ch);
    boxChoices.appendChild(b);
  }
}

// ========= Game State =========
const state = {
  affection: -20,

  // LoveZone toast
  seenLoveZoneIntro: false,
  lastZoneMeters: null,
  lastZoneDistanceToastAt: 0,

  // penalty
  lastPenaltyAt: 0,

  // timer
  timer: { active:false, secondsLeft:0, label:"" },

  // missions
  mainMission: "",
  missions: {} // id: { text, status:"active"|"done"|"fail" }
};

function setAff(v){ state.affection = v; }

// ========= Timer HUD =========
function formatMMSS(totalSeconds){
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}
function showTimerHud(labelText){
  if(!timerHud) return;
  timerHud.classList.remove("hidden");
  if(timerLabel) timerLabel.textContent = labelText || "제한 시간";
}
function hideTimerHud(){
  if(!timerHud) return;
  timerHud.classList.add("hidden");
}
function updateTimerHud(){
  if(!timerValue) return;
  timerValue.textContent = formatMMSS(state.timer.secondsLeft);
}
function startTimer(seconds,label){
  state.timer.active = true;
  state.timer.secondsLeft = seconds;
  state.timer.label = label || "제한 시간";

  // 3초 공지(중앙)
  showToast({
    title:"알림",
    icon:"🔔",
    text:`제한 시간 ${formatMMSS(seconds)}`,
    ms:3000,
    position:"center"
  });

  // 3초 뒤 HUD 표시
  setTimeout(()=>{
    showTimerHud(state.timer.label);
    updateTimerHud();
  },3000);
}

// ========= Missions =========
function setMainMission(text){
  state.mainMission = text || "";
  if(text){
    showToast({ title:"미션", icon:"🔔", text:`메인 미션\n${text}`, ms:4000, position:"center" });
  }
}
function addMission(id,text){
  if(!id) return;
  state.missions[id] = { text:text||id, status:"active" };
  showToast({ title:"미션", icon:"🔔", text:`서브 미션 추가\n${state.missions[id].text}`, ms:4000, position:"center" });
}
function completeMission(id){
  if(!id || !state.missions[id]) return;
  state.missions[id].status = "done";
  showToast({ title:"미션", icon:"🔔", text:`서브 미션 완료\n${state.missions[id].text}`, ms:4000, position:"center" });
}
function failMission(id){
  if(!id || !state.missions[id]) return;
  state.missions[id].status = "fail";
  showToast({ title:"미션", icon:"🔔", text:`서브 미션 실패\n${state.missions[id].text}`, ms:4000, position:"center" });
}
function openMissionLog(){
  openBox();
  if(boxTitle) boxTitle.textContent="(미션)";
  if(boxChoices) boxChoices.innerHTML="";

  const lines=[];
  if(state.mainMission) lines.push(`메인: ${state.mainMission}`);
  const ids=Object.keys(state.missions);
  if(ids.length===0) lines.push("서브 미션: 없음");
  else{
    lines.push("서브:");
    for(const id of ids){
      const m = state.missions[id];
      const mark = m.status==="done"?"✅":(m.status==="fail"?"❌":"•");
      lines.push(`${mark} ${m.text}`);
    }
  }
  if(boxText) boxText.textContent = lines.join("\n");
  showPrompt(); // 로그는 타이핑 아님
}

// ========= Script Engine =========
let scripts=null;
let running=null; // {list,i}
let typing=false;
let typingTimer=null;
let currentTypingFullText="";
let locked=false;

const TYPE_SPEED_MS=18;

function typeText(fullText){
  typing=true;
  currentTypingFullText = fullText || "";
  hidePrompt();
  if(boxText) boxText.textContent="";
  let i=0;

  if(typingTimer) clearInterval(typingTimer);
  typingTimer = setInterval(()=>{
    i++;
    if(boxText) boxText.textContent = currentTypingFullText.slice(0,i);
    if(i>=currentTypingFullText.length){
      clearInterval(typingTimer);
      typingTimer=null;
      typing=false;
      showPrompt(); // ✅ 다 찍히면 ▼
    }
  }, TYPE_SPEED_MS);
}

function runScript(key){
  if(!scripts?.[key]){
    console.warn("스크립트 키 없음:", key);
    return;
  }
  running={ list:scripts[key], i:0 };
  openBox();
  step();
}
function step(nextKeyFromChoice){
  if(!running) return;

  if(nextKeyFromChoice){
    runScript(nextKeyFromChoice);
    return;
  }

  if(running.i>=running.list.length){
    running=null;
    closeBox();
    locked=false;
    return;
  }

  const cmd = running.list[running.i++];
  handleCmd(cmd);
}

let currentScene=null;

// spawn points (발바닥 기준 느낌으로 y를 약간 크게)
const spawnPoints = {
  izakaya:   { x: 260,  y: 420 },
  classroom: { x: 1280, y: 420 },
  hallway:   { x: 1500, y: 420 },
  yard:      { x: 1750, y: 980 },
  rooftop:   { x: 1850, y: 320 },
  crosswalk: { x: 1120, y: 1120 }
};

function handleCmd(cmd){
  locked=true;

  if(cmd.type==="alert"){
    if(boxTitle) boxTitle.textContent = cmd.title || "(알림)";
    if(boxChoices) boxChoices.innerHTML="";
    typeText(cmd.text || "");
    locked=false;
    return;
  }

  if(cmd.type==="choice"){
    if(boxTitle) boxTitle.textContent = cmd.title || "(선택)";
    if(boxText) boxText.textContent = cmd.text || "";
    hidePrompt();
    renderChoices(cmd.choices||[], (ch)=> step(ch.next));
    locked=false;
    return;
  }

  if(cmd.type==="setAffection"){
    setAff(cmd.value);
    showToast({
      title:"호감도",
      icon:"♥",
      text:`호감도 ${cmd.value>=0?"+":""}${cmd.value}`,
      ms:4000,
      position:"center"
    });
    locked=false;
    step();
    return;
  }

  if(cmd.type==="setTimer"){
    startTimer(cmd.seconds||0, cmd.label||"제한 시간");
    locked=false;
    step();
    return;
  }

  if(cmd.type==="setMainMission"){
    setMainMission(cmd.text||"");
    locked=false;
    step();
    return;
  }
  if(cmd.type==="addMission"){
    addMission(cmd.id, cmd.text);
    locked=false;
    step();
    return;
  }
  if(cmd.type==="completeMission"){
    completeMission(cmd.id);
    locked=false;
    step();
    return;
  }
  if(cmd.type==="failMission"){
    failMission(cmd.id);
    locked=false;
    step();
    return;
  }

  if(cmd.type==="fadeOut"){
    const ms = cmd.ms ?? 400;
    currentScene.cameras.main.fadeOut(ms,0,0,0);
    currentScene.time.delayedCall(ms, ()=>{ locked=false; step(); });
    return;
  }
  if(cmd.type==="fadeIn"){
    const ms = cmd.ms ?? 400;
    currentScene.cameras.main.fadeIn(ms,0,0,0);
    currentScene.time.delayedCall(ms, ()=>{ locked=false; step(); });
    return;
  }

  if(cmd.type==="teleport"){
    const to = cmd.to;
    const p = spawnPoints[to];
    if(p && player){
      player.setPosition(p.x, p.y);
      currentScene.cameras.main.centerOn(p.x, p.y);
    }
    locked=false;
    step();
    return;
  }

  if(cmd.type==="goto"){
    locked=false;
    step(cmd.next);
    return;
  }

  locked=false;
  step();
}

// ========= Key controls =========

// Space: 대화 진행
window.addEventListener("keydown", (e)=>{
  if(e.code!=="Space") return;

  if(box?.classList.contains("hidden")) return;
  if(boxChoices && boxChoices.childElementCount>0) return;

  // ✅ 타이핑 중이면: 문장 전체 즉시 출력(멈춤X)
  if(typing){
    if(typingTimer) clearInterval(typingTimer);
    typingTimer=null;
    typing=false;
    if(boxText) boxText.textContent = currentTypingFullText;
    showPrompt();
    return;
  }

  if(!locked) step();
});

// ESC: 대화 강제 종료
window.addEventListener("keydown", (e)=>{
  if(e.code!=="Escape") return;
  if(box && !box.classList.contains("hidden")){
    if(typingTimer) clearInterval(typingTimer);
    typingTimer=null;
    typing=false;
    running=null;
    locked=false;
    closeBox();
  }
});

// M: 미션 로그
window.addEventListener("keydown",(e)=>{
  if(e.code==="KeyM") openMissionLog();
});

// ========= Phaser =========
const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#0b0b0f",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default:"arcade", arcade:{ debug:false } },
  scene: { preload, create, update }
};

new Phaser.Game(config);

let cursors, wasd, interactKey;
let player, walls, cha, zones;
let npcs=[], portals=[];
let interactHint=null;
let lastInteractAt=0;

// ===== util: depth sort (아래에 있는 애가 위에 보이게) =====
function setDepthByY(sprite){
  sprite.setDepth(Math.floor(sprite.y));
}

// ===== Penalty =====
function triggerPenalty(reasonText="마이너스 호감도로 인해 페널티가 적용됩니다."){
  const now = Date.now();
  if(now - state.lastPenaltyAt < 3500) return;
  state.lastPenaltyAt = now;

  showToast({ title:"알림", icon:"🔔", text: reasonText, ms:4000, position:"center" });

  // 예시: 호감도 하락 토스트
  const drop = 2;
  state.affection -= drop;
  showToast({ title:"호감도", icon:"♥", text:`호감도 -${drop}`, ms:4000, position:"center" });
}

// ===== Travel Menu =====
function openTravelMenu(title, options){
  openBox();
  if(boxTitle) boxTitle.textContent = title || "(이동)";
  if(boxText) boxText.textContent = "어디로 이동할까?";
  hidePrompt();
  renderChoices(options, (ch)=>{
    closeBox();
    const p = spawnPoints[ch.to];
    if(p && player){
      currentScene.cameras.main.fadeOut(220,0,0,0);
      currentScene.time.delayedCall(220, ()=>{
        player.setPosition(p.x,p.y);
        currentScene.cameras.main.centerOn(p.x,p.y);
        currentScene.cameras.main.fadeIn(220,0,0,0);
      });
    }
  });
}

function preload(){
  // script json
  this.load.json("ep1","data/ep1.json");

  // character sheets (32x48)
  this.load.spritesheet("taemyeongha","images/taemyeongha_sheet.png",{ frameWidth:32, frameHeight:48 });
  this.load.spritesheet("chayeoun","images/chayeoun_sheet.png",{ frameWidth:32, frameHeight:48 });
  this.load.spritesheet("cheonsangwon","images/cheonsangwon_sheet.png",{ frameWidth:32, frameHeight:48 });
  this.load.spritesheet("angyeonghun","images/angyeonghun_sheet.png",{ frameWidth:32, frameHeight:48 });
  this.load.spritesheet("senbae","images/senbae_sheet.png",{ frameWidth:32, frameHeight:48 });
}

function create(){
  currentScene=this;

  scripts = this.cache.json.get("ep1");
  if(!scripts){
    console.error("ep1.json 로드 실패: public/data/ep1.json");
    showToast({ title:"알림", icon:"🔔", text:"스크립트 로드 실패", ms:4000, position:"center" });
    return;
  }

  // ===== runtime textures (32px tile) =====
  const g = this.add.graphics();

  g.fillStyle(0x1b1020,1); g.fillRect(0,0,32,32); g.generateTexture("tile_izakaya",32,32); g.clear();
  g.fillStyle(0x1f2937,1); g.fillRect(0,0,32,32); g.generateTexture("tile_school",32,32); g.clear();

  g.fillStyle(0x4b5563,1);
  g.fillRect(0,0,32,32);
  g.lineStyle(2,0x111827,1);
  g.strokeRect(1,1,30,30);
  g.generateTexture("tile_wall",32,32);
  g.destroy();

  // ===== world =====
  const worldW = 2400;
  const worldH = 1400;

  for(let y=0; y<worldH; y+=32){
    for(let x=0; x<worldW; x+=32){
      const tex = (x<900) ? "tile_izakaya" : "tile_school";
      this.add.image(x,y,tex).setOrigin(0);
    }
  }

  // walls (simple)
  walls = this.physics.add.staticGroup();

  // border
  for(let x=0; x<worldW; x+=32){
    walls.create(x+16,16,"tile_wall");
    walls.create(x+16,worldH-16,"tile_wall");
  }
  for(let y=0; y<worldH; y+=32){
    walls.create(16,y+16,"tile_wall");
    walls.create(worldW-16,y+16,"tile_wall");
  }

  // classroom-ish walls (학교쪽)
  for(let x=1200; x<=1700; x+=32) walls.create(x,200,"tile_wall");
  for(let y=200; y<=520; y+=32) walls.create(1200,y,"tile_wall");
  for(let y=200; y<=520; y+=32) walls.create(1700,y,"tile_wall");

  // ===== player (feet origin) =====
  player = this.physics.add.sprite(spawnPoints.izakaya.x, spawnPoints.izakaya.y, "taemyeongha", 0);
  player.setOrigin(0.5, 1); // ✅ 발바닥 기준
  player.setScale(0.85);    // ✅ “너무 큼” 해결(0.75~0.9 조절)
  player.setCollideWorldBounds(true);
  player.body.setSize(18, 28, true);
  player.body.setOffset(7, 20);
  setDepthByY(player);

  // player anims (3프레임 * 4방향 가정)
  this.anims.create({ key:"p_down",  frames:this.anims.generateFrameNumbers("taemyeongha",{ start:0, end:2 }),  frameRate:10, repeat:-1 });
  this.anims.create({ key:"p_left",  frames:this.anims.generateFrameNumbers("taemyeongha",{ start:3, end:5 }),  frameRate:10, repeat:-1 });
  this.anims.create({ key:"p_right", frames:this.anims.generateFrameNumbers("taemyeongha",{ start:6, end:8 }),  frameRate:10, repeat:-1 });
  this.anims.create({ key:"p_up",    frames:this.anims.generateFrameNumbers("taemyeongha",{ start:9, end:11 }), frameRate:10, repeat:-1 });

  // name tag
  const nameTag = this.add.text(player.x-18, player.y-70, "명하", {
    fontFamily:"DungGeunMo",
    fontSize:"16px",
    color:"#ffffff",
    backgroundColor:"#000000",
    padding:{x:4,y:2}
  });
  nameTag.setOrigin(0,0);
  nameTag.setDepth(99999);

  // ===== chayeoun (feet origin) =====
  cha = this.physics.add.staticSprite(spawnPoints.rooftop.x, spawnPoints.rooftop.y, "chayeoun", 0);
  cha.setOrigin(0.5, 1);
  cha.setScale(0.85);
  setDepthByY(cha);

  // ===== NPCs =====
  npcs=[];
  const npcTags=[];

  const addNpc = (x,y,name,scriptKey,spriteKey)=>{
    const s = this.physics.add.staticSprite(x,y,spriteKey,0);
    s.setOrigin(0.5,1);
    s.setScale(0.85);
    setDepthByY(s);

    const tag = this.add.text(x-22, y-70, name, {
      fontFamily:"DungGeunMo",
      fontSize:"16px",
      color:"#ffffff",
      backgroundColor:"#000000",
      padding:{x:4,y:2}
    });
    tag.setDepth(99999);

    npcs.push({ sprite:s, name, scriptKey });
    npcTags.push({ sprite:s, tag });
  };

  addNpc(420, 420, "선배", "talk_senbae", "senbae");
  addNpc(1380, 420, "안경훈", "talk_kyunghoon", "angyeonghun");
  addNpc(1560, 420, "천상원", "talk_cheonsangwon", "cheonsangwon");

  // ===== Portals =====
  portals=[];
  const addPortal = (x,y,label,menuTitle,options)=>{
    // 포탈은 그냥 보이는 표시용(벽돌 같은 느낌)
    const s = this.physics.add.staticSprite(x,y,"tile_wall");
    s.setOrigin(0.5,1);
    s.setScale(1);
    setDepthByY(s);

    const tag = this.add.text(x-18, y-70, label, {
      fontFamily:"DungGeunMo",
      fontSize:"16px",
      color:"#ffffff",
      backgroundColor:"#000000",
      padding:{x:4,y:2}
    });
    tag.setDepth(99999);

    portals.push({ sprite:s, tag, label, menuTitle, options });
  };

  addPortal(820, 420, "문", "(이동)", [
    { label:"학교(교실)", to:"classroom" },
    { label:"학교(복도)", to:"hallway" }
  ]);

  addPortal(1300, 620, "계단", "(이동)", [
    { label:"복도", to:"hallway" },
    { label:"운동장", to:"yard" },
    { label:"옥상", to:"rooftop" }
  ]);

  addPortal(1750, 1040, "정문", "(이동)", [
    { label:"횡단보도", to:"crosswalk" },
    { label:"교실", to:"classroom" }
  ]);

  // collisions
  this.physics.add.collider(player, walls);

  // camera
  this.cameras.main.startFollow(player);
  this.cameras.main.setBounds(0,0,worldW,worldH);
  this.physics.world.setBounds(0,0,worldW,worldH);

  // interact hint
  interactHint = this.add.text(18,18,"SPACE: 상호작용",{
    fontFamily:"DungGeunMo",
    fontSize:"16px",
    color:"#ffffff",
    backgroundColor:"#000000",
    padding:{x:6,y:4}
  });
  interactHint.setScrollFactor(0);
  interactHint.setDepth(999999);
  interactHint.setVisible(false);

  // input
  cursors = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys("W,A,S,D");
  interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  // zones (스토리 트리거)
  zones=[];
  zones.push(makeZone(this, 1220, 260, 220, 200, "hallway_tutorial", true));
  zones.push(makeZone(this, 1700, 900, 400, 300, "start_find_yeoun", true));
  zones.push(makeZone(this, 1680, 150, 520, 320, "enter_rooftop", true));

  // timer tick
  this.time.addEvent({
    delay:1000,
    loop:true,
    callback:()=>{
      if(!state.timer.active) return;
      state.timer.secondsLeft -= 1;
      if(state.timer.secondsLeft<=0){
        state.timer.secondsLeft=0;
        state.timer.active=false;
        updateTimerHud();
        // TODO: 시간 종료 페널티/엔딩
        return;
      }
      updateTimerHud();
    }
  });

  updateTimerHud();
  hideTimerHud();

  // follow tags
  this.events.on("postupdate", ()=>{
    nameTag.setPosition(player.x-18, player.y-70);
    for(const nt of npcTags){
      nt.tag.setPosition(nt.sprite.x-22, nt.sprite.y-70);
    }
    for(const p of portals){
      p.tag.setPosition(p.sprite.x-18, p.sprite.y-70);
    }

    // depth sorting
    setDepthByY(player);
    setDepthByY(cha);
    for(const n of npcs) setDepthByY(n.sprite);
    for(const p of portals) setDepthByY(p.sprite);
  });

  // start prologue
  runScript("prologue_izakaya");
}

function makeZone(scene,x,y,w,h,scriptKey,once){
  const zone = scene.add.zone(x+w/2, y+h/2, w, h);
  scene.physics.world.enable(zone);
  zone.body.setAllowGravity(false);
  zone.body.setImmovable(true);
  return { zone, scriptKey, once, fired:false };
}

function update(){
  if(!cursors || !wasd || !player) return;

  // 대화 중 이동 금지
  const inBox = !box?.classList.contains("hidden");
  if(inBox){
    player.setVelocity(0,0);
    player.anims.stop();
    return;
  }

  // movement
  const speed=180;
  let vx=0, vy=0;

  const left  = cursors.left.isDown  || wasd.A.isDown;
  const right = cursors.right.isDown || wasd.D.isDown;
  const up    = cursors.up.isDown    || wasd.W.isDown;
  const down  = cursors.down.isDown  || wasd.S.isDown;

  if(left) vx -= speed;
  if(right) vx += speed;
  if(up) vy -= speed;
  if(down) vy += speed;
  if(vx!==0 && vy!==0){ vx*=0.7071; vy*=0.7071; }

  player.setVelocity(vx,vy);

  // player anim
  if(vx===0 && vy===0){
    player.anims.stop();
  }else{
    if(Math.abs(vx) > Math.abs(vy)){
      player.anims.play(vx>0 ? "p_right" : "p_left", true);
    }else{
      player.anims.play(vy>0 ? "p_down" : "p_up", true);
    }
  }

  // zones
  for(const z of zones){
    if(z.once && z.fired) continue;
    const rect = new Phaser.Geom.Rectangle(
      z.zone.x - z.zone.width/2,
      z.zone.y - z.zone.height/2,
      z.zone.width,
      z.zone.height
    );
    if(Phaser.Geom.Rectangle.Contains(rect, player.x, player.y)){
      z.fired=true;
      runScript(z.scriptKey);
      break;
    }
  }

  // nearest NPC/portal
  let nearest=null; // {type, ref, dist}
  const CAN_INTERACT_DIST=90;

  for(const n of npcs){
    const d = Phaser.Math.Distance.Between(player.x, player.y, n.sprite.x, n.sprite.y);
    if(!nearest || d<nearest.dist) nearest={ type:"npc", ref:n, dist:d };
  }
  for(const p of portals){
    const d = Phaser.Math.Distance.Between(player.x, player.y, p.sprite.x, p.sprite.y);
    if(!nearest || d<nearest.dist) nearest={ type:"portal", ref:p, dist:d };
  }

  if(nearest && nearest.dist<=CAN_INTERACT_DIST){
    interactHint?.setVisible(true);
    interactHint?.setText(nearest.type==="portal" ? "SPACE: 이동" : "SPACE: 대화");
  }else{
    interactHint?.setVisible(false);
  }

  // LoveZone distance toast
  const dist = Phaser.Math.Distance.Between(player.x, player.y, cha.x, cha.y);
  const ZONE_RADIUS_PX = 160; // 5m 느낌
  const PX_PER_M = 32;
  const inLoveZone = dist <= ZONE_RADIUS_PX;

  // 거리 토스트(상단/짧게)
  if(!inLoveZone){
    const remainingPx = Math.max(0, dist - ZONE_RADIUS_PX);
    const meters = Math.max(1, Math.ceil(remainingPx / PX_PER_M));
    const now = Date.now();
    const canToast = now - state.lastZoneDistanceToastAt > 450;

    if(meters !== state.lastZoneMeters && canToast){
      state.lastZoneMeters = meters;
      state.lastZoneDistanceToastAt = now;
      showToast({
        title:"알림",
        icon:"🔔",
        text:`연애 지상주의 구역까지 ${meters}m`,
        ms:650,
        position:"top"
      });
    }
  }else{
    state.lastZoneMeters = null;
  }

  // 진입 토스트(중앙 4초)
  if(inLoveZone && !state.seenLoveZoneIntro){
    state.seenLoveZoneIntro = true;
    showToast({
      title:"알림",
      icon:"🔔",
      text:"연애 지상주의 구역이 활성화되었습니다.",
      ms:4000,
      position:"center"
    });
  }

  // penalty
  if(inLoveZone && state.affection < 0){
    triggerPenalty("마이너스 호감도로 인해 페널티가 적용됩니다.");
  }

  // SPACE interact
  if(Phaser.Input.Keyboard.JustDown(interactKey)){
    const now = Date.now();
    if(now - lastInteractAt < 250) return;
    lastInteractAt = now;

    // portal
    if(nearest && nearest.type==="portal" && nearest.dist<=CAN_INTERACT_DIST){
      openTravelMenu(nearest.ref.menuTitle, nearest.ref.options);
      return;
    }

    // npc
    if(nearest && nearest.type==="npc" && nearest.dist<=CAN_INTERACT_DIST){
      runScript(nearest.ref.scriptKey);
      return;
    }

    // world_change near cha
    if(dist <= 80){
      runScript("world_change");
      return;
    }
  }
}