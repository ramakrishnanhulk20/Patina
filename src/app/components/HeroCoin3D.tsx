"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";

/**
 * The signature moment: a struck hallmark, in real metal.
 *
 * A coin of oxidised verdigris with the growth-ring mark polished into both
 * faces, turning slowly so a moving glare rakes across it. The reflections come
 * from a procedural studio built out of Lightformers rather than a downloaded
 * HDR, so the app stays self contained and makes no request for it.
 *
 * Desktop only. It is dynamically imported and mounted behind a desktop check
 * (see HeroMedallion), so a phone never downloads three or this scene.
 */
function Medallion() {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.3;
  });

  const R = 1.45;
  const thickness = 0.2;
  const rings = [0.55, 0.92, 1.2];

  return (
    <group ref={group}>
      {/* The blank, oxidised body. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, thickness, 128]} />
        <meshStandardMaterial color="#0e5a41" metalness={1} roughness={0.45} envMapIntensity={1.1} />
      </mesh>

      {/* Both faces carry the mark, polished brighter than the body. */}
      {[1, -1].map((side) => (
        <group key={side} position={[0, 0, (side * thickness) / 2 + side * 0.001]}>
          {rings.map((r, i) => (
            <mesh key={i}>
              <torusGeometry args={[r, 0.04, 24, 140]} />
              <meshStandardMaterial
                color="#37e0a1"
                metalness={1}
                roughness={0.26}
                envMapIntensity={1.3}
              />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.02 * side]}>
            <sphereGeometry args={[0.15, 40, 40]} />
            <meshStandardMaterial
              color="#6affc0"
              metalness={1}
              roughness={0.22}
              envMapIntensity={1.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function HeroCoin3D() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 5.2], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 6, 6]} intensity={1.8} />

      <Float speed={1.5} rotationIntensity={0.35} floatIntensity={0.7}>
        <Medallion />
      </Float>

      {/* A studio, built from light panels, for the metal to reflect. */}
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 2.5, 4]} scale={[7, 4, 1]} />
        <Lightformer intensity={1.6} color="#6affc0" position={[-4, 1, 2]} scale={[3, 4, 1]} />
        <Lightformer intensity={1.2} color="#128f65" position={[4, -1.5, 2]} scale={[3, 3, 1]} />
        <Lightformer intensity={1} position={[0, -3, 2]} scale={[6, 2, 1]} />
      </Environment>
    </Canvas>
  );
}
