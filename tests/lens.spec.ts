import { test, expect, type Page } from '@playwright/test';
const pixels = (page: Page) => page.locator('canvas').evaluate(async (canvas: HTMLCanvasElement) => {
    const gl=canvas.getContext('webgl')!;
    const data=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    const digest=await crypto.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
});
const settle = (page: Page) => page.waitForTimeout(450);
test('renders real WebGL, responds to pointer, each control and reset', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/'); await page.locator('#drift').click();
    await settle(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const initial = await pixels(page);
    await page.mouse.move(550, 480);
    await settle(page);
    expect(await pixels(page)).not.toEqual(initial);
    for (const [id, value] of [['size', '300'], ['strength', '2'], ['aberration', '3']]) {
        const before = await pixels(page);
        await page.locator(`#${id}`).fill(value);
        await settle(page);
        expect(await pixels(page)).not.toEqual(before);
    }
    await page.getByRole('button', { name: 'Reset' }).click();
    await settle(page);
    await expect(page.locator('#size')).toHaveValue('220');
    await expect(page.locator('#strength')).toHaveValue('1.15');
    await expect(page.locator('#aberration')).toHaveValue('1.2');
    expect(await pixels(page)).toEqual(initial);
    await page.screenshot({ path: 'docs/desktop.png' });
    expect(errors).toEqual([]);
});
test('keyboard movement and reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/'); await page.locator('#drift').click();
    await settle(page);
    const before = await pixels(page);
    await page.locator('canvas').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
    expect(await pixels(page)).not.toEqual(before);
    // With reduced motion, the first rendered frame is already the final position.
    await page.mouse.move(700, 350);
    await page.waitForTimeout(60);
    const immediate = await pixels(page);
    await settle(page);
    expect(await pixels(page)).toEqual(immediate);
    await page.locator('#size').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#size')).toHaveValue('221');
});
test('mobile touch drag and responsive controls', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5188');
    await settle(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    const before = await pixels(page);
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 250 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 260, y: 330 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle(page);
    expect(await pixels(page)).not.toEqual(before);
    await page.getByRole('button', { name: 'Reset' }).click();
    await settle(page);
    await expect(page.locator('#size')).toBeVisible();
    await page.screenshot({ path: 'docs/mobile.png', fullPage: true });
    await context.close();
});
test('reference portrait proportions', async ({ page }) => { await page.setViewportSize({ width: 1080, height: 1350 }); await page.goto('/'); await page.locator('#drift').click(); await settle(page); await page.screenshot({ path: 'docs/portrait.png' }); });

test('personalised text, accents, empty input and long-name fitting', async ({page}) => {
    await page.goto('/'); await page.locator('#drift').click(); await settle(page);
    const initial = await pixels(page);
    const input = page.getByLabel('Your text', {exact:true});
    await input.fill('Élodie José'); await settle(page);
    expect(await pixels(page)).not.toEqual(initial);
    await expect(page.locator('canvas')).toHaveAttribute('aria-label', /Élodie José/);
    await input.fill(''); await settle(page);
    const blank = await pixels(page);
    await input.fill('   '); await settle(page); expect(await pixels(page)).toEqual(blank);
    // Measure actual source glyph bounds, including combining accents and a very long name.
    for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
        await page.setViewportSize(viewport);
        const name = 'Éléonore María de la Cruz François '.repeat(5);
        await input.fill(name); await settle(page);
        const bounds = await page.evaluate(async (text) => {
            // @ts-expect-error Vite serves this source module in browser.
            const {textLayout} = await import('/src/demo/scene.ts');
            const rect = document.querySelector('canvas')!.getBoundingClientRect();
            const ctx = document.createElement('canvas').getContext('2d')!;
            const layout = textLayout(ctx,text,rect.width,rect.height), m=ctx.measureText(text);
            return {left:layout.x-m.actualBoundingBoxLeft,right:layout.x+m.actualBoundingBoxRight,
                top:layout.y-m.actualBoundingBoxAscent,bottom:layout.y+m.actualBoundingBoxDescent,w:rect.width,h:rect.height};
        },name);
        expect(bounds.left).toBeGreaterThan(0); expect(bounds.right).toBeLessThan(bounds.w);
        expect(bounds.top).toBeGreaterThan(0); expect(bounds.bottom).toBeLessThan(bounds.h);
    }
    await expect(page.locator('.stage .stage-caption')).toHaveCount(0);
});

test('presets, custom adjustments and reset', async ({page}) => {
    await page.goto('/'); await page.locator('#drift').click(); await settle(page);
    for (const [name,strength,aberration] of [['Prism','1.35','2.6'],['Liquid','1.75','0.8'],['Clear','1.15','1.2']]) {
        const before=await pixels(page);
        await page.getByRole('button',{name,exact:true}).click(); await settle(page);
        await expect(page.locator('#strength')).toHaveValue(strength);
        await expect(page.locator('#aberration')).toHaveValue(aberration);
        await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
        expect(await pixels(page)).not.toEqual(before);
    }
    await page.locator('#strength').fill('1.5');
    await expect(page.locator('#preset-status')).toHaveText('Custom');
    await expect(page.locator('[data-preset][aria-pressed=true]')).toHaveCount(0);
    await page.getByLabel('Your text',{exact:true}).fill('André');
    await page.getByRole('button',{name:'Reset',exact:false}).click();
    await expect(page.getByLabel('Your text',{exact:true})).toHaveValue('Hello');
    await expect(page.locator('#preset-status')).toHaveText('Clear');
});

test('press deformation, keyboard release, blur cleanup and reduced motion', async ({page}) => {
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/'); await page.locator('#drift').click(); await settle(page); await page.mouse.move(650,350); await settle(page);
    await page.emulateMedia({reducedMotion:'no-preference'});
    const circle=await pixels(page);
    await page.mouse.down(); await page.waitForTimeout(800);
    expect(await pixels(page)).not.toEqual(circle);
    await page.screenshot({path:'docs/liquid.png'});
    await page.mouse.up(); await page.waitForTimeout(1200);
    await expect.poll(()=>pixels(page),{timeout:5000}).toEqual(circle);
    await page.locator('canvas').focus(); await page.keyboard.down('Space'); await page.waitForTimeout(800);
    expect(await pixels(page)).not.toEqual(circle);
    await page.keyboard.up('Space'); await page.waitForTimeout(1200); await expect.poll(()=>pixels(page),{timeout:5000}).toEqual(circle);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.keyboard.down('Enter'); await page.waitForTimeout(80);
    const held=await pixels(page); await settle(page); expect(await pixels(page)).toEqual(held);
    expect(held).not.toEqual(circle);
    await page.getByLabel('Your text',{exact:true}).focus(); await page.waitForTimeout(80);
    await expect.poll(()=>pixels(page),{timeout:5000}).toEqual(circle); await page.keyboard.up('Enter');
});

test('mobile hold versus drag, cancellation and scrolling outside scene', async ({browser}) => {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page=await context.newPage(); await page.goto('http://127.0.0.1:5188'); await settle(page);
    const client=await context.newCDPSession(page);
    const touch=async(type:string,x=190,y=260)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y}]});
    await touch('touchStart'); await page.waitForTimeout(60); const circle=await pixels(page);
    await page.waitForTimeout(300); const held=await pixels(page); expect(held).not.toEqual(circle);
    await touch('touchCancel'); await page.waitForTimeout(80); await expect.poll(()=>pixels(page),{timeout:5000}).toEqual(circle);
    await touch('touchStart'); await touch('touchMove',260,310); await page.waitForTimeout(80);
    const drag=await pixels(page); await page.waitForTimeout(350); expect(await pixels(page)).toEqual(drag);
    await touch('touchEnd'); await page.waitForTimeout(80); expect(await pixels(page)).toEqual(drag);
    await touch('touchStart',8,720); await touch('touchMove',8,550); await touch('touchMove',8,400); await touch('touchEnd');
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
    await context.close();
});


test('share link restores Unicode text and custom optics without download', async ({page,context}) => {
    await page.goto('/'); await page.locator('#drift').click();
    await page.getByLabel('Your text',{exact:true}).fill('Zoë & André #1');
    await page.getByRole('button',{name:'Liquid',exact:true}).click();
    await page.locator('#strength').fill('1.5');
    await page.getByRole('button',{name:'Generate link'}).click();
    const url=await page.locator('#share-link').inputValue();
    await context.grantPermissions(['clipboard-read','clipboard-write']);
    await page.getByRole('button',{name:'Copy link',exact:true}).click();
    await expect(page.locator('#share-status')).toHaveText('Link copied.');
    expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(url);
    expect(url).toContain('#g='); expect(url.length).toBeLessThan(100);
    await expect(page.getByRole('button',{name:'Save image'})).toHaveCount(0);
    const other=await context.newPage(); await other.goto(url); await other.waitForTimeout(500);
    await expect(other.getByLabel('Your text',{exact:true})).toHaveValue('Zoë & André #1');
    await expect(other.locator('#strength')).toHaveValue('1.5');
    await expect(other.locator('#aberration')).toHaveValue('0.8');
    await expect(other.locator('#preset-status')).toHaveText('Custom');
    await expect(other.locator('#drift')).toHaveAttribute('aria-pressed','false');
    await expect(other.locator('.controls')).toBeHidden();
    await expect(other.getByRole('link',{name:'Create yours'})).toBeVisible();
    const preview=await pixels(other);
    await other.mouse.move(200,200); await settle(other); expect(await pixels(other)).toEqual(preview);
    await other.screenshot({path:'docs/shared-preview.png'});
    await other.getByRole('link',{name:'Create yours'}).click();
    await expect(other.locator('.controls')).toBeVisible();
    await expect(other.getByLabel('Your text',{exact:true})).toHaveValue('Hello');
    await other.close();
    await page.goto('/#glass=broken'); await page.reload(); await expect(page.getByLabel('Your text',{exact:true})).toHaveValue('Hello');
});

test('idle drift moves, pauses for input, and obeys reduced motion', async ({page}) => {
    await page.goto('/'); await settle(page); const initial=await pixels(page);
    await page.waitForTimeout(3800); expect(await pixels(page)).not.toEqual(initial);
    await page.locator('#drift').click(); await settle(page); const stopped=await pixels(page);
    await page.waitForTimeout(3000); expect(await pixels(page)).toEqual(stopped);
    await page.locator('#drift').click();
    await page.getByLabel('Your text',{exact:true}).focus(); await settle(page); const editing=await pixels(page);
    await page.waitForTimeout(3000); expect(await pixels(page)).toEqual(editing);
    await page.emulateMedia({reducedMotion:'reduce'}); await page.locator('canvas').focus(); await settle(page);
    const reduced=await pixels(page); await page.waitForTimeout(3200); expect(await pixels(page)).toEqual(reduced);
});


test('responsive controls fit narrow phones, tablets and wide screens', async ({page}) => {
    for(const [width,height] of [[320,640],[375,812],[600,900],[768,1024],[1024,768],[844,390],[1920,1080]]) {
        await page.setViewportSize({width,height}); await page.goto('/');
        await expect(page.locator('#your-text')).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
        const overflow=await page.locator('.controls input,.controls button').evaluateAll(els=>els.filter(el=>{
            const r=el.getBoundingClientRect(); return r.width>0&&(r.left<0||r.right>innerWidth);
        }).length);
        expect(overflow).toBe(0);
        await expect(page.locator('#your-text')).toHaveCSS('box-shadow','none');
        await expect(page.locator('[data-preset="Clear"]')).toHaveCSS('box-shadow','none');
        if(width===320||width===768) await page.screenshot({path:`docs/responsive-${width}.png`,fullPage:true});
    }
});
