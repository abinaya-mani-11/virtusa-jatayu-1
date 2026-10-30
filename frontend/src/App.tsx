import React, { useState, useEffect } from "react";
import { Navbar, NavView } from "./components/Navbar";
import { DashboardView } from "./views/DashboardView";
import { CaptureView } from "./views/CaptureView";
import { ReviewView } from "./views/ReviewView";
import { RecordDetailsView } from "./views/RecordDetailsView";
import { AuditHistoryView } from "./views/AuditHistoryView";
import { ClinicalRecord, ExtractionWarning, SyntheticScenario, DraftNote } from "./types/clinical";
import { createRecord, getRecord, getScenarios, extractEntities } from "./services/api";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<NavView>("dashboard");
  const [currentRecord, setCurrentRecord] = useState<ClinicalRecord | null>(null);
  const [currentWarnings, setCurrentWarnings] = useState<ExtractionWarning[]>([]);
  const [scenarios, setScenarios] = useState<SyntheticScenario[]>([]);
  const [captureInitialText, setCaptureInitialText] = useState<string>("");
  const [loadingRecord, setLoadingRecord] = useState(false);

  // Theme state: default to "light" mode as requested by user
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    // Register Service Worker for true offline asset caching
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("Field-to-Record Service Worker registered"))
        .catch((err) => console.warn("SW registration error:", err));
    }

    // Load demonstration scenarios
    getScenarios()
      .then(setScenarios)
      .catch((e) => console.warn("Could not load scenarios from backend:", e));
  }, []);

  const handleNavigate = (view: NavView) => {
    setCurrentView(view);
  };

  const handleNewNote = () => {
    setCaptureInitialText("");
    setCurrentView("capture");
  };

  const handleSelectRecord = async (recordId: string) => {
    setLoadingRecord(true);
    try {
      const rec = await getRecord(recordId);
      setCurrentRecord(rec);
      setCurrentView("details");
    } catch (err) {
      console.error("Failed to load record details:", err);
    } finally {
      setLoadingRecord(false);
    }
  };

  const handleLoadScenario = (scen: SyntheticScenario) => {
    setCaptureInitialText(scen.text);
    setCurrentView("capture");
  };

  const handleResumeDraft = (draft: DraftNote) => {
    setCaptureInitialText(draft.text);
    setCurrentView("capture");
  };

  const handleProcessNote = async (
    text: string,
    durationSeconds?: number,
    sourceType: "audio_transcript" | "typed_note" = "typed_note"
  ) => {
    setLoadingRecord(true);
    try {
      // 1. Create record with extraction
      const rec = await createRecord(text, sourceType, "EMS-PARAMEDIC-01", durationSeconds);
      // 2. Also run extract for warning banners if needed
      const extractMeta = await extractEntities(text, "EMS-PARAMEDIC-01");
      setCurrentWarnings(extractMeta.warnings || []);
      setCurrentRecord(rec);
      setCurrentView("review");
    } catch (err) {
      console.error("Note processing failed:", err);
      alert("Failed to process note. Please ensure the local backend server is running.");
    } finally {
      setLoadingRecord(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onNewNote={handleNewNote}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {loadingRecord ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-sky-600 dark:border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Processing clinical extraction & hash chaining...</p>
          </div>
        ) : (
          <>
            {currentView === "dashboard" && (
              <DashboardView
                onSelectRecord={handleSelectRecord}
                onNewNote={handleNewNote}
                onLoadScenario={handleLoadScenario}
                onResumeDraft={handleResumeDraft}
              />
            )}

            {currentView === "capture" && (
              <CaptureView
                initialText={captureInitialText}
                scenarios={scenarios}
                onProcessNote={handleProcessNote}
              />
            )}

            {currentView === "review" && currentRecord && (
              <ReviewView
                record={currentRecord}
                warnings={currentWarnings}
                onBack={() => setCurrentView("dashboard")}
                onRecordApproved={(updated) => {
                  setCurrentRecord(updated);
                  setCurrentView("details");
                }}
                onRecordUpdated={(updated) => {
                  setCurrentRecord(updated);
                }}
              />
            )}

            {currentView === "details" && currentRecord && (
              <RecordDetailsView
                record={currentRecord}
                onBack={() => setCurrentView("dashboard")}
                onEdit={() => setCurrentView("review")}
              />
            )}

            {currentView === "audit" && <AuditHistoryView />}
          </>
        )}
      </main>

      {/* Emergency Operations Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800/80 py-4 mt-auto transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">FIELD-TO-RECORD</span>
            <span>&bull;</span>
            <span>Hackathon-Ready Clinical Note Extraction & Audit System</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>Deterministic NLP v1.0</span>
            <span>&bull;</span>
            <span>SHA-256 Chain</span>
            <span>&bull;</span>
            <span>FHIR R4 Compatible</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
