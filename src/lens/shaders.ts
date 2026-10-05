export const vertex = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }
`;
export const fragment = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_strength;
uniform float u_aberration;
uniform float u_melt;
vec3 scene(vec2 pixel) { return texture2D(u_scene, clamp(pixel / u_resolution, vec2(0.), vec2(1.))).rgb; }
void main() {
 vec2 pixel = v_uv * u_resolution;
 vec2 delta = pixel - u_center;
 // A smooth polar boundary shares its geometry with refraction and lighting.
 float angle = atan(delta.y, delta.x);
 float shape = 1. + u_melt * (.11 * sin(3.*angle + .6) + .07 * cos(2.*angle - .8));
 float slope = u_melt * (.33 * cos(3.*angle + .6) - .14 * sin(2.*angle - .8));
 float r = length(delta) / (u_radius * shape);
 vec3 base = scene(pixel);
 float aa = 1.5 / u_radius;
 float mask = 1. - smoothstep(1. - aa, 1. + aa, r);
 if(r > 1. + aa) {
  float shadow = exp(-pow((r - 1.035) * 28., 2.)) * .12;
  gl_FragColor = vec4(base * (1. - shadow), 1.); return;
 }
 float sphere = sqrt(max(0., 1. - r*r));
 // Radial mapping: magnified center, progressively curved shoulder.
 float scale = 1. / (1. + u_strength * (.85 * sphere + .15));
 vec2 bent = u_center + delta * scale;
 vec2 dispersion = delta * u_aberration * (.006 + .022 * pow(r, 5.));
 // Three nearby spectral samples soften the fringe into an optical transition.
 vec2 blur = delta * .012 * u_aberration;
 vec3 glass = vec3(
  (scene(bent-dispersion-blur).r + 2.*scene(bent-dispersion).r + scene(bent-dispersion+blur).r)*.25,
  (scene(bent-blur).g + 2.*scene(bent).g + scene(bent+blur).g)*.25,
  (scene(bent+dispersion-blur).b + 2.*scene(bent+dispersion).b + scene(bent+dispersion+blur).b)*.25);
 // A broad warm transmission band appears only at refracted content edges.
 float boundary = abs(scene(bent + delta*.055).r - scene(bent - delta*.055).r);
 glass += boundary * u_aberration * vec3(.26,.105,.0);
 vec2 radial = delta / max(length(delta), .001);
 vec2 n = normalize(radial - vec2(-radial.y, radial.x) * slope / shape);
 float rim = pow(smoothstep(.76, 1., r), 2.);
 float warm = pow(max(0., dot(n, normalize(vec2(.55, .85)))), 5.);
 float cool = pow(max(0., dot(n, normalize(vec2(-.7, -.5)))), 5.);
 glass *= 1. - rim * .24;
 glass += rim * (warm * vec3(.65,.35,.035) + cool * vec3(.015,.17,.65));
 float innerGlow = exp(-pow((r - .91) * 17., 2.));
 glass += innerGlow * warm * vec3(.16,.085,.005);
 float edge = exp(-pow((r-.987)*140.,2.));
 glass = mix(glass, vec3(.96,.89,.65), edge * warm * .8);
 glass += pow(sphere, 7.) * .015;
 gl_FragColor = vec4(mix(base, glass, mask), 1.);
}
`;
