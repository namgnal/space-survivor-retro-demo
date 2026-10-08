const CONFIG = { baseDropRate: { magnet: 0.005, heart: 0.02 }, maxWeaponLevel: 5, upgradeChoices: 4 };
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const ui = {
    hud: document.getElementById('hud'), timer: document.getElementById('timer'), level: document.getElementById('player-level'),
    xpBar: document.getElementById('xp-bar'), hpBar: document.getElementById('hp-bar'), hpText: document.getElementById('hp-text'),
    menu: document.getElementById('menu-screen'), gameOver: document.getElementById('game-over-screen'), levelUp: document.getElementById('level-up-modal'),
    pauseModal: document.getElementById('pause-modal'), pauseWeapons: document.getElementById('pause-weapons'), pausePassives: document.getElementById('pause-passives'),
    levelupWeapons: document.getElementById('levelup-weapons-list'), levelupPassives: document.getElementById('levelup-passives-list'),
    options: document.getElementById('upgrade-options'), finalTime: document.getElementById('final-time'), finalLevel: document.getElementById('final-level'),
    warning: document.getElementById('warning-banner'), warningMsg: document.getElementById('warning-msg'),
    btns: { start: document.getElementById('start-btn'), restart: document.getElementById('restart-btn'), reroll: document.getElementById('reroll-btn'), rerollCount: document.getElementById('reroll-count'), pause: document.getElementById('pause-btn'), resume: document.getElementById('resume-btn') }
};
let state = { screen: 'menu', lastTime: 0, gameTime: 0, animId: null, shake: 0, eventState: 'normal', hellModeTriggered: false };
let world = { w: 4000, h: 4000 };
let camera = { x: 0, y: 0 };
let player = {};
let enemies = [], items = [], projectiles = [], damageNums = [];
let pools = { proj: [], dmg: [] };
const EVOLUTIONS = { 'magicMissile': 'cd', 'bomb': 'area', 'garlicAura': 'regen', 'laserLance': 'speed', 'spinningShield': 'armor' };
const enemyTypes = {
    'slime': { type: 'slime', hp: 10, damage: 8, speed: 1.5, size: 25, color: '#e11d48', xp: 2 },
    'bat': { type: 'bat', hp: 5, damage: 5, speed: 3.0, size: 20, color: '#f97316', xp: 1 },
    'golem': { type: 'golem', hp: 50, damage: 20, speed: 1.0, size: 40, color: '#78350f', xp: 5 },
    'eliteSlime': { type: 'eliteSlime', hp: 200, damage: 25, speed: 0.8, size: 60, color: '#a21caf', xp: 50, dropsMagnet: true },
    'boss': { type: 'boss', hp: 3000, damage: 40, speed: 1.8, size: 140, color: '#dc2626', xp: 500, dropsMagnet: true },
    'exploder': { type: 'exploder', hp: 30, damage: 50, speed: 4.0, size: 30, color: '#ef4444', xp: 5 }
};
const PASSIVES = { 'speed': { name: '迅捷', desc: '移速+10%' }, 'cd': { name: '专注', desc: '冷却-10%' }, 'area': { name: '巨大化', desc: '武器范围+15%' }, 'damage': { name: '力量', desc: '伤害+10%' }, 'armor': { name: '护甲', desc: '减伤+1' }, 'regen': { name: '再生', desc: '回血+0.4/s' }, 'luck': { name: '幸运', desc: '掉率增加' }, 'growth': { name: '成长', desc: '经验+15%' }, 'maxHp': { name: '活力', desc: '血上限+20%' } };
function init() {
    resize();
    window.addEventListener('resize', resize);
    setupInputs();
    ui.btns.start.onclick = startGame;
    ui.btns.restart.onclick = startGame;
    ui.btns.reroll.onclick = onReroll;
    ui.btns.pause.onclick = togglePause;
    ui.btns.resume.onclick = togglePause;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function startGame() {
    enemySpawnTimer = 0;
    if (state.animId)
        cancelAnimationFrame(state.animId);
    state.screen = 'playing';
    state.gameTime = 0;
    state.lastTime = performance.now();
    state.shake = 0;
    state.eventState = 'normal';
    state.hellModeTriggered = false;
    resetPlayer();
    enemies = [];
    items = [];
    projectiles = [];
    damageNums = [];
    pools = { proj: [], dmg: [] };
    ui.menu.classList.add('hidden');
    ui.gameOver.classList.add('hidden');
    ui.levelUp.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.warning.classList.add('hidden');
    ui.pauseModal.classList.add('hidden');
    loop(state.lastTime);
}
function resetPlayer() {
    player = {
        x: world.w / 2, y: world.h / 2, size: 25, speed: 3.5, hp: 100, maxHp: 100, xp: 0, xpNeed: 10, level: 1, pickupRange: 80,
        invincible: 0,
        speedBoostTimer: 0,
        trail: [],
        rerolls: 1, dir: { x: 1, y: 0 },
        stats: { damage: 1, projSpd: 1, cd: 0, area: 1, duration: 1, amount: 0, armor: 0, regen: 0, luck: 1, growth: 0 },
        weapons: [], passives: {},
        nextUpgradeGuaranteedRed: false, firstChosenId: null
    };
    addWeapon('magicMissile');
    updateStatsUI();
}
function togglePause() {
    if (state.screen === 'playing') {
        state.screen = 'paused';
        ui.pauseModal.classList.remove('hidden');
        renderPauseMenu();
    }
    else if (state.screen === 'paused') {
        state.screen = 'playing';
        ui.pauseModal.classList.add('hidden');
        cancelAnimationFrame(state.animId);
        state.lastTime = performance.now();
        loop(state.lastTime);
    }
}
function renderPauseMenu() {
    ui.pauseWeapons.innerHTML = '';
    player.weapons.forEach(w => {
        const div = document.createElement('div');
        div.className = 'flex justify-between bg-gray-700 p-2 rounded';
        div.innerHTML = `<span class="${w.evolved ? 'text-red-400 font-bold' : ''}">${w.name}</span><span>Lv.${w.level}</span>`;
        ui.pauseWeapons.appendChild(div);
    });
    ui.pausePassives.innerHTML = '';
    for (let k in player.passives) {
        const div = document.createElement('div');
        div.className = 'flex justify-between bg-gray-700 p-2 rounded text-xs';
        div.innerHTML = `<span class="text-gray-300">${PASSIVES[k].name}</span><span>Lv.${player.passives[k]}</span>`;
        ui.pausePassives.appendChild(div);
    }
}
function renderLevelUpStats() {
    ui.levelupWeapons.innerHTML = '';
    player.weapons.forEach(w => {
        const div = document.createElement('div');
        div.className = 'flex justify-between bg-gray-800 p-1 rounded border border-gray-700';
        div.innerHTML = `<span class="${w.evolved ? 'text-red-400' : ''}">${w.name}</span><span>Lv.${w.level}</span>`;
        ui.levelupWeapons.appendChild(div);
    });
    ui.levelupPassives.innerHTML = '';
    for (let k in player.passives) {
        const div = document.createElement('div');
        div.className = 'flex justify-between bg-gray-800 p-1 rounded border border-gray-700';
        div.innerHTML = `<span class="text-gray-300">${PASSIVES[k].name}</span><span>Lv.${player.passives[k]}</span>`;
        ui.levelupPassives.appendChild(div);
    }
}
function loop(now) {
    if (state.screen !== 'playing')
        return;
    const dt = now - state.lastTime;
    state.lastTime = now;
    update(Math.min(dt, 60));
    draw();
    state.animId = requestAnimationFrame(loop);
}
function update(dt) {
    state.gameTime += dt / 1000;
    updatePlayer(dt);
    updateCamera();
    updateEnemies(dt);
    updateWeapons(dt);
    updateProjectiles(dt);
    updateItems(dt);
    updateDamageNums(dt);
    checkCollisions();
    spawnSystem(dt);
    handleEvents();
    if (state.shake > 0)
        state.shake -= dt * 0.1;
    ui.timer.textContent = formatTime(state.gameTime);
    if (player.hp <= 0)
        gameOver();
}
function handleEvents() {
    const cycle = Math.floor(state.gameTime);
    if (state.gameTime >= 300 && !state.hellModeTriggered) {
        state.hellModeTriggered = true;
        showWarning("⚠️ 炼狱模式开启 ⚠️");
        setTimeout(() => { if (state.eventState !== 'swarm' && state.eventState !== 'boss')
            hideWarning(); }, 5000);
    }
    if (cycle > 10 && cycle % 60 === 0 && cycle % 120 !== 0) {
        if (state.eventState !== 'swarm' && player.level >= 10) {
            state.eventState = 'swarm';
            showWarning("⚠️ 虫群来袭 ⚠️");
            setTimeout(() => { state.eventState = 'normal'; hideWarning(); }, 12000);
        }
    }
    if (cycle > 10 && cycle % 120 === 0) {
        if (state.eventState !== 'boss') {
            state.eventState = 'boss';
            showWarning("☠️ 神秘BOSS 降临 ☠️");
            spawnOneEnemy('boss');
            setTimeout(() => { state.eventState = 'normal'; hideWarning(); }, 5000);
        }
    }
}
function showWarning(text) { ui.warningMsg.textContent = text; ui.warning.classList.remove('hidden'); }
function hideWarning() { ui.warning.classList.add('hidden'); }
function updatePlayer(dt) {
    if (touch.active) {
        let dx = touch.dx, dy = touch.dy;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) {
            dx /= len;
            dy /= len;
        }
        const speedMultiplier = player.speedBoostTimer > 0 ? 1.5 : 1.0;
        player.x += dx * player.speed * speedMultiplier;
        player.y += dy * player.speed * speedMultiplier;
        player.x = Math.max(20, Math.min(world.w - 20, player.x));
        player.y = Math.max(20, Math.min(world.h - 20, player.y));
        if (len > 0.1) {
            player.dir = { x: dx, y: dy };
            const dLen = Math.sqrt(dx * dx + dy * dy);
            if (dLen > 0) {
                player.dir.x /= dLen;
                player.dir.y /= dLen;
            }
        }
    }
    if (player.speedBoostTimer > 0) {
        player.speedBoostTimer -= dt;
        if (state.gameTime * 1000 % 100 < 50) {
            player.trail.push({ x: player.x, y: player.y, life: 400 });
        }
    }
    for (let i = player.trail.length - 1; i >= 0; i--) {
        player.trail[i].life -= dt;
        if (player.trail[i].life <= 0)
            player.trail.splice(i, 1);
    }
    if (player.stats.regen > 0 && player.hp < player.maxHp) {
        player.hp += player.stats.regen * (dt / 1000);
        if (player.hp > player.maxHp)
            player.hp = player.maxHp;
        updateStatsUI();
    }
    if (player.invincible > 0)
        player.invincible -= dt;
}
function updateCamera() { camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2; }
function takePlayerDamage(amount) {
    if (player.invincible > 0)
        return;
    const dmg = Math.max(1, amount - player.stats.armor);
    player.hp -= dmg;
    state.shake = 8;
    updateStatsUI();
    let invincibilityDuration = 1000;
    if (state.gameTime > 300) {
        const minutesPastHell = Math.floor((state.gameTime - 300) / 60) + 1;
        invincibilityDuration = Math.max(200, 1000 - minutesPastHell * 200);
    }
    player.invincible = invincibilityDuration;
    player.speedBoostTimer = 2000;
    spawnDmgNum(player.x, player.y - 30, "加速!", "#22d3ee");
}
function checkCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (p.isEnemy)
            continue;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (getDist(p, e) < p.r + e.r) {
                hitEnemy(e, p.damage);
                p.pierce--;
                const angle = Math.atan2(e.y - p.y, e.x - p.x);
                e.x += Math.cos(angle) * 5;
                e.y += Math.sin(angle) * 5;
                if (p.pierce < 0) {
                    returnPool(pools.proj, p);
                    projectiles.splice(i, 1);
                    break;
                }
            }
        }
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (!p.isEnemy)
            continue;
        if (getDist(p, player) < p.r + player.size / 2) {
            takePlayerDamage(p.damage);
            p.life = 0;
            returnPool(pools.proj, p);
            projectiles.splice(i, 1);
        }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (getDist(player, e) < player.size / 2 + e.r) {
            const incomingDmg = e.damage || 10;
            takePlayerDamage(incomingDmg);
            hitEnemy(e, e.maxHp, true);
            if (e.type === 'exploder') {
                explode(e.x, e.y, { level: 3, evolved: false }, true);
                enemies.splice(i, 1);
            }
            break;
        }
    }
}
function updateEnemies(dt) {
    for (const e of enemies) {
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;
        if (e.hitFlash > 0)
            e.hitFlash -= dt;
        if (e.hitShieldTimer > 0)
            e.hitShieldTimer -= dt;
        if (e.type === 'boss') {
            if (!e.shootTimer)
                e.shootTimer = 2000;
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
                e.shootTimer = 3000;
                const bulletCount = 12;
                for (let i = 0; i < bulletCount; i++) {
                    const shootAngle = (Math.PI * 2 / bulletCount) * i;
                    spawnProj(e.x, e.y, shootAngle, 5, 8, 20, 0, '#ef4444', true);
                }
            }
        }
    }
}
function hitEnemy(e, damage, silent = false) {
    e.hp -= damage;
    e.hitFlash = 100;
    if (!silent)
        spawnDmgNum(e.x, e.y, Math.round(damage), "#fff");
    if (e.hp <= 0) {
        const isHellMode = state.gameTime > 300;
        const dropMult = isHellMode ? 0.5 : 1.0;
        spawnItem(e.x, e.y, 'xp', e.xp);
        if (e.isElite || Math.random() < CONFIG.baseDropRate.magnet * player.stats.luck * dropMult)
            spawnItem(e.x + 10, e.y, 'magnet');
        if (Math.random() < CONFIG.baseDropRate.heart * player.stats.luck * dropMult)
            spawnItem(e.x - 10, e.y, 'heart');
        if (e.type === 'boss') {
            for (let k = 0; k < 10; k++)
                spawnItem(e.x + (Math.random() - 0.5) * 50, e.y + (Math.random() - 0.5) * 50, 'xp', 50);
        }
        const idx = enemies.indexOf(e);
        if (idx > -1)
            enemies.splice(idx, 1);
    }
}
const WEAPONS = {
    'magicMissile': {
        name: '魔法飞弹', desc: '自动索敌飞弹。', evoName: '【加特林】', evoDesc: '射速极快。', cd: 1000,
        update(w, dt) {
            const baseCd = w.evolved ? 80 : this.cd;
            if (Date.now() - w.lastFire > baseCd * (1 - player.stats.cd)) {
                w.lastFire = Date.now();
                fireMagicMissile(w);
            }
        }
    },
    'bomb': {
        name: '定时炸弹', desc: '放置会爆炸的地雷。', evoName: '【核弹】', evoDesc: '巨大范围，伤害极高。', cd: 4000, bombs: [],
        update(w, dt) {
            for (let i = w.bombs.length - 1; i >= 0; i--) {
                const b = w.bombs[i];
                b.timer -= dt;
                if (b.timer <= 0) {
                    explode(b.x, b.y, w);
                    w.bombs.splice(i, 1);
                }
            }
            if (Date.now() - w.lastFire > this.cd * (1 - player.stats.cd)) {
                w.lastFire = Date.now();
                const count = 1 + Math.floor(w.level / 3) + player.stats.amount + (w.evolved ? 2 : 0);
                for (let i = 0; i < count; i++) {
                    const t = getNearestEnemies(1)[0];
                    w.bombs.push({ x: t ? t.x : player.x + (Math.random() - 0.5) * 200, y: t ? t.y : player.y + (Math.random() - 0.5) * 200, timer: 1500 });
                }
            }
        },
        draw(w) { w.bombs.forEach(b => { ctx.fillStyle = (b.timer % 200 < 100) ? '#ef4444' : '#f97316'; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'black'; ctx.font = 'bold 12px sans'; ctx.fillText('!', b.x - 2, b.y + 4); }); }
    },
    'spinningShield': {
        name: '旋转护盾', desc: '环绕周身造成伤害。', evoName: '【锯齿风暴】', evoDesc: '旋转极快，产生击退力场。', angle: 0,
        update(w, dt) { w.angle += dt * 0.003 * ((2.0 + w.level * 0.2) * (w.evolved ? 2.5 : 1)); },
        draw(w) {
            const count = w.level + player.stats.amount + (w.evolved ? 2 : 0);
            const r = 75 * player.stats.area;
            const damage = (8 + w.level * 3) * player.stats.damage * (w.evolved ? 1.5 : 1);
            for (let i = 0; i < count; i++) {
                const a = w.angle + (Math.PI * 2 / count) * i;
                const sx = player.x + Math.cos(a) * r;
                const sy = player.y + Math.sin(a) * r;
                ctx.fillStyle = w.evolved ? '#facc15' : '#3b82f6';
                ctx.beginPath();
                ctx.arc(sx, sy, w.evolved ? 15 : 10, 0, Math.PI * 2);
                ctx.fill();
                enemies.forEach(e => { if (state.screen !== 'playing' || e.hitShieldTimer > 0)
                    return; if (getDist({ x: sx, y: sy }, e) < (w.evolved ? 20 : 15) + e.r) {
                    hitEnemy(e, damage);
                    e.hitShieldTimer = 200;
                    const pushA = Math.atan2(e.y - player.y, e.x - player.x);
                    e.x += Math.cos(pushA) * (w.evolved ? 20 : 5);
                    e.y += Math.sin(pushA) * (w.evolved ? 20 : 5);
                } });
            }
        }
    },
    'garlicAura': {
        name: '大蒜光环', desc: '持续伤害周围敌人。', evoName: '【虚空领域】', evoDesc: '吸血。', lastTick: 0,
        update(w, dt) {
            if (Date.now() - w.lastTick > 500) {
                w.lastTick = Date.now();
                const r = (110 + w.level * 15) * player.stats.area * (w.evolved ? 1.4 : 1);
                const damage = (4 + w.level * 2) * player.stats.damage * (w.evolved ? 2 : 1);
                let healed = false;
                enemies.forEach(e => { if (getDist(player, e) < r + e.r) {
                    hitEnemy(e, damage);
                    if (w.evolved && !healed && Math.random() < 0.2) {
                        player.hp = Math.min(player.maxHp, player.hp + 2);
                        updateStatsUI();
                        healed = true;
                    }
                } });
            }
        },
        draw(w) { const r = (110 + w.level * 15) * player.stats.area * (w.evolved ? 1.4 : 1); ctx.fillStyle = w.evolved ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(player.x, player.y, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = w.evolved ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke(); }
    },
    'laserLance': {
        name: '断后圣枪', desc: '向移动反方向发射光束。', evoName: '【死星射线】', evoDesc: '向四个方向同时发射毁灭光束。', cd: 1800, visTimer: 0,
        update(w, dt) { if (Date.now() - w.lastFire > this.cd * (1 - player.stats.cd)) {
            w.lastFire = Date.now();
            fireLaserLance(w);
        } if (w.visTimer > 0)
            w.visTimer -= dt; },
        draw(w) {
            if (w.visTimer > 0) {
                const len = 450 * player.stats.area;
                const alpha = w.visTimer / 300;
                ctx.lineWidth = (25 + w.level * 3) * player.stats.area;
                ctx.lineCap = 'round';
                ctx.strokeStyle = w.evolved ? `rgba(239,68,68,${alpha})` : `rgba(147,197,253,${alpha})`;
                let dirs = w.evolved ? [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }] : [{ x: -player.dir.x, y: -player.dir.y }];
                dirs.forEach(d => { ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.x + d.x * len, player.y + d.y * len); ctx.stroke(); });
            }
        }
    }
};
function fireMagicMissile(w) {
    const count = (w.evolved ? 1 : 1) + (w.level >= 2 ? 1 : 0) + (w.level >= 4 ? 1 : 0) + player.stats.amount;
    const targets = getNearestEnemies(count);
    targets.forEach(t => {
        const angle = Math.atan2(t.y - player.y, t.x - player.x);
        const damage = (5 + w.level * 2) * player.stats.damage * (w.evolved ? 1.5 : 1);
        const spd = (6 + player.stats.projSpd) * (w.evolved ? 1.5 : 1);
        spawnProj(player.x, player.y, angle, spd, 6, damage, w.evolved ? 99 : 0, w.evolved ? '#ef4444' : '#fff', false);
    });
}
function fireLaserLance(w) {
    w.visTimer = 300;
    const damage = (20 + w.level * 8) * player.stats.damage * (w.evolved ? 1.5 : 1);
    const len = 450 * player.stats.area;
    const width = (25 + w.level * 3) * player.stats.area;
    let dirs = w.evolved ? [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }] : [{ x: -player.dir.x, y: -player.dir.y }];
    dirs.forEach(d => { enemies.forEach(e => { const v = { x: e.x - player.x, y: e.y - player.y }; const dot = v.x * d.x + v.y * d.y; const cross = Math.abs(v.x * d.y - v.y * d.x); if (dot > 0 && dot < len && cross < width / 2 + e.r)
        hitEnemy(e, damage); }); });
}
function explode(x, y, w, enemyExplosion = false) {
    if (enemyExplosion) {
        state.shake = 10;
        projectiles.push({ x: x, y: y, vx: 0, vy: 0, r: 60, color: 'rgba(239,68,68,0.5)', life: 200, active: true, damage: 0, pierce: 999 });
        return;
    }
    const r = (150 + w.level * 20) * player.stats.area * (w.evolved ? 1.5 : 1);
    const damage = (40 + w.level * 10) * player.stats.damage * (w.evolved ? 2 : 1);
    enemies.forEach(e => { if (getDist({ x, y }, e) < r + e.r)
        hitEnemy(e, damage); });
    state.shake = 10;
    projectiles.push({ x: x, y: y, vx: 0, vy: 0, r: r, color: 'rgba(255,100,0,0.3)', life: 150, active: true, damage: 0, pierce: 999 });
}
function getFromPool(pool) { return pool.length > 0 ? pool.pop() : {}; }
function spawnProj(x, y, angle, spd, r, damage, pierce, color, isEnemy = false) { const p = getFromPool(pools.proj); p.x = x; p.y = y; p.vx = Math.cos(angle) * spd; p.vy = Math.sin(angle) * spd; p.r = r; p.damage = damage; p.pierce = pierce; p.color = color; p.life = 2000; p.active = true; p.isEnemy = isEnemy; projectiles.push(p); }
function returnPool(pool, obj) { obj.active = false; pool.push(obj); }
function addWeapon(id) { const proto = WEAPONS[id]; const w = { id: id, name: proto.name, level: 1, lastFire: 0, evolved: false, ...JSON.parse(JSON.stringify(proto)) }; w.update = proto.update; w.draw = proto.draw; if (id === 'bomb')
    w.bombs = []; player.weapons.push(w); }
function applyPassive(id) {
    player.passives[id] = (player.passives[id] || 0) + 1;
    if (id === 'speed')
        player.speed *= 1.1;
    if (id === 'cd')
        player.stats.cd = 1 - (1 - player.stats.cd) * 0.9;
    if (id === 'area')
        player.stats.area *= 1.15;
    if (id === 'damage')
        player.stats.damage *= 1.1;
    if (id === 'armor')
        player.stats.armor += 1;
    if (id === 'regen')
        player.stats.regen += 0.4;
    if (id === 'growth')
        player.stats.growth += 0.15;
    if (id === 'luck')
        player.stats.luck += 0.2;
    if (id === 'maxHp') {
        player.maxHp *= 1.2;
        player.hp += 20;
    }
    updateStatsUI();
}
function gainXp(val) {
    player.xp += val * (1 + player.stats.growth);
    if (player.xp >= player.xpNeed)
        levelUp();
    updateStatsUI();
}
function levelUp() {
    state.screen = 'levelup';
    player.level++;
    player.xp -= player.xpNeed;
    player.xpNeed = Math.floor(player.xpNeed * 1.2);
    if (player.level % 5 === 0) {
        player.rerolls++;
        updateStatsUI();
    }
    showUpgradeMenu();
}
function showUpgradeMenu() {
    ui.levelUp.classList.remove('hidden');
    ui.options.innerHTML = '';
    renderLevelUpStats();
    const list = generateChoices();
    list.forEach(c => {
        const div = document.createElement('div');
        const isEvo = c.type === 'evo';
        const isOmen = c.type === 'omen';
        let borderClass = 'border-gray-600 bg-gray-800 hover:bg-gray-700';
        if (isEvo)
            borderClass = 'border-red-500 bg-gradient-to-r from-red-900 to-red-700';
        if (isOmen)
            borderClass = 'border-cyan-500 bg-gray-900 shadow-[0_0_15px_rgba(34,211,238,0.5)]';
        div.className = `p-3 border-2 rounded cursor-pointer transition transform hover:scale-[1.02] ${borderClass}`;
        let titleClass = 'text-white';
        if (isEvo)
            titleClass = 'text-yellow-300 evo-text';
        if (isOmen)
            titleClass = 'text-cyan-300 omen-text font-black';
        div.innerHTML = `<div class="flex justify-between items-center mb-1"><h3 class="font-bold ${titleClass}">${c.name}</h3><span class="text-xs bg-black bg-opacity-40 px-2 py-0.5 rounded text-gray-300">${c.tag}</span></div><p class="text-xs text-gray-400">${c.desc}</p>`;
        div.onclick = () => {
            if (player.firstChosenId === null) {
                if (c.type === 'new_weapon' || c.type === 'weapon_up') {
                    player.firstChosenId = c.id;
                }
            }
            if (c.type === 'evo') {
                const w = player.weapons.find(w => w.id === c.id);
                w.evolved = true;
                w.name = w.evoName;
                spawnDmgNum(player.x, player.y - 50, "EVOLUTION!", "#facc15");
            }
            else if (c.type === 'weapon_up')
                player.weapons.find(w => w.id === c.id).level++;
            else if (c.type === 'new_weapon')
                addWeapon(c.id);
            else if (c.type === 'passive')
                applyPassive(c.id);
            else if (c.type === 'omen') {
                player.rerolls++;
                player.nextUpgradeGuaranteedRed = true;
                updateStatsUI();
            }
            ui.levelUp.classList.add('hidden');
            state.screen = 'playing';
            player.invincible = 1000;
            cancelAnimationFrame(state.animId);
            state.lastTime = performance.now();
            loop(state.lastTime);
        };
        ui.options.appendChild(div);
    });
    ui.btns.reroll.style.display = player.rerolls > 0 ? 'flex' : 'none';
    ui.btns.rerollCount.textContent = player.rerolls;
}
function generateChoices() {
    if (player.nextUpgradeGuaranteedRed) {
        const evos = [];
        player.weapons.forEach(w => {
            if (!w.evolved && w.level >= CONFIG.maxWeaponLevel) {
                const neededPassive = EVOLUTIONS[w.id];
                if (player.passives[neededPassive]) {
                    evos.push({ type: 'evo', id: w.id, name: `进化: ${w.evoName}`, desc: w.evoDesc, tag: '天兆降临' });
                }
            }
        });
        if (evos.length > 0) {
            player.nextUpgradeGuaranteedRed = false;
            const others = getNormalChoices().filter(c => c.type !== 'evo');
            return [...evos, ...others].slice(0, CONFIG.upgradeChoices);
        }
    }
    let list = getNormalChoices();
    list = list.sort(() => Math.random() - 0.5);
    if (player.firstChosenId) {
        const favoriteItems = list.filter(item => item.id === player.firstChosenId && item.type === 'weapon_up');
        if (favoriteItems.length > 0) {
            const fav = favoriteItems[0];
            list.push(fav);
            list.push(fav);
            list = list.sort(() => Math.random() - 0.5);
        }
    }
    const unique = [];
    const seen = new Set();
    for (const i of list) {
        const key = i.type + i.id;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(i);
        }
        if (unique.length >= CONFIG.upgradeChoices)
            break;
    }
    const hasReadyEvolution = player.weapons.some(w => !w.evolved && w.level >= CONFIG.maxWeaponLevel && player.passives[EVOLUTIONS[w.id]]);
    const hasEvoInList = unique.some(c => c.type === 'evo');
    if (hasReadyEvolution && !hasEvoInList) {
        unique[unique.length - 1] = {
            type: 'omen',
            name: '天兆',
            desc: '获得1次重选，也许还有什么额外效果...',
            tag: '神启'
        };
    }
    return unique;
}
function getNormalChoices() {
    const list = [];
    player.weapons.forEach(w => {
        if (!w.evolved && w.level >= CONFIG.maxWeaponLevel) {
            const neededPassive = EVOLUTIONS[w.id];
            if (player.passives[neededPassive])
                list.push({ type: 'evo', id: w.id, name: `进化: ${w.evoName}`, desc: w.evoDesc, tag: '神器' });
        }
    });
    player.weapons.forEach(w => { if (!w.evolved && w.level < CONFIG.maxWeaponLevel)
        list.push({ type: 'weapon_up', id: w.id, name: `${w.name} Lv.${w.level + 1}`, desc: '提升威力', tag: '升级' }); });
    if (player.weapons.length < 4)
        for (let id in WEAPONS)
            if (!player.weapons.find(w => w.id === id))
                list.push({ type: 'new_weapon', id: id, name: `新: ${WEAPONS[id].name}`, desc: WEAPONS[id].desc, tag: '新武器' });
    for (let id in PASSIVES)
        if ((player.passives[id] || 0) < 5)
            list.push({ type: 'passive', id: id, name: `${PASSIVES[id].name} (Lv.${(player.passives[id] || 0) + 1})`, desc: PASSIVES[id].desc, tag: '被动' });
    return list;
}
function onReroll() { if (player.rerolls > 0) {
    player.rerolls--;
    showUpgradeMenu();
} }
function spawnSystem(dt) {
    enemySpawnTimer += dt / 1000;
    let interval = Math.max(0.1, 1.5 - state.gameTime / 45);
    if (state.eventState === 'swarm')
        interval = 0.1;
    if (enemySpawnTimer > interval) {
        enemySpawnTimer = 0;
        const count = 1 + Math.floor(state.gameTime / 15);
        for (let i = 0; i < count; i++)
            spawnEnemy();
    }
}
function spawnOneEnemy(forcedType) {
    const proto = enemyTypes[forcedType];
    const e = { ...proto, x: 0, y: 0, hp: proto.hp, maxHp: proto.hp, r: proto.size / 2, hitFlash: 0, hitShieldTimer: 0, isElite: true };
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(canvas.width, canvas.height) / 2 + 50;
    e.x = player.x + Math.cos(angle) * dist;
    e.y = player.y + Math.sin(angle) * dist;
    enemies.push(e);
}
function spawnEnemy() {
    if (state.eventState === 'swarm') {
        const proto = enemyTypes['bat'];
        const e = { ...proto, x: 0, y: 0, hp: 1, maxHp: 1, r: proto.size / 2, damage: 2, speed: 2.8, hitFlash: 0, hitShieldTimer: 0, isElite: false };
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(canvas.width, canvas.height) / 2 + 50;
        e.x = player.x + Math.cos(angle) * dist;
        e.y = player.y + Math.sin(angle) * dist;
        enemies.push(e);
        return;
    }
    const rand = Math.random();
    let type = 'slime';
    if (state.gameTime > 30 && rand < 0.4)
        type = 'bat';
    if (state.gameTime > 90 && rand < 0.25)
        type = 'golem';
    if (state.gameTime > 60 && rand < 0.1)
        type = 'exploder';
    const proto = enemyTypes[type];
    const scaling = 1 + (state.gameTime / 60) + Math.pow(state.gameTime / 60, 2);
    const e = { ...proto, x: 0, y: 0, hp: proto.hp * scaling, maxHp: proto.hp * scaling, hitFlash: 0, hitShieldTimer: 0, isElite: false };
    if (state.gameTime > 30 && Math.random() < 0.02 * player.stats.luck) {
        e.type = 'eliteSlime';
        e.isElite = true;
        e.hp *= 3;
        e.maxHp *= 3;
        e.size *= 1.3;
        e.r = e.size / 2;
        e.color = '#a21caf';
        e.xp *= 10;
    }
    else {
        e.r = e.size / 2;
    }
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(canvas.width, canvas.height) / 2 + 50;
    e.x = player.x + Math.cos(angle) * dist;
    e.y = player.y + Math.sin(angle) * dist;
    enemies.push(e);
}
function spawnItem(x, y, type, val = 0) { items.push({ x, y, type, val, attracted: false }); }
function spawnDmgNum(x, y, txt, color = '#fff') { const d = getFromPool(pools.dmg); d.x = x; d.y = y; d.txt = txt; d.life = 600; d.color = color; d.active = true; damageNums.push(d); }
function updateDamageNums(dt) { for (let i = damageNums.length - 1; i >= 0; i--) {
    const d = damageNums[i];
    d.y -= dt * 0.05;
    d.life -= dt;
    if (d.life <= 0) {
        returnPool(pools.dmg, d);
        damageNums.splice(i, 1);
    }
} }
function updateWeapons(dt) { player.weapons.forEach(w => w.update(w, dt)); }
function updateProjectiles(dt) { for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt;
    if (p.life <= 0) {
        returnPool(pools.proj, p);
        projectiles.splice(i, 1);
    }
} }
function updateItems(dt) { for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const d = getDist(player, it);
    if (it.attracted || d < player.pickupRange) {
        it.attracted = true;
        const a = Math.atan2(player.y - it.y, player.x - it.x);
        const s = 14;
        it.x += Math.cos(a) * s;
        it.y += Math.sin(a) * s;
        if (getDist(player, it) < player.size) {
            if (it.type === 'xp')
                gainXp(it.val);
            if (it.type === 'heart') {
                player.hp = Math.min(player.maxHp, player.hp + 20);
                updateStatsUI();
                spawnDmgNum(player.x, player.y - 20, "+20", "#22c55e");
            }
            if (it.type === 'magnet')
                items.forEach(o => o.attracted = true);
            items.splice(i, 1);
        }
    }
} }
function draw() {
    const sx = (Math.random() - 0.5) * state.shake;
    const sy = (Math.random() - 0.5) * state.shake;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x + sx, -camera.y + sy);
    drawGrid();
    items.forEach(it => { if (it.type === 'xp') {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.rect(it.x - 3, it.y - 3, 6, 6);
        ctx.fill();
    }
    else if (it.type === 'heart') {
        ctx.font = '16px sans';
        ctx.fillText('❤️', it.x - 8, it.y + 6);
    }
    else {
        ctx.font = '16px sans';
        ctx.fillText('🧲', it.x - 8, it.y + 6);
    } });
    enemies.forEach(e => { ctx.fillStyle = e.hitFlash > 0 ? '#fff' : e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); if (e.type === 'boss') {
        ctx.fillStyle = 'red';
        ctx.fillRect(e.x - 40, e.y - e.r - 15, 80, 8);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(e.x - 40, e.y - e.r - 15, 80 * (e.hp / e.maxHp), 8);
    }
    else if (e.hp < e.maxHp) {
        ctx.fillStyle = 'red';
        ctx.fillRect(e.x - 10, e.y - e.r - 8, 20, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(e.x - 10, e.y - e.r - 8, 20 * (e.hp / e.maxHp), 4);
    } });
    projectiles.forEach(p => { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });
    player.weapons.forEach(w => { if (w.draw)
        w.draw(w); });
    if (player.invincible > 0) {
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fbbf24';
    }
    else {
        ctx.fillStyle = '#22c55e';
        ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + player.dir.x * 15, player.y + player.dir.y * 15);
    ctx.stroke();
    if (player.trail && player.trail.length > 0) {
        player.trail.forEach((pos, index) => {
            const alpha = (index / player.trail.length) * 0.5;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#22d3ee';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, player.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }
    damageNums.forEach(d => { ctx.fillStyle = d.color; ctx.font = 'bold 14px sans-serif'; ctx.fillText(d.txt, d.x, d.y); });
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.rect(0, 0, world.w, world.h);
    ctx.stroke();
    ctx.restore();
}
function drawGrid() {
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    const gridSize = 100;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;
    ctx.beginPath();
    for (let x = startX; x < startX + canvas.width + gridSize; x += gridSize) {
        ctx.moveTo(x, camera.y);
        ctx.lineTo(x, camera.y + canvas.height);
    }
    for (let y = startY; y < startY + canvas.height + gridSize; y += gridSize) {
        ctx.moveTo(camera.x, y);
        ctx.lineTo(camera.x + canvas.width, y);
    }
    ctx.stroke();
}
function toScreen(wx, wy) { return { x: wx - camera.x, y: wy - camera.y }; }
function getDist(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
function getNearestEnemies(n) { return enemies.map(e => ({ e, d: getDist(player, e) })).sort((a, b) => a.d - b.d).slice(0, n).map(i => i.e); }
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
function formatTime(t) { const m = Math.floor(t / 60).toString().padStart(2, '0'); const s = Math.floor(t % 60).toString().padStart(2, '0'); return `${m}:${s}`; }
function updateStatsUI() { ui.level.textContent = player.level; ui.xpBar.style.width = `${Math.min(100, (player.xp / player.xpNeed) * 100)}%`; ui.hpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`; ui.hpText.textContent = `${Math.ceil(player.hp)}/${Math.ceil(player.maxHp)}`; ui.btns.rerollCount.textContent = player.rerolls; }
function gameOver() { state.screen = 'gameover'; ui.hud.classList.add('hidden'); ui.gameOver.classList.remove('hidden'); ui.finalTime.textContent = formatTime(state.gameTime); ui.finalLevel.textContent = player.level; }
let touch = { active: false, dx: 0, dy: 0, sx: 0, sy: 0 };
function setupInputs() {
    const h = (e) => { if (state.screen !== 'playing')
        return; e.preventDefault(); const t = e.touches ? e.touches[0] : e; if (e.type === 'touchstart' || e.type === 'mousedown') {
        touch.active = true;
        touch.sx = t.clientX;
        touch.sy = t.clientY;
        touch.dx = 0;
        touch.dy = 0;
    }
    else if (e.type === 'touchmove' || e.type === 'mousemove') {
        if (touch.active) {
            touch.dx = t.clientX - touch.sx;
            touch.dy = t.clientY - touch.sy;
        }
    }
    else {
        touch.active = false;
        touch.dx = 0;
        touch.dy = 0;
    } };
    ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup'].forEach(e => canvas.addEventListener(e, h, { passive: false }));
}
let enemySpawnTimer = 0;
init();
