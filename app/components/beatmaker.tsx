"use client";
import React, { useState, useEffect, useRef } from "react";

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

const NUM_STEPS = 32;
const DEFAULT_TEMPO_BPM = 120; // More energetic for a banger
const MIN_TEMPO = 60;
const MAX_TEMPO = 240;

// Default pattern: "Billie Jean" by Michael Jackson (instantly recognizable groove)
function getDefaultPattern() {
    const pattern = Array.from({ length: samples.length }, () =>
      Array(NUM_STEPS).fill(false)
    );
  
    // Closed HH: 16th-note groove, skip every 4th for swing
    for (let i = 0; i < NUM_STEPS; i++) {
      if (i % 2 === 0 && i % 4 !== 0) {
        pattern[0][i] = true;
      }
    }
  
    // Open HH: occasional off-beat accent (steps 7, 23)
    [7, 23].forEach(i => (pattern[1][i] = true));
  
    // Snare: backbeat + a ghost snare
    [4, 12, 20, 28, 11].forEach(i => (pattern[2][i] = true));
  
    // Kick: funky groove with syncopation
    [0, 3, 8, 11, 16, 19, 24, 27].forEach(i => (pattern[3][i] = true));
  
    // Chords: laid-back harmony hits (steps 0, 16)
    [0, 16].forEach(i => (pattern[4][i] = true));
  
    // Perc: groove texture, slightly offbeat
    [5, 13, 21, 29].forEach(i => (pattern[5][i] = true));
  
    // Tom: short fill at end of bar 2
    [30, 31].forEach(i => (pattern[6][i] = true));
  
    // Drop: melodic hook at phrase end
    [15, 31].forEach(i => (pattern[7][i] = true));
  
    return pattern;
  }

const Beatmaker = () => {
  // State to track selected steps: 2D array [row][step]
  const [selected, setSelected] = useState(getDefaultPattern);

  // State for current playing step
  const [currentStep, setCurrentStep] = useState(0);

  // State for playing/paused
  const [isPlaying, setIsPlaying] = useState(false);

  // State for tempo
  const [tempo, setTempo] = useState(DEFAULT_TEMPO_BPM);

  // Modal state for delete all confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Ref to keep track of interval id
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
        setCurrentStep(prev => (prev + 1) % NUM_STEPS);
      }, stepIntervalMs);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, stepIntervalMs]);

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
    };
  }, []);

  // Handler to start playback from the beginning
  const handleStart = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

  // Handler to delete all steps (clear the grid)
  const handleDeleteAll = () => {
    setSelected(Array.from({ length: samples.length }, () => Array(NUM_STEPS).fill(false)));
    setShowDeleteModal(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center mb-4 p-2">
        <button
          className={`px-4 py-2 font-bold mr-2 ${
            isPlaying ? "bg-gray-400 text-white" : "bg-green-600 text-white"
          }`}
          onClick={handleStart}
          disabled={isPlaying}
        >
          Start
        </button>
        <button
          className={`px-4 py-2 font-bold ${
            !isPlaying ? "bg-gray-400 text-white" : "bg-red-600 text-white"
          }`}
          onClick={() => setIsPlaying(false)}
          disabled={!isPlaying}
        >
          Stop
        </button>
        <button
          className="px-4 py-2 font-bold bg-gray-800 text-white ml-4 hover:bg-gray-600 transition-colors rounded"
          onClick={() => setShowDeleteModal(true)}
        >
          Delete All
        </button>
        <div className="ml-4 flex items-center">
          <label htmlFor="tempo-input" className="mr-2 font-mono text-white">
            Tempo:
          </label>
          <input
            id="tempo-input"
            type="number"
            min={MIN_TEMPO}
            max={MAX_TEMPO}
            value={tempo}
            onChange={e => {
              let val = parseInt(e.target.value, 10);
              if (isNaN(val)) val = DEFAULT_TEMPO_BPM;
              if (val < MIN_TEMPO) val = MIN_TEMPO;
              if (val > MAX_TEMPO) val = MAX_TEMPO;
              setTempo(val);
            }}
            className="w-20 px-2 py-1 rounded text-black font-mono"
          />
          <span className="ml-2 text-white font-mono w-12 text-right">{tempo} BPM</span>
        </div>
      </div>
      {/* Modal for delete all confirmation */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center min-w-[300px]">
            <div className="mb-4 text-lg font-bold text-gray-800">Are you sure?</div>
            <div className="mb-6 text-gray-700 text-center">
              This will clear <span className="font-semibold">all</span> steps in the grid.
            </div>
            <div className="flex gap-4">
              <button
                className="px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-colors"
                onClick={handleDeleteAll}
                autoFocus
              >
                Yes, Delete All
              </button>
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded font-bold hover:bg-gray-400 transition-colors"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Render the sample label (pink button) separately, then 32 step buttons */}
      {samples.map((sample, rowIdx) => (
        <div key={sample.name} className="flex gap-1 items-center">
          <div
            className="w-16 h-8 border-2 bg-pink-500 cursor-pointer flex items-center justify-center text-xs font-mono"
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
          </div>
          {Array.from({ length: NUM_STEPS }).map((_, stepIdx) => (
            <div
              key={stepIdx}
              className={`w-8 h-8 rounded cursor-pointer flex items-center justify-center transition-colors duration-100
                ${
                  selected[rowIdx][stepIdx]
                    ? "bg-blue-500"
                    : "bg-gray-500"
                }
                ${
                  currentStep === stepIdx && isPlaying
                    ? "ring-4 ring-yellow-400"
                    : ""
                }
              `}
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
          ))}
        </div>
      ))}
      {/* Add row of numbers 1,2,...,32 under each column, aligned with step buttons */}
      <div className="flex gap-1 mt-1">
        <div className="w-16 h-4 flex items-center justify-center text-xs font-mono text-white"></div>
        {Array.from({ length: NUM_STEPS }).map((_, stepIdx) => (
          <div
            key={stepIdx}
            className="w-8 h-4 flex items-center justify-center text-xs font-mono text-white"
          >
            {stepIdx + 1}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Beatmaker;
