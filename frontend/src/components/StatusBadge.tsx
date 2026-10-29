import React from "react";
import { ActionStatus, ReviewStatus } from "../types/clinical";
import { CheckCircle2, Clock, AlertTriangle, XCircle, RotateCcw, HelpCircle } from "lucide-react";

interface StatusBadgeProps {
  status: ActionStatus;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const configs: Record<ActionStatus, { bg: string; text: string; border: string; label: string; icon: any }> = {
    administered: {
      bg: "bg-emerald-950/60",
      text: "text-emerald-400",
      border: "border-emerald-500/40",
      label: "Administered",
      icon: CheckCircle2
    },
    planned: {
      bg: "bg-amber-950/60",
      text: "text-amber-400",
      border: "border-amber-500/40",
      label: "Planned / Prepared",
      icon: Clock
    },
    refused: {
      bg: "bg-rose-950/60",
      text: "text-rose-400",
      border: "border-rose-500/40",
      label: "Patient Refused",
      icon: XCircle
    },
    withheld: {
      bg: "bg-orange-950/60",
      text: "text-orange-400",
      border: "border-orange-500/40",
      label: "Withheld / Contraindicated",
      icon: AlertTriangle
    },
    discontinued: {
      bg: "bg-slate-800",
      text: "text-slate-300",
      border: "border-slate-600",
      label: "Discontinued",
      icon: RotateCcw
    },
    prior_administration: {
      bg: "bg-indigo-950/60",
      text: "text-indigo-400",
      border: "border-indigo-500/40",
      label: "Prior to Arrival",
      icon: RotateCcw
    },
    mentioned: {
      bg: "bg-zinc-800",
      text: "text-zinc-400",
      border: "border-zinc-700",
      label: "Mentioned Only",
      icon: HelpCircle
    }
  };

  const cfg = configs[status] || configs.mentioned;
  const Icon = cfg.icon;
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-medium";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border} ${padding}`}>
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {cfg.label}
    </span>
  );
};

export const ReviewBadge: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const map: Record<ReviewStatus, { label: string; color: string; border: string; bg: string }> = {
    pending: { label: "Pending Verification", color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-950/40" },
    confirmed: { label: "Verified & Confirmed", color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-950/40" },
    rejected: { label: "Rejected", color: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-950/40" },
    modified: { label: "Modified / Amended", color: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-950/40" }
  };
  const cfg = map[status] || map.pending;

  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};
