// Features to consider adding to this Beatmaker:
// - Pattern save/load to localStorage (auto-save, user presets)
// - Add swing/shuffle control for groove
// - Volume/mute/solo controls per track
// - Add more instruments/samples or allow user to upload their own
// - Pattern length adjustment (not just 32 steps)
// - Step probability/randomization (for generative beats)
// - Step velocity/accent (per-step volume)
// - Copy/paste/duplicate rows or patterns
// - Undo/redo support
// - Mobile-friendly touch controls (drag to paint steps, etc.)
// - Visual metronome or count-in
// - Pattern chaining/song mode (sequence multiple patterns)
// - Add effects (reverb, delay, filter) per track or master
// - Keyboard shortcuts for step entry and playback
// - Dark mode/theme toggle
// - Visualizer for output audio
// - Integration with Web MIDI (output to external synths)
// - Collaborative mode (real-time editing with others)
// - AI beat suggestion/generation
// - Tap tempo input
// - Add a "randomize" or "humanize" button for patterns

"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

// Expanded samples to accommodate for chord, percussion, tom, water-drop
const samples = [
  { name: "closed-hihat.mp3", label: "Closed HH" },
  { name: "open-hihat.mp3", label: "Open HH" },
  { name: "snare.mp3", label: "Snare" },
  { name: "kick-drum.mp3", label: "Kick" },
  { name: "chord.mp3", label: "Chord" },
  { name: "percussion.mp3", label: "Perc" },
  { name: "tom.mp3", label: "Tom" },
  { name: "water-drop.mp3", label: "Drop" },
];

const STEP_LENGTH_OPTIONS = [32];
const DEFAULT_NUM_STEPS = 32;
const DEFAULT_TEMPO_BPM = 120; // More energetic for a banger
const MIN_TEMPO = 60;
const MAX_TEMPO = 240;

// Assign a unique color for each row (sound) for the SELECTED state only
const rowSelectedColors = [
  "bg-red-500/80",
  "bg-orange-500/80",
  "bg-yellow-500/80", 
  "bg-green-500/80",  
  "bg-cyan-500/80", 
  "bg-blue-500/80",   
  "bg-purple-500/80", 
  "bg-pink-500/80",   
];

// --- BEGIN: Custom Default Song String ---
const DEFAULT_SONG_STRING = "-x3cow.x35kw.-2hwcg0.5mmvrd.mww.4fti4g.4wmww.-zik0yk,120";
// --- END: Custom Default Song String ---

// Default pattern: "Billie Jean" by Michael Jackson (instantly recognizable groove)
function getDefaultPattern(numSteps = DEFAULT_NUM_STEPS) {
  // If a valid DEFAULT_SONG_STRING is set, use it
  const decoded = decodePattern(DEFAULT_SONG_STRING, numSteps);
  if (decoded) {
    return decoded.selected;
  }
  // Fallback to hardcoded Billie Jean groove
  const pattern = Array.from({ length: samples.length }, () =>
    Array(numSteps).fill(false)
  );

  // Closed HH: 16th-note groove, skip every 4th for swing
  [0, 4, 8, 11, 14, 18, 20, 24, 27, 30].forEach(i => { if (i < numSteps) pattern[0][i] = true; });

  // Open HH: occasional off-beat accent (steps 7, 23)
  [2, 16].forEach(i => { if (i < numSteps) pattern[1][i] = true; });

  // Snare: backbeat + a ghost snare
  [4, 20, 25, 26, 28, 29, 30, 31].forEach(i => { if (i < numSteps) pattern[2][i] = true; });

  // Kick: funky groove with syncopation
  [0, 6, 14, 20, 30].forEach(i => { if (i < numSteps) pattern[3][i] = true; });

  // Chords: laid-back harmony hits (steps 0, 16)
  [0, 4, 8, 11, 14, 18, 20, 24, 27, 30].forEach(i => { if (i < numSteps) pattern[4][i] = true; });

  // Perc: groove texture, slightly offbeat
  [8, 11, 14, 30].forEach(i => { if (i < numSteps) pattern[5][i] = true; });

  // Tom: short fill at end of bar 2
  [20].forEach(i => { if (i < numSteps) pattern[6][i] = true; });

  // Drop: melodic hook at phrase end
  [11, 27].forEach(i => { if (i < numSteps) pattern[7][i] = true; });

  return pattern;
}

// --- Helper: encode pattern and tempo to a compact string for sharing ---
function encodePattern(selected: boolean[][], tempo: number): string {
  // Each row is a 32-bit number, convert to base36 for compactness
  const rows = selected.map(row => {
    let bits = 0;
    for (let i = 0; i < row.length; ++i) {
      if (row[i]) bits |= (1 << i);
    }
    return bits.toString(36);
  });
  // Join rows with "." and add tempo
  return `${rows.join(".")},${tempo}`;
}

// --- Helper: decode pattern and tempo from string ---
function decodePattern(str: string, numSteps = DEFAULT_NUM_STEPS): { selected: boolean[][], tempo: number } | null {
  try {
    const [rowsStr, tempoStr] = str.split(",");
    if (!rowsStr || !tempoStr) return null;
    const rows = rowsStr.split(".");
    if (rows.length !== samples.length) return null;
    const selected = rows.map(rowStr => {
      const bits = parseInt(rowStr, 36);
      return Array.from({ length: numSteps }, (_, i) => ((bits >> i) & 1) === 1);
    });
    const tempo = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, parseInt(tempoStr, 10)));
    return { selected, tempo };
  } catch {
    return null;
  }
}

// --- WAV Export Helper ---
async function patternToWav(selected: boolean[][], tempo: number, numSteps: number): Promise<Blob> {
  // We'll use the Web Audio API to render the pattern to a buffer, then export as WAV
  // Each step = 16th note, so step duration = 60/tempo/4 seconds
  const stepDuration = 60 / tempo / 4;
  const sampleRate = 44100;

  // --- Find the last step that has any sound ---
  let lastStepWithSound = -1;
  for (let step = numSteps - 1; step >= 0; --step) {
    for (let row = 0; row < selected.length; ++row) {
      if (selected[row][step]) {
        lastStepWithSound = step;
        break;
      }
    }
    if (lastStepWithSound !== -1) break;
  }

  // If no sound at all, just export a single step
  if (lastStepWithSound === -1) lastStepWithSound = 0;

  // --- Find the maximum sample duration for any sound in the last column(s) ---
  // We'll load all sample buffers, and for each sound in the last step, get its duration
  const ctx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    1, 1, sampleRate // dummy, will be replaced
  );
  async function fetchSampleBuffer(filename: string): Promise<AudioBuffer> {
    const res = await fetch(`/audio/${filename}`);
    const arrayBuffer = await res.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  }
  const buffers: AudioBuffer[] = await Promise.all(samples.map(s => fetchSampleBuffer(s.name)));

  let maxSampleDuration = 0;
  for (let row = 0; row < selected.length; ++row) {
    if (selected[row][lastStepWithSound]) {
      maxSampleDuration = Math.max(maxSampleDuration, buffers[row].duration);
    }
  }

  // The total duration is up to the end of the last step, plus the duration of the longest sample played at that step
  const totalDuration = (lastStepWithSound + 1) * stepDuration + maxSampleDuration;

  // Now create a new OfflineAudioContext with the correct length
  const ctx2 = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    1, Math.ceil(totalDuration * sampleRate), sampleRate
  );

  // Schedule all hits
  for (let row = 0; row < selected.length; ++row) {
    for (let step = 0; step < numSteps; ++step) {
      if (selected[row][step]) {
        const when = step * stepDuration;
        const src = ctx2.createBufferSource();
        src.buffer = buffers[row];
        src.connect(ctx2.destination);
        src.start(when);
      }
    }
  }

  // Render
  const rendered = await ctx2.startRendering();

  // Encode to WAV
  function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numFrames = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataLength = numFrames * blockAlign;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    function writeString(offset: number, str: string) {
      for (let i = 0; i < str.length; ++i) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, "data");
    view.setUint32(40, dataLength, true);

    // Interleave and write PCM samples
    let offset = 44;
    for (let i = 0; i < numFrames; ++i) {
      for (let ch = 0; ch < numChannels; ++ch) {
        let sample = audioBuffer.getChannelData(ch)[i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return buffer;
  }

  const wavBuffer = encodeWav(rendered);
  return new Blob([wavBuffer], { type: "audio/wav" });
}

const Beatmaker = () => {
  // --- SSR hydration fix: Only render after client mount ---
  const [mounted, setMounted] = useState(false);

  // --- Check for ?song= in URL on mount ---
  const [initialized, setInitialized] = useState(false);

  // --- Step length state ---
  const [numSteps, setNumSteps] = useState(DEFAULT_NUM_STEPS);

  // --- SSR hydration fix: Only initialize state after mount ---
  const [selected, setSelected] = useState<boolean[][]>(() => getDefaultPattern(DEFAULT_NUM_STEPS));
  const [tempo, setTempo] = useState<number>(() => {
    const decoded = decodePattern(DEFAULT_SONG_STRING, DEFAULT_NUM_STEPS);
    if (decoded) return decoded.tempo;
    return DEFAULT_TEMPO_BPM;
  });

  // On mount, set mounted to true and initialize state from URL if present
  useEffect(() => {
    setMounted(true);
    if (!initialized && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const song = params.get("song");
      if (song) {
        const decoded = decodePattern(song, numSteps);
        if (decoded) {
          setSelected(decoded.selected);
          setTempo(decoded.tempo);
        }
      }
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, numSteps]);

  // When numSteps changes, resize pattern
  useEffect(() => {
    setSelected(prev => {
      // If length matches, do nothing
      if (prev[0]?.length === numSteps) return prev;
      // Resize each row
      return prev.map(row => {
        if (row.length === numSteps) return row;
        if (row.length < numSteps) {
          // Pad with false
          return [...row, ...Array(numSteps - row.length).fill(false)];
        } else {
          // Truncate
          return row.slice(0, numSteps);
        }
      });
    });
  }, [numSteps]);

  // State for current playing step
  const [currentStep, setCurrentStep] = useState(0);

  // State for playing/paused
  const [isPlaying, setIsPlaying] = useState(false);

  // Modal state for delete all confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Modal state for share link
  const [showShareModal, setShowShareModal] = useState(false);

  // Modal state for export
  const [showExportModal, setShowExportModal] = useState(false);

  // State for generated share link
  const [shareLink, setShareLink] = useState<string>("");

  // Export options
  // Only WAV is available
  const [exportFormat] = useState<"wav">("wav");
  // Only 32 steps is available
  const [exportLength] = useState(DEFAULT_NUM_STEPS);

  // Export progress
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Ref to keep track of interval id
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // State to track hovered step (rowIdx, stepIdx)
  const [hoveredStep, setHoveredStep] = useState<{ row: number; step: number } | null>(null);

  // --- Long press tempo change ---
  const tempoChangeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tempoChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tempoChangeActiveRef = useRef(false);

  // --- New: State to track which column is being "flashed" (highlighted) when played by clicking the number
  const [flashedColumn, setFlashedColumn] = useState<number | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Play audio from /audio/{filename}
  const playSound = (filename: string) => {
    const audio = new Audio(`/audio/${filename}`);
    audio.currentTime = 0;
    audio.play();
  };

  // Toggle selection for a given row and step
  const toggleStep = (rowIdx: number, stepIdx: number) => {
    setSelected(prev => {
      const newSelected = prev.map(arr => arr.slice());
      newSelected[rowIdx][stepIdx] = !newSelected[rowIdx][stepIdx];
      return newSelected;
    });
  };

  // Calculate step interval based on tempo
  const stepIntervalMs = (60_000 / tempo) / 4; // 16th notes

  // Start/Stop effect and handle tempo changes
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % numSteps);
      }, stepIntervalMs);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, stepIntervalMs, numSteps]);

  // Play selected sounds at the current step
  useEffect(() => {
    if (!isPlaying) return;
    samples.forEach((sample, rowIdx) => {
      if (selected[rowIdx][currentStep]) {
        playSound(sample.name);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isPlaying]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tempoChangeIntervalRef.current) clearInterval(tempoChangeIntervalRef.current);
      if (tempoChangeTimeoutRef.current) clearTimeout(tempoChangeTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  // Handler to start playback from the beginning
  const handleStart = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

  // Handler to stop playback
  const handleStop = () => {
    setIsPlaying(false);
  };

  // Handler for play/stop toggle button
  const handlePlayToggle = () => {
    if (isPlaying) {
      handleStop();
    } else {
      handleStart();
    }
  };

  // Handler to delete all steps (clear the grid)
  const handleDeleteAll = () => {
    setSelected(Array.from({ length: samples.length }, () => Array(numSteps).fill(false)));
    setShowDeleteModal(false);
  };

  // --- Long press handlers for tempo buttons ---
  // On click, change by 1. On long press, repeat by 1.
  const startTempoChange = useCallback((delta: number) => {
    tempoChangeActiveRef.current = false;
    // Start a timeout: if held, start interval; if released before, only do one change
    tempoChangeTimeoutRef.current = setTimeout(() => {
      tempoChangeActiveRef.current = true;
      tempoChangeIntervalRef.current = setInterval(() => {
        setTempo(prev => {
          let next = prev + delta;
          if (next < MIN_TEMPO) next = MIN_TEMPO;
          if (next > MAX_TEMPO) next = MAX_TEMPO;
          return next;
        });
      }, 45); // Fast repeat
    }, 200); // Hold delay before repeat
  }, []);

  const stopTempoChange = useCallback((delta: number, doSingle: boolean = true) => {
    // If the interval is running, stop it
    if (tempoChangeTimeoutRef.current) {
      clearTimeout(tempoChangeTimeoutRef.current);
      tempoChangeTimeoutRef.current = null;
    }
    if (tempoChangeIntervalRef.current) {
      clearInterval(tempoChangeIntervalRef.current);
      tempoChangeIntervalRef.current = null;
    }
    // If not a long press, do a single change
    if (!tempoChangeActiveRef.current && doSingle) {
      setTempo(prev => {
        let next = prev + delta;
        if (next < MIN_TEMPO) next = MIN_TEMPO;
        if (next > MAX_TEMPO) next = MAX_TEMPO;
        return next;
      });
    }
    tempoChangeActiveRef.current = false;
  }, []);

  // When tempo changes via long press, clamp it
  useEffect(() => {
    setTempo(prev => {
      if (prev < MIN_TEMPO) return MIN_TEMPO;
      if (prev > MAX_TEMPO) return MAX_TEMPO;
      return prev;
    });
  }, [tempo]);

  // Keyboard accessibility for tempo buttons
  const handleTempoButtonKeyDown = (delta: number, e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setTempo(prev => {
        let next = prev + delta;
        if (next < MIN_TEMPO) next = MIN_TEMPO;
        if (next > MAX_TEMPO) next = MAX_TEMPO;
        return next;
      });
    }
  };

  // --- Share Modal logic ---
  const handleShare = () => {
    // Generate the share link
    const encoded = encodePattern(selected, tempo);
    let url: string;
    if (typeof window !== "undefined") {
      const base = window.location.origin + window.location.pathname;
      url = `${base}?song=${encoded}`;
    } else {
      url = `?song=${encoded}`;
    }
    setShareLink(url);
    setShowShareModal(true);
  };

  // --- Export Modal logic ---
  const handleExport = () => {
    setExportError(null);
    setShowExportModal(true);
  };

  // Actual export logic
  const handleExportDownload = async () => {
    setExportError(null);
    setExporting(true);
    try {
      let blob: Blob;
      let filename: string;
      // Only WAV is supported
      blob = await patternToWav(selected, tempo, exportLength);
      filename = "beatmaker-export.wav";
      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      setShowExportModal(false);
    } catch (e: any) {
      setExportError(
        "Export failed. " +
          (e?.message
            ? e.message
            : "Try again or check your browser's permissions.")
      );
    } finally {
      setExporting(false);
    }
  };

  // Copy to clipboard
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (typeof window !== "undefined" && shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  // New: handle clicking the input to copy as well
  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).select();
    if (typeof window !== "undefined" && shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  // --- New: Play all sounds in a column (step) that are selected ---
  const playColumn = (stepIdx: number) => {
    samples.forEach((sample, rowIdx) => {
      if (selected[rowIdx][stepIdx]) {
        playSound(sample.name);
      }
    });
    // Highlight the column for a short time
    setFlashedColumn(stepIdx);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashedColumn(null);
    }, 200); // 200ms flash
  };

  // Keyboard accessibility for column numbers
  const handleColumnKeyDown = (stepIdx: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playColumn(stepIdx);
    }
  };

  // --- SSR hydration fix: Only render after mount ---
  if (!mounted) {
    // Optionally, render a loading skeleton or nothing
    return null;
  }

  return (
    <div className="flex flex-col gap-1 font-mono">
      <div className="flex items-center mb-2 gap-1">
        <button
          className={`px-4 py-2 rounded w-20 text-xs cursor-pointer transition-colors ${
            isPlaying
              ? "bg-red-500/90 text-white hover:bg-red-500/90"
              : "bg-white/40 text-gray-500 hover:bg-white"
          }`}
          onClick={handlePlayToggle}
        >
          {isPlaying ? "Stop" : "Start"}
        </button>
        {/* Custom Tempo Selector */}
        <div className="flex items-center">
          <div
            className="flex items-center w-35 justify-between bg-white/40 rounded py-1 px-1 "
            style={{
              overflow: "hidden",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            <button
              className="w-6 h-6 text-lg font-bold cursor-pointer flex items-center justify-center rounded  hover:bg-white text-gray-500 transition-colors"
              aria-label="Decrease tempo"
              onMouseDown={e => { e.preventDefault(); startTempoChange(-1); }}
              onMouseUp={e => { e.preventDefault(); stopTempoChange(-1); }}
              onMouseLeave={e => { e.preventDefault(); stopTempoChange(-1, false); }}
              onTouchStart={e => { e.preventDefault(); startTempoChange(-1); }}
              onTouchEnd={e => { e.preventDefault(); stopTempoChange(-1); }}
              onKeyDown={e => handleTempoButtonKeyDown(-1, e)}
              tabIndex={0}
              type="button"
            >
                -
            </button>
            <input
              id="tempo-input"
              type="number"
              min={MIN_TEMPO}
              max={MAX_TEMPO}
              value={tempo}
              readOnly
              disabled
              tabIndex={-1}
              className="text-center w-10 -ml-2 text-gray-500 font-mono text-xs hide-scrollbar cursor-not-allowed"
              style={{
                WebkitAppearance: "none",
                MozAppearance: "textfield",
                overflow: "hidden",
                scrollbarWidth: "none",
                pointerEvents: "none",
              }}
            />
            <span className="text-gray-500 text-xs font-mono select-none -ml-6">BPM</span>
            <button
              className="w-6 h-6 text-lg  font-bold cursor-pointer flex items-center justify-center rounded  hover:bg-white text-gray-500 transition-colors"
              aria-label="Increase tempo"
              onMouseDown={e => { e.preventDefault(); startTempoChange(1); }}
              onMouseUp={e => { e.preventDefault(); stopTempoChange(1); }}
              onMouseLeave={e => { e.preventDefault(); stopTempoChange(1, false); }}
              onTouchStart={e => { e.preventDefault(); startTempoChange(1); }}
              onTouchEnd={e => { e.preventDefault(); stopTempoChange(1); }}
              onKeyDown={e => handleTempoButtonKeyDown(1, e)}
              tabIndex={0}
              type="button"
            >
              +
            </button>
          </div>
          <style jsx global>{`
            input[type="number"].hide-scrollbar::-webkit-inner-spin-button,
            input[type="number"].hide-scrollbar::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type="number"].hide-scrollbar {
              -moz-appearance: textfield;
              scrollbar-width: none;
            }
          `}</style>
        </div>
        {/* Step length selector */}
       
        <button
          className="py-2 ml-auto w-26 cursor-pointer bg-white/40 text-gray-500 text-xs hover:bg-white transition-colors rounded"
          onClick={() => setShowDeleteModal(true)}
        >
          Delete All
        </button>
        <button
          className="py-2 w-26 cursor-pointer bg-white/40 text-gray-500 text-xs hover:bg-white transition-colors rounded"
          onClick={handleShare}
        >
          Share
        </button>
        <button
          className="py-2 w-26 cursor-pointer bg-white/40 text-gray-500 text-xs hover:bg-white transition-colors rounded"
          onClick={handleExport}
        >
          Export
        </button>
      </div>
      {/* Modal for delete all confirmation */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white/80 rounded-lg shadow-2xl p-0 flex flex-col items-center min-w-[320px] max-w-[90vw] border-2 border-white/60">
            {/* Modal header */}
            <div className="w-full flex items-center justify-between px-6 pt-4 pb-2">
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Clear Pattern</span>
              <button
                className="w-7 h-7 flex items-center cursor-pointer justify-center rounded hover:bg-white/60 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close"
                onClick={() => setShowDeleteModal(false)}
                tabIndex={0}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            {/* Modal content */}
            <div className="px-6 pt-2 pb-4 w-full flex flex-col items-center">
              <div className="mb-2 text-base font-bold text-gray-700 text-center">Delete all steps?</div>
              <div className="mb-4 text-xs text-gray-500 text-center">
                This will clear <span className="font-semibold text-gray-700">all</span> steps in the grid.
              </div>
              <div className="flex gap-3 w-full">
                <button
                  className="flex-1 py-2 rounded bg-red-500 cursor-pointer text-white text-xs font-bold hover:bg-red-500/90 transition-colors border border-transparent focus:ring-2"
                  onClick={handleDeleteAll}
                  autoFocus
                >
                  Delete All
                </button>
                <button
                  className="flex-1 py-2 rounded border cursor-pointer text-xs font-bold hover:bg-white transition-colors border-gray-500 "
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal for share link */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white/80 rounded-lg shadow-2xl p-0 flex flex-col items-center min-w-[320px] max-w-[90vw] border-2 border-white/60">
            {/* Modal header */}
            <div className="w-full flex items-center justify-between px-6 pt-4 pb-2">
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Share Song</span>
              <button
                className="w-7 h-7 flex items-center cursor-pointer justify-center rounded hover:bg-white/60 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close"
                onClick={() => setShowShareModal(false)}
                tabIndex={0}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            {/* Modal content */}
            <div className="px-6 pt-2 pb-4 w-full flex flex-col items-center">
              <div className="mb-2 text-base font-bold text-gray-700 text-center">Share your song!</div>
              <div className="mb-4 text-xs text-gray-500 text-center">
                Copy and share this link to let others play your beat.
              </div>
              <div className="flex flex-col gap-2 w-full">
                <input
                  className="w-full px-2 py-1 rounded border text-xs font-mono text-gray-700 bg-white/90 mb-2"
                  value={shareLink}
                  readOnly
                  onFocus={e => e.target.select()}
                  style={{ cursor: "pointer" }}
                  onClick={handleInputClick}
                />
                <div className="flex gap-3 w-full">
                  <button
                    className="flex-1 py-2 rounded bg-blue-500 cursor-pointer text-white text-xs font-bold hover:bg-blue-600 transition-colors border border-transparent focus:ring-2"
                    onClick={handleCopy}
                    autoFocus
                  >
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                  <button
                    className="flex-1 py-2 rounded border cursor-pointer text-xs font-bold hover:bg-white transition-colors border-gray-500 "
                    onClick={() => setShowShareModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal for export options */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white/80 rounded-lg shadow-2xl p-0 flex flex-col items-center min-w-[320px] max-w-[90vw] border-2 border-white/60">
            {/* Modal header */}
            <div className="w-full flex items-center justify-between px-6 pt-4 pb-2">
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Export Song </span>
              <button
                className="w-7 h-7 flex items-center cursor-pointer justify-center rounded hover:bg-white/60 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close"
                onClick={() => setShowExportModal(false)}
                tabIndex={0}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            {/* Modal content */}
            <div className="px-6 pt-2 pb-4 w-full flex flex-col items-center">
              <div className="mb-2 text-base font-bold text-gray-700 text-center">Export your song (EXPERIMENTAL)</div>
              <div className="mb-2 text-xs text-red-500 text-center">
                If the page becomes unresponsive, press WAIT.
              </div>
              <div className="flex flex-col gap-2 w-full">
                
                {exportError && (
                  <div className="text-xs text-red-500 font-mono mt-1">{exportError}</div>
                )}
                <div className="flex gap-3 w-full mt-2">
                  <button
                    className="flex-1 py-2 rounded bg-blue-500 cursor-pointer text-white text-xs font-bold hover:bg-blue-600 transition-colors border border-transparent focus:ring-2 disabled:opacity-60"
                    onClick={handleExportDownload}
                    autoFocus
                    disabled={exporting}
                  >
                    {exporting ? "Exporting..." : "Export"}
                  </button>
                  <button
                    className="flex-1 py-2 rounded border cursor-pointer text-xs font-bold hover:bg-white transition-colors border-gray-500 "
                    onClick={() => setShowExportModal(false)}
                    disabled={exporting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Render the sample label (pink button) separately, then N step buttons */}
      {samples.map((sample, rowIdx) => {
        const selectedColor = rowSelectedColors[rowIdx % rowSelectedColors.length];
        return (
          <div key={sample.name} className="flex gap-1 items-center">
            <button
              className="w-20 h-8 rounded user-select-none bg-white/40 cursor-pointer hover:bg-white text-gray-500 flex items-center justify-center text-xs font-mono"
              onClick={() => playSound(sample.name)}
              tabIndex={0}
              role="button"
              aria-label={`Play ${sample.label}`}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  playSound(sample.name);
                }
              }}
            >
              {sample.label}
            </button>
            {Array.from({ length: numSteps }).map((_, stepIdx) => {
              const isSelected = selected[rowIdx][stepIdx];
              const isHovered =
                hoveredStep &&
                hoveredStep.row === rowIdx &&
                hoveredStep.step === stepIdx;
              let stepClass = `w-8 h-8 rounded cursor-pointer flex items-center justify-center transition-colors duration-100 `;
              if (isSelected) {
                stepClass += selectedColor + " ";
              } else if (isHovered) {
                stepClass += "bg-white ";
              } else {
                stepClass += "bg-white/40 ";
              }
              // Highlight if playing or if this column is being flashed
              if ((currentStep === stepIdx && isPlaying) || flashedColumn === stepIdx) {
                stepClass += "ring-4 ring-white ";
              }
              return (
                <div
                  key={stepIdx}
                  className={stepClass}
                  onMouseEnter={() => setHoveredStep({ row: rowIdx, step: stepIdx })}
                  onMouseLeave={() => setHoveredStep(prev =>
                    prev && prev.row === rowIdx && prev.step === stepIdx ? null : prev
                  )}
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  onClick={e => {
                    toggleStep(rowIdx, stepIdx);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Toggle step ${stepIdx + 1} for ${sample.label}`}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      toggleStep(rowIdx, stepIdx);
                    }
                  }}
                ></div>
              );
            })}
          </div>
        );
      })}
      {/* Add row of numbers 1,2,...,N under each column, aligned with step buttons */}
      <div className="flex gap-1">
        <div className="w-20 h-6 flex items-center justify-center text-xs font-bold bg-white/40 rounded text-gray-500 cursor-pointer select-none">
          +
        </div>
        <div className="w-16 h-4 flex items-center justify-center text-xs font-mono text-white"></div>
        {Array.from({ length: numSteps }).map((_, stepIdx) => (
          <div
            key={stepIdx}
            className="w-8 h-6 flex items-center justify-center text-xs font-mono bg-white/40 rounded text-gray-500 cursor-pointer select-none"
            tabIndex={0}
            role="button"
            aria-label={`Play column ${stepIdx + 1}`}
            onClick={() => playColumn(stepIdx)}
            onKeyDown={e => handleColumnKeyDown(stepIdx, e)}
          >
            {stepIdx + 1}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Beatmaker;
