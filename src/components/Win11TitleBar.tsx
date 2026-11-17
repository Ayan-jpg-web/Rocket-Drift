import React from 'react';

export type UE6Preset = 'cinematic' | 'lumen_high' | 'performance';

interface Win11TitleBarProps {
  ue6Preset: UE6Preset;
  onChangePreset: (preset: UE6Preset) => void;
  isWindowedFrame: boolean;
  onToggleWindowedFrame: () => void;
  onToggleFullscreen: () => void;
}

export const Win11TitleBar: React.FC<Win11TitleBarProps> = ({
  ue6Preset,
  onChangePreset,
  isWindowedFrame,
  onToggleWindowedFrame,
  onToggleFullscreen,
}) => {
  return (
    <div
      className="h-8 w-full bg-[#0B0F17] border-b border-slate-800/90 flex items-center justify-between px-3 select-none z-40 shrink-0"
      role="region"
      aria-label="Windows 11 Application Title Bar"
    >
      {/* Left: Windows 11 App Icon + Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <svg className="w-4 h-4 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z" />
        </svg>
        <span className="text-xs font-medium text-slate-200 tracking-wide truncate">
          Rocket League — Unreal Engine 6.0 (DX12 Ultimate)
        </span>
        <span className="hidden sm:inline-block text-slate-600 text-xs" aria-hidden="true">·</span>
        <span className="hidden sm:inline-block text-[11px] font-mono-tabular text-slate-400 truncate">
          DFH Stadium · Octane MK-VI
        </span>
      </div>

      {/* Center: UE6 Graphics Pipeline Selector */}
      <div className="hidden md:flex items-center gap-1 bg-[#131B2E] p-0.5 rounded border border-slate-800">
        {(
          [
            { id: 'cinematic', label: 'UE6 Lumen Cinematic' },
            { id: 'lumen_high', label: 'Lumen High' },
            { id: 'performance', label: '120Hz Competitive' },
          ] as { id: UE6Preset; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onChangePreset(item.id);
            }}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              ue6Preset === item.id
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Right: Native Windows 11 Caption Buttons */}
      <div className="flex items-center -mr-2">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle Windowed Border Frame"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleWindowedFrame();
          }}
          className="h-8 w-10 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title="Toggle Windows 11 Desktop Frame"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle Fullscreen Window"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleFullscreen();
          }}
          className="h-8 w-10 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title="Maximize / Fullscreen"
        >
          {isWindowedFrame ? (
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="2.5" y="4.5" width="9" height="9" rx="1" />
              <path d="M5.5 4.5V2.5H13.5V10.5H11.5" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
