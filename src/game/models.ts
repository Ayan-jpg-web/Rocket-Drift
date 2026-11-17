import * as THREE from 'three';
import { ARENA, BoostPad, CarLivery } from './physics';

export interface OctaneRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Group[];
  frontWheelPivots: THREE.Group[];
  thrusterFlame: THREE.Mesh;
  underglowMesh: THREE.Mesh;
  paintMaterial: THREE.MeshPhysicalMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
}

export interface BallRig {
  root: THREE.Group;
  sphereMesh: THREE.Mesh;
  seamMaterial: THREE.MeshStandardMaterial;
  groundRing: THREE.Mesh;
  contactShadow: THREE.Mesh;
}

export interface BoostPadRig {
  pad: BoostPad;
  orbMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
}

const MAX_PARTICLES = 240;

export class PooledParticleSystem {
  public mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorTmp = new THREE.Color();
  private head = 0;

  private active = new Uint8Array(MAX_PARTICLES);
  private px = new Float32Array(MAX_PARTICLES);
  private py = new Float32Array(MAX_PARTICLES);
  private pz = new Float32Array(MAX_PARTICLES);
  private vx = new Float32Array(MAX_PARTICLES);
  private vy = new Float32Array(MAX_PARTICLES);
  private vz = new Float32Array(MAX_PARTICLES);
  private life = new Float32Array(MAX_PARTICLES);
  private maxLife = new Float32Array(MAX_PARTICLES);
  private baseScale = new Float32Array(MAX_PARTICLES);

  constructor(scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(0.28, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.colorTmp.setHex(0xffaa00));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  public spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    scale = 1.0,
    lifetime = 0.35
  ): void {
    const idx = this.head;
    this.head = (this.head + 1) % MAX_PARTICLES;
    this.active[idx] = 1;
    this.px[idx] = x;
    this.py[idx] = y;
    this.pz[idx] = z;
    this.vx[idx] = vx;
    this.vy[idx] = vy;
    this.vz[idx] = vz;
    this.life[idx] = lifetime;
    this.maxLife[idx] = lifetime;
    this.baseScale[idx] = scale;

    this.colorTmp.setHex(colorHex);
    this.mesh.setColorAt(idx, this.colorTmp);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    speed: number,
    colorHex: number,
    scale = 1.2,
    lifetime = 0.55
  ): void {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.85;
      const spd = speed * (0.45 + Math.random() * 0.75);
      const vx = Math.sin(phi) * Math.cos(theta) * spd;
      const vy = Math.cos(phi) * spd + 3;
      const vz = Math.sin(phi) * Math.sin(theta) * spd;
      this.spawn(x, y, z, vx, vy, vz, colorHex, scale * (0.7 + Math.random() * 0.6), lifetime);
    }
  }

  public update(dt: number): void {
    let anyUpdated = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.active[i]) continue;
      anyUpdated = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.active[i] = 0;
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      this.vy[i] -= 9.5 * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] = Math.max(0.1, this.py[i] + this.vy[i] * dt);
      this.pz[i] += this.vz[i] * dt;

      const t = this.life[i] / this.maxLife[i];
      const s = this.baseScale[i] * t;
      this.dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      this.dummy.scale.setScalar(Math.max(0.01, s));
      this.dummy.rotation.x += 5 * dt;
      this.dummy.rotation.y += 7 * dt;
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (anyUpdated) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function createPitchTextures(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 1536;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 16 mowed turf stripes with hexagonal stadium micro-grid
  const stripeCount = 16;
  const stripeH = height / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#154726' : '#1b5730';
    ctx.fillRect(0, i * stripeH, width, stripeH);
  }

  // Subtle Blue (-Z / top) and Orange (+Z / bottom) half-field tint
  const blueGrad = ctx.createLinearGradient(0, 0, 0, height * 0.45);
  blueGrad.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
  blueGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
  ctx.fillStyle = blueGrad;
  ctx.fillRect(0, 0, width, height * 0.5);

  const orangeGrad = ctx.createLinearGradient(0, height, 0, height * 0.55);
  orangeGrad.addColorStop(0, 'rgba(249, 115, 22, 0.16)');
  orangeGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = orangeGrad;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);

  // Crisp White Pitch Markings
  ctx.strokeStyle = 'rgba(240, 249, 255, 0.78)';
  ctx.lineWidth = 10;

  // Outer touchline border
  ctx.strokeRect(36, 36, width - 72, height - 72);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(36, height / 2);
  ctx.lineTo(width - 36, height / 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 145, 0, Math.PI * 2);
  ctx.stroke();

  // Center kickoff spot
  ctx.fillStyle = 'rgba(240, 249, 255, 0.88)';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 16, 0, Math.PI * 2);
  ctx.fill();

  // Blue Penalty Box (top, -Z)
  ctx.strokeRect(width * 0.22, 36, width * 0.56, 230);
  ctx.strokeRect(width * 0.33, 36, width * 0.34, 110);

  // Orange Penalty Box (bottom, +Z)
  ctx.strokeRect(width * 0.22, height - 36 - 230, width * 0.56, 230);
  ctx.strokeRect(width * 0.33, height - 36 - 110, width * 0.34, 110);

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = maxAnisotropy;

  // Linear grayscale micro-relief bumpMap for grass blades
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = 100 + Math.floor(Math.random() * 55);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
  }
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(24, 36);

  return { colorMap, bumpMap };
}

/**
 * Builds the iconic Octane MK-VI Battle-Car as a 12-part composite THREE.Group
 * across Primary Silhouette (beveled wedge chassis), Secondary Read (canopy, twin-fin spoiler wing,
 * side intakes, 4 multi-part wheels), and Accent Detail (twin rocket thruster, front bumper splitter,
 * roll cage struts, LED headlights, neon underglow, contact shadow).
 */
export function buildOctaneBattleCar(
  livery: CarLivery,
  shadowTex: THREE.Texture
): OctaneRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const palette = getLiveryColors(livery);

  // 1. Primary Car Paint Material (Roughness 0.22, Metalness 0.78, Clearcoat 1.0)
  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: palette.primary,
    roughness: 0.22,
    metalness: 0.78,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  // 2. Matte Carbon Trim Material (Roughness 0.72, Metalness 0.28 -> differs by 0.50 roughness!)
  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: 0x181c24,
    roughness: 0.72,
    metalness: 0.28,
  });

  // 3. Tinted Optical Cockpit Canopy Material (Roughness 0.10, Metalness 0.15)
  const canopyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0b1322,
    roughness: 0.1,
    metalness: 0.15,
    clearcoat: 1.0,
  });

  // 4. Metallic Chrome / Titanium Suspension & Exhaust (Roughness 0.25, Metalness 0.92)
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8dee9,
    roughness: 0.25,
    metalness: 0.92,
  });

  // 5. Team Accent Trim & Racing Stripe (Roughness 0.38, Metalness 0.45)
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: palette.accent,
    roughness: 0.38,
    metalness: 0.45,
    emissive: palette.accent,
    emissiveIntensity: 0.18,
  });

  // PART 1: Primary Wedge Hull (ExtrudeGeometry with bevels)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.75, 0.05);
  hullShape.lineTo(1.75, 0.05);
  hullShape.lineTo(1.9, 0.38);
  hullShape.lineTo(0.85, 0.62);
  hullShape.lineTo(-0.35, 0.96);
  hullShape.lineTo(-1.35, 0.92);
  hullShape.lineTo(-1.82, 0.52);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.44,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.1,
    bevelThickness: 0.1,
  });
  hullGeo.center();
  // Rotate so X is width, Y is height, +Z is forward nose
  hullGeo.rotateY(-Math.PI / 2);
  const hullMesh = new THREE.Mesh(hullGeo, paintMaterial);
  hullMesh.position.set(0, 0.34, 0);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  // PART 2: Tinted Aerodynamic Cockpit Canopy & Roll Cage
  const canopyGeo = new THREE.BoxGeometry(1.18, 0.46, 1.38);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMaterial);
  canopyMesh.position.set(0, 0.68, -0.18);
  canopyMesh.rotation.x = 0.18;
  bodyGroup.add(canopyMesh);

  //PART 3: Center Racing Stripe + Roof Intake Scoop
  const scoopGeo = new THREE.BoxGeometry(0.42, 0.16, 1.65);
  const scoopMesh = new THREE.Mesh(scoopGeo, accentMaterial);
  scoopMesh.position.set(0, 0.86, -0.25);
  scoopMesh.rotation.x = 0.08;
  bodyGroup.add(scoopMesh);

  // PART 4: Front Splitter Bumper & Tubular Bull-Bar
  const splitterGeo = new THREE.BoxGeometry(1.76, 0.18, 0.46);
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMaterial);
  splitterMesh.position.set(0, 0.06, 1.85);
  bodyGroup.add(splitterMesh);

  // PART 5 & 6: Side Air Intake Intercooler Pods (Left & Right)
  const podGeo = new THREE.BoxGeometry(0.32, 0.36, 1.35);
  const leftPod = new THREE.Mesh(podGeo, carbonMaterial);
  leftPod.position.set(-0.92, 0.24, -0.15);
  bodyGroup.add(leftPod);

  const rightPod = new THREE.Mesh(podGeo, carbonMaterial);
  rightPod.position.set(0.92, 0.24, -0.15);
  bodyGroup.add(rightPod);

  // PART 7: Iconic Elevated Twin-Fin Rear Spoiler Wing
  const wingGroup = new THREE.Group();
  const wingBladeGeo = new THREE.BoxGeometry(1.88, 0.08, 0.48);
  const wingBlade = new THREE.Mesh(wingBladeGeo, paintMaterial);
  wingBlade.position.set(0, 1.08, -1.68);
  wingBlade.rotation.x = 0.24;
  wingGroup.add(wingBlade);

  const finGeo = new THREE.BoxGeometry(0.08, 0.44, 0.56);
  const leftFin = new THREE.Mesh(finGeo, accentMaterial);
  leftFin.position.set(-0.88, 1.05, -1.68);
  wingGroup.add(leftFin);

  const rightFin = new THREE.Mesh(finGeo, accentMaterial);
  rightFin.position.set(0.88, 1.05, -1.68);
  wingGroup.add(rightFin);

  const strutGeo = new THREE.BoxGeometry(0.08, 0.45, 0.18);
  const leftStrut = new THREE.Mesh(strutGeo, carbonMaterial);
  leftStrut.position.set(-0.48, 0.82, -1.58);
  leftStrut.rotation.x = -0.2;
  wingGroup.add(leftStrut);

  const rightStrut = new THREE.Mesh(strutGeo, carbonMaterial);
  rightStrut.position.set(0.48, 0.82, -1.58);
  rightStrut.rotation.x = -0.2;
  wingGroup.add(rightStrut);
  bodyGroup.add(wingGroup);

  // PART 8: Giant Rear Rocket Thruster Bell Nozzle + Afterburner Core Ring
  const nozzleGeo = new THREE.CylinderGeometry(0.26, 0.40, 0.46, 16);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzleMesh = new THREE.Mesh(nozzleGeo, carbonMaterial);
  nozzleMesh.position.set(0, 0.36, -1.94);
  bodyGroup.add(nozzleMesh);

  const nozzleRimGeo = new THREE.TorusGeometry(0.35, 0.055, 8, 20);
  const nozzleRimMesh = new THREE.Mesh(nozzleRimGeo, chromeMaterial);
  nozzleRimMesh.position.set(0, 0.36, -2.16);
  bodyGroup.add(nozzleRimMesh);

  const coreDiscGeo = new THREE.CircleGeometry(0.28, 16);
  coreDiscGeo.rotateY(Math.PI);
  const coreDiscMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const coreDiscMesh = new THREE.Mesh(coreDiscGeo, coreDiscMat);
  coreDiscMesh.position.set(0, 0.36, -2.17);
  bodyGroup.add(coreDiscMesh);

  const flameGeo = new THREE.ConeGeometry(0.34, 1.85, 12);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.92,
  });
  const thrusterFlame = new THREE.Mesh(flameGeo, flameMat);
  thrusterFlame.position.set(0, 0.36, -2.85);
  thrusterFlame.visible = false;
  bodyGroup.add(thrusterFlame);

  // PART 9: Dual LED Projector Headlights
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  const headlightGeo = new THREE.BoxGeometry(0.32, 0.12, 0.1);
  const leftLight = new THREE.Mesh(headlightGeo, headlightMat);
  leftLight.position.set(-0.56, 0.28, 1.92);
  bodyGroup.add(leftLight);

  const rightLight = new THREE.Mesh(headlightGeo, headlightMat);
  rightLight.position.set(0.56, 0.28, 1.92);
  bodyGroup.add(rightLight);

  // PART 10: Tubular Suspension Wishbones
  const axleGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.25, 8);
  axleGeo.rotateZ(Math.PI / 2);
  const frontAxle = new THREE.Mesh(axleGeo, chromeMaterial);
  frontAxle.position.set(0, 0.05, 1.24);
  bodyGroup.add(frontAxle);

  const rearAxle = new THREE.Mesh(axleGeo, chromeMaterial);
  rearAxle.position.set(0, 0.05, -1.22);
  bodyGroup.add(rearAxle);

  // PART 11: 4 Multi-Part Wheels (Tire rubber + 5-spoke metallic rim + glowing caliper)
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111318,
    roughness: 0.88,
    metalness: 0.08,
  });
  const wheelConfigs: { x: number; y: number; z: number; isFront: boolean; radius: number; width: number }[] = [
    { x: -1.16, y: 0.0, z: 1.24, isFront: true, radius: 0.52, width: 0.44 },
    { x: 1.16, y: 0.0, z: 1.24, isFront: true, radius: 0.52, width: 0.44 },
    { x: -1.22, y: 0.04, z: -1.22, isFront: false, radius: 0.58, width: 0.52 },
    { x: 1.22, y: 0.04, z: -1.22, isFront: false, radius: 0.58, width: 0.52 },
  ];

  const wheels: THREE.Group[] = [];
  const frontWheelPivots: THREE.Group[] = [];

  for (const cfg of wheelConfigs) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(cfg.x, cfg.y, cfg.z);
    root.add(steerPivot);
    if (cfg.isFront) {
      frontWheelPivots.push(steerPivot);
    }

    const spinGroup = new THREE.Group();
    steerPivot.add(spinGroup);
    wheels.push(spinGroup);

    const tireGeo = new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.width, 20);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    spinGroup.add(tireMesh);

    const rimGeo = new THREE.CylinderGeometry(cfg.radius * 0.64, cfg.radius * 0.64, cfg.width + 0.03, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, chromeMaterial);
    spinGroup.add(rimMesh);

    // Hubcap team accent bar for clear visible rotation
    const spokeGeo = new THREE.BoxGeometry(cfg.width + 0.05, cfg.radius * 1.1, 0.12);
    const spokeMesh = new THREE.Mesh(spokeGeo, accentMaterial);
    spinGroup.add(spokeMesh);
  }

  // PART 12: Grounded Contact Shadow + Team Underglow Strip (Offset >= 0.02 on Y to prevent Z-fighting)
  const shadowGeo = new THREE.PlaneGeometry(3.4, 4.8);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0, -0.66, 0);
  root.add(shadowMesh);

  const underglowGeo = new THREE.PlaneGeometry(1.9, 3.2);
  underglowGeo.rotateX(-Math.PI / 2);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: palette.accent,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
  underglowMesh.position.set(0, -0.64, 0);
  root.add(underglowMesh);

  return {
    root,
    bodyGroup,
    wheels,
    frontWheelPivots,
    thrusterFlame,
    underglowMesh,
    paintMaterial,
    accentMaterial,
  };
}

export function getLiveryColors(livery: CarLivery): { primary: number; accent: number } {
  switch (livery) {
    case 'octane_orange':
      return { primary: 0xea580c, accent: 0xfbbf24 };
    case 'octane_stealth':
      return { primary: 0x1e293b, accent: 0x38bdf8 };
    case 'octane_blue':
    default:
      return { primary: 0x0284c7, accent: 0x38bdf8 };
  }
}

export function updateCarLivery(rig: OctaneRig, livery: CarLivery): void {
  const palette = getLiveryColors(livery);
  rig.paintMaterial.color.setHex(palette.primary);
  rig.accentMaterial.color.setHex(palette.accent);
  rig.accentMaterial.emissive.setHex(palette.accent);
  (rig.underglowMesh.material as THREE.MeshBasicMaterial).color.setHex(palette.accent);
}

/**
 * Builds the Rocket League Geodesic Soccer Ball + Dynamic Floor Projection Ring
 */
export function buildRocketBall(shadowTex: THREE.Texture): BallRig {
  const root = new THREE.Group();
  const sphereGroup = new THREE.Group();
  root.add(sphereGroup);

  // Main metallic geodesic shell
  const ballGeo = new THREE.IcosahedronGeometry(2.15, 2);
  const ballMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    roughness: 0.28,
    metalness: 0.72,
    clearcoat: 0.85,
    clearcoatRoughness: 0.15,
  });
  const sphereMesh = new THREE.Mesh(ballGeo, ballMat);
  sphereMesh.castShadow = true;
  sphereMesh.receiveShadow = true;
  sphereGroup.add(sphereMesh);

  // Outer dark hexagonal wireframe cage for instant spin readability
  const cageGeo = new THREE.IcosahedronGeometry(2.165, 1);
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.65,
    metalness: 0.4,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.25,
    wireframe: true,
  });
  const cageMesh = new THREE.Mesh(cageGeo, seamMaterial);
  sphereMesh.add(cageMesh);

  // Equatorial glowing core belt
  const beltGeo = new THREE.TorusGeometry(2.14, 0.07, 8, 32);
  const beltMesh = new THREE.Mesh(beltGeo, seamMaterial);
  sphereMesh.add(beltMesh);

  const beltMesh2 = new THREE.Mesh(beltGeo, seamMaterial);
  beltMesh2.rotation.x = Math.PI / 2;
  sphereMesh.add(beltMesh2);

  // Ground Target Ring (sits at y = 0.032 on the pitch directly beneath the ball)
  const ringGeo = new THREE.RingGeometry(1.7, 2.25, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const groundRing = new THREE.Mesh(ringGeo, ringMat);
  groundRing.position.set(0, 0.032, 0);

  // Soft radial contact shadow beneath ball (y = 0.018)
  const shadowGeo = new THREE.PlaneGeometry(5.6, 5.6);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.set(0, 0.018, 0);

  return {
    root,
    sphereMesh,
    seamMaterial,
    groundRing,
    contactShadow,
  };
}

/**
 * Builds DFH Stadium (UE6 Lumen Edition) + Boost Pad Rigs
 */
export function buildDFHStadium(
  scene: THREE.Scene,
  pads: BoostPad[],
  maxAnisotropy: number
): BoostPadRig[] {
  const { colorMap, bumpMap } = createPitchTextures(maxAnisotropy);

  // 1. Main Turf Pitch (84m x 120m) at y = 0
  const pitchGeo = new THREE.PlaneGeometry(ARENA.halfWidth * 2, ARENA.halfLength * 2);
  pitchGeo.rotateX(-Math.PI / 2);
  const pitchMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: colorMap,
    bumpMap,
    bumpScale: 0.04,
    roughness: 0.78,
    metalness: 0.05,
  });
  const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
  pitchMesh.receiveShadow = true;
  scene.add(pitchMesh);

  // 2. Surrounding Stadium Apron Floor outside the pitch so nothing floats in a void (y = -0.04)
  const apronGeo = new THREE.PlaneGeometry(280, 340);
  apronGeo.rotateX(-Math.PI / 2);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x0b111e,
    roughness: 0.85,
    metalness: 0.2,
  });
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.position.y = -0.04;
  scene.add(apronMesh);

  // 3. Recessed Team Goal Nets: Blue Goal (-Z = -60) & Orange Goal (+Z = +60)
  buildGoalStructure(scene, -ARENA.halfLength, 0x0ea5e9, false); // Blue Goal at -Z
  buildGoalStructure(scene, ARENA.halfLength, 0xf97316, true); // Orange Goal at +Z

  // 4. Arena Perimeter Curb & Translucent Hexagonal Energy Glass Walls
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.6,
  });
  const sideWallLen = (ARENA.halfLength - ARENA.cornerBevel) * 2;
  const sideCurbGeo = new THREE.BoxGeometry(1.2, 1.6, sideWallLen);

  const leftCurb = new THREE.Mesh(sideCurbGeo, curbMat);
  leftCurb.position.set(-ARENA.halfWidth - 0.5, 0.8, 0);
  scene.add(leftCurb);

  const rightCurb = new THREE.Mesh(sideCurbGeo, curbMat);
  rightCurb.position.set(ARENA.halfWidth + 0.5, 0.8, 0);
  scene.add(rightCurb);

  // Translucent stadium glass panels
  const glassWallMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.06,
    wireframe: true,
  });
  const sideGlassGeo = new THREE.PlaneGeometry(sideWallLen, ARENA.ceilingHeight, 16, 4);
  const leftGlass = new THREE.Mesh(sideGlassGeo, glassWallMat);
  leftGlass.position.set(-ARENA.halfWidth, ARENA.ceilingHeight / 2, 0);
  leftGlass.rotation.y = Math.PI / 2;
  scene.add(leftGlass);

  const rightGlass = new THREE.Mesh(sideGlassGeo, glassWallMat);
  rightGlass.position.set(ARENA.halfWidth, ARENA.ceilingHeight / 2, 0);
  rightGlass.rotation.y = -Math.PI / 2;
  scene.add(rightGlass);

  // 4 Chamfered 45-degree Corner Walls
  const cornerLen = ARENA.cornerBevel * Math.SQRT2;
  const cornerCurbGeo = new THREE.BoxGeometry(cornerLen, 2.2, 1.2);
  const cornerPositions: [number, number, number][] = [
    [-ARENA.halfWidth + ARENA.cornerBevel / 2, -ARENA.halfLength + ARENA.cornerBevel / 2, Math.PI / 4],
    [ARENA.halfWidth - ARENA.cornerBevel / 2, -ARENA.halfLength + ARENA.cornerBevel / 2, -Math.PI / 4],
    [-ARENA.halfWidth + ARENA.cornerBevel / 2, ARENA.halfLength - ARENA.cornerBevel / 2, -Math.PI / 4],
    [ARENA.halfWidth - ARENA.cornerBevel / 2, ARENA.halfLength - ARENA.cornerBevel / 2, Math.PI / 4],
  ];
  for (const [cx, cz, rotY] of cornerPositions) {
    const cMesh = new THREE.Mesh(cornerCurbGeo, curbMat);
    cMesh.position.set(cx, 1.1, cz);
    cMesh.rotation.y = rotY;
    scene.add(cMesh);
  }

  // 5. Towering Stadium Floodlight Pylons & Grandstand Tiers (Landmark Silhouette Vista)
  buildStadiumGrandstandsAndPylons(scene);

  // 6. Boost Pads (6 Full Boost Orbs + 12 Small Boost Hex Pads)
  const padRigs: BoostPadRig[] = [];
  const basePlateGeo = new THREE.CylinderGeometry(1.3, 1.5, 0.14, 6);
  const basePlateMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.8,
  });

  const fullOrbGeo = new THREE.OctahedronGeometry(1.15, 1);
  const smallOrbGeo = new THREE.CylinderGeometry(0.75, 0.85, 0.32, 6);

  for (const pad of pads) {
    const baseMesh = new THREE.Mesh(basePlateGeo, basePlateMat);
    baseMesh.position.set(pad.x, 0.07, pad.z);
    if (pad.isFull) baseMesh.scale.set(1.35, 1, 1.35);
    scene.add(baseMesh);

    const orbMat = new THREE.MeshStandardMaterial({
      color: pad.isFull ? 0xfbbf24 : 0xf59e0b,
      emissive: pad.isFull ? 0xf59e0b : 0xd97706,
      emissiveIntensity: pad.isFull ? 0.95 : 0.7,
      roughness: 0.2,
      metalness: 0.5,
    });
    const orbMesh = new THREE.Mesh(pad.isFull ? fullOrbGeo : smallOrbGeo, orbMat);
    orbMesh.position.set(pad.x, pad.isFull ? 1.45 : 0.26, pad.z);
    scene.add(orbMesh);

    const ringGeo = new THREE.RingGeometry(pad.isFull ? 1.55 : 1.05, pad.isFull ? 1.85 : 1.28, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(pad.x, 0.028, pad.z);
    scene.add(ringMesh);

    padRigs.push({ pad, orbMesh, ringMesh });
  }

  return padRigs;
}

function buildGoalStructure(
  scene: THREE.Scene,
  zLine: number,
  teamColorHex: number,
  isPositiveZ: boolean
): void {
  const dir = isPositiveZ ? 1 : -1;
  const gw = ARENA.goalHalfWidth * 2;
  const gh = ARENA.goalHeight;
  const gd = ARENA.goalDepth;

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.8,
  });
  const neonMat = new THREE.MeshBasicMaterial({
    color: teamColorHex,
  });
  const netMat = new THREE.MeshBasicMaterial({
    color: teamColorHex,
    transparent: true,
    opacity: 0.24,
    wireframe: true,
  });

  // Goal Floor
  const goalFloorGeo = new THREE.PlaneGeometry(gw, gd);
  goalFloorGeo.rotateX(-Math.PI / 2);
  const goalFloorMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.6,
    metalness: 0.3,
  });
  const goalFloor = new THREE.Mesh(goalFloorGeo, goalFloorMat);
  goalFloor.position.set(0, 0.02, zLine + (dir * gd) / 2);
  scene.add(goalFloor);

  // Left & Right Goal Posts
  const postGeo = new THREE.BoxGeometry(0.9, gh, 0.9);
  const leftPost = new THREE.Mesh(postGeo, frameMat);
  leftPost.position.set(-ARENA.goalHalfWidth, gh / 2, zLine);
  scene.add(leftPost);

  const rightPost = new THREE.Mesh(postGeo, frameMat);
  rightPost.position.set(ARENA.goalHalfWidth, gh / 2, zLine);
  scene.add(rightPost);

  // Crossbar
  const crossbarGeo = new THREE.BoxGeometry(gw + 1.2, 0.9, 0.9);
  const crossbar = new THREE.Mesh(crossbarGeo, frameMat);
  crossbar.position.set(0, gh, zLine);
  scene.add(crossbar);

  // Glowing Team Goal Line Neon Arch
  const neonCrossGeo = new THREE.BoxGeometry(gw + 0.4, 0.35, 0.35);
  const neonCross = new THREE.Mesh(neonCrossGeo, neonMat);
  neonCross.position.set(0, gh - 0.2, zLine - dir * 0.35);
  scene.add(neonCross);

  const neonPostGeo = new THREE.BoxGeometry(0.35, gh, 0.35);
  const neonLeft = new THREE.Mesh(neonPostGeo, neonMat);
  neonLeft.position.set(-ARENA.goalHalfWidth + 0.2, gh / 2, zLine - dir * 0.35);
  scene.add(neonLeft);

  const neonRight = new THREE.Mesh(neonPostGeo, neonMat);
  neonRight.position.set(ARENA.goalHalfWidth - 0.2, gh / 2, zLine - dir * 0.35);
  scene.add(neonRight);

  // Recessed Net Box
  const netBoxGeo = new THREE.BoxGeometry(gw, gh, gd, 8, 4, 4);
  const netBox = new THREE.Mesh(netBoxGeo, netMat);
  netBox.position.set(0, gh / 2, zLine + (dir * gd) / 2);
  scene.add(netBox);

  // Back Walls flanking the goal opening
  const flankWidth = ARENA.halfWidth - ARENA.cornerBevel - ARENA.goalHalfWidth;
  if (flankWidth > 0) {
    const flankGeo = new THREE.BoxGeometry(flankWidth, 2.2, 1.2);
    const leftFlank = new THREE.Mesh(flankGeo, frameMat);
    leftFlank.position.set(-ARENA.goalHalfWidth - flankWidth / 2, 1.1, zLine);
    scene.add(leftFlank);

    const rightFlank = new THREE.Mesh(flankGeo, frameMat);
    rightFlank.position.set(ARENA.goalHalfWidth + flankWidth / 2, 1.1, zLine);
    scene.add(rightFlank);
  }
}

function buildStadiumGrandstandsAndPylons(scene: THREE.Scene): void {
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.7,
    metalness: 0.35,
  });
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.75,
  });
  const floodlightMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
  });

  // 4 Towering Floodlight Pylons at stadium corners (Landmark silhouette in initial spawn vista!)
  const pylonCoords: [number, number][] = [
    [-58, -74],
    [58, -74],
    [-58, 74],
    [58, 74],
  ];

  const towerGeo = new THREE.BoxGeometry(3.5, 46, 3.5);
  const bankGeo = new THREE.BoxGeometry(12, 4.5, 1.5);

  for (const [px, pz] of pylonCoords) {
    const tower = new THREE.Mesh(towerGeo, pylonMat);
    tower.position.set(px, 23, pz);
    tower.lookAt(0, 20, 0);
    scene.add(tower);

    const lightBank = new THREE.Mesh(bankGeo, floodlightMat);
    lightBank.position.set(px * 0.92, 43, pz * 0.92);
    lightBank.lookAt(0, 0, 0);
    scene.add(lightBank);
  }

  // Grandstand bowl tiers along Left (-X) and Right (+X) sidelines + LED ribbon strips
  const tierGeo = new THREE.BoxGeometry(14, 16, 110);
  const leftStand = new THREE.Mesh(tierGeo, standMat);
  leftStand.position.set(-56, 8, 0);
  leftStand.rotation.z = -0.25;
  scene.add(leftStand);

  const rightStand = new THREE.Mesh(tierGeo, standMat);
  rightStand.position.set(56, 8, 0);
  rightStand.rotation.z = 0.25;
  scene.add(rightStand);

  const blueRibbonMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
  const orangeRibbonMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const ribbonGeo = new THREE.BoxGeometry(0.5, 0.5, 52);

  const leftBlueRibbon = new THREE.Mesh(ribbonGeo, blueRibbonMat);
  leftBlueRibbon.position.set(-48.5, 9.5, -28);
  scene.add(leftBlueRibbon);

  const rightBlueRibbon = new THREE.Mesh(ribbonGeo, blueRibbonMat);
  rightBlueRibbon.position.set(48.5, 9.5, -28);
  scene.add(rightBlueRibbon);

  const leftOrangeRibbon = new THREE.Mesh(ribbonGeo, orangeRibbonMat);
  leftOrangeRibbon.position.set(-48.5, 9.5, 28);
  scene.add(leftOrangeRibbon);

  const rightOrangeRibbon = new THREE.Mesh(ribbonGeo, orangeRibbonMat);
  rightOrangeRibbon.position.set(48.5, 9.5, 28);
  scene.add(rightOrangeRibbon);

  // Overhead Stadium Arch Ribs spanning across the arena roof
  const archGeo = new THREE.TorusGeometry(58, 0.7, 6, 32, Math.PI);
  for (const zPos of [-36, 0, 36]) {
    const arch = new THREE.Mesh(archGeo, pylonMat);
    arch.position.set(0, 0, zPos);
    scene.add(arch);
  }

  // Suspended Center Roof Scoreboard Jumbotron Ring (at Y = 32m above center pitch)
  const jumboRingGeo = new THREE.TorusGeometry(11, 1.2, 8, 24);
  jumboRingGeo.rotateX(Math.PI / 2);
  const jumboMesh = new THREE.Mesh(jumboRingGeo, pylonMat);
  jumboMesh.position.set(0, 32, 0);
  scene.add(jumboMesh);
}
