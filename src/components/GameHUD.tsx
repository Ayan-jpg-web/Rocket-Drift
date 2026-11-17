import React from 'react';
import {
  AIPolicy,
  CameraPreset,
  CarLivery,
  formatMatchClock,
  GameState,
  MatchMode,
} from '../game/physics';

export interface HUDTelemetry {
  blueScore: number;
  orangeScore: number;
  secondsRemaining: number;
  boost: number;
  ghostBoost: number;
  speedKmh: number;
  isSupersonic: boolean;
  ballCam: boolean;
  cameraPreset: CameraPreset;
  aiPolicy: AIPolicy;
  countdownValue: number; // 3, 2, 1, 0 (GO!), -1 (inactive)
  goalBanner: {
    scoredBy: 'blue' | 'orange';
    scorerName: string;
    shotSpeedKmh: number;
  } | null;
  callouts: { id: number; text: string; color: string }[];
  playerStats: {
    goals: number;
    shots: number;
    saves: number;
    boostCollected: number;
    topSpeedKmh: number;
  };
}

interface GameHUDProps {
  gameState: GameState;
  matchMode: MatchMode;
  livery: CarLivery;
  muted: boolean;
  hudCollapsed: boolean;
  telemetry: HUDTelemetry;
  onStartMatch: (mode?: MatchMode) => void;
  onSelectMode: (mode: MatchMode) => void;
  onSelectLivery: (livery: CarLivery) => void;
  onToggleBallCam: () => void;
  onCycleCameraPreset: () => void;
  onToggleMute: () => void;
  onToggleHudCollapsed: () => void;
  onResetKickoff: () => void;
  onPauseToggle: () => void;
  onFinishMatchNow: () => void;
  onReturnToTitle: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  gameState,
  matchMode,
  livery,
  muted,
  hudCollapsed,
  telemetry,
  onStartMatch,
  onSelectMode,
  onSelectLivery,
  onToggleBallCam,
  onCycleCameraPreset,
  onToggleMute,
  onToggleHudCollapsed,
  onResetKickoff,
  onPauseToggle,
  onFinishMatchNow,
  onReturnToTitle,
}) => {
  // Radial boost gauge geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75; // 270 degree gauge arc
  const maxArcLength = circumference * arcFraction;
  const boostOffset = maxArcLength * (1 - Math.min(100, Math.max(0, telemetry.boost)) / 100);
  const ghostOffset = maxArcLength * (1 - Math.min(100, Math.max(0, telemetry.ghostBoost)) / 100);

  const playerWon = telemetry.blueScore >= telemetry.orangeScore;

  return (
    <div className="fixed inset-x-0 top-8 bottom-0 pointer-events-none z-20 flex flex-col justify-between p-5 sm:p-7">
      {/* =====================================================================
          STATE 1: TITLE SCREEN (Interactive Centerpiece Stage + Left Lockup)
      ===================================================================== */}
      {gameState === 'title' && (
        <div className="w-full h-full flex flex-col justify-between pointer-events-none">
          <div className="flex-1 flex items-center">
            {/* Left-Third Asymmetric Title & Mode Lockup over calm dark negative space */}
            <div
              className="pointer-events-auto max-w-lg w-full bg-[#090E1A]/92 border border-slate-800/90 rounded-xl p-6 shadow-2xl"
              style={{ boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85)' }}
            >
              {/* Custom Inline SVG Rocket League Crest & Title Lockup */}
              <div className="flex items-center gap-4 mb-5">
                <svg
                  className="w-16 h-16 shrink-0"
                  viewBox="0 0 80 80"
                  fill="none"
                  aria-label="Rocket League UE6 Shield Emblem"
                >
                  {/* Dark outer shield silhouette */}
                  <path
                    d="M40 4L10 16V38C10 57.5 22.8 71.8 40 77C57.2 71.8 70 57.5 70 38V16L40 4Z"
                    fill="#0B1324"
                    stroke="#38BDF8"
                    strokeWidth="3"
                  />
                  {/* Inner metallic wing bevels */}
                  <path
                    d="M40 10L16 19.5V37.5C16 53.2 26.2 64.9 40 69.5C53.8 64.9 64 53.2 64 37.5V19.5L40 10Z"
                    fill="#111C35"
                    stroke="#F97316"
                    strokeWidth="1.5"
                  />
                  {/* Rocket Car + Ball Silhouette */}
                  <circle cx="48" cy="28" r="8" fill="#F8FAFC" stroke="#38BDF8" strokeWidth="2" />
                  <path
                    d="M18 52L34 38L52 40L58 46L30 56Z"
                    fill="#38BDF8"
                  />
                  <path
                    d="M14 55L24 49L21 59Z"
                    fill="#F97316"
                  />
                </svg>

                <div>
                  <h1 className="font-display italic font-extrabold text-4xl sm:text-5xl tracking-tight text-white leading-none">
                    ROCKET LEAGUE
                  </h1>
                  <p className="text-xs font-mono-tabular text-sky-400 tracking-widest mt-1.5">
                    UNREAL ENGINE 6 · DFH STADIUM · OCTANE MK-VI
                  </p>
                </div>
              </div>

              {/* Match Mode Selection */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-slate-400 mb-2">
                  Select Arena Mode
                </div>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#050811] rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => onSelectMode('exhibition_1v1')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      matchMode === 'exhibition_1v1'
                        ? 'bg-sky-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    1v1 AI Exhibition
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectMode('freeplay')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      matchMode === 'freeplay'
                        ? 'bg-sky-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Free Play Training
                  </button>
                </div>
              </div>

              {/* Single-Car Livery Customizer (Octane MK-VI) */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-slate-400 mb-2">
                  Octane MK-VI Livery Finish
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'octane_blue', name: 'Cobalt Blue', swatch: '#0284c7' },
                      { id: 'octane_orange', name: 'Solar Orange', swatch: '#ea580c' },
                      { id: 'octane_stealth', name: 'Carbon Stealth', swatch: '#334155' },
                    ] as { id: CarLivery; name: string; swatch: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectLivery(item.id)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        livery === item.id
                          ? 'bg-slate-800/90 border-sky-400 text-white'
                          : 'bg-[#050811]/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: item.swatch }}
                      />
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary CTA Button with mandatory data-start="true" */}
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStartMatch();
                }}
                className="w-full py-3.5 px-6 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-display italic font-extrabold text-2xl tracking-wide rounded-lg transition-colors cursor-pointer shadow-lg whitespace-nowrap shrink-0"
              >
                PLAY MATCH
              </button>
            </div>
          </div>

          {/* Flat Borderless Inline Control Hint in the Bottom Safe Margin */}
          <div className="w-full text-center pb-1">
            <p className="text-xs text-slate-300 tracking-wide hud-stroke-sm">
              WASD / Arrows Drive & Steer · Shift / Right-Click Boost · Space Jump & Dodge Flip · C / Tab Ball Cam · Esc Pause
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 2: PLAYING HUD (>= 85% Unobstructed Viewport, 3 Corner Clusters)
      ===================================================================== */}
      {gameState !== 'title' && (
        <>
          {/* TOP ROW: Broadcast Scoreboard (Center) + Utility SVG Icon Buttons (Right) */}
          <div className="w-full flex items-start justify-between">
            {/* Top-Left: Arena & Mode Kicker */}
            <div className="hidden sm:flex flex-col bg-[#080D1A]/88 border border-slate-800 px-3.5 py-2 rounded-lg">
              <span className="text-[11px] font-mono-tabular text-sky-400 uppercase tracking-wider">
                DFH STADIUM · {matchMode === 'exhibition_1v1' ? '1V1 SOCAR' : 'FREE PLAY'}
              </span>
              <span className="text-xs font-medium text-slate-300 mt-0.5">
                {matchMode === 'exhibition_1v1'
                  ? `AI Bot Policy: ${telemetry.aiPolicy.toUpperCase()}`
                  : 'Unlimited Practice · Press R to Reset Ball'}
              </span>
            </div>

            {/* Top-Center: 1:1 Rocket League Broadcast Scoreboard */}
            <div
              className="mx-auto flex items-stretch bg-[#070B14]/95 border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl"
              aria-label="Match Scoreboard"
            >
              {/* Blue Team Score Block */}
              <div className="flex items-center gap-3 px-4 py-1.5 bg-[#0369A1]/90 border-r border-sky-400/30">
                <div className="flex flex-col items-start">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-sky-200">
                    BLUE
                  </span>
                  <span className="text-[10px] text-sky-100/80 font-mono-tabular">
                    YOU
                  </span>
                </div>
                <span
                  className="font-display font-extrabold text-3xl sm:text-4xl text-white tabular-nums hud-stroke"
                  data-testid="blue-score"
                >
                  {Math.round(telemetry.blueScore)}
                </span>
              </div>

              {/* Center Match Clock */}
              <div className="flex flex-col items-center justify-center px-5 py-1.5 bg-[#090E1A]">
                <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                  {matchMode === 'freeplay' ? 'FREE PLAY' : 'TIME'}
                </span>
                <span
                  className="font-mono-tabular font-bold text-2xl sm:text-3xl text-white tabular-nums tracking-tight"
                  data-testid="match-clock"
                >
                  {matchMode === 'freeplay' ? '∞' : formatMatchClock(telemetry.secondsRemaining)}
                </span>
              </div>

              {/* Orange Team Score Block */}
              <div className="flex items-center gap-3 px-4 py-1.5 bg-[#C2410C]/90 border-l border-orange-400/30">
                <span
                  className="font-display font-extrabold text-3xl sm:text-4xl text-white tabular-nums hud-stroke"
                  data-testid="orange-score"
                >
                  {Math.round(telemetry.orangeScore)}
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-orange-200">
                    ORANGE
                  </span>
                  <span className="text-[10px] text-orange-100/80 font-mono-tabular">
                    {matchMode === 'exhibition_1v1' ? 'OCTANE AI' : 'TARGET'}
                  </span>
                </div>
              </div>
            </div>

            {/* Top-Right: Compact Clickable Square SVG Utility Buttons */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Toggle Ball Cam [C]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleBallCam();
                }}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                  telemetry.ballCam
                    ? 'bg-sky-500/25 border-sky-400 text-sky-300'
                    : 'bg-[#090E1A]/90 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Toggle Ball Cam (C or Tab)"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Reset Kickoff [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onResetKickoff();
                }}
                className="w-10 h-10 rounded-lg bg-[#090E1A]/90 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                title="Reset Kickoff (R)"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="w-10 h-10 rounded-lg bg-[#090E1A]/90 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                title="Mute / Unmute Audio (M)"
              >
                {muted ? (
                  <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game [P]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPauseToggle();
                }}
                className="w-10 h-10 rounded-lg bg-[#090E1A]/90 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                title="Pause Game (Esc or P)"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </button>
            </div>
          </div>

          {/* CENTER OVERLAY: Kickoff Countdown (3, 2, 1, GO!) or Goal Scored Broadcast Banner */}
          <div className="my-auto flex flex-col items-center justify-center pointer-events-none">
            {telemetry.countdownValue >= 0 && (
              <div className="font-display italic font-extrabold text-7xl sm:text-8xl text-amber-400 hud-stroke tracking-tight">
                {telemetry.countdownValue === 0 ? 'GO!' : telemetry.countdownValue}
              </div>
            )}

            {telemetry.goalBanner && (
              <div
                className={`px-8 py-4 rounded-xl border-2 shadow-2xl text-center ${
                  telemetry.goalBanner.scoredBy === 'blue'
                    ? 'bg-[#0369A1]/95 border-sky-300'
                    : 'bg-[#C2410C]/95 border-orange-300'
                }`}
              >
                <div className="font-display italic font-extrabold text-4xl sm:text-5xl text-white tracking-wide hud-stroke">
                  {telemetry.goalBanner.scoredBy === 'blue' ? 'BLUE TEAM SCORED!' : 'ORANGE TEAM SCORED!'}
                </div>
                <div className="text-sm font-mono-tabular text-slate-100 mt-1">
                  Scorer: {telemetry.goalBanner.scorerName} · Shot Speed: {Math.round(telemetry.goalBanner.shotSpeedKmh)} KM/H
                </div>
              </div>
            )}

            {/* Dynamic Shot / Save Callouts */}
            {telemetry.callouts.length > 0 && !telemetry.goalBanner && (
              <div className="flex flex-col items-center gap-1 mt-2">
                {telemetry.callouts.map((c) => (
                  <div
                    key={c.id}
                    className="px-3 py-1 rounded bg-[#070B14]/90 border border-slate-700 text-xs font-mono-tabular font-bold tracking-wider uppercase"
                    style={{ color: c.color }}
                  >
                    {c.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOTTOM ROW: Left Ball-Cam / Speedometer Dock + Center Collapsible Control Dock + Right Circular Boost Meter */}
          <div className="w-full flex items-end justify-between gap-4">
            {/* Bottom-Left: Ball Cam Indicator + Digital Speedometer */}
            {!hudCollapsed && (
              <div className="pointer-events-auto flex items-center gap-3 bg-[#080D1A]/92 border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl">
                <div>
                  <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                    SPEED
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display font-extrabold text-3xl sm:text-4xl text-white tabular-nums hud-stroke">
                      {Math.round(telemetry.speedKmh)}
                    </span>
                    <span className="text-xs font-mono-tabular text-slate-400">KM/H</span>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-800 mx-1" />

                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onToggleBallCam();
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      telemetry.ballCam
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    BALL CAM: {telemetry.ballCam ? 'ON' : 'OFF'} [C]
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onCycleCameraPreset();
                    }}
                    className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono-tabular text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    FOV: {telemetry.cameraPreset.toUpperCase()} [V]
                  </button>
                </div>
              </div>
            )}

            {/* Bottom-Center: Collapsible Cinema / Zen Mode Control Dock */}
            <div className="pointer-events-auto mx-auto flex flex-col items-center">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleHudCollapsed();
                }}
                className="px-3 py-1 rounded-t-lg bg-[#090E1A]/90 border border-b-0 border-slate-800 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {hudCollapsed ? '▴ Show Controls [H]' : '▾ Hide Controls [H]'}
              </button>
              {!hudCollapsed && (
                <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-[#090E1A]/92 border border-slate-800 rounded-xl text-xs text-slate-300 shadow-xl">
                  <span><strong className="text-white">WASD</strong> Drive</span>
                  <span aria-hidden="true">·</span>
                  <span><strong className="text-amber-400">Shift</strong> Boost</span>
                  <span aria-hidden="true">·</span>
                  <span><strong className="text-sky-400">Space</strong> Jump / Dodge</span>
                  <span aria-hidden="true">·</span>
                  <span><strong className="text-white">Ctrl</strong> Powerslide</span>
                </div>
              )}
            </div>

            {/* Bottom-Right: 1:1 Rocket League Circular Radial Boost Gauge (0-100) */}
            {!hudCollapsed && (
              <div
                className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center select-none"
                aria-label={`Boost Meter ${Math.round(telemetry.boost)} percent`}
              >
                <svg className="w-full h-full -rotate-[225deg]" viewBox="0 0 132 132">
                  {/* Dark outer gauge socket */}
                  <circle
                    cx="66"
                    cy="66"
                    r="58"
                    fill="rgba(7, 11, 20, 0.90)"
                    stroke="#1E293B"
                    strokeWidth="2"
                  />
                  {/* Background track arc */}
                  <circle
                    cx="66"
                    cy="66"
                    r={radius}
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="10"
                    strokeDasharray={`${maxArcLength} ${circumference}`}
                    strokeLinecap="round"
                  />
                  {/* Delayed Ghost Drain Bar */}
                  <circle
                    cx="66"
                    cy="66"
                    r={radius}
                    fill="none"
                    stroke="rgba(251, 191, 36, 0.35)"
                    strokeWidth="10"
                    strokeDasharray={`${maxArcLength} ${circumference}`}
                    strokeDashoffset={ghostOffset}
                    strokeLinecap="round"
                  />
                  {/* Active Live Boost Fill Arc */}
                  <circle
                    cx="66"
                    cy="66"
                    r={radius}
                    fill="none"
                    stroke={telemetry.boost > 66 ? '#F97316' : telemetry.boost > 25 ? '#F59E0B' : '#38BDF8'}
                    strokeWidth="10"
                    strokeDasharray={`${maxArcLength} ${circumference}`}
                    strokeDashoffset={boostOffset}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Hero Numeric Boost Readout (~3:1 scale over Kicker) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                  <span
                    className="font-display italic font-extrabold text-4xl sm:text-5xl text-white tabular-nums leading-none hud-stroke"
                    data-testid="boost-amount"
                  >
                    {Math.round(telemetry.boost)}
                  </span>
                  <span className="text-[11px] font-bold tracking-widest uppercase text-amber-400 mt-1">
                    BOOST
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* =====================================================================
          STATE 3: PAUSED MODAL (Single Focused Card)
      ===================================================================== */}
      {gameState === 'paused' && (
        <div
          className="fixed inset-0 top-8 bg-black/75 flex items-center justify-center p-4 pointer-events-auto z-30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
        >
          <div className="max-w-md w-full bg-[#090E1A] border border-slate-700 rounded-xl p-6 shadow-2xl">
            <h2
              id="pause-modal-title"
              className="font-display italic font-extrabold text-3xl text-white tracking-wide mb-1"
            >
              MATCH PAUSED
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              DFH Stadium · {matchMode === 'exhibition_1v1' ? '1v1 AI Exhibition' : 'Free Play Training'}
            </p>

            {/* 3 Tabular-Nums Live Stat Tiles */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              <div className="bg-[#050811] border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Score</div>
                <div className="font-mono-tabular font-bold text-xl text-white tabular-nums mt-0.5">
                  {Math.round(telemetry.blueScore)} - {Math.round(telemetry.orangeScore)}
                </div>
              </div>
              <div className="bg-[#050811] border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Shots / Saves</div>
                <div className="font-mono-tabular font-bold text-xl text-sky-400 tabular-nums mt-0.5">
                  {telemetry.playerStats.shots} / {telemetry.playerStats.saves}
                </div>
              </div>
              <div className="bg-[#050811] border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Top Speed</div>
                <div className="font-mono-tabular font-bold text-xl text-amber-400 tabular-nums mt-0.5">
                  {Math.round(telemetry.playerStats.topSpeedKmh)} <span className="text-xs">KM/H</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPauseToggle();
                }}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Resume Match (Esc)
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onResetKickoff();
                  onPauseToggle();
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Restart Kickoff
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onFinishMatchNow();
                }}
                className="w-full py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Finish Match & View Summary
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onReturnToTitle();
                }}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-medium text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 4: GAMEOVER / VICTORY POST-MATCH MODAL
      ===================================================================== */}
      {gameState === 'gameover' && (
        <div
          className="fixed inset-0 top-8 bg-black/80 flex items-center justify-center p-4 pointer-events-auto z-30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gameover-modal-title"
        >
          <div className="max-w-md w-full bg-[#090E1A] border border-slate-700 rounded-xl p-6 shadow-2xl">
            <div className="text-xs font-mono-tabular uppercase tracking-widest text-sky-400 mb-1">
              FULL TIME · DFH STADIUM
            </div>
            <h2
              id="gameover-modal-title"
              className="font-display italic font-extrabold text-4xl text-white tracking-wide mb-4"
            >
              {playerWon ? 'BLUE TEAM VICTORY!' : 'ORANGE TEAM WINS!'}
            </h2>

            {/* Mastery / Progress Metrics (tabular-nums) */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              <div className="bg-[#050811] border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Final Score</div>
                <div className="font-mono-tabular font-bold text-2xl text-white tabular-nums mt-0.5">
                  {Math.round(telemetry.blueScore)} - {Math.round(telemetry.orangeScore)}
                </div>
              </div>
              <div className="bg-[#050811] border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Goals / Shots</div>
                <div className="font-mono-tabular font-bold text-2xl text-sky-400 tabular-nums mt-0.5">
                  {telemetry.playerStats.goals} / {telemetry.playerStats.shots}
                </div>
              </div>
              <div className="bg-[#050811] border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Boost Used</div>
                <div className="font-mono-tabular font-bold text-2xl text-amber-400 tabular-nums mt-0.5">
                  {Math.round(telemetry.playerStats.boostCollected)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStartMatch(matchMode);
                }}
                className="w-full py-3 px-6 bg-sky-500 hover:bg-sky-400 text-slate-950 font-display italic font-extrabold text-2xl tracking-wide rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                PLAY AGAIN
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onReturnToTitle();
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
