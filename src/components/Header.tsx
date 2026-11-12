import React from 'react';
import { SessionId } from '../types/legislative';
import { 
  Building2, 
  Sparkles, 
  Sliders, 
  Users, 
  Calendar, 
  FileText, 
  Terminal, 
  Search 
} from 'lucide-react';

export type NavTab = 'dashboard' | 'bills' | 'legislators' | 'committees' | 'priorities' | 'ai' | 'python';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  session: SessionId;
  setSession: (s: SessionId) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  urgentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  session,
  setSession,
  globalSearch,
  setGlobalSearch,
  urgentCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand & Texas Capitol Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 tracking-tight text-base">
                  TEXAS CAPITOL
                </span>
                <span className="text-xs uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                  Real TLO Data
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Live Ingestion from capitol.texas.gov & ftp.legis.state.tx.us
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>Priority Feed</span>
              {urgentCount > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {urgentCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('bills')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'bills'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bill Explorer</span>
            </button>

            <button
              onClick={() => setActiveTab('legislators')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'legislators'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Lawmaker Profiles</span>
            </button>

            <button
              onClick={() => setActiveTab('committees')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'committees'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Committees & Minutes</span>
            </button>

            <button
              onClick={() => setActiveTab('priorities')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'priorities'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Policy Priorities</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'ai'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Analyst</span>
            </button>

            <button
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'python'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Local Pipeline (v2)</span>
            </button>
          </nav>

          {/* Right Session Switcher & Global Search */}
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-44 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search bills, authors, topic..."
                className="w-full bg-slate-900/80 border border-slate-800 text-xs text-slate-200 rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 placeholder:text-slate-500"
              />
            </div>

            {/* Session Selector (85R to 90R) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-400 hidden xl:inline uppercase tracking-wider">Session:</span>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value as SessionId)}
                className="bg-slate-900 border border-slate-700 hover:border-amber-500/60 text-xs font-mono font-bold text-amber-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/40 cursor-pointer shadow-sm"
                title="Select Texas Legislative Session (90R back to 85R)"
              >
                <option value="90R">90R (2027 Prefiling)</option>
                <option value="89R">89R (2025 Regular)</option>
                <option value="88R">88R (2023 Regular)</option>
                <option value="87R">87R (2021 Regular)</option>
                <option value="86R">86R (2019 Regular)</option>
                <option value="85R">85R (2017 Regular)</option>
              </select>
            </div>
          </div>

        </div>

        {/* Mobile Navigation bar */}
        <div className="flex lg:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-800/60 no-scrollbar">
          {[
            { id: 'dashboard', label: 'Feed' },
            { id: 'bills', label: 'Bills' },
            { id: 'legislators', label: 'Lawmakers' },
            { id: 'committees', label: 'Committees' },
            { id: 'priorities', label: 'Priorities' },
            { id: 'ai', label: 'AI Analyst' },
            { id: 'python', label: 'Python Scripts' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as NavTab)}
              className={`px-3 py-1 text-xs whitespace-nowrap rounded-md font-medium ${
                activeTab === item.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:bg-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

      </div>
    </header>
  );
};
