const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");
const restartBtn = document.getElementById("restartBtn");
const controlButtons = document.querySelectorAll(".control-btn");
const upgradeMenu = document.getElementById("upgradeMenu");
const gunUpgradeBtn = document.getElementById("gunUpgradeBtn");
const armorUpgradeBtn = document.getElementById("armorUpgradeBtn");
const normalGunBtn = document.getElementById("normalGunBtn");
const laserGunBtn = document.getElementById("laserGunBtn");
const shieldBtn = document.getElementById("shieldBtn");
const rocketBtn = document.getElementById("rocketBtn");
const minigunBtn = document.getElementById("minigunBtn");
const molotovBtn = document.getElementById("molotovBtn");

const ENEMIES_PER_WAVE = 8;
const NORMAL_SHOOT_DELAY = 200;
const MINIGUN_SHOOT_DELAY = 65;
const ROCKET_SHOOT_DELAY = 450;
const SCORE_UPGRADE_STEP = 5;
const FINAL_BOSS_NUMBER = 4;
const NORMAL_GUN_START_DAMAGE = 40;
const NORMAL_GUN_MAX_DAMAGE = 150;
const LASER_START_DAMAGE = 140;
const LASER_MAX_DAMAGE = 230;
const GUN_DAMAGE_UPGRADE = 10;
const ARMOR_START_PERCENT = 5;
const ARMOR_UPGRADE_PERCENT = 5;
const ARMOR_MAX_PERCENT = 50;
const ARMOR_HEALTH_UPGRADE = 10;
const ARMOR_REPAIR_TIME = 10000;
const SHIELD_UNLOCK_SCORE = 40;
const SHIELD_DURATION = 15000;
const LASER_UNLOCK_SCORE = 100;
const ROCKET_UNLOCK_BOSS = 2;
const MINIGUN_UNLOCK_BOSS = 3;
const MOLOTOV_UNLOCK_BOSS = 3;
const ROCKET_SKILL_DURATION = 25000;
const MINIGUN_SKILL_DURATION = 25000;
const ROCKET_COOLDOWN_TIME = 30000;
const MINIGUN_COOLDOWN_TIME = 30000;
const MOLOTOV_COOLDOWN_TIME = 12000;
const ROCKET_DAMAGE = 130;
const ROCKET_EXPLOSION_RADIUS = 95;
const MOLOTOV_FIRE_DURATION = 6000;
const MOLOTOV_FIRE_RADIUS = 95;
const MOLOTOV_FIRE_DAMAGE = 18;
const MOLOTOV_FIRE_TICK_TIME = 500;
const ENEMY_NORMAL_START_SPEED = 0.5;
const ENEMY_STRONG_START_SPEED = 0.8;
const ENEMY_MAX_SPEED = 2.0;

const BOSS_LIST = [
  { number: 1, wave: 5, health: 130, size: 80, damage: 30, speed: 1.1 },
  { number: 2, wave: 10, health: 300, size: 95, damage: 45, speed: 1.25 },
  { number: 3, wave: 15, health: 650, size: 110, damage: 65, speed: 1.4 },
  { number: 4, wave: 20, health: 1200, size: 130, damage: 90, speed: 1.55 }
];

// These objects remember which keyboard and touch controls are being held down.
const keys = {};
const touchKeys = {};

let player;
let bullets;
let enemies;
let fireAreas;
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
  player = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    radius: 20,
    speed: 5,
    maxHealth: 100,
    health: 100,
    gunLevel: 1,
    laserLevel: 1,
    armorLevel: 1,
    normalGunDamage: NORMAL_GUN_START_DAMAGE,
    laserGunDamage: LASER_START_DAMAGE,
    upgradedArmorProtection: ARMOR_START_PERCENT,
    armorBroken: false,
    armorRepairEndTime: 0,
    weapon: "normal",
    activeSkill: "none",
    activeSkillEndTime: 0,
    rocketReadyTime: 0,
    minigunReadyTime: 0,
    molotovReadyTime: 0
  };

  bullets = [];
  enemies = [];
  fireAreas = [];
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
  updateAllButtons();

  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", event => {
  keys[event.key] = true;

  if (waitingForUpgrade) {
    handleUpgradeKey(event.key);
  } else {
    handleGameKey(event.key);
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "s", "S", "1", "2", "3", "4", "5"].includes(event.key)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", event => {
  keys[event.key] = false;

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "s", "S", "1", "2", "3", "4", "5"].includes(event.key)) {
    event.preventDefault();
  }
});

restartBtn.addEventListener("click", startGame);
gunUpgradeBtn.addEventListener("click", upgradeGun);
armorUpgradeBtn.addEventListener("click", upgradeArmor);
normalGunBtn.addEventListener("click", equipNormalGun);
laserGunBtn.addEventListener("click", equipLaserGun);
shieldBtn.addEventListener("click", activateShield);
rocketBtn.addEventListener("click", activateRocketSkill);
minigunBtn.addEventListener("click", activateMinigunSkill);
molotovBtn.addEventListener("click", useMolotovSkill);

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

document.addEventListener("touchmove", event => {
  event.preventDefault();
}, { passive: false });

function handleUpgradeKey(keyName) {
  if (keyName === "1") {
    upgradeGun();
  }

  if (keyName === "2") {
    upgradeArmor();
  }
}

function handleGameKey(keyName) {
  if (keyName === "1") {
    equipNormalGun();
  }

  if (keyName === "2") {
    equipLaserGun();
  }

  if (keyName === "3") {
    activateRocketSkill();
  }

  if (keyName === "4") {
    activateMinigunSkill();
  }

  if (keyName === "5") {
    useMolotovSkill();
  }

  if (keyName.toLowerCase() === "s") {
    activateShield();
  }
}

function movePlayer() {
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
  const shootDelay = getShootDelay();

  if (!isControlHeld(" ") || time - lastShotTime < shootDelay) {
    return;
  }

  bullets.push(createBullet());
  lastShotTime = time;
}

function getShootDelay() {
  if (player.activeSkill === "minigun") {
    return MINIGUN_SHOOT_DELAY;
  }

  if (player.activeSkill === "rocket") {
    return ROCKET_SHOOT_DELAY;
  }

  return NORMAL_SHOOT_DELAY;
}

function createBullet() {
  if (player.activeSkill === "rocket") {
    return {
      x: player.x,
      y: player.y - player.radius,
      radius: 10,
      speed: 7,
      damage: ROCKET_DAMAGE,
      weapon: "rocket"
    };
  }

  return {
    x: player.x,
    y: player.y - player.radius,
    radius: player.weapon === "laser" ? 5 : 6,
    speed: player.weapon === "laser" ? 10 : 8,
    damage: getCurrentBulletDamage(),
    weapon: player.weapon
  };
}

function moveBullets() {
  for (const bullet of bullets) {
    bullet.y -= bullet.speed;
  }

  bullets = bullets.filter(bullet => bullet.y > -bullet.radius);
}

function spawnEnemy(time) {
  const spawnDelay = Math.max(180, 1200 - wave * 80 - bossPowerLevel * 120);

  if (time - lastEnemySpawnTime < spawnDelay) {
    return;
  }

  const strongChance = Math.min(0.15 + wave * 0.04, 0.65);
  const isStrong = wave >= 2 && Math.random() < strongChance;
  const baseHealth = isStrong ? 50 : 20;
  const baseDamage = isStrong ? 20 : 10;
  const baseSpeed = isStrong ? ENEMY_STRONG_START_SPEED : ENEMY_NORMAL_START_SPEED;
  const enemySpeed = Math.min(
    ENEMY_MAX_SPEED,
    baseSpeed + (wave - 1) * 0.04 + bossPowerLevel * 0.12
  );

  enemies.push({
    x: 30 + Math.random() * (canvas.width - 60),
    y: -30,
    size: isStrong ? 32 : 24,
    health: baseHealth + (wave - 1) * 8 + bossPowerLevel * 25,
    damage: baseDamage + (wave - 1) * 2 + bossPowerLevel * 6,
    speed: enemySpeed,
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
    y: 70,
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
  const dx = player.x - square.x;
  const dy = player.y - square.y;
  const distance = Math.hypot(dx, dy) || 1;

  square.x += (dx / distance) * square.speed;
  square.y += (dy / distance) * square.speed;
}

function checkBulletHits() {
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
    const bullet = bullets[bulletIndex];

    if (boss && circleTouchesSquare(bullet, boss)) {
      hitBossWithBullet(bullet);
      bullets.splice(bulletIndex, 1);
      continue;
    }

    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
      const enemy = enemies[enemyIndex];

      if (circleTouchesSquare(bullet, enemy)) {
        hitEnemyWithBullet(enemyIndex, bullet);
        bullets.splice(bulletIndex, 1);
        break;
      }
    }
  }
}

function hitBossWithBullet(bullet) {
  boss.health -= bullet.damage;

  if (bullet.weapon === "rocket") {
    explodeRocket(bullet.x, bullet.y);
  }

  if (boss && boss.health <= 0) {
    defeatBoss();
  }
}

function hitEnemyWithBullet(enemyIndex, bullet) {
  enemies[enemyIndex].health -= bullet.damage;

  if (bullet.weapon === "rocket") {
    explodeRocket(bullet.x, bullet.y);
  }

  if (enemies[enemyIndex] && enemies[enemyIndex].health <= 0) {
    defeatEnemy(enemyIndex);
  }
}

function explodeRocket(x, y) {
  for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
    const enemy = enemies[enemyIndex];
    const distance = Math.hypot(enemy.x - x, enemy.y - y);

    if (distance <= ROCKET_EXPLOSION_RADIUS) {
      enemy.health -= ROCKET_DAMAGE;

      if (enemy.health <= 0) {
        defeatEnemy(enemyIndex);
      }
    }
  }

  if (boss) {
    const distanceToBoss = Math.hypot(boss.x - x, boss.y - y);

    if (distanceToBoss <= ROCKET_EXPLOSION_RADIUS + boss.size / 2) {
      boss.health -= ROCKET_DAMAGE;

      if (boss.health <= 0) {
        defeatBoss();
      }
    }
  }
}

function defeatEnemy(enemyIndex) {
  enemies.splice(enemyIndex, 1);
  score++;
  defeatedThisWave++;
  updateWaveIfNeeded();
  showUpgradeIfNeeded();
}

function updateFireAreas(time) {
  for (const fire of fireAreas) {
    if (time - fire.lastDamageTime < MOLOTOV_FIRE_TICK_TIME) {
      continue;
    }

    fire.lastDamageTime = time;
    burnEnemiesInside(fire);
  }

  fireAreas = fireAreas.filter(fire => time < fire.endTime);
}

function burnEnemiesInside(fire) {
  for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
    const enemy = enemies[enemyIndex];
    const distance = Math.hypot(enemy.x - fire.x, enemy.y - fire.y);

    if (distance <= fire.radius) {
      enemy.health -= MOLOTOV_FIRE_DAMAGE;

      if (enemy.health <= 0) {
        defeatEnemy(enemyIndex);
      }
    }
  }

  if (boss) {
    const distanceToBoss = Math.hypot(boss.x - fire.x, boss.y - fire.y);

    if (distanceToBoss <= fire.radius + boss.size / 2) {
      boss.health -= MOLOTOV_FIRE_DAMAGE;

      if (boss.health <= 0) {
        defeatBoss();
      }
    }
  }
}

function defeatBoss() {
  const defeatedBossNumber = boss.number;
  boss = null;
  bossPowerLevel++;
  lastEnemySpawnTime = performance.now();
  updateAllButtons();

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
  updateAllButtons();
}

function updateUpgradeButtons() {
  const gunIsMaxed = getCurrentWeaponUpgradeDamage() >= getCurrentWeaponMaxDamage();
  const armorIsMaxed = player.upgradedArmorProtection >= ARMOR_MAX_PERCENT;

  gunUpgradeBtn.disabled = !waitingForUpgrade || gunIsMaxed;
  armorUpgradeBtn.disabled = !waitingForUpgrade || armorIsMaxed;
  gunUpgradeBtn.textContent = gunIsMaxed ? "1 Upgrade Gun - Max" : "1 Upgrade Gun";
  armorUpgradeBtn.textContent = armorIsMaxed ? "2 Upgrade Armor - Max" : "2 Upgrade Armor";
}

function canChooseAnyUpgrade() {
  const currentGunCanUpgrade = getCurrentWeaponUpgradeDamage() < getCurrentWeaponMaxDamage();
  const armorCanUpgrade = player.upgradedArmorProtection < ARMOR_MAX_PERCENT;
  return currentGunCanUpgrade || armorCanUpgrade;
}

function upgradeGun() {
  if (!waitingForUpgrade || getCurrentWeaponUpgradeDamage() >= getCurrentWeaponMaxDamage()) {
    return;
  }

  if (player.weapon === "laser") {
    player.laserGunDamage = Math.min(LASER_MAX_DAMAGE, player.laserGunDamage + GUN_DAMAGE_UPGRADE);
    player.laserLevel = Math.floor((player.laserGunDamage - LASER_START_DAMAGE) / GUN_DAMAGE_UPGRADE) + 1;
  } else {
    player.normalGunDamage = Math.min(NORMAL_GUN_MAX_DAMAGE, player.normalGunDamage + GUN_DAMAGE_UPGRADE);
    player.gunLevel = Math.floor((player.normalGunDamage - NORMAL_GUN_START_DAMAGE) / GUN_DAMAGE_UPGRADE) + 1;
  }

  finishUpgrade();
}

function upgradeArmor() {
  if (!waitingForUpgrade || player.upgradedArmorProtection >= ARMOR_MAX_PERCENT) {
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
  updateAllButtons();
  updateInfo();
  showUpgradeIfNeeded();
}

function getCurrentWeaponUpgradeDamage() {
  return player.weapon === "laser" ? player.laserGunDamage : player.normalGunDamage;
}

function getCurrentWeaponMaxDamage() {
  return player.weapon === "laser" ? LASER_MAX_DAMAGE : NORMAL_GUN_MAX_DAMAGE;
}

function checkPlayerHits(time) {
  for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
    const enemy = enemies[enemyIndex];

    if (circleTouchesSquare(player, enemy)) {
      applyPlayerDamage(enemy.damage, time);
      enemies.splice(enemyIndex, 1);
    }
  }

  if (boss && time - lastBossHitTime > 700 && circleTouchesSquare(player, boss)) {
    applyPlayerDamage(boss.damage, time);
    lastBossHitTime = time;
  }

  if (player.health <= 0) {
    player.health = 0;
    gameOver = true;
    restartBtn.style.display = "inline-block";
    updateAllButtons();
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

  if (player.activeSkill !== "none" && time >= player.activeSkillEndTime) {
    player.activeSkill = "none";
    player.activeSkillEndTime = 0;
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
  updateAllButtons();
  updateInfo();
}

function equipNormalGun() {
  if (gameOver || win) {
    return;
  }

  player.weapon = "normal";
  updateAllButtons();
  updateInfo();
}

function equipLaserGun() {
  if (score < LASER_UNLOCK_SCORE || gameOver || win) {
    return;
  }

  player.weapon = "laser";
  updateAllButtons();
  updateInfo();
}

function activateRocketSkill() {
  const now = performance.now();

  if (!isRocketUnlocked() || gameOver || win || now < player.rocketReadyTime) {
    return;
  }

  player.activeSkill = "rocket";
  player.activeSkillEndTime = now + ROCKET_SKILL_DURATION;
  player.rocketReadyTime = now + ROCKET_SKILL_DURATION + ROCKET_COOLDOWN_TIME;
  lastShotTime = 0;
  updateAllButtons();
}

function activateMinigunSkill() {
  const now = performance.now();

  if (!isMinigunUnlocked() || gameOver || win || now < player.minigunReadyTime) {
    return;
  }

  player.activeSkill = "minigun";
  player.activeSkillEndTime = now + MINIGUN_SKILL_DURATION;
  player.minigunReadyTime = now + MINIGUN_SKILL_DURATION + MINIGUN_COOLDOWN_TIME;
  lastShotTime = 0;
  updateAllButtons();
}

function useMolotovSkill() {
  const now = performance.now();

  if (!isMolotovUnlocked() || gameOver || win || now < player.molotovReadyTime) {
    return;
  }

  fireAreas.push({
    x: player.x,
    y: clamp(player.y - 170, MOLOTOV_FIRE_RADIUS, canvas.height - MOLOTOV_FIRE_RADIUS),
    radius: MOLOTOV_FIRE_RADIUS,
    endTime: now + MOLOTOV_FIRE_DURATION,
    lastDamageTime: 0
  });

  player.activeSkill = "molotov";
  player.activeSkillEndTime = now + MOLOTOV_FIRE_DURATION;
  player.molotovReadyTime = now + MOLOTOV_COOLDOWN_TIME;
  updateAllButtons();
}

function isRocketUnlocked() {
  return bossPowerLevel >= ROCKET_UNLOCK_BOSS;
}

function isMinigunUnlocked() {
  return bossPowerLevel >= MINIGUN_UNLOCK_BOSS;
}

function isMolotovUnlocked() {
  return bossPowerLevel >= MOLOTOV_UNLOCK_BOSS;
}

function getCurrentBulletDamage() {
  return player.weapon === "laser" ? player.laserGunDamage : player.normalGunDamage;
}

function circleTouchesSquare(circle, square) {
  const half = square.size / 2;
  const closestX = clamp(circle.x, square.x - half, square.x + half);
  const closestY = clamp(circle.y, square.y - half, square.y + half);
  const distance = Math.hypot(circle.x - closestX, circle.y - closestY);

  return distance < circle.radius;
}

function update(time) {
  updateTimedPowerups(time);
  updateFireAreas(time);
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawFireAreas();
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

  const barWidth = 420;
  const barHeight = 20;
  const x = (canvas.width - barWidth) / 2;
  const y = 18;
  const healthPercent = Math.max(0, boss.health / boss.maxHealth);

  ctx.fillStyle = "white";
  ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);
  ctx.fillStyle = "black";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "darkred";
  ctx.fillRect(x, y, barWidth * healthPercent, barHeight);

  ctx.fillStyle = "white";
  ctx.font = "15px Arial";
  ctx.fillText("Boss " + boss.number + " Health", x + 155, y + 15);
}

function drawPlayer() {
  ctx.fillStyle = "#3288ff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  if (isShieldActive(performance.now())) {
    ctx.strokeStyle = "#80e6ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    if (bullet.weapon === "rocket") {
      ctx.fillStyle = "#ff7a24";
    } else if (bullet.weapon === "laser") {
      ctx.fillStyle = "#80e6ff";
    } else {
      ctx.fillStyle = "#ffe66d";
    }

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFireAreas() {
  for (const fire of fireAreas) {
    ctx.fillStyle = "rgba(255, 105, 30, 0.34)";
    ctx.beginPath();
    ctx.arc(fire.x, fire.y, fire.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffdd70";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.fillStyle = enemy.strong ? "#9b5cff" : "#f04d4d";
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
  updateAllButtons();

  let statusText =
    "Health: " + Math.ceil(player.health) + "/" + player.maxHealth +
    " | Score: " + score +
    " | Wave: " + wave +
    " | Current Regular Weapon: " + getWeaponName() +
    " | Active Skill: " + getActiveSkillText(now) +
    " | Bullet Damage: " + getCurrentBulletDamage() +
    " | " + getArmorStatusText(now) +
    " | " + getShieldStatusText(now) +
    " | Cooldowns: " + getSkillCooldownText(now);

  if (boss) {
    statusText += " | Boss " + boss.number + " HP: " + Math.max(0, Math.ceil(boss.health));
  }

  info.textContent = statusText;
}

function getWeaponName() {
  return player.weapon === "laser" ? "Laser Gun" : "Normal Gun";
}

function getActiveSkillText(time) {
  if (player.activeSkill === "none") {
    return "None";
  }

  const seconds = Math.max(0, Math.ceil((player.activeSkillEndTime - time) / 1000));
  return getSkillName(player.activeSkill) + " " + seconds + "s";
}

function getSkillName(skillName) {
  if (skillName === "rocket") {
    return "Rocket Launcher";
  }

  if (skillName === "minigun") {
    return "Minigun";
  }

  if (skillName === "molotov") {
    return "Molotov";
  }

  return "None";
}

function getArmorStatusText(time) {
  if (!player.armorBroken) {
    return "Armor: " + player.upgradedArmorProtection + "%";
  }

  const repairSeconds = Math.max(0, Math.ceil((player.armorRepairEndTime - time) / 1000));

  if (repairSeconds > 0) {
    return "Armor: Broken, Repair " + repairSeconds + "s";
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

function getSkillCooldownText(time) {
  return "Rocket " + getCooldownText(time, player.rocketReadyTime, isRocketUnlocked()) +
    ", Minigun " + getCooldownText(time, player.minigunReadyTime, isMinigunUnlocked()) +
    ", Molotov " + getCooldownText(time, player.molotovReadyTime, isMolotovUnlocked());
}

function getCooldownText(time, readyTime, unlocked) {
  if (!unlocked) {
    return "Locked";
  }

  if (time < readyTime) {
    return Math.ceil((readyTime - time) / 1000) + "s";
  }

  return "Ready";
}

function updateAllButtons() {
  if (!player) {
    return;
  }

  const now = performance.now();
  updateWeaponButtons();
  updateSkillButton(rocketBtn, "3 Rocket Launcher", isRocketUnlocked(), player.rocketReadyTime, "rocket", now);
  updateSkillButton(minigunBtn, "4 Minigun", isMinigunUnlocked(), player.minigunReadyTime, "minigun", now);
  updateSkillButton(molotovBtn, "5 Molotov", isMolotovUnlocked(), player.molotovReadyTime, "molotov", now);
  updateShieldButton(now);
  updateUpgradeButtons();
}

function updateWeaponButtons() {
  const laserUnlocked = score >= LASER_UNLOCK_SCORE;

  normalGunBtn.disabled = gameOver || win;
  normalGunBtn.textContent = "1 Normal Gun - " + player.normalGunDamage + " dmg";
  normalGunBtn.classList.toggle("selected", player.weapon === "normal");

  laserGunBtn.disabled = !laserUnlocked || gameOver || win;
  laserGunBtn.textContent = laserUnlocked ? "2 Laser Gun - " + player.laserGunDamage + " dmg" : "2 Laser Gun - Locked";
  laserGunBtn.classList.toggle("selected", player.weapon === "laser");
}

function updateSkillButton(button, label, unlocked, readyTime, skillName, time) {
  button.classList.remove("ready", "cooldown", "active-skill");
  button.disabled = !unlocked || gameOver || win || time < readyTime;

  if (!unlocked) {
    button.textContent = label + " - Locked";
    return;
  }

  if (player.activeSkill === skillName) {
    button.classList.add("active-skill");
  }

  if (time < readyTime) {
    button.classList.add("cooldown");
    button.textContent = label + " - " + Math.ceil((readyTime - time) / 1000) + "s";
    return;
  }

  button.classList.add("ready");
  button.textContent = label + " - Ready";
}

function updateShieldButton(time) {
  const shieldUnlocked = score >= SHIELD_UNLOCK_SCORE;

  shieldBtn.disabled = !shieldUnlocked || isShieldActive(time) || gameOver || win;

  if (!shieldUnlocked) {
    shieldBtn.textContent = "Shield - Locked";
    return;
  }

  if (isShieldActive(time)) {
    shieldBtn.textContent = "Shield - Active " + Math.ceil((shieldActiveUntil - time) / 1000) + "s";
    return;
  }

  shieldBtn.textContent = "Shield - Ready (S)";
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
