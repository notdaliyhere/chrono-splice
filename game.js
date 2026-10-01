// Chrono Splice — time-loop puzzle platformer
// Vanilla JS, canvas rendering, no external dependencies.
(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // ---------- Constants ----------
  const GRAVITY = 1800;
  const MOVE_ACCEL = 2600;
  const FRICTION = 2600;
  const MOVE_SPEED = 260;
  const JUMP_VELOCITY = -620;
  const MAX_FALL = 1000;
  const PLAYER_W = 28;
  const PLAYER_H = 40;
  const GROUND_Y = 760;

  const STORAGE_KEY = 'chronoSplice_best';

  // ---------- Helpers ----------
  function rect(x, y, w, h) { return { x, y, w, h }; }
  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function groundRect(x, w) { return rect(x, GROUND_Y, w, H - GROUND_Y + 40); }
  const WALL_LEFT = rect(-30, -300, 30, H + 600);
  const WALL_RIGHT = rect(W, -300, 30, H + 600);

  function loadBest() {
    try {
      const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return isNaN(v) ? 0 : clamp(v, 0, LEVELS.length - 1);
    } catch (e) { return 0; }
  }
  function saveBest(idx) {
    try { localStorage.setItem(STORAGE_KEY, String(clamp(idx, 0, LEVELS.length - 1))); } catch (e) {}
  }

  // ---------- Level Definitions ----------
  const LEVELS = [
    {
      name: 'First Echo',
      spawn: { x: 60, y: GROUND_Y - PLAYER_H },
      solids: [WALL_LEFT, WALL_RIGHT, groundRect(0, 1040)],
      plates: [{ id: 'a', rect: rect(430, GROUND_Y - 16, 100, 16) }],
      doors: [{ rect: rect(760, GROUND_Y - 220, 30, 220), need: ['a'] }],
      pits: [],
      goal: rect(960, GROUND_Y - 40, 34, 40),
      maxEchoes: 1,
      hint: 'Walk onto the glowing plate, then press L to loop.',
    },
    {
      name: 'Double Take',
      spawn: { x: 60, y: GROUND_Y - PLAYER_H },
      solids: [WALL_LEFT, WALL_RIGHT, groundRect(0, 240), groundRect(340, 280), groundRect(720, 320)],
      plates: [
        { id: 'a', rect: rect(400, GROUND_Y - 16, 100, 16) },
        { id: 'b', rect: rect(790, GROUND_Y - 16, 100, 16) },
      ],
      doors: [{ rect: rect(950, GROUND_Y - 220, 26, 220), need: ['a', 'b'] }],
      pits: [{ x: 240, w: 100 }, { x: 620, w: 100 }],
      goal: rect(990, GROUND_Y - 40, 34, 40),
      maxEchoes: 2,
      hint: 'Both plates must stay pressed at once. Loop (L) after each to bank an echo there.',
    },
    {
      name: 'Splice Point',
      spawn: { x: 60, y: GROUND_Y - PLAYER_H },
      solids: [WALL_LEFT, WALL_RIGHT, groundRect(0, 300), groundRect(400, 220), groundRect(720, 320)],
      plates: [
        { id: 'c', rect: rect(460, GROUND_Y - 16, 90, 16) },
        { id: 'd', rect: rect(860, GROUND_Y - 16, 90, 16) },
      ],
      doors: [{ rect: rect(970, GROUND_Y - 220, 26, 220), need: ['c', 'd'] }],
      pits: [{ x: 300, w: 100 }, { x: 620, w: 100 }],
      goal: rect(1000, GROUND_Y - 40, 34, 40),
      maxEchoes: 2,
      hint: 'Press E on a plate to splice in place (keep moving forward). Press L to loop fully back to start.',
    },
    {
      name: 'Grand Splice',
      spawn: { x: 60, y: GROUND_Y - PLAYER_H },
      solids: [WALL_LEFT, WALL_RIGHT, groundRect(0, 200), groundRect(290, 170), groundRect(550, 210), groundRect(850, 190)],
      plates: [
        { id: 'e', rect: rect(320, GROUND_Y - 16, 80, 16) },
        { id: 'f', rect: rect(590, GROUND_Y - 16, 80, 16) },
        { id: 'g', rect: rect(870, GROUND_Y - 16, 80, 16) },
      ],
      doors: [{ rect: rect(965, GROUND_Y - 220, 26, 220), need: ['e', 'f', 'g'] }],
      pits: [{ x: 200, w: 90 }, { x: 460, w: 90 }, { x: 760, w: 90 }],
      goal: rect(996, GROUND_Y - 40, 34, 40),
      maxEchoes: 3,
      hint: 'Three plates, three echoes. Splice (E) at each, then loop (L) once more for a clean final run.',
    },
  ];

  // ---------- Game State ----------
  let state = 'start'; // start | playing | complete | win
  let levelIndex = 0;
  let level = null;
  let levelFrame = 0;
  let recordedInputs = [];
  let echoes = [];
  let live = null;
  let keys = { left: false, right: false, jump: false };
  let completeTimer = 0;
  let plateStatus = {};
  let doorLocked = [];
  let timeAccum = 0;

  function newActor(spawn) {
    return {
      x: spawn.x, y: spawn.y, w: PLAYER_W, h: PLAYER_H,
      vx: 0, vy: 0, onGround: false, wasJumpDown: false, facing: 1,
    };
  }

  function loadLevel(idx) {
    levelIndex = idx;
    level = LEVELS[idx];
    live = newActor(level.spawn);
    levelFrame = 0;
    recordedInputs = [];
    echoes = [];
    state = 'playing';
  }

  function resetAttempt(keepEchoes) {
    live = newActor(level.spawn);
    levelFrame = 0;
    recordedInputs = [];
    if (!keepEchoes) {
      echoes = [];
    } else {
      // resync existing echoes back to their own start
      for (const e of echoes) {
        e.x = level.spawn.x; e.y = level.spawn.y; e.w = PLAYER_W; e.h = PLAYER_H;
        e.vx = 0; e.vy = 0; e.onGround = false; e.wasJumpDown = false;
        e.frame = 0; e.frozen = false;
      }
    }
  }

  function bankEcho(resetPosition) {
    if (!level) return;
    if (recordedInputs.length < 3) return; // nothing meaningful recorded
    if (echoes.length >= level.maxEchoes) return;
    echoes.push({
      inputs: recordedInputs.slice(),
      frame: 0,
      x: level.spawn.x, y: level.spawn.y, w: PLAYER_W, h: PLAYER_H,
      vx: 0, vy: 0, onGround: false, wasJumpDown: false, frozen: false,
    });
    if (resetPosition) {
      resetAttempt(true);
    }
  }

  function isOnAnyPlate() {
    if (!level) return false;
    for (const p of level.plates) {
      if (overlaps(live, p.rect)) return true;
    }
    return false;
  }

  function actionLoop() { bankEcho(true); }
  function actionSplice() { if (isOnAnyPlate()) bankEcho(false); }
  function actionHardReset() {
    if (!level) return;
    echoes = [];
    resetAttempt(false);
  }

  // ---------- Physics ----------
  function stepActor(actor, input, dt, solids) {
    if (input.left && !input.right) actor.vx -= MOVE_ACCEL * dt;
    else if (input.right && !input.left) actor.vx += MOVE_ACCEL * dt;
    else {
      if (actor.vx > 0) actor.vx = Math.max(0, actor.vx - FRICTION * dt);
      else if (actor.vx < 0) actor.vx = Math.min(0, actor.vx + FRICTION * dt);
    }
    actor.vx = clamp(actor.vx, -MOVE_SPEED, MOVE_SPEED);
    if (actor.vx > 4) actor.facing = 1;
    else if (actor.vx < -4) actor.facing = -1;

    actor.vy += GRAVITY * dt;
    actor.vy = Math.min(actor.vy, MAX_FALL);

    if (input.jump && !actor.wasJumpDown && actor.onGround) {
      actor.vy = JUMP_VELOCITY;
      actor.onGround = false;
    }
    actor.wasJumpDown = input.jump;

    // X axis
    actor.x += actor.vx * dt;
    for (const s of solids) {
      if (overlaps(actor, s)) {
        if (actor.vx > 0) actor.x = s.x - actor.w;
        else if (actor.vx < 0) actor.x = s.x + s.w;
        actor.vx = 0;
      }
    }
    // Y axis
    actor.y += actor.vy * dt;
    actor.onGround = false;
    for (const s of solids) {
      if (overlaps(actor, s)) {
        if (actor.vy > 0) { actor.y = s.y - actor.h; actor.vy = 0; actor.onGround = true; }
        else if (actor.vy < 0) { actor.y = s.y + s.h; actor.vy = 0; }
      }
    }
  }

  function computeSolids() {
    const solids = level.solids.slice();
    doorLocked = [];
    for (const d of level.doors) {
      const locked = d.need.every((id) => plateStatus[id]);
      doorLocked.push(!locked);
      if (!locked) solids.push(d.rect);
    }
    return solids;
  }

  function computePlateStatus() {
    const actorsRects = [live];
    for (const e of echoes) actorsRects.push(e);
    const status = {};
    for (const p of level.plates) {
      status[p.id] = actorsRects.some((a) => overlaps(a, p.rect));
    }
    return status;
  }

  function update(dt) {
    if (state !== 'playing') return;

    plateStatus = computePlateStatus();
    const solids = computeSolids();

    const input = { left: keys.left, right: keys.right, jump: keys.jump };
    stepActor(live, input, dt, solids);
    recordedInputs.push(input);
    levelFrame++;

    for (const e of echoes) {
      if (e.frame >= e.inputs.length) { e.frozen = true; continue; }
      const ei = e.inputs[e.frame];
      stepActor(e, ei, dt, solids);
      e.frame++;
    }

    // fell into a pit
    if (live.y > H + 60) {
      resetAttempt(true);
      return;
    }

    if (overlaps(live, level.goal)) {
      completeLevel();
    }
  }

  function completeLevel() {
    state = 'complete';
    completeTimer = 1.4;
    const best = Math.min(levelIndex + 1, LEVELS.length - 1);
    saveBest(best);
    const txt = document.getElementById('complete-text');
    if (levelIndex + 1 < LEVELS.length) {
      txt.textContent = `"${level.name}" solved! Next: ${LEVELS[levelIndex + 1].name}`;
    } else {
      txt.textContent = `"${level.name}" solved!`;
    }
    showOverlay(overlayComplete);
  }

  // ---------- Rendering ----------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#15142b');
    grad.addColorStop(1, '#0b0a18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(120,110,200,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    if (!level) return;

    // pits (hazard stripes)
    for (const pit of level.pits) {
      ctx.fillStyle = 'rgba(20,6,10,0.9)';
      ctx.fillRect(pit.x, GROUND_Y, pit.w, H - GROUND_Y);
      ctx.save();
      ctx.beginPath();
      ctx.rect(pit.x, GROUND_Y, pit.w, 10);
      ctx.clip();
      ctx.fillStyle = '#ff5a5a';
      for (let sx = pit.x - 20; sx < pit.x + pit.w + 20; sx += 14) {
        ctx.save();
        ctx.translate(sx, GROUND_Y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-3, -14, 6, 28);
        ctx.restore();
      }
      ctx.restore();
    }

    // ground / platforms
    ctx.fillStyle = '#2b2a4d';
    for (const s of level.solids) {
      if (s === WALL_LEFT || s === WALL_RIGHT) continue;
      ctx.fillRect(s.x, s.y, s.w, Math.min(s.h, H - s.y));
      ctx.fillStyle = '#413e74';
      ctx.fillRect(s.x, s.y, s.w, 6);
      ctx.fillStyle = '#2b2a4d';
    }

    // plates
    for (const p of level.plates) {
      const pressed = plateStatus[p.id];
      ctx.fillStyle = pressed ? '#7df9ff' : '#3a3860';
      ctx.fillRect(p.rect.x, p.rect.y + 6, p.rect.w, p.rect.h - 6);
      ctx.fillStyle = pressed ? '#c8feff' : '#55528f';
      ctx.fillRect(p.rect.x, p.rect.y, p.rect.w, 6);
    }

    // doors
    level.doors.forEach((d, i) => {
      if (doorLocked[i]) {
        const g = ctx.createLinearGradient(d.rect.x, d.rect.y, d.rect.x + d.rect.w, d.rect.y);
        g.addColorStop(0, '#ff8d6b');
        g.addColorStop(1, '#ffd27d');
        ctx.fillStyle = g;
        ctx.fillRect(d.rect.x, d.rect.y, d.rect.w, d.rect.h);
        ctx.strokeStyle = '#7a3418';
        ctx.lineWidth = 2;
        for (let yy = d.rect.y + 10; yy < d.rect.y + d.rect.h; yy += 16) {
          ctx.beginPath(); ctx.moveTo(d.rect.x, yy); ctx.lineTo(d.rect.x + d.rect.w, yy); ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(125,249,255,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(d.rect.x, d.rect.y, d.rect.w, d.rect.h);
      }
    });

    // goal
    const pulse = 4 * Math.sin(timeAccum * 3);
    ctx.save();
    ctx.shadowColor = '#ffe9a8';
    ctx.shadowBlur = 20 + pulse;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.ellipse(level.goal.x + level.goal.w / 2, level.goal.y + level.goal.h / 2, level.goal.w / 2, level.goal.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // echoes
    for (const e of echoes) {
      ctx.fillStyle = e.frozen ? 'rgba(180,141,255,0.55)' : 'rgba(180,141,255,0.8)';
      roundRect(e.x, e.y, e.w, e.h, 6);
      ctx.fillStyle = '#efe6ff';
      ctx.fillRect(e.x + (e.facing > 0 ? e.w - 10 : 4), e.y + 10, 6, 6);
    }

    // live player
    ctx.fillStyle = '#7df9ff';
    roundRect(live.x, live.y, live.w, live.h, 6);
    ctx.fillStyle = '#0b0a18';
    ctx.fillRect(live.x + (live.facing > 0 ? live.w - 10 : 4), live.y + 10, 6, 6);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- HUD ----------
  const hudLevel = document.getElementById('hud-level');
  const hudHint = document.getElementById('hud-hint');
  const hudStatus = document.getElementById('hud-status');

  function updateHud() {
    if (!level) { hudLevel.textContent = ''; hudHint.textContent = ''; hudStatus.textContent = ''; return; }
    hudLevel.textContent = `Level ${levelIndex + 1}/${LEVELS.length} — ${level.name}`;
    hudStatus.textContent = `Echoes: ${echoes.length}/${level.maxEchoes}`;
    if (isOnAnyPlate()) hudHint.textContent = 'On a plate — press E to splice in place';
    else hudHint.textContent = level.hint;
  }

  // ---------- Overlays ----------
  const overlayStart = document.getElementById('overlay-start');
  const overlayComplete = document.getElementById('overlay-complete');
  const overlayWin = document.getElementById('overlay-win');
  const continueNote = document.getElementById('continue-note');

  function showOverlay(el) { el.classList.remove('hidden'); }
  function hideOverlay(el) { el.classList.add('hidden'); }

  function beginGame() {
    hideOverlay(overlayStart);
    hideOverlay(overlayWin);
    loadLevel(loadBest());
  }

  function refreshStartNote() {
    const best = loadBest();
    continueNote.textContent = best > 0 ? `Continuing from Level ${best + 1} of ${LEVELS.length}.` : '';
  }
  refreshStartNote();

  document.getElementById('btn-start').addEventListener('click', beginGame);
  document.getElementById('btn-replay').addEventListener('click', () => {
    hideOverlay(overlayWin);
    loadLevel(0);
  });

  // ---------- Input ----------
  function setKey(code, down) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': keys.left = down; break;
      case 'ArrowRight': case 'KeyD': keys.right = down; break;
      case 'ArrowUp': case 'KeyW': case 'Space': keys.jump = down; break;
    }
  }

  window.addEventListener('keydown', (ev) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyW', 'KeyA', 'KeyD'].includes(ev.code)) {
      ev.preventDefault();
    }
    if (state === 'start' && ev.code === 'Space') { beginGame(); return; }
    if (state !== 'playing') return;
    setKey(ev.code, true);
    if (ev.code === 'KeyL') actionLoop();
    if (ev.code === 'KeyE') actionSplice();
    if (ev.code === 'KeyR') actionHardReset();
  });
  window.addEventListener('keyup', (ev) => {
    setKey(ev.code, false);
  });

  function bindTouch(id, onDown, onUp) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => { e.preventDefault(); onDown(); };
    const up = (e) => { e.preventDefault(); if (onUp) onUp(); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }
  bindTouch('t-left', () => { keys.left = true; }, () => { keys.left = false; });
  bindTouch('t-right', () => { keys.right = true; }, () => { keys.right = false; });
  bindTouch('t-jump', () => { keys.jump = true; }, () => { keys.jump = false; });
  bindTouch('t-loop', () => { if (state === 'playing') actionLoop(); });
  bindTouch('t-splice', () => { if (state === 'playing') actionSplice(); });
  bindTouch('t-restart', () => { if (state === 'playing') actionHardReset(); });

  // ---------- Main Loop ----------
  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - lastTime) / 1000);
    lastTime = now;
    timeAccum += dt;

    if (state === 'playing') {
      update(dt);
      updateHud();
    } else if (state === 'complete') {
      completeTimer -= dt;
      if (completeTimer <= 0) {
        if (levelIndex + 1 < LEVELS.length) {
          hideOverlay(overlayComplete);
          loadLevel(levelIndex + 1);
        } else {
          hideOverlay(overlayComplete);
          showOverlay(overlayWin);
          state = 'win';
        }
      } else if (overlayComplete.classList.contains('hidden')) {
        showOverlay(overlayComplete);
      }
    }

    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
