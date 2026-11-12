import React, { useState } from 'react';
import { Bill, BillVersion } from '../types/legislative';
import { 
  X, 
  FileText, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  Scale, 
  Vote, 
  Building, 
  History, 
  ChevronRight,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

interface BillModalProps {
  bill: Bill | null;
  onClose: () => void;
  onOpenAiChat: (prompt: string) => void;
}

export const BillModal: React.FC<BillModalProps> = ({
  bill,
  onClose,
  onOpenAiChat,
}) => {
  const [activeTab, setActiveTab] = useState<'policy' | 'versions' | 'analysis' | 'fiscal' | 'votes'>('policy');
  const [selectedVersionCode, setSelectedVersionCode] = useState<string>('I');
  const [copied, setCopied] = useState(false);

  if (!bill) return null;

  const currentVersion = bill.versions.find((v) => v.versionCode === selectedVersionCode) || bill.versions[0];
  const isOppose = bill.stance === 'OPPOSE';
  const isSupport = bill.stance === 'SUPPORT';

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(`${bill.billNumber} (${bill.session}), authored by ${bill.author}. Caption: ${bill.caption}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Top Bar */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/95 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-amber-400 bg-amber-950/40 px-2.5 py-0.5 rounded border border-amber-800/40">
                {bill.billNumber}
              </span>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                {bill.session} • {bill.chamber}
              </span>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  isOppose
                    ? 'text-rose-400 bg-rose-950/50 border border-rose-800/50'
                    : isSupport
                    ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/50'
                    : 'text-slate-400 bg-slate-800 border border-slate-700'
                }`}
              >
                {bill.stance} • Priority {bill.priorityScore}/5
              </span>
            </div>

            <h2 className="text-sm md:text-base font-semibold text-slate-100 mt-2 line-clamp-2 leading-relaxed">
              {bill.caption}
            </h2>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs text-slate-400 font-mono">
              <span>Author: <strong className="text-slate-200">{bill.author}</strong></span>
              {bill.coauthors.length > 0 && <span>Co-authors: {bill.coauthors.join(', ')}</span>}
              <span>Status: <strong className="text-slate-200">{bill.currentStatus}</strong></span>
              <span>Committee: {bill.committee}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyCitation}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Copy bill citation"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-950/60 px-5 gap-1 text-xs">
          {[
            { id: 'policy', label: 'Policy Alignment & Comport/Conflict', icon: ShieldAlert },
            { id: 'versions', label: `Statutory Text (${bill.versions.length} Versions)`, icon: History },
            { id: 'analysis', label: 'State Agency Analysis', icon: Scale },
            { id: 'fiscal', label: 'Fiscal Note (LBB)', icon: DollarSign },
            { id: 'votes', label: `Votes & Amendments (${bill.votes.length} Votes)`, icon: Vote },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 px-3 whitespace-nowrap font-medium border-b-2 flex items-center gap-1.5 transition ${
                  isActive
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body / Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: Policy Alignment */}
          {activeTab === 'policy' && (
            <div className="space-y-6">
              
              {/* Executive Summary */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Executive Intelligence Summary
                </div>
                <p className="text-sm text-slate-200 mt-2 leading-relaxed">
                  {bill.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bill.categories.map((cat, idx) => (
                    <span key={idx} className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      #{cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Comport & Conflict Point-by-Point */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span>Policy Alignment Breakdown</span>
                  <span className="text-xs font-normal text-slate-400">
                    (Evaluated against your active priorities)
                  </span>
                </h3>

                {bill.comportConflict.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
                    No active priority conflicts detected. Bill is marked as Neutral / Procedural.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bill.comportConflict.map((cc, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-xl border leading-relaxed ${
                          cc.alignment === 'CONFLICTS'
                            ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                            : cc.alignment === 'COMPORTS'
                            ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200'
                            : 'bg-slate-800/40 border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                          <span className="flex items-center gap-1.5">
                            {cc.alignment === 'CONFLICTS' ? (
                              <XCircle className="w-4 h-4 text-rose-400" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                            <span>{cc.alignment}: {cc.priorityName}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 pl-5.5">
                          {cc.impactExplanation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Impacted State Agencies */}
              {bill.impactedAgencies.length > 0 && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-amber-400" />
                    <span>Impacted State Agencies & Regulatory Bodies</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {bill.impactedAgencies.map((agency, i) => (
                      <li key={i}>{agency}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ask AI about this bill */}
              <div className="pt-2">
                <button
                  onClick={() => onOpenAiChat(`Give me a detailed strategic breakdown of ${bill.billNumber} by ${bill.author}. What are the primary arguments used by advocates and opponents during hearings?`)}
                  className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-2 transition"
                >
                  <span>Ask AI Analyst to Cross-Examine {bill.billNumber}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: Versions & Statutory Text */}
          {activeTab === 'versions' && (
            <div className="space-y-4">
              
              {/* Version Selectors */}
              <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-800">
                {bill.versions.map((ver) => (
                  <button
                    key={ver.versionCode}
                    onClick={() => setSelectedVersionCode(ver.versionCode)}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition ${
                      currentVersion.versionCode === ver.versionCode
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>Version {ver.versionCode}: {ver.versionName}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">({ver.charCount.toLocaleString()} chars)</span>
                  </button>
                ))}
              </div>

              {/* Text Viewer Panel */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-3 border-b border-slate-800/80 mb-3">
                  <span>Version Date: {currentVersion.dateFiled}</span>
                  <span>Length: {currentVersion.charCount.toLocaleString()} characters</span>
                </div>

                <div className="font-mono text-xs text-slate-200 bg-slate-900/70 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 border border-slate-800/60">
                  {currentVersion.fullText}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: State Agency Analysis */}
          {activeTab === 'analysis' && (
            <div className="space-y-5">
              {bill.billAnalysis ? (
                <>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
                      Prepared by: {bill.billAnalysis.agency}
                    </div>
                    <div className="text-sm font-semibold text-slate-200 mt-1">
                      Subject: {bill.billAnalysis.subject}
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {bill.billAnalysis.background}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Arguments For */}
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                      <h4 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider mb-2">
                        Supporters State / Arguments For:
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
                        {bill.billAnalysis.argumentsFor.map((arg, idx) => (
                          <li key={idx} className="leading-relaxed">{arg}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Arguments Against */}
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                      <h4 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider mb-2">
                        Opponents State / Arguments Against:
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
                        {bill.billAnalysis.argumentsAgainst.map((arg, idx) => (
                          <li key={idx} className="leading-relaxed">{arg}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Impacted Statutes */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Affected Texas Code Statutes:
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {bill.billAnalysis.impactedStatutes.map((st, i) => (
                        <span key={i} className="font-mono text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
                          {st}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-xs text-slate-500">
                  Official House Research Organization analysis not yet published for this version.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Fiscal Note */}
          {activeTab === 'fiscal' && (
            <div className="space-y-4">
              {bill.fiscalNote ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                        5-Year Fiscal Impact
                      </div>
                      <div className="text-base font-bold font-mono text-amber-300 mt-1">
                        {bill.fiscalNote.fiveYearCost}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                        Prepared By
                      </div>
                      <div className="text-sm font-semibold text-slate-200 mt-1">
                        {bill.fiscalNote.preparedBy}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-mono text-slate-400 uppercase">Impact on Local Government & ISDs</h4>
                      <p className="text-xs text-slate-300 mt-1">{bill.fiscalNote.impactOnLocalGov}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <h4 className="text-xs font-mono text-slate-400 uppercase">Impact on State General Revenue</h4>
                      <p className="text-xs text-slate-300 mt-1">{bill.fiscalNote.impactOnGeneralRevenue}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <h4 className="text-xs font-mono text-slate-400 uppercase">LBB Methodology & Assumptions</h4>
                      <p className="text-xs text-slate-300 mt-1">{bill.fiscalNote.methodologySummary}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-xs text-slate-500">
                  Fiscal note pending review by the Legislative Budget Board.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Committee Votes & Amendments */}
          {activeTab === 'votes' && (
            <div className="space-y-6">
              
              {/* Committee Votes */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
                  Record Roll Call Votes ({bill.votes.length})
                </h3>

                {bill.votes.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    No record committee votes recorded yet in this legislative session.
                  </div>
                ) : (
                  bill.votes.map((vote, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-200 text-xs">{vote.committee}</div>
                          <div className="text-[11px] text-slate-400 font-mono">Date: {vote.date} • {vote.result}</div>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                            {vote.ayes} Ayes
                          </span>
                          <span className="text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                            {vote.nays} Nays
                          </span>
                          {vote.pnv > 0 && <span className="text-slate-400">{vote.pnv} PNV</span>}
                        </div>
                      </div>

                      {vote.rollCall && (
                        <div className="pt-2 border-t border-slate-800/60">
                          <div className="text-[11px] font-mono text-slate-400 mb-1.5">Member Roll Call:</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                            {vote.rollCall.map((rc, j) => (
                              <div key={j} className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                                <span className="text-slate-300 truncate">{rc.member}</span>
                                <span className={`font-mono text-[10px] font-bold ${rc.vote === 'Aye' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {rc.vote}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Amendments */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
                  Filed Amendments ({bill.amendments.length})
                </h3>

                {bill.amendments.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    No amendments filed to date.
                  </div>
                ) : (
                  bill.amendments.map((amd) => (
                    <div key={amd.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-slate-200">Amendment #{amd.number} by {amd.author}</span>
                        <span className="text-amber-400 font-semibold">{amd.action}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{amd.summary}</p>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
