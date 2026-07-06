const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");
const restartBtn = document.getElementById("restartBtn");
const controlButtons = document.querySelectorAll(".control-btn");
const upgradeMenu = document.getElementById("upgradeMenu");
const gunUpgradeBtn = document.getElementById("gunUpgradeBtn");
const armorUpgradeBtn = document.getElementById("armorUpgradeBtn");

const ENEMIES_PER_WAVE = 8;
const SHOOT_DELAY = 200;
const ARMOR_DAMAGE_REDUCTION = 3;
const SCORE_UPGRADE_STEP = 10;

// This object remembers which keys are currently being held down.
const keys = {};
const touchKeys = {};

// These variables hold the current game state.
let player;
let bullets;
let enemies;
let boss;
let score;
let wave;
let defeatedThisWave;
let gameOver;
let win;
let waitingForUpgrade;
let nextUpgradeScore;
let bossHasSpawned;
let lastShotTime;
let lastEnemySpawnTime;
let lastBossHitTime;
let animationId;

function startGame() {
  // Reset the player and all game objects.
  player = {
    x: canvas.width / 2,
    y: canvas.height - 70,
    radius: 20,
    speed: 5,
    health: 100,
    gunLevel: 1,
    armorLevel: 0,
    bulletDamage: 20
  };

  bullets = [];
  enemies = [];
  boss = null;
  score = 0;
  wave = 1;
  defeatedThisWave = 0;
  gameOver = false;
  win = false;
  waitingForUpgrade = false;
  nextUpgradeScore = SCORE_UPGRADE_STEP;
  bossHasSpawned = false;
  lastShotTime = 0;
  lastEnemySpawnTime = 0;
  lastBossHitTime = 0;
  restartBtn.style.display = "none";
  upgradeMenu.classList.remove("show");

  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", event => {
  keys[event.key] = true;

  // Stop the browser page from scrolling during game controls.
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", event => {
  keys[event.key] = false;

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) {
    event.preventDefault();
  }
});

restartBtn.addEventListener("click", startGame);
gunUpgradeBtn.addEventListener("click", upgradeGun);
armorUpgradeBtn.addEventListener("click", upgradeArmor);

// Touch controls use the same key names as the keyboard controls.
for (const button of controlButtons) {
  const keyName = button.dataset.key;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    touchKeys[keyName] = true;
    button.classList.add("active");
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointerup", event => {
    event.preventDefault();
    touchKeys[keyName] = false;
    button.classList.remove("active");
  });

  button.addEventListener("pointercancel", () => {
    touchKeys[keyName] = false;
    button.classList.remove("active");
  });

  button.addEventListener("lostpointercapture", () => {
    touchKeys[keyName] = false;
    button.classList.remove("active");
  });
}

// Extra Safari safety: keep touch gestures from scrolling the page while playing.
document.addEventListener("touchmove", event => {
  event.preventDefault();
}, { passive: false });

function movePlayer() {
  // Move one step for each arrow key that is held down.
  if (isControlHeld("ArrowLeft")) {
    player.x -= player.speed;
  }
  if (isControlHeld("ArrowRight")) {
    player.x += player.speed;
  }
  if (isControlHeld("ArrowUp")) {
    player.y -= player.speed;
  }
  if (isControlHeld("ArrowDown")) {
    player.y += player.speed;
  }

  player.x = clamp(player.x, player.radius, canvas.width - player.radius);
  player.y = clamp(player.y, player.radius, canvas.height - player.radius);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isControlHeld(keyName) {
  return keys[keyName] || touchKeys[keyName];
}

function handleShooting(time) {
  // Holding Space fires one bullet every 200 ms.
  if (isControlHeld(" ") && time - lastShotTime >= SHOOT_DELAY) {
    bullets.push({
      x: player.x,
      y: player.y - player.radius,
      radius: 6,
      speed: 8,
      damage: player.bulletDamage
    });

    lastShotTime = time;
  }
}

function moveBullets() {
  for (const bullet of bullets) {
    bullet.y -= bullet.speed;
  }

  bullets = bullets.filter(bullet => bullet.y > -bullet.radius);
}

function spawnEnemy(time) {
  // Higher waves lower the delay, so enemies spawn faster over time.
  const spawnDelay = Math.max(250, 1200 - wave * 80);

  if (time - lastEnemySpawnTime < spawnDelay) {
    return;
  }

  const strongChance = Math.min(0.15 + wave * 0.04, 0.65);
  const isStrong = wave >= 2 && Math.random() < strongChance;
  const baseHealth = isStrong ? 50 : 20;
  const baseDamage = isStrong ? 20 : 10;
  const baseSpeed = isStrong ? 3 : 2;

  enemies.push({
    x: 30 + Math.random() * (canvas.width - 60),
    y: -30,
    size: isStrong ? 32 : 24,
    health: baseHealth + (wave - 1) * 8,
    damage: baseDamage + (wave - 1) * 2,
    speed: baseSpeed + (wave - 1) * 0.15,
    strong: isStrong
  });

  lastEnemySpawnTime = time;
}

function spawnBossIfNeeded() {
  // The boss appears one time when Wave 5 begins.
  if (wave === 5 && !bossHasSpawned) {
    boss = {
      x: canvas.width / 2,
      y: 60,
      size: 80,
      maxHealth: 130,
      health: 130,
      damage: 30,
      speed: 1.1
    };

    bossHasSpawned = true;
  }
}

function moveEnemies() {
  for (const enemy of enemies) {
    moveSquareTowardPlayer(enemy);
  }

  if (boss) {
    moveSquareTowardPlayer(boss);
  }
}

function moveSquareTowardPlayer(square) {
  // Find the direction from the enemy to the player, then move along it.
  const dx = player.x - square.x;
  const dy = player.y - square.y;
  const distance = Math.hypot(dx, dy) || 1;

  square.x += (dx / distance) * square.speed;
  square.y += (dy / distance) * square.speed;
}

function checkBulletHits() {
  // Loop backward so removing bullets or enemies does not skip items.
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
    const bullet = bullets[bulletIndex];
    let bulletWasUsed = false;

    if (boss && circleTouchesSquare(bullet, boss)) {
      boss.health -= bullet.damage;
      bullets.splice(bulletIndex, 1);
      bulletWasUsed = true;

      if (boss.health <= 0) {
        boss = null;
        win = true;
        restartBtn.style.display = "inline-block";
      }
    }

    if (bulletWasUsed) {
      continue;
    }

    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
      const enemy = enemies[enemyIndex];

      if (circleTouchesSquare(bullet, enemy)) {
        enemy.health -= bullet.damage;
        bullets.splice(bulletIndex, 1);

        if (enemy.health <= 0) {
          enemies.splice(enemyIndex, 1);
          score++;
          defeatedThisWave++;
          updateWaveIfNeeded();
          showUpgradeIfNeeded();
        }

        break;
      }
    }
  }
}

function updateWaveIfNeeded() {
  if (defeatedThisWave < ENEMIES_PER_WAVE) {
    return;
  }

  wave++;
  defeatedThisWave = 0;

  spawnBossIfNeeded();
}

function showUpgradeIfNeeded() {
  if (waitingForUpgrade || score < nextUpgradeScore) {
    return;
  }

  waitingForUpgrade = true;
  upgradeMenu.classList.add("show");
}

function upgradeGun() {
  player.gunLevel++;
  player.bulletDamage += 10;
  finishUpgrade();
}

function upgradeArmor() {
  player.armorLevel++;
  finishUpgrade();
}

function finishUpgrade() {
  nextUpgradeScore += SCORE_UPGRADE_STEP;
  waitingForUpgrade = false;
  upgradeMenu.classList.remove("show");

  const now = performance.now();
  lastEnemySpawnTime = now;
  lastBossHitTime = now;
  updateInfo();
  showUpgradeIfNeeded();
}

function checkPlayerHits(time) {
  // Normal enemies disappear after touching the player.
  for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
    const enemy = enemies[enemyIndex];

    if (circleTouchesSquare(player, enemy)) {
      player.health -= reduceDamage(enemy.damage);
      enemies.splice(enemyIndex, 1);
    }
  }

  // Boss damage has a short cooldown so one touch does not drain health instantly.
  if (boss && time - lastBossHitTime > 700 && circleTouchesSquare(player, boss)) {
    player.health -= reduceDamage(boss.damage);
    lastBossHitTime = time;
  }

  if (player.health <= 0) {
    player.health = 0;
    gameOver = true;
    restartBtn.style.display = "inline-block";
  }
}

function reduceDamage(damage) {
  const armorReduction = player.armorLevel * ARMOR_DAMAGE_REDUCTION;
  return Math.max(1, damage - armorReduction);
}

function circleTouchesSquare(circle, square) {
  // This checks whether a round object touches a square object.
  const half = square.size / 2;
  const closestX = clamp(circle.x, square.x - half, square.x + half);
  const closestY = clamp(circle.y, square.y - half, square.y + half);
  const distance = Math.hypot(circle.x - closestX, circle.y - closestY);

  return distance < circle.radius;
}

function update(time) {
  movePlayer();
  handleShooting(time);
  moveBullets();
  spawnEnemy(time);
  spawnBossIfNeeded();
  moveEnemies();
  checkBulletHits();
  checkPlayerHits(time);
}

function draw() {
  // Redraw the full canvas every frame.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBossHealthBar();
  drawPlayer();
  drawBullets();
  drawEnemies();
  drawBoss();
  drawMessage();
  updateInfo();
}

function drawBossHealthBar() {
  if (!boss) {
    return;
  }

  const barWidth = 360;
  const barHeight = 18;
  const x = (canvas.width - barWidth) / 2;
  const y = 14;
  const healthPercent = Math.max(0, boss.health / boss.maxHealth);

  ctx.fillStyle = "white";
  ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);
  ctx.fillStyle = "black";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "darkred";
  ctx.fillRect(x, y, barWidth * healthPercent, barHeight);

  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.fillText("Boss Health", x + 132, y + 14);
}

function drawPlayer() {
  ctx.fillStyle = "blue";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBullets() {
  ctx.fillStyle = "yellow";

  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.fillStyle = enemy.strong ? "purple" : "red";
    ctx.fillRect(
      enemy.x - enemy.size / 2,
      enemy.y - enemy.size / 2,
      enemy.size,
      enemy.size
    );
  }
}

function drawBoss() {
  if (!boss) {
    return;
  }

  ctx.fillStyle = "darkred";
  ctx.fillRect(
    boss.x - boss.size / 2,
    boss.y - boss.size / 2,
    boss.size,
    boss.size
  );
}

function drawMessage() {
  if (!gameOver && !win) {
    return;
  }

  ctx.fillStyle = "white";
  ctx.font = "50px Arial";
  ctx.textAlign = "center";
  ctx.fillText(win ? "YOU WIN!" : "GAME OVER", canvas.width / 2, canvas.height / 2);
  ctx.textAlign = "left";
}

function updateInfo() {
  const bossHealth = boss ? Math.max(0, Math.ceil(boss.health)) : "None";

  info.textContent =
    "Health: " + Math.ceil(player.health) +
    " | Score: " + score +
    " | Wave: " + wave +
    " | Gun Level: " + player.gunLevel +
    " | Armor Level: " + player.armorLevel +
    " | Bullet Damage: " + player.bulletDamage +
    " | Boss HP: " + bossHealth;
}

function gameLoop(time) {
  if (!gameOver && !win && !waitingForUpgrade) {
    update(time);
  }

  draw();

  if (!gameOver && !win) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

startGame();
