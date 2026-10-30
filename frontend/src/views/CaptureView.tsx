import React, { useState, useEffect, useRef } from "react";
import {
  Mic, Play, Pause, Square, RotateCcw, Save, Sparkles,
  AlertCircle, CheckCircle2, Info, ArrowRight, BookOpen
} from "lucide-react";
import { SpeechRecognitionManager, SpeechRecognitionState } from "../services/speechRecognition";
import { saveLocalDraft } from "../services/offlineStorage";
import { SyntheticScenario } from "../types/clinical";

interface CaptureViewProps {
  initialText?: string;
  initialScenario?: SyntheticScenario | null;
  scenarios: SyntheticScenario[];
  onProcessNote: (text: string, durationSeconds?: number, sourceType?: "audio_transcript" | "typed_note") => void;
}

export const CaptureView: React.FC<CaptureViewProps> = ({
  initialText = "",
  scenarios,
  onProcessNote
}) => {
  const [text, setText] = useState(initialText);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [speechState, setSpeechState] = useState<SpeechRecognitionState>({
    isSupported: true,
    isListening: false,
    isPaused: false,
    transcript: "",
    durationSeconds: 0,
    engineType: "Browser/OS Speech Engine",
    isLocalEngine: false
  });
  const [draftSavedMsg, setDraftSavedMsg] = useState(false);

  const speechManagerRef = useRef<SpeechRecognitionManager | null>(null);

  useEffect(() => {
    if (initialText) {
      setText(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    speechManagerRef.current = new SpeechRecognitionManager((state) => {
      setSpeechState(state);
      if (state.transcript) {
        setText(state.transcript);
      }
      setAudioDuration(state.durationSeconds);
    });

    return () => {
      speechManagerRef.current?.stop();
    };
  }, []);

  const handleStartRecording = () => {
    speechManagerRef.current?.start();
  };

  const handlePauseRecording = () => {
    speechManagerRef.current?.pause();
  };

  const handleResumeRecording = () => {
    speechManagerRef.current?.resume();
  };

  const handleStopRecording = () => {
    const finalTranscript = speechManagerRef.current?.stop() || text;
    setText(finalTranscript);
  };

  const handleClear = () => {
    speechManagerRef.current?.clear();
    setText("");
    setAudioDuration(0);
  };

  const handleSaveDraft = async () => {
    if (!text.trim()) return;
    await saveLocalDraft({
      id: "draft-" + Date.now(),
      text: text.trim(),
      saved_at: new Date().toISOString(),
      source_type: audioDuration > 0 ? "audio_transcript" : "typed_note",
      audio_duration: audioDuration
    });
    setDraftSavedMsg(true);
    setTimeout(() => setDraftSavedMsg(false), 3000);
  };

  const handleProcess = () => {
    if (!text.trim()) return;
    if (speechState.isListening) {
      speechManagerRef.current?.stop();
    }
    const modality = audioDuration > 0 ? "audio_transcript" : "typed_note";
    onProcessNote(text.trim(), audioDuration, modality);
  };

  const handleSelectScenario = (scen: SyntheticScenario) => {
    speechManagerRef.current?.clear();
    setText(scen.text);
    setAudioDuration(18.5); // Representative synthetic duration
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 transition-colors duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Mic className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            Field Note Capture
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dictate on-scene notes or enter manual transcript. Transcript is editable before clinical extraction.
          </p>
        </div>

        {/* Quick Scenario Selector */}
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
          <select
            onChange={(e) => {
              const sc = scenarios.find((s) => s.id === e.target.value);
              if (sc) handleSelectScenario(sc);
            }}
            defaultValue=""
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 shadow-2xs"
          >
            <option value="" disabled>
              Load Demonstration Dictation...
            </option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.category})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Engine Disambiguation Banner */}
      <div className="bg-sky-50 dark:bg-slate-900/90 border border-sky-200 dark:border-slate-800 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300 shadow-2xs">
        <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 dark:text-white">Speech Recognition Engine Status:</span>
            <span className="font-mono text-[11px] px-2 py-0.2 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sky-800 dark:text-sky-300 font-medium">
              Web Speech API (Browser / OS Engine)
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
            Local browser voice capture is supported via native Web Speech synthesis. Offline speech availability depends on your OS speech language packs; manual text entry is 100% offline-first and never depends on external APIs.
          </p>
        </div>
      </div>

      {speechState.errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/50 rounded-xl p-3.5 flex items-center gap-3 text-xs text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{speechState.errorMessage}</span>
        </div>
      )}

      {/* Main Capture Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs dark:shadow-xl space-y-6">
        {/* Large Central Mic Recording Station */}
        <div className="flex flex-col items-center justify-center pt-2 pb-4 space-y-4">
          <div className="relative">
            {speechState.isListening && !speechState.isPaused && (
              <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
            )}
            <button
              onClick={speechState.isListening ? handleStopRecording : handleStartRecording}
              className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${
                speechState.isListening
                  ? speechState.isPaused
                    ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40 border-4 border-amber-400/40"
                    : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 border-4 border-rose-400/50"
                  : "bg-gradient-to-tr from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-950/30 border-4 border-sky-400/30"
              }`}
            >
              {speechState.isListening ? (
                speechState.isPaused ? (
                  <Play className="w-10 h-10 ml-1" />
                ) : (
                  <Square className="w-9 h-9 fill-current" />
                )
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
          </div>

          {/* Recording Timer & Status */}
          <div className="text-center space-y-1">
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white tracking-widest">
              {formatTime(audioDuration)}
            </div>
            <div className="text-xs font-medium">
              {speechState.isListening ? (
                speechState.isPaused ? (
                  <span className="text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1.5 font-semibold">
                    <Pause className="w-3.5 h-3.5" /> Recording Paused
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 animate-pulse font-semibold">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Live Listening...
                  </span>
                )
              ) : (
                <span className="text-slate-500 dark:text-slate-400">Click to start speech dictation</span>
              )}
            </div>
          </div>

          {/* Audio Controls Bar */}
          <div className="flex items-center gap-2">
            {speechState.isListening && (
              <>
                {speechState.isPaused ? (
                  <button
                    onClick={handleResumeRecording}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={handlePauseRecording}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Pause
                  </button>
                )}
                <button
                  onClick={handleStopRecording}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700"
                >
                  <Square className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Stop
                </button>
              </>
            )}

            <button
              onClick={handleClear}
              disabled={!text}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Editable Transcript / Text Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>On-Scene Clinical Note (Live Transcript & Manual Edit)</span>
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {text.length} characters &bull; {text.trim() ? text.trim().split(/\s+/).length : 0} words
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dictate into microphone or type directly here: e.g. 'At 14:32, patient experiencing shortness of breath. Administered oxygen at 10 L/min via non-rebreather mask. At 14:36, gave 0.3 mg epinephrine IM...'"
            rows={5}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-sky-500 leading-relaxed font-sans resize-y shadow-2xs"
          />
        </div>

        {/* Action Buttons: Save Draft & Process */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={!text.trim()}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-40 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all active:scale-95 shadow-2xs"
            >
              <Save className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Save Offline Draft
            </button>
            {draftSavedMsg && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" /> Draft saved to IndexedDB
              </span>
            )}
          </div>

          <button
            onClick={handleProcess}
            disabled={!text.trim()}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white disabled:opacity-40 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-sky-950/20 border border-sky-400/30 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Extract & Review Record
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
