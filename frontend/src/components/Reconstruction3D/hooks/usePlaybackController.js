/**
 * TRACE AI - 3D Reconstruction Temporal Playback Controller Hook
 * 
 * Frame-rate independent playback engine using performance.now() and timestamp delta integration.
 * Supports play, pause, seek, step, speed scaling, and loop bounds.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export function usePlaybackController({
  startTime = 0,
  endTime = 10,
  initialSpeed = 1.0,
  autoPlay = false
} = {}) {
  const [currentSeconds, setCurrentSeconds] = useState(startTime);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [playbackSpeed, setPlaybackSpeed] = useState(initialSpeed);

  const lastTimeRef = useRef(null);
  const animFrameRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const playbackSpeedRef = useRef(playbackSpeed);
  const currentSecondsRef = useRef(currentSeconds);

  // Synchronize refs
  isPlayingRef.current = isPlaying;
  playbackSpeedRef.current = playbackSpeed;
  currentSecondsRef.current = currentSeconds;

  // Sync when startTime changes
  useEffect(() => {
    setCurrentSeconds(startTime);
    currentSecondsRef.current = startTime;
  }, [startTime]);

  const play = useCallback(() => {
    // If playback reached end of trajectory, automatically loop back to start on play
    if (currentSecondsRef.current >= endTime - 0.01) {
      setCurrentSeconds(startTime);
      currentSecondsRef.current = startTime;
    }
    setIsPlaying(true);
    lastTimeRef.current = null;
  }, [startTime, endTime]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    lastTimeRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    lastTimeRef.current = null;
    setCurrentSeconds(startTime);
    currentSecondsRef.current = startTime;
  }, [startTime]);

  const seek = useCallback((targetSeconds) => {
    const clamped = Math.max(startTime, Math.min(endTime, targetSeconds));
    setCurrentSeconds(clamped);
    currentSecondsRef.current = clamped;
  }, [startTime, endTime]);

  const stepForward = useCallback((delta = 0.1) => {
    seek(currentSecondsRef.current + delta);
  }, [seek]);

  const stepBackward = useCallback((delta = 0.1) => {
    seek(currentSecondsRef.current - delta);
  }, [seek]);

  const setSpeed = useCallback((speed) => {
    setPlaybackSpeed(speed);
  }, []);

  // Animation Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const loop = (timestamp) => {
      if (lastTimeRef.current !== null) {
        const dtWallClock = (timestamp - lastTimeRef.current) / 1000.0;
        const dtSimulation = dtWallClock * playbackSpeedRef.current;

        let nextTime = currentSecondsRef.current + dtSimulation;
        if (nextTime >= endTime) {
          nextTime = endTime;
          setIsPlaying(false);
        }

        setCurrentSeconds(nextTime);
        currentSecondsRef.current = nextTime;
      }

      lastTimeRef.current = timestamp;
      if (isPlayingRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, endTime]);

  return {
    currentSeconds,
    isPlaying,
    playbackSpeed,
    play,
    pause,
    reset,
    seek,
    stepForward,
    stepBackward,
    setSpeed
  };
}
