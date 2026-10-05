# Glass Lens

A small, standalone experiment in light and distortion. A real WebGL lens magnifies and bends a controlled scene, with warm edge reflections and adjustable chromatic dispersion. TypeScript and Vite, with bundled Inter variable fonts.

## Run

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the URL printed by Vite (usually http://127.0.0.1:5188).

```sh
npm run build       # Type check, production demo and reusable ES module
npx playwright install chromium
npm test            # Browser rendering and interaction checks
npm run check       # Build + browser checks
```

Serve `dist/` with any static web host. `dist-library/glass-lens.js` is the independent renderer bundle. The TypeScript source is in `src/lens/`; copy that folder into another TypeScript project for typed integration. No API keys, CDN assets, or external services are needed.

## Try it

Enter a name in **Your text**. The text and its refracted texture update live. Spaces and accented characters are supported; the complete string is automatically fitted and centred on desktop and mobile. Empty or whitespace-only input leaves a blank scene.

Move the pointer to explore, or hold the primary mouse/pen button to melt the lens. On touch screens, a tap places the lens, a stationary **220ms hold** melts it, and moving more than **9 CSS pixels** becomes a drag. Dragging cancels the melt so positioning remains precise. Scroll using the controls or page margins; only the canvas captures touch gestures.

Tab to the canvas and use arrow keys (Shift for larger steps). Hold **Space or Enter** to melt and release to return to a circle. A damped spring keeps the return restrained. Losing focus or cancelling a pointer releases the effect. Reduced-motion preferences apply both position and deformation immediately, with no follow animation or spring oscillation.

Choose **Clear** for the original restrained optics, **Prism** for stronger spectral edges, or **Liquid** for stronger refraction and a softer press deformation. Presets set size, strength, aberration and deformation amplitude. All presets rest as circles. Adjusting any slider marks the selection **Custom**; editing text preserves the optical preset. Reset restores Hello, the typography scene, Clear settings and the initial lens position.

**Generate link** creates a URL containing your text, optical settings, lens position and auto-movement preference. Use the copy icon beside the generated URL to copy it. A confirmation appears when copied; if clipboard access is unavailable, the link is selected for manual copying. Opening it shows a preview-only composition with a **Create yours** button leading to a fresh editor. Shared previews have no editing controls or pointer manipulation; automatic movement still follows the saved preference. The old PNG download is removed.

The lens begins wandering after 2.5 seconds of inactivity, gliding to randomly selected points over 4–7 seconds with gently eased starts and turns. Pointer, touch and keyboard input take priority. Holding the lens or editing text pauses wandering. Use **Auto movement** to switch it off. Reduced-motion preferences and hidden tabs disable automatic movement.

Share links use the current website address. Localhost links work only on your computer; deploy `dist/` to a public static host before sharing with others. Links use a compact binary payload instead of verbose JSON (typically about 50–90 characters for short names including the site address). Lens position is rounded to 1/255 of each stage dimension. Older JSON links remain supported. Settings live in the URL fragment (not sent to the server), are visible to anyone with the link, and are validated on load. Very long text makes long URLs that some messaging apps may truncate. Links restore the composition, not a frozen animation frame; the random path will differ each visit.

## Reuse the renderer

```ts
import { GlassLens } from './src/lens';

const canvas = document.querySelector<HTMLCanvasElement>('#glass')!;
const lens = new GlassLens(canvas);
const source = document.createElement('canvas');
source.width = 1000;
source.height = 700;
const ctx = source.getContext('2d')!;
ctx.fillStyle = '#dadada';
ctx.fillRect(0, 0, 1000, 700);
ctx.fillStyle = '#050505';
ctx.font = '240px sans-serif';
ctx.fillText('Hello', 150, 430);

lens.resize(1000, 700); // CSS dimensions, optional device pixel ratio
lens.setScene(source); // canvas, loaded image, video, or other TexImageSource
lens.setOptions({ size: 220, strength: 1.15, aberration: 1.2 });
lens.moveTo(500, 350, true);
lens.setReducedMotion(matchMedia('(prefers-reduced-motion: reduce)').matches);

// Map pointer coordinates into canvas-local CSS pixels.
canvas.addEventListener('pointermove', event => {
  const rect = canvas.getBoundingClientRect();
  lens.moveTo(event.clientX - rect.left, event.clientY - rect.top);
});
// Call lens.dispose() when unmounting.
```

Set the canvas CSS width/height to the dimensions supplied to `resize`. The demo shows ResizeObserver, touch pointer capture, live reduced-motion preference updates, keyboard movement, and disposal. Refresh the scene texture after drawing or loading new content. A video must be uploaded again for each desired frame. Source textures map to the full canvas; use matching aspect ratios to avoid stretching.

| Method | Purpose |
| --- | --- |
| `resize(width, height, dpr?)` | Set viewport; DPR is capped at 2 and GPU limits |
| `setScene(source)` | Upload the complete scene texture |
| `setOptions(partial)` | Size 80–500 CSS px, strength 0–2.5, aberration 0–3 |
| `moveTo(x, y, immediate?)` | Move in CSS pixels, top-left origin |
| `setReducedMotion(boolean)` | Disable smoothing |
| `setPressed(boolean)` | Animate into/out of the liquid shape |
| `setSoftness(value)` | Deformation amplitude, clamped to 0.3–1.5 |
| `getOptions()` / `getPosition()` | Read copies of current state |
| `dispose()` | Cancel animation and release GPU objects |

## How it works

A 2D canvas redraws the controlled scene when text or dimensions change. All visible stage content lives in this texture; captions and controls sit outside the optical stage. WebGL renders a full-screen triangle pair and samples that texture. Inside the circle, a sphere-shaped radial mapping magnifies the center and curves the shoulder. Slightly different sample positions for red, green, and blue create real content-dependent chromatic fringes. Directional amber/blue Fresnel-inspired edge shading supplies the glass silhouette. This is an artistic thin-lens approximation, not a physically accurate optical simulation.

During a press, a smooth polar boundary deforms the lens. Texture mapping, edge shading and surface normals use the same boundary, and refraction increases slightly. The engine owns GPU rendering, motion. The demo owns source composition, layout, accessibility, input events, and controls.

## Limitations

- **WebGL cannot directly sample arbitrary HTML.** DOM text, forms, iframes, and other elements behind this canvas are not automatically refracted. Recreate controlled content in a canvas or supply an image/video texture. DOM screenshot libraries are optional integrations, with CSS fidelity, timing, CORS, and performance limitations.
- Text stays on a single line and scales down to fit; extremely long strings can become too small to read, although they are not truncated. Inter is bundled locally under its SIL Open Font License; unsupported glyphs use system fallbacks.
- Canvas text is rasterized. The demo supplies an accessible canvas description and keyboard controls; applications should provide meaningful semantic text outside the texture for complex content.
- Remote images/videos need suitable CORS headers and `crossOrigin` set before loading. A tainted canvas cannot be uploaded as a texture.
- GPU texture limits apply. Avoid very large sources. DPR is capped to contain GPU memory use; source texture sizes should be bounded separately by the integrator.
- One lens per renderer. No backdrop capture, multiple interacting lenses, physically accurate caustics, or arbitrary DOM hit-testing.
- WebGL must be available. The demo presents an explanatory fallback if initialization fails; context loss asks for a reload.
- The demo handles resize by rebuilding the scene and recentering the lens. Settings persist when opened from a generated share link.

## Checks and visual reference

Playwright exercises actual WebGL output: pointer movement, all three controls, deterministic reset, keyboard operation, reduced motion, mobile touch dragging, and mobile overflow. Additional checks cover live text, accented/long/empty strings, preset state, press/release and blur cleanup, touch hold/drag/cancellation, page scrolling outside the canvas, share-link restoration and automatic movement. Screenshots are written to `docs/` at desktop, mobile, and the supplied reference's 1080 × 1350 portrait dimensions. These are inspection artifacts, not cross-platform golden-image tests; font rasterization differs by OS.

The supplied reference guides the pale grey field, broad black Hello, one circular lens, amber highlights and blue edges. The surrounding header, control strip and footer are intentional additions to make this a usable demo.

## License

[MIT](LICENSE). Contributions welcome; keep rendering changes independent of the demo, and run `npm run check` before submitting a patch.
