"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

// Expanded samples to accommodate for chord, percussion, tom, water-drop
type Sample = {
  name: string;
  label: string;
  isUserSample?: boolean;
};

const defaultSamples: Sample[] = [
  { name: "closed-hihat.mp3", label: "Closed HH" },
  { name: "open-hihat.mp3", label: "Open HH" },
  { name: "snare.mp3", label: "Snare" },
  { name: "kick-drum.mp3", label: "Kick" },
  { name: "chord.mp3", label: "Chord" },
  { name: "percussion.mp3", label: "Perc" },
  { name: "tom.mp3", label: "Tom" },
  { name: "water-drop.mp3", label: "Drop" },
];

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
function getDefaultPattern(numSteps = DEFAULT_NUM_STEPS, sampleCount = defaultSamples.length) {
  // If a valid DEFAULT_SONG_STRING is set, use it
  const decoded = decodePattern(DEFAULT_SONG_STRING, numSteps, sampleCount);
  if (decoded) {
    return decoded.selected;
  }
  // Fallback to hardcoded Billie Jean groove
  const pattern = Array.from({ length: sampleCount }, () =>
    Array(numSteps).fill(false)
  );

  // Closed HH: 16th-note groove, skip every 4th for swing
  if (sampleCount > 0) [0, 4, 8, 11, 14, 18, 20, 24, 27, 30].forEach(i => { if (i < numSteps) pattern[0][i] = true; });

  // Open HH: occasional off-beat accent (steps 7, 23)
  if (sampleCount > 1) [2, 16].forEach(i => { if (i < numSteps) pattern[1][i] = true; });

  // Snare: backbeat + a ghost snare
  if (sampleCount > 2) [4, 20, 25, 26, 28, 29, 30, 31].forEach(i => { if (i < numSteps) pattern[2][i] = true; });

  // Kick: funky groove with syncopation
  if (sampleCount > 3) [0, 6, 14, 20, 30].forEach(i => { if (i < numSteps) pattern[3][i] = true; });

  // Chords: laid-back harmony hits (steps 0, 16)
  if (sampleCount > 4) [0, 4, 8, 11, 14, 18, 20, 24, 27, 30].forEach(i => { if (i < numSteps) pattern[4][i] = true; });

  // Perc: groove texture, slightly offbeat
  if (sampleCount > 5) [8, 11, 14, 30].forEach(i => { if (i < numSteps) pattern[5][i] = true; });

  // Tom: short fill at end of bar 2
  if (sampleCount > 6) [20].forEach(i => { if (i < numSteps) pattern[6][i] = true; });

  // Drop: melodic hook at phrase end
  if (sampleCount > 7) [11, 27].forEach(i => { if (i < numSteps) pattern[7][i] = true; });

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
// Accepts sampleCount for dynamic sample rows
function decodePattern(str: string, numSteps = DEFAULT_NUM_STEPS, sampleCount = defaultSamples.length): { selected: boolean[][], tempo: number } | null {
  try {
    const [rowsStr, tempoStr] = str.split(",");
    if (!rowsStr || !tempoStr) return null;
    const rows = rowsStr.split(".");
    if (rows.length !== sampleCount) return null;
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

const Beatmaker = () => {
  // --- SSR hydration fix: Only render after client mount ---
  const [mounted, setMounted] = useState(false);

  // --- Check for ?song= in URL on mount ---
  const [initialized, setInitialized] = useState(false);

  // --- Step length state ---
  // NOTE: setNumSteps is intentionally omitted to avoid unused variable warning.
  const [numSteps] = useState(DEFAULT_NUM_STEPS);

  // --- Dynamic samples state (allow user to add) ---
  const [samples, setSamples] = useState<Sample[]>([...defaultSamples]);
  // --- Track user sample object URL for cleanup ---
  const [userSampleUrl, setUserSampleUrl] = useState<string | null>(null);

  // --- SSR hydration fix: Only initialize state after mount ---
  const [selected, setSelected] = useState<boolean[][]>(() => getDefaultPattern(DEFAULT_NUM_STEPS, defaultSamples.length));
  const [tempo, setTempo] = useState<number>(() => {
    const decoded = decodePattern(DEFAULT_SONG_STRING, DEFAULT_NUM_STEPS, defaultSamples.length);
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
        const decoded = decodePattern(song, numSteps, samples.length);
        if (decoded) {
          setSelected(decoded.selected);
          setTempo(decoded.tempo);
        }
      }
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, numSteps, samples.length]);

  // When numSteps or samples changes, resize pattern
  useEffect(() => {
    setSelected(prev => {
      // If shape matches, do nothing
      if (prev.length === samples.length && prev[0]?.length === numSteps) return prev;
      // Adjust rows
      let newSelected = prev.map(row => {
        if (row.length === numSteps) return row;
        if (row.length < numSteps) {
          // Pad with false
          return [...row, ...Array(numSteps - row.length).fill(false)];
        } else {
          // Truncate
          return row.slice(0, numSteps);
        }
      });
      // Add new row if needed
      if (samples.length > newSelected.length) {
        for (let i = newSelected.length; i < samples.length; ++i) {
          newSelected.push(Array(numSteps).fill(false));
        }
      }
      // Remove extra rows if needed
      if (samples.length < newSelected.length) {
        newSelected = newSelected.slice(0, samples.length);
      }
      return newSelected;
    });
  }, [numSteps, samples.length]);

  // State for current playing step
  const [currentStep, setCurrentStep] = useState(0);

  // State for playing/paused
  const [isPlaying, setIsPlaying] = useState(false);

  // Modal state for delete all confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Modal state for share link
  const [showShareModal, setShowShareModal] = useState(false);

  // State for generated share link
  const [shareLink, setShareLink] = useState<string>("");

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

  // Play audio from /audio/{filename} or user sample
  const playSound = (filename: string, isUserSample = false) => {
    let audio: HTMLAudioElement;
    if (isUserSample && userSampleUrl) {
      audio = new Audio(userSampleUrl);
    } else {
      audio = new Audio(`/audio/${filename}`);
    }
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
        playSound(sample.name, !!sample.isUserSample);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isPlaying, samples, selected, userSampleUrl]);

  // Clean up interval and user sample URL on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tempoChangeIntervalRef.current) clearInterval(tempoChangeIntervalRef.current);
      if (tempoChangeTimeoutRef.current) clearTimeout(tempoChangeTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (userSampleUrl) URL.revokeObjectURL(userSampleUrl);
    };
    // eslint-disable-next-line
  }, [userSampleUrl]);

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
        playSound(sample.name, !!sample.isUserSample);
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

  // --- Handle user sample upload ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleAddSampleClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "audio/mp3" && file.type !== "audio/mpeg") {
      setUploadError("Only MP3 files are supported.");
      return;
    }
    // Clean up previous user sample URL
    if (userSampleUrl) {
      URL.revokeObjectURL(userSampleUrl);
    }
    const url = URL.createObjectURL(file);
    setUserSampleUrl(url);
    // Add new sample row
    setSamples(prev => [
      ...prev,
      {
        name: file.name,
        label: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        isUserSample: true,
      },
    ]);
    // Add new row to selected
    setSelected(prev => [
      ...prev,
      Array(numSteps).fill(false),
    ]);
    // Reset file input value so user can upload the same file again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      {/* Render the sample label (pink button) separately, then N step buttons */}
      {samples.map((sample, rowIdx) => {
        const selectedColor = rowSelectedColors[rowIdx % rowSelectedColors.length];
        return (
          <div key={sample.label + rowIdx} className="flex gap-1 items-center">
            <button
              className="w-20 h-8 rounded user-select-none bg-white/40 cursor-pointer hover:bg-white text-gray-500 flex items-center justify-center text-xs font-mono"
              onClick={() => playSound(sample.name, !!sample.isUserSample)}
              tabIndex={0}
              role="button"
              aria-label={`Play ${sample.label}`}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  playSound(sample.name, !!sample.isUserSample);
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
        <button
          className="w-20 h-6 flex -mr-1 items-center justify-center text-xs font-bold bg-white/40 rounded text-gray-500 cursor-pointer select-none hover:bg-white transition-colors"
          aria-label="Add your own sound (MP3)"
          onClick={handleAddSampleClick}
          tabIndex={0}
          type="button"
        >
          +
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp3,audio/mpeg"
            style={{ display: "none" }}
            onChange={handleFileChange}
            tabIndex={-1}
          />
        </button>
        <div className="h-4 flex items-center justify-center text-xs font-mono text-white"></div>
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
      {uploadError && (
        <div className="text-xs text-red-500 mt-1">{uploadError}</div>
      )}


    </div>
  );
};

export default Beatmaker;
