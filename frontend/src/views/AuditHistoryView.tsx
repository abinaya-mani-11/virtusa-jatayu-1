import React, { useState, useEffect } from "react";
import {
  ShieldCheck, AlertTriangle, RefreshCw, Lock, Link, Key,
  CheckCircle2, XCircle, Terminal, HelpCircle, Bug, ArrowRight
} from "lucide-react";
import { AuditEntry, AuditVerificationResult } from "../types/clinical";
import { getAuditTrail, verifyAuditTrail, runTamperTest } from "../services/api";

export const AuditHistoryView: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verification, setVerification] = useState<AuditVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const loadAuditData = async () => {
    setLoading(true);
    try {
      const [trail, check] = await Promise.all([getAuditTrail(), verifyAuditTrail()]);
      setEntries(trail);
      setVerification(check);
      if (trail.length > 0 && !selectedEntry) {
        setSelectedEntry(trail[0]);
      }
    } catch (err) {
      console.error("Failed to load audit history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const handleRunVerification = async () => {
    setVerifying(true);
    try {
      const check = await verifyAuditTrail();
      setVerification(check);
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateTampering = async () => {
    if (entries.length === 0) return;
    setTampering(true);
    try {
      // Pick middle entry or sequence 1
      const targetSeq = entries.length > 1 ? entries[1].sequence : entries[0].sequence;
      await runTamperTest(targetSeq, "Simulated malicious dose change: 100mg Epinephrine");
      // Re-verify immediately to reveal the tamper detection!
      const check = await verifyAuditTrail();
      setVerification(check);
      const updatedTrail = await getAuditTrail();
      setEntries(updatedTrail);
    } catch (err) {
      console.error("Tamper simulation failed:", err);
    } finally {
      setTampering(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Lock className="w-6 h-6 text-sky-400" />
            Append-Only Cryptographic Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Tamper-evident SHA-256 hash chain recording every clinical creation, revision, verification, and sign-off.
          </p>
        </div>

        {/* Verification & Test Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulateTampering}
            disabled={tampering || entries.length === 0}
            className="flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900/90 text-rose-300 border border-rose-500/40 px-3 py-2 rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95"
            title="Intentionally tamper with a database payload to test cryptographic failure detection"
          >
            <Bug className="w-3.5 h-3.5 text-rose-400" />
            {tampering ? "Simulating..." : "Simulate DB Tampering"}
          </button>

          <button
            onClick={handleRunVerification}
            disabled={verifying}
            className="flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-sky-950/40 border border-sky-400/30 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
            {verifying ? "Traversing Chain..." : "Verify Hash Chain Integrity"}
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verification && (
        <div
          className={`border rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            verification.is_valid
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/60 border-rose-500/60 text-rose-200 animate-pulse"
          }`}
        >
          <div className="flex items-start gap-3">
            {verification.is_valid ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">
                  {verification.is_valid
                    ? "CRYPTOGRAPHIC CHAIN INTEGRITY: 100% VERIFIED"
                    : "CRITICAL: UNAUTHORIZED TAMPERING DETECTED"}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/40 border border-current">
                  {verification.verified_entries} / {verification.total_entries} Blocks Valid
                </span>
              </div>
              <p className="text-xs opacity-90 mt-1 leading-relaxed">
                {verification.message}
              </p>
              {verification.tampered_details.length > 0 && (
                <div className="mt-2 space-y-1">
                  {verification.tampered_details.map((d, i) => (
                    <div key={i} className="text-[11px] font-mono text-rose-300 bg-rose-950/80 px-2 py-1 rounded border border-rose-500/30">
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-right font-mono text-xs opacity-75 shrink-0">
            <div>Checked: {new Date(verification.checked_at).toLocaleTimeString()}</div>
            <div>Head: {verification.head_hash.slice(0, 16)}...</div>
          </div>
        </div>
      )}

      {/* Security Limitations & Architecture Note */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2 text-xs text-slate-300">
        <div className="flex items-center gap-2 text-sky-400 font-semibold">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>Security Model & Limitations Advisory (Healthcare Integrity Standards)</span>
        </div>
        <p className="text-slate-400 leading-relaxed text-[11px]">
          Field-to-Record uses a local SHA-256 cryptographic hash chain where each block binds:
          <code className="text-sky-300 font-mono ml-1">
            H_n = SHA256(prev_hash || record_id || event_id || action || actor || timestamp || canonical_json(payload))
          </code>.
          This makes any unauthorized alteration, row deletion, or direct SQL edit immediately detectable upon chain traversal.
          <strong className="text-slate-200 ml-1">Limitations:</strong> A local database hash chain is tamper-evident against unauthorized manual modification or corruption, but cannot protect against an attacker with full root access who rewrites the entire SQLite file from scratch. In enterprise deployment, the head hash is anchored to an external timestamp authority or distributed witness ledger.
        </p>
      </div>

      {/* Block Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Blocks (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
            <span>Audit Trail Blocks ({entries.length})</span>
            <span className="text-[11px] text-slate-400 font-mono">Genesis: 00000000...</span>
          </div>

          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
              Loading cryptographic trail...
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
              Audit trail is currently empty.
            </div>
          ) : (
            <div className="space-y-2.5">
              {entries.map((entry) => {
                const isSelected = selectedEntry?.sequence === entry.sequence;
                const isCorrupted = verification?.corrupted_entries.includes(entry.sequence);

                return (
                  <div
                    key={entry.entry_id}
                    onClick={() => setSelectedEntry(entry)}
                    className={`bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all shadow-sm ${
                      isCorrupted
                        ? "border-rose-500 bg-rose-950/30"
                        : isSelected
                        ? "border-sky-500 ring-1 ring-sky-500/30"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-500/30">
                            Block #{entry.sequence}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {entry.action_type.replace(/_/g, " ")}
                          </span>
                          {isCorrupted && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              TAMPER DETECTED
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Actor: {entry.actor_id}</span>
                          <span>&bull;</span>
                          <span className="font-mono text-[11px]">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 truncate pt-1">
                          Hash: <span className="text-slate-300">{entry.current_hash.slice(0, 24)}...</span>
                        </div>
                      </div>

                      <div className="shrink-0 pt-1">
                        <Link className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail Inspector (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 sticky top-20 text-xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              Block Cryptographic Inspection
            </h2>

            {selectedEntry ? (
              <div className="space-y-3 font-mono">
                <div>
                  <span className="text-slate-400 text-[11px]">Sequence Number:</span>
                  <div className="text-white font-bold text-sm">Block #{selectedEntry.sequence}</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px]">Action Type:</span>
                  <div className="text-sky-300 font-bold">{selectedEntry.action_type}</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px]">Actor Identifier:</span>
                  <div className="text-slate-200">{selectedEntry.actor_id}</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px]">Record Target ID:</span>
                  <div className="text-slate-300 truncate">{selectedEntry.record_id}</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px]">Previous Block Hash:</span>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] text-slate-400 break-all">
                    {selectedEntry.prev_hash}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px]">Current Block Hash (SHA-256):</span>
                  <div className="bg-slate-950 p-2 rounded border border-sky-900/60 text-[10px] text-sky-300 break-all font-bold">
                    {selectedEntry.current_hash}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px]">Immutable Payload JSON:</span>
                  <pre className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] text-emerald-300 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedEntry.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-xs py-8 text-center">Select a block to inspect its cryptographic state.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
