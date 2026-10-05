import { GlassLens, defaults } from '../lens';
import { IdleDrift } from './idle';
import { createShareURL, readSharedScene } from './share';
import { drawScene } from './scene';
import '@fontsource-variable/inter';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><a class="wordmark" href="./" aria-label="Glass Lens home"><span class="mark" aria-hidden="true"></span> Glass Lens</a><span class="header-note">An experiment in light & distortion</span></header>
<main>
<section class="stage" aria-label="Interactive glass lens experiment"><canvas id="lens" tabindex="0" role="img" aria-describedby="instructions"></canvas></section>
<div class="preview-action" hidden><a class="reset" id="create-yours" href="./">Create yours</a></div>
<p class="fallback" role="status" hidden></p>
<div class="stage-caption"><span id="instructions">Move to explore · Hold to melt · Arrow keys to move, Space or Enter to melt</span></div>
<section class="controls" aria-label="Lens controls">
<div class="playground-row"><div class="text-control"><label for="your-text">Your text</label><input id="your-text" type="text" value="Hello" autocomplete="off" spellcheck="false" aria-describedby="text-help"><p id="text-help">Type your name. Bend it with glass.</p></div>
<div class="presets"><span class="control-title">GLASS <output id="preset-status" aria-live="polite">Clear</output></span><div class="scene-buttons" role="group" aria-label="Glass presets"><button data-preset="Clear" aria-pressed="true">Clear</button><button data-preset="Prism" aria-pressed="false">Prism</button><button data-preset="Liquid" aria-pressed="false">Liquid</button></div></div>
<div class="actions"><button id="share" class="reset">Generate link</button><button id="reset" class="reset">Reset</button><span id="share-status" role="status"></span></div></div>
<div id="share-panel" hidden><label for="share-link">Your shareable link</label><div class="share-link-row"><input id="share-link" type="url" readonly><button id="copy-link" aria-label="Copy link" title="Copy link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></button></div><p id="share-note"></p></div>
<div class="slider-row">
<label class="slider-control" for="size"><span>Lens size <output id="size-value"></output></span><input id="size" type="range" min="80" max="400" step="1" value="220"></label><label class="slider-control" for="strength"><span>Refraction <output id="strength-value"></output></span><input id="strength" type="range" min="0" max="2.5" step="0.05" value="1.15"></label><label class="slider-control" for="aberration"><span>Chromatic aberration <output id="aberration-value"></output></span><input id="aberration" type="range" min="0" max="3" step="0.05" value="1.2"></label></div>
<div class="motion-control"><button id="drift" aria-pressed="true">Auto movement: on</button><span>Gently wanders when you pause.</span></div></section></main><footer><span>A little curiosity. A different perspective.</span></footer>`;
const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const canvas = $<HTMLCanvasElement>('#lens');
const stage = $('.stage');
const textInput = $<HTMLInputElement>('#your-text');
let lens: GlassLens;
try { lens = new GlassLens(canvas); }
catch (error) {
    $('.fallback').hidden = false; $('.fallback').textContent = String(error);
    canvas.hidden = true;
    document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.controls input,.controls button').forEach(el => el.disabled = true);
    throw error;
}
const initialSize = Math.max(80, Math.min(defaults.size, Math.round(stage.clientWidth * .3)));
const presets = {
    Clear: { strength: 1.15, aberration: 1.2, softness: .65, size: initialSize },
    Prism: { strength: 1.35, aberration: 2.6, softness: .85, size: Math.round(initialSize * 1.08) },
    Liquid: { strength: 1.75, aberration: .8, softness: 1.45, size: Math.round(initialSize * 1.15) }
};
let softness = .65;
const shared = readSharedScene();
function selectPreset(name: keyof typeof presets) {
    const preset = presets[name]; lens.setOptions(preset); lens.setSoftness(preset.softness); softness = preset.softness;
    showPreset(name); updateControls();
}
function showPreset(name: string) {
    $('#preset-status').textContent = name;
    document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === name)));
}
let width = 0, height = 0;
function redraw(resetPosition = false) {
    const rect = stage.getBoundingClientRect();
    if (width !== rect.width || height !== rect.height) {
        width = rect.width; height = rect.height; lens.resize(width, height);
    }
    lens.setScene(drawScene(width, height, Math.min(devicePixelRatio || 1, 2), textInput.value));
    canvas.setAttribute('aria-label', `${textInput.value.trim() || 'Empty canvas'}. Movable glass lens.`);
    if (resetPosition) lens.moveTo(width * (shared?.x ?? .495), height * (shared?.y ?? .48), true);
}
const drift = new IdleDrift(lens, () => ({width,height}));
const observer = new ResizeObserver(() => { redraw(true); drift.activity(); }); observer.observe(stage);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const updateMotion = () => { lens.setReducedMotion(motion.matches); drift.setReducedMotion(motion.matches); };
motion.addEventListener('change', updateMotion); updateMotion();

// A short stationary touch is a tap; movement beyond 9px is a drag.
// Only a stationary 220ms hold triggers touch melting, so dragging stays precise.
let activePointer: number | null = null;
let startX = 0, startY = 0, dragging = false;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let pointerPressed = false;
const pressedKeys = new Set<string>();
function syncPress() { lens.setPressed(pointerPressed || pressedKeys.size > 0); drift.setHolding(activePointer !== null || pressedKeys.size > 0); }
function pointer(event: PointerEvent) {
    drift.activity();
    const rect = canvas.getBoundingClientRect();
    lens.moveTo(event.clientX - rect.left, event.clientY - rect.top, event.pointerType === 'touch');
}
function releasePointer() {
    clearTimeout(holdTimer); activePointer = null; pointerPressed = false; syncPress();
}
canvas.addEventListener('pointerdown', event => {
    if (shared) return;
    if (activePointer !== null || !event.isPrimary || event.button !== 0) return;
    activePointer = event.pointerId; startX = event.clientX; startY = event.clientY; dragging = false;
    canvas.setPointerCapture(event.pointerId); pointer(event); syncPress();
    if (event.pointerType === 'touch') holdTimer = setTimeout(() => { pointerPressed = true; syncPress(); }, 220);
    else { pointerPressed = true; syncPress(); }
});
canvas.addEventListener('pointermove', event => {
    if (shared) return;
    if (activePointer === event.pointerId) {
        if (event.pointerType === 'touch' && Math.hypot(event.clientX - startX, event.clientY - startY) > 9) {
            dragging = true; clearTimeout(holdTimer); pointerPressed = false; syncPress();
        }
        if (event.pointerType !== 'touch' || dragging) pointer(event);
    } else if (activePointer === null && event.pointerType === 'mouse') pointer(event);
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    canvas.addEventListener(eventName, event => {
        if (event.pointerId !== activePointer) return;
        releasePointer();
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
}
canvas.addEventListener('keydown', event => {
    if (shared) return;
    drift.activity();
    if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault(); pressedKeys.add(event.key); syncPress(); return;
    }
    const step = event.shiftKey ? 40 : 15;
    const movement: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (movement[event.key]) {
        event.preventDefault(); const p = lens.getPosition(), [x, y] = movement[event.key]; lens.moveTo(p.x + x, p.y + y);
    }
});
canvas.addEventListener('keyup', event => {
    if (pressedKeys.delete(event.key)) { event.preventDefault(); syncPress(); }
});
function cancelPress() { pressedKeys.clear(); releasePointer(); }
canvas.addEventListener('blur', cancelPress);
window.addEventListener('blur', cancelPress);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPress(); drift.setHidden(document.hidden); });

for (const name of ['size', 'strength', 'aberration'] as const) {
    $<HTMLInputElement>(`#${name}`).addEventListener('input', event => {
        lens.setOptions({ [name]: Number((event.target as HTMLInputElement).value) }); showPreset('Custom'); updateControls();
    });
}
function updateControls() {
    const values = lens.getOptions();
    for (const name of ['size', 'strength', 'aberration'] as const) {
        const input = $<HTMLInputElement>(`#${name}`);
        input.value = String(values[name]);
        input.style.setProperty('--fill', `${(values[name] - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
        $<HTMLOutputElement>(`#${name}-value`).value = name === 'size' ? `${values[name]} px` : values[name].toFixed(2);
    }
}
textInput.addEventListener('input', () => redraw());
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.addEventListener('click', () => selectPreset(button.dataset.preset as keyof typeof presets)));
$('#reset').addEventListener('click', () => {
    cancelPress(); textInput.value = 'Hello'; selectPreset('Clear'); redraw(true); $('#share-status').textContent = ''; $('#share-panel').hidden = true; lens.moveTo(width*.495,height*.48,true); drift.activity();
});
$('#share').addEventListener('click', async () => {
    drift.activity();
    const position = lens.getPosition();
    const url = createShareURL({text:textInput.value, ...lens.getOptions(), softness,
        preset:$('#preset-status').textContent || 'Custom', x:position.x/width, y:position.y/height, drift:drift.getEnabled()});
    $('#share-panel').hidden = false;
    $<HTMLInputElement>('#share-link').value = url;
    const local = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    $('#share-note').textContent = local ? 'Local preview link. Publish the app to share with other people.' : 'Anyone with this link can open your text and glass settings.';
    $('#share-status').textContent = 'Link ready.';
    $('#copy-link').setAttribute('aria-label','Copy link');
    $('#copy-link').setAttribute('title','Copy link');
});
$('#copy-link').addEventListener('click', async () => {
    const input = $<HTMLInputElement>('#share-link');
    try {
        await navigator.clipboard.writeText(input.value);
        $('#share-status').textContent = 'Link copied.';
        $('#copy-link').setAttribute('aria-label', 'Copy link — copied');
        $('#copy-link').setAttribute('title', 'Copied!');
    } catch {
        input.focus(); input.select();
        $('#share-status').textContent = 'Select and copy the link manually.';
    }
});
$('#drift').addEventListener('click' , () => {
    drift.setEnabled(!drift.getEnabled()); updateDriftControl();
});
function updateDriftControl() {
    $('#drift').setAttribute('aria-pressed',String(drift.getEnabled()));
    $('#drift').textContent = `Auto movement: ${drift.getEnabled() ? 'on' : 'off'}`;
}
// Editing controls counts as activity; hold off wandering until editing finishes.
$('.controls').addEventListener('input', () => drift.activity());
$('.controls').addEventListener('pointerdown', () => drift.activity());
$('.controls').addEventListener('keydown', () => drift.activity());
textInput.addEventListener('focus', () => drift.setHolding(true));
textInput.addEventListener('blur', () => drift.setHolding(false));
selectPreset('Clear');
if (shared) {
    document.body.classList.add('preview');
    $('.controls').hidden = true;
    $('.preview-action').hidden = false;
    $('.stage-caption').hidden = true;
    canvas.removeAttribute('tabindex');
    canvas.removeAttribute('aria-describedby');
    const createURL = new URL(location.href); createURL.hash = '';
    $<HTMLAnchorElement>('#create-yours').href = createURL.href;
    textInput.value = shared.text; lens.setOptions(shared); lens.setSoftness(shared.softness); softness = shared.softness;
    const named = shared.preset as keyof typeof presets;
    const preset = presets[named];
    const matches = preset && preset.strength === shared.strength && preset.aberration === shared.aberration && preset.softness === shared.softness;
    showPreset(matches ? named : 'Custom'); updateControls(); drift.setEnabled(shared.drift); updateDriftControl();
}
redraw(true);
// Refresh the texture after the bundled font (including newly needed glyph subsets) loads.
const refreshFont = () => {
    void document.fonts.load('500 100px "Inter Variable"', textInput.value || 'Hello').then(() => redraw());
};
refreshFont();
textInput.addEventListener('input', refreshFont);
canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); cancelPress(); drift.dispose(); $('.fallback').hidden = false;
    $('.fallback').textContent = 'The graphics context was interrupted. Reload to resume.';
});
window.addEventListener('pagehide', event => {
    cancelPress();
    if (!event.persisted) { drift.dispose(); observer.disconnect(); motion.removeEventListener('change', updateMotion); lens.dispose(); }
});
