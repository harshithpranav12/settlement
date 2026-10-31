/**
 * TRACE AI - 3D Reconstruction Interactive Timeline Scrubber
 * 
 * High-precision temporal scrubber with synchronized incident event ticks,
 * collision markers, and hover time previews.
 */

import React, { useRef } from 'react';
import { formatSecondsToTimestamp } from '../utils/trajectoryInterpolation.js';

export default function ReconstructionScrubber({
  startTime = 0,
  endTime = 10,
  currentSeconds = 0,
  t0Seconds = 0,
  onSeek,
  keyEvents = []
}) {
  const containerRef = useRef(null);

  const duration = Math.max(0.1, endTime - startTime);
  const progressPercent = Math.max(0, Math.min(100, ((currentSeconds - startTime) / duration) * 100));

  const handlePointerDown = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const updateSeek = (clientX) => {
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetSec = startTime + ratio * duration;
      onSeek(targetSec);
    };

    updateSeek(e.clientX);

    const onPointerMove = (moveEvt) => {
      updateSeek(moveEvt.clientX);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="w-full space-y-1 select-none">
      {/* 1. Track Bar Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="relative h-6 w-full cursor-pointer flex items-center group py-2"
      >
        {/* Background Track */}
        <div className="h-2 w-full bg-[#E5E7EB] rounded-full overflow-hidden relative border border-[#D9DEE3]">
          {/* Filled Progress Bar */}
          <div
            className="h-full bg-[#527D70] transition-none rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 2. Key Event Marker Ticks */}
        {keyEvents.map((evt, idx) => {
          const tickPercent = Math.max(0, Math.min(100, ((evt.seconds - startTime) / duration) * 100));
          const isImpact = (evt.label || '').toLowerCase().includes('impact') || (evt.label || '').toLowerCase().includes('collision');
          const isBrake = (evt.label || '').toLowerCase().includes('brake');

          return (
            <div
              key={evt.id || idx}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(evt.seconds);
              }}
              title={`${evt.exactTimestamp}: ${evt.label}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer z-10 group/tick"
              style={{ left: `${tickPercent}%` }}
            >
              <div
                className={`w-2.5 h-4 rounded-xs border transition-transform group-hover/tick:scale-125 ${
                  isImpact
                    ? 'bg-[#B85C5C] border-[#991B1B]'
                    : isBrake
                    ? 'bg-[#C18A45] border-[#92400E]'
                    : 'bg-[#7189A6] border-[#475569]'
                }`}
              />

              {/* Hover Tooltip */}
              <div className="opacity-0 group-hover/tick:opacity-100 pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#25364A] text-white text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-30 transition-opacity">
                <span className="font-mono">{evt.exactTimestamp}</span> • {evt.label}
              </div>
            </div>
          );
        })}

        {/* 3. Draggable Playhead Scrubber Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-[#527D70] rounded-full shadow-md z-20 pointer-events-none transition-none"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="w-1.5 h-1.5 bg-[#527D70] rounded-full m-auto mt-[3px]" />
        </div>
      </div>

      {/* 4. Timestamp Range Labels */}
      <div className="flex items-center justify-between text-[11px] font-mono text-[#8A96A6] px-1">
        <span>{formatSecondsToTimestamp(startTime)}</span>
        <span className="text-[#527D70] font-semibold">T0: {formatSecondsToTimestamp(t0Seconds)}</span>
        <span>{formatSecondsToTimestamp(endTime)}</span>
      </div>
    </div>
  );
}
