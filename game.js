const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const comboEl = document.querySelector("#combo");
const bestEl = document.querySelector("#best");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const startButton = document.querySelector("#start-button");

const keys = new Set();
const pointer = { active: false, x: 0, y: 0 };
const bestKey = "cazador-meteoritos-best";

let best = Number(localStorage.getItem(bestKey) || 0);
let running = false;
let lastTime = 0;
let spawnTimer = 0;
let crystalTimer = 0;
let shake = 0;

const state = {
  score: 0,
  combo: 1,
  time: 0,
  difficulty: 1,
  meteors: [],
  crystals: [],
  sparks: [],
  ship: { x: 450, y: 455, radius: 20, speed: 430 }
};

bestEl.textContent = best;

document.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === " ") {
    startGame();
    return;
  }

  keys.add(event.key.toLowerCase());
});

document.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
startButton.addEventListener("click", startGame);

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  setPointer(event);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (pointer.active) setPointer(event);
});

canvas.addEventListener("pointerup", () => {
  pointer.active = false;
});

 function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

function startGame( ){
  state.score = 0;
  state.combo = 1;
  state.time = 0;
  state.difficulty = 1;
  state.meteors = [];
  state.crystals = [];
  state.sparks = [];
  state.ship.x = canvas.width / 2;
  state.ship.y = canvas.height - 105;
  spawnTimer = 0;
  crystalTimer = 1.2;
  shake = 0;
  running = true;
  lastTime = performance.now();
  overlay.classList.add("hidden");
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!running) return;
  const delta = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function update(delta) {
  state.time += delta;
  state.difficulty = 1 + state.time / 24;
  state.score += Math.floor(delta * 10 * state.combo);
  spawnTimer -= delta;
  crystalTimer -= delta;
  shake = Math.max(0, shake - delta * 16);

  moveShip(delta);

  if (spawnTimer <= 0) {
    spawnMeteor();
    spawnTimer = Math.max(0.25, 0.85 - state.difficulty * 0.08 + Math.random() * 0.25);
  }

  if (crystalTimer <= 0) {
    spawnCrystal();
    crystalTimer = Math.max(1.1, 2.5 - state.difficulty * 0.12 + Math.random() * 1.2);
  }

  for (const meteor of state.meteors) {
    meteor.y += meteor.speed * delta;
    meteor.x += Math.sin(state.time * meteor.wobble + meteor.seed) * meteor.sway * delta;
    meteor.rotation += meteor.spin * delta;

    if (distance(meteor, state.ship) < meteor.radius + state.ship.radius * 0.72) {
      endGame();
      return;
    }
  }

  for (const crystal of state.crystals) {
    crystal.y += crystal.speed * delta;
    crystal.pulse += delta * 5;

    if (distance(crystal, state.ship) < crystal.radius + state.ship.radius) {
      collectCrystal(crystal);
      crystal.dead = true;
    }
  }

  for (const spark of state.sparks) {
    spark.x += spark.vx * delta;
    spark.y += spark.vy * delta;
    spark.life -= delta;
  }

  state.meteors = state.meteors.filter((meteor) => meteor.y < canvas.height + 80);
  state.crystals = state.crystals.filter((crystal) => crystal.y < canvas.height + 60 && !crystal.dead);
  state.sparks = state.sparks.filter((spark) => spark.life > 0);
  updateHud();
}

function moveShip(delta) {
  let dx = 0;
  let dy = 0;

  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;

  if (pointer.active) {
    state.ship.x += (pointer.x - state.ship.x) * Math.min(1, delta * 9);
    state.ship.y += (pointer.y - state.ship.y) * Math.min(1, delta * 9);
  } else if (dx || dy) {
    const length = Math.hypot(dx, dy);
    state.ship.x += (dx / length) * state.ship.speed * delta;
    state.ship.y += (dy / length) * state.ship.speed * delta;
  }

  state.ship.x = clamp(state.ship.x, 28, canvas.width - 28);
  state.ship.y = clamp(state.ship.y, 70, canvas.height - 35);
}

function spawnMeteor(_){
  const radius = random(18, 46);
  state.meteors.push({
    x: random(radius, canvas.width - radius),
    y: -radius,
    radius,
    speed: random(150, 250) * state.difficulty,
    sway: random(-55, 55),
    wobble: random(1, 3),
    seed: Math.random() * 10,
    rotation: Math.random() * Math.PI,
    spin: random(-2.4, 2.4)
  });
}

function spawnCrystal() {
  state.crystals.push({
    x: random(28, canvas.width - 28),
    y: -30,
    radius: 15,
    speed: random(105, 170),
    pulse: Math.random() * 10
  });
}

function collectCrystal(crystal) {
  state.combo = Math.min(9, state.combo + 1);
  state.score += 75 * state.combo;
  shake = 3;

  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 2 * i) / 18;
    state.sparks.push({
      x: crystal.x,
      y: crystal.y,
      vx: Math.cos(angle) * random(70, 190),
      vy: Math.sin(angle) * random(70, 190),
      life: random(0.28, 0.55),
      color: i % 2 ? "#43f5d9" : "#ffd166"
    });
  }
}

function endGame() {
  running = false;
  best = Math.max(best, state.score);
  localStorage.setItem(bestKey, best);
  updateHud();
  overlayTitle.textContent = "Nave chamuscada";
  overlayText.textContent = `Has conseguido ${state.score} puntos. Récord actual: ${best}. Pulsa espacio para volver al cosmos.`;
  startButton.textContent = "Reintentar";
  overlay.classList.remove("hidden");
}

function updateHud() {
  scoreEl.textContent = state.score;
  comboEl.textContent = `x${state.combo}`;
  bestEl.textContent = best;
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (shake > 0) {
    ctx.translate(random(-shake, shake), random(-shake, shake));
  }

  drawSpace();
  state.crystals.forEach(drawCrystal);
  state.meteors.forEach(drawMeteor);
  state.sparks.forEach(drawSpark);
  drawShip();
  ctx.restore();
}

function drawSpace() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(8, 10, 28, 0.45)");
  gradient.addColorStop(1, "rgba(3, 5, 14, 0.86)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 52; i++) {
    const x = (i * 97 + state.time * (12 + (i % 5))) % canvas.width;
    const y = (i * 53 + state.time * (22 + (i % 6))) % canvas.height;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + (i % 4) * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3) * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShip() {
  const { x, y } = state.ship;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = "rgba(67, 245, 217, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 15, 35, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8f3e7";
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(24, 22);
  ctx.lineTo(0, 10);
  ctx.lineTo(-24, 22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#43f5d9";
  ctx.beginPath();
  ctx.arc(0, -3, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff9f43";
  ctx.beginPath();
  ctx.moveTo(-8, 19);
  ctx.lineTo(0, 38 + Math.sin(state.time * 16) * 7);
  ctx.lineTo(8, 19);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawMeteor(meteor) {
  ctx.save();
  ctx.translate(meteor.x, meteor.y);
  ctx.rotate(meteor.rotation);

  const gradient = ctx.createRadialGradient(-meteor.radius * 0.3, -meteor.radius * 0.3, 3, 0, 0, meteor.radius);
  gradient.addColorStop(0, "#ffd0a3");
  gradient.addColorStop(0.45, "#9d5a3a");
  gradient.addColorStop(1, "#3c2330");
  ctx.fillStyle = gradient;
  ctx.beginPath();

  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    const r = meteor.radius * (0.78 + (i % 3) * 0.12);
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }

  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.beginPath();
  ctx.arc(-meteor.radius * 0.25, 2, meteor.radius * 0.16, 0, Math.PI * 2);
  ctx.arc(meteor.radius * 0.18, -meteor.radius * 0.18, meteor.radius * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrystal(crystal) {
  const glow = 0.55 + Math.sin(crystal.pulse) * 0.25;
  ctx.save();
  ctx.translate(crystal.x, crystal.y);
  ctx.rotate(crystal.pulse * 0.22);
  ctx.shadowColor = "#ffd166";
  ctx.shadowBlur = 24 * glow;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(14, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.52)";
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(6, 0);
  ctx.lineTo(0, 8);
  ctx.lineTo(-6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSpark(spark) {
  ctx.globalAlpha = Math.max(0, spark.life * 2);
  ctx.fillStyle = spark.color;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

draw();
