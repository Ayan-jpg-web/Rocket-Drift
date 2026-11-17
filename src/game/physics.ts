export type GameState = 'title' | 'playing' | 'paused' | 'gameover';
export type MatchMode = 'exhibition_1v1' | 'freeplay';
export type CarLivery = 'octane_blue' | 'octane_orange' | 'octane_stealth';
export type AIPolicy = 'striker' | 'defender' | 'flanker';
export type CameraPreset = 'chase' | 'far' | 'hood';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CarState {
  id: 'player' | 'ai';
  team: 'blue' | 'orange';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number; // radians, 0 = facing +Z (Orange goal), PI = facing -Z (Blue goal)
  pitch: number;
  roll: number;
  angularYaw: number;
  steerAngle: number;
  wheelSpin: number;
  boost: number; // 0 to 100
  isBoosting: boolean;
  isSupersonic: boolean;
  onGround: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  hasDoubleJump: boolean;
  dodgeTimer: number;
  dodgeDirX: number;
  dodgeDirZ: number;
  squashX: number;
  squashY: number;
  squashZ: number;
  aiPolicy: AIPolicy;
  goals: number;
  shots: number;
  saves: number;
  boostCollected: number;
  topSpeedKmh: number;
  demolishTimer: number;
}

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  radius: number;
  lastTouchedBy: 'blue' | 'orange' | null;
  hitFlashTimer: number;
}

export interface BoostPad {
  id: number;
  x: number;
  z: number;
  isFull: boolean; // true = 100 boost (10s respawn), false = 12 boost (4s respawn)
  active: boolean;
  cooldown: number;
  maxCooldown: number;
}

export interface CarInput {
  throttle: number; // -1 to 1
  steer: number; // -1 (left) to 1 (right)
  boostHeld: boolean;
  jumpJustPressed: boolean;
  jumpHeld: boolean;
  handbrakeHeld: boolean;
}

export interface ArenaBounds {
  halfWidth: number; // X: 42
  halfLength: number; // Z: 60
  ceilingHeight: number; // Y: 24
  cornerBevel: number; // 14m 45-degree corner bevel
  goalHalfWidth: number; // X: 11
  goalHeight: number; // Y: 7.2
  goalDepth: number; // Z: 8
}

export const ARENA: ArenaBounds = {
  halfWidth: 42,
  halfLength: 60,
  ceilingHeight: 24,
  cornerBevel: 14,
  goalHalfWidth: 11,
  goalHeight: 7.2,
  goalDepth: 8,
};

export const CAR_CONSTANTS = {
  maxNormalSpeed: 28, // m/s (~100 km/h)
  maxBoostSpeed: 40, // m/s (~144 km/h)
  supersonicThreshold: 36, // m/s (~130 km/h)
  throttleAccel: 26,
  brakeDecel: 42,
  coastDrag: 5.5,
  boostAccel: 22,
  boostConsumptionPerSec: 33.3,
  gravity: 26,
  jumpVelocity: 11.2,
  doubleJumpVelocity: 9.8,
  dodgeImpulse: 14.5,
  carRadius: 1.85,
  carHalfHeight: 0.68,
};

export interface StepEvents {
  scoredTeam: 'blue' | 'orange' | null;
  ballHitWeight: number; // 0 = no hit, 0.1..1.0 = impact intensity
  hitByTeam: 'blue' | 'orange' | null;
  shotOnTarget: boolean;
  epicSave: boolean;
  boostPickedUp: 'small' | 'full' | null;
  jumped: boolean;
  dodged: boolean;
}

export function createInitialBoostPads(): BoostPad[] {
  const pads: BoostPad[] = [];
  let id = 0;

  // 6 Full Boost Orbs (100% boost) - 4 corners + 2 midfield sidelines
  const fullCoords: [number, number][] = [
    [-34, -46],
    [34, -46],
    [-36, 0],
    [36, 0],
    [-34, 46],
    [34, 46],
  ];
  for (const [x, z] of fullCoords) {
    pads.push({
      id: id++,
      x,
      z,
      isFull: true,
      active: true,
      cooldown: 0,
      maxCooldown: 10.0,
    });
  }

  // 12 Small Boost Pads (12% boost) arranged symmetrically on tactical lanes
  const smallCoords: [number, number][] = [
    [0, -42],
    [-16, -32],
    [16, -32],
    [-20, -14],
    [0, -18],
    [20, -14],
    [-20, 14],
    [0, 18],
    [20, 14],
    [-16, 32],
    [16, 32],
    [0, 42],
  ];
  for (const [x, z] of smallCoords) {
    pads.push({
      id: id++,
      x,
      z,
      isFull: false,
      active: true,
      cooldown: 0,
      maxCooldown: 4.0,
    });
  }

  return pads;
}

export function createInitialCar(id: 'player' | 'ai', team: 'blue' | 'orange'): CarState {
  const isBlue = team === 'blue';
  return {
    id,
    team,
    x: 0,
    y: CAR_CONSTANTS.carHalfHeight,
    z: isBlue ? -30 : 30,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: isBlue ? 0 : Math.PI,
    pitch: 0,
    roll: 0,
    angularYaw: 0,
    steerAngle: 0,
    wheelSpin: 0,
    boost: 33,
    isBoosting: false,
    isSupersonic: false,
    onGround: true,
    coyoteTimer: 0.1,
    jumpBufferTimer: 0,
    hasDoubleJump: false,
    dodgeTimer: 0,
    dodgeDirX: 0,
    dodgeDirZ: 0,
    squashX: 1,
    squashY: 1,
    squashZ: 1,
    aiPolicy: 'striker',
    goals: 0,
    shots: 0,
    saves: 0,
    boostCollected: 0,
    topSpeedKmh: 0,
    demolishTimer: 0,
  };
}

export function createInitialBall(): BallState {
  return {
    x: 0,
    y: 2.2,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    radius: 2.15,
    lastTouchedBy: null,
    hitFlashTimer: 0,
  };
}

export function resetKickoffPositions(player: CarState, ai: CarState, ball: BallState, pads: BoostPad[]): void {
  // Randomize slightly between straight kickoff and diagonal kickoff for variety, or deterministic center/slight-offset
  player.x = 0;
  player.y = CAR_CONSTANTS.carHalfHeight;
  player.z = -30;
  player.vx = 0;
  player.vy = 0;
  player.vz = 0;
  player.yaw = 0;
  player.pitch = 0;
  player.roll = 0;
  player.boost = Math.max(player.boost, 33);
  player.isBoosting = false;
  player.isSupersonic = false;
  player.onGround = true;
  player.hasDoubleJump = false;
  player.dodgeTimer = 0;

  ai.x = 0;
  ai.y = CAR_CONSTANTS.carHalfHeight;
  ai.z = 30;
  ai.vx = 0;
  ai.vy = 0;
  ai.vz = 0;
  ai.yaw = Math.PI;
  ai.pitch = 0;
  ai.roll = 0;
  ai.boost = Math.max(ai.boost, 33);
  ai.isBoosting = false;
  ai.isSupersonic = false;
  ai.onGround = true;
  ai.hasDoubleJump = false;
  ai.dodgeTimer = 0;

  ball.x = 0;
  ball.y = ball.radius + 0.1;
  ball.z = 0;
  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;
  ball.lastTouchedBy = null;
  ball.hitFlashTimer = 0;

  for (const pad of pads) {
    pad.active = true;
    pad.cooldown = 0;
  }
}

export function getCarSpeedKmh(car: CarState): number {
  const speedMs = Math.hypot(car.vx, car.vz);
  return Math.round(speedMs * 3.6);
}

/**
 * Selects one of 3 genuinely distinct AI tactical policies based on live field state:
 * 1. 'defender' (Shadow Defender / Goal Sweeper): When ball is threatening Orange goal (z > 12 and moving toward +Z, or deep in Orange half)
 * 2. 'flanker' (Boost Collector / Wide Wing Flanker): When AI boost is critically low (< 22) and ball is not an immediate goal threat
 * 3. 'striker' (Line-of-Sight Charger / Striker): Aligns behind the ball relative to Blue goal (-Z) and charges for a shot
 */
export function selectAIPolicy(ai: CarState, ball: BallState): AIPolicy {
  const ballThreateningOrange = (ball.z > 14 && ball.vz > 2) || ball.z > 28;
  if (ballThreateningOrange) {
    return 'defender';
  }
  if (ai.boost < 22 && ball.z < 18) {
    return 'flanker';
  }
  return 'striker';
}

export function computeAIInput(ai: CarState, ball: BallState, pads: BoostPad[]): CarInput {
  ai.aiPolicy = selectAIPolicy(ai, ball);

  let targetX = ball.x;
  let targetZ = ball.z;
  let wantBoost = false;
  let wantJump = false;

  if (ai.aiPolicy === 'defender') {
    // Shadow defender retreats between the ball and Orange Goal (0, +60)
    // If ball is very close to goal line, clear it aggressively toward the corner
    if (ball.z > 36 && Math.hypot(ball.x - ai.x, ball.z - ai.z) < 18) {
      targetX = ball.x * 0.85;
      targetZ = ball.z - 1.5;
      wantBoost = true;
      if (Math.hypot(ball.x - ai.x, ball.z - ai.z) < 6 && ball.y < 4.5) {
        wantJump = true;
      }
    } else {
      // Position at goal arc (z = 48) tracking ball X
      targetX = Math.max(-ARENA.goalHalfWidth + 2, Math.min(ARENA.goalHalfWidth - 2, ball.x * 0.65));
      targetZ = Math.max(ball.z + 10, 46);
      wantBoost = Math.hypot(targetX - ai.x, targetZ - ai.z) > 16;
    }
  } else if (ai.aiPolicy === 'flanker') {
    // Seek nearest active boost pad, then cut inward from the wing
    let bestPad: BoostPad | null = null;
    let bestDist = Infinity;
    for (const p of pads) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - ai.x, p.z - ai.z) - (p.isFull ? 12 : 0);
      if (d < bestDist) {
        bestDist = d;
        bestPad = p;
      }
    }
    if (bestPad) {
      targetX = bestPad.x;
      targetZ = bestPad.z;
      wantBoost = ai.boost > 8;
    } else {
      // Wide flank approach
      const flankSide = ball.x >= 0 ? 18 : -18;
      targetX = ball.x + flankSide;
      targetZ = ball.z + 6;
    }
  } else {
    // 'striker': Line up behind the ball along the vector from Blue Goal (0, -60) through the ball
    const goalX = 0;
    const goalZ = -ARENA.halfLength;
    const toBallX = ball.x - goalX;
    const toBallZ = ball.z - goalZ;
    const len = Math.hypot(toBallX, toBallZ) || 1;
    const dirX = toBallX / len;
    const dirZ = toBallZ / len;

    const distToBall = Math.hypot(ball.x - ai.x, ball.z - ai.z);
    // If AI is on the wrong side of the ball (closer to Blue goal than ball is), loop around wide
    if (ai.z < ball.z - 2) {
      const sideOffset = ai.x >= ball.x ? 10 : -10;
      targetX = ball.x + sideOffset;
      targetZ = ball.z + 10;
      wantBoost = true;
    } else if (distToBall > 12) {
      // Approach point 6m behind the ball on the shot line
      targetX = ball.x + dirX * 6;
      targetZ = ball.z + dirZ * 6;
      wantBoost = true;
    } else {
      // Charge directly through the ball toward Blue goal
      targetX = ball.x - dirX * 1.2;
      targetZ = ball.z - dirZ * 1.2;
      wantBoost = true;
      if (distToBall < 5.2 && ball.y < 4.2 && ai.onGround) {
        wantJump = true;
      }
    }
  }

  // Compute angle from AI forward vector (sin(yaw), cos(yaw)) to target
  const dx = targetX - ai.x;
  const dz = targetZ - ai.z;
  const desiredYaw = Math.atan2(dx, dz);
  let angleDiff = desiredYaw - ai.yaw;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const steer = Math.max(-1, Math.min(1, angleDiff * 2.4));
  const absAngle = Math.abs(angleDiff);
  const handbrakeHeld = absAngle > 1.35 && Math.hypot(ai.vx, ai.vz) > 10;
  const throttle = absAngle > 2.2 ? -0.6 : 1.0;
  const boostHeld = wantBoost && absAngle < 0.45 && ai.boost > 5;

  return {
    throttle,
    steer,
    boostHeld,
    jumpJustPressed: wantJump,
    jumpHeld: wantJump,
    handbrakeHeld,
  };
}

export function stepCarPhysics(
  car: CarState,
  input: CarInput,
  dt: number,
  pads: BoostPad[],
  events: StepEvents,
  isPlayer: boolean
): void {
  const forwardX = Math.sin(car.yaw);
  const forwardZ = Math.cos(car.yaw);
  const rightX = Math.cos(car.yaw);
  const rightZ = -Math.sin(car.yaw);

  // Squash & stretch recovery damping
  const dampFactor = 1 - Math.exp(-14 * dt);
  car.squashX += (1 - car.squashX) * dampFactor;
  car.squashY += (1 - car.squashY) * dampFactor;
  car.squashZ += (1 - car.squashZ) * dampFactor;

  // Jump buffer & Coyote time
  if (input.jumpJustPressed) {
    car.jumpBufferTimer = 0.12;
  } else {
    car.jumpBufferTimer = Math.max(0, car.jumpBufferTimer - dt);
  }

  if (car.onGround) {
    car.coyoteTimer = 0.10;
    car.hasDoubleJump = true;
  } else {
    car.coyoteTimer = Math.max(0, car.coyoteTimer - dt);
  }

  // First Jump (with Coyote Time & Input Buffering)
  if (car.jumpBufferTimer > 0 && car.coyoteTimer > 0) {
    car.vy = CAR_CONSTANTS.jumpVelocity;
    car.onGround = false;
    car.coyoteTimer = 0;
    car.jumpBufferTimer = 0;
    car.squashX = 0.85;
    car.squashY = 1.22;
    car.squashZ = 0.85;
    if (isPlayer) events.jumped = true;
  } else if (input.jumpJustPressed && !car.onGround && car.hasDoubleJump) {
    // Double Jump or Directional Dodge Flip!
    car.hasDoubleJump = false;
    if (Math.abs(input.throttle) > 0.2 || Math.abs(input.steer) > 0.2) {
      const dodgeFwd = input.throttle !== 0 ? Math.sign(input.throttle) : 1;
      const dirX = forwardX * dodgeFwd + rightX * input.steer * 0.75;
      const dirZ = forwardZ * dodgeFwd + rightZ * input.steer * 0.75;
      const len = Math.hypot(dirX, dirZ) || 1;
      car.vx += (dirX / len) * CAR_CONSTANTS.dodgeImpulse;
      car.vz += (dirZ / len) * CAR_CONSTANTS.dodgeImpulse;
      car.vy = Math.max(car.vy, 4.5);
      car.dodgeTimer = 0.42;
      car.dodgeDirX = dodgeFwd;
      car.dodgeDirZ = input.steer;
      if (isPlayer) events.dodged = true;
    } else {
      car.vy = CAR_CONSTANTS.doubleJumpVelocity;
      if (isPlayer) events.jumped = true;
    }
    car.squashX = 1.15;
    car.squashY = 0.82;
    car.squashZ = 1.15;
  }

  // Variable jump cut when jump button released early while ascending
  if (!input.jumpHeld && car.vy > 4.0 && !car.onGround && car.dodgeTimer <= 0) {
    car.vy *= 0.92;
  }

  // Decompose horizontal velocity into forward and lateral components
  const currentFwdSpeed = car.vx * forwardX + car.vz * forwardZ;
  const currentLatSpeed = car.vx * rightX + car.vz * rightZ;

  // Steering visual & angular update
  const targetSteerAngle = input.steer * 0.55;
  car.steerAngle += (targetSteerAngle - car.steerAngle) * (1 - Math.exp(-16 * dt));

  const speedFactor = Math.min(1, Math.hypot(car.vx, car.vz) / 4.5);
  const reverseSign = currentFwdSpeed < -0.5 ? -1 : 1;
  const turnRate = (input.handbrakeHeld ? 3.8 : 2.65) * (car.onGround ? 1 : 0.55);

  if (Math.abs(input.steer) > 0.01) {
    car.yaw += input.steer * turnRate * speedFactor * reverseSign * dt;
  }

  // Recompute basis after yaw update
  const fwdX = Math.sin(car.yaw);
  const fwdZ = Math.cos(car.yaw);
  const rgtX = Math.cos(car.yaw);
  const rgtZ = -Math.sin(car.yaw);

  let newFwdSpeed = currentFwdSpeed;
  let newLatSpeed = currentLatSpeed;

  if (car.onGround) {
    if (Math.abs(input.throttle) > 0.05) {
      const braking = (input.throttle > 0 && currentFwdSpeed < -1) || (input.throttle < 0 && currentFwdSpeed > 1);
      const accel = braking ? CAR_CONSTANTS.brakeDecel : CAR_CONSTANTS.throttleAccel;
      newFwdSpeed += input.throttle * accel * dt;
    } else {
      // Coasting deceleration
      const drop = CAR_CONSTANTS.coastDrag * dt;
      if (Math.abs(newFwdSpeed) <= drop) newFwdSpeed = 0;
      else newFwdSpeed -= Math.sign(newFwdSpeed) * drop;
    }

    // Lateral tire grip (powerslide reduces lateral grip so car drifts smoothly)
    const grip = input.handbrakeHeld ? 2.5 : 11.5;
    newLatSpeed *= Math.exp(-grip * dt);
  } else {
    // Air pitch & roll control
    newLatSpeed *= Math.exp(-1.5 * dt);
  }

  // Rocket Boost
  if (input.boostHeld && car.boost > 0) {
    car.isBoosting = true;
    car.boost = Math.max(0, car.boost - CAR_CONSTANTS.boostConsumptionPerSec * dt);
    newFwdSpeed += CAR_CONSTANTS.boostAccel * dt;
    if (!car.onGround) {
      car.vy += 4.5 * dt; // Slight aerial lift when boosting
    }
  } else {
    car.isBoosting = false;
  }

  // Clamp speed
  const maxAllowedSpeed = car.isBoosting || car.dodgeTimer > 0
    ? CAR_CONSTANTS.maxBoostSpeed
    : CAR_CONSTANTS.maxNormalSpeed;

  if (newFwdSpeed > maxAllowedSpeed) {
    newFwdSpeed -= (newFwdSpeed - maxAllowedSpeed) * Math.min(1, 5 * dt);
  } else if (newFwdSpeed < -CAR_CONSTANTS.maxNormalSpeed * 0.65) {
    newFwdSpeed = -CAR_CONSTANTS.maxNormalSpeed * 0.65;
  }

  car.vx = fwdX * newFwdSpeed + rgtX * newLatSpeed;
  car.vz = fwdZ * newFwdSpeed + rgtZ * newLatSpeed;

  const totalGroundSpeed = Math.hypot(car.vx, car.vz);
  car.isSupersonic = totalGroundSpeed >= CAR_CONSTANTS.supersonicThreshold;
  const speedKmh = Math.round(totalGroundSpeed * 3.6);
  if (speedKmh > car.topSpeedKmh) {
    car.topSpeedKmh = speedKmh;
  }

  // Wheel rotation synced to distance traveled (never fixed frame counter!)
  car.wheelSpin += newFwdSpeed * dt * 1.45;

  // Dodge flip animation
  if (car.dodgeTimer > 0) {
    car.dodgeTimer = Math.max(0, car.dodgeTimer - dt);
    const progress = 1 - car.dodgeTimer / 0.42;
    car.pitch = car.dodgeDirX * progress * Math.PI * 2;
    car.roll = -car.dodgeDirZ * progress * Math.PI * 2;
  } else if (car.onGround) {
    car.pitch *= Math.exp(-14 * dt);
    car.roll = (-input.steer * Math.min(1, totalGroundSpeed / 20) * 0.08);
  } else {
    // Subtle air pitch toward vertical velocity
    car.pitch = Math.max(-0.55, Math.min(0.55, -car.vy * 0.03));
    car.roll *= Math.exp(-6 * dt);
  }

  // Gravity & Vertical Integration
  if (!car.onGround) {
    car.vy -= CAR_CONSTANTS.gravity * dt;
  }

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.z += car.vz * dt;

  // Ground landing
  if (car.y <= CAR_CONSTANTS.carHalfHeight) {
    if (!car.onGround && car.vy < -3) {
      // Landing squash-and-stretch
      car.squashX = 1.22;
      car.squashY = 0.78;
      car.squashZ = 1.22;
    }
    car.y = CAR_CONSTANTS.carHalfHeight;
    car.vy = 0;
    car.onGround = true;
  } else if (car.y > ARENA.ceilingHeight - CAR_CONSTANTS.carHalfHeight) {
    car.y = ARENA.ceilingHeight - CAR_CONSTANTS.carHalfHeight;
    car.vy = Math.min(0, car.vy);
  }

  // Arena wall & corner containment for cars
  constrainCarToArena(car);

  // Boost pad collection
  if (car.boost < 100 && car.y < 3.2) {
    for (const pad of pads) {
      if (!pad.active) continue;
      const pickupRadius = pad.isFull ? 3.4 : 2.5;
      const dSq = (car.x - pad.x) ** 2 + (car.z - pad.z) ** 2;
      if (dSq <= pickupRadius * pickupRadius) {
        pad.active = false;
        pad.cooldown = pad.maxCooldown;
        const added = pad.isFull ? 100 : 12;
        const prev = car.boost;
        car.boost = Math.min(100, car.boost + added);
        car.boostCollected += Math.round(car.boost - prev);
        if (isPlayer) {
          events.boostPickedUp = pad.isFull ? 'full' : 'small';
        }
      }
    }
  }
}

export function constrainCarToArena(car: CarState): void {
  const r = CAR_CONSTANTS.carRadius;
  const maxW = ARENA.halfWidth - r;
  const maxL = ARENA.halfLength - r;

  // Allow cars to drive inside the goal mouth up to goalDepth
  const inGoalMouthX = Math.abs(car.x) < ARENA.goalHalfWidth - r * 0.8 && car.y < ARENA.goalHeight;

  if (car.x > maxW) {
    car.x = maxW;
    car.vx *= -0.3;
  } else if (car.x < -maxW) {
    car.x = -maxW;
    car.vx *= -0.3;
  }

  if (!inGoalMouthX) {
    if (car.z > maxL) {
      car.z = maxL;
      car.vz *= -0.3;
    } else if (car.z < -maxL) {
      car.z = -maxL;
      car.vz *= -0.3;
    }
  } else {
    const maxGoalZ = ARENA.halfLength + ARENA.goalDepth - r;
    if (car.z > maxGoalZ) {
      car.z = maxGoalZ;
      car.vz *= -0.3;
    } else if (car.z < -maxGoalZ) {
      car.z = -maxGoalZ;
      car.vz *= -0.3;
    }
  }

  // 45-degree corner bevels: |x| + |z| <= halfWidth + halfLength - cornerBevel
  const bevelLimit = ARENA.halfWidth + ARENA.halfLength - ARENA.cornerBevel - r;
  const sumAbs = Math.abs(car.x) + Math.abs(car.z);
  if (sumAbs > bevelLimit) {
    const excess = (sumAbs - bevelLimit) * 0.5;
    car.x -= Math.sign(car.x) * excess;
    car.z -= Math.sign(car.z) * excess;
  }
}

export function stepBallPhysics(
  ball: BallState,
  cars: CarState[],
  dt: number,
  events: StepEvents
): void {
  if (ball.hitFlashTimer > 0) {
    ball.hitFlashTimer = Math.max(0, ball.hitFlashTimer - dt);
  }

  // Gravity & air drag
  ball.vy -= CAR_CONSTANTS.gravity * 0.72 * dt;
  const airDrag = Math.exp(-0.22 * dt);
  ball.vx *= airDrag;
  ball.vz *= airDrag;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;

  // Rolling spin matched to velocity
  ball.rx += (ball.vz / ball.radius) * dt;
  ball.rz -= (ball.vx / ball.radius) * dt;

  // Floor bounce
  if (ball.y < ball.radius) {
    ball.y = ball.radius;
    if (ball.vy < -1.5) {
      ball.vy = -ball.vy * 0.68;
    } else {
      ball.vy = 0;
      // Turf rolling friction
      const turfFriction = Math.exp(-0.45 * dt);
      ball.vx *= turfFriction;
      ball.vz *= turfFriction;
    }
  } else if (ball.y > ARENA.ceilingHeight - ball.radius) {
    ball.y = ARENA.ceilingHeight - ball.radius;
    ball.vy = -Math.abs(ball.vy) * 0.68;
  }

  // Car <-> Ball collisions
  for (const car of cars) {
    const dx = ball.x - car.x;
    const dy = ball.y - (car.y + 0.25);
    const dz = ball.z - car.z;
    const dist = Math.hypot(dx, dy, dz);
    const minDist = ball.radius + CAR_CONSTANTS.carRadius;

    if (dist < minDist && dist > 0.0001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      // Push ball out of penetration
      const overlap = minDist - dist;
      ball.x += nx * overlap;
      ball.y = Math.max(ball.radius, ball.y + ny * overlap * 0.6);
      ball.z += nz * overlap;

      // Relative velocity along normal
      const rvx = ball.vx - car.vx;
      const rvy = ball.vy - car.vy;
      const rvz = ball.vz - car.vz;
      const normalVel = rvx * nx + rvy * ny + rvz * nz;

      if (normalVel < 0) {
        // Rocket League style directional power-shot boost:
        // Blend surface normal with vector from car center to ball + forward boost bonus
        const carSpeed = Math.hypot(car.vx, car.vz);
        const powerMultiplier = car.dodgeTimer > 0 ? 1.48 : car.isBoosting ? 1.28 : 1.12;
        const impulse = Math.max(10, (-normalVel + carSpeed * 0.55) * powerMultiplier);

        ball.vx = car.vx * 0.55 + nx * impulse;
        ball.vz = car.vz * 0.55 + nz * impulse;
        // Add controlled upward pop on ground hits so shots arc nicely
        const upwardPop = Math.min(13, Math.max(2.5, ny * impulse + carSpeed * 0.16));
        ball.vy = Math.max(ball.vy, upwardPop);

        // Clamp max ball speed (~165 km/h)
        const ballSpeed = Math.hypot(ball.vx, ball.vy, ball.vz);
        if (ballSpeed > 46) {
          const scale = 46 / ballSpeed;
          ball.vx *= scale;
          ball.vy *= scale;
          ball.vz *= scale;
        }

        // Check if this touch is an Epic Save or a Shot on Goal
        const prevTouch = ball.lastTouchedBy;
        ball.lastTouchedBy = car.team;
        ball.hitFlashTimer = 0.08;

        const hitWeight = Math.min(1, Math.max(0.15, ballSpeed / 38));
        if (hitWeight > events.ballHitWeight) {
          events.ballHitWeight = hitWeight;
          events.hitByTeam = car.team;
        }

        // Shot detection: ball now heading toward opponent goal
        if (car.team === 'blue' && ball.vz > 12 && Math.abs(ball.x) < ARENA.goalHalfWidth + 5) {
          car.shots += 1;
          events.shotOnTarget = true;
        } else if (car.team === 'orange' && ball.vz < -12 && Math.abs(ball.x) < ARENA.goalHalfWidth + 5) {
          car.shots += 1;
          events.shotOnTarget = true;
        }

        // Save detection: ball was close to own goal and touched by opponent previously
        if (car.team === 'blue' && prevTouch === 'orange' && ball.z < -ARENA.halfLength + 18 && ball.vz > 0) {
          car.saves += 1;
          events.epicSave = true;
        } else if (car.team === 'orange' && prevTouch === 'blue' && ball.z > ARENA.halfLength - 18 && ball.vz < 0) {
          car.saves += 1;
          events.epicSave = true;
        }
      }
    }
  }

  // Car <-> Car bump / collision
  if (cars.length >= 2) {
    const c1 = cars[0];
    const c2 = cars[1];
    const dx = c2.x - c1.x;
    const dz = c2.z - c1.z;
    const dy = Math.abs(c2.y - c1.y);
    const dist = Math.hypot(dx, dz);
    const minCarDist = CAR_CONSTANTS.carRadius * 1.9;
    if (dist < minCarDist && dy < 1.8 && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;
      const push = (minCarDist - dist) * 0.5;
      c1.x -= nx * push;
      c1.z -= nz * push;
      c2.x += nx * push;
      c2.z += nz * push;

      const avgVx = (c1.vx + c2.vx) * 0.5;
      const avgVz = (c1.vz + c2.vz) * 0.5;
      c1.vx = avgVx - nx * 6;
      c1.vz = avgVz - nz * 6;
      c2.vx = avgVx + nx * 6;
      c2.vz = avgVz + nz * 6;
    }
  }

  // Goal detection & Arena wall reflections for the ball
  const inGoalOpening =
    Math.abs(ball.x) < ARENA.goalHalfWidth - ball.radius * 0.45 &&
    ball.y < ARENA.goalHeight - ball.radius * 0.35;

  // Check if ball fully crossed Goal Line!
  if (inGoalOpening) {
    if (ball.z >= ARENA.halfLength + ball.radius * 0.65) {
      // Ball entered Orange Goal (+Z) -> BLUE SCORES!
      events.scoredTeam = 'blue';
      return;
    } else if (ball.z <= -ARENA.halfLength - ball.radius * 0.65) {
      // Ball entered Blue Goal (-Z) -> ORANGE SCORES!
      events.scoredTeam = 'orange';
      return;
    }
  }

  // Side walls (X)
  const maxBallW = ARENA.halfWidth - ball.radius;
  if (ball.x > maxBallW) {
    ball.x = maxBallW;
    ball.vx = -Math.abs(ball.vx) * 0.78;
  } else if (ball.x < -maxBallW) {
    ball.x = -maxBallW;
    ball.vx = Math.abs(ball.vx) * 0.78;
  }

  // Back walls (Z) outside goal mouth
  const maxBallL = ARENA.halfLength - ball.radius;
  if (!inGoalOpening) {
    if (ball.z > maxBallL) {
      ball.z = maxBallL;
      ball.vz = -Math.abs(ball.vz) * 0.78;
    } else if (ball.z < -maxBallL) {
      ball.z = -maxBallL;
      ball.vz = Math.abs(ball.vz) * 0.78;
    }
  }

  // 45-degree corner bevel bounce so ball funnels toward goal like in Rocket League!
  const bevelLimit = ARENA.halfWidth + ARENA.halfLength - ARENA.cornerBevel - ball.radius;
  const sumAbs = Math.abs(ball.x) + Math.abs(ball.z);
  if (sumAbs > bevelLimit) {
    const nx = -Math.sign(ball.x) * Math.SQRT1_2;
    const nz = -Math.sign(ball.z) * Math.SQRT1_2;
    const excess = (sumAbs - bevelLimit) * 0.5;
    ball.x += Math.sign(nx) * excess;
    ball.z += Math.sign(nz) * excess;

    const dot = ball.vx * nx + ball.vz * nz;
    if (dot < 0) {
      ball.vx -= 1.75 * dot * nx;
      ball.vz -= 1.75 * dot * nz;
      // Slight upward wall ramp roll when hitting corner fast
      const cornerSpeed = Math.hypot(ball.vx, ball.vz);
      if (cornerSpeed > 16 && ball.y < 4) {
        ball.vy += cornerSpeed * 0.08;
      }
    }
  }
}

export function stepBoostPads(pads: BoostPad[], dt: number): void {
  for (const pad of pads) {
    if (!pad.active) {
      pad.cooldown -= dt;
      if (pad.cooldown <= 0) {
        pad.cooldown = 0;
        pad.active = true;
      }
    }
  }
}

export function formatMatchClock(secondsRemaining: number): string {
  const clamped = Math.max(0, Math.ceil(secondsRemaining));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
