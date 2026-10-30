import React, { useState, useEffect } from "react";
import {
  FileText, CheckCircle2, Clock, ShieldCheck, PlusCircle,
  ExternalLink, Search, RefreshCw, AlertTriangle, ArrowRight, Zap, FolderOpen
} from "lucide-react";
import { ClinicalRecord, DraftNote, SyntheticScenario } from "../types/clinical";
import { listRecords, getScenarios, verifyAuditTrail } from "../services/api";
import { getLocalDrafts, deleteLocalDraft } from "../services/offlineStorage";

interface DashboardProps {
  onSelectRecord: (recordId: string) => void;
  onNewNote: () => void;
  onLoadScenario: (scenario: SyntheticScenario) => void;
  onResumeDraft: (draft: DraftNote) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({
  onSelectRecord,
  onNewNote,
  onLoadScenario,
  onResumeDraft
}) => {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [drafts, setDrafts] = useState<DraftNote[]>([]);
  const [scenarios, setScenarios] = useState<SyntheticScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [chainValid, setChainValid] = useState<boolean | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recs, dfts, scens, verifyRes] = await Promise.all([
        listRecords(),
        getLocalDrafts(),
        getScenarios().catch(() => []),
        verifyAuditTrail().catch(() => null)
      ]);
      setRecords(recs);
      setDrafts(dfts);
      setScenarios(scens);
      if (verifyRes) {
        setChainValid(verifyRes.is_valid);
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteDraft = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteLocalDraft(id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  // Stats calculation
  const totalCount = records.length;
  const pendingCount = records.filter((r) => r.audit.record_status === "pending_review").length;
  const approvedCount = records.filter((r) => r.audit.record_status === "approved").length;

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.source.original_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.record_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.audit.created_by.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.audit.record_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-12 transition-colors duration-150">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-white via-slate-50 to-sky-50/60 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-xs dark:shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 dark:bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-500/10 text-sky-800 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30">
                First-Responder Operations Console
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Offline-First Clinical NLP</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Emergency Clinical Notes & Audited Records
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Transform spoken or typed field notes into timestamped, structured medication and procedure records
              with deterministic clinical NER, human verification, and SHA-256 cryptographic audit chaining.
            </p>
          </div>
          <button
            onClick={onNewNote}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-md shadow-sky-950/20 transition-all border border-sky-400/30 active:scale-95 shrink-0"
          >
            <PlusCircle className="w-5 h-5" />
            Dictate / Enter Note
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Records */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-xs dark:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Records</span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">{totalCount}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">incidents</span>
          </div>
        </div>

        {/* Pending Review */}
        <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-900/40 p-5 rounded-xl shadow-xs dark:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Awaiting Verification</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-amber-600 dark:text-amber-400">{pendingCount}</span>
            <span className="text-xs text-amber-700 dark:text-amber-300/70">require review</span>
          </div>
        </div>

        {/* Approved Records */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-900/40 p-5 rounded-xl shadow-xs dark:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Approved & Signed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{approvedCount}</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-300/70">clinical sign-offs</span>
          </div>
        </div>

        {/* Cryptographic Integrity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-xs dark:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Audit Integrity</span>
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {chainValid === true ? (
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="w-4 h-4" />
                SHA-256 SEALED
              </span>
            ) : chainValid === false ? (
              <span className="text-sm font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-4 h-4" />
                TAMPER DETECTED
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Verifying...</span>
            )}
          </div>
        </div>
      </div>

      {/* Offline Drafts Section (if any drafts exist in IndexedDB) */}
      {drafts.length > 0 && (
        <div className="bg-amber-50/80 dark:bg-slate-900/90 border border-amber-300 dark:border-amber-500/30 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Unfinished Offline Drafts ({drafts.length})
              </h2>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-400/80 font-mono">Stored in IndexedDB</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {drafts.map((d) => (
              <div
                key={d.id}
                onClick={() => onResumeDraft(d)}
                className="bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between group shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{new Date(d.saved_at).toLocaleTimeString()}</span>
                    <button
                      onClick={(e) => handleDeleteDraft(e, d.id)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2 italic">"{d.text}"</p>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <span>Resume Draft</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Records List & Scenario Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Incident Records Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              Clinical Records Library
            </h2>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search notes or record IDs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 w-48 sm:w-56"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
              </select>

              <button
                onClick={loadData}
                title="Refresh library"
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600 dark:text-sky-400" />
              <p className="text-xs">Loading clinical records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <FileText className="w-8 h-8 mx-auto mb-3 text-slate-400 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No records found</p>
              <p className="text-xs text-slate-500 mt-1">Start by capturing a note or loading a test scenario.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((r) => (
                <div
                  key={r.record_id}
                  onClick={() => onSelectRecord(r.record_id)}
                  className="bg-white hover:bg-slate-50/90 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500/50 p-4 rounded-xl transition-all cursor-pointer shadow-xs dark:shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-700 dark:text-sky-400">
                          {r.record_id.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-slate-400">&bull;</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">{r.audit.created_by}</span>
                        <span className="text-xs text-slate-400">&bull;</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Rev #{r.audit.revision}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            r.audit.record_status === "approved"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-500/30"
                              : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-500/30"
                          }`}
                        >
                          {r.audit.record_status === "approved" ? "APPROVED" : "PENDING REVIEW"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                        {r.source.original_text}
                      </p>

                      {/* Extracted Event Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {r.events.map((ev, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 font-medium"
                          >
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {ev.medication ? ev.medication.name : ev.procedure_name || ev.observation_name}
                            </span>
                            {ev.dose?.value && (
                              <span className="text-sky-700 dark:text-sky-400 font-mono">
                                {ev.dose.value}{ev.dose.unit}
                              </span>
                            )}
                            <span className="text-slate-500 text-[10px]">({ev.administration_status})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors pt-2">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Test Scenarios */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              Live Demo Scenarios ({scenarios.length})
            </h2>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">1-Click Load</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Test the clinical NLP pipeline with realistic pre-configured first-responder dictations covering all required clinical edge cases:
          </p>

          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {scenarios.map((scen) => (
              <div
                key={scen.id}
                onClick={() => onLoadScenario(scen)}
                className="bg-white hover:bg-slate-50/90 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500/50 p-3.5 rounded-xl cursor-pointer transition-all group shadow-xs"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-900 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                    {scen.title}
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                    {scen.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 italic mb-2">"{scen.text}"</p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-1.5">
                  <span className="text-sky-700 dark:text-sky-400 font-medium">{scen.highlight}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 group-hover:text-slate-900 dark:group-hover:text-white">
                    Load Note &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
