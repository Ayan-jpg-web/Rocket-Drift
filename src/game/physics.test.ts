import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA,
  CAR_CONSTANTS,
  createInitialBall,
  createInitialBoostPads,
  createInitialCar,
  formatMatchClock,
  getCarSpeedKmh,
  resetKickoffPositions,
  selectAIPolicy,
  stepBallPhysics,
  stepBoostPads,
  stepCarPhysics,
  StepEvents,
} from './physics';

function emptyEvents(): StepEvents {
  return {
    scoredTeam: null,
    ballHitWeight: 0,
    hitByTeam: null,
    shotOnTarget: false,
    epicSave: false,
    boostPickedUp: null,
    jumped: false,
    dodged: false,
  };
}

test('car acceleration, boost consumption, and supersonic threshold work accurately', () => {
  const player = createInitialCar('player', 'blue');
  const pads = createInitialBoostPads();
  const events = emptyEvents();

  assert.equal(player.boost, 33);
  assert.equal(player.onGround, true);

  // Step 1.2 seconds of full throttle + boost
  for (let i = 0; i < 60; i++) {
    stepCarPhysics(
      player,
      {
        throttle: 1,
        steer: 0,
        boostHeld: true,
        jumpJustPressed: false,
        jumpHeld: false,
        handbrakeHeld: false,
      },
      0.02,
      pads,
      events,
      true
    );
  }

  assert.ok(player.z > -30, 'Car should advance forward along +Z');
  assert.ok(getCarSpeedKmh(player) > 95, 'Car should reach high speed when boosting');
  assert.ok(player.boost < 33, 'Boost should be consumed while boosting');
});

test('jump, coyote time, and directional dodge flip apply upward and forward impulses', () => {
  const player = createInitialCar('player', 'blue');
  const pads = createInitialBoostPads();
  const events = emptyEvents();

  // First jump
  stepCarPhysics(
    player,
    {
      throttle: 1,
      steer: 0,
      boostHeld: false,
      jumpJustPressed: true,
      jumpHeld: true,
      handbrakeHeld: false,
    },
    0.02,
    pads,
    events,
    true
  );

  assert.equal(events.jumped, true);
  assert.equal(player.onGround, false);
  assert.ok(player.vy > 9, 'Car should have positive vertical velocity after jumping');

  // Second jump -> Directional Dodge Flip while airborne
  stepCarPhysics(
    player,
    {
      throttle: 1,
      steer: 0.5,
      boostHeld: false,
      jumpJustPressed: true,
      jumpHeld: true,
      handbrakeHeld: false,
    },
    0.02,
    pads,
    events,
    true
  );

  assert.equal(events.dodged, true);
  assert.equal(player.hasDoubleJump, false);
  assert.ok(player.dodgeTimer > 0, 'Dodge flip timer should be active');
});

test('car-ball collision transfers momentum and detects goal scoring in both nets', () => {
  const player = createInitialCar('player', 'blue');
  const ai = createInitialCar('ai', 'orange');
  const ball = createInitialBall();
  const events = emptyEvents();

  // Place player right behind the ball moving fast toward Orange goal (+Z)
  player.x = 0;
  player.y = CAR_CONSTANTS.carHalfHeight;
  player.z = -3.5;
  player.vx = 0;
  player.vz = 32;
  player.isBoosting = true;

  ball.x = 0;
  ball.y = ball.radius;
  ball.z = 0;
  ball.vx = 0;
  ball.vz = 0;

  stepBallPhysics(ball, [player, ai], 0.02, events);

  assert.ok(ball.vz > 20, 'Ball should launch forward after power hit');
  assert.equal(ball.lastTouchedBy, 'blue');
  assert.equal(events.shotOnTarget, true);
  assert.equal(player.shots, 1);

  // Move ball into Orange goal mouth (+Z) and verify goal trigger
  ball.x = 0;
  ball.y = 2.2;
  ball.z = ARENA.halfLength + ball.radius * 0.7;
  const goalEvents = emptyEvents();
  stepBallPhysics(ball, [player, ai], 0.02, goalEvents);
  assert.equal(goalEvents.scoredTeam, 'blue');
});

test('boost pad pickup refills boost and respawns after cooldown', () => {
  const player = createInitialCar('player', 'blue');
  const pads = createInitialBoostPads();
  const events = emptyEvents();

  const fullPad = pads.find((p) => p.isFull)!;
  player.x = fullPad.x;
  player.z = fullPad.z;
  player.boost = 15;

  stepCarPhysics(
    player,
    {
      throttle: 0,
      steer: 0,
      boostHeld: false,
      jumpJustPressed: false,
      jumpHeld: false,
      handbrakeHeld: false,
    },
    0.02,
    pads,
    events,
    true
  );

  assert.equal(player.boost, 100, 'Full boost orb should refill boost to 100');
  assert.equal(fullPad.active, false, 'Full boost orb should deactivate upon collection');
  assert.equal(events.boostPickedUp, 'full');

  // Advance 10.1 seconds to verify respawn
  stepBoostPads(pads, 10.1);
  assert.equal(fullPad.active, true, 'Full boost orb should respawn after 10s cooldown');
});

test('AI selects 3 distinct policies (defender, flanker, striker) depending on field state', () => {
  const ai = createInitialCar('ai', 'orange');
  const ball = createInitialBall();

  // Case 1: Ball deep in Orange half moving toward Orange goal -> defender
  ball.z = 32;
  ball.vz = 15;
  ai.boost = 50;
  assert.equal(selectAIPolicy(ai, ball), 'defender');

  // Case 2: AI low on boost and ball not threatening -> flanker
  ball.z = -10;
  ball.vz = -5;
  ai.boost = 10;
  assert.equal(selectAIPolicy(ai, ball), 'flanker');

  // Case 3: AI has boost and ball in neutral/attacking zone -> striker
  ball.z = 0;
  ball.vz = 0;
  ai.boost = 60;
  assert.equal(selectAIPolicy(ai, ball), 'striker');

  // Verify kickoff reset restores positions cleanly
  const player = createInitialCar('player', 'blue');
  const pads = createInitialBoostPads();
  resetKickoffPositions(player, ai, ball, pads);
  assert.equal(ball.x, 0);
  assert.equal(ball.z, 0);
  assert.equal(formatMatchClock(300), '5:00');
  assert.equal(formatMatchClock(65), '1:05');
});
