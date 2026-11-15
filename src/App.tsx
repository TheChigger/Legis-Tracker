import React, { useState, useEffect, useMemo } from 'react';
import { Header, NavTab } from './components/Header';
import { PriorityDashboard } from './components/PriorityDashboard';
import { BillExplorer } from './components/BillExplorer';
import { BillModal } from './components/BillModal';
import { LegislatorDirectory } from './components/LegislatorDirectory';
import { CommitteeTracker } from './components/CommitteeTracker';
import { LiveCapitolWire } from './components/LiveCapitolWire';
import { PolicyPriorityManager } from './components/PolicyPriorityManager';
import { AIResearchAssistant } from './components/AIResearchAssistant';
import { PythonPipelineHub } from './components/PythonPipelineHub';
import { 
  Bill, 
  Legislator, 
  CommitteeMeeting, 
  RssFeedItem,
  PolicyPriority, 
  DashboardStats, 
  SessionId 
} from './types/legislative';
import { 
  MOCK_BILLS, 
  MOCK_LEGISLATORS, 
  MOCK_COMMITTEE_MEETINGS, 
  MOCK_RSS_ITEMS,
  MOCK_STATS_90R, 
  INITIAL_PRIORITIES 
} from './data/mockData';
import { reevaluateBillClient } from './utils/evaluateBillClient';
import { buildCompleteLegislatorsList } from './data/texasLawmakerRoster';

const PRIORITIES_STORAGE_KEY = 'tx_legis_custom_priorities_v2';

function loadSavedCustomPriorities(): PolicyPriority[] | null {
  try {
    const raw = localStorage.getItem(PRIORITIES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as PolicyPriority[]) : null;
  } catch {
    return null;
  }
}

function computeClientStats(
  sessionBills: Bill[],
  session: SessionId,
  fallbackStats: DashboardStats
): DashboardStats {
  if (sessionBills.length === 0) return fallbackStats;

  let support = 0;
  let oppose = 0;
  let neutral = 0;
  let urgent = 0;
  const authors = new Set<string>();
  const categoryCounts: Record<string, number> = {};

  for (const b of sessionBills) {
    if (b.stance === 'SUPPORT') support++;
    else if (b.stance === 'OPPOSE') oppose++;
    else neutral++;

    if (b.priorityScore >= 4) urgent++;
    if (b.author) authors.add(b.author);

    const cat = b.primaryCategory || 'General State Affairs';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, count }));

  return {
    session,
    totalTrackedBills: sessionBills.length,
    totalVersions: sessionBills.reduce((acc, b) => acc + (b.versions?.length || 1), 0),
    uniqueAuthors: authors.size || fallbackStats.uniqueAuthors,
    urgentBillsToday: urgent,
    stanceBreakdown: { support, oppose, neutral },
    topCategories,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [session, setSession] = useState<SessionId>('90R');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  
  // Server Snapshot + Visitor-Isolated Priorities State
  const [rawServerBills, setRawServerBills] = useState<Bill[]>(MOCK_BILLS.filter((b) => b.session === '90R'));
  const [serverStats, setServerStats] = useState<DashboardStats>(MOCK_STATS_90R);
  const [rawLegislators, setRawLegislators] = useState<Legislator[]>(() =>
    buildCompleteLegislatorsList(MOCK_BILLS, MOCK_LEGISLATORS)
  );
  const [meetings, setMeetings] = useState<CommitteeMeeting[]>(MOCK_COMMITTEE_MEETINGS);
  const [isFallback89RMeetings, setIsFallback89RMeetings] = useState<boolean>(false);
  const [rssItems, setRssItems] = useState<RssFeedItem[]>(MOCK_RSS_ITEMS);
  const [serverPriorities, setServerPriorities] = useState<PolicyPriority[]>(INITIAL_PRIORITIES);
  const [customPriorities, setCustomPriorities] = useState<PolicyPriority[] | null>(() => loadSavedCustomPriorities());

  const priorities = customPriorities ?? serverPriorities;

  const bills = useMemo(
    () =>
      customPriorities
        ? rawServerBills.map((b) => reevaluateBillClient(b, customPriorities, true))
        : rawServerBills,
    [rawServerBills, customPriorities]
  );

  const legislators = useMemo(
    () =>
      customPriorities
        ? buildCompleteLegislatorsList(bills, rawLegislators)
        : rawLegislators,
    [customPriorities, bills, rawLegislators]
  );

  const stats = useMemo(
    () =>
      customPriorities && rawServerBills.length > 0
        ? computeClientStats(bills, session, serverStats)
        : serverStats,
    [bills, customPriorities, rawServerBills.length, session, serverStats]
  );
  
  // Modal & Selection State
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Fetch data from server when session changes
  const fetchSessionData = async (sess: SessionId) => {
    try {
      const [statsRes, billsRes, legRes, meetRes, prioRes, rssRes] = await Promise.all([
        fetch(`/api/stats?session=${sess}`),
        fetch(`/api/bills?session=${sess}`),
        fetch('/api/legislators'),
        fetch(`/api/meetings?session=${sess}`),
        fetch('/api/priorities'),
        fetch('/api/rss?limit=250'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setServerStats(statsData);
      }
      if (billsRes.ok) {
        const billsData = await billsRes.json();
        setRawServerBills(billsData.bills || []);
      }
      if (legRes.ok) {
        const legData = await legRes.json();
        if (Array.isArray(legData) && legData.length > 0) {
          setRawLegislators(legData);
        }
      }
      if (meetRes.ok) {
        const meetData = await meetRes.json();
        if (Array.isArray(meetData)) {
          setMeetings(meetData);
          setIsFallback89RMeetings(sess === '90R' && meetData.every((m) => m.session === '89R'));
        } else if (Array.isArray(meetData?.meetings)) {
          setMeetings(meetData.meetings);
          setIsFallback89RMeetings(Boolean(meetData.isFallback89R));
        }
      }
      if (prioRes.ok) {
        const prioData = await prioRes.json();
        setServerPriorities(prioData);
      }
      if (rssRes.ok) {
        const rssData = await rssRes.json();
        if (Array.isArray(rssData?.items) && rssData.items.length > 0) {
          setRssItems(rssData.items);
        }
      }
    } catch (err) {
      console.warn('API fetch warning, using client fallback:', err);
      // Fallback already pre-seeded
      setRawServerBills(MOCK_BILLS.filter((b) => b.session === sess));
    }
  };

  useEffect(() => {
    fetchSessionData(session);
  }, [session]);

  // Periodically refresh live wire & schedules while viewing those tabs
  useEffect(() => {
    if (activeTab !== 'wire' && activeTab !== 'committees') return;
    const timer = window.setInterval(() => {
      void fetchSessionData(session);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [activeTab, session]);

  const handleSelectBill = (bill: Bill) => {
    setSelectedBill(bill);
  };

  const handleSelectBillNumber = async (billNumber: string, billSession?: SessionId) => {
    const cleanNum = billNumber.replace(/\s+/g, '').toUpperCase();
    const targetSession = billSession || session;
    if (targetSession === session) {
      const found = bills.find(
        (b) => b.billNumber.replace(/\s+/g, '').toUpperCase() === cleanNum
      );
      if (found) {
        setSelectedBill(found);
        return;
      }
    }
    try {
      const res = await fetch(`/api/bills/${targetSession}-${cleanNum}`);
      if (res.ok) {
        const remoteBill = (await res.json()) as Bill;
        setSelectedBill(
          customPriorities ? reevaluateBillClient(remoteBill, customPriorities, true) : remoteBill
        );
        return;
      }
    } catch {
      // Fall back to Bill Explorer search
    }
    setGlobalSearch(billNumber);
    setActiveTab('bills');
  };

  const handleTriggerRssSync = async () => {
    const response = await fetch('/api/rss/sync', { method: 'POST' });
    const data = await response.json();
    await fetchSessionData(session);
    return data;
  };

  const handleSaveMeetingNotes = async (meetingId: string, userNotes: string) => {
    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNotes }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.meeting) {
          setMeetings((prev) =>
            prev.map((m) => (m.id === meetingId ? data.meeting : m))
          );
          return;
        }
      }
    } catch (err) {
      console.warn('Could not persist meeting notes to server, applying local state:', err);
    }
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === meetingId
          ? { ...m, userNotes, notesUpdatedAt: new Date().toISOString() }
          : m
      )
    );
  };

  const handleOpenAiChat = (prompt?: string) => {
    setActiveTab('ai');
  };

  const handleSavePriorities = async (updatedPriorities: PolicyPriority[]) => {
    try {
      localStorage.setItem(PRIORITIES_STORAGE_KEY, JSON.stringify(updatedPriorities));
    } catch {
      // Ignore storage quota / private-browsing errors
    }
    setCustomPriorities(updatedPriorities);

    try {
      const response = await fetch('/api/priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPriorities),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.scope === 'global') {
          try {
            localStorage.removeItem(PRIORITIES_STORAGE_KEY);
          } catch {
            // Ignore storage errors
          }
          setCustomPriorities(null);
          setServerPriorities(data.priorities);
          await fetchSessionData(session);
        }
      }
    } catch (err) {
      console.warn('Priorities saved in local browser session only:', err);
    }
  };

  const handleResetDefaults = () => {
    try {
      localStorage.removeItem(PRIORITIES_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setCustomPriorities(null);
    setServerPriorities(INITIAL_PRIORITIES);
    void fetchSessionData(session);
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

        {activeTab === 'wire' && (
          <LiveCapitolWire
            rssItems={rssItems}
            bills={bills}
            onSelectBillNumber={handleSelectBillNumber}
            onTriggerRssSync={handleTriggerRssSync}
            onOpenAiChat={handleOpenAiChat}
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
            isFallback89R={isFallback89RMeetings}
            activeSession={session}
            onSelectBillNumber={handleSelectBillNumber}
            onOpenAiChat={handleOpenAiChat}
            onSaveMeetingNotes={handleSaveMeetingNotes}
            onTriggerRssSync={handleTriggerRssSync}
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
