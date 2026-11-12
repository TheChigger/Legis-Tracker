import React, { useState } from 'react';
import { CommitteeMeeting, Bill } from '../types/legislative';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  FileText, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Video
} from 'lucide-react';

interface CommitteeTrackerProps {
  meetings: CommitteeMeeting[];
  bills: Bill[];
  onSelectBillNumber: (billNumber: string) => void;
  onOpenAiChat: (prompt: string) => void;
}

export const CommitteeTracker: React.FC<CommitteeTrackerProps> = ({
  meetings,
  bills,
  onSelectBillNumber,
  onOpenAiChat,
}) => {
  const [filterChamber, setFilterChamber] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const filteredMeetings = meetings.filter((m) => {
    const matchesChamber = filterChamber === 'All' || m.chamber === filterChamber;
    const matchesStatus = filterStatus === 'All' || m.status === filterStatus;
    return matchesChamber && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Committee Tracker Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <span>Texas Legislative Committee Hearings & Meeting Minutes</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Official House and Senate committee calendars, room assignments, witness testimony registration, and adopted minutes.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={filterChamber}
            onChange={(e) => setFilterChamber(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/60"
          >
            <option value="All">All Chambers</option>
            <option value="House">House Committees</option>
            <option value="Senate">Senate Committees</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/60"
          >
            <option value="All">All Statuses</option>
            <option value="Scheduled">Upcoming / Scheduled</option>
            <option value="Adjourned">Adjourned / Minutes Ready</option>
          </select>
        </div>
      </div>

      {/* Meetings Grid */}
      <div className="space-y-4">
        {filteredMeetings.map((meeting) => {
          const isScheduled = meeting.status === 'Scheduled';
          const isAdjourned = meeting.status === 'Adjourned';

          return (
            <div
              key={meeting.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm"
            >
              {/* Meeting Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-base">
                      {meeting.committeeName}
                    </h3>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {meeting.chamber}
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
                <div className="flex items-center gap-2">
                  {meeting.witnessRegistrationOpen ? (
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800/40 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Witness Portal Open
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Witness Registration Closed
                    </span>
                  )}
                </div>
              </div>

              {/* Agenda Bills */}
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Agenda Bills Scheduled for Hearing ({meeting.agendaBills.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {meeting.agendaBills.map((bNum) => {
                    // Match bill if present in mock data
                    const matchingBill = bills.find((b) => b.billNumber.replace(' ', '') === bNum.replace(' ', ''));

                    return (
                      <button
                        key={bNum}
                        onClick={() => onSelectBillNumber(bNum)}
                        className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition group"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-bold">{bNum}</span>
                        {matchingBill && (
                          <span className={`text-[10px] ml-1 px-1.5 rounded ${
                            matchingBill.stance === 'OPPOSE' ? 'text-rose-400 bg-rose-950/40' : 'text-emerald-400 bg-emerald-950/40'
                          }`}>
                            {matchingBill.stance}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minutes Summary (if adjourned) */}
              {meeting.minutesSummary && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="uppercase tracking-wider text-slate-300">Official Committee Minutes Summary:</span>
                    {meeting.witnessCount && (
                      <span className="text-amber-400 font-semibold">{meeting.witnessCount} Registered Witnesses</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {meeting.minutesSummary}
                  </p>

                  {meeting.recordingUrl && (
                    <div className="pt-2">
                      <a
                        href={meeting.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 underline underline-offset-4"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Watch Official Capitol Broadcast Archive</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => onOpenAiChat(`Analyze the public hearing testimony and member dynamics of ${meeting.committeeName} regarding bills ${meeting.agendaBills.join(', ')}.`)}
                  className="px-3 py-1 text-xs text-slate-300 hover:text-amber-300 font-medium flex items-center gap-1 transition"
                >
                  <span>Ask AI Analyst to Review Hearing Transcripts</span>
                  <ExternalLink className="w-3 h-3 text-amber-400" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
