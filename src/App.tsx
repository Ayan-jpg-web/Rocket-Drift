import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameHUD, HUDTelemetry } from './components/GameHUD';
import { UE6Preset, Win11TitleBar } from './components/Win11TitleBar';
import { soundEngine } from './game/audio';
import {
  BallRig,
  BoostPadRig,
  buildDFHStadium,
  buildOctaneBattleCar,
  buildRocketBall,
  createSoftShadowTexture,
  OctaneRig,
  PooledParticleSystem,
  updateCarLivery,
} from './game/models';
import {
  ARENA,
  CameraPreset,
  CarLivery,
  computeAIInput,
  createInitialBall,
  createInitialBoostPads,
  createInitialCar,
  GameState,
  getCarSpeedKmh,
  MatchMode,
  resetKickoffPositions,
  stepBallPhysics,
  stepBoostPads,
  stepCarPhysics,
  StepEvents,
} from './game/physics';

// Pre-allocated scratch vectors outside render loop (Zero GC)
const _camTargetPos = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _carForward = new THREE.Vector3();
const _toBall = new THREE.Vector3();

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [gameState, setGameState] = useState<GameState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [matchMode, setMatchMode] = useState<MatchMode>('exhibition_1v1');
  const [livery, setLivery] = useState<CarLivery>('octane_blue');
  const [ue6Preset, setUe6Preset] = useState<UE6Preset>('cinematic');
  const [isWindowedFrame, setIsWindowedFrame] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  const [telemetry, setTelemetry] = useState<HUDTelemetry>({
    blueScore: 0,
    orangeScore: 0,
    secondsRemaining: 300,
    boost: 33,
    ghostBoost: 33,
    speedKmh: 0,
    isSupersonic: false,
    ballCam: true,
    cameraPreset: 'chase',
    aiPolicy: 'striker',
    countdownValue: initialAutostart ? 3 : -1,
    goalBanner: null,
    callouts: [],
    playerStats: {
      goals: 0,
      shots: 0,
      saves: 0,
      boostCollected: 0,
      topSpeedKmh: 0,
    },
  });

  // Mutable simulation state stored in useRef so React HUD updates never recreate the WebGL scene
  const simRef = useRef({
    gameState: (initialAutostart ? 'playing' : 'title') as GameState,
    matchMode: 'exhibition_1v1' as MatchMode,
    livery: 'octane_blue' as CarLivery,
    ue6Preset: 'cinematic' as UE6Preset,
    ballCam: true,
    cameraPreset: 'chase' as CameraPreset,
    blueScore: 0,
    orangeScore: 0,
    secondsRemaining: 300,
    ghostBoost: 33,
    countdownTimer: 0,
    lastCountdownBeep: 4,
    goalResetTimer: 0,
    goalBanner: null as HUDTelemetry['goalBanner'],
    hitstopTimer: 0,
    cameraTrauma: 0,
    titleOrbitAngle: 0.45,
    pointerNormX: 0,
    pointerNormY: 0,
    player: createInitialCar('player', 'blue'),
    ai: createInitialCar('ai', 'orange'),
    ball: createInitialBall(),
    pads: createInitialBoostPads(),
    keysHeld: new Set<string>(),
    jumpJustPressed: false,
    rightMouseBoost: false,
    callouts: [] as { id: number; text: string; color: string; ttl: number }[],
    nextCalloutId: 1,
    playerRig: null as OctaneRig | null,
    aiRig: null as OctaneRig | null,
    renderer: null as THREE.WebGLRenderer | null,
    keyLight: null as THREE.DirectionalLight | null,
    hemiLight: null as THREE.HemisphereLight | null,
    cameraCurrentPos: new THREE.Vector3(0, 6, -42),
    cameraCurrentLook: new THREE.Vector3(0, 2, 0),
  });

  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Sync document.body.dataset.state on every gameState transition
  const applyGameState = useCallback((nextState: GameState) => {
    simRef.current.gameState = nextState;
    if (typeof document !== 'undefined') {
      document.body.dataset.state = nextState;
      if (nextState !== 'playing') {
        document.exitPointerLock?.();
      }
    }
    setGameState(nextState);
  }, []);

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const addCallout = useCallback((text: string, color: string) => {
    const s = simRef.current;
    s.callouts.push({
      id: s.nextCalloutId++,
      text,
      color,
      ttl: 1.8,
    });
    if (s.callouts.length > 3) s.callouts.shift();
  }, []);

  const handleStartMatch = useCallback(
    (overrideMode?: MatchMode) => {
      const s = simRef.current;
      if (overrideMode) {
        s.matchMode = overrideMode;
        setMatchMode(overrideMode);
      }
      s.keysHeld.clear();
      s.jumpJustPressed = false;
      s.rightMouseBoost = false;
      s.blueScore = 0;
      s.orangeScore = 0;
      s.secondsRemaining = 300;
      s.goalBanner = null;
      s.goalResetTimer = 0;
      s.countdownTimer = 0.6;
      s.lastCountdownBeep = 1;
      s.player = createInitialCar('player', 'blue');
      s.ai = createInitialCar('ai', 'orange');
      s.ball = createInitialBall();
      resetKickoffPositions(s.player, s.ai, s.ball, s.pads);
      s.ghostBoost = s.player.boost;

      // Reset camera cleanly behind player car on kickoff
      s.cameraCurrentPos.set(0, 4.2, -39);
      s.cameraCurrentLook.set(0, 2.0, 0);

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      applyGameState('playing');
    },
    [applyGameState]
  );

  const handleResetKickoff = useCallback(() => {
    const s = simRef.current;
    resetKickoffPositions(s.player, s.ai, s.ball, s.pads);
    s.goalBanner = null;
    s.goalResetTimer = 0;
    s.countdownTimer = 2.4;
    s.lastCountdownBeep = 4;
    addCallout('KICKOFF RESET', '#38BDF8');
  }, [addCallout]);

  const handlePauseToggle = useCallback(() => {
    const s = simRef.current;
    if (s.gameState === 'playing') {
      s.keysHeld.clear();
      s.rightMouseBoost = false;
      applyGameState('paused');
    } else if (s.gameState === 'paused') {
      s.keysHeld.clear();
      s.rightMouseBoost = false;
      applyGameState('playing');
    }
  }, [applyGameState]);

  const handleFinishMatchNow = useCallback(() => {
    const s = simRef.current;
    s.keysHeld.clear();
    s.rightMouseBoost = false;
    soundEngine.playMatchEndFanfare(s.blueScore >= s.orangeScore);
    applyGameState('gameover');
  }, [applyGameState]);

  const handleReturnToTitle = useCallback(() => {
    const s = simRef.current;
    s.keysHeld.clear();
    s.rightMouseBoost = false;
    resetKickoffPositions(s.player, s.ai, s.ball, s.pads);
    // Stage the Octane centerpiece on center circle for the Title showcase
    s.player.x = 2.8;
    s.player.z = -3.2;
    s.player.yaw = -0.55;
    s.ball.x = -2.6;
    s.ball.z = 2.2;
    applyGameState('title');
  }, [applyGameState]);

  const handleSelectLivery = useCallback((nextLivery: CarLivery) => {
    simRef.current.livery = nextLivery;
    setLivery(nextLivery);
    if (simRef.current.playerRig) {
      updateCarLivery(simRef.current.playerRig, nextLivery);
    }
  }, []);

  const handleChangeUE6Preset = useCallback((preset: UE6Preset) => {
    simRef.current.ue6Preset = preset;
    setUe6Preset(preset);
    const s = simRef.current;
    if (s.renderer && s.keyLight && s.hemiLight) {
      if (preset === 'cinematic') {
        s.renderer.toneMappingExposure = 1.15;
        s.keyLight.intensity = 2.6;
        s.hemiLight.intensity = 0.85;
      } else if (preset === 'lumen_high') {
        s.renderer.toneMappingExposure = 1.05;
        s.keyLight.intensity = 2.2;
        s.hemiLight.intensity = 0.75;
      } else {
        s.renderer.toneMappingExposure = 1.0;
        s.keyLight.intensity = 1.9;
        s.hemiLight.intensity = 0.95;
      }
    }
  }, []);

  // Main WebGLRenderer + Three.js Scene Initialization (Runs Once)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Detection from GPU renderer string
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initialW = container.clientWidth || window.innerWidth;
    const initialH = container.clientHeight || window.innerHeight - 32;
    renderer.setSize(initialW, initialH);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    simRef.current.renderer = renderer;

    // 2. Scene, Horizon-Matched FogExp2 & RoomEnvironment Studio IBL
    const scene = new THREE.Scene();
    const skyColorHex = 0x070b16;
    scene.background = new THREE.Color(skyColorHex);
    scene.fog = new THREE.FogExp2(skyColorHex, 0.0042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(68, initialW / initialH, 0.2, 420);

    // 3. Warm/Cool Color-Temperature Contrast Lighting Rig (1 Shadow Caster)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f291e, 0.85);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);
    simRef.current.hemiLight = hemiLight;

    const keyLight = new THREE.DirectionalLight(0xfff3db, 2.6);
    keyLight.position.set(42, 68, -28);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const d = 68;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 180;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);
    simRef.current.keyLight = keyLight;

    // Cool Rim Light + Team Goal Accent PointLights (<= 3 unshadowed PointLights)
    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.1);
    rimLight.position.set(-45, 38, 40);
    scene.add(rimLight);

    const blueGoalLight = new THREE.PointLight(0x0ea5e9, 3.5, 45, 1.8);
    blueGoalLight.position.set(0, 8, -ARENA.halfLength);
    scene.add(blueGoalLight);

    const orangeGoalLight = new THREE.PointLight(0xf97316, 3.5, 45, 1.8);
    orangeGoalLight.position.set(0, 8, ARENA.halfLength);
    scene.add(orangeGoalLight);

    // 4. Build DFH Stadium, Octane Battle-Cars, Geodesic Ball & Pooled Particle System
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createSoftShadowTexture();

    const padRigs: BoostPadRig[] = buildDFHStadium(
      scene,
      simRef.current.pads,
      maxAnisotropy
    );

    const playerRig = buildOctaneBattleCar(simRef.current.livery, shadowTex);
    scene.add(playerRig.root);
    simRef.current.playerRig = playerRig;

    const aiRig = buildOctaneBattleCar('octane_orange', shadowTex);
    scene.add(aiRig.root);
    simRef.current.aiRig = aiRig;

    const ballRig: BallRig = buildRocketBall(shadowTex);
    scene.add(ballRig.root);
    scene.add(ballRig.groundRing);
    scene.add(ballRig.contactShadow);

    const particles = new PooledParticleSystem(scene);

    // Stage cars for initial state ('title' showcase vs '?autostart=1' kickoff)
    if (simRef.current.gameState === 'title') {
      simRef.current.player.x = 2.8;
      simRef.current.player.z = -3.2;
      simRef.current.player.yaw = -0.55;
      simRef.current.ball.x = -2.6;
      simRef.current.ball.z = 2.2;
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 5. ResizeObserver for live viewport bounds
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight - 32;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 6. Unified Keyboard & Mouse Input Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const s = simRef.current;

      // Title-to-Start keyboard handshake (Enter or Space starts immediately)
      if (s.gameState === 'title' && (code === 'Enter' || code === 'Space')) {
        e.preventDefault();
        handleStartMatch();
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (s.gameState === 'playing' || s.gameState === 'paused') {
          e.preventDefault();
          handlePauseToggle();
          return;
        }
      }

      if (s.gameState === 'playing') {
        if (code === 'KeyC' || code === 'Tab') {
          e.preventDefault();
          s.ballCam = !s.ballCam;
        } else if (code === 'KeyV') {
          const order: CameraPreset[] = ['chase', 'far', 'hood'];
          s.cameraPreset = order[(order.indexOf(s.cameraPreset) + 1) % order.length];
        } else if (code === 'KeyR') {
          handleResetKickoff();
        } else if (code === 'KeyM') {
          soundEngine.muted = !soundEngine.muted;
          setMuted(soundEngine.muted);
        } else if (code === 'KeyH') {
          setHudCollapsed((prev) => !prev);
        } else if (code === 'Space') {
          e.preventDefault();
          if (!s.keysHeld.has('Space')) {
            s.jumpJustPressed = true;
          }
        }
      }

      s.keysHeld.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keysHeld.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (simRef.current.gameState !== 'playing') return;
      if (e.button === 2) {
        simRef.current.rightMouseBoost = true;
      } else if (e.button === 0 && e.target === renderer.domElement) {
        simRef.current.jumpJustPressed = true;
        simRef.current.keysHeld.add('MouseJump');
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        simRef.current.rightMouseBoost = false;
      } else if (e.button === 0) {
        simRef.current.keysHeld.delete('MouseJump');
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        simRef.current.pointerNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        simRef.current.pointerNormY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (e.target === renderer.domElement) {
        e.preventDefault();
      }
    };

    // Focus-loss key release without opening pause modal (per ultra-mode rules)
    const clearHeldInputs = () => {
      simRef.current.keysHeld.clear();
      simRef.current.rightMouseBoost = false;
      simRef.current.jumpJustPressed = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', clearHeldInputs);
    document.addEventListener('visibilitychange', clearHeldInputs);

    // 7. Software-WebGL Paced Game Loop (`afterDraw(tick)`)
    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    let lastHudSync = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
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

    function updateVisualMeshFromState(rig: OctaneRig, car: typeof simRef.current.player, dt: number) {
      rig.root.position.set(car.x, car.y, car.z);
      rig.root.rotation.y = car.yaw;

      rig.bodyGroup.rotation.x = car.pitch;
      rig.bodyGroup.rotation.z = car.roll;
      rig.bodyGroup.scale.set(car.squashX, car.squashY, car.squashZ);

      for (const pivot of rig.frontWheelPivots) {
        pivot.rotation.y = car.steerAngle;
      }
      for (const wheel of rig.wheels) {
        wheel.rotation.x = car.wheelSpin;
      }

      // Rocket boost flame & particles
      rig.thrusterFlame.visible = car.isBoosting;
      if (car.isBoosting) {
        const flicker = 0.85 + Math.random() * 0.35;
        rig.thrusterFlame.scale.set(flicker, 1, flicker * (car.isSupersonic ? 1.45 : 1.0));
        const backX = car.x - Math.sin(car.yaw) * 2.4;
        const backZ = car.z - Math.cos(car.yaw) * 2.4;
        particles.spawn(
          backX + (Math.random() - 0.5) * 0.3,
          car.y + 0.35,
          backZ + (Math.random() - 0.5) * 0.3,
          -Math.sin(car.yaw) * 14 + (Math.random() - 0.5) * 4,
          1.2 + Math.random() * 2,
          -Math.cos(car.yaw) * 14 + (Math.random() - 0.5) * 4,
          car.team === 'blue' ? 0x38bdf8 : 0xf97316,
          0.95,
          0.26
        );
      }

      // Delayed ghost boost drain interpolation
      if (car.id === 'player') {
        const s = simRef.current;
        if (car.boost > s.ghostBoost) {
          s.ghostBoost = car.boost;
        } else {
          s.ghostBoost += (car.boost - s.ghostBoost) * (1 - Math.exp(-3.5 * dt));
        }
      }
    }

    function tick() {
      if (isDisposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      // Real elapsed time (capped at 0.25s for tab switches) + sub-stepped physics (<= 0.035s per sub-step)
      const wallDt = Math.min(Math.max(rawDt, 0.001), 0.25);
      const dt = Math.min(wallDt, 0.05);
      const s = simRef.current;

      // Update callout TTLs in real wall time
      for (let i = s.callouts.length - 1; i >= 0; i--) {
        s.callouts[i].ttl -= wallDt;
        if (s.callouts[i].ttl <= 0) s.callouts.splice(i, 1);
      }

      // Decay camera trauma
      s.cameraTrauma = Math.max(0, s.cameraTrauma - wallDt * 1.8);

      if (s.gameState === 'title') {
        // Interactive Centerpiece / Hero Showcase Camera Orbit with Cursor Parallax
        s.titleOrbitAngle += wallDt * 0.22;
        const parallaxX = s.pointerNormX * 0.35;
        const parallaxY = s.pointerNormY * 1.1;
        const camAngle = s.titleOrbitAngle + parallaxX;

        const targetX = Math.sin(camAngle) * 11.5 - 2.2;
        const targetY = 3.6 + Math.max(-1.2, parallaxY);
        const targetZ = -Math.cos(camAngle) * 11.5 - 1.5;

        s.cameraCurrentPos.lerp(_camDesiredPos.set(targetX, targetY, targetZ), 1 - Math.exp(-6 * wallDt));
        s.cameraCurrentLook.lerp(_camLookAt.set(0.2, 1.35, -1.0), 1 - Math.exp(-6 * wallDt));
        camera.position.copy(s.cameraCurrentPos);
        camera.lookAt(s.cameraCurrentLook);

        // Idle showcase animation for car & rotating geodesic ball
        s.player.isBoosting = true;
        s.player.wheelSpin += wallDt * 3.5;
        updateVisualMeshFromState(playerRig, s.player, dt);
        aiRig.root.visible = false;

        s.ball.ry += wallDt * 0.8;
        ballRig.root.position.set(s.ball.x, 2.25 + Math.sin(now * 0.003) * 0.18, s.ball.z);
        ballRig.sphereMesh.rotation.set(0.2, s.ball.ry, 0.15);
        ballRig.groundRing.position.set(s.ball.x, 0.032, s.ball.z);
        ballRig.contactShadow.position.set(s.ball.x, 0.018, s.ball.z);
        particles.update(dt);
      } else if (s.gameState === 'playing') {
        aiRig.root.visible = s.matchMode === 'exhibition_1v1';

        // Handle Hitstop freeze timer (rendering & camera shake continue in real dt!)
        if (s.hitstopTimer > 0) {
          s.hitstopTimer = Math.max(0, s.hitstopTimer - wallDt);
        } else {
          // Kickoff Countdown Timer
          if (s.countdownTimer > 0) {
            s.countdownTimer = Math.max(0, s.countdownTimer - wallDt);
            const ceilSec = Math.ceil(s.countdownTimer);
            if (ceilSec < s.lastCountdownBeep && ceilSec >= 0) {
              s.lastCountdownBeep = ceilSec;
              soundEngine.playCountdownBeep(ceilSec === 0);
            }
          }

          const canMove = s.countdownTimer <= 0.15 && s.goalResetTimer <= 0;

          // Goal Reset Celebration Timer
          if (s.goalResetTimer > 0) {
            s.goalResetTimer -= wallDt;
            if (s.goalResetTimer <= 0) {
              s.goalResetTimer = 0;
              s.goalBanner = null;
              resetKickoffPositions(s.player, s.ai, s.ball, s.pads);
              s.countdownTimer = 0.8;
              s.lastCountdownBeep = 1;
            }
          } else if (s.matchMode === 'exhibition_1v1' && s.countdownTimer <= 0) {
            // Decrement 5-minute match clock in real wall time
            s.secondsRemaining = Math.max(0, s.secondsRemaining - wallDt);
            if (s.secondsRemaining <= 0) {
              soundEngine.playMatchEndFanfare(s.blueScore >= s.orangeScore);
              applyGameState('gameover');
            }
          }

          // Gather Player Input
          const keys = s.keysHeld;
          const throttle =
            (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
            (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
          const steer =
            (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
            (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
          const boostHeld =
            keys.has('ShiftLeft') ||
            keys.has('ShiftRight') ||
            keys.has('KeyJ') ||
            s.rightMouseBoost;
          const jumpHeld = keys.has('Space') || keys.has('MouseJump');
          const handbrakeHeld = keys.has('ControlLeft') || keys.has('KeyK');

          const stepEvents: StepEvents = {
            scoredTeam: null,
            ballHitWeight: 0,
            hitByTeam: null,
            shotOnTarget: false,
            epicSave: false,
            boostPickedUp: null,
            jumped: false,
            dodged: false,
          };

          const activeCars = s.matchMode === 'exhibition_1v1' ? [s.player, s.ai] : [s.player];
          const subSteps = Math.max(1, Math.ceil(wallDt / 0.033));
          const subDt = wallDt / subSteps;

          for (let stepIdx = 0; stepIdx < subSteps; stepIdx++) {
            if (canMove) {
              stepCarPhysics(
                s.player,
                {
                  throttle,
                  steer,
                  boostHeld,
                  jumpJustPressed: stepIdx === 0 ? s.jumpJustPressed : false,
                  jumpHeld,
                  handbrakeHeld,
                },
                subDt,
                s.pads,
                stepEvents,
                true
              );

              if (s.matchMode === 'exhibition_1v1') {
                const aiInput = computeAIInput(s.ai, s.ball, s.pads);
                stepCarPhysics(s.ai, aiInput, subDt, s.pads, stepEvents, false);
              }
            }

            stepBallPhysics(s.ball, activeCars, subDt, stepEvents);
            stepBoostPads(s.pads, subDt);
            if (stepEvents.scoredTeam) break;
          }
          s.jumpJustPressed = false;

          // Process Multi-Channel Juice Events
          if (stepEvents.jumped) {
            soundEngine.playJump(false);
            particles.spawnBurst(s.player.x, 0.25, s.player.z, 5, 6, 0x38bdf8, 0.7, 0.25);
          }
          if (stepEvents.dodged) {
            soundEngine.playJump(true);
            particles.spawnBurst(s.player.x, s.player.y, s.player.z, 9, 9, 0xfbbf24, 0.85, 0.32);
          }
          if (stepEvents.boostPickedUp) {
            soundEngine.playBoostPickup(stepEvents.boostPickedUp === 'full');
            particles.spawnBurst(
              s.player.x,
              0.6,
              s.player.z,
              stepEvents.boostPickedUp === 'full' ? 14 : 6,
              8,
              0xfbbf24,
              0.9,
              0.38
            );
          }
          if (stepEvents.ballHitWeight > 0) {
            soundEngine.playBallHit(stepEvents.ballHitWeight);
            const isHeavy = stepEvents.ballHitWeight > 0.55;
            if (isHeavy) {
              s.hitstopTimer = 0.045;
              s.cameraTrauma = Math.min(1.0, s.cameraTrauma + stepEvents.ballHitWeight * 0.65);
            }
            particles.spawnBurst(
              s.ball.x,
              s.ball.y,
              s.ball.z,
              isHeavy ? 18 : 7,
              14 * stepEvents.ballHitWeight,
              stepEvents.hitByTeam === 'blue' ? 0x38bdf8 : 0xf97316,
              isHeavy ? 1.25 : 0.8,
              0.42
            );
          }
          if (stepEvents.shotOnTarget && stepEvents.hitByTeam === 'blue') {
            addCallout('SHOT ON GOAL +20', '#38BDF8');
          }
          if (stepEvents.epicSave && stepEvents.hitByTeam === 'blue') {
            addCallout('EPIC SAVE +50', '#FBBF24');
          }

          // Goal Scored!
          if (stepEvents.scoredTeam && s.goalResetTimer <= 0) {
            const scoredTeam = stepEvents.scoredTeam;
            const shotKmh = Math.max(42, Math.round(Math.hypot(s.ball.vx, s.ball.vy, s.ball.vz) * 3.6));
            if (scoredTeam === 'blue') {
              s.blueScore += 1;
              s.player.goals += 1;
            } else {
              s.orangeScore += 1;
              s.ai.goals += 1;
            }
            soundEngine.playGoalHorn();
            s.hitstopTimer = 0.07;
            s.cameraTrauma = 1.0;
            s.goalResetTimer = 2.6;
            s.goalBanner = {
              scoredBy: scoredTeam,
              scorerName: scoredTeam === 'blue' ? 'YOU (OCTANE MK-VI)' : 'OCTANE AI',
              shotSpeedKmh: shotKmh,
            };

            // Massive Goal Explosion Particle Burst + Knockback Wave on Cars
            particles.spawnBurst(
              s.ball.x,
              s.ball.y,
              s.ball.z,
              42,
              26,
              scoredTeam === 'blue' ? 0x38bdf8 : 0xf97316,
              1.65,
              0.85
            );
            for (const c of activeCars) {
              const dx = c.x - s.ball.x;
              const dz = c.z - s.ball.z;
              const dist = Math.hypot(dx, dz) || 1;
              c.vx += (dx / dist) * 28;
              c.vz += (dz / dist) * 28;
              c.vy = 14;
              c.onGround = false;
            }
          }
        }

        // Update 3D Meshes
        updateVisualMeshFromState(playerRig, s.player, dt);
        if (s.matchMode === 'exhibition_1v1') {
          updateVisualMeshFromState(aiRig, s.ai, dt);
        }

        // Update Geodesic Ball & Hit Flash
        ballRig.root.position.set(s.ball.x, s.ball.y, s.ball.z);
        ballRig.sphereMesh.rotation.x = s.ball.rx;
        ballRig.sphereMesh.rotation.z = s.ball.rz;
        if (s.ball.hitFlashTimer > 0) {
          ballRig.seamMaterial.emissive.setHex(0xffffff);
          ballRig.seamMaterial.emissiveIntensity = 1.5;
        } else {
          const touchColor =
            s.ball.lastTouchedBy === 'blue'
              ? 0x38bdf8
              : s.ball.lastTouchedBy === 'orange'
                ? 0xf97316
                : 0x94a3b8;
          ballRig.seamMaterial.emissive.setHex(touchColor);
          ballRig.seamMaterial.emissiveIntensity = 0.45;
        }

        // Update Ball Floor Projection Ring & Contact Shadow
        const heightScale = Math.max(0.45, 1 - (s.ball.y - s.ball.radius) / 26);
        ballRig.groundRing.position.set(s.ball.x, 0.032, s.ball.z);
        ballRig.groundRing.scale.setScalar(heightScale);
        ballRig.contactShadow.position.set(s.ball.x, 0.018, s.ball.z);
        ballRig.contactShadow.scale.setScalar(heightScale);

        // Animate Boost Pads & Cooldown Rings
        for (const pr of padRigs) {
          pr.orbMesh.visible = pr.pad.active;
          if (pr.pad.active) {
            pr.orbMesh.rotation.y += dt * 2.2;
            if (pr.pad.isFull) {
              pr.orbMesh.position.y = 1.45 + Math.sin(now * 0.004 + pr.pad.id) * 0.16;
            }
            (pr.ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
          } else {
            (pr.ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.18;
          }
        }

        particles.update(dt);

        // Update Camera Follow (Ball Cam vs Car Chase Cam + FOV speed kick + Wall Pull-in)
        const presetDist = s.cameraPreset === 'far' ? 12.8 : s.cameraPreset === 'hood' ? 5.2 : 9.6;
        const presetHeight = s.cameraPreset === 'far' ? 4.6 : s.cameraPreset === 'hood' ? 2.3 : 3.4;

        _camTargetPos.set(s.player.x, s.player.y + 0.8, s.player.z);

        if (s.ballCam) {
          // Vector from Ball through Player Car so both Car and Ball stay framed!
          _toBall.set(s.ball.x - s.player.x, 0, s.ball.z - s.player.z);
          const distToBall = _toBall.length();
          if (distToBall > 0.5) {
            _toBall.divideScalar(distToBall);
          } else {
            _toBall.set(Math.sin(s.player.yaw), 0, Math.cos(s.player.yaw));
          }
          _camDesiredPos.set(
            s.player.x - _toBall.x * presetDist,
            Math.max(2.1, s.player.y + presetHeight),
            s.player.z - _toBall.z * presetDist
          );
          _camLookAt.set(
            s.ball.x * 0.65 + s.player.x * 0.35,
            Math.max(1.6, s.ball.y * 0.55 + s.player.y * 0.45),
            s.ball.z * 0.65 + s.player.z * 0.35
          );
        } else {
          // Car Chase Cam aligned with Car Forward Heading
          _carForward.set(Math.sin(s.player.yaw), 0, Math.cos(s.player.yaw));
          _camDesiredPos.set(
            s.player.x - _carForward.x * presetDist,
            Math.max(2.1, s.player.y + presetHeight),
            s.player.z - _carForward.z * presetDist
          );
          _camLookAt.set(
            s.player.x + _carForward.x * 12,
            s.player.y + 1.4,
            s.player.z + _carForward.z * 12
          );
        }

        // Pull camera inside arena walls so it never clips outside stadium glass
        const wallMargin = 1.6;
        _camDesiredPos.x = Math.max(-ARENA.halfWidth + wallMargin, Math.min(ARENA.halfWidth - wallMargin, _camDesiredPos.x));
        _camDesiredPos.z = Math.max(-ARENA.halfLength + wallMargin, Math.min(ARENA.halfLength - wallMargin, _camDesiredPos.z));

        const camDamp = 1 - Math.exp(-11 * dt);
        s.cameraCurrentPos.lerp(_camDesiredPos, camDamp);
        s.cameraCurrentLook.lerp(_camLookAt, camDamp);

        camera.position.copy(s.cameraCurrentPos);

        // Decaying trauma*trauma rotational shake on heavy impacts & goals
        if (s.cameraTrauma > 0.01) {
          const shake = s.cameraTrauma * s.cameraTrauma * 0.45;
          camera.position.x += (Math.random() - 0.5) * shake;
          camera.position.y += (Math.random() - 0.5) * shake;
        }
        camera.lookAt(s.cameraCurrentLook);

        // Dynamic FOV kick during boost / supersonic
        const baseFov = s.cameraPreset === 'far' ? 74 : 68;
        const speedBonusFov = s.player.isSupersonic ? 9 : s.player.isBoosting ? 5 : 0;
        const nextFov = THREE.MathUtils.damp(camera.fov, baseFov + speedBonusFov, 8, dt);
        if (Math.abs(nextFov - camera.fov) > 0.05) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
      }

      // Render Scene
      renderer.render(scene, camera);

      // Throttle React HUD Telemetry updates to <= 10Hz (every 100ms)
      if (now - lastHudSync >= 100) {
        lastHudSync = now;
        const cdVal =
          s.countdownTimer > 0.45
            ? Math.ceil(s.countdownTimer - 0.45)
            : s.countdownTimer > 0
              ? 0
              : -1;
        setTelemetry({
          blueScore: s.blueScore,
          orangeScore: s.orangeScore,
          secondsRemaining: s.secondsRemaining,
          boost: s.player.boost,
          ghostBoost: s.ghostBoost,
          speedKmh: getCarSpeedKmh(s.player),
          isSupersonic: s.player.isSupersonic,
          ballCam: s.ballCam,
          cameraPreset: s.cameraPreset,
          aiPolicy: s.ai.aiPolicy,
          countdownValue: cdVal,
          goalBanner: s.goalBanner,
          callouts: s.callouts.map((c) => ({ id: c.id, text: c.text, color: c.color })),
          playerStats: {
            goals: s.player.goals,
            shots: s.player.shots,
            saves: s.player.saves,
            boostCollected: s.player.boostCollected,
            topSpeedKmh: s.player.topSpeedKmh,
          },
        });
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', clearHeldInputs);
      document.removeEventListener('visibilitychange', clearHeldInputs);
      renderer.dispose();
    };
  }, [addCallout, applyGameState, handlePauseToggle, handleResetKickoff, handleStartMatch]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  return (
    <main
      className={`w-screen h-screen flex flex-col bg-[#070A10] overflow-hidden select-none ${
        isWindowedFrame ? 'p-3 sm:p-5 bg-[#030509]' : ''
      }`}
    >
      <div
        className={`relative flex-1 flex flex-col w-full h-full overflow-hidden ${
          isWindowedFrame ? 'rounded-xl border border-slate-700/80 shadow-2xl' : ''
        }`}
      >
        {/* Native Windows 11 App Title Bar */}
        <Win11TitleBar
          ue6Preset={ue6Preset}
          onChangePreset={handleChangeUE6Preset}
          isWindowedFrame={isWindowedFrame}
          onToggleWindowedFrame={() => setIsWindowedFrame((v) => !v)}
          onToggleFullscreen={handleToggleFullscreen}
        />

        {/* Isolated Three.js WebGL Viewport Container */}
        <div
          ref={canvasMountRef}
          data-testid="webgl-viewport"
          className="relative flex-1 w-full h-full overflow-hidden bg-[#070B16]"
        />

        {/* Sibling Game Shell HUD & Modals Overlay */}
        <GameHUD
          gameState={gameState}
          matchMode={matchMode}
          livery={livery}
          muted={muted}
          hudCollapsed={hudCollapsed}
          telemetry={telemetry}
          onStartMatch={handleStartMatch}
          onSelectMode={(m) => {
            simRef.current.matchMode = m;
            setMatchMode(m);
          }}
          onSelectLivery={handleSelectLivery}
          onToggleBallCam={() => {
            simRef.current.ballCam = !simRef.current.ballCam;
          }}
          onCycleCameraPreset={() => {
            const order: CameraPreset[] = ['chase', 'far', 'hood'];
            const next = order[(order.indexOf(simRef.current.cameraPreset) + 1) % order.length];
            simRef.current.cameraPreset = next;
          }}
          onToggleMute={() => {
            soundEngine.muted = !soundEngine.muted;
            setMuted(soundEngine.muted);
          }}
          onToggleHudCollapsed={() => setHudCollapsed((v) => !v)}
          onResetKickoff={handleResetKickoff}
          onPauseToggle={handlePauseToggle}
          onFinishMatchNow={handleFinishMatchNow}
          onReturnToTitle={handleReturnToTitle}
        />
      </div>
    </main>
  );
}
