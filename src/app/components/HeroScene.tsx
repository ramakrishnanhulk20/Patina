"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * The full-bleed atmosphere the whole hero sits in: a struck hallmark rendered
 * as a living verdigris orb, ringed by bands of light, drifting in a field of
 * soft motes. The mark the product is about, turned into the light on the page.
 *
 * This is a real render, not programmer-art. The orb is a displaced sphere with
 * a fresnel-lit, mottled patina shader; the rings are sweeping arcs of light;
 * the motes are round, additive, depth-faded sprites (never square points); and
 * the whole frame is passed through UnrealBloom for the soft cinematic glow, then
 * a final vignette + film-grain + dither pass that kills every trace of banding
 * on the near-black ground.
 *
 * Vanilla three, one rAF loop, no React state. Pixel ratio, mote count, bloom
 * cost and MSAA are cut on phones; the loop stops when the tab is hidden;
 * reduced motion paints a single still frame; and if WebGL will not start the
 * CSS halo behind it carries the glow on its own.
 */

// Ashima simplex noise (public domain). Shared by the orb's surface so it swells
// and mottles like real oxidised metal rather than a smooth ball.
const SNOISE = /* glsl */ `
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

export function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    } catch {
      canvas.style.display = "none";
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const lowPower = coarse || window.innerWidth < 820;

    const pixelRatio = Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    // ------------------------------------------------------------------ backdrop
    // A dithered near-black gradient so the ground never bands on OLED, with a
    // whisper of verdigris pooling low where the orb sits.
    const bgGeo = new THREE.SphereGeometry(40, 32, 32);
    const bgMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTop: { value: new THREE.Vector3(0.018, 0.024, 0.021) },
        uBottom: { value: new THREE.Vector3(0.02, 0.055, 0.043) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uTop; uniform vec3 uBottom;
        void main(){
          float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, pow(t, 1.3));
          float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          col += (dth - 0.5) / 255.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const backdrop = new THREE.Mesh(bgGeo, bgMat);
    backdrop.renderOrder = -10;
    scene.add(backdrop);

    // ----------------------------------------------------------------- the orb
    const orbUniforms = {
      uTime: { value: 0 },
      uCore: { value: new THREE.Vector3(0.008, 0.02, 0.016) },
      uMid: { value: new THREE.Vector3(0.016, 0.15, 0.108) },
      uRim: { value: new THREE.Vector3(0.28, 1.08, 0.74) },
    };
    const orbMat = new THREE.ShaderMaterial({
      uniforms: orbUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vN; varying vec3 vV; varying float vPatina; varying float vElev;
        ${SNOISE}
        void main(){
          vec3 pos = position;
          float t = uTime * 0.12;
          float n1 = snoise(pos * 1.25 + vec3(0.0, 0.0, t));
          float n2 = snoise(pos * 3.4 + vec3(t * 0.6, t * 0.4, 0.0));
          float elev = n1 * 0.11 + n2 * 0.035;
          pos += normal * elev;
          vElev = elev;
          vPatina = n1 * 0.5 + 0.5;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uRim;
        varying vec3 vN; varying vec3 vV; varying float vPatina; varying float vElev;
        void main(){
          float fres = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 3.0);
          vec3 base = mix(uCore, uMid, clamp(smoothstep(0.2, 0.95, vPatina) * 0.55 + vElev * 0.9, 0.0, 1.0));
          vec3 col = mix(base, uRim, fres);
          col += uRim * pow(fres, 2.5) * 0.85;
          col += vec3(0.0, 0.12, 0.06) * pow(fres, 5.0);
          float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          col += (dth - 0.5) / 255.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const orbGeo = new THREE.IcosahedronGeometry(1.35, lowPower ? 5 : 7);
    const orb = new THREE.Mesh(orbGeo, orbMat);
    scene.add(orb);

    // A front-facing halo just outside the orb: fresnel-bright at the silhouette,
    // transparent through the middle, so the edge reads as lit air, not a line.
    const haloUniforms = {
      uColor: { value: new THREE.Vector3(0.14, 0.62, 0.42) },
      uStrength: { value: 0.6 },
    };
    const haloMat = new THREE.ShaderMaterial({
      uniforms: haloUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uStrength;
        varying vec3 vN; varying vec3 vV;
        void main(){
          float fres = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 2.2);
          float a = fres * uStrength;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.52, 4), haloMat);
    scene.add(halo);

    // ---------------------------------------------------------------- the rings
    // Growth rings, rendered as sweeping bands of light rather than hairlines, so
    // bloom bleeds them into soft arcs instead of aliasing into jagged wire.
    const rings = new THREE.Group();
    const ringDisposables: Array<THREE.BufferGeometry | THREE.Material> = [];
    const ringSpecs = [
      { r: 1.95, base: 0.1, arc: 0.55, speed: 0.5, offset: 0.0, tilt: 0.16 },
      { r: 2.35, base: 0.07, arc: 0.42, speed: -0.35, offset: 2.1, tilt: -0.1 },
      { r: 2.78, base: 0.05, arc: 0.32, speed: 0.24, offset: 4.0, tilt: 0.26 },
    ];
    ringSpecs.forEach((spec, i) => {
      const geo = new THREE.TorusGeometry(spec.r, 0.02, 20, 320);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Vector3(0.22, 0.92, 0.64) },
          uBase: { value: spec.base },
          uArc: { value: spec.arc },
          uSpeed: { value: spec.speed },
          uOffset: { value: spec.offset },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uColor;
          uniform float uBase; uniform float uArc; uniform float uSpeed; uniform float uOffset;
          varying vec2 vUv;
          void main(){
            float sweep = sin(vUv.x * 6.2831 - uTime * uSpeed + uOffset);
            float arc = smoothstep(0.35, 1.0, sweep) * uArc;
            float tube = 0.5 + 0.5 * sin(vUv.y * 3.14159);
            float intensity = uBase + arc;
            float a = intensity * (0.55 + 0.45 * tube);
            gl_FragColor = vec4(uColor * (uBase + arc * 1.7), a);
          }`,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2 + spec.tilt;
      ring.rotation.y = i * 0.5;
      rings.add(ring);
      ringDisposables.push(geo, mat);
    });
    scene.add(rings);

    // ---------------------------------------------------------------- the motes
    const moteCount = lowPower ? 520 : 1500;
    const mPos = new Float32Array(moteCount * 3);
    const mScale = new Float32Array(moteCount);
    const mSeed = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i += 1) {
      // A shell around the orb, flattened toward a disc so the field reads as depth.
      const rr = 2.3 + Math.random() * 5.2;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      mPos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
      mPos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th) * 0.7;
      mPos[i * 3 + 2] = rr * Math.cos(ph);
      // A few large soft bokeh motes among the fine dust.
      mScale[i] = Math.random() < 0.12 ? 2.4 + Math.random() * 2.6 : 0.5 + Math.random() * 1.1;
      mSeed[i] = Math.random();
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
    moteGeo.setAttribute("aScale", new THREE.BufferAttribute(mScale, 1));
    moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(mSeed, 1));
    const moteMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 26 },
        uPixelRatio: { value: pixelRatio },
        uColor: { value: new THREE.Vector3(0.18, 0.82, 0.58) },
        uHot: { value: new THREE.Vector3(0.7, 1.05, 0.92) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uSize; uniform float uPixelRatio;
        attribute float aScale; attribute float aSeed;
        varying float vTwinkle; varying float vFade;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vTwinkle = 0.5 + 0.5 * sin(uTime * (0.5 + aSeed * 1.6) + aSeed * 6.2831);
          float dist = -mv.z;
          vFade = smoothstep(1.2, 3.2, dist) * (1.0 - smoothstep(8.5, 13.5, dist));
          gl_PointSize = uSize * aScale * uPixelRatio * (1.0 / dist);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform vec3 uHot;
        varying float vTwinkle; varying float vFade;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          float core = smoothstep(0.16, 0.0, d);
          vec3 col = mix(uColor, uHot, core);
          float a = glow * glow * vTwinkle * vFade;
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);

    // ------------------------------------------------------------- postprocessing
    // A half-float target (with MSAA on desktop) so emissive values can exceed 1
    // and bloom has real energy to bleed.
    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      type: THREE.HalfFloatType,
      samples: lowPower ? 0 : 4,
    });
    const composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);

    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      lowPower ? 0.58 : 0.78, // strength
      0.7, // radius
      0.16, // threshold
    );
    composer.addPass(bloom);

    composer.addPass(new OutputPass());

    // The final tooth: vignette to seat the frame, a faint moving grain so it
    // reads as a rendered still, and a last dither to erase any residual banding.
    const grainUniforms = {
      tDiffuse: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    };
    const grainPass = new ShaderPass({
      uniforms: grainUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uResolution;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec3 col = texture2D(tDiffuse, vUv).rgb;
          vec2 q = vUv - 0.5;
          float vig = smoothstep(1.05, 0.35, length(q));
          col *= mix(1.0, vig, 0.42);
          float g = hash(vUv * uResolution + fract(uTime));
          col += (g - 0.5) * 0.03;
          float dth = hash(vUv * uResolution * 1.7 + 11.0);
          col += (dth - 0.5) / 255.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    composer.addPass(grainPass);

    // ------------------------------------------------------------------ interaction
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (event: PointerEvent) => {
      tx = event.clientX / window.innerWidth - 0.5;
      ty = event.clientY / window.innerHeight - 0.5;
    };
    if (!coarse) window.addEventListener("pointermove", onMove, { passive: true });

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      grainUniforms.uResolution.value.set(w, h);
    };
    window.addEventListener("resize", resize);

    const t0 = performance.now();
    let raf = 0;
    let running = false;

    const render = (t: number) => {
      orbUniforms.uTime.value = t;
      moteMat.uniforms.uTime.value = t;
      grainUniforms.uTime.value = t;
      rings.children.forEach((child) => {
        const mat = (child as THREE.Mesh).material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = t;
      });

      orb.rotation.y = t * 0.14;
      orb.rotation.x = Math.sin(t * 0.18) * 0.12;
      halo.rotation.copy(orb.rotation);
      rings.rotation.y = t * 0.06;
      rings.rotation.z = t * 0.035;
      motes.rotation.y = t * 0.03;

      mx += (tx - mx) * 0.045;
      my += (ty - my) * 0.045;
      camera.position.x = mx * 1.4;
      camera.position.y = -my * 1.4;
      camera.lookAt(0, 0, 0);

      composer.render();
    };

    const loop = (now: number) => {
      if (!running) return;
      render((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    if (reduced) render(3.0);
    else start();

    // The atmosphere runs the whole page; it only stops when the tab is hidden,
    // so it never burns frames or battery in the background.
    const onVisibility = () => {
      if (reduced) return;
      if (document.visibilityState === "visible") start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Fade the atmosphere back as you leave the hero, so the sections read
    // cleanly over it instead of fighting a bright orb behind the text.
    let opacityRaf = 0;
    const applyOpacity = () => {
      opacityRaf = 0;
      const p = Math.min((window.scrollY || 0) / window.innerHeight, 1);
      canvas.style.opacity = (1 - p * 0.82).toFixed(3);
    };
    const onScroll = () => {
      if (!opacityRaf) opacityRaf = requestAnimationFrame(applyOpacity);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    applyOpacity();

    return () => {
      stop();
      cancelAnimationFrame(opacityRaf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      bgGeo.dispose();
      bgMat.dispose();
      orbGeo.dispose();
      orbMat.dispose();
      halo.geometry.dispose();
      haloMat.dispose();
      moteGeo.dispose();
      moteMat.dispose();
      ringDisposables.forEach((d) => d.dispose());
      rt.dispose();
      composer.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
