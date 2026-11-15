import React, { useEffect, useMemo, useState } from 'react';
import { CommitteeMeeting, Bill, SessionId } from '../types/legislative';
import { OFFICIAL_TLO_RSS_FEEDS } from '../data/mockData';
import {
  Calendar,
  CalendarDays,
  List,
  MapPin,
  FileText,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Video,
  Rss,
  StickyNote,
  Save,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from 'lucide-react';

interface CommitteeTrackerProps {
  meetings: CommitteeMeeting[];
  bills: Bill[];
  isFallback89R?: boolean;
  activeSession?: SessionId;
  onSelectBillNumber: (billNumber: string, billSession?: SessionId) => void;
  onOpenAiChat: (prompt: string) => void;
  onSaveMeetingNotes: (meetingId: string, userNotes: string) => Promise<void>;
  onTriggerRssSync?: () => Promise<unknown>;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseIsoYearMonth(dateStr: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return null;
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) - 1 };
}

function formatMonthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export const CommitteeTracker: React.FC<CommitteeTrackerProps> = ({
  meetings,
  bills,
  isFallback89R = false,
  activeSession = '90R',
  onSelectBillNumber,
  onOpenAiChat,
  onSaveMeetingNotes,
  onTriggerRssSync,
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterChamber, setFilterChamber] = useState<string>('All');
  const [filterEventType, setFilterEventType] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isCheckingFeeds, setIsCheckingFeeds] = useState<boolean>(false);

  // Inline note editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const scheduleRssFeeds = useMemo(
    () => OFFICIAL_TLO_RSS_FEEDS.filter((f) => f.category === 'meetings' || f.category === 'calendars'),
    []
  );

  const filteredMeetings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...meetings]
      .filter((m) => {
        if (filterChamber !== 'All' && m.chamber !== filterChamber) return false;
        const evType = m.eventType || 'Committee Hearing';
        if (filterEventType !== 'All' && evType !== filterEventType) return false;
        if (filterStatus !== 'All' && m.status !== filterStatus) return false;
        if (q) {
          const matches =
            m.committeeName.toLowerCase().includes(q) ||
            (m.minutesSummary || '').toLowerCase().includes(q) ||
            (m.userNotes || '').toLowerCase().includes(q) ||
            m.location.toLowerCase().includes(q) ||
            m.agendaBills.some((b) => b.toLowerCase().includes(q));
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  }, [meetings, filterChamber, filterEventType, filterStatus, searchQuery]);

  // Available months sorted chronologically for quick switching
  const availableMonths = useMemo(() => {
    const map = new Map<string, { year: number; month: number }>();
    for (const m of filteredMeetings) {
      const parsed = parseIsoYearMonth(m.meetingDate);
      if (!parsed) continue;
      const key = `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, parsed);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredMeetings]);

  const [calendarYear, setCalendarYear] = useState<number>(() => {
    const first = parseIsoYearMonth(meetings[0]?.meetingDate || '2025-03-11');
    return first?.year ?? 2025;
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    const first = parseIsoYearMonth(meetings[0]?.meetingDate || '2025-03-11');
    return first?.month ?? 2;
  });

  // Sync default month when meeting dataset switches between 89R and 90R
  useEffect(() => {
    if (filteredMeetings.length === 0) return;
    const currentKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const hasCurrent = availableMonths.some(([key]) => key === currentKey);
    if (!hasCurrent && availableMonths.length > 0) {
      const [, first] = availableMonths[0];
      setCalendarYear(first.year);
      setCalendarMonth(first.month);
    }
  }, [availableMonths, calendarYear, calendarMonth, filteredMeetings.length]);

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, CommitteeMeeting[]>();
    for (const m of filteredMeetings) {
      const arr = map.get(m.meetingDate) || [];
      arr.push(m);
      map.set(m.meetingDate, arr);
    }
    return map;
  }, [filteredMeetings]);

  const calendarDays = useMemo(() => {
    const firstDayWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; isoDate: string | null }> = [];
    for (let i = 0; i < firstDayWeekday; i++) {
      cells.push({ day: null, isoDate: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, isoDate: iso });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, isoDate: null });
    }
    return cells;
  }, [calendarYear, calendarMonth]);

  const visibleMeetings = useMemo(() => {
    if (selectedDate) {
      return filteredMeetings.filter((m) => m.meetingDate === selectedDate);
    }
    if (viewMode === 'calendar') {
      const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-`;
      const inMonth = filteredMeetings.filter((m) => m.meetingDate.startsWith(monthPrefix));
      return inMonth.length > 0 ? inMonth : filteredMeetings;
    }
    return filteredMeetings;
  }, [filteredMeetings, selectedDate, viewMode, calendarYear, calendarMonth]);

  const stepMonth = (delta: number) => {
    setSelectedDate(null);
    const next = new Date(calendarYear, calendarMonth + delta, 1);
    setCalendarYear(next.getFullYear());
    setCalendarMonth(next.getMonth());
  };

  const handleCheckScheduleFeeds = async () => {
    if (!onTriggerRssSync) return;
    setIsCheckingFeeds(true);
    try {
      await onTriggerRssSync();
    } finally {
      setIsCheckingFeeds(false);
    }
  };

  const startEditingNote = (meeting: CommitteeMeeting) => {
    setEditingNoteId(meeting.id);
    setNoteDraft(meeting.userNotes || '');
  };

  const handleSaveNote = async (meetingId: string) => {
    setSavingNoteId(meetingId);
    try {
      await onSaveMeetingNotes(meetingId, noteDraft);
      setEditingNoteId(null);
    } finally {
      setSavingNoteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fallback Readiness Banner when 90R has no meetings scheduled yet */}
      {isFallback89R && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>90th Session Awaiting Committee Convening — Showing 89R Reference Data</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              No 90R committee hearings or floor calendars have been posted to TLO RSS feeds yet (pre-filing period). Displaying verified <strong>89th Legislature (89R)</strong> committee hearings, floor calendars, broadcast links, and minutes so the calendar and notes workflow are ready as 90R schedules arrive.
            </p>
          </div>
          {onTriggerRssSync && (
            <button
              onClick={handleCheckScheduleFeeds}
              disabled={isCheckingFeeds}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-mono text-amber-200 flex items-center gap-1.5 shrink-0 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingFeeds ? 'animate-spin' : ''}`} />
              <span>{isCheckingFeeds ? 'Checking 90R RSS...' : 'Check 90R Schedules Now'}</span>
            </button>
          )}
        </div>
      )}

      {/* Header & Schedule RSS Links */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>Capitol Hearing Calendar, Floor Schedules & Meeting Notes</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Interactive calendar of House and Senate committee hearings and daily floor calendars, with direct links to live video feeds, official notices, committee minutes, and persistent notes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
                viewMode === 'calendar'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Calendar Grid</span>
            </button>
            <button
              onClick={() => {
                setViewMode('list');
                setSelectedDate(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
                viewMode === 'list'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Full Schedule List ({filteredMeetings.length})</span>
            </button>
          </div>
        </div>

        {/* Clickable Official Schedule RSS & Video Links */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
          <span className="text-slate-400 flex items-center gap-1 mr-1">
            <Rss className="w-3.5 h-3.5 text-amber-400" />
            Live TLO Schedule Feeds:
          </span>
          {scheduleRssFeeds.map((feed) => (
            <a
              key={feed.feedType}
              href={feed.url}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 flex items-center gap-1 transition"
            >
              <span>{feed.label}</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          ))}
          <a
            href="https://house.texas.gov/video-audio/"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-800/40 flex items-center gap-1 transition"
          >
            <Video className="w-3 h-3" />
            <span>House Video Feed</span>
          </a>
          <a
            href="https://senate.texas.gov/"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-sky-300 border border-sky-800/40 flex items-center gap-1 transition"
          >
            <Video className="w-3 h-3" />
            <span>Senate A/V Portal</span>
          </a>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search committees, agenda bills, minutes, or notes..."
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <select
            value={filterChamber}
            onChange={(e) => setFilterChamber(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/60"
          >
            <option value="All">All Chambers</option>
            <option value="House">House</option>
            <option value="Senate">Senate</option>
          </select>

          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/60"
          >
            <option value="All">Hearings & Floor Calendars</option>
            <option value="Committee Hearing">Committee Hearings</option>
            <option value="Floor Calendar">Floor Calendars</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/60"
          >
            <option value="All">All Statuses</option>
            <option value="Scheduled">Upcoming / Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Adjourned">Adjourned / Minutes Ready</option>
          </select>
        </div>
      </div>

      {/* Interactive Monthly Calendar Grid */}
      {viewMode === 'calendar' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => stepMonth(-1)}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-slate-100 min-w-[160px] text-center">
                {formatMonthLabel(calendarYear, calendarMonth)}
              </h3>
              <button
                onClick={() => stepMonth(1)}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {availableMonths.map(([key, info]) => {
                const isCurrent = info.year === calendarYear && info.month === calendarMonth;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedDate(null);
                      setCalendarYear(info.year);
                      setCalendarMonth(info.month);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition ${
                      isCurrent
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {new Date(info.year, info.month, 1).toLocaleDateString('en-US', {
                      month: 'short',
                      year: '2-digit',
                    })}
                  </button>
                );
              })}
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25 transition"
                >
                  Clear Date ({selectedDate})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-center text-[11px] font-mono uppercase text-slate-500 py-1"
              >
                {wd}
              </div>
            ))}

            {calendarDays.map((cell, idx) => {
              if (!cell.day || !cell.isoDate) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[82px] rounded-lg bg-slate-950/30 border border-slate-900"
                  />
                );
              }
              const dayEvents = meetingsByDate.get(cell.isoDate) || [];
              const isSelected = selectedDate === cell.isoDate;

              return (
                <div
                  key={cell.isoDate}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDate(isSelected ? null : cell.isoDate);
                    }
                  }}
                  className={`min-h-[82px] p-1.5 rounded-lg border transition flex flex-col gap-1 ${
                    dayEvents.length > 0 ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/40'
                      : dayEvents.length > 0
                        ? 'bg-slate-950/80 border-slate-700 hover:border-amber-500/50'
                        : 'bg-slate-950/40 border-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono ${
                        isSelected
                          ? 'text-amber-300 font-bold'
                          : dayEvents.length > 0
                            ? 'text-slate-200 font-semibold'
                            : 'text-slate-500'
                      }`}
                    >
                      {cell.day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-mono text-amber-400">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => {
                      const isFloor = ev.eventType === 'Floor Calendar';
                      return (
                        <div
                          key={ev.id}
                          className={`text-[10px] leading-tight px-1.5 py-0.5 rounded truncate border ${
                            isFloor
                              ? 'bg-purple-950/70 text-purple-200 border-purple-700/60'
                              : ev.chamber === 'Senate'
                                ? 'bg-sky-950/70 text-sky-200 border-sky-700/60'
                                : 'bg-emerald-950/70 text-emerald-200 border-emerald-700/60'
                          }`}
                          title={`${ev.committeeName} (${ev.meetingTime})`}
                        >
                          {ev.committeeName}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] font-mono text-slate-400 px-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meetings & Floor Calendars Detail Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span>
            {selectedDate
              ? `Events on ${selectedDate} (${visibleMeetings.length})`
              : viewMode === 'calendar'
                ? `Events in ${formatMonthLabel(calendarYear, calendarMonth)} (${visibleMeetings.length})`
                : `All Tracked Hearings & Floor Calendars (${visibleMeetings.length})`}
          </span>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-4"
            >
              Show entire month
            </button>
          )}
        </div>

        {visibleMeetings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 font-mono">
            No committee hearings or floor calendars match your active filters.
          </div>
        ) : (
          visibleMeetings.map((meeting) => {
            const isScheduled = meeting.status === 'Scheduled';
            const isFloorCalendar = meeting.eventType === 'Floor Calendar';
            const isEditing = editingNoteId === meeting.id;
            const targetBillSession = meeting.session || (isFallback89R ? '89R' : activeSession);

            return (
              <div
                key={meeting.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm"
              >
                {/* Meeting Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-100 text-base">
                        {meeting.committeeName}
                      </h3>
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded border font-semibold ${
                          isFloorCalendar
                            ? 'bg-purple-950/60 text-purple-300 border-purple-700/50'
                            : 'bg-sky-950/60 text-sky-300 border-sky-700/50'
                        }`}
                      >
                        {meeting.eventType || 'Committee Hearing'}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {meeting.chamber} • {targetBillSession}
                      </span>
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold ${
                          isScheduled
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {meeting.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-400 font-mono mt-1.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {meeting.meetingDate} at {meeting.meetingTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {meeting.location}
                      </span>
                    </div>
                  </div>

                  {/* Witness Registration badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    {meeting.witnessRegistrationOpen ? (
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800/40 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Witness Portal Open
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {isFloorCalendar ? 'Floor Calendar' : 'Witness Registration Closed'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Clickable Links to Meeting Notice, Video Feed, and Schedule RSS */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                  {meeting.noticeUrl && (
                    <a
                      href={meeting.noticeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 hover:border-amber-500/40 flex items-center gap-1.5 transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isFloorCalendar ? 'Official Calendar Feed' : 'Official Notice & Agenda'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {meeting.recordingUrl && (
                    <a
                      href={meeting.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-800/40 flex items-center gap-1.5 transition"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{isScheduled ? 'Live Broadcast Stream' : 'Capitol Video Archive'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {meeting.rssFeedUrl && (
                    <a
                      href={meeting.rssFeedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 flex items-center gap-1.5 transition"
                    >
                      <Rss className="w-3.5 h-3.5 text-amber-400" />
                      <span>RSS Feed</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Agenda Bills */}
                {meeting.agendaBills.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Agenda Bills ({meeting.agendaBills.length}):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {meeting.agendaBills.map((bNum) => {
                        const cleanNum = bNum.replace(/\s+/g, '').toUpperCase();
                        const matchingBill =
                          bills.find(
                            (b) =>
                              b.session === targetBillSession &&
                              b.billNumber.replace(/\s+/g, '').toUpperCase() === cleanNum
                          ) ||
                          bills.find(
                            (b) => b.billNumber.replace(/\s+/g, '').toUpperCase() === cleanNum
                          );

                        return (
                          <button
                            key={bNum}
                            onClick={() => onSelectBillNumber(bNum, targetBillSession)}
                            className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition group"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span className="font-bold">{bNum}</span>
                            {matchingBill && (
                              <span
                                className={`text-[10px] ml-1 px-1.5 rounded ${
                                  matchingBill.stance === 'OPPOSE'
                                    ? 'text-rose-400 bg-rose-950/40'
                                    : matchingBill.stance === 'SUPPORT'
                                      ? 'text-emerald-400 bg-emerald-950/40'
                                      : 'text-slate-400 bg-slate-800'
                                }`}
                              >
                                {matchingBill.stance}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Official Minutes Summary */}
                {meeting.minutesSummary && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span className="uppercase tracking-wider text-slate-300">
                        Official Committee Minutes / Schedule Summary:
                      </span>
                      {typeof meeting.witnessCount === 'number' && meeting.witnessCount > 0 && (
                        <span className="text-amber-400 font-semibold">
                          {meeting.witnessCount} Registered Witnesses
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {meeting.minutesSummary}
                    </p>
                  </div>
                )}

                {/* Persistent Operator Meeting Notes */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                      <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                      <span className="uppercase tracking-wider">Meeting Notes</span>
                      {meeting.notesUpdatedAt && (
                        <span className="text-[10px] text-slate-500">
                          • Saved {meeting.notesUpdatedAt.slice(0, 16).replace('T', ' ')} UTC
                        </span>
                      )}
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => startEditingNote(meeting)}
                        className="text-xs font-mono text-amber-400 hover:text-amber-300 underline underline-offset-4"
                      >
                        {meeting.userNotes ? 'Edit Notes' : '+ Add Meeting Notes'}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={3}
                        placeholder="Record witness highlights, amendment votes, chair remarks, or follow-up items as they happen..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveNote(meeting.id)}
                          disabled={savingNoteId === meeting.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingNoteId === meeting.id ? 'Saving...' : 'Save Notes to SQLite'}</span>
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-400 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : meeting.userNotes ? (
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {meeting.userNotes}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      No notes recorded yet. Click "+ Add Meeting Notes" to log testimony or action notes as they come in.
                    </p>
                  )}
                </div>

                {/* Action Button */}
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() =>
                      onOpenAiChat(
                        `Analyze the hearing agenda, testimony context, and statutory impacts of ${meeting.committeeName} (${targetBillSession} ${meeting.meetingDate}) regarding ${meeting.agendaBills.join(', ')}.`
                      )
                    }
                    className="px-3 py-1 text-xs text-slate-300 hover:text-amber-300 font-medium flex items-center gap-1 transition"
                  >
                    <span>Ask AI Analyst to Review Hearing & Agenda Bills</span>
                    <ExternalLink className="w-3 h-3 text-amber-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
