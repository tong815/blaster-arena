const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");
const restartBtn = document.getElementById("restartBtn");
const controlButtons = document.querySelectorAll(".control-btn");
const upgradeMenu = document.getElementById("upgradeMenu");
const gunUpgradeBtn = document.getElementById("gunUpgradeBtn");
const armorUpgradeBtn = document.getElementById("armorUpgradeBtn");
const shieldBtn = document.getElementById("shieldBtn");
const laserGunBtn = document.getElementById("laserGunBtn");

const ENEMIES_PER_WAVE = 8;
const SHOOT_DELAY = 200;
const SCORE_UPGRADE_STEP = 10;
const FINAL_BOSS_NUMBER = 4;
const NORMAL_GUN_START_DAMAGE = 20;
const NORMAL_GUN_MAX_DAMAGE = 100;
const GUN_DAMAGE_UPGRADE = 10;
const ARMOR_START_PERCENT = 5;
const ARMOR_UPGRADE_PERCENT = 5;
const ARMOR_MAX_PERCENT = 50;
const ARMOR_HEALTH_UPGRADE = 10;
const ARMOR_REPAIR_TIME = 10000;
const SHIELD_UNLOCK_SCORE = 70;
const SHIELD_DURATION = 15000;
const LASER_UNLOCK_SCORE = 150;
const LASER_DAMAGE = 140;

const BOSS_LIST = [
  { number: 1, wave: 5, health: 130, size: 80, damage: 30, speed: 1.1 },
  { number: 2, wave: 10, health: 300, size: 95, damage: 45, speed: 1.25 },
  { number: 3, wave: 15, health: 650, size: 110, damage: 65, speed: 1.4 },
  { number: 4, wave: 20, health: 1200, size: 130, damage: 90, speed: 1.55 }
];

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
let spawnedBossNumbers;
let bossPowerLevel;
let shieldActiveUntil;
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
    maxHealth: 100,
    health: 100,
    gunLevel: 1,
    armorLevel: 1,
    normalGunDamage: NORMAL_GUN_START_DAMAGE,
    bulletDamage: NORMAL_GUN_START_DAMAGE,
    upgradedArmorProtection: ARMOR_START_PERCENT,
    armorBroken: false,
    armorRepairEndTime: 0,
    weapon: "normal"
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
  spawnedBossNumbers = [];
  bossPowerLevel = 0;
  shieldActiveUntil = 0;
  lastShotTime = 0;
  lastEnemySpawnTime = 0;
  lastBossHitTime = 0;
  restartBtn.style.display = "none";
  upgradeMenu.classList.remove("show");
  updateUpgradeButtons();
  updateItemButtons();

  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", event => {
  keys[event.key] = true;

  if (event.key.toLowerCase() === "s") {
    activateShield();
  }

  // Stop the browser page from scrolling during game controls.
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "s", "S"].includes(event.key)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", event => {
  keys[event.key] = false;

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "s", "S"].includes(event.key)) {
    event.preventDefault();
  }
});

restartBtn.addEventListener("click", startGame);
gunUpgradeBtn.addEventListener("click", upgradeGun);
armorUpgradeBtn.addEventListener("click", upgradeArmor);
shieldBtn.addEventListener("click", activateShield);
laserGunBtn.addEventListener("click", equipLaserGun);

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
      damage: getCurrentBulletDamage(),
      weapon: player.weapon
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
  // Higher waves and defeated bosses lower the delay, so enemies spawn faster over time.
  const spawnDelay = Math.max(180, 1200 - wave * 80 - bossPowerLevel * 120);

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
    health: baseHealth + (wave - 1) * 8 + bossPowerLevel * 25,
    damage: baseDamage + (wave - 1) * 2 + bossPowerLevel * 6,
    speed: baseSpeed + (wave - 1) * 0.15 + bossPowerLevel * 0.35,
    strong: isStrong
  });

  lastEnemySpawnTime = time;
}

function spawnBossIfNeeded() {
  if (boss || win) {
    return;
  }

  const bossData = BOSS_LIST.find(bossInfo => {
    return bossInfo.wave <= wave && !spawnedBossNumbers.includes(bossInfo.number);
  });

  if (!bossData) {
    return;
  }

  boss = {
    x: canvas.width / 2,
    y: 60,
    number: bossData.number,
    size: bossData.size,
    maxHealth: bossData.health,
    health: bossData.health,
    damage: bossData.damage,
    speed: bossData.speed
  };

  spawnedBossNumbers.push(bossData.number);
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
        defeatBoss();
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

function defeatBoss() {
  const defeatedBossNumber = boss.number;
  boss = null;
  bossPowerLevel++;
  lastEnemySpawnTime = performance.now();

  if (defeatedBossNumber === FINAL_BOSS_NUMBER) {
    enemies = [];
    win = true;
    restartBtn.style.display = "inline-block";
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
  updateUpgradeButtons();

  if (waitingForUpgrade || score < nextUpgradeScore || !canChooseAnyUpgrade()) {
    return;
  }

  waitingForUpgrade = true;
  upgradeMenu.classList.add("show");
}

function updateUpgradeButtons() {
  const gunIsMaxed = player.normalGunDamage >= NORMAL_GUN_MAX_DAMAGE;
  const armorIsMaxed = player.upgradedArmorProtection >= ARMOR_MAX_PERCENT;

  gunUpgradeBtn.hidden = gunIsMaxed;
  gunUpgradeBtn.disabled = gunIsMaxed;
  armorUpgradeBtn.hidden = armorIsMaxed;
  armorUpgradeBtn.disabled = armorIsMaxed;
}

function canChooseAnyUpgrade() {
  return player.normalGunDamage < NORMAL_GUN_MAX_DAMAGE ||
    player.upgradedArmorProtection < ARMOR_MAX_PERCENT;
}

function upgradeGun() {
  if (player.normalGunDamage >= NORMAL_GUN_MAX_DAMAGE) {
    return;
  }

  player.normalGunDamage = Math.min(NORMAL_GUN_MAX_DAMAGE, player.normalGunDamage + GUN_DAMAGE_UPGRADE);
  player.gunLevel = Math.floor((player.normalGunDamage - NORMAL_GUN_START_DAMAGE) / GUN_DAMAGE_UPGRADE) + 1;
  player.bulletDamage = getCurrentBulletDamage();
  finishUpgrade();
}

function upgradeArmor() {
  if (player.upgradedArmorProtection >= ARMOR_MAX_PERCENT) {
    return;
  }

  player.armorLevel++;
  player.upgradedArmorProtection = Math.min(ARMOR_MAX_PERCENT, player.upgradedArmorProtection + ARMOR_UPGRADE_PERCENT);
  player.maxHealth += ARMOR_HEALTH_UPGRADE;
  player.health = Math.min(player.maxHealth, player.health + ARMOR_HEALTH_UPGRADE);
  finishUpgrade();
}

function finishUpgrade() {
  nextUpgradeScore += SCORE_UPGRADE_STEP;
  waitingForUpgrade = false;
  upgradeMenu.classList.remove("show");

  const now = performance.now();
  lastEnemySpawnTime = now;
  lastBossHitTime = now;
  updateUpgradeButtons();
  updateInfo();
  showUpgradeIfNeeded();
}

function checkPlayerHits(time) {
  // Normal enemies disappear after touching the player.
  for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
    const enemy = enemies[enemyIndex];

    if (circleTouchesSquare(player, enemy)) {
      applyPlayerDamage(enemy.damage, time);
      enemies.splice(enemyIndex, 1);
    }
  }

  // Boss damage has a short cooldown so one touch does not drain health instantly.
  if (boss && time - lastBossHitTime > 700 && circleTouchesSquare(player, boss)) {
    applyPlayerDamage(boss.damage, time);
    lastBossHitTime = time;
  }

  if (player.health <= 0) {
    player.health = 0;
    gameOver = true;
    restartBtn.style.display = "inline-block";
  }
}

function applyPlayerDamage(damage, time) {
  if (isShieldActive(time)) {
    return;
  }

  const armorProtection = getActiveArmorProtection();
  const finalDamage = Math.max(1, Math.ceil(damage * (1 - armorProtection / 100)));
  player.health -= finalDamage;

  if (armorProtection > 0) {
    breakArmor(time);
  }
}

function getActiveArmorProtection() {
  return player.armorBroken ? 0 : player.upgradedArmorProtection;
}

function breakArmor(time) {
  player.armorBroken = true;
  player.armorRepairEndTime = time + ARMOR_REPAIR_TIME;
}

function updateTimedPowerups(time) {
  if (player.armorBroken && time >= player.armorRepairEndTime) {
    player.armorBroken = false;
    player.armorRepairEndTime = 0;
  }

  if (shieldActiveUntil && time >= shieldActiveUntil) {
    shieldActiveUntil = 0;
  }
}

function isShieldActive(time) {
  return score >= SHIELD_UNLOCK_SCORE && time < shieldActiveUntil;
}

function activateShield() {
  const now = performance.now();

  if (score < SHIELD_UNLOCK_SCORE || gameOver || win || isShieldActive(now)) {
    return;
  }

  shieldActiveUntil = now + SHIELD_DURATION;
  updateItemButtons();
  updateInfo();
}

function equipLaserGun() {
  if (score < LASER_UNLOCK_SCORE || gameOver || win) {
    return;
  }

  player.weapon = "laser";
  player.bulletDamage = getCurrentBulletDamage();
  updateItemButtons();
  updateInfo();
}

function getCurrentBulletDamage() {
  return player.weapon === "laser" ? LASER_DAMAGE : player.normalGunDamage;
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
  updateTimedPowerups(time);
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
  ctx.fillText("Boss " + boss.number + " Health", x + 122, y + 14);
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
  const now = performance.now();
  updateTimedPowerups(now);
  updateItemButtons();

  let statusText =
    "Health: " + Math.ceil(player.health) + "/" + player.maxHealth +
    " | Score: " + score +
    " | Wave: " + wave +
    " | Weapon: " + getWeaponName() +
    " | Gun Level: " + player.gunLevel +
    " | Bullet Damage: " + getCurrentBulletDamage() +
    " | " + getArmorStatusText(now) +
    " | " + getShieldStatusText(now);

  if (boss) {
    statusText += " | Boss " + boss.number + " HP: " + Math.max(0, Math.ceil(boss.health));
  }

  info.textContent = statusText;
}

function getWeaponName() {
  return player.weapon === "laser" ? "Laser Gun" : "Normal Gun";
}

function getArmorStatusText(time) {
  if (!player.armorBroken) {
    return "Armor: " + player.upgradedArmorProtection + "%";
  }

  const repairSeconds = Math.max(0, Math.ceil((player.armorRepairEndTime - time) / 1000));

  if (repairSeconds > 0) {
    return "Armor: Broken | Armor Repairing: " + repairSeconds + "s";
  }

  return "Armor: Broken";
}

function getShieldStatusText(time) {
  if (score < SHIELD_UNLOCK_SCORE) {
    return "Shield: Locked";
  }

  if (isShieldActive(time)) {
    const shieldSeconds = Math.max(0, Math.ceil((shieldActiveUntil - time) / 1000));
    return "Shield: Active " + shieldSeconds + "s";
  }

  return "Shield: Ready";
}

function updateItemButtons() {
  const now = performance.now();
  const shieldUnlocked = score >= SHIELD_UNLOCK_SCORE;
  const laserUnlocked = score >= LASER_UNLOCK_SCORE;

  shieldBtn.disabled = !shieldUnlocked || isShieldActive(now) || gameOver || win;
  shieldBtn.textContent = shieldUnlocked ? (isShieldActive(now) ? "Shield Active" : "Use Shield (S)") : "Shield Locked";

  laserGunBtn.disabled = !laserUnlocked || player.weapon === "laser" || gameOver || win;
  laserGunBtn.textContent = laserUnlocked ? (player.weapon === "laser" ? "Laser Equipped" : "Equip Laser Gun") : "Laser Locked";
}

function gameLoop(time) {
  updateTimedPowerups(time);

  if (!gameOver && !win && !waitingForUpgrade) {
    update(time);
  }

  draw();

  if (!gameOver && !win) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

startGame();
