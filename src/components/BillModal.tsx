import React, { useState, useEffect } from 'react';
import { Bill, BillVersion, AmendedStatute } from '../types/legislative';
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
  Check, 
  Download, 
  BookOpen, 
  Loader2,
  AlertCircle
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
  const [activeTab, setActiveTab] = useState<'policy' | 'versions' | 'statutes' | 'analysis' | 'fiscal' | 'votes'>('policy');
  const [selectedVersionCode, setSelectedVersionCode] = useState<string>('I');
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  
  // Full text and statute state
  const [liveFullText, setLiveFullText] = useState<string>('');
  const [amendedStatutes, setAmendedStatutes] = useState<AmendedStatute[]>([]);
  const [officialTloUrl, setOfficialTloUrl] = useState<string>('');
  const [officialPdfUrl, setOfficialPdfUrl] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState<boolean>(false);
  
  // Preview statute text
  const [selectedStatutePreview, setSelectedStatutePreview] = useState<{ code: string; chapter: string; text: string } | null>(null);
  const [isLoadingStatute, setIsLoadingStatute] = useState<boolean>(false);

  useEffect(() => {
    if (!bill) return;

    // Reset state
    setSelectedStatutePreview(null);
    const existingVer = bill.versions.find((v) => v.versionCode === selectedVersionCode) || bill.versions[0];
    const initialText = existingVer?.fullText || '';
    setLiveFullText(initialText);
    setAmendedStatutes(bill.amendedStatutes || []);

    const m = bill.billNumber.replace(/\s+/g, '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (m) {
      const [, prefix, num] = m;
      const padded = `${prefix}${String(num).padStart(5, '0')}I`;
      setOfficialTloUrl(bill.officialTloUrl || `https://capitol.texas.gov/tlodocs/${bill.session}/billtext/html/${padded}.htm`);
      setOfficialPdfUrl(bill.officialPdfUrl || `https://capitol.texas.gov/tlodocs/${bill.session}/billtext/pdf/${padded}.pdf`);
    }

    // If initial text is short or was a stub (< 600 chars), fetch the complete authentic text from the server
    if (!initialText || initialText.length < 600) {
      setIsLoadingText(true);
      fetch(`/api/bills/${bill.session}/${bill.billNumber}/text?version=${selectedVersionCode}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.fullText && data.fullText.length > initialText.length) {
            setLiveFullText(data.fullText);
          }
          if (data.amendedStatutes && data.amendedStatutes.length > 0) {
            setAmendedStatutes(data.amendedStatutes);
          }
          if (data.officialTloUrl) setOfficialTloUrl(data.officialTloUrl);
          if (data.officialPdfUrl) setOfficialPdfUrl(data.officialPdfUrl);
        })
        .catch((err) => console.warn('Could not fetch authentic text:', err))
        .finally(() => setIsLoadingText(false));
    }
  }, [bill, selectedVersionCode]);

  if (!bill) return null;

  const currentVersion = bill.versions.find((v) => v.versionCode === selectedVersionCode) || bill.versions[0];
  const isOppose = bill.stance === 'OPPOSE';
  const isSupport = bill.stance === 'SUPPORT';

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(`${bill.billNumber} (${bill.session}), authored by ${bill.author}. Caption: ${bill.caption}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFullText = () => {
    navigator.clipboard.writeText(liveFullText || currentVersion?.fullText || '');
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadTextFile = () => {
    const textToDownload = liveFullText || currentVersion?.fullText || '';
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${bill.session}_${bill.billNumber.replace(/\s+/g, '')}_FullText.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFetchStatutePreview = (codeAbbr: string, chapter: string) => {
    setIsLoadingStatute(true);
    fetch(`/api/statutes/${codeAbbr}/${chapter}`)
      .then((res) => res.json())
      .then((data) => {
        setSelectedStatutePreview({
          code: codeAbbr,
          chapter,
          text: data.snippet || 'No statute text preview available from portal.',
        });
      })
      .catch(() => {
        setSelectedStatutePreview({
          code: codeAbbr,
          chapter,
          text: 'Failed to fetch statute preview from statutes.capitol.texas.gov.',
        });
      })
      .finally(() => setIsLoadingStatute(false));
  };

  const isPrefilingSession = bill.session === '90R';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
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
            { id: 'policy', label: 'Policy Alignment', icon: ShieldAlert },
            { id: 'versions', label: `Full Statutory Text (${(liveFullText || currentVersion.fullText).length.toLocaleString()} chars)`, icon: FileText },
            { id: 'statutes', label: `Amended Statutes (${amendedStatutes.length})`, icon: BookOpen },
            { id: 'analysis', label: 'State Agency Analysis', icon: Scale },
            { id: 'fiscal', label: 'Fiscal Note (LBB)', icon: DollarSign },
            { id: 'votes', label: `Votes & Amendments (${bill.votes.length})`, icon: Vote },
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

          {/* TAB 2: Full Statutory Text Viewer */}
          {activeTab === 'versions' && (
            <div className="space-y-4">
              
              {/* Controls & Official Links Bar */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                    Version {selectedVersionCode} (Introduced)
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Length: <strong>{(liveFullText || currentVersion.fullText).length.toLocaleString()}</strong> characters
                  </span>
                  {isLoadingText && (
                    <span className="text-xs font-mono text-amber-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Syncing live text...</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopyFullText}
                    className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                  </button>

                  <button
                    onClick={handleDownloadTextFile}
                    className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .txt</span>
                  </button>

                  {officialTloUrl && (
                    <a
                      href={officialTloUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs font-mono rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Official TLO HTML</span>
                    </a>
                  )}

                  {officialPdfUrl && (
                    <a
                      href={officialPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Official PDF</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Full Text Display Panel */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Official Statutory Draft • Texas Legislature</span>
                  <span>Full Text Viewer</span>
                </div>

                <div className="font-mono text-xs text-slate-200 bg-slate-950 p-5 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px] select-text">
                  {liveFullText || currentVersion.fullText}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: Amended Texas Statutes */}
          {activeTab === 'statutes' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Texas Codes & Statutes Amended or Referenced by {bill.billNumber}</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  When a bill is enacted, it alters existing Texas law. Below are the specific statutory codes, chapters, and sections amended by this legislation, with direct access to the official Texas Statutes portal.
                </p>
              </div>

              {amendedStatutes.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800 font-mono">
                  No statutory code amendments parsed for this bill draft (may be an uncodified act, constitutional amendment, or resolution).
                </div>
              ) : (
                <div className="space-y-3">
                  {amendedStatutes.map((stat, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-slate-100 flex items-center gap-2 font-mono">
                            <span className="text-amber-400">[{stat.codeAbbr}]</span>
                            <span>{stat.codeName}</span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-1">
                            {stat.chapters.length > 0 && <span>Chapters: {stat.chapters.join(', ')}</span>}
                            {stat.sections.length > 0 && <span className="ml-3">Sections: {stat.sections.join(', ')}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                          {stat.chapters[0] && (
                            <button
                              onClick={() => handleFetchStatutePreview(stat.codeAbbr, stat.chapters[0])}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                            >
                              <span>Preview in App</span>
                            </button>
                          )}

                          <a
                            href={stat.statuteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1 transition"
                          >
                            <span>Read on statutes.capitol.texas.gov</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* In-App Statute Text Preview if requested */}
                      {selectedStatutePreview && selectedStatutePreview.code === stat.codeAbbr && (
                        <div className="mt-3 p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
                          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5 text-[11px]">
                            <span>Current Law Excerpt: {stat.codeName} Chapter {selectedStatutePreview.chapter}</span>
                            <button
                              onClick={() => setSelectedStatutePreview(null)}
                              className="text-slate-400 hover:text-slate-200"
                            >
                              Close
                            </button>
                          </div>
                          <div className="max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                            {selectedStatutePreview.text}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: State Agency Analysis */}
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
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono">
                    <AlertCircle className="w-4 h-4" />
                    <span>Official State Agency Analysis Publication Status</span>
                  </div>
                  <p className="leading-relaxed">
                    Under Texas Legislative rules (House Rule 4, Sec. 32 and Senate Rule 7.12), committee bill analyses by the <strong>House Research Organization (HRO)</strong> and <strong>Texas Legislative Council</strong> are prepared and published <strong>only when a bill is set for a committee hearing and voted out of committee</strong>.
                  </p>
                  {isPrefilingSession ? (
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                      • <strong>Current Stage:</strong> Session {bill.session} is in early pre-filing. Committees have not yet convened, so state agency analyses have not been published on the FTP portal yet.
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                      • Analysis pending publication from the committee clerk for this version.
                    </div>
                  )}
                  {officialTloUrl && (
                    <div className="pt-2">
                      <a
                        href={officialTloUrl.replace('billtext', 'analysis')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 underline font-mono text-xs"
                      >
                        <span>Check Live Capitol Analysis Directory</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Fiscal Note */}
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
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono">
                    <AlertCircle className="w-4 h-4" />
                    <span>Legislative Budget Board (LBB) Fiscal Note Status</span>
                  </div>
                  <p className="leading-relaxed">
                    Under Texas Government Code Chapter 314, official fiscal notes are prepared by the <strong>Legislative Budget Board (LBB)</strong> at the formal request of a committee chair when a bill is set for committee consideration.
                  </p>
                  {isPrefilingSession ? (
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                      • <strong>Pre-filing Status:</strong> In the pre-filing stage of Session {bill.session}, committee assignments and hearings have not commenced. The LBB will publish official fiscal impact notes once hearing schedules are posted.
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                      • Fiscal note pending formal review and publication by the Legislative Budget Board.
                    </div>
                  )}
                  {officialTloUrl && (
                    <div className="pt-2">
                      <a
                        href={officialTloUrl.replace('billtext', 'fiscalnotes')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 underline font-mono text-xs"
                      >
                        <span>Check Live LBB Fiscal Notes Directory</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: Committee Votes & Amendments */}
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

