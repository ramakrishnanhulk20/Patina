"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type GlowCard3DProps = {
  username: string;
  score: number;
  verdict: string;
  year: number | null;
  years: number | null;
};

/**
 * A real WebGL card — the thing people screenshot and share.
 *
 * CSS stacked panels faked depth; this is an actual plate with thickness,
 * verdigris edge light, and slow idle motion. Falls back to nothing when the
 * canvas cannot start (old WebViews): the page still has the plain HTML card.
 */
export function GlowCard3D({ username, score, verdict, year, years }: GlowCard3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = host.clientWidth || 640;
    const height = Math.max(360, Math.round(width * 0.62));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 40);
    camera.position.set(0, 0.15, 5.4);

    const plate = buildPlate({ username, score, verdict, year, years });
    scene.add(plate);

    const rings = buildRings();
    scene.add(rings);

    const key = new THREE.PointLight(0x35e0a1, 18, 12, 2);
    key.position.set(1.6, 1.4, 3.2);
    scene.add(key);

    const fill = new THREE.PointLight(0x6affc0, 6, 10, 2);
    fill.position.set(-2.2, -0.6, 2.4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x128f65, 1.2);
    rim.position.set(-2, 3, -2);
    scene.add(rim);

    scene.add(new THREE.AmbientLight(0x1a2a22, 0.55));

    const pointer = { x: 0, y: 0 };
    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    };
    const onLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);

    let frame = 0;
    let alive = true;
    const clock = new THREE.Clock();

    const tick = () => {
      if (!alive) return;
      frame = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      plate.rotation.y = pointer.x * 0.35 + Math.sin(t * 0.45) * 0.08;
      plate.rotation.x = pointer.y * -0.22 + Math.cos(t * 0.55) * 0.04;
      plate.position.y = Math.sin(t * 0.9) * 0.06;

      rings.rotation.z = t * 0.08;
      rings.rotation.y = Math.sin(t * 0.25) * 0.15;

      key.intensity = 16 + Math.sin(t * 2.1) * 2.5;

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const nextW = host.clientWidth || width;
      const nextH = Math.max(360, Math.round(nextW * 0.62));
      renderer.setSize(nextW, nextH);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      disposeObject(plate);
      disposeObject(rings);
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [username, score, verdict, year, years]);

  return (
    <div
      ref={hostRef}
      className="relative w-full overflow-hidden rounded-2xl border border-line bg-panel"
      style={{ minHeight: 360 }}
      aria-hidden="true"
    />
  );
}

function buildPlate(props: GlowCard3DProps): THREE.Group {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 2.15, 0.12, 1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x121412,
      metalness: 0.35,
      roughness: 0.45,
      emissive: 0x0a1f18,
      emissiveIntensity: 0.4,
    }),
  );
  group.add(body);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.95),
    new THREE.MeshBasicMaterial({ map: faceTexture(props), transparent: true }),
  );
  face.position.z = 0.062;
  group.add(face);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(3.42, 2.17, 0.02),
    new THREE.MeshBasicMaterial({
      color: 0x35e0a1,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  edge.position.z = -0.01;
  group.add(edge);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 2.5),
    new THREE.MeshBasicMaterial({
      color: 0x35e0a1,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.z = -0.08;
  group.add(glow);

  return group;
}

function buildRings(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(1.35, 0.35, -0.55);

  const sizes = [0.55, 0.9, 1.3, 1.75, 2.25];
  sizes.forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.92, radius, 64),
      new THREE.MeshBasicMaterial({
        color: 0x35e0a1,
        transparent: true,
        opacity: 0.08 + index * 0.05,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -0.35;
    group.add(ring);
  });

  return group;
}

function faceTexture(props: GlowCard3DProps): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#121412";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const wash = ctx.createRadialGradient(780, 120, 40, 780, 120, 420);
  wash.addColorStop(0, "rgba(53, 224, 161, 0.28)");
  wash.addColorStop(1, "rgba(53, 224, 161, 0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#a8ada8";
  ctx.font = "500 28px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("PATINA", 72, 88);

  ctx.fillStyle = "#f3f4f3";
  ctx.font = "600 42px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(props.username, 72, 150);

  ctx.fillStyle = "#35e0a1";
  ctx.font = "700 220px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(String(props.score), 64, 380);

  ctx.fillStyle = "#6c716c";
  ctx.font = "600 48px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("/100", 64 + ctx.measureText(String(props.score)).width + 16, 360);

  ctx.fillStyle = "#f3f4f3";
  ctx.font = "600 40px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(props.verdict, 72, 460);

  if (props.year !== null) {
    ctx.fillStyle = "#a8ada8";
    ctx.font = "500 30px ui-sans-serif, system-ui, sans-serif";
    const line =
      props.years !== null
        ? `Traced back to ${props.year} · ${props.years} years`
        : `Traced back to ${props.year}`;
    ctx.fillText(line, 72, 520);
  }

  ctx.strokeStyle = "rgba(53, 224, 161, 0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const map = (material as THREE.MeshBasicMaterial).map;
      if (map) map.dispose();
      material.dispose();
    }
  });
}
