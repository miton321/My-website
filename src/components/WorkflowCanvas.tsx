import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface WorkflowCanvasProps {
  scrollProgressRef: React.MutableRefObject<number>;
  theme: 'light' | 'dark';
  accentColor: string;
  scrollVideoUrl?: string;
}

const _camTargetPos = new THREE.Vector3();
const _lookAtTarget = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0, 0);
const _tempVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function WorkflowCanvas({
  scrollProgressRef,
  theme,
  accentColor,
  scrollVideoUrl,
}: WorkflowCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const themeRef = useRef(theme);
  const accentRef = useRef(accentColor);
  const [useStaticFallback, setUseStaticFallback] = useState(false);
  const [videoError, setVideoError] = useState(false);

  themeRef.current = theme;
  accentRef.current = accentColor;

  const hasVideo = Boolean(scrollVideoUrl && scrollVideoUrl.trim().length > 0 && !videoError);

  useEffect(() => {
    setVideoError(false);
  }, [scrollVideoUrl]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrowMobile = window.innerWidth < 640;
    if (reduced || narrowMobile) {
      setUseStaticFallback(true);
      return;
    }
    setUseStaticFallback(false);
  }, []);

  // Scroll-scrubbed background video loop when admin configured a video
  useEffect(() => {
    if (!hasVideo || useStaticFallback) return;
    const video = videoRef.current;
    if (!video) return;

    let rafId = 0;
    let smoothedTime = 0;

    const scrub = () => {
      if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
        const targetTime = THREE.MathUtils.clamp(scrollProgressRef.current, 0, 1) * video.duration;
        smoothedTime += (targetTime - smoothedTime) * 0.14;
        if (Math.abs(video.currentTime - smoothedTime) > 0.016) {
          video.currentTime = smoothedTime;
        }
      }
      rafId = requestAnimationFrame(scrub);
    };

    rafId = requestAnimationFrame(scrub);
    return () => cancelAnimationFrame(rafId);
  }, [hasVideo, useStaticFallback, scrollProgressRef]);

  // Three.js procedural workflow architecture scene
  useEffect(() => {
    if (hasVideo || useStaticFallback) return;
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setUseStaticFallback(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    let envTex: THREE.Texture | null = null;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmremGenerator.dispose();
    } catch {
      envTex = null;
    }

    const initialBg = themeRef.current === 'dark' ? 0x0b0b0d : 0xf8f8f6;
    scene.fog = new THREE.FogExp2(initialBg, 0.032);

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      80,
    );
    camera.position.set(4.5, 2.8, 10.5);

    // 3-point studio lighting with warm/cool contrast
    const keyLight = new THREE.DirectionalLight(0xfff4e8, 1.8);
    keyLight.position.set(8, 12, 9);
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0xdce6f2, 0x2a2926, 0.85);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0xe04f26, 0.9);
    rimLight.position.set(-9, 4, -8);
    scene.add(rimLight);

    // Architectural materials
    const nodeBodyMat = new THREE.MeshStandardMaterial({
      color: themeRef.current === 'dark' ? 0x1e2026 : 0x26282e,
      metalness: 0.72,
      roughness: 0.28,
    });
    const nodeCapMat = new THREE.MeshStandardMaterial({
      color: themeRef.current === 'dark' ? 0xe7e5de : 0xffffff,
      metalness: 0.15,
      roughness: 0.62,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentRef.current),
      metalness: 0.35,
      roughness: 0.32,
      emissive: new THREE.Color(accentRef.current),
      emissiveIntensity: 0.22,
    });
    const conduitMat = new THREE.MeshStandardMaterial({
      color: themeRef.current === 'dark' ? 0x565963 : 0x8f929b,
      metalness: 0.75,
      roughness: 0.35,
    });
    const pulseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentRef.current),
      metalness: 0.2,
      roughness: 0.25,
      emissive: new THREE.Color(accentRef.current),
      emissiveIntensity: 0.55,
    });

    // Shared geometries for composite workflow nodes (3 distinct parts per node)
    const baseGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.22, 8);
    const collarGeo = new THREE.TorusGeometry(0.36, 0.035, 10, 24);
    collarGeo.rotateX(Math.PI / 2);
    const capGeo = new THREE.CylinderGeometry(0.28, 0.36, 0.12, 8);

    // Hero constellation coordinates vs Lane coordinates for scroll morphing
    const nodeDefinitions = [
      { hero: new THREE.Vector3(-3.8, 1.4, -0.5), lane: new THREE.Vector3(-4.2, 2.0, 0.2), scale: 1.05 },
      { hero: new THREE.Vector3(-1.8, 2.2, 1.1), lane: new THREE.Vector3(-1.4, 2.0, -0.6), scale: 0.92 },
      { hero: new THREE.Vector3(-1.5, -0.4, 0.6), lane: new THREE.Vector3(-4.2, 0.0, 0.8), scale: 1.15 },
      { hero: new THREE.Vector3(0.4, 0.9, -0.3), lane: new THREE.Vector3(0.0, 0.0, 0.0), scale: 1.32 },
      { hero: new THREE.Vector3(0.7, -1.6, 1.2), lane: new THREE.Vector3(4.2, 0.0, -0.5), scale: 0.96 },
      { hero: new THREE.Vector3(2.4, 2.1, -1.0), lane: new THREE.Vector3(1.6, 2.0, 0.4), scale: 1.0 },
      { hero: new THREE.Vector3(2.8, -0.2, 0.7), lane: new THREE.Vector3(-2.1, -2.0, 0.3), scale: 1.12 },
      { hero: new THREE.Vector3(4.4, 1.1, 0.1), lane: new THREE.Vector3(1.8, -2.0, 0.7), scale: 0.94 },
      { hero: new THREE.Vector3(4.2, -1.5, -0.9), lane: new THREE.Vector3(4.2, -2.0, -0.2), scale: 1.02 },
    ];

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const nodes: THREE.Group[] = [];
    nodeDefinitions.forEach((def, idx) => {
      const group = new THREE.Group();
      const baseMesh = new THREE.Mesh(baseGeo, nodeBodyMat);
      const collarMesh = new THREE.Mesh(collarGeo, accentMat);
      collarMesh.position.y = 0.11;
      const capMesh = new THREE.Mesh(capGeo, nodeCapMat);
      capMesh.position.y = 0.18;
      group.add(baseMesh, collarMesh, capMesh);
      group.position.copy(def.hero);
      group.scale.setScalar(def.scale);
      group.rotation.set(0.18 * Math.sin(idx), idx * 0.4, 0.08 * Math.cos(idx));
      worldGroup.add(group);
      nodes.push(group);
    });

    // Subtle ground architectural reference grid (low opacity wireframe)
    const gridHelper = new THREE.GridHelper(26, 26, 0x888888, 0x888888);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = themeRef.current === 'dark' ? 0.11 : 0.09;
    gridHelper.position.y = -3.4;
    worldGroup.add(gridHelper);

    // Edge pairs forming a directed workflow graph
    const edgePairs: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
      [2, 4],
      [3, 5],
      [3, 6],
      [4, 6],
      [5, 7],
      [6, 7],
      [6, 8],
      [7, 8],
    ];

    const pulseGeo = new THREE.TorusGeometry(0.085, 0.025, 8, 16);
    interface EdgeData {
      fromIdx: number;
      toIdx: number;
      curve: THREE.CatmullRomCurve3;
      tube: THREE.Mesh;
      pulse: THREE.Mesh;
      speed: number;
      phase: number;
    }
    const edges: EdgeData[] = [];

    const buildCurvePoints = (a: THREE.Vector3, b: THREE.Vector3, idx: number) => {
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      mid.y += (idx % 2 === 0 ? 1 : -1) * 0.35;
      mid.z += (idx % 3 === 0 ? 0.45 : -0.35);
      return [a.clone(), mid, b.clone()];
    };

    edgePairs.forEach(([fromIdx, toIdx], idx) => {
      const pts = buildCurvePoints(nodes[fromIdx].position, nodes[toIdx].position, idx);
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.022, 6, false);
      const tube = new THREE.Mesh(tubeGeo, conduitMat);
      worldGroup.add(tube);

      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      worldGroup.add(pulse);

      edges.push({
        fromIdx,
        toIdx,
        curve,
        tube,
        pulse,
        speed: 0.18 + (idx % 4) * 0.04,
        phase: (idx * 0.19) % 1,
      });
    });

    // Pointer parallax state
    const pointer = { x: 0, y: 0 };
    const dampedPointer = { x: 0, y: 0 };
    const onPointerMove = (e: MouseEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onPointerMove, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setUseStaticFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let lastMorphProgress = -1;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const rebuildTubes = () => {
      edges.forEach((edge, idx) => {
        const a = nodes[edge.fromIdx].position;
        const b = nodes[edge.toIdx].position;
        edge.curve.points[0].copy(a);
        edge.curve.points[1]
          .addVectors(a, b)
          .multiplyScalar(0.5)
          .add(new THREE.Vector3(0, (idx % 2 === 0 ? 1 : -1) * 0.35, idx % 3 === 0 ? 0.45 : -0.35));
        edge.curve.points[2].copy(b);
        const newGeo = new THREE.TubeGeometry(edge.curve, 20, 0.022, 6, false);
        edge.tube.geometry.dispose();
        edge.tube.geometry = newGeo;
      });
    };

    const tick = () => {
      if (disposed) return;
      if (document.hidden) {
        frameId = window.setTimeout(tick, 250);
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      // Sync dynamic theme & accent color cleanly without rebuilding scene
      const isDark = themeRef.current === 'dark';
      const targetBg = isDark ? 0x0b0b0d : 0xf8f8f6;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setHex(targetBg);
      }
      nodeBodyMat.color.setHex(isDark ? 0x22242b : 0x26282e);
      nodeCapMat.color.setHex(isDark ? 0xe7e5de : 0xffffff);
      conduitMat.color.setHex(isDark ? 0x565963 : 0x8f929b);
      (gridHelper.material as THREE.Material).opacity = isDark ? 0.12 : 0.08;

      accentMat.color.set(accentRef.current);
      accentMat.emissive.set(accentRef.current);
      pulseMat.color.set(accentRef.current);
      pulseMat.emissive.set(accentRef.current);
      rimLight.color.set(accentRef.current);

      const p = THREE.MathUtils.clamp(scrollProgressRef.current, 0, 1);

      // Smoothly rearrange nodes between hero constellation and structured pipeline lanes
      const laneBlend = THREE.MathUtils.smoothstep(p, 0.18, 0.62);
      const shouldUpdateTubes = Math.abs(laneBlend - lastMorphProgress) > 0.004;

      nodes.forEach((node, idx) => {
        const def = nodeDefinitions[idx];
        node.position.lerpVectors(def.hero, def.lane, laneBlend);
        node.position.y += Math.sin(elapsed * 0.9 + idx * 0.8) * 0.08;
        node.rotation.y = idx * 0.4 + elapsed * 0.18 + p * 1.6;
      });

      if (shouldUpdateTubes) {
        lastMorphProgress = laneBlend;
        rebuildTubes();
      }

      // Advance directional pulses along workflow tubes
      edges.forEach((edge) => {
        const t = (elapsed * edge.speed + edge.phase) % 1;
        edge.curve.getPointAt(t, _tempVec);
        edge.pulse.position.copy(_tempVec);
        edge.curve.getTangentAt(t, _camTargetPos);
        edge.pulse.lookAt(_tempVec.clone().add(_camTargetPos));
      });

      // Scroll-driven camera choreography across sections
      if (p < 0.3) {
        const local = p / 0.3;
        _camTargetPos.set(
          THREE.MathUtils.lerp(4.4, -1.8, local),
          THREE.MathUtils.lerp(2.6, 1.2, local),
          THREE.MathUtils.lerp(10.6, 8.2, local),
        );
        _lookAtTarget.set(
          THREE.MathUtils.lerp(0.6, 0.0, local),
          THREE.MathUtils.lerp(0.2, 0.0, local),
          0,
        );
      } else if (p < 0.7) {
        const local = (p - 0.3) / 0.4;
        _camTargetPos.set(
          THREE.MathUtils.lerp(-1.8, 2.2, local),
          THREE.MathUtils.lerp(1.2, -0.4, local),
          THREE.MathUtils.lerp(8.2, 9.6, local),
        );
        _lookAtTarget.set(0, THREE.MathUtils.lerp(0.0, -0.3, local), 0);
      } else {
        const local = (p - 0.7) / 0.3;
        _camTargetPos.set(
          THREE.MathUtils.lerp(2.2, 0.0, local),
          THREE.MathUtils.lerp(-0.4, 2.2, local),
          THREE.MathUtils.lerp(9.6, 11.2, local),
        );
        _lookAtTarget.set(0, THREE.MathUtils.lerp(-0.3, -0.8, local), 0);
      }

      // Mouse parallax with exponential damping
      dampedPointer.x = THREE.MathUtils.damp(dampedPointer.x, pointer.x, 4, dt);
      dampedPointer.y = THREE.MathUtils.damp(dampedPointer.y, pointer.y, 4, dt);

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        _camTargetPos.x + dampedPointer.x * 0.55,
        4.5,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        _camTargetPos.y + dampedPointer.y * 0.35,
        4.5,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 4.5, dt);

      _currentLookAt.lerp(_lookAtTarget, 1 - Math.exp(-4.5 * dt));
      camera.lookAt(_currentLookAt);

      worldGroup.rotation.y = THREE.MathUtils.damp(
        worldGroup.rotation.y,
        dampedPointer.x * 0.07 + p * 0.35,
        3.5,
        dt,
      );

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);

      baseGeo.dispose();
      collarGeo.dispose();
      capGeo.dispose();
      pulseGeo.dispose();
      nodeBodyMat.dispose();
      nodeCapMat.dispose();
      accentMat.dispose();
      conduitMat.dispose();
      pulseMat.dispose();
      envTex?.dispose();
      edges.forEach((e) => e.tube.geometry.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [hasVideo, useStaticFallback, scrollProgressRef]);

  // Static architectural schematic fallback for mobile / reduced-motion / WebGL unavailable
  if (useStaticFallback && !hasVideo) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-35 dark:opacity-25"
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 1200 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          <g stroke="currentColor" strokeWidth="1" opacity="0.25">
            <path d="M180 220 C 340 220, 380 380, 560 380" />
            <path d="M560 380 C 720 380, 760 220, 960 220" />
            <path d="M240 540 C 420 540, 440 380, 560 380" />
            <path d="M560 380 C 740 380, 780 560, 980 560" />
          </g>
          <g fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.6">
            <polygon points="180,200 198,210 198,230 180,240 162,230 162,210" />
            <polygon points="560,356 582,368 582,392 560,404 538,392 538,368" />
            <polygon points="960,200 978,210 978,230 960,240 942,230 942,210" />
            <polygon points="240,520 258,530 258,550 240,560 222,550 222,530" />
            <polygon points="980,540 998,550 998,570 980,580 962,570 962,550" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {hasVideo ? (
        <video
          ref={videoRef}
          src={scrollVideoUrl}
          muted
          playsInline
          preload="auto"
          onError={() => setVideoError(true)}
          className="h-full w-full object-cover opacity-30 dark:opacity-35"
        />
      ) : (
        <div
          ref={mountRef}
          className="h-full w-full opacity-75 dark:opacity-80"
        />
      )}
    </div>
  );
}
