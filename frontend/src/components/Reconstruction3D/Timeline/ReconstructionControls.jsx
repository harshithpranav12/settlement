/**
 * TRACE AI - 3D Reconstruction Synchronized Playback Control Bar
 * 
 * Provides Play, Pause, Step, Speed selection, and incident event jump shortcuts.
 */

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Clock,
  FastForward
} from 'lucide-react';
import { formatSecondsToTimestamp } from '../utils/trajectoryInterpolation.js';

export default function ReconstructionControls({
  isPlaying,
  onPlay,
  onPause,
  onReset,
  onStepBackward,
  onStepForward,
  playbackSpeed,
  onSetSpeed,
  currentSeconds,
  t0Seconds = 0,
  keyEvents = [],
  onSeek
}) {
  const currentTs = formatSecondsToTimestamp(currentSeconds);
  const relTimeSec = (currentSeconds - t0Seconds).toFixed(2);
  const relTimeStr = relTimeSec >= 0 ? `+${relTimeSec}s` : `${relTimeSec}s`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-t border-[#EDF0F3] text-xs font-sans">
      {/* Left: Playback Buttons & Speeds */}
      <div className="flex items-center space-x-2">
        {/* Play / Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="px-3.5 py-2 rounded-md bg-[#527D70] hover:bg-[#43675C] text-white font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          title="Reset to start of incident"
          className="p-2 rounded-md bg-white border border-[#D9DEE3] text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF] transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Step Backward / Forward */}
        <button
          onClick={() => onStepBackward(0.1)}
          title="Step backward 0.10s"
          className="p-2 rounded-md bg-white border border-[#D9DEE3] text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF] transition cursor-pointer"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={() => onStepForward(0.1)}
          title="Step forward 0.10s"
          className="p-2 rounded-md bg-white border border-[#D9DEE3] text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF] transition cursor-pointer"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-[#D9DEE3] mx-1" />

        {/* Speed Selector */}
        <div className="flex items-center space-x-1">
          {[0.25, 0.5, 1.0, 2.0, 4.0].map((spd) => (
            <button
              key={spd}
              onClick={() => onSetSpeed(spd)}
              className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition ${
                playbackSpeed === spd
                  ? 'bg-[#EBF2EE] text-[#527D70] font-bold border border-[#D0E0D6]'
                  : 'text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF]'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Center/Right: Live Timestamp & Relative Epoch */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] flex items-center space-x-2 font-mono text-xs">
          <Clock className="w-3.5 h-3.5 text-[#527D70]" />
          <span className="font-bold text-[#25364A]">{currentTs}</span>
          <span className="text-[#8A96A6]">•</span>
          <span className={`font-semibold ${
            Math.abs(currentSeconds - t0Seconds) < 0.2
              ? 'text-[#B85C5C] bg-[#FBF2F2] px-1.5 py-0.5 rounded border border-[#F1D7D7]'
              : 'text-[#527D70]'
          }`}>
            t = {relTimeStr}
          </span>
        </div>

        {/* Quick Jump Shortcuts */}
        <div className="hidden lg:flex items-center space-x-1">
          {keyEvents.map((evt) => (
            <button
              key={evt.id}
              onClick={() => onSeek(evt.seconds)}
              className="px-2 py-1 rounded bg-white border border-[#D9DEE3] text-[11px] text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF] transition cursor-pointer truncate max-w-[120px]"
              title={`${evt.exactTimestamp}: ${evt.label}`}
            >
              {evt.shortLabel || evt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
