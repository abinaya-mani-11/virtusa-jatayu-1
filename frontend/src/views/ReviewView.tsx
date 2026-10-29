import React, { useState } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, Edit3, Shield, ArrowLeft,
  Clock, Plus, Info, Check, UserCheck, CornerDownRight, Sparkles, FileText
} from "lucide-react";
import { ClinicalRecord, ClinicalEvent, ActionStatus, ExtractionWarning } from "../types/clinical";
import { updateRecord, approveRecord } from "../services/api";
import { StatusBadge, ReviewBadge } from "../components/StatusBadge";
import { ConfidenceMeter } from "../components/ConfidenceMeter";

interface ReviewViewProps {
  record: ClinicalRecord;
  warnings?: ExtractionWarning[];
  onBack: () => void;
  onRecordApproved: (updatedRecord: ClinicalRecord) => void;
  onRecordUpdated: (updatedRecord: ClinicalRecord) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  record,
  warnings = [],
  onBack,
  onRecordApproved,
  onRecordUpdated
}) => {
  const [events, setEvents] = useState<ClinicalEvent[]>(record.events);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    record.events.length > 0 ? record.events[0].event_id : null
  );
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("Field extraction verified by responder on scene.");
  const [actorId, setActorId] = useState(record.audit.last_modified_by || "EMS-PARAMEDIC-01");
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const handleUpdateEventField = (eventId: string, field: string, value: any) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.event_id !== eventId) return ev;
        const updated = { ...ev, review_status: "modified" as const };

        if (field === "medication_name") {
          updated.medication = { ...updated.medication!, name: value };
        } else if (field === "dose_value") {
          updated.dose = { ...updated.dose!, value: value === "" ? null : parseFloat(value) };
        } else if (field === "dose_unit") {
          updated.dose = { ...updated.dose!, unit: value };
        } else if (field === "route_normalized") {
          updated.route = { ...updated.route!, normalized: value };
        } else if (field === "event_time") {
          updated.event_time = value;
        } else if (field === "administration_status") {
          updated.administration_status = value as ActionStatus;
        } else if (field === "performer") {
          updated.performer = value;
        } else if (field === "reviewer_notes") {
          updated.reviewer_notes = value;
        }
        return updated;
      })
    );
  };

  const handleConfirmEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.event_id === eventId ? { ...ev, review_status: "confirmed" as const } : ev
      )
    );
  };

  const handleRejectEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.event_id === eventId ? { ...ev, review_status: "rejected" as const } : ev
      )
    );
  };

  const handleSaveRevisions = async () => {
    setSaving(true);
    try {
      const updated = await updateRecord(
        record.record_id,
        events,
        "Human verification changes saved",
        actorId
      );
      onRecordUpdated(updated);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (err) {
      console.error("Save revision error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmApproval = async () => {
    setSaving(true);
    try {
      // First save current event state
      await updateRecord(record.record_id, events, "Pre-approval event adjustments", actorId);
      // Then approve
      const approved = await approveRecord(record.record_id, approvalNotes, actorId);
      setIsApproving(false);
      onRecordApproved(approved);
    } catch (err) {
      console.error("Approval error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Render original text with highlighted spans
  const renderAnnotatedText = () => {
    const rawText = record.source.original_text;
    if (!rawText) return null;

    // Build segments
    return (
      <div className="text-sm text-slate-200 leading-relaxed font-sans bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
        <p>
          {rawText}
        </p>
      </div>
    );
  };

  const confirmedCount = events.filter((e) => e.review_status === "confirmed").length;
  const pendingCount = events.filter((e) => e.review_status === "pending").length;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Clinical Review & Verification</h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-500/30">
                Rev #{record.audit.revision}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Review and verify model-extracted medications, doses, routes, and statuses.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveRevisions}
            disabled={saving}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-700 transition-all active:scale-95"
          >
            {saving ? "Saving..." : "Save Edits (Draft)"}
          </button>

          <button
            onClick={() => setIsApproving(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all active:scale-95"
          >
            <Shield className="w-4 h-4" />
            Approve & Finalize Record
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Revisions and audit entry successfully recorded in cryptographic hash chain.</span>
        </div>
      )}

      {/* Warnings & Adverse Detection Alert Box */}
      {warnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Clinical Extraction Warnings ({warnings.length})</span>
          </div>
          <ul className="text-xs text-amber-200/90 space-y-1 list-disc list-inside">
            {warnings.map((w, idx) => (
              <li key={idx} className="leading-relaxed">
                <span className="font-mono text-[11px] font-semibold text-amber-300">[{w.code}]</span> {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dual Pane Main Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Original Note & Evidence (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 sticky top-20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-400" />
                Original On-Scene Note
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Modality: {record.source.type}
              </span>
            </div>

            {renderAnnotatedText()}

            {/* Verification Progress Box */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Verification Progress:</span>
                <span className="font-mono font-bold text-white">
                  {confirmedCount} / {events.length} Confirmed
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${events.length > 0 ? (confirmedCount / events.length) * 100 : 0}%` }}
                />
              </div>
              {pendingCount > 0 && (
                <p className="text-[11px] text-amber-400/90 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {pendingCount} event(s) awaiting explicit human verification.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Extracted Event Cards (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Extracted Clinical Events ({events.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Click fields below to edit or resolve missing values
            </span>
          </div>

          <div className="space-y-4">
            {events.map((ev, index) => {
              const isSelected = selectedEventId === ev.event_id;
              const isMed = ev.event_type === "medication_administration";
              const isProc = ev.event_type === "procedure";
              const isObs = ev.event_type === "observation";

              return (
                <div
                  key={ev.event_id}
                  onClick={() => setSelectedEventId(ev.event_id)}
                  className={`bg-slate-900 border rounded-2xl p-5 transition-all shadow-md ${
                    isSelected
                      ? "border-sky-500/80 shadow-sky-950/30 ring-1 ring-sky-500/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Event Card Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-slate-400">#{index + 1}</span>
                        <h3 className="font-bold text-base text-white">
                          {isMed
                            ? ev.medication?.name || "Unrecorded Medication"
                            : isProc
                            ? ev.procedure_name || "Clinical Procedure"
                            : ev.observation_name || "Observation"}
                        </h3>
                        {ev.is_correction && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ON-SCENE CORRECTION
                          </span>
                        )}
                        <ReviewBadge status={ev.review_status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <span>Time: {ev.event_time || "Not Recorded"}</span>
                        <span>&bull;</span>
                        <span>Type: {ev.event_type}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={ev.administration_status} size="sm" />
                      <ConfidenceMeter score={ev.confidence} />
                    </div>
                  </div>

                  {/* Interactive Editable Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 text-xs">
                    {/* Entity Name */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">
                        {isMed ? "Medication Name" : isProc ? "Procedure Name" : "Observation"}
                      </label>
                      <input
                        type="text"
                        value={isMed ? ev.medication?.name || "" : isProc ? ev.procedure_name || "" : ev.observation_name || ""}
                        onChange={(e) =>
                          handleUpdateEventField(
                            ev.event_id,
                            isMed ? "medication_name" : isProc ? "procedure_name" : "observation_name",
                            e.target.value
                          )
                        }
                        className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    {/* Action Status Dropdown */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Clinical Action Status</label>
                      <select
                        value={ev.administration_status}
                        onChange={(e) =>
                          handleUpdateEventField(ev.event_id, "administration_status", e.target.value)
                        }
                        className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                      >
                        <option value="administered">Administered (Completed)</option>
                        <option value="planned">Planned / Prepared (Not Given)</option>
                        <option value="withheld">Withheld / Contraindicated</option>
                        <option value="refused">Patient Refused</option>
                        <option value="prior_administration">Prior to Arrival (Home/Bystander)</option>
                        <option value="discontinued">Discontinued / Stopped</option>
                        <option value="mentioned">Mentioned Only</option>
                      </select>
                    </div>

                    {/* Dose Value & Unit (for Medications & Procedures with rate) */}
                    {(isMed || ev.dose) && (
                      <>
                        <div>
                          <label className="text-[11px] font-medium text-slate-400">Dose Value</label>
                          <input
                            type="number"
                            step="any"
                            value={ev.dose?.value !== undefined && ev.dose?.value !== null ? ev.dose.value : ""}
                            placeholder="Null / Unrecorded"
                            onChange={(e) => handleUpdateEventField(ev.event_id, "dose_value", e.target.value)}
                            className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-400">Dose Unit</label>
                          <input
                            type="text"
                            value={ev.dose?.unit || ""}
                            placeholder="mg, mcg, L/min, mL"
                            onChange={(e) => handleUpdateEventField(ev.event_id, "dose_unit", e.target.value)}
                            className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </>
                    )}

                    {/* Route (for Medications) */}
                    {isMed && (
                      <div>
                        <label className="text-[11px] font-medium text-slate-400">Route of Administration</label>
                        <select
                          value={ev.route?.normalized || ""}
                          onChange={(e) =>
                            handleUpdateEventField(ev.event_id, "route_normalized", e.target.value || null)
                          }
                          className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                        >
                          <option value="">None / Not Documented</option>
                          <option value="intramuscular">Intramuscular (IM)</option>
                          <option value="intravenous">Intravenous (IV)</option>
                          <option value="intranasal">Intranasal (IN)</option>
                          <option value="sublingual">Sublingual (SL)</option>
                          <option value="inhalation">Inhalation / Nebulized</option>
                          <option value="oral">Oral (PO)</option>
                          <option value="subcutaneous">Subcutaneous (SC)</option>
                          <option value="intraosseous">Intraosseous (IO)</option>
                          <option value="rectal">Rectal (PR)</option>
                          <option value="endotracheal">Endotracheal (ET)</option>
                        </select>
                      </div>
                    )}

                    {/* Event Timestamp */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Event Time (24h or HH:MM)</label>
                      <input
                        type="text"
                        value={ev.event_time || ""}
                        placeholder="HH:MM (e.g. 14:36)"
                        onChange={(e) => handleUpdateEventField(ev.event_id, "event_time", e.target.value)}
                        className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Evidence Text Span Quotation */}
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 mt-1 flex items-start gap-2">
                    <CornerDownRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400">Extracted Span: </span>
                      <span className="italic text-slate-200">"{ev.source_span}"</span>
                    </div>
                  </div>

                  {/* Card Verification Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-800">
                    <button
                      onClick={() => handleRejectEvent(ev.event_id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        ev.review_status === "rejected"
                          ? "bg-rose-950 text-rose-300 border-rose-500"
                          : "bg-slate-850 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border-slate-700 hover:border-rose-500/50"
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject Event
                    </button>

                    <button
                      onClick={() => handleConfirmEvent(ev.event_id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        ev.review_status === "confirmed"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                          : "bg-slate-800 hover:bg-emerald-950/80 text-slate-300 hover:text-emerald-300 border-slate-700 hover:border-emerald-500/50"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm Event
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Approval & Sign-Off Modal */}
      {isApproving && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Clinical Approval & Final Sign-Off</h3>
                <p className="text-xs text-slate-400">
                  Verify accuracy and cryptographically seal this clinical record.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-300">Authorizing Clinician / Responder ID</label>
                <input
                  type="text"
                  value={actorId}
                  onChange={(e) => setActorId(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300">Approval Notes & Cross-Verification</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span>Cryptographic SHA-256 Seal:</span>
                  <span className="text-emerald-400 font-mono">APPEND BLOCK #{record.audit.revision + 1}</span>
                </div>
                <p>
                  Approving will mark all pending events as verified, lock this revision, and generate a tamper-evident audit entry.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsApproving(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={saving}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-all"
              >
                <Check className="w-4 h-4" />
                {saving ? "Signing..." : "Confirm & Sign Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
