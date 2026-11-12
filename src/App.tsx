import React, { useState, useEffect } from 'react';
import { Header, NavTab } from './components/Header';
import { PriorityDashboard } from './components/PriorityDashboard';
import { BillExplorer } from './components/BillExplorer';
import { BillModal } from './components/BillModal';
import { LegislatorDirectory } from './components/LegislatorDirectory';
import { CommitteeTracker } from './components/CommitteeTracker';
import { PolicyPriorityManager } from './components/PolicyPriorityManager';
import { AIResearchAssistant } from './components/AIResearchAssistant';
import { PythonPipelineHub } from './components/PythonPipelineHub';
import { 
  Bill, 
  Legislator, 
  CommitteeMeeting, 
  PolicyPriority, 
  DashboardStats, 
  SessionId 
} from './types/legislative';
import { 
  MOCK_BILLS, 
  MOCK_LEGISLATORS, 
  MOCK_COMMITTEE_MEETINGS, 
  MOCK_STATS_90R, 
  INITIAL_PRIORITIES 
} from './data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [session, setSession] = useState<SessionId>('90R');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  
  // Data State
  const [bills, setBills] = useState<Bill[]>(MOCK_BILLS.filter((b) => b.session === '90R'));
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS_90R);
  const [legislators, setLegislators] = useState<Legislator[]>(MOCK_LEGISLATORS);
  const [meetings, setMeetings] = useState<CommitteeMeeting[]>(MOCK_COMMITTEE_MEETINGS);
  const [priorities, setPriorities] = useState<PolicyPriority[]>(INITIAL_PRIORITIES);
  
  // Modal & Selection State
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Fetch data from server when session changes
  const fetchSessionData = async (sess: SessionId) => {
    try {
      const [statsRes, billsRes, legRes, meetRes, prioRes] = await Promise.all([
        fetch(`/api/stats?session=${sess}`),
        fetch(`/api/bills?session=${sess}`),
        fetch('/api/legislators'),
        fetch('/api/meetings'),
        fetch('/api/priorities'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (billsRes.ok) {
        const billsData = await billsRes.json();
        setBills(billsData.bills || []);
      }
      if (legRes.ok) {
        const legData = await legRes.json();
        setLegislators(legData);
      }
      if (meetRes.ok) {
        const meetData = await meetRes.json();
        setMeetings(meetData);
      }
      if (prioRes.ok) {
        const prioData = await prioRes.json();
        setPriorities(prioData);
      }
    } catch (err) {
      console.warn('API fetch warning, using client fallback:', err);
      // Fallback already pre-seeded
      setBills(MOCK_BILLS.filter((b) => b.session === sess));
    }
  };

  useEffect(() => {
    fetchSessionData(session);
  }, [session]);

  const handleSelectBill = (bill: Bill) => {
    setSelectedBill(bill);
  };

  const handleSelectBillNumber = (billNumber: string) => {
    const cleanNum = billNumber.replace(/\s+/g, '').toLowerCase();
    const found = bills.find((b) => b.billNumber.replace(/\s+/g, '').toLowerCase() === cleanNum);
    if (found) {
      setSelectedBill(found);
    } else {
      // Switch to Bill Explorer with search pre-filled
      setGlobalSearch(billNumber);
      setActiveTab('bills');
    }
  };

  const handleOpenAiChat = (prompt?: string) => {
    setActiveTab('ai');
  };

  const handleSavePriorities = async (updatedPriorities: PolicyPriority[]) => {
    try {
      const response = await fetch('/api/priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPriorities),
      });

      if (response.ok) {
        const data = await response.json();
        setPriorities(data.priorities);
        // Refresh bills to reflect updated comport/conflict rankings
        await fetchSessionData(session);
      }
    } catch (err) {
      console.error('Failed to save priorities to server:', err);
      setPriorities(updatedPriorities);
    }
  };

  const handleResetDefaults = () => {
    handleSavePriorities(INITIAL_PRIORITIES);
  };

  // Filter bills if global search is active and on Bills tab
  const displayBills = globalSearch
    ? bills.filter(
        (b) =>
          b.billNumber.toLowerCase().includes(globalSearch.toLowerCase()) ||
          b.author.toLowerCase().includes(globalSearch.toLowerCase()) ||
          b.caption.toLowerCase().includes(globalSearch.toLowerCase()) ||
          b.primaryCategory.toLowerCase().includes(globalSearch.toLowerCase())
      )
    : bills;

  const urgentCount = bills.filter((b) => b.priorityScore >= 4).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        setSession={setSession}
        globalSearch={globalSearch}
        setGlobalSearch={(q) => {
          setGlobalSearch(q);
          if (q && activeTab !== 'bills') {
            setActiveTab('bills');
          }
        }}
        urgentCount={urgentCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <PriorityDashboard
            stats={stats}
            bills={displayBills}
            priorities={priorities}
            onSelectBill={handleSelectBill}
            onOpenPriorities={() => setActiveTab('priorities')}
            onOpenAiChat={handleOpenAiChat}
            onSelectSession={setSession}
            onRefreshData={() => fetchSessionData(session)}
          />
        )}

        {activeTab === 'bills' && (
          <BillExplorer
            bills={displayBills}
            onSelectBill={handleSelectBill}
            session={session}
          />
        )}

        {activeTab === 'legislators' && (
          <LegislatorDirectory
            legislators={legislators}
            bills={bills}
            onSelectBill={handleSelectBill}
            onOpenAiChat={handleOpenAiChat}
            activeSession={session}
          />
        )}

        {activeTab === 'committees' && (
          <CommitteeTracker
            meetings={meetings}
            bills={bills}
            onSelectBillNumber={handleSelectBillNumber}
            onOpenAiChat={handleOpenAiChat}
          />
        )}

        {activeTab === 'priorities' && (
          <PolicyPriorityManager
            priorities={priorities}
            onSavePriorities={handleSavePriorities}
            onResetDefaults={handleResetDefaults}
            onNavigateToFeed={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'ai' && (
          <AIResearchAssistant
            onSelectBillNumber={handleSelectBillNumber}
            session={session}
          />
        )}

        {activeTab === 'python' && (
          <PythonPipelineHub />
        )}
      </main>

      {/* Bill Deep Dive Modal */}
      {selectedBill && (
        <BillModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onOpenAiChat={handleOpenAiChat}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Texas Capitol Legislative Intelligence Platform</span>
            <span>•</span>
            <span>Session {session} Active</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>TLO Reports Ingested</span>
            <span>Ollama & Gemini Hybrid Grounding</span>
            <button
              onClick={() => setActiveTab('python')}
              className="text-amber-400 hover:text-amber-300 underline"
            >
              Export Local Python Pipeline
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
