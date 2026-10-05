/** Fit the full string, including accented glyph bounds, within a quiet margin. */
export function textLayout(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
    ctx.font = '500 100px "Inter Variable", sans-serif';
    const measured = ctx.measureText(text);
    const inkWidth = Math.max(measured.width, measured.actualBoundingBoxLeft + measured.actualBoundingBoxRight, 1);
    const inkHeight = Math.max(measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent, 1);
    const size = Math.min(width * .88 / inkWidth, height * .60 / inkHeight, height * .007) * 100;
    ctx.font = `500 ${size}px "Inter Variable", sans-serif`;
    const final = ctx.measureText(text);
    return { x: (width - final.actualBoundingBoxRight + final.actualBoundingBoxLeft) / 2,
        y: height / 2 + (final.actualBoundingBoxAscent - final.actualBoundingBoxDescent) / 2, size };
}
export function drawScene(width: number, height: number, dpr: number, text = 'Hello') {
    const scene = document.createElement('canvas');
    scene.width = Math.round(width * dpr); scene.height = Math.round(height * dpr);
    const ctx = scene.getContext('2d')!;
    ctx.scale(dpr, dpr); ctx.fillStyle = '#dadada'; ctx.fillRect(0, 0, width, height);
    // Empty/whitespace input intentionally leaves a blank optical scene.
    if (text.trim()) {
        const layout = textLayout(ctx, text, width, height);
        ctx.fillStyle = '#050505'; ctx.fillText(text, layout.x, layout.y);
    }
    return scene;
}
