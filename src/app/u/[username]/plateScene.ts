import * as THREE from "three";

/**
 * The Patina plate: a real object, not a rectangle with a green haze on it.
 *
 * WHAT THE PREVIOUS VERSION GOT WRONG, since every mistake here is one that is
 * easy to make again:
 *
 *  1. The camera never framed the plate. A fixed `position.z` with a fixed 32°
 *     field of view meant the visible width depended entirely on the canvas
 *     aspect ratio. On a phone that worked out at 2.88 world units against a
 *     3.4-unit plate, so roughly 15% was sliced off each side. It looked fine on
 *     a laptop, which is why it survived. `frameCamera` below solves for the
 *     distance that fits BOTH axes, so the plate is whole at every aspect.
 *
 *  2. The edge light was inside the plate. A 3.42 × 2.17 × 0.02 box at z = -0.01
 *     sits entirely within a body spanning z ∈ [-0.06, 0.06], so it was
 *     depth-culled on every frame. Same for the backing glow, which was behind
 *     an opaque body. Both rendered nothing.
 *
 *  3. The lights lit nothing. They only affect a MeshStandardMaterial, and the
 *     only one was the body — which was covered front-to-back by an unlit
 *     MeshBasicMaterial face plane. Animating the key light modulated a 0.1-unit
 *     sliver nobody could see.
 *
 * So the rim is now EARNED rather than drawn: the plate is polished metal, and
 * the verdigris comes from coloured lights raking across it. That is why it
 * moves correctly when the card tilts, which a painted-on glow never does.
 */

const ACCENT = 0x35e0a1;
const ACCENT_BRIGHT = 0x6affc0;
const ACCENT_DEEP = 0x128f65;
const PANEL = 0x121412;

/** Plate dimensions in world units. Face art is drawn to the same ratio. */
const PLATE_W = 3.2;
const PLATE_H = 2.0;
const PLATE_D = 0.16;
const CORNER = 0.14;

/** How much empty space to leave around the plate when framing. */
const FRAMING = 1.22;

const FOV = 30;

export type PlateData = {
  username: string;
  score: number;
  verdict: string;
  year: number | null;
  years: number | null;
  /** The font stack to draw the face with, read off the live page. */
  fontFamily: string;
};

export type PlateHandle = {
  /** Pointer or scroll-derived tilt, each in [-1, 1]. */
  setTilt(x: number, y: number): void;
  /** Render a single frame. Used for the static reduced-motion composition. */
  renderOnce(): void;
  /** Start/stop the animation loop. Idempotent. */
  play(): void;
  pause(): void;
  resize(width: number, height: number): void;
  dispose(): void;
};

/**
 * Solve for the camera distance that fits the plate in both axes.
 *
 * The vertical case is the textbook one. The horizontal case is the one that
 * was missing: at a narrow aspect the horizontal field of view is the binding
 * constraint, and ignoring it is exactly how the card came to be cropped on
 * phones while looking correct on a laptop.
 */
function frameCamera(camera: THREE.PerspectiveCamera, aspect: number): void {
  const vFov = (FOV * Math.PI) / 180;
  const forHeight = (PLATE_H * FRAMING) / (2 * Math.tan(vFov / 2));
  const forWidth = (PLATE_W * FRAMING) / (2 * Math.tan(vFov / 2) * aspect);

  camera.aspect = aspect;
  camera.position.z = Math.max(forHeight, forWidth);
  camera.updateProjectionMatrix();
}

/** A rounded rectangle, as a shape to extrude. */
function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  return shape;
}

/**
 * The face art, drawn once to a 2D canvas and used as both the colour map and
 * the emissive map.
 *
 * Emissive as well as colour is what stops the type going muddy as the plate
 * tilts away from the key light. The plate is allowed to fall into shadow; the
 * number printed on it is not.
 */
function faceTexture(data: PlateData): THREE.CanvasTexture {
  const scale = 2;
  const width = 512 * scale;
  const height = 320 * scale;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const font = (weight: number, size: number) => `${weight} ${size}px ${data.fontFamily}`;

  ctx.fillStyle = "#0e100e";
  ctx.fillRect(0, 0, 512, 320);

  // A soft verdigris bloom behind the number, so the face is not flat.
  const bloom = ctx.createRadialGradient(120, 210, 10, 120, 210, 260);
  bloom.addColorStop(0, "rgba(53, 224, 161, 0.16)");
  bloom.addColorStop(1, "rgba(53, 224, 161, 0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, 512, 320);

  // Growth rings, top right. The same motif as the favicon and the OG card.
  ctx.save();
  ctx.translate(410, 92);
  for (let i = 6; i >= 1; i -= 1) {
    ctx.beginPath();
    ctx.arc(0, 0, i * 15, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(53, 224, 161, ${0.05 + (6 - i) * 0.045})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = "#35e0a1";
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#6c716c";
  ctx.font = font(600, 12);
  ctx.letterSpacing = "2.4px";
  ctx.fillText("PATINA", 40, 52);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#f3f4f3";
  ctx.font = font(600, 25);
  ctx.fillText(truncate(ctx, data.username, 260), 40, 88);

  // The number is the whole point of the card, so it gets the room.
  ctx.fillStyle = "#35e0a1";
  ctx.font = font(700, 128);
  const scoreText = String(data.score);
  ctx.fillText(scoreText, 36, 216);

  ctx.fillStyle = "#4b504b";
  ctx.font = font(600, 30);
  ctx.fillText("/100", 36 + measure(ctx, scoreText, font(700, 128)) + 10, 216);

  ctx.fillStyle = "#f3f4f3";
  ctx.font = font(600, 23);
  ctx.fillText(truncate(ctx, data.verdict, 300), 40, 254);

  if (data.year !== null) {
    ctx.fillStyle = "#a8ada8";
    ctx.font = font(500, 16);
    const line =
      data.years !== null
        ? `Traced back to ${data.year} · ${data.years} years`
        : `Traced back to ${data.year}`;
    ctx.fillText(line, 40, 282);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Width of a string at a given font, without disturbing the current one. */
function measure(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const previous = ctx.font;
  ctx.font = font;
  const width = ctx.measureText(text).width;
  ctx.font = previous;
  return width;
}

/** Names are capped at 20 characters, but a wide one can still overrun. */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

export function createPlateScene(
  canvas: HTMLCanvasElement,
  data: PlateData,
  options: { width: number; height: number; reducedMotion: boolean },
): PlateHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      // "high-performance" asks a laptop for its discrete GPU, which costs
      // battery and buys nothing for six meshes. Most visitors are on a phone,
      // where the request is meaningless anyway.
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    });
  } catch {
    return null;
  }

  // A phone gains nothing visible above 2x on geometry this simple, and pays
  // for every extra pixel in heat.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(options.width, options.height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  frameCamera(camera, options.width / options.height);

  // ---------------------------------------------------------------- the plate
  const plate = new THREE.Group();

  const bodyGeometry = new THREE.ExtrudeGeometry(roundedRect(PLATE_W, PLATE_H, CORNER), {
    depth: PLATE_D,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 4,
    curveSegments: 16,
  });
  bodyGeometry.translate(0, 0, -PLATE_D / 2);

  // Polished, near-black metal. The verdigris rim is a REFLECTION of the rim
  // lights below rather than paint, which is why it travels across the bevel as
  // the card turns instead of sitting still on it.
  const body = new THREE.Mesh(
    bodyGeometry,
    new THREE.MeshStandardMaterial({
      color: PANEL,
      metalness: 0.92,
      roughness: 0.28,
    }),
  );
  plate.add(body);

  const faceMap = faceTexture(data);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(PLATE_W - 0.16, PLATE_H - 0.16),
    new THREE.MeshStandardMaterial({
      map: faceMap,
      emissive: 0xffffff,
      emissiveMap: faceMap,
      emissiveIntensity: 0.55,
      metalness: 0.1,
      roughness: 0.7,
    }),
  );
  face.position.z = PLATE_D / 2 + 0.035;
  plate.add(face);

  scene.add(plate);

  // ------------------------------------------------------------- the backdrop
  // Rings sit CENTRED behind the plate rather than off to one side. Offset to
  // the right, as they were, they left the frame entirely at narrow aspects.
  const rings = new THREE.Group();
  rings.position.z = -1.5;
  for (let i = 0; i < 6; i += 1) {
    const radius = 0.9 + i * 0.42;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.006, radius, 96),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.34 - i * 0.045,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    rings.add(ring);
  }
  scene.add(rings);

  // A wide, soft halo BEHIND the plate and large enough to read around it. The
  // old one was 3.8 × 2.5 against a 3.4 × 2.15 body, so almost all of it was
  // hidden by the thing it was meant to be haloing.
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(PLATE_W * 2.1, PLATE_H * 2.1),
    new THREE.MeshBasicMaterial({
      map: haloTexture(),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.position.z = -0.9;
  scene.add(halo);

  // ---------------------------------------------------------------- the light
  const key = new THREE.DirectionalLight(ACCENT_BRIGHT, 2.6);
  key.position.set(2.4, 2.6, 3.4);
  scene.add(key);

  // The two rim lights are what draw the verdigris edge onto the bevel.
  const rimLeft = new THREE.PointLight(ACCENT, 14, 9, 2);
  rimLeft.position.set(-2.7, 0.5, 0.9);
  scene.add(rimLeft);

  const rimRight = new THREE.PointLight(ACCENT_DEEP, 10, 9, 2);
  rimRight.position.set(2.7, -0.9, 0.7);
  scene.add(rimRight);

  scene.add(new THREE.AmbientLight(0x243029, 1.1));

  // ----------------------------------------------------------------- the loop
  const tilt = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let frame = 0;
  let running = false;
  let elapsed = 0;
  let last = performance.now();

  function draw(now: number) {
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += delta;

    // Ease towards the target so a flicked finger does not snap the card.
    eased.x += (tilt.x - eased.x) * Math.min(delta * 6, 1);
    eased.y += (tilt.y - eased.y) * Math.min(delta * 6, 1);

    plate.rotation.y = eased.x * 0.42 + Math.sin(elapsed * 0.42) * 0.055;
    plate.rotation.x = eased.y * -0.28 + Math.cos(elapsed * 0.53) * 0.03;
    plate.position.y = Math.sin(elapsed * 0.8) * 0.035;

    rings.rotation.z = elapsed * 0.045;
    halo.material.opacity = 0.42 + Math.sin(elapsed * 1.1) * 0.09;

    renderer.render(scene, camera);
  }

  function tick(now: number) {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    draw(now);
  }

  const handle: PlateHandle = {
    setTilt(x, y) {
      tilt.x = Math.max(-1, Math.min(1, x));
      tilt.y = Math.max(-1, Math.min(1, y));
    },
    renderOnce() {
      last = performance.now();
      draw(last);
    },
    play() {
      if (running || options.reducedMotion) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    },
    pause() {
      running = false;
      cancelAnimationFrame(frame);
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      frameCamera(camera, width / height);
      if (!running) handle.renderOnce();
    },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const standard = material as THREE.MeshStandardMaterial;
          standard.map?.dispose();
          standard.emissiveMap?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
    },
  };

  // Reduced motion still gets the composition — a plate, lit, at a considered
  // angle — just none of the movement. Removing the visual entirely would
  // punish the setting rather than honour it.
  if (options.reducedMotion) {
    plate.rotation.y = -0.16;
    plate.rotation.x = 0.06;
  }
  handle.renderOnce();

  return handle;
}

/** A radial falloff, drawn once, used as the halo's alpha. */
function haloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(53, 224, 161, 0.55)");
  gradient.addColorStop(0.45, "rgba(53, 224, 161, 0.12)");
  gradient.addColorStop(1, "rgba(53, 224, 161, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
