"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { gsap } from "gsap";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  ARCHIVE_ACCENTS,
  type ArchivePull,
  type HeroBounds,
} from "@/lib/archive-types";

type ArchiveSceneProps = {
  pull: ArchivePull | null;
  heroBounds: HeroBounds | null;
  reducedMotion: boolean;
  paused: boolean;
  onReveal: (serial: number) => void;
  onReady: () => void;
  onError: () => void;
};

type Slot = { x: number; y: number; seed: number; tint: THREE.Color };
type Pose = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  sx: number;
  sy: number;
  sz: number;
};
type Motion = {
  intro: number;
  focus: number;
  ripple: number;
  rippleX: number;
  rippleY: number;
  label: number;
  visible: boolean;
  slot: number;
  nextSlot: number;
  settled: boolean;
  serial: number;
  pose: Pose;
  origin: Pose | null;
};

const PEARL = new THREE.Color("#e1dce6");
const scratch = new THREE.Object3D();
const paint = new THREE.Color();
const TWO_PI = Math.PI * 2;

function seeded(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function roundedPlane(width: number, height: number, radius: number) {
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
  const geometry = new THREE.ShapeGeometry(shape, 12);
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    uvs.setXY(
      i,
      positions.getX(i) / width + 0.5,
      positions.getY(i) / height + 0.5,
    );
  }
  return geometry;
}

function labelTexture(pull: ArchivePull, serifReady: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 744;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const paper = ctx.createLinearGradient(0, 0, 1200, 744);
  paper.addColorStop(0, "#fffdf6");
  paper.addColorStop(0.65, "#f8f4eb");
  paper.addColorStop(1, "#eee9e4");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1536, 744);

  // A faint double-reel watermark is part of the label, never invented film art.
  ctx.strokeStyle = "rgba(93, 71, 109, 0.11)";
  ctx.lineWidth = 3;
  for (let ring = 0; ring < 7; ring++) {
    for (const x of [1110, 1535]) {
      ctx.beginPath();
      ctx.arc(x, 360, 96 + ring * 29, 0, TWO_PI);
      ctx.stroke();
    }
  }
  ctx.fillStyle = pull.accent;
  ctx.fillRect(0, 0, 22, 744);
  ctx.fillStyle = "#30273a";
  ctx.font = "500 25px Arial, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("REEL ROULETTE", 76, 75);
  ctx.textAlign = "right";
  ctx.font = "500 20px monospace";
  ctx.letterSpacing = "2px";
  ctx.fillText("SIDE A / TONIGHT", 1460, 75);
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "rgba(48, 39, 58, 0.24)";
  ctx.fillRect(76, 109, 1384, 1.5);

  let fontSize = 310;
  let lines: string[] = [];
  const titleFamily = serifReady
    ? '"Instrument Serif", Georgia, serif'
    : "Georgia, serif";
  ctx.letterSpacing = "-3px";
  do {
    ctx.font = `400 ${fontSize}px ${titleFamily}`;
    lines = [];
    let line = "";
    for (const word of pull.movie.title.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > 1370 && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    if (
      lines.length <= 2 &&
      lines.length * fontSize * 0.94 <= 435 &&
      lines.every((text) => ctx.measureText(text).width <= 1380)
    )
      break;
    fontSize -= 6;
  } while (fontSize > 28);
  if (lines.length > 2) {
    lines = [lines[0], lines.slice(1).join(" ")];
    while (ctx.measureText(`${lines[1]}…`).width > 1380 && lines[1].length > 1)
      lines[1] = lines[1].slice(0, -1);
    lines[1] = `${lines[1].trimEnd()}…`;
  }
  const lineHeight = fontSize * 0.94;
  const blockHeight = lines.length * lineHeight;
  const top = 151 + Math.max(0, (438 - blockHeight) / 2);
  ctx.fillStyle = "#281f31";
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) =>
    ctx.fillText(line, 68, top + fontSize * 0.79 + i * lineHeight, 1390),
  );
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "rgba(48, 39, 58, 0.24)";
  ctx.fillRect(76, 620, 1384, 1.5);
  ctx.fillStyle = "#4a4055";
  ctx.font = "500 25px monospace";
  ctx.letterSpacing = "2px";
  ctx.fillText(
    pull.movie.year ? String(pull.movie.year) : "A CHANCE ENCOUNTER",
    76,
    690,
  );
  ctx.textAlign = "right";
  ctx.font = "500 21px monospace";
  ctx.fillText(`RR—${String(pull.serial).padStart(4, "0")}`, 1295, 690);
  ctx.fillStyle = "#473950";
  for (let i = 0; i < 30; i++) {
    const barWidth = i % 3 === 0 ? 4 : 2;
    ctx.fillRect(1330 + i * 4.2, 653, barWidth, 42);
  }
  const portrait = document.createElement("canvas");
  portrait.width = 1000;
  portrait.height = 1500;
  const portraitContext = portrait.getContext("2d")!;
  portraitContext.fillStyle = "#f3eee5";
  portraitContext.fillRect(0, 0, 1000, 1500);
  portraitContext.strokeStyle = pull.accent;
  portraitContext.lineWidth = 32;
  portraitContext.beginPath();
  portraitContext.arc(500, 290, 180, 0, TWO_PI);
  portraitContext.stroke();
  portraitContext.drawImage(canvas, 0, 600, 1000, 484);
  portraitContext.fillStyle = "#827587";
  portraitContext.font = "20px monospace";
  portraitContext.textAlign = "center";
  portraitContext.fillText("THE LIVING ARCHIVE", 500, 1370);
  const texture = new THREE.CanvasTexture(portrait);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function Studio() {
  return (
    <>
      <ambientLight intensity={0.6} color="#f4eaf1" />
      <directionalLight
        position={[-400, 600, 800]}
        intensity={3.1}
        color="#fff7e9"
      />
      <directionalLight
        position={[500, -200, 350]}
        intensity={0.8}
        color="#c1bcff"
      />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={6}
          color="#fff9f0"
          position={[-4, 5, 7]}
          rotation={[0, 0.3, -0.45]}
          scale={[5, 8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3.6}
          color="#e3dcff"
          position={[5, 1, 5]}
          rotation={[0, -0.5, -0.4]}
          scale={[1.5, 10, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#fbc4b2"
          position={[-5, -3, 2]}
          rotation={[0, 0.8, 0.1]}
          scale={[3, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color="#edffff"
          position={[1, 7, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[10, 3, 1]}
        />
      </Environment>
    </>
  );
}

function SceneContent(props: ArchiveSceneProps) {
  const { pull, heroBounds, reducedMotion, paused } = props;
  const { size, gl, invalidate, setDpr } = useThree();
  const callbacks = useRef(props);
  const boundsRef = useRef(heroBounds);
  const pullRef = useRef(pull);
  const ready = useRef(false);
  const elapsed = useRef(0);
  const pointer = useRef(new THREE.Vector2(10000, 10000));
  const smoothPointer = useRef(new THREE.Vector2(10000, 10000));
  const selectedColor = useRef(new THREE.Color(ARCHIVE_ACCENTS[0]));
  const tiles = useRef<THREE.InstancedMesh>(null);
  const wells = useRef<THREE.InstancedMesh>(null);
  const hero = useRef<THREE.Group>(null);
  const heroMaterial = useRef<THREE.MeshPhysicalMaterial>(null);
  const labelMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const labelRimMaterial = useRef<THREE.MeshPhysicalMaterial>(null);
  const shadowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const [displayed, setDisplayed] = useState<ArchivePull | null>(null);
  const [serifReady, setSerifReady] = useState(false);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const motion = useRef<Motion>({
    intro: 0,
    focus: 0,
    ripple: 0,
    rippleX: 0,
    rippleY: 0,
    label: 0,
    visible: false,
    slot: -1,
    nextSlot: -1,
    settled: false,
    serial: -1,
    origin: null,
    pose: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
  });

  const layout = useMemo(() => {
    const tileWidth = size.width < 620 ? 67 : size.width < 1000 ? 88 : 108;
    const tileHeight = tileWidth * 1.66;
    const gap = size.width < 620 ? 6 : 8;
    const columns = Math.ceil(size.width / (tileWidth + gap)) + 2;
    const rows = Math.ceil(size.height / (tileHeight + gap)) + 3;
    const slots: Slot[] = [];
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const seed = column * 313 + row * 79;
        slots.push({
          x: (column - (columns - 1) / 2) * (tileWidth + gap),
          y:
            (row - (rows - 1) / 2) * (tileHeight + gap) +
            ((column % 2) * (tileHeight + gap)) / 2,
          seed: seeded(seed),
          tint: new THREE.Color(
            ARCHIVE_ACCENTS[
              Math.floor(seeded(seed + 17) * ARCHIVE_ACCENTS.length)
            ],
          ),
        });
      }
    }
    return { slots, tileWidth, tileHeight, depth: tileWidth * 0.4 };
  }, [size.width, size.height]);
  const layoutRef = useRef(layout);
  const sizeRef = useRef(size);

  const geometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        layout.tileWidth,
        layout.tileHeight,
        layout.depth,
        3,
        layout.tileWidth * 0.16,
      ),
    [layout],
  );
  const heroGeometry = useMemo(
    () => new RoundedBoxGeometry(1, 1.5, 0.14, 5, 0.065),
    [],
  );
  const panelGeometry = useMemo(() => roundedPlane(0.94, 1.41, 0.045), []);
  const rimGeometry = useMemo(() => roundedPlane(0.962, 1.432, 0.052), []);
  const texture = useMemo(
    () => (displayed ? labelTexture(displayed, serifReady) : null),
    [displayed, serifReady],
  );
  const [posterTexture, setPosterTexture] = useState<{ url: string; texture: THREE.Texture } | null>(null);
  const posterUrl = pull?.serial === displayed?.serial ? pull?.movie.posterUrl : displayed?.movie.posterUrl;
  useEffect(() => {
    let active = true;
    let loaded: THREE.Texture | undefined;
    if (posterUrl) new THREE.TextureLoader().load(posterUrl, next => {
      if (!active) { next.dispose(); return; }
      loaded = next;
      next.colorSpace = THREE.SRGBColorSpace;
      next.anisotropy = 4;
      setPosterTexture({ url: posterUrl, texture: next });
      invalidate();
    }, undefined, () => { /* The printed fallback remains usable. */ });
    return () => { active = false; loaded?.dispose(); };
  }, [posterUrl, invalidate]);
  const faceTexture = posterTexture && posterTexture.url === posterUrl ? posterTexture.texture : texture;
  const uniforms = useRef({
    uArchiveTime: { value: 0 },
    uArchiveIntro: { value: 0 },
    uArchiveHeight: { value: 900 },
    uArchivePointer: { value: new THREE.Vector2(10000, 10000) },
  });
  const tileMaterial = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: "white",
      roughness: 0.23,
      metalness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.085,
      envMapIntensity: 1.05,
      iridescence: 0.13,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [100, 290],
    });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms.current);
      shader.vertexShader =
        `varying vec3 vArchiveWorld;\n${shader.vertexShader}`.replace(
          "#include <project_vertex>",
          `#include <project_vertex>\nvec4 archivePosition = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\narchivePosition = instanceMatrix * archivePosition;\n#endif\nvArchiveWorld = (modelMatrix * archivePosition).xyz;`,
        );
      shader.fragmentShader =
        `varying vec3 vArchiveWorld;\nuniform float uArchiveTime;\nuniform float uArchiveIntro;\nuniform float uArchiveHeight;\nuniform vec2 uArchivePointer;\n${shader.fragmentShader}`
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
          float archiveBand = exp(-pow((vArchiveWorld.y - (uArchiveIntro * 1.65 - 0.72) * uArchiveHeight) / 68.0, 2.0));
          float archiveTouch = exp(-distance(vArchiveWorld.xy, uArchivePointer) / 160.0);
          float archiveSheen = sin(vArchiveWorld.x * 0.008 + vArchiveWorld.y * 0.005 + uArchiveTime * 0.18) * 0.5 + 0.5;
          diffuseColor.rgb += vec3(0.12, 0.15, 0.2) * archiveBand * (1.0 - step(0.99, uArchiveIntro));
          diffuseColor.rgb += vec3(0.03, 0.022, 0.045) * archiveSheen + vec3(0.045, 0.028, 0.06) * archiveTouch;
        `,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>\nroughnessFactor = max(0.11, roughnessFactor - archiveBand * 0.12 * (1.0 - step(0.99, uArchiveIntro)) - archiveTouch * 0.09);`,
          )
          .replace(
            "#include <opaque_fragment>",
            `
          float archiveEmergence = smoothstep(0.0, 0.75, uArchiveIntro * 1.65 - clamp((vArchiveWorld.y + uArchiveHeight * 0.5) / uArchiveHeight, 0.0, 1.0) * 0.48);
          outgoingLight *= pow(archiveEmergence, 1.3);
          #include <opaque_fragment>
        `,
          );
    };
    material.customProgramCacheKey = () => "archive-resin-v1";
    return material;
  }, [uniforms]);

  useEffect(() => {
    callbacks.current = props;
    boundsRef.current = heroBounds;
    pullRef.current = pull;
    layoutRef.current = layout;
    sizeRef.current = size;
    invalidate();
  }, [props, heroBounds, pull, layout, size, invalidate]);

  useEffect(() => {
    setDpr(
      Math.min(window.devicePixelRatio || 1, size.width < 700 ? 1.2 : 1.5),
    );
  }, [size.width, setDpr]);

  useEffect(() => {
    let active = true;
    document.fonts
      .load('400 220px "Instrument Serif"')
      .then(() => {
        if (active) setSerifReady(true);
      })
      .catch(() => {
        /* Georgia remains a readable local fallback. */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const contextLost = (event: Event) => {
      event.preventDefault();
      callbacks.current.onError();
    };
    const move = (event: PointerEvent) =>
      pointer.current.set(
        event.clientX - sizeRef.current.width / 2,
        sizeRef.current.height / 2 - event.clientY,
      );
    const leave = () => pointer.current.set(10000, 10000);
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", contextLost);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      canvas.removeEventListener("webglcontextlost", contextLost);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  useEffect(() => {
    const intro = gsap.to(motion.current, {
      intro: 1,
      duration: reducedMotion ? 0.05 : 2.15,
      ease: "power2.inOut",
      onUpdate: invalidate,
    });
    return () => {
      intro.kill();
    };
  }, [reducedMotion, invalidate]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );
  useEffect(() => {
    const material = labelMaterial.current;
    if (!material) return;
    // A canvas map is attached after the first material render. Three requires
    // an explicit program refresh when USE_MAP changes; re-uploading also
    // restores the canvas texture after a renderer resize or hot refresh.
    material.map = faceTexture;
    if (material.map) material.map.needsUpdate = true;
    material.needsUpdate = true;
    invalidate();
  }, [faceTexture, size.width, size.height, invalidate]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useEffect(
    () => () => {
      heroGeometry.dispose();
      panelGeometry.dispose();
      rimGeometry.dispose();
      tileMaterial.dispose();
    },
    [heroGeometry, panelGeometry, rimGeometry, tileMaterial],
  );

  useEffect(() => {
    if (!wells.current) return;
    tiles.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    layout.slots.forEach((slot, index) => {
      scratch.position.set(slot.x, slot.y, -layout.depth * 0.72);
      scratch.rotation.set(0, 0, 0);
      scratch.scale.set(1.015, 1.01, 0.45);
      scratch.updateMatrix();
      wells.current!.setMatrixAt(index, scratch.matrix);
    });
    wells.current.instanceMatrix.needsUpdate = true;
    const m = motion.current;
    if (m.visible && m.origin) {
      const originX = THREE.MathUtils.clamp(
        m.origin.x,
        -size.width * 0.4,
        size.width * 0.4,
      );
      const originY = THREE.MathUtils.clamp(
        m.origin.y,
        -size.height * 0.35,
        size.height * 0.35,
      );
      let nearest = 0;
      let distance = Infinity;
      layout.slots.forEach((slot, index) => {
        const candidateDistance = Math.hypot(
          slot.x - originX,
          slot.y - originY,
        );
        if (candidateDistance < distance) {
          nearest = index;
          distance = candidateDistance;
        }
      });
      m.slot = nearest;
      m.nextSlot = nearest;
      m.origin.x = layout.slots[nearest].x;
      m.origin.y = layout.slots[nearest].y;
      m.origin.sx = layout.tileWidth;
      m.origin.sy = layout.tileHeight / 1.5;
      m.origin.sz = layout.depth / 0.14;
    }
  }, [layout, size.width, size.height]);

  useEffect(() => {
    timeline.current?.kill();
    const pull = pullRef.current;
    const m = motion.current;
    if (!pull) {
      m.visible = false;
      m.slot = -1;
      m.nextSlot = -1;
      m.serial = -1;
      m.settled = false;
      const reset = gsap.to(m, {
        focus: 0,
        ripple: 0,
        duration: reducedMotion ? 0 : 0.55,
        onUpdate: invalidate,
      });
      invalidate();
      return () => {
        reset.kill();
      };
    }
    const currentLayout = layoutRef.current;
    const currentSize = sizeRef.current;
    const eligible = currentLayout.slots
      .map((slot, index) => ({ ...slot, index }))
      .filter(
        (slot) =>
          Math.abs(slot.x) < currentSize.width * 0.36 &&
          Math.abs(slot.y) < currentSize.height * 0.29,
      );
    const pool = eligible.length
      ? eligible
      : currentLayout.slots.map((slot, index) => ({ ...slot, index }));
    const random =
      pull.slotSeed >= 0 && pull.slotSeed < 1
        ? pull.slotSeed
        : seeded(pull.slotSeed);
    let candidate =
      pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
    if (candidate.index === m.slot && pool.length > 1)
      candidate = pool[(pool.indexOf(candidate) + 1) % pool.length];
    const origin: Pose = {
      x: candidate.x,
      y: candidate.y,
      z: currentLayout.depth * 0.04,
      rx: 0,
      ry: 0,
      rz: 0,
      sx: currentLayout.tileWidth,
      sy: currentLayout.tileHeight / 1.5,
      sz: currentLayout.depth / 0.14,
    };
    const getTarget = (): Pose => {
      const bounds = boundsRef.current;
      const viewport = sizeRef.current;
      const width = bounds?.width ?? Math.min(440, viewport.width * 0.76);
      const height = bounds?.height ?? width * 1.5;
      return {
        x: bounds ? bounds.x + bounds.width / 2 - viewport.width / 2 : 0,
        y: bounds ? viewport.height / 2 - bounds.y - bounds.height / 2 : 0,
        z: 135,
        rx: -0.035,
        ry: -0.16,
        rz: -0.055,
        sx: width,
        sy: height / 1.5,
        sz: width,
      };
    };
    const hadHero = m.visible;
    m.settled = false;
    m.serial = pull.serial;
    m.rippleX = candidate.x;
    m.rippleY = candidate.y;
    m.ripple = 0;
    m.nextSlot = candidate.index;
    selectedColor.current.set(pull.accent);
    const sequence = gsap.timeline({ onUpdate: invalidate });
    timeline.current = sequence;
    if (reducedMotion) {
      sequence.call(() => {
        setDisplayed(pull);
        Object.assign(m.pose, getTarget());
        m.slot = candidate.index;
        m.origin = origin;
        m.visible = true;
        m.label = 1;
        m.focus = 1;
        m.settled = true;
        invalidate();
      });
      sequence.call(
        () => {
          if (pullRef.current?.serial === pull.serial)
            callbacks.current.onReveal(pull.serial);
        },
        [],
        0.06,
      );
      return () => {
        sequence.kill();
      };
    }

    const launch = hadHero ? 0.43 : 0.35;
    if (hadHero && m.origin) {
      sequence.to(m, { label: 0, duration: 0.16, ease: "power2.in" }, 0);
      sequence.to(
        m.pose,
        { ...m.origin, z: -5, duration: 0.42, ease: "power3.in" },
        0,
      );
    }
    sequence.to(
      m,
      { ripple: 1, duration: hadHero ? 1.22 : 1.45, ease: "none" },
      0.06,
    );
    sequence.to(m, { focus: 0.6, duration: 0.3, ease: "power2.out" }, 0);
    sequence.call(
      () => {
        setDisplayed(pull);
        Object.assign(m.pose, origin);
        m.pose.z = -6;
        m.visible = true;
        m.slot = candidate.index;
        m.origin = origin;
        m.label = 0;
      },
      [],
      launch,
    );
    sequence.to(m.pose, { z: 105, duration: 0.46, ease: "power3.out" }, launch);
    sequence.to(
      m.pose,
      {
        x: () => getTarget().x,
        y: () => getTarget().y,
        sx: () => getTarget().sx,
        sy: () => getTarget().sy,
        sz: () => getTarget().sz,
        rx: -0.13,
        ry: 0.16,
        rz: -0.09,
        duration: hadHero ? 0.76 : 0.94,
        ease: "back.out(1.08)",
      },
      launch + 0.08,
    );
    sequence.to(
      m.pose,
      {
        z: 135,
        rx: -0.035,
        ry: -0.16,
        rz: -0.055,
        duration: 0.42,
        ease: "power2.out",
      },
      launch + (hadHero ? 0.62 : 0.8),
    );
    sequence.to(
      m,
      { label: 1, duration: 0.28, ease: "power2.out" },
      launch + 0.48,
    );
    sequence.to(
      m,
      { focus: 1, duration: 0.65, ease: "power2.inOut" },
      launch + 0.2,
    );
    sequence.call(
      () => {
        m.settled = true;
        if (pullRef.current?.serial === pull.serial)
          callbacks.current.onReveal(pull.serial);
      },
      [],
      launch + (hadHero ? 1.05 : 1.25),
    );
    return () => {
      sequence.kill();
    };
  }, [pull?.serial, reducedMotion, invalidate]);

  useFrame((_, delta) => {
    if (!tiles.current) return;
    const m = motion.current;
    if (!paused && !reducedMotion && m.intro > 0.995)
      elapsed.current += Math.min(delta, 0.05);
    const time = elapsed.current;
    uniforms.current.uArchiveTime.value = time;
    uniforms.current.uArchiveIntro.value = m.intro;
    uniforms.current.uArchiveHeight.value = size.height;
    if (!paused && !reducedMotion)
      smoothPointer.current.lerp(pointer.current, 0.065);
    uniforms.current.uArchivePointer.value.copy(
      reducedMotion ? pointer.current.set(10000, 10000) : smoothPointer.current,
    );
    for (let index = 0; index < layout.slots.length; index++) {
      const slot = layout.slots[index];
      const yUnit = THREE.MathUtils.clamp(
        (slot.y + size.height / 2) / size.height,
        0,
        1,
      );
      const surfacing = THREE.MathUtils.smoothstep(
        m.intro * 1.65 - yUnit * 0.48,
        0,
        1,
      );
      const pulse = reducedMotion
        ? 0
        : Math.pow(Math.max(0, Math.sin(time * 0.36 + slot.seed * 40)), 20);
      const bloom = slot.seed > 0.86 ? 0.48 + pulse * 0.31 : pulse * 0.1;
      const distance = Math.hypot(slot.x - m.rippleX, slot.y - m.rippleY);
      const radius = (1 - m.ripple) * Math.max(size.width, size.height) * 0.7;
      const ring =
        m.ripple > 0 && m.ripple < 1
          ? Math.exp(-Math.pow((distance - radius) / 65, 2)) *
            Math.sin(m.ripple * Math.PI)
          : 0;
      const nearSocket = m.visible ? Math.exp(-distance / 160) : 0;
      scratch.position.set(
        slot.x,
        slot.y,
        (surfacing - 1) * 65 + pulse * 3.8 + ring * 9 - nearSocket * 3.5,
      );
      scratch.rotation.set((1 - surfacing) * 0.2, pulse * 0.018, 0);
      const hidden = m.visible && index === m.slot;
      scratch.scale.set(
        hidden ? 0 : 1,
        hidden ? 0 : 1,
        Math.max(0.1, surfacing),
      );
      scratch.updateMatrix();
      tiles.current.setMatrixAt(index, scratch.matrix);
      paint.copy(PEARL).lerp(slot.tint, bloom + ring * 0.2);
      if (index === m.nextSlot)
        paint.lerp(selectedColor.current, Math.min(1, m.ripple * 5));
      paint.multiplyScalar((0.025 + surfacing * 0.975) * (1 - m.focus * 0.61));
      tiles.current.setColorAt(index, paint);
    }
    tiles.current.instanceMatrix.needsUpdate = true;
    if (tiles.current.instanceColor)
      tiles.current.instanceColor.needsUpdate = true;

    if (hero.current) {
      hero.current.visible = m.visible;
      if (m.settled && boundsRef.current) {
        const bounds = boundsRef.current;
        const follow = reducedMotion || paused ? 1 : 1 - Math.exp(-delta * 16);
        m.pose.x = THREE.MathUtils.lerp(
          m.pose.x,
          bounds.x + bounds.width / 2 - size.width / 2,
          follow,
        );
        m.pose.y = THREE.MathUtils.lerp(
          m.pose.y,
          size.height / 2 - bounds.y - bounds.height / 2,
          follow,
        );
        m.pose.sx = THREE.MathUtils.lerp(m.pose.sx, bounds.width, follow);
        m.pose.sy = THREE.MathUtils.lerp(m.pose.sy, bounds.height / 1.5, follow);
        m.pose.sz = THREE.MathUtils.lerp(m.pose.sz, bounds.width, follow);
      }
      const drift = m.settled && !reducedMotion ? Math.sin(time * 0.7) : 0;
      hero.current.position.set(m.pose.x, m.pose.y + drift * 1.6, m.pose.z);
      hero.current.rotation.set(
        m.pose.rx + drift * 0.003,
        m.pose.ry + drift * 0.004,
        m.pose.rz,
      );
      hero.current.scale.set(m.pose.sx, m.pose.sy, m.pose.sz);
    }
    if (heroMaterial.current && displayed)
      heroMaterial.current.color.set(displayed.accent);
    if (labelMaterial.current) labelMaterial.current.opacity = m.label;
    if (labelRimMaterial.current)
      labelRimMaterial.current.opacity = m.label * 0.55;
    if (shadowMaterial.current) shadowMaterial.current.opacity = m.label * 0.17;
    if (!ready.current) {
      ready.current = true;
      callbacks.current.onReady();
    }
  });

  return (
    <>
      <color attach="background" args={["#100d17"]} />
      <Studio />
      <mesh position={[0, 0, -70]}>
        <planeGeometry args={[size.width + 600, size.height + 600]} />
        <meshStandardMaterial color="#100c19" roughness={0.85} />
      </mesh>
      <instancedMesh
        key={`wells-${layout.slots.length}-${layout.tileWidth}`}
        ref={wells}
        args={[geometry, undefined, layout.slots.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#17121f"
          roughness={0.48}
          metalness={0.08}
        />
      </instancedMesh>
      <instancedMesh
        key={`tiles-${layout.slots.length}-${layout.tileWidth}`}
        ref={tiles}
        args={[geometry, tileMaterial, layout.slots.length]}
        frustumCulled={false}
      />
      <group ref={hero} visible={false}>
        <mesh
          geometry={heroGeometry}
          position={[0.025, -0.025, -0.14]}
          scale={[1.055, 1.06, 0.4]}
        >
          <meshBasicMaterial
            ref={shadowMaterial}
            color="#08050e"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
        <mesh geometry={heroGeometry}>
          <meshPhysicalMaterial
            ref={heroMaterial}
            color="#b9a1f2"
            roughness={0.22}
            metalness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.09}
            envMapIntensity={1}
            iridescence={0.15}
            iridescenceThicknessRange={[120, 300]}
          />
        </mesh>
        <mesh geometry={rimGeometry} position={[0, 0, 0.071]}>
          <meshPhysicalMaterial
            ref={labelRimMaterial}
            color="#52415f"
            transparent
            opacity={0}
            roughness={0.35}
            depthWrite={false}
          />
        </mesh>
        <mesh geometry={panelGeometry} position={[0, 0, 0.075]}>
          <meshBasicMaterial
            key={faceTexture?.uuid ?? "unprinted-label"}
            ref={labelMaterial}
            map={faceTexture}
            color="#ffffff"
            toneMapped={false}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}

class SceneBoundary extends Component<
  { children: React.ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function ArchiveScene(props: ArchiveSceneProps) {
  return (
    <SceneBoundary onError={props.onError}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1000], zoom: 1, near: 0.1, far: 2000 }}
        dpr={[1, 1.5]}
        frameloop={props.paused || props.reducedMotion ? "demand" : "always"}
        gl={{
          alpha: false,
          antialias: true,
          powerPreference: "high-performance",
        }}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        fallback={
          <span>Your browser does not support the animated archive.</span>
        }
      >
        <Suspense fallback={null}>
          <SceneContent {...props} />
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}
