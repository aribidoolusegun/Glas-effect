# Verification

Verified on 5 October 2026 using Chromium/Playwright with WebGL enabled. The in-app browser was unavailable, so Playwright supplied rendering and interaction verification. Screenshots were opened for visual inspection, not just generated.

## Automated checks

- TypeScript strict compilation and production demo/library builds: pass.
- Desktop GPU output changes with pointer movement and each optical control: pass.
- Complete deterministic reset: pass.
- Keyboard lens movement and native keyboard slider adjustment: pass.
- Reduced-motion output settles immediately with no follow animation: pass.
- Mobile touch start/move/end changes the rendered result: pass.
- Mobile document has no horizontal overflow: pass.
- No page errors on the primary desktop workflow: pass.

## Reference comparison

The visual source was the user-supplied 1080 × 1350 reference attached to the task. It is not redistributed in this repository. Compared it with `portrait.png` at matching viewport dimensions, plus `desktop.png` (1440 × 1000) and `mobile.png` (390 CSS pixels wide, 2× DPR).

| Point | Reference / render comparison | Outcome |
| --- | --- | --- |
| Background | Pale neutral grey across the scene | Implemented #dadada |
| Typography | Oversized, black, broad Hello with generous negative space | Increased text width during review; proportional at desktop and mobile |
| Lens geometry | One circular lens over the central letters | 220px desktop; mobile initial size scales to 30% of scene width |
| Refraction | Curved and enlarged black letterforms within the lens | Actual texture sampling, validated by changed GPU output |
| Optical color | Warm amber and cool blue at glass/content edges | Softened overly sharp initial RGB fringes; added content-dependent amber transmission |
| Composition | Minimal canvas without competing imagery | Text-only playground |
| Responsive layout | Reference supplied only in portrait | Controls reflow to two columns, touch interaction verified |

Intentional differences: functional header, controls, instructions and footer; original project branding replaces the reference's footer marks. The lens is an artistic approximation with crisper boundaries than the reference's photographic blur. The supplied reference guides the art direction rather than a pixel-identical image copy. No generated bitmap is used to fake the effect.

Visible copy was checked: the reference's main “Hello” is retained; all additional copy belongs to the demo's branding, scene selection, instructions, required controls or license footer. No unrelated marketing sections were added.

## Personalised playground update

The existing renderer now supports a spring-driven polar lens boundary and PNG encoding. The scene composer measures glyph bounds for user text, including accents, and fits the complete string with margins. The text composer uploads all visible artwork to the same texture; stage captions were moved outside the canvas.

The expanded nine-test browser suite covers live editing, empty/whitespace input, long accented names at desktop/mobile dimensions, presets and Custom state, mouse and keyboard melting, release and blur cleanup, immediate reduced-motion behavior, touch hold/drag/cancel distinctions, scrolling outside the scene, and PNG export. Export verification decodes the downloaded PNG and compares it with the optical canvas, excluding the controls by construction.

Visual inspection of the updated desktop/mobile screenshots confirmed that the labelled text input is discoverable above the sliders, the stage remains dominant, controls reflow without horizontal overflow, and the grey/black palette and amber/blue lens highlights are preserved. `liquid.png` shows the held shape. The original captions now sit below the stage rather than appearing as unrefracted overlays.

The optional Image scene and its SVG asset have been removed. The playground is text-only; PNG export remains available.

## Sharing and automatic movement

PNG saving has been removed from the demo and renderer API. Generate link now produces a versioned, validated URL fragment containing text, lens settings, normalized position, and motion preference. A selectable URL is always shown; clipboard copying has a manual fallback. Local preview links are identified as local-only.

Automatic movement uses random destinations and 4–7 second eased glides after a 2.5 second inactivity delay. Input interrupts the movement, and holding, editing text, reduced motion, and document visibility are respected. A persistent on-screen toggle can disable wandering. Tests cover share restoration with accented text and custom settings, malformed links, automatic movement, editing pauses, and reduced motion, alongside the existing interaction checks.

Shared links now use compact URL-safe binary settings plus UTF-8 text, with old links still supported. The accented-name test URL is under 100 characters. Shared views hide the editor and disable manual lens manipulation while preserving the saved automatic-motion preference. The browser test verifies the preview, then follows Create yours to a fresh editable Hello scene. Visual evidence: `shared-preview.png`.
