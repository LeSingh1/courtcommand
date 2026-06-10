"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import shotsRaw from "./heroShots.json";

// ---- Real data → 3D space -------------------------------------------------
// 436 real 2026-playoff shots (deterministically sampled from all 15,234).
// 2D court space is 500×470 with the rim at (250, 62); we map that to world
// units with the rim at the origin so arcs land on the actual hoop.
type S = { x: number; y: number; m: number; v: number; d: number };
const SHOTS = shotsRaw as S[];

const EMBER = "#c8f23f";
const STEEL = "#6e84a3";
const HAIR = "#2a3442";
const PX = 42; // court px per world unit
const RIM_Y = 2.3; // ~10 ft at this scale

const toWorld = (x: number, y: number): [number, number] => [(x - 250) / PX, (y - 62) / PX];

function circlePts(cx: number, cy: number, r: number, a0 = 0, a1 = Math.PI * 2, n = 64) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// All court markings as one LineSegments geometry (single draw call).
function buildCourtLines(): THREE.BufferGeometry {
  const seg: number[] = [];
  const push2D = (a: [number, number], b: [number, number]) => {
    const [ax, az] = toWorld(a[0], a[1]);
    const [bx, bz] = toWorld(b[0], b[1]);
    seg.push(ax, 0, az, bx, 0, bz);
  };
  const polyline = (pts: [number, number][]) => {
    for (let i = 0; i < pts.length - 1; i++) push2D(pts[i], pts[i + 1]);
  };
  // boundary + halfcourt end
  polyline([
    [10, 10],
    [490, 10],
    [490, 460],
    [10, 460],
    [10, 10],
  ]);
  // paint
  polyline([
    [170, 10],
    [170, 200],
    [330, 200],
    [330, 10],
  ]);
  // free-throw circle + rim
  polyline(circlePts(250, 200, 60));
  polyline(circlePts(250, 62, 9, 0, Math.PI * 2, 28));
  // three-point line: corner segments + arc through (50,144)/(450,144)
  push2D([50, 10], [50, 144]);
  push2D([450, 10], [450, 144]);
  const r3 = Math.hypot(200, 82);
  polyline(circlePts(250, 62, r3, Math.atan2(82, 200), Math.atan2(82, -200), 72));
  // center-circle half at the far end
  polyline(circlePts(250, 460, 60, Math.PI, Math.PI * 2, 40));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  return geo;
}

// Flight path of one shot: quadratic arc from its real floor spot to the rim.
function arcCurve(s: S): THREE.QuadraticBezierCurve3 {
  const [x, z] = toWorld(s.x, s.y);
  const apex = RIM_Y + 1.0 + Math.min(s.d, 32) * 0.055;
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(x, 0.03, z),
    new THREE.Vector3(x * 0.46, apex, z * 0.46),
    new THREE.Vector3(0, RIM_Y, 0),
  );
}

function Scene() {
  const rig = useRef<THREE.Group>(null);
  const comet = useRef<THREE.Mesh>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const courtGeo = useMemo(buildCourtLines, []);

  // Made / missed floor dots as two instanced meshes.
  const { makesMesh, missesMesh } = useMemo(() => {
    const dot = new THREE.SphereGeometry(0.05, 10, 10);
    const dummy = new THREE.Object3D();
    const build = (list: S[], color: string, opacity: number) => {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
      const mesh = new THREE.InstancedMesh(dot, mat, list.length);
      list.forEach((s, i) => {
        const [x, z] = toWorld(s.x, s.y);
        dummy.position.set(x, 0.03, z);
        const sc = s.v === 3 ? 1.25 : 1;
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      return mesh;
    };
    return {
      makesMesh: build(SHOTS.filter((s) => s.m === 1), EMBER, 0.9),
      missesMesh: build(SHOTS.filter((s) => s.m === 0), STEEL, 0.28),
    };
  }, []);

  // Arc trails for made threes — the sculpture's signature shape.
  const { arcsGroup, curves } = useMemo(() => {
    const featured = SHOTS.filter((s) => s.m === 1 && s.v === 3).slice(0, 54);
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: EMBER, transparent: true, opacity: 0.16 });
    const cs: THREE.QuadraticBezierCurve3[] = [];
    for (const s of featured) {
      const curve = arcCurve(s);
      cs.push(curve);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
      group.add(new THREE.Line(geo, mat));
    }
    return { arcsGroup: group, curves: cs };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (rig.current) {
      // slow orbital drift + pointer parallax
      rig.current.rotation.y = Math.sin(t * 0.07) * 0.14 + pointer.current.x * 0.07;
      rig.current.rotation.x = pointer.current.y * 0.035;
    }
    if (comet.current && curves.length) {
      // one live ball travels arc after arc, forever
      const period = 3.2;
      const idx = Math.floor(t / period) % curves.length;
      const u = (t % period) / period;
      const p = curves[idx].getPoint(u);
      comet.current.position.copy(p);
      const pulse = u > 0.94 ? 1 + (u - 0.94) * 16 : 1; // splash at the rim
      comet.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={rig} position={[0, -0.7, 0]}>
      <group position={[0, 0, -4.6]}>
        <lineSegments geometry={courtGeo}>
          <lineBasicMaterial color={HAIR} transparent opacity={0.8} />
        </lineSegments>
        <primitive object={makesMesh} />
        <primitive object={missesMesh} />
        <primitive object={arcsGroup} />
        {/* rim — flat ring at 10ft, faint drop-line to the floor */}
        <mesh position={[0, RIM_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.21, 0.02, 8, 32]} />
          <meshBasicMaterial color={EMBER} />
        </mesh>
        <mesh position={[0, RIM_Y / 2, 0]}>
          <cylinderGeometry args={[0.006, 0.006, RIM_Y, 6]} />
          <meshBasicMaterial color={STEEL} transparent opacity={0.3} />
        </mesh>
        {/* the live ball */}
        <mesh ref={comet}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshBasicMaterial color={EMBER} />
        </mesh>
      </group>
    </group>
  );
}

// ---- Wrapper: visibility-aware, reduced-motion-safe -----------------------
export default function Hero3D({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener("change", onMq);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 });
    if (wrap.current) io.observe(wrap.current);
    return () => {
      mq.removeEventListener("change", onMq);
      io.disconnect();
    };
  }, []);

  // Reduced motion → render a single still frame; off-screen → stop entirely.
  const frameloop = reduced ? "demand" : inView ? "always" : "never";

  return (
    <div ref={wrap} className={className} aria-hidden>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.75]}
        camera={{ position: [7.6, 4.2, 11.8], fov: 36 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        style={{ pointerEvents: "none" }}
      >
        <fog attach="fog" args={["#0a0d12", 11, 30]} />
        <Scene />
      </Canvas>
    </div>
  );
}
