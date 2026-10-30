import React from "react";
import { Shield, Mic, Activity, History, PlusCircle, Sun, Moon } from "lucide-react";
import { OfflineIndicator } from "./OfflineIndicator";

export type NavView = "dashboard" | "capture" | "review" | "details" | "audit";

interface NavbarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  onNewNote: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onNewNote,
  theme,
  onToggleTheme
}) => {
  return (
    <header className="bg-white/95 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs backdrop-blur transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate("dashboard")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shadow-md shadow-sky-900/20 border border-sky-400/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 dark:text-white tracking-wide font-mono">FIELD-TO-RECORD</span>
                <span className="px-1.5 py-0.2 bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-400 text-[10px] font-semibold rounded uppercase tracking-wider border border-sky-300 dark:border-sky-500/30">
                  EMS v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Emergency Clinical Care Documentation</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <button
              onClick={() => onNavigate("dashboard")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === "dashboard"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/60"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => onNavigate("capture")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === "capture"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/60"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Capture Note
            </button>
            <button
              onClick={() => onNavigate("audit")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === "audit"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/60"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Audit Trail (SHA-256)
            </button>
          </nav>

          {/* Right Side: Status, Theme Toggle, and New Note Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <OfflineIndicator />

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors shadow-2xs active:scale-95"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              aria-label="Toggle light/dark theme"
            >
              {theme === "light" ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span className="text-xs font-semibold">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold">Light</span>
                </>
              )}
            </button>

            <button
              onClick={onNewNote}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-md shadow-emerald-950/20 transition-all border border-emerald-400/30 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              New Incident
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
