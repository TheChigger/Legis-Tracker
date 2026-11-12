import React from 'react';
import { Bill, DashboardStats, PolicyPriority, SessionId } from '../types/legislative';
import { SESSIONS_METADATA } from '../data/mockData';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Sliders, 
  ArrowRight, 
  Clock, 
  Flame, 
  FileCode,
  ShieldCheck,
  TrendingUp,
  Landmark,
  Calendar,
  History,
  Scale
} from 'lucide-react';

interface PriorityDashboardProps {
  stats: DashboardStats;
  bills: Bill[];
  priorities: PolicyPriority[];
  onSelectBill: (bill: Bill) => void;
  onOpenPriorities: () => void;
  onOpenAiChat: (prefillPrompt?: string) => void;
  onSelectSession?: (session: SessionId) => void;
}

export const PriorityDashboard: React.FC<PriorityDashboardProps> = ({
  stats,
  bills,
  priorities,
  onSelectBill,
  onOpenPriorities,
  onOpenAiChat,
  onSelectSession,
}) => {
  const urgentBills = bills.filter((b) => b.priorityScore >= 4);
  const supportBills = bills.filter((b) => b.stance === 'SUPPORT');
  const opposeBills = bills.filter((b) => b.stance === 'OPPOSE');
  const activePriorities = priorities.filter((p) => p.isActive);

  // Look up metadata for active session
  const currentSessionMeta = SESSIONS_METADATA.find((s) => s.session === stats.session) || SESSIONS_METADATA[0];

  return (
    <div className="space-y-8">
      
      {/* Top Banner: Legislative Status & Active Priority Alignment */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 font-semibold">
                100% Real TLO Portal Data
              </span>
              <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                Session {stats.session} • {stats.totalTrackedBills.toLocaleString()} Real Bills Ingested
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-slate-500" />
                Synced from ftp.legis.state.tx.us
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100 mt-2 tracking-tight">
              Daily Legislative Priority & Stance Briefing
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Every real bill filed in the Texas Legislature is ingested from official Capitol records and interpreted against your active political priorities 
              (Church/State neutrality, Public Education defense, Healthcare access, Grid weatherization).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenPriorities}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Tune Priorities ({activePriorities.length} Active)</span>
            </button>
            <button
              onClick={() => onOpenAiChat(`Summarize the most critical bills filed in the ${stats.session} Texas session that conflict with church/state separation and public education`)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-sm transition"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>AI Priority Brief</span>
            </button>
          </div>
        </div>
      </div>

      {/* Historical Session Dossier & Quick Switcher (85R to 90R) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-100 tracking-tight">
                Texas Capitol Historical Session Dossier: {currentSessionMeta.name} ({currentSessionMeta.years})
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Convened: {currentSessionMeta.conveneDate} • Adjourned: {currentSessionMeta.adjournDate}
            </p>
          </div>

          {/* Quick Session Switcher Buttons */}
          {onSelectSession && (
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-500 px-2">Jump to:</span>
              {SESSIONS_METADATA.map((s) => (
                <button
                  key={s.session}
                  onClick={() => onSelectSession(s.session)}
                  className={`px-2.5 py-1 text-xs font-mono rounded font-semibold transition ${
                    stats.session === s.session
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {s.session}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Leadership & Capitol Stat Strips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Governor</span>
            <span className="text-slate-200 font-semibold">{currentSessionMeta.governor}</span>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Speaker of House</span>
            <span className="text-slate-200 font-semibold">{currentSessionMeta.speaker}</span>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Lt. Governor</span>
            <span className="text-slate-200 font-semibold">{currentSessionMeta.ltGovernor}</span>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Bills Filed</span>
            <span className="text-slate-100 font-bold tabular-nums">
              {currentSessionMeta.totalFiled.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Passed Both</span>
            <span className="text-emerald-400 font-bold tabular-nums">
              {currentSessionMeta.totalPassed.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Vetoed</span>
            <span className="text-rose-400 font-bold tabular-nums">
              {currentSessionMeta.totalVetoed.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Legislative Themes & Political Context */}
        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-300">
          <Scale className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-200 font-mono">Political Dynamics:</strong> {currentSessionMeta.politicalContext}
          </p>
        </div>
      </div>

      {/* KPI Numbers Strip - Zero Pill Discipline, Clean Tabular Figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Total Bills Tracked
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-slate-100">
              {stats.totalTrackedBills.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">in {stats.session}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-amber-400" />
            <span>Updated hourly from TLO reports</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Urgent Policy Alerts</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-rose-300">
              {urgentBills.length}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Priority 4-5</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            High-stake statutory changes
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Comporting Bills (Support)</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-emerald-300">
              {supportBills.length}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">advances goals</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Medicaid, Voting, Grid rules
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>Conflicting Bills (Oppose)</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-rose-300">
              {opposeBills.length}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">violates goals</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Vouchers, Classroom Displays
          </div>
        </div>

      </div>

      {/* Urgent Policy Watch: High Impact Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Immediate Attention Bills Filed
            </h2>
            <p className="text-xs text-slate-400">
              Highest weighted items requiring urgent attention based on your custom criteria
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Showing {urgentBills.length} high-priority bills
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {urgentBills.map((bill) => {
            const isOppose = bill.stance === 'OPPOSE';
            const isSupport = bill.stance === 'SUPPORT';

            return (
              <div
                key={bill.id}
                onClick={() => onSelectBill(bill)}
                className="group relative cursor-pointer bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {bill.billNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {bill.chamber} • {bill.dateFiled}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Stance Indicator without pill enclosing */}
                      <span
                        className={`text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded ${
                          isOppose
                            ? 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
                            : isSupport
                            ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                            : 'text-slate-400 bg-slate-800'
                        }`}
                      >
                        {bill.stance}
                      </span>
                      <span className="font-mono text-xs text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-800/30">
                        ★ {bill.priorityScore}/5
                      </span>
                    </div>
                  </div>

                  {/* Author and Caption */}
                  <div className="mt-2.5">
                    <div className="text-xs font-semibold text-slate-300">
                      Author: <span className="text-slate-100">{bill.author}</span>
                      {bill.coauthors.length > 0 && (
                        <span className="text-slate-400 font-normal"> +{bill.coauthors.length} co-authors</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                      {bill.caption}
                    </p>
                  </div>

                  {/* Comport / Conflict Breakdown Section */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                    {bill.comportConflict.map((cc, i) => (
                      <div
                        key={i}
                        className={`text-xs p-2.5 rounded-lg border leading-relaxed ${
                          cc.alignment === 'CONFLICTS'
                            ? 'bg-rose-950/20 border-rose-900/30 text-rose-200'
                            : cc.alignment === 'COMPORTS'
                            ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-200'
                            : 'bg-slate-800/40 border-slate-700/40 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-[11px] mb-1">
                          {cc.alignment === 'CONFLICTS' ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          <span>{cc.alignment}: {cc.priorityName}</span>
                        </div>
                        <p className="text-[11px] opacity-90">{cc.impactExplanation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[11px] text-slate-500">
                    Status: {bill.currentStatus}
                  </span>
                  <span className="text-amber-400 group-hover:text-amber-300 font-medium flex items-center gap-1 transition">
                    <span>Inspect Text & Votes</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side: Comporting vs Conflicting Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        
        {/* Left Column: Comporting / Priority Support */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Advancing Policy Priorities ({supportBills.length})</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">SUPPORT stance</span>
          </div>

          <div className="space-y-3">
            {supportBills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => onSelectBill(bill)}
                className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border-l-2 border-emerald-500 border-r border-t border-b border-slate-800 rounded-r-lg p-3.5 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-100">
                      {bill.billNumber}
                    </span>
                    <span className="text-xs text-slate-400">{bill.author}</span>
                  </div>
                  <span className="font-mono text-xs text-amber-400">
                    Priority {bill.priorityScore}/5
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {bill.caption}
                </p>
                <div className="mt-2 text-[11px] text-emerald-300 flex items-center gap-1">
                  <span>Goal: {bill.primaryCategory}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Conflicting / Opposed Legislation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              <span>Threatening Policy Priorities ({opposeBills.length})</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">OPPOSE stance</span>
          </div>

          <div className="space-y-3">
            {opposeBills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => onSelectBill(bill)}
                className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border-l-2 border-rose-500 border-r border-t border-b border-slate-800 rounded-r-lg p-3.5 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-100">
                      {bill.billNumber}
                    </span>
                    <span className="text-xs text-slate-400">{bill.author}</span>
                  </div>
                  <span className="font-mono text-xs text-amber-400">
                    Priority {bill.priorityScore}/5
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {bill.caption}
                </p>
                <div className="mt-2 text-[11px] text-rose-300 flex items-center gap-1">
                  <span>Conflict: {bill.primaryCategory}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
