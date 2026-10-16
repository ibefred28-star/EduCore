import React, { useState, useEffect } from 'react';
import { speechService, SpeechVoiceInfo } from '../lib/speechService';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  FastForward,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Sliders
} from 'lucide-react';

interface ReadAloudPlayerProps {
  content: string | string[];
  title?: string;
  className?: string;
  onParagraphChange?: (index: number) => void;
  autoPlay?: boolean;
}

export default function ReadAloudPlayer({
  content,
  title,
  className = '',
  onParagraphChange,
  autoPlay = false
}: ReadAloudPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalChunks, setTotalChunks] = useState(1);
  const [rate, setRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [britishVoices, setBritishVoices] = useState<SpeechVoiceInfo[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');

  useEffect(() => {
    // Load voices
    const updateVoices = () => {
      const bVoices = speechService.getBritishVoices();
      setBritishVoices(bVoices);
      const best = speechService.findBestBritishVoice();
      if (best) setSelectedVoiceName(best.name);
    };

    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      speechService.stop();
    };
  }, []);

  useEffect(() => {
    // Recalculate chunks
    const chunks = speechService.prepareChunks(Array.isArray(content) ? content.join('\n\n') : content);
    setTotalChunks(Math.max(1, chunks.length));
  }, [content]);

  useEffect(() => {
    if (autoPlay) {
      handlePlay();
    }
  }, [autoPlay]);

  const handlePlay = (startFrom = 0) => {
    speechService.setRate(rate);
    speechService.setVolume(volume);

    speechService.readAloud(
      content,
      {
        onStart: () => {
          setIsPlaying(true);
          setIsPaused(false);
        },
        onParagraphChange: (idx) => {
          setCurrentIdx(idx);
          if (onParagraphChange) onParagraphChange(idx);
        },
        onPause: () => {
          setIsPaused(true);
        },
        onResume: () => {
          setIsPaused(false);
        },
        onEnd: () => {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentIdx(0);
        },
        onError: (err) => {
          console.warn('Speech playback error:', err);
          setIsPlaying(false);
          setIsPaused(false);
        }
      },
      startFrom
    );
  };

  const handlePause = () => {
    speechService.pause();
    setIsPaused(true);
  };

  const handleResume = () => {
    speechService.resume();
    setIsPaused(false);
  };

  const handleStop = () => {
    speechService.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIdx(0);
    if (onParagraphChange) onParagraphChange(0);
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    speechService.setRate(newRate);
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vName = e.target.value;
    setSelectedVoiceName(vName);
    const found = britishVoices.find(v => v.name === vName);
    if (found) {
      speechService.setVoice(found.voice);
    }
  };

  const handleRestart = () => {
    handleStop();
    handlePlay(0);
  };

  const progressPercent = totalChunks > 1
    ? Math.round(((currentIdx + 1) / totalChunks) * 100)
    : isPlaying ? 100 : 0;

  return (
    <div className={`bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-xl border border-indigo-500/20 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white transition-all shadow-md ${
              isPlaying && !isPaused
                ? 'bg-gradient-to-br from-indigo-500 to-rose-500 ring-2 ring-rose-400/50 animate-pulse'
                : 'bg-indigo-600/60'
            }`}>
              <Volume2 className="w-6 h-6" />
            </div>
            {isPlaying && !isPaused && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="text-sm">🇬🇧</span> British English
              </span>
              <span className="text-[11px] text-indigo-300 font-medium">
                Loud & Natural Audio
              </span>
            </div>
            <h4 className="text-sm font-bold text-white truncate m-0 mt-0.5">
              {title || 'Read Aloud Audio Player'}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5">
              <span>
                {isPlaying
                  ? isPaused
                    ? 'Paused'
                    : `Reading section ${currentIdx + 1} of ${totalChunks}`
                  : 'Ready to read aloud'}
              </span>
              {selectedVoiceName && (
                <span className="text-indigo-400/80 truncate max-w-[140px]">
                  • {selectedVoiceName.split(' ')[0]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center / Right: Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          
          {/* Main Play / Pause Button */}
          {!isPlaying ? (
            <button
              onClick={() => handlePlay(0)}
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Read Aloud</span>
            </button>
          ) : isPaused ? (
            <button
              onClick={handleResume}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Pause className="w-4 h-4 fill-slate-950" />
              <span>Pause</span>
            </button>
          )}

          {/* Stop Button */}
          {isPlaying && (
            <button
              onClick={handleStop}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer"
              title="Stop Read Aloud"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          )}

          {/* Speed Pills */}
          <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700">
            {[0.8, 1.0, 1.25, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => handleRateChange(speed)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  rate === speed
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Settings Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl text-xs transition-all cursor-pointer ${
              showSettings
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Audio & Voice Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isPlaying && (
        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-rose-500 to-indigo-500 h-1.5 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-slate-400 font-medium">Voice Accent:</span>
            {britishVoices.length > 0 ? (
              <select
                value={selectedVoiceName}
                onChange={handleVoiceChange}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-indigo-500 outline-none max-w-[220px]"
              >
                {britishVoices.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-indigo-300 font-mono">Default British Engine (en-GB)</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Volume: 100% (Loud)</span>
            </div>
            <button
              onClick={handleRestart}
              className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restart from top</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
