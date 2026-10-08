const images = new Map();
let enabled = true, scene = 'woodland', walked = 0, hurtAt = -10000, facing = 1;
const names = ['hero', 'slime', 'golem', 'bat', 'boss', 'exploder', 'friendly', 'dart', 'spark', 'hit', 'shield', 'bomb', 'ring', 'tree', 'grass', 'woodland', 'road', 'xp', 'heart', 'magnet', ...Array.from({ length: 12 }, (_, i) => `walk-${String(i).padStart(2, '0')}`)];
const decorations = [];
let seed = 1042026;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
for (let i = 0; i < 75; i++) {
    const x = 120 + random() * 3760, y = 120 + random() * 3760;
    if (Math.hypot(x - 2000, y - 2000) < 230)
        continue;
    decorations.push({ x, y, id: i % 3 ? 'grass' : 'tree', size: i % 3 ? 35 + random() * 18 : 110 + random() * 48 });
}
function sprite(ctx, id, x, y, width, height = width, angle = 0, alpha = 1) {
    const image = images.get(id);
    if (!image)
        return;
    ctx.save();
    ctx.translate(x, y);
    if (angle)
        ctx.rotate(angle);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
}
function shadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(26,29,23,.20)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * .32, 0, 0, Math.PI * 2);
    ctx.fill();
}
function actor(ctx, id, x, y, height, flash = 0) {
    const image = images.get(id);
    if (!image)
        return;
    const width = height * image.naturalWidth / image.naturalHeight;
    shadow(ctx, x, y + height * .31, width * .35);
    ctx.drawImage(image, x - width / 2, y - height * .66, width, height);
    if (flash > 0) {
        sprite(ctx, 'hit', x + width * .2, y - height * .25, 17, 17, -.3, Math.min(.85, flash / 100));
    }
}
function enemy(ctx, e, time) {
    const id = e.type === 'eliteSlime' ? 'slime' : e.type;
    const height = e.type === 'boss' ? 168 : e.type === 'golem' ? 60 : e.type === 'bat' ? 45 : e.type === 'exploder' ? 48 : e.isElite ? 70 : 53;
    const bob = e.type === 'bat' ? Math.sin(time * 9 + e.x) * 2 : 0;
    if (e.isElite) {
        ctx.strokeStyle = e.type === 'boss' ? '#994b41' : '#80588d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 13, e.r + 5, (e.r + 5) * .55, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    actor(ctx, id, e.x, e.y + bob, height, e.hitFlash);
    if (e.hp < e.maxHp || e.type === 'boss') {
        const width = e.type === 'boss' ? 90 : 28, y = e.y - height * .7 - 7;
        ctx.fillStyle = '#51443c';
        ctx.fillRect(e.x - width / 2, y, width, 3);
        ctx.fillStyle = e.isElite ? '#c78677' : '#b9c587';
        ctx.fillRect(e.x - width / 2, y, width * Math.max(0, e.hp / e.maxHp), 3);
    }
}
function hero(ctx, p) {
    const frame = Math.floor(walked / 15) % 12;
    const image = images.get(`walk-${String(frame).padStart(2, '0')}`);
    shadow(ctx, p.x, p.y + 17, 16);
    if (p.invincible > 0) {
        ctx.strokeStyle = 'rgba(239,206,120,.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 9, 22, 12, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(facing, 1);
    ctx.drawImage(image, -39, -48, 78, 78);
    ctx.restore();
    if (performance.now() - hurtAt < 200)
        sprite(ctx, 'hit', p.x + 16, p.y - 20, 24, 24, 0, .8);
    ctx.strokeStyle = 'rgba(248,230,184,.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + p.dir.x * 19, p.y + 13 + p.dir.y * 11);
    ctx.lineTo(p.x + p.dir.x * 25, p.y + 13 + p.dir.y * 15);
    ctx.stroke();
}
function draw({ ctx, canvas, camera, world, player, enemies, items, projectiles, damageNums, state }, weapons) {
    ctx.fillStyle = '#484b3b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const shake = Math.max(0, state.shake);
    ctx.translate(-camera.x + Math.sin(state.gameTime * 83) * shake * .4, -camera.y + Math.cos(state.gameTime * 67) * shake * .4);
    ctx.drawImage(images.get(scene), 0, 0, world.w, world.h);
    for (const prop of decorations) {
        if (prop.x < camera.x - 180 || prop.x > camera.x + canvas.width + 180 || prop.y < camera.y - 180 || prop.y > camera.y + canvas.height + 180)
            continue;
        actor(ctx, prop.id, prop.x, prop.y, prop.size);
    }
    for (const it of items) {
        const size = it.type === 'xp' ? 15 : 24;
        sprite(ctx, it.type, it.x, it.y, size, size);
    }
    const visible = enemies.filter(e => e.x > camera.x - 190 && e.x < camera.x + canvas.width + 190 && e.y > camera.y - 190 && e.y < camera.y + canvas.height + 190);
    const actors = [...visible.map(e => ({ y: e.y, draw: () => enemy(ctx, e, state.gameTime) })), { y: player.y, draw: () => hero(ctx, player) }];
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors)
        a.draw();
    for (const p of projectiles) {
        if (p.damage === 0) {
            const alpha = Math.min(.65, p.life / 240);
            ctx.fillStyle = `rgba(126,77,37,${alpha * .24})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            sprite(ctx, 'ring', p.x, p.y, p.r * 2, p.r * 2, 0, alpha);
            continue;
        }
        const angle = Math.atan2(p.vy, p.vx);
        sprite(ctx, p.isEnemy ? 'dart' : 'friendly', p.x, p.y, p.isEnemy ? 27 : 24, p.isEnemy ? 12 : 12, angle);
    }
    weapons();
    for (const d of damageNums) {
        ctx.globalAlpha = Math.min(1, d.life / 220);
        ctx.font = '600 13px "Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(39,33,27,.75)';
        ctx.strokeText(d.txt, d.x, d.y);
        ctx.fillStyle = d.color === '#fff' ? '#fff4d6' : d.color;
        ctx.fillText(d.txt, d.x, d.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
    ctx.strokeStyle = '#925b4b';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, world.w, world.h);
    ctx.restore();
}
export const Art = {
    get enabled() { return enabled; }, set enabled(value) { enabled = !!value; document.body.dataset.art = enabled ? 'on' : 'off'; },
    set scene(value) { if (['woodland', 'road'].includes(value))
        scene = value; },
    async load() { await Promise.all(names.map(async (name) => { const image = new Image(); image.src = `assets/${name}.png`; await image.decode(); images.set(name, image); })); },
    draw, step(dx, dy) { const distance = Math.hypot(dx, dy); walked += distance; if (Math.abs(dx) > distance * .12)
        facing = Math.sign(dx); },
    reset() { walked = 0; facing = 1; hurtAt = -10000; }, hurt() { hurtAt = performance.now(); },
    bomb(ctx, b) { sprite(ctx, 'bomb', b.x, b.y, 32, 32, 0, b.timer % 200 < 100 ? 1 : .65); },
    shield(ctx, x, y, angle, evolved) { sprite(ctx, 'shield', x, y, evolved ? 40 : 30, evolved ? 40 : 30, angle); },
    aura(ctx, p, r, evolved) { ctx.fillStyle = evolved ? 'rgba(101,72,128,.12)' : 'rgba(246,229,181,.07)'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); sprite(ctx, 'ring', p.x, p.y, r * 2, r * 2, 0, evolved ? .48 : .3); },
    inspect() { return { enabled, scene, loaded: images.size, expected: names.length, walked, walkFrame: Math.floor(walked / 15) % 12, facing: facing < 0 ? 'left' : 'right' }; }
};
