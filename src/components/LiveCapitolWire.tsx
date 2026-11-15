import React, { useMemo, useState } from 'react';
import { Bill, RssFeedItem, RssFeedType, SessionId, Stance } from '../types/legislative';
import { OFFICIAL_TLO_RSS_FEEDS } from '../data/mockData';
import {
  Rss,
  Radio,
  RefreshCw,
  FileText,
  ExternalLink,
  Search,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LiveCapitolWireProps {
  rssItems: RssFeedItem[];
  bills: Bill[];
  onSelectBillNumber: (billNumber: string, session?: SessionId) => void;
  onTriggerRssSync: () => Promise<{
    success?: boolean;
    cached?: boolean;
    message?: string;
    summary?: Record<string, unknown>;
  }>;
  onOpenAiChat: (prompt: string) => void;
}

const FEED_BADGE_STYLES: Record<RssFeedType, string> = {
  todaysfiledhouse: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
  todaysfiledsenate: 'bg-teal-950/60 text-teal-300 border-teal-800/50',
  todaysbilltext: 'bg-sky-950/60 text-sky-300 border-sky-800/50',
  todaysfiscalnotes: 'bg-amber-950/60 text-amber-300 border-amber-800/50',
  todaysbillanalyses: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50',
  todaysbillspassed: 'bg-green-950/60 text-green-300 border-green-700/50',
  upcomingcalendarshouse: 'bg-purple-950/60 text-purple-300 border-purple-800/50',
  upcomingcalendarssenate: 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/50',
  upcomingmeetingshouse: 'bg-orange-950/60 text-orange-300 border-orange-800/50',
  upcomingmeetingssenate: 'bg-rose-950/60 text-rose-300 border-rose-800/50',
};

function formatRelativeTime(timestampSec: number): string {
  if (!timestampSec) return '';
  const diffSec = Math.floor(Date.now() / 1000) - timestampSec;
  if (diffSec < 0) return 'Scheduled';
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days <= 14) return `${days}d ago`;
  const d = new Date(timestampSec * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const LiveCapitolWire: React.FC<LiveCapitolWireProps> = ({
  rssItems,
  bills,
  onSelectBillNumber,
  onTriggerRssSync,
  onOpenAiChat,
}) => {
  const [selectedFeedType, setSelectedFeedType] = useState<'ALL' | RssFeedType>('ALL');
  const [selectedChamber, setSelectedChamber] = useState<string>('All');
  const [selectedStance, setSelectedStance] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFeedDirectory, setShowFeedDirectory] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string>('');

  // Index active client bills (including visitor-local priority overrides) by session + number
  const clientBillsMap = useMemo(() => {
    const bySessionNum = new Map<string, Bill>();
    const byNum = new Map<string, Bill>();
    for (const b of bills) {
      const clean = b.billNumber.replace(/\s+/g, '').toUpperCase();
      bySessionNum.set(`${b.session}-${clean}`, b);
      if (!byNum.has(clean)) byNum.set(clean, b);
    }
    return { bySessionNum, byNum };
  }, [bills]);

  const enrichedItems = useMemo(() => {
    return [...rssItems]
      .sort((a, b) => b.pubTimestamp - a.pubTimestamp)
      .map((item) => {
        if (!item.billNumber) return item;
        const clean = item.billNumber.replace(/\s+/g, '').toUpperCase();
        const clientMatch =
          clientBillsMap.bySessionNum.get(`${item.session}-${clean}`) ||
          clientBillsMap.byNum.get(clean);
        if (!clientMatch) return item;
        const hasFullText = (clientMatch.versions || []).some(
          (v) => (v.fullText || '').length >= 300
        );
        return {
          ...item,
          matchedBill: {
            id: clientMatch.id,
            billNumber: clientMatch.billNumber,
            author: clientMatch.author,
            caption: clientMatch.caption,
            stance: clientMatch.stance,
            priorityScore: clientMatch.priorityScore,
            currentStatus: clientMatch.currentStatus,
            hasFullText,
          },
        };
      });
  }, [rssItems, clientBillsMap]);

  const countsByFeedType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of enrichedItems) {
      counts[item.feedType] = (counts[item.feedType] || 0) + 1;
    }
    return counts;
  }, [enrichedItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedItems.filter((item) => {
      if (selectedFeedType !== 'ALL' && item.feedType !== selectedFeedType) return false;
      if (selectedChamber !== 'All' && item.chamber !== selectedChamber) return false;
      if (selectedStance !== 'All' && item.matchedBill?.stance !== (selectedStance as Stance)) {
        return false;
      }
      if (q) {
        const matchesText =
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.feedLabel.toLowerCase().includes(q) ||
          (item.billNumber || '').toLowerCase().includes(q) ||
          (item.matchedBill?.author || '').toLowerCase().includes(q) ||
          (item.matchedBill?.caption || '').toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      return true;
    });
  }, [enrichedItems, selectedFeedType, selectedChamber, selectedStance, searchQuery]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncNotice('');
    try {
      const result = await onTriggerRssSync();
      if (result.message) {
        setSyncNotice(result.message);
      } else if (result.summary) {
        const s = result.summary;
        setSyncNotice(
          `Polled ${s.feedsSucceeded ?? 0}/${s.feedsPolled ?? 10} TLO feeds — ${s.itemsIngested ?? 0} RSS events, ${s.billsUpdated ?? 0} bills persisted, ${s.meetingsUpdated ?? 0} schedule updates.`
        );
      } else {
        setSyncNotice('Live TLO RSS feeds synchronized.');
      }
    } catch (err) {
      setSyncNotice('RSS poll request could not reach server.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              <span>Live Capitol Wire — TLO Chronological RSS Monitor</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              By-the-minute chronological monitor polling all 10 Texas Legislature Online RSS feeds every 3 minutes. New bill filings and full bill text are saved permanently to SQLite and cross-linked to your policy stances.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowFeedDirectory((v) => !v)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Rss className="w-3.5 h-3.5 text-amber-400" />
              <span>Official TLO Feeds (10)</span>
              {showFeedDirectory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Polling TLO RSS...' : 'Sync All 10 RSS Feeds'}</span>
            </button>
          </div>
        </div>

        {syncNotice && (
          <div className="text-xs font-mono px-3 py-2 rounded-lg bg-slate-950 border border-emerald-800/50 text-emerald-300">
            {syncNotice}
          </div>
        )}

        {/* Expandable Directory of all 10 TLO RSS URLs */}
        {showFeedDirectory && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
            {OFFICIAL_TLO_RSS_FEEDS.map((feed) => (
              <div
                key={feed.feedType}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${FEED_BADGE_STYLES[feed.feedType]}`}>
                      {feed.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">{feed.chamber}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{feed.description}</p>
                </div>
                <a
                  href={feed.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0"
                  title={feed.url}
                >
                  <span>XML</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Feed Type Pills */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setSelectedFeedType('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono transition border ${
              selectedFeedType === 'ALL'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            All Feeds ({enrichedItems.length})
          </button>
          {OFFICIAL_TLO_RSS_FEEDS.map((feed) => {
            const count = countsByFeedType[feed.feedType] || 0;
            const active = selectedFeedType === feed.feedType;
            return (
              <button
                key={feed.feedType}
                onClick={() => setSelectedFeedType(feed.feedType)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition border ${
                  active
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {feed.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Attribute Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter feed events by bill number, author, caption, committee..."
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <select
            value={selectedChamber}
            onChange={(e) => setSelectedChamber(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/60"
          >
            <option value="All">All Chambers</option>
            <option value="House">House</option>
            <option value="Senate">Senate</option>
          </select>

          <select
            value={selectedStance}
            onChange={(e) => setSelectedStance(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/60"
          >
            <option value="All">All Stances</option>
            <option value="SUPPORT">SUPPORT</option>
            <option value="OPPOSE">OPPOSE</option>
            <option value="NEUTRAL">NEUTRAL</option>
          </select>
        </div>
      </div>

      {/* Chronological Timeline Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span>Showing {filteredItems.length} chronological wire events</span>
          <span>Bill text & filings persist across daily TLO RSS resets</span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 font-mono">
            No RSS wire items match the active filters.
          </div>
        ) : (
          filteredItems.map((item) => {
            const matched = item.matchedBill;
            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition space-y-2.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded border font-semibold ${FEED_BADGE_STYLES[item.feedType]}`}
                    >
                      {item.feedLabel}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      {item.chamber} • {item.session}
                    </span>
                    {item.billNumber && (
                      <button
                        onClick={() => onSelectBillNumber(item.billNumber!, item.session)}
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition"
                      >
                        {item.billNumber}
                      </button>
                    )}
                    {matched && (
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                          matched.stance === 'OPPOSE'
                            ? 'text-rose-300 bg-rose-950/60 border-rose-800/50'
                            : matched.stance === 'SUPPORT'
                              ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800/50'
                              : 'text-slate-300 bg-slate-800 border-slate-700'
                        }`}
                      >
                        {matched.stance} • P{matched.priorityScore}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatRelativeTime(item.pubTimestamp)}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">{item.pubDate}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                  {item.description && item.description !== item.title && (
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                  {matched && (
                    <div className="text-[11px] font-mono text-slate-400 mt-1.5">
                      Author: <span className="text-slate-200">{matched.author}</span> • Status:{' '}
                      <span className="text-slate-200">{matched.currentStatus}</span>
                      {matched.hasFullText ? ' • Full Bill Text Persisted' : ''}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.billNumber && (
                      <button
                        onClick={() => onSelectBillNumber(item.billNumber!, item.session)}
                        className="px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open Persistent Bill Text</span>
                      </button>
                    )}

                    {item.billNumber && (
                      <button
                        onClick={() =>
                          onOpenAiChat(
                            `Analyze ${item.session} ${item.billNumber} (${item.title}) from the ${item.feedLabel} RSS feed against my 7 policy pillars.`
                          )
                        }
                        className="px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Analyze Event</span>
                      </button>
                    )}
                  </div>

                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <span>Official TLO Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
