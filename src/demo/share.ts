import type { LensOptions } from '../lens';
export interface SharedScene extends LensOptions {
    text: string;
    softness: number;
    preset: string;
    x: number;
    y: number;
    drift: boolean;
}
/** Compact, URL-safe UTF-8 payload: ten settings bytes followed by the text. */
export function createShareURL(state: SharedScene, base = location.href): string {
    const text = new TextEncoder().encode(state.text);
    const bytes = new Uint8Array(10 + text.length);
    const view = new DataView(bytes.buffer);
    bytes[0] = 2;
    view.setUint16(1, Math.round(state.size));
    bytes[3] = Math.round(state.strength * 20);
    bytes[4] = Math.round(state.aberration * 20);
    bytes[5] = Math.round(state.softness * 100);
    bytes[6] = Math.round(state.x * 255);
    bytes[7] = Math.round(state.y * 255);
    bytes[8] = ['Clear','Prism','Liquid','Custom'].indexOf(state.preset);
    bytes[9] = Number(state.drift);
    bytes.set(text, 10);
    const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = new URL(base); url.hash = 'g=' + encoded;
    return url.href;
}
export function readSharedScene(hash = location.hash): SharedScene | null {
    if ((!hash.startsWith('#glass=') && !hash.startsWith('#g=')) || hash.length > 100000) return null;
    try {
        let data;
        if (hash.startsWith('#g=')) {
            const raw = atob(hash.slice(3).replace(/-/g,'+').replace(/_/g,'/'));
            const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
            if (bytes.length < 10 || bytes[0] !== 2 || bytes[9] > 1) return null;
            data = {v:1, size:new DataView(bytes.buffer).getUint16(1), strength:bytes[3]/20,
                aberration:bytes[4]/20, softness:bytes[5]/100, x:bytes[6]/255, y:bytes[7]/255,
                preset:['Clear','Prism','Liquid','Custom'][bytes[8]], drift:Boolean(bytes[9]),
                text:new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(10))};
        } else {
            // Existing links remain readable.
            data = JSON.parse(decodeURIComponent(hash.slice(7)));
        }
        if (!data || data.v !== 1 || typeof data.text !== 'string' || data.text.length > 10000) return null;
        for (const [key, lo, hi] of [['size',80,400],['strength',0,2.5],['aberration',0,3],['softness',.3,1.5],['x',0,1],['y',0,1]] as const) {
            if (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] < lo || data[key] > hi) return null;
        }
        if (!['Clear','Prism','Liquid','Custom'].includes(data.preset) || typeof data.drift !== 'boolean') return null;
        return data as SharedScene;
    } catch { return null; }
}
