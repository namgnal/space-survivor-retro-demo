import * as SFX from './vendor/audio.js';
import { Art } from './art.js';
import { TrialControls } from './controls.js';
let host, timer = null, tick = 0, nextTick = 0, interval = 150, enabled = true, volume = .65, running = false, focused = false, hasAudio = false;
const counts = {};
let controls;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function mix() { SFX.setVolume(.7 * volume); SFX.setWeaponVolume(.8 * volume); SFX.setHitVolume(.7 * volume); SFX.setBgmVolume(.35 * volume); }
function sound(name) { if (!enabled || document.hidden)
    return; hasAudio = true; counts[name] = (counts[name] || 0) + 1; SFX[name]?.(); }
function pump() {
    if (!running || !enabled || document.hidden)
        return;
    const now = performance.now();
    if (now < nextTick)
        return;
    if (now - nextTick > interval * 2)
        nextTick = now;
    const { state, player } = host.read();
    interval = 60000 / Math.min(160, 100 + state.gameTime * .1) / 4;
    nextTick += interval;
    SFX.syncMusicTransportTick(tick);
    const until = () => Math.max(0, nextTick - performance.now());
    SFX.bgmTick(tick, until, 0, player.hp < player.maxHp * .3, 0);
    if (tick % 4 === 0)
        SFX.sfxKick();
    else if (tick % 2 === 0)
        SFX.sfxHihat();
    if (focused)
        SFX.playMusicFocusTick(tick);
    tick++;
}
function startMusic() {
    if (!enabled)
        return;
    SFX.initAudio();
    hasAudio = true;
    mix();
    SFX.startBeatLoop(() => 60000 / interval / 4);
    SFX.setMusicFocus(focused);
    SFX.bgmStart();
    SFX.setBeatSync(() => Math.max(0, nextTick - performance.now()));
    nextTick = performance.now();
    clearInterval(timer);
    timer = setInterval(pump, 25);
    pump();
}
function stopMusic() { clearInterval(timer); timer = null; if (!hasAudio)
    return; SFX.stopBeatLoop(); SFX.setMusicFocus(false); SFX.bgmStop(); }
function release() { controls?.cancel(); }
function refreshStill() { const { state } = host.read(); if (state.screen !== 'menu')
    host.draw(); }
export const Remix = {
    start() { stopMusic(); tick = 0; running = true; focused = false; release(); Art.reset(); startMusic(); sound('sfxClick'); },
    stop() { running = false; focused = false; stopMusic(); release(); document.getElementById('movement-hint').hidden = true; },
    sound,
    focus(value) { focused = value; SFX.setMusicFocus(enabled && value); controls?.suspend(); this.paintPointer(); },
    input() {
        controls?.input();
        this.paintPointer();
        if (reducedMotion && host)
            host.read().state.shake = 0;
    },
    paintPointer() { const hint = document.getElementById('movement-hint'); if (hint && controls) {
        hint.textContent = controls.hint();
        hint.hidden = !hint.textContent;
    } },
    pointer() { return controls?.inspect(); },
    bind(value) {
        host = value;
        controls = new TrialControls(host.read);
        controls.bind(host.read().canvas);
        const start = document.getElementById('start-btn');
        start.disabled = false;
        start.textContent = '开始旅程';
        document.getElementById('art-toggle').onclick = e => {
            Art.enabled = !Art.enabled;
            e.currentTarget.textContent = Art.enabled ? '美术：融合' : '美术：原版';
            e.currentTarget.setAttribute('aria-pressed', String(Art.enabled));
            refreshStill();
        };
        document.getElementById('scene').onchange = e => { Art.scene = e.target.value; refreshStill(); };
        document.getElementById('sound-toggle').onclick = e => {
            enabled = !enabled;
            if (enabled) {
                if (SFX.isMuted())
                    SFX.toggleMute();
                if (running)
                    startMusic();
                sound('sfxClick');
            }
            else {
                stopMusic();
                if (!SFX.isMuted())
                    SFX.toggleMute();
            }
            e.currentTarget.textContent = enabled ? '声音：开启' : '声音：关闭';
            e.currentTarget.setAttribute('aria-pressed', String(enabled));
        };
        document.getElementById('volume').oninput = e => { volume = Number(e.target.value) / 100; mix(); };
        document.addEventListener('keydown', e => {
            const tag = e.target.tagName;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag))
                return;
            const key = e.key.toLowerCase();
            if (controls.keyDown(key))
                e.preventDefault();
            if (key === 'escape' && !e.repeat) {
                host.togglePause();
                e.preventDefault();
            }
            if (/^[1-4]$/.test(key) && host.read().state.screen === 'levelup')
                document.querySelectorAll('#upgrade-options>[role=button]')[Number(key) - 1]?.click();
        });
        document.addEventListener('keyup', e => controls.keyUp(e.key.toLowerCase()));
        window.addEventListener('blur', release);
        document.addEventListener('visibilitychange', () => {
            release();
            if (document.hidden) {
                if (host.read().state.screen === 'playing')
                    host.togglePause();
                stopMusic();
            }
            else if (running && enabled)
                startMusic();
        });
        window.addEventListener('pagehide', () => { running = false; stopMusic(); });
        document.addEventListener('click', e => { if (e.target.closest('button') && !e.target.closest('#trial-bar'))
            document.activeElement?.blur(); });
    },
    inspect() { return { enabled, volume, running, pump: timer !== null, tick, focused, counts: { ...counts }, ...SFX.getMusicDebugState() }; }
};
