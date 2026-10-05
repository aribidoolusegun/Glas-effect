import type { GlassLens } from '../lens';
/** Slow random glides with zero velocity/acceleration at each turn. */
export class IdleDrift {
    private frame = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private enabled = true;
    private reduced = false;
    private holding = false;
    private hidden = false;
    private start = 0;
    private duration = 0;
    private from = {x:0,y:0};
    private to = {x:0,y:0};
    constructor(private lens: GlassLens, private bounds: () => {width:number;height:number}) { this.activity(); }
    getEnabled() { return this.enabled; }
    setEnabled(value: boolean) { this.enabled = value; this.activity(); }
    setReducedMotion(value: boolean) { this.reduced = value; this.activity(); }
    setHolding(value: boolean) { this.holding = value; this.activity(); }
    setHidden(value: boolean) { this.hidden = value; this.activity(); }
    activity() {
        this.stop();
        if (this.enabled && !this.reduced && !this.holding && !this.hidden)
            this.timer = setTimeout(() => { this.start = 0; this.frame = requestAnimationFrame(this.tick); }, 2500);
    }
    private stop() { clearTimeout(this.timer); cancelAnimationFrame(this.frame); this.frame = 0; }
    private tick = (time: number) => {
        if (!this.start) {
            this.start = time; this.duration = 4000 + Math.random() * 3000;
            this.from = this.lens.getPosition();
            const {width,height} = this.bounds();
            const radius = this.lens.getOptions().size / 2 + 12;
            const marginX = Math.min(radius,width*.25), marginY = Math.min(radius,height*.25);
            this.to = {x:marginX+Math.random()*(width-2*marginX),y:marginY+Math.random()*(height-2*marginY)};
        }
        const t = Math.min(1,(time-this.start)/this.duration);
        const ease = t*t*t*(t*(t*6-15)+10);
        this.lens.moveTo(this.from.x+(this.to.x-this.from.x)*ease,this.from.y+(this.to.y-this.from.y)*ease,true);
        if(t===1) this.start=0;
        this.frame=requestAnimationFrame(this.tick);
    };
    dispose() { this.stop(); }
}
