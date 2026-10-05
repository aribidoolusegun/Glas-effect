import { vertex, fragment } from './shaders';
export interface LensOptions {
    size: number;
    strength: number;
    aberration: number;
}
export const defaults: Readonly<LensOptions> = Object.freeze({ size: 220, strength: 1.15, aberration: 1.2 });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A texture-based lens. Coordinates and size are in CSS pixels, origin top-left. */
export class GlassLens {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private texture: WebGLTexture;
    private buffer: WebGLBuffer;
    private uniforms: Record<string, WebGLUniformLocation | null> = {};
    private width = 1;
    private height = 1;
    private dpr = 1;
    private x = 0;
    private y = 0;
    private targetX = 0;
    private targetY = 0;
    private frame = 0;
    private previous = 0;
    private disposed = false;
    private options: LensOptions = { ...defaults };
    private reducedMotion = false;
    private melt = 0;
    private meltTarget = 0;
    private meltVelocity = 0;
    private softness = 1;
    /** Tune press deformation independently from the optical controls. */
    setSoftness(value: number) { this.softness = clamp(value, .3, 1.5); this.invalidate(); }
    setPressed(pressed: boolean) {
        this.meltTarget = pressed ? 1 : 0;
        if (this.reducedMotion) { this.melt = this.meltTarget; this.meltVelocity = 0; }
        this.invalidate();
    }
    constructor(private canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
        if (!gl)
            throw new Error('WebGL is unavailable. Try a browser with hardware acceleration enabled.');
        this.gl = gl;
        const compile = (type: number, source: string) => {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const error = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(error || 'Shader compilation failed');
            }
            return shader;
        };
        const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
        this.program = gl.createProgram()!;
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw new Error('Shader linking failed');
        gl.useProgram(this.program);
        this.buffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(this.program, 'a_position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        for (const name of ['resolution', 'center', 'radius', 'strength', 'aberration', 'scene', 'melt'])
            this.uniforms[name] = gl.getUniformLocation(this.program, `u_${name}`);
        this.texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(this.uniforms.scene, 0);
    }
    resize(width: number, height: number, dpr = window.devicePixelRatio || 1) {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.dpr = clamp(dpr, 1, 2);
        const limit = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
        this.dpr = Math.min(this.dpr, limit / this.width, limit / this.height);
        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.invalidate();
    }
    setScene(source: TexImageSource) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        this.invalidate();
    }
    setOptions(options: Partial<LensOptions>) {
        for (const [key, min, max] of [['size', 80, 500], ['strength', 0, 2.5], ['aberration', 0, 3]] as const) {
            const v = options[key];
            if (v !== undefined && Number.isFinite(v))
                this.options[key] = clamp(v, min, max);
        }
        this.invalidate();
    }
    getOptions(): LensOptions { return { ...this.options }; }
    getPosition() { return { x: this.x, y: this.y }; }
    setReducedMotion(value: boolean) { this.reducedMotion = value; if (value) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.melt = this.meltTarget; this.meltVelocity = 0;
    } this.invalidate(); }
    moveTo(x: number, y: number, immediate = false) {
        if (!Number.isFinite(x) || !Number.isFinite(y))
            return;
        this.targetX = clamp(x, 0, this.width);
        this.targetY = clamp(y, 0, this.height);
        if (immediate || this.reducedMotion) {
            this.x = this.targetX;
            this.y = this.targetY;
        }
        this.invalidate();
    }
    private invalidate() { if (!this.frame && !this.disposed)
        this.frame = requestAnimationFrame(this.render); }
    private render = (time: number) => {
        this.frame = 0;
        const dt = Math.min(64, this.previous ? time - this.previous : 16);
        this.previous = time;
        const blend = this.reducedMotion ? 1 : 1 - Math.exp(-dt / 65);
        this.x += (this.targetX - this.x) * blend;
        this.y += (this.targetY - this.y) * blend;
        // Small fixed substeps keep the damped spring stable after slow frames.
        for (let remaining = dt / 1000; remaining > 0;) {
            const step = Math.min(remaining, 1 / 120); remaining -= step;
            this.meltVelocity += ((this.meltTarget - this.melt) * 180 - this.meltVelocity * 22) * step;
            this.melt += this.meltVelocity * step;
        }
        if (Math.abs(this.meltTarget - this.melt) < .0001 && Math.abs(this.meltVelocity) < .001) {
            this.melt = this.meltTarget; this.meltVelocity = 0;
        }
        if (Math.abs(this.x - this.targetX) + Math.abs(this.y - this.targetY) <= .05) {
            this.x = this.targetX; this.y = this.targetY;
        }
        this.draw();
        if (Math.abs(this.x - this.targetX) + Math.abs(this.y - this.targetY) > .05 || this.melt !== this.meltTarget)
            this.invalidate();
        else this.previous = 0;
    };
    private draw() {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniform1f(this.uniforms.melt, this.melt * this.softness);
        gl.uniform2f(this.uniforms.resolution, this.width, this.height);
        gl.uniform2f(this.uniforms.center, this.x, this.height - this.y);
        gl.uniform1f(this.uniforms.radius, this.options.size / 2);
        gl.uniform1f(this.uniforms.strength, this.options.strength + this.melt * .22);
        gl.uniform1f(this.uniforms.aberration, this.options.aberration);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    dispose() { this.disposed = true; cancelAnimationFrame(this.frame); this.gl.deleteTexture(this.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
}
