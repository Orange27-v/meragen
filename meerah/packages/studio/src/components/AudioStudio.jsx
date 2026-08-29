"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { sanitiseHelp } from "./rail/sanitise";
import ToolShowcase from "./rail/ToolShowcase";
import { QualityPicker, useQualityTiers } from "./rail/QualityPicker";
import { CostMeter } from "./rail/CostMeter";
import toast, { Toaster } from "react-hot-toast";
import { generateAudio, uploadFile, getUserBalance } from "../muapi.js";
import { formatErrorMessage } from "../utils/formatError.js";
import { scopedPersistKey, migrateLegacyPersistKey } from "../persistKey.js";
import { audioModels, getAudioModelById } from "../models.js";

/**
 * What each audio model is called to a customer.
 *
 * The catalogue names them after the vendor that supplies them, which tells our
 * customers who to buy from directly and means nothing to someone who just
 * wants a song. The ids underneath are untouched.
 */
const AUDIO_LABELS = {
  "suno-create-music":            { name: "Make a song",        blurb: "A full track with vocals and instruments from a description." },
  "suno-remix-music":             { name: "Remix a song",       blurb: "Rework a track you already have into a new style." },
  "suno-extend-music":            { name: "Make it longer",     blurb: "Continue an existing track past where it ends." },
  "suno-generate-sounds":         { name: "Sound effects",      blurb: "Short effects and background noise." },
  "suno-add-vocals":              { name: "Add singing",        blurb: "Put a vocal line over an instrumental." },
  "suno-generate-mashup":         { name: "Mash two together",  blurb: "Blend two tracks into one." },
  "suno-add-instrumental":        { name: "Add backing",        blurb: "Build instruments around a vocal." },
  "suno-voice-clone":             { name: "Copy a singing voice", blurb: "Reuse a singing voice on a new track." },
  "minimax-voice-clone":          { name: "Copy a speaking voice", blurb: "Reuse a speaking voice on new lines." },
  "minimax-speech-2.6-hd":        { name: "Voiceover, best quality", blurb: "Clear narration. Slower to make." },
  "minimax-speech-2.6-turbo":     { name: "Voiceover, quick",   blurb: "Fast narration for drafts." },
  "mmaudio-v2-text-to-audio":     { name: "Audio from words",   blurb: "General audio from a description." },
  "elevenlabs-text-to-dialogue-v3": { name: "Two people talking", blurb: "A scripted conversation between voices." },
  "suno-convert-to-wav":          { name: "Convert to WAV",     blurb: "Studio-quality file for editing." },
  "gemini-3-1-flash-tts":         { name: "Read this out, quick", blurb: "Fast text to speech." },
  "gemini-2-5-pro-tts":           { name: "Read this out, best", blurb: "Higher-quality text to speech." },
  "elevenlabs-tts-turbo-2-5":     { name: "Narration, fastest", blurb: "The quickest voiceover option." },
};

const audioLabel = (model) =>
  AUDIO_LABELS[model.id] || { name: model.name, blurb: model.description };

// ---------------------------------------------------------------------------
// Upload button states
// ---------------------------------------------------------------------------
const UPLOAD_STATE = {
  IDLE: "idle",
  UPLOADING: "uploading",
  READY: "ready",
};

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const VolumeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const VolumeMuteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const MusicIcon = ({ className = "text-[var(--chalk)]" }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// ---------------------------------------------------------------------------
// Single File Uploader Component
// ---------------------------------------------------------------------------
function AudioFileUploader({ label, value, onChange, apiKey }) {
  const [uploadState, setUploadState] = useState(value ? UPLOAD_STATE.READY : UPLOAD_STATE.IDLE);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState(value ? value.split('/').pop().slice(-30) : "");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setUploadState(UPLOAD_STATE.IDLE);
      setFileName("");
      setProgress(0);
    } else if (uploadState !== UPLOAD_STATE.READY) {
      setUploadState(UPLOAD_STATE.READY);
      setFileName(value.split('/').pop().slice(-30));
    }
  }, [value]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("Audio file exceeds 20MB limit.");
      return;
    }

    setUploadState(UPLOAD_STATE.UPLOADING);
    setProgress(0);

    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setProgress(pct);
      });
      setFileName(file.name);
      setUploadState(UPLOAD_STATE.READY);
      onChange(url);
    } catch (err) {
      setUploadState(UPLOAD_STATE.IDLE);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setProgress(0);
    }
  };

  const clearFile = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[var(--chalk)] uppercase tracking-wider">
          {label}
        </label>
        {uploadState === UPLOAD_STATE.READY && (
          <button
            type="button"
            onClick={clearFile}
            className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider flex items-center gap-1.5"
          >
            <TrashIcon /> Clear
          </button>
        )}
      </div>

      <div 
        onClick={() => uploadState === UPLOAD_STATE.IDLE && fileInputRef.current?.click()}
        className={`relative border rounded p-4 transition-all duration-300 flex items-center gap-3.5 cursor-pointer ${
          uploadState === UPLOAD_STATE.READY 
            ? "border-[var(--line)] bg-[var(--slab-hi)] shadow-[0_0_15px_rgba(34,211,238,0.05)]" 
            : "border-[var(--line)] bg-[var(--sunk)] hover:bg-[var(--night)] hover:border-[var(--line-hi)]"
        }`}
      >
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="audio/*" 
          className="hidden" 
          onChange={handleUpload} 
        />

        {uploadState === UPLOAD_STATE.IDLE && (
          <>
            <div className="w-10 h-10 rounded bg-[var(--night)] flex items-center justify-center text-[var(--chalk)] border border-[var(--line)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-[var(--chalk)]">Upload audio track</div>
              <div className="text-[11px] text-[var(--iron)] font-medium mt-0.5">MP3, WAV, M4A up to 20MB</div>
            </div>
          </>
        )}

        {uploadState === UPLOAD_STATE.UPLOADING && (
          <div className="w-full flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-[color-mix(in_srgb,var(--chalk)_95%,transparent)] mb-1.5 font-bold">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-[var(--night)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--slab-hi)] transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}

        {uploadState === UPLOAD_STATE.READY && (
          <>
            <div className="w-10 h-10 rounded bg-[var(--slab-hi)] flex items-center justify-center text-[var(--lilac)] border border-[var(--line)]">
              <MusicIcon className="text-[var(--lilac)]" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-xs font-bold text-[var(--chalk)] truncate">{fileName}</div>
              <div className="text-[11px] text-[var(--lilac)] font-bold mt-0.5">Ready to generate</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiple File Uploader Component (for array fields like audios_list)
// ---------------------------------------------------------------------------
function AudioListUploader({ label, value = [], onChange, apiKey, maxItems = 2 }) {
  const handleItemChange = (index, url) => {
    const newItems = [...value];
    if (url) {
      newItems[index] = url;
    } else {
      newItems.splice(index, 1);
    }
    onChange(newItems.filter(Boolean));
  };

  return (
    <div className="space-y-4">
      <label className="block text-xs font-bold text-[var(--chalk)] uppercase tracking-wider">
        {label} (Max {maxItems})
      </label>
      <div className="space-y-3">
        {Array.from({ length: maxItems }).map((_, i) => (
          <AudioFileUploader
            key={i}
            label={`Track #${i + 1}`}
            value={value[i] || null}
            onChange={(url) => handleItemChange(i, url)}
            apiKey={apiKey}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Premium Custom Audio Player with Waveform Animation
// ---------------------------------------------------------------------------
function PremiumAudioPlayer({ url, title }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const visualizerIntervalRef = useRef(null);
  const [visualizerHeights, setVisualizerHeights] = useState(Array(18).fill(15));

  // Reset player when URL changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [url]);

  // Audio state event listeners
  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Toggle playback
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Audio playback error:", err);
      });
    }
  };

  // Equalizer visualizer effect
  useEffect(() => {
    if (isPlaying) {
      visualizerIntervalRef.current = setInterval(() => {
        setVisualizerHeights(
          Array(18).fill(0).map(() => Math.floor(Math.random() * 32) + 6)
        );
      }, 100);
    } else {
      if (visualizerIntervalRef.current) {
        clearInterval(visualizerIntervalRef.current);
      }
      setVisualizerHeights(Array(18).fill(12));
    }
    return () => {
      if (visualizerIntervalRef.current) clearInterval(visualizerIntervalRef.current);
    };
  }, [isPlaying]);

  // Volume control
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (val === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // Scrubbing
  const handleScrub = (e) => {
    if (!audioRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const seekTime = Math.min(Math.max(pos * duration, 0), duration);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Helper formatting time
  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const downloadAudio = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = title ? `${title.replace(/\s+/g, '_')}.mp3` : "generated_audio.mp3";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="w-full bg-[var(--sunk)] border border-[var(--line)] rounded p-6 shadow-3xl space-y-6 backdrop-blur-md">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onAudioEnded}
        preload="auto"
      />

      {/* Visualizer and Track Details */}
      <div className="flex flex-col items-center justify-center py-6 relative rounded bg-[var(--surface)] overflow-hidden border border-[var(--line)]">
        <div className="flex items-center gap-1.5 h-12 mb-4 justify-center">
          {visualizerHeights.map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-gradient-to-t from-primary to-[var(--action)] transition-all duration-100"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <div className="text-center px-4 max-w-full relative z-10">
          <span className="text-xs font-black text-[var(--lilac)] uppercase tracking-[0.2em] block mb-1">
            Now Playing
          </span>
          <p className="text-[var(--chalk)] font-bold text-base truncate max-w-xs">{title || "Generated Track"}</p>
        </div>
      </div>

      {/* Controls & Progress bar */}
      <div className="space-y-4">
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[var(--chalk)] w-10 text-right">
            {formatTime(currentTime)}
          </span>
          
          <div
            ref={progressBarRef}
            onClick={handleScrub}
            className="flex-1 h-2 bg-[var(--slab)] hover:bg-[var(--slab)] rounded-full cursor-pointer relative group transition-colors"
          >
            <div 
              className="absolute left-0 top-0 bottom-0 bg-[var(--slab-hi)] rounded-full group-hover:bg-[var(--slab-hi)]/95 transition-all"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
            <div 
              className="absolute w-3.5 h-3.5 bg-[var(--surface)] rounded-full -top-[3px] shadow-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 7px)` }}
            />
          </div>

          <span className="text-xs font-bold text-[var(--chalk)] w-10 text-left">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          {/* Volume Control */}
          <div className="flex items-center gap-2 group/volume w-24">
            <button
              onClick={toggleMute}
              className="p-2 bg-[var(--night)] border border-[var(--line)] hover:bg-[var(--slab)] rounded text-[var(--chalk)] hover:text-[var(--chalk)] transition-all"
              title="Mute/Unmute"
              type="button"
            >
              {isMuted ? <VolumeMuteIcon /> : <VolumeIcon />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-[var(--slab)] rounded appearance-none cursor-pointer accent-primary hover:bg-[var(--slab-hi)] transition-all opacity-0 group-hover/volume:opacity-100"
            />
          </div>

          {/* Main Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="w-12 h-12 bg-[var(--slab-hi)] hover:bg-white text-[var(--chalk)] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-black/40"
            title={isPlaying ? "Pause" : "Play"}
            type="button"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Download Button */}
          <button
            onClick={downloadAudio}
            className="px-4 py-2 bg-[var(--night)] hover:bg-[var(--slab)] border border-[var(--line)] rounded text-xs font-bold text-[var(--chalk)] flex items-center gap-2 hover:border-[var(--line-hi)] transition-all"
            title="Download Audio"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Audio Studio Component
// ---------------------------------------------------------------------------
export default function AudioStudio({
  apiKey,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  historyItems,
  droppedFiles,
  onFilesHandled,
}) {
  const LEGACY_PERSIST_KEY = "hg_audio_studio_persistent";
  const PERSIST_KEY = scopedPersistKey(LEGACY_PERSIST_KEY, apiKey);
  useEffect(() => {
    migrateLegacyPersistKey(LEGACY_PERSIST_KEY, PERSIST_KEY);
  }, [PERSIST_KEY]);

  // ── Mode & model state ──────────────────────────────────────────────────
  const [selectedModelId, setSelectedModelId] = useState(audioModels[0]?.id ?? "");
  const [params, setParams] = useState({});
  const [openDropdown, setOpenDropdown] = useState(false);
  const [openParamDropdown, setOpenParamDropdown] = useState(null);
  const modelBtnRef = useRef(null);
  const sidebarRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setOpenDropdown(false);
        setOpenParamDropdown(null);
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  // ── Generation state ──────────────────────────────────────────────────
  const [selectedTierId, setSelectedTierId] = useState("audio");
  const [creditBalance, setCreditBalance] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [activeResultUrl, setActiveResultUrl] = useState(null);
  const [activeResultTitle, setActiveResultTitle] = useState("");
  const [view, setView] = useState("input"); // 'input' | 'result'

  // ── History state ────────────────────────────────────────────────────
  const [internalHistory, setInternalHistory] = useState([]);
  const history = historyItems ?? internalHistory;
  const [activeHistoryIdx, setActiveHistoryIdx] = useState(0);

  const selectedModel = getAudioModelById(selectedModelId);

  // ── Initialize params when model changes ──────────────────────────────
  useEffect(() => {
    if (!selectedModel) return;
    const initial = {};
    Object.entries(selectedModel.inputs || {}).forEach(([key, schema]) => {
      // Don't overwrite parameters like vocal upload, list etc. if they are already in state
      if (params[key] !== undefined) {
        initial[key] = params[key];
      } else {
        initial[key] = schema.default !== undefined ? schema.default : "";
      }
    });
    setParams(initial);
  }, [selectedModelId]); // Only reset when model ID changes

  // ── Persistence: Load ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.selectedModelId) setSelectedModelId(data.selectedModelId);
        if (data.params) setParams(data.params);
        if (data.internalHistory) setInternalHistory(data.internalHistory);
        if (data.activeResultUrl) setActiveResultUrl(data.activeResultUrl);
        if (data.activeResultTitle) setActiveResultTitle(data.activeResultTitle);
        if (data.view) setView(data.view);
      }
    } catch (err) {
      console.warn("Failed to load AudioStudio persistence:", err);
    }
  }, []);

  // ── Persistence: Save ────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const state = {
          selectedModelId,
          params,
          internalHistory,
          activeResultUrl,
          activeResultTitle,
          view,
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("Failed to save AudioStudio persistence:", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedModelId, params, internalHistory, activeResultUrl, activeResultTitle, view]);

  // ── Handle Dropped Files ────────────────────────────────────────────────
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const audioFiles = droppedFiles.filter(f => f.type.startsWith('audio/'));
      if (audioFiles.length > 0 && selectedModel) {
        // Find the first audio input field in the current model
        const firstAudioField = Object.entries(selectedModel.inputs || {}).find(
          ([_, schema]) => schema.field === 'audio'
        );
        const firstAudioListField = Object.entries(selectedModel.inputs || {}).find(
          ([_, schema]) => schema.field === 'audios_list'
        );

        if (firstAudioField) {
          const [key] = firstAudioField;
          // Trigger file upload helper
          uploadFile(apiKey, audioFiles[0], () => {})
            .then(url => {
              setParams(prev => ({ ...prev, [key]: url }));
            })
            .catch(err => alert(`Failed to upload dropped file: ${err.message}`));
        } else if (firstAudioListField) {
          const [key] = firstAudioListField;
          uploadFile(apiKey, audioFiles[0], () => {})
            .then(url => {
              setParams(prev => {
                const currentList = Array.isArray(prev[key]) ? [...prev[key]] : [];
                if (currentList.length < 2) currentList.push(url);
                return { ...prev, [key]: currentList };
              });
            })
            .catch(err => alert(`Failed to upload dropped file: ${err.message}`));
        }
      }
      onFilesHandled?.();
    }
  }, [droppedFiles, onFilesHandled, selectedModel, apiKey]);

  // ── History helpers ─────────────────────────────────────────────────────
  const addToInternalHistory = useCallback((entry) => {
    setInternalHistory((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  const handleSelectHistory = (entry, index) => {
    setActiveResultUrl(entry.url);
    setActiveResultTitle(entry.title || entry.prompt || "Generated Track");
    setActiveHistoryIdx(index);
    setView("result");
  };

  const qualityTiers = useQualityTiers("audio");
  const selectedTier = qualityTiers.find((t) => t.tierId === selectedTierId) || null;

  const handleTierSelect = useCallback((tier) => setSelectedTierId(tier.tierId), []);

  const refreshBalance = useCallback(() => {
    getUserBalance(apiKey).then((r) => setCreditBalance(r.balance)).catch(() => {});
  }, [apiKey]);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  const openTopUp = useCallback(() => {
    window.dispatchEvent(new CustomEvent("meerah:buy-credits"));
  }, []);

  const handleGenerate = async () => {
    if (!selectedModel) return;

    // Check required fields
    if (selectedModel.required) {
      for (const field of selectedModel.required) {
        if (!params[field] || (Array.isArray(params[field]) && params[field].length === 0)) {
          alert(`Please complete the required field: ${selectedModel.inputs?.[field]?.title || field}`);
          return;
        }
      }
    }

    onGenerationStart?.();
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const audioParams = {
        ...params,
        _modelId: selectedModelId,
      };

      // Call generateAudio
      const res = await generateAudio(apiKey, audioParams);

      if (!res?.url) {
        throw new Error("No audio URL returned by the API.");
      }

      const title = params.title || params.prompt || `${audioLabel(selectedModel).name}`;
      const entry = {
        id: res.id || Date.now().toString(),
        url: res.url,
        title,
        prompt: params.prompt || "",
        model: selectedModelId,
        timestamp: new Date().toISOString(),
      };

      if (!historyItems) addToInternalHistory(entry);

      setActiveResultUrl(res.url);
      setActiveResultTitle(title);
      setView("result");
      setActiveHistoryIdx(0);

      if (onGenerationComplete) {
        onGenerationComplete({
          url: res.url,
          model: selectedModelId,
          prompt: params.prompt,
          type: "audio",
        });
      }
    } catch (e) {
      console.error("[AudioStudio]", e);
      const errMsg = formatErrorMessage(e, "Audio generation failed");
      if (onGenerationError) onGenerationError(errMsg);
      else toast.error(errMsg);
    } finally {
      setIsGenerating(false);
      onGenerationEnd?.();
    }
  };

  const handleNew = () => {
    setView("input");
    setActiveResultUrl(null);
    setActiveResultTitle("");
    // Keep parameters to avoid having to reupload files if they wish to adjust details
  };

  return (
    <div className="w-full h-full flex bg-app-bg text-[var(--chalk)] overflow-hidden relative">
      
      {/* ─── LEFT CONFIGURATION SIDEBAR ─── */}
      <div ref={sidebarRef} className="w-full lg:w-[370px] border-r border-[var(--line)] flex flex-col bg-[var(--surface)] backdrop-blur-lg flex-shrink-0 z-30">
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 pb-24">
          
          {/* Model Selector */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-[var(--iron)] uppercase tracking-wider block">
              What to make
            </label>
            <button
              ref={modelBtnRef}
              type="button"
              onClick={() => setOpenDropdown(!openDropdown)}
              className="w-full bg-[var(--sunk)] border border-[var(--line)] rounded px-4 py-3.5 text-sm text-left font-bold text-[var(--chalk)] flex items-center justify-between hover:bg-[var(--night)] hover:border-[var(--line-hi)] transition-all"
            >
              <span>{selectedModel ? audioLabel(selectedModel).name : "Choose what to make"}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${openDropdown ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {openDropdown && (
              <div className="absolute left-0 right-0 mt-2 z-50 bg-[var(--surface)] border border-[var(--line)] rounded shadow-3xl max-h-60 overflow-y-auto custom-scrollbar p-1.5">
                {audioModels.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModelId(model.id);
                      setOpenDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded text-xs font-bold transition-all flex flex-col gap-1.5 border ${
                      model.id === selectedModelId ? "text-[var(--lilac)] bg-[var(--slab-hi)] border-[var(--line)]" : "text-[var(--chalk)] border-transparent hover:bg-[var(--sunk)] hover:text-[var(--chalk)]"
                    }`}
                  >
                    <span>{audioLabel(model).name}</span>
                    {audioLabel(model).blurb && (
                      <span className="text-[10px] text-[var(--iron)] truncate max-w-[320px] font-normal">
                        {audioLabel(model).blurb}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model Description */}
          {selectedModel && audioLabel(selectedModel).blurb && (
            <div className="">
              <span className="text-[10px] font-bold text-[var(--lilac)] uppercase tracking-wider block mb-1.5">Description</span>
              <p className="text-[var(--fog)] text-xs leading-relaxed">{audioLabel(selectedModel).blurb}</p>
            </div>
          )}

          {/* Dynamic Configuration Form */}
          <div className="space-y-5">
            {selectedModel && Object.entries(selectedModel.inputs || {}).map(([key, schema]) => {
              // Skip model switcher itself (if it's in schemas)
              if (key === 'model') return null;
              // Audio URL file upload (single)
              if (schema.type === "string" && schema.field === "audio") {
                return (
                  <AudioFileUploader
                    key={key}
                    label={schema.title || key}
                    value={params[key] || ""}
                    onChange={(url) => setParams(prev => ({ ...prev, [key]: url }))}
                    apiKey={apiKey}
                  />
                );
              }
              // Audio URLs list file upload (multiple)
              if (schema.type === "array" && schema.field === "audios_list") {
                return (
                  <AudioListUploader
                    key={key}
                    label={schema.title || key}
                    value={params[key] || []}
                    onChange={(urls) => setParams(prev => ({ ...prev, [key]: urls }))}
                    apiKey={apiKey}
                    maxItems={schema.maxItems || 2}
                  />
                );
              }
              // Boolean Toggles
              if (schema.type === "boolean") {
                return (
                  <div key={key} className="flex items-center justify-between bg-[var(--sunk)] border border-[var(--line)] rounded p-4 transition-all hover:border-[var(--line)]">
                    <div className="flex-1 pr-4">
                      <span className="block text-xs font-bold text-[var(--chalk)] tracking-tight">
                        {schema.title || key}
                      </span>
                      {schema.description && (
                        <span className="block text-[11px] text-[var(--iron)] leading-normal mt-1">
                          {sanitiseHelp(schema.description)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setParams(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`w-11 h-6 rounded-full p-1 transition-all duration-300 relative shrink-0 ${
                        params[key] ? "bg-[var(--slab-hi)]" : "bg-[var(--night)]"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-[var(--surface)] shadow-md transform transition-all duration-300 ${
                        params[key] ? "translate-x-5 bg-[var(--surface)]" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                );
              }
              // Enum Dropdowns
              if (schema.enum) {
                const isOpen = openParamDropdown === key;
                return (
                  <div key={key} className="space-y-2 relative">
                    <label className="block text-xs font-bold text-[var(--iron)] uppercase tracking-wider">
                      {schema.title || key}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdown(false);
                        setOpenParamDropdown(isOpen ? null : key);
                      }}
                      className="w-full bg-[var(--sunk)] border border-[var(--line)] hover:border-[var(--line)] rounded px-4 py-3.5 text-xs text-left font-bold text-[var(--chalk)] flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span>{params[key] || "Select option"}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${isOpen ? 'rotate-185' : ''}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 right-0 mt-1 z-50 bg-[var(--surface)] border border-[var(--line)] rounded shadow-3xl max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {schema.enum.map((opt) => {
                          const optionValue = typeof opt === "object" ? opt.value : opt;
                          const optionLabel = typeof opt === "object" ? (opt.label || opt.value) : opt;
                          return (
                            <button
                              key={optionValue}
                              type="button"
                              onClick={() => {
                                setParams(prev => ({ ...prev, [key]: optionValue }));
                                setOpenParamDropdown(null);
                              }}
                              className={`w-full text-left px-4 py-2.5 rounded text-xs font-bold transition-all border ${
                                params[key] === optionValue
                                  ? "text-[var(--lilac)] bg-[var(--slab-hi)] border-[var(--line)]"
                                  : "text-[var(--chalk)] border-transparent hover:bg-[var(--sunk)] hover:text-[var(--chalk)]"
                              }`}
                            >
                              {optionLabel}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {schema.description && (
                      <span className="block text-[11px] text-[var(--iron)] leading-normal">
                        {sanitiseHelp(schema.description)}
                      </span>
                    )}
                  </div>
                );
              }

              // Number Sliders & Ranges
              const isNumber = schema.type === "int" || schema.type === "integer" || schema.type === "float" || schema.type === "number";
              const hasMinMax = schema.minValue !== undefined && schema.maxValue !== undefined;
              if (isNumber && hasMinMax) {
                const step = schema.step || (schema.type === "float" ? 0.05 : 1);
                return (
                  <div key={key} className="space-y-3 bg-[var(--sunk)] border border-[var(--line)] rounded p-4 transition-all hover:border-[var(--line)]">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[var(--chalk)] tracking-tight">{schema.title || key}</span>
                      <span className="text-[var(--lilac)] font-mono bg-[var(--slab-hi)] px-2 py-0.5 rounded border border-[var(--line)]">{params[key] !== undefined ? params[key] : schema.default}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--iron)] font-medium w-6 text-right">{schema.minValue}</span>
                      <input
                        type="range"
                        min={schema.minValue}
                        max={schema.maxValue}
                        step={step}
                        value={params[key] !== undefined ? params[key] : (schema.default || 0)}
                        onChange={(e) => setParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                        className="flex-1 h-1.5 bg-[var(--night)] rounded-full appearance-none cursor-pointer accent-primary hover:bg-[var(--slab)] transition-all"
                      />
                      <span className="text-[10px] text-[var(--iron)] font-medium w-6 text-left">{schema.maxValue}</span>
                    </div>
                    {schema.description && (
                      <span className="block text-[11px] text-[var(--iron)] leading-normal">
                        {sanitiseHelp(schema.description)}
                      </span>
                    )}
                  </div>
                );
              }

              // Prompt / Textarea Input
              if (key === "prompt") {
                return (
                  <div key={key} className="space-y-2">
                    <label className="block text-xs font-bold text-[var(--chalk)] uppercase tracking-wider">
                      {schema.title || "Lyrics / Prompt"}
                    </label>
                    <textarea
                      value={params[key] || ""}
                      onChange={(e) => setParams(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-[var(--sunk)] border border-[var(--line)] focus:border-[var(--line)] rounded p-3 text-xs text-[var(--chalk)] placeholder:text-[var(--fog)] focus:outline-none transition-all min-h-[100px] resize-none leading-relaxed shadow-inner"
                      placeholder={schema.description || "Enter what you want generated..."}
                    />
                    {schema.examples && Array.isArray(schema.examples) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {schema.examples.map((ex, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setParams(prev => ({ ...prev, [key]: ex }))}
                            className="text-[11px] px-3 py-1 bg-[var(--night)] border border-[var(--line)] hover:bg-[var(--slab-hi)]/20 hover:border-[var(--line-hi)] hover:text-[var(--chalk)] rounded-full transition-all font-semibold text-[var(--chalk)]"
                          >
                            "{ex.slice(0, 35)}..."
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Standard Text / Input fields
              return (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-bold text-[var(--chalk)] uppercase tracking-wider">
                    {schema.title || key}
                  </label>
                  <input
                    type={isNumber ? "number" : "text"}
                    value={params[key] !== undefined ? params[key] : ""}
                    placeholder={schema.placeholder || schema.description || `Enter ${key}...`}
                    onChange={(e) => {
                      const val = isNumber ? (e.target.value === "" ? "" : parseFloat(e.target.value)) : e.target.value;
                      setParams(prev => ({ ...prev, [key]: val }));
                    }}
                    className="w-full bg-[var(--sunk)] border border-[var(--line)] hover:border-[var(--line)] focus:border-[var(--line)] rounded px-4 py-3.5 text-xs text-[var(--chalk)] placeholder:text-[var(--fog)] focus:outline-none transition-all shadow-inner"
                  />
                  {schema.description && (
                    <span className="block text-[11px] text-[var(--iron)] leading-normal">
                      {sanitiseHelp(schema.description)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Cost and Generate, the same footer every tool uses. */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--surface)] absolute bottom-0 left-0 w-full lg:w-[370px] z-40">
          <CostMeter
            tier={selectedTier}
            balance={creditBalance}
            busy={isGenerating}
            disabled={!selectedModel}
            onGenerate={handleGenerate}
            onBuyCredits={openTopUp}
            label="Generate track"
          />
        </div>
      </div>
      {/* ─── RIGHT CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-20">
        
        {/* Main Display panel */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 flex flex-col justify-between">
          
          <div className="flex-1 flex items-center justify-center min-h-[400px] mb-8">
            
            {/* 1. Error Display */}
            {generateError && (
              <div className="w-full max-w-md p-6 bg-red-500/10 border border-red-500/20 rounded flex flex-col items-center gap-4 animate-shake">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 border border-red-500/30 shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="text-xs font-black text-red-500 uppercase tracking-widest block mb-1">
                    Generation Error
                  </span>
                  <p className="text-[var(--chalk)] font-medium text-sm leading-relaxed">
                    {generateError}
                  </p>
                </div>
              </div>
            )}

            {/* 2. Generating / Loading View */}
            {isGenerating && !generateError && (
              <div className="flex flex-col items-center gap-6 animate-fade-in">
                <div className="relative">
                  <div className="w-24 h-24 border-[3px] border-[var(--line)] border-t-primary rounded-full animate-spin shadow-black/40" />
                  <div className="absolute inset-0 flex items-center justify-center text-[var(--lilac)]">
                    <MusicIcon className="animate-pulse text-[var(--lilac)]" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-xs font-black text-[var(--lilac)] uppercase tracking-[0.3em] animate-pulse">
                    Generating Soundtrack
                  </div>
                  <div className="text-sm text-[var(--chalk)] font-bold">
                    Rendering audio waveforms and vocals...
                  </div>
                </div>
              </div>
            )}

            {/* 3. Empty state — what this makes, before you have made anything. */}
            {view === "input" && !isGenerating && !generateError && (
              <ToolShowcase toolId="soundtrack" />
            )}

            {/* 4. Active Result Player Display */}
            {view === "result" && activeResultUrl && !isGenerating && !generateError && (
              <div className="w-full max-w-2xl animate-fade-in-up space-y-4">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={handleNew}
                    className="text-xs font-bold text-[var(--chalk)] hover:text-[var(--lilac)] flex items-center gap-2 transition-all bg-[var(--sunk)] border border-[var(--line)] hover:border-[var(--line-hi)] px-4 py-2 rounded-full"
                    type="button"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                    <span>New Generation</span>
                  </button>
                  <span className="text-[11px] font-bold text-green-400 px-3.5 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Success
                  </span>
                </div>
                <PremiumAudioPlayer url={activeResultUrl} title={activeResultTitle} />
              </div>
            )}

          </div>

          {/* ─── BOTTOM HISTORY FOOTER ─── */}
          {history.length > 0 && (
            <div className="border-t border-[var(--line)] pt-6 w-full animate-fade-in-up">
              <h4 className="text-xs font-bold text-[var(--iron)] uppercase tracking-wider mb-4 px-1">
                Generation History ({history.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {history.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    onClick={() => handleSelectHistory(entry, idx)}
                    className={`p-3.5 bg-[var(--sunk)] border rounded cursor-pointer transition-all flex flex-col justify-between h-28 border-[var(--line)] hover:bg-[var(--night)] hover:border-[var(--line)] ${
                      activeResultUrl === entry.url && view === "result"
                        ? "border-[var(--chalk)] bg-[var(--slab-hi)] shadow-black/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                        activeResultUrl === entry.url && view === "result" ? "bg-[var(--slab-hi)] text-[var(--lilac)]" : "bg-[var(--night)] text-[var(--chalk)]"
                      }`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-bold text-[var(--lilac)] uppercase tracking-wider truncate">
                        {entry.model ? entry.model.split('-').slice(0, 2).join(' ') : 'Audio'}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-[var(--chalk)] line-clamp-2 leading-tight">
                      {entry.title || entry.prompt || "Untitled Audio"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
      <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} toastOptions={{ duration: 5000, style: { background: 'var(--slab-hi)', color: 'var(--surface)', border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.6)', maxWidth: '440px', wordBreak: 'break-word', whiteSpace: 'pre-wrap', padding: '12px 16px' } }} />
    </div>
  );
}
