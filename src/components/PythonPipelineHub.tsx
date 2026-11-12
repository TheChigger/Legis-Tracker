import React, { useState } from 'react';
import { ROOT_CAUSE_ANALYSIS, FIXED_PYTHON_SCRIPTS, PythonScriptDoc } from '../data/pythonPipelineCode';
import { 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Download, 
  FileCode, 
  ArrowRight,
  Database,
  Cpu,
  Layers,
  RefreshCw
} from 'lucide-react';

export const PythonPipelineHub: React.FC = () => {
  const [selectedScript, setSelectedScript] = useState<PythonScriptDoc>(FIXED_PYTHON_SCRIPTS[0]);
  const [copied, setCopied] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  const handleTriggerIngest = async () => {
    setIsIngesting(true);
    setIngestStatus(null);
    try {
      const res = await fetch('/api/ingest/trigger', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIngestStatus(`Success! Ingested from FTP. Total 90R Bills: ${data.total90RBills}`);
      } else {
        setIngestStatus(`Error: ${data.details || 'Failed to run script'}`);
      }
    } catch (e: any) {
      setIngestStatus(`Failed: ${e.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedScript.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([selectedScript.code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedScript.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                Local Environment Bridge
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Python 3.12+ • Ollama (Llama 3.1) • ChromaDB • SQLite
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100 mt-2 tracking-tight">
              Local Legislative Ingestion & Evaluation Pipeline (v2)
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              We identified the exact failure points causing your previous 500 errors and script loops. 
              Below are the corrected, drop-in Python scripts ready to run on your local machine alongside Ollama.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleTriggerIngest}
              disabled={isIngesting}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isIngesting ? 'animate-spin' : ''}`} />
              <span>{isIngesting ? 'Ingesting from FTP...' : 'Run Ingestion Now'}</span>
            </button>
            <button
              onClick={handleCopyCode}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Script'}</span>
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 flex items-center gap-1.5 shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {selectedScript.filename}</span>
            </button>
          </div>
        </div>

        {ingestStatus && (
          <div className="mt-4 p-3 rounded-lg bg-slate-900 border border-amber-500/30 text-xs font-mono text-amber-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{ingestStatus}</span>
          </div>
        )}
      </div>

      {/* Root Cause Diagnosis Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-slate-100">
            Root-Cause Diagnosis: Why Your Previous Scripts Failed
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROOT_CAUSE_ANALYSIS.issues.map((issue) => (
            <div key={issue.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-xs">{issue.title}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-950/50 text-rose-300 border border-rose-800/50">
                  {issue.severity}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {issue.description}
              </p>
              <div className="pt-2 border-t border-slate-800/60 text-xs text-emerald-300 flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Fix Applied:</strong> {issue.fix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Script Selector and Code Viewer */}
      <div className="space-y-4">
        
        {/* Tabs for scripts */}
        <div className="flex flex-wrap gap-2">
          {FIXED_PYTHON_SCRIPTS.map((script) => (
            <button
              key={script.filename}
              onClick={() => setSelectedScript(script)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-medium border flex items-center gap-2 transition ${
                selectedScript.filename === script.filename
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-bold'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span>{script.filename}</span>
            </button>
          ))}
        </div>

        {/* Selected Script Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">{selectedScript.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{selectedScript.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownloadCode}
                className="px-3 py-1.5 text-xs rounded bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Fixes checklist */}
          <div className="flex flex-wrap gap-2 text-xs">
            {selectedScript.fixesApplied.map((fix, idx) => (
              <span key={idx} className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-950/30 text-emerald-300 border border-emerald-900/40 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{fix}</span>
              </span>
            ))}
          </div>

          {/* Code block */}
          <div className="relative mt-2">
            <pre className="font-mono text-xs text-slate-200 bg-slate-950 p-4 rounded-xl overflow-x-auto max-h-[500px] border border-slate-850 leading-relaxed">
              {selectedScript.code}
            </pre>
          </div>
        </div>

      </div>

      {/* 3-Step Execution Quick Start */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-400" />
          <span>Local Deployment Quick-Start (3 Terminal Steps)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="font-mono text-amber-400 font-bold">Step 1: Install Dependencies</div>
            <p className="text-slate-400">Install Python packages for FastAPI, Chroma, and Ollama:</p>
            <div className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-200 select-all border border-slate-800">
              pip install fastapi uvicorn requests beautifulsoup4 ollama chromadb
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="font-mono text-amber-400 font-bold">Step 2: Sync TLO & Enrich</div>
            <p className="text-slate-400">Run the robust scraper and evaluate against political priorities:</p>
            <div className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-200 select-all border border-slate-800 space-y-1">
              <div>python pipeline_v2.py</div>
              <div>python enrich_bills_v2.py</div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="font-mono text-amber-400 font-bold">Step 3: Launch Resilient API</div>
            <p className="text-slate-400">Start the backend on port 8000 with guarded vector search:</p>
            <div className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-200 select-all border border-slate-800">
              uvicorn main_v2:app --reload --port 8000
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
