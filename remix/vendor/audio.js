import { createBgmSystem } from './bgm.js';
let audioCtx = null;
let masterGain = null;
let weaponGain = null;
let hitGain = null;
let sfxVolume = 0.7;
let weaponVolume = 0.8;
let hitVolume = 0.7;
let _muted = false;
let _activeSounds = 0;
const MAX_ACTIVE_SOUNDS = 20;
function ensureCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = sfxVolume;
        masterGain.connect(audioCtx.destination);
        weaponGain = audioCtx.createGain();
        weaponGain.gain.value = weaponVolume;
        weaponGain.connect(audioCtx.destination);
        hitGain = audioCtx.createGain();
        hitGain.gain.value = hitVolume;
        hitGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended')
        audioCtx.resume();
    return audioCtx;
}
function now() { return ensureCtx().currentTime; }
function playTone(freq, duration, type = 'sine', volume = 0.3, detune = 0, targetGain = null) {
    if (_muted)
        return;
    if (_activeSounds >= MAX_ACTIVE_SOUNDS)
        return;
    const ctx = ensureCtx();
    const t = now();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (detune)
        osc.detune.value = detune;
    const mixMult = _activeSounds > 5 ? Math.max(0.3, 1 - (_activeSounds - 5) * 0.07) : 1;
    gain.gain.setValueAtTime(volume * mixMult, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(targetGain || masterGain);
    osc.start(t);
    osc.stop(t + duration);
    _activeSounds++;
    osc.onended = () => { _activeSounds = Math.max(0, _activeSounds - 1); };
}
function playNoise(duration, volume = 0.15, filterFreq = 4000, filterType = 'lowpass', targetGain = null) {
    if (_muted)
        return;
    if (_activeSounds >= MAX_ACTIVE_SOUNDS)
        return;
    const ctx = ensureCtx();
    const t = now();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++)
        data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    const mixMult = _activeSounds > 5 ? Math.max(0.3, 1 - (_activeSounds - 5) * 0.07) : 1;
    gain.gain.setValueAtTime(volume * mixMult, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(targetGain || masterGain);
    src.start(t);
    _activeSounds++;
    src.onended = () => { _activeSounds = Math.max(0, _activeSounds - 1); };
}
function playSweep(startFreq, endFreq, duration, type = 'sine', volume = 0.3, targetGain = null) {
    if (_muted)
        return;
    if (_activeSounds >= MAX_ACTIVE_SOUNDS)
        return;
    const ctx = ensureCtx();
    const t = now();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    const mixMult = _activeSounds > 5 ? Math.max(0.3, 1 - (_activeSounds - 5) * 0.07) : 1;
    gain.gain.setValueAtTime(volume * mixMult, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(targetGain || masterGain);
    osc.start(t);
    osc.stop(t + duration);
    _activeSounds++;
    osc.onended = () => { _activeSounds = Math.max(0, _activeSounds - 1); };
}
const _throttleMap = {};
function throttled(key, cooldownMs = 50) {
    const n = performance.now();
    if (_throttleMap[key] && n - _throttleMap[key] < cooldownMs)
        return false;
    _throttleMap[key] = n;
    return true;
}
let _beatGetMsToNextTick = null;
let _hitQueue = [];
let _hitQueueTimer = null;
const HIT_QUEUE_MAX = 4;
export function setBeatSync(getMsToNextTick) {
    _beatGetMsToNextTick = getMsToNextTick;
}
function queueHitSound(sfxFn) {
    if (_muted)
        return;
    if (_hitQueue.length >= HIT_QUEUE_MAX)
        return;
    _hitQueue.push(sfxFn);
    if (!_hitQueueTimer) {
        const delayMs = _beatGetMsToNextTick ? _beatGetMsToNextTick() : 0;
        _hitQueueTimer = setTimeout(flushHitQueue, Math.max(5, delayMs));
    }
}
function flushHitQueue() {
    _hitQueueTimer = null;
    const queue = _hitQueue.splice(0);
    const played = new Set();
    for (const fn of queue) {
        const key = fn.name || 'anon';
        if (!played.has(key)) {
            played.add(key);
            fn();
        }
    }
}
const PENTATONIC = [
    262, 294, 330, 392, 440,
    523, 587, 659, 784, 880,
];
let _scaleIndex = 0;
let _musicTransportTick = 0;
let _musicFocusActive = false;
let _musicFocusOriginTick = 0;
let _recentWeaponVoices = [];
let _focusWeaponPattern = [];
const MUSIC_PATTERN_TICKS = 16;
function nextScaleNote() {
    const note = PENTATONIC[_scaleIndex % PENTATONIC.length];
    _scaleIndex++;
    return note;
}
function recordWeaponVoice(voiceId) {
    if (_musicFocusActive)
        return;
    const eventKey = `${_musicTransportTick}:${voiceId}`;
    if (_recentWeaponVoices.some((event) => event.key === eventKey))
        return;
    _recentWeaponVoices.push({ key: eventKey, tick: _musicTransportTick, voiceId });
    const oldestTick = _musicTransportTick - MUSIC_PATTERN_TICKS * 2;
    _recentWeaponVoices = _recentWeaponVoices.filter((event) => event.tick >= oldestTick);
}
export function sfxShoot() {
    recordWeaponVoice('shoot');
    if (!throttled('shoot', 80))
        return;
    const note = nextScaleNote();
    playTone(note, 0.1, 'sine', 0.13, 0, weaponGain);
    playTone(note * 2, 0.06, 'sine', 0.04, 0, weaponGain);
}
export function sfxLaser() {
    recordWeaponVoice('laser');
    if (!throttled('laser', 100))
        return;
    playSweep(1200, 600, 0.12, 'sawtooth', 0.1, weaponGain);
}
export function sfxBomb() {
    recordWeaponVoice('bomb');
    if (!throttled('bomb', 150))
        return;
    playSweep(200, 80, 0.2, 'sine', 0.15, weaponGain);
    playSweep(150, 60, 0.18, 'triangle', 0.06, weaponGain);
}
function _playHit() {
    if (!throttled('hit', 30))
        return;
    const note = nextScaleNote();
    playTone(note, 0.03, 'sine', 0.04, 0, hitGain);
}
function _playKill() {
    if (!throttled('kill', 30))
        return;
    const note = nextScaleNote();
    playSweep(note, note * 0.6, 0.06, 'triangle', 0.06, hitGain);
    playNoise(0.03, 0.03, 3000, 'lowpass', hitGain);
}
export function sfxHit() {
    queueHitSound(_playHit);
}
export function sfxKill() {
    queueHitSound(_playKill);
}
function _playEliteKill() {
    const note = nextScaleNote();
    playSweep(note * 1.2, note * 0.5, 0.12, 'triangle', 0.12, hitGain);
    playNoise(0.08, 0.06, 3000, 'lowpass', hitGain);
    playTone(note, 0.1, 'sine', 0.08, 0, hitGain);
}
export function sfxEliteKill() {
    queueHitSound(_playEliteKill);
}
export function sfxBossKill() {
    playNoise(0.4, 0.2, 2000, 'lowpass', hitGain);
    playSweep(400, 80, 0.3, 'sawtooth', 0.15, hitGain);
    setTimeout(() => {
        playTone(600, 0.2, 'sine', 0.15, 0, hitGain);
        playTone(800, 0.2, 'sine', 0.1, 0, hitGain);
    }, 100);
    setTimeout(() => {
        playTone(1000, 0.3, 'sine', 0.12, 0, hitGain);
        playTone(1200, 0.25, 'triangle', 0.08, 0, hitGain);
    }, 250);
}
function _playExplode() {
    if (!throttled('explode', 60))
        return;
    playNoise(0.15, 0.12, 1500, 'lowpass', hitGain);
    playSweep(300, 60, 0.12, 'sine', 0.1, hitGain);
}
export function sfxExplode() {
    queueHitSound(_playExplode);
}
export function sfxPlayerHit() {
    if (!throttled('phit', 200))
        return;
    playSweep(400, 150, 0.1, 'sawtooth', 0.2);
    playNoise(0.08, 0.1, 2000);
    playTone(100, 0.12, 'sine', 0.15);
}
export function sfxPickupXp() {
    if (!throttled('xp', 25))
        return;
    playTone(800 + Math.random() * 400, 0.04, 'sine', 0.06);
}
export function sfxPickupHeart() {
    playTone(600, 0.08, 'sine', 0.12);
    setTimeout(() => playTone(800, 0.1, 'sine', 0.12), 60);
}
export function sfxPickupMagnet() {
    playSweep(400, 1200, 0.15, 'sine', 0.1);
}
export function sfxLevelUp() {
    if (!throttled('levelup', 300))
        return;
    const ctx = ensureCtx();
    const t = now();
    [523, 659, 784, 1047].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.12, t + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.15);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.07);
        osc.stop(t + i * 0.07 + 0.15);
    });
}
export function sfxEvolution() {
    if (!throttled('evolution', 500))
        return;
    const ctx = ensureCtx();
    const t = now();
    [400, 500, 600, 800, 1000, 1200].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i < 3 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.1, t + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.25);
    });
    playNoise(0.3, 0.05, 6000, 'highpass');
}
export function sfxClick() {
    playTone(600, 0.04, 'sine', 0.08);
}
export function sfxGameOver() {
    const ctx = ensureCtx();
    const t = now();
    [400, 350, 300, 200].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.08, t + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.3);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.2);
        osc.stop(t + i * 0.2 + 0.3);
    });
}
export function sfxBossWarning() {
    const ctx = ensureCtx();
    const t = now();
    for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 120;
        gain.gain.setValueAtTime(0.12, t + i * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.15);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.25);
        osc.stop(t + i * 0.25 + 0.15);
    }
}
let _bgmVolume = 0.35;
export function setVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    if (masterGain)
        masterGain.gain.value = _muted ? 0 : sfxVolume;
}
export function setWeaponVolume(v) {
    weaponVolume = Math.max(0, Math.min(1, v));
    if (weaponGain)
        weaponGain.gain.value = _muted ? 0 : weaponVolume;
}
export function setHitVolume(v) {
    hitVolume = Math.max(0, Math.min(1, v));
    if (hitGain)
        hitGain.gain.value = _muted ? 0 : hitVolume;
}
export function setBgmVolume(v) {
    _bgmVolume = Math.max(0, Math.min(1, v));
    if (_bgmSystem)
        _bgmSystem.setGain(_muted ? 0 : _bgmVolume);
}
export function toggleMute() {
    _muted = !_muted;
    if (masterGain)
        masterGain.gain.value = _muted ? 0 : sfxVolume;
    if (weaponGain)
        weaponGain.gain.value = _muted ? 0 : weaponVolume;
    if (hitGain)
        hitGain.gain.value = _muted ? 0 : hitVolume;
    if (_bgmSystem)
        _bgmSystem.setGain(_muted ? 0 : _bgmVolume);
    return _muted;
}
export function isMuted() { return _muted; }
export function initAudio() {
    ensureCtx();
}
let _bgmSystem = null;
function ensureBgm() {
    if (!_bgmSystem) {
        const ctx = ensureCtx();
        _bgmSystem = createBgmSystem(ctx, masterGain);
        _bgmSystem.setGain(_bgmVolume);
    }
    return _bgmSystem;
}
export function bgmStart() { ensureBgm().start(); }
export function bgmStop() { ensureBgm().stop(); }
export function bgmTick(tickIndex, getMsToNextTick, unused, isLowHp) { ensureBgm().tick(tickIndex, getMsToNextTick, isLowHp); }
let _beatLoopRunning = false;
let _menuBeatActive = false;
function playFrozenWeaponVoice(voiceId) { ({ shoot: sfxShoot, laser: sfxLaser, bomb: sfxBomb }[voiceId] || (() => { }))(); }
export function syncMusicTransportTick(tick) {
    if (Number.isFinite(tick))
        _musicTransportTick = Math.max(0, Math.floor(tick));
}
export function getMusicDebugState() {
    return {
        contextState: audioCtx?.state || 'not-created',
        muted: _muted,
        beatLoopRunning: _beatLoopRunning,
        focusActive: _musicFocusActive,
        transportTick: _musicTransportTick,
        focusPatternLength: _focusWeaponPattern.length,
        recentVoiceCount: _recentWeaponVoices.length,
    };
}
export function setMusicFocus(active) {
    const nextActive = Boolean(active);
    if (nextActive && !_musicFocusActive) {
        const patternStart = _musicTransportTick - (MUSIC_PATTERN_TICKS - 1);
        _focusWeaponPattern = _recentWeaponVoices
            .filter((event) => event.tick >= patternStart && event.tick <= _musicTransportTick)
            .map((event) => ({
            offset: event.tick - patternStart,
            voiceId: event.voiceId,
        }));
        _musicFocusOriginTick = _musicTransportTick + 1;
        if (_hitQueueTimer)
            clearTimeout(_hitQueueTimer);
        _hitQueueTimer = null;
        _hitQueue.length = 0;
    }
    else if (!nextActive) {
        _focusWeaponPattern = [];
    }
    _musicFocusActive = nextActive;
    _menuBeatActive = nextActive;
    if (masterGain) {
        const ctx = ensureCtx();
        const t = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(t);
        masterGain.gain.setValueAtTime(masterGain.gain.value, t);
        masterGain.gain.linearRampToValueAtTime(_muted ? 0 : sfxVolume, t + 0.08);
    }
    if (weaponGain) {
        const ctx = ensureCtx();
        const t = ctx.currentTime;
        weaponGain.gain.cancelScheduledValues(t);
        weaponGain.gain.setValueAtTime(weaponGain.gain.value, t);
        weaponGain.gain.linearRampToValueAtTime(_muted ? 0 : weaponVolume, t + 0.08);
    }
    if (hitGain) {
        const ctx = ensureCtx();
        const t = ctx.currentTime;
        hitGain.gain.cancelScheduledValues(t);
        hitGain.gain.setValueAtTime(hitGain.gain.value, t);
        hitGain.gain.linearRampToValueAtTime(_muted ? 0 : hitVolume * (nextActive ? 0.08 : 1), t + 0.08);
    }
}
export function playMusicFocusTick(tick) {
    if (!_musicFocusActive || !_beatLoopRunning || _focusWeaponPattern.length === 0)
        return;
    const offset = ((tick - _musicFocusOriginTick) % MUSIC_PATTERN_TICKS + MUSIC_PATTERN_TICKS) % MUSIC_PATTERN_TICKS;
    _focusWeaponPattern
        .filter((event) => event.offset === offset)
        .slice(0, 4)
        .forEach((event) => playFrozenWeaponVoice(event.voiceId));
}
export function sfxKick() {
    if (_muted)
        return;
    const ctx = ensureCtx();
    const t = now();
    const vol = 0.045;
    if (vol < 0.005)
        return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.06);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
}
export function sfxHihat() {
    if (_muted)
        return;
    const ctx = ensureCtx();
    const t = now();
    const vol = 0.025;
    if (vol < 0.005)
        return;
    const bufferSize = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++)
        data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(t);
}
export function startBeatLoop(getBPM) {
    _beatLoopRunning = true;
}
export function stopBeatLoop() {
    _beatLoopRunning = false;
    if (_hitQueueTimer) {
        clearTimeout(_hitQueueTimer);
        _hitQueueTimer = null;
    }
    _hitQueue.length = 0;
}
