import React, { useState } from 'react';
import { Legislator, Bill, SessionId, HistoricalVote } from '../types/legislative';
import { 
  Users, 
  Search, 
  MapPin, 
  FileText, 
  Sparkles, 
  ChevronRight,
  Vote,
  History,
  CheckCircle2,
  XCircle,
  Filter,
  BarChart3,
  Calendar,
  Award
} from 'lucide-react';

interface LegislatorDirectoryProps {
  legislators: Legislator[];
  bills: Bill[];
  onSelectBill: (bill: Bill) => void;
  onOpenAiChat: (prompt: string) => void;
  activeSession?: SessionId;
}

export const LegislatorDirectory: React.FC<LegislatorDirectoryProps> = ({
  legislators,
  bills,
  onSelectBill,
  onOpenAiChat,
  activeSession = '90R',
}) => {
  const [search, setSearch] = useState('');
  const [selectedChamber, setSelectedChamber] = useState<string>('All');
  const [selectedLawmakerId, setSelectedLawmakerId] = useState<string>(legislators[0]?.id || '');
  const [activeProfileTab, setActiveProfileTab] = useState<'votes' | 'career' | 'bills'>('votes');
  
  // Voting record filters
  const [voteSessionFilter, setVoteSessionFilter] = useState<string>('ALL');
  const [voteCastFilter, setVoteCastFilter] = useState<string>('ALL');
  const [voteAlignmentFilter, setVoteAlignmentFilter] = useState<string>('ALL');

  const filteredLawmakers = legislators.filter((leg) => {
    const matchesSearch =
      leg.name.toLowerCase().includes(search.toLowerCase()) ||
      leg.district.toLowerCase().includes(search.toLowerCase()) ||
      leg.hometown.toLowerCase().includes(search.toLowerCase()) ||
      leg.keyTopics.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesChamber = selectedChamber === 'All' || leg.chamber === selectedChamber;

    return matchesSearch && matchesChamber;
  });

  const selectedLawmaker = legislators.find((l) => l.id === selectedLawmakerId) || legislators[0];

  // Find bills filed by this lawmaker in current dataset
  const authoredBills = bills.filter((b) => {
    const authorLastName = selectedLawmaker.name.split(',')[0].toLowerCase().trim();
    return b.author.toLowerCase().includes(authorLastName);
  });

  // Identify first bill filed chronologically or by lowest bill number
  const sortedAuthored = [...authoredBills].sort((a, b) =>
    a.filedDateTimestamp - b.filedDateTimestamp ||
    a.billNumber.localeCompare(b.billNumber, undefined, { numeric: true })
  );
  const firstBill = sortedAuthored[0];

  // Filter voting records
  const allVotes = selectedLawmaker?.votingRecord || [];
  const filteredVotes = allVotes.filter((v) => {
    const matchesSession = voteSessionFilter === 'ALL' || v.session === voteSessionFilter;
    const matchesCast = voteCastFilter === 'ALL' || v.voteCast === voteCastFilter;
    const matchesAlignment = voteAlignmentFilter === 'ALL' || v.alignmentWithUser === voteAlignmentFilter;
    return matchesSession && matchesCast && matchesAlignment;
  });

  // Calculate vote alignment summary
  const alignedVotesCount = allVotes.filter((v) => v.alignmentWithUser === 'ALIGNED').length;
  const contraryVotesCount = allVotes.filter((v) => v.alignmentWithUser === 'CONTRARY').length;

  return (
    <div className="space-y-6">
      
      {/* Directory Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <span>Texas Lawmaker Profiles & Roll-Call Voting Ledgers (85R–90R)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Examine voting records on landmark floor votes (RV# roll calls), filed legislation, and historical alignment with your policy objectives across the 85th through 90th legislatures.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, district, topic..."
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <select
            value={selectedChamber}
            onChange={(e) => setSelectedChamber(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/60"
          >
            <option value="All">All Chambers</option>
            <option value="House">House</option>
            <option value="Senate">Senate</option>
          </select>
        </div>
      </div>

      {/* Main 2-Column Layout: Lawmaker List + Detailed Profile Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Lawmaker Selector Cards */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
            <span>Legislators ({filteredLawmakers.length})</span>
            <span className="text-[11px] text-slate-500">85th–90th Sessions</span>
          </div>

          <div className="space-y-2.5 max-h-[780px] overflow-y-auto pr-1">
            {filteredLawmakers.map((leg) => {
              const isSelected = leg.id === selectedLawmaker.id;
              const isHighAlign = leg.alignmentScore >= 70;
              const isLowAlign = leg.alignmentScore <= 30;

              return (
                <div
                  key={leg.id}
                  onClick={() => setSelectedLawmakerId(leg.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                      : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{leg.name}</span>
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            leg.party === 'R'
                              ? 'bg-red-950/60 text-red-300 border border-red-800/40'
                              : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                          }`}
                        >
                          {leg.party}-{leg.chamber.slice(0, 1)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{leg.district}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-mono text-slate-400 uppercase">Alignment</div>
                      <span
                        className={`font-mono font-bold text-xs ${
                          isHighAlign
                            ? 'text-emerald-400'
                            : isLowAlign
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {leg.alignmentScore}%
                      </span>
                    </div>
                  </div>

                  {/* Sessions Served Tags */}
                  <div className="mt-2.5 flex items-center gap-1 font-mono text-[10px] text-slate-400">
                    <span className="text-slate-500">Sessions:</span>
                    {(leg.sessionsServed || ['90R']).map((s) => (
                      <span key={s} className="bg-slate-800/60 px-1 py-0.2 rounded text-slate-300">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800/60">
                    <span>{leg.votingRecord?.length || 0} Key Votes</span>
                    <span>{leg.totalBillsFiled} Filed</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: In-Depth Legislator Profile with Roll-Call Ledger */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-100">{selectedLawmaker.name}</h3>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded font-semibold ${
                      selectedLawmaker.party === 'R'
                        ? 'bg-red-950/60 text-red-300 border border-red-800/40'
                        : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                    }`}
                  >
                    {selectedLawmaker.party === 'R' ? 'Republican' : 'Democrat'} • {selectedLawmaker.chamber}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> {selectedLawmaker.district}</span>
                  <span>•</span>
                  <span>Hometown: {selectedLawmaker.hometown}</span>
                  <span>•</span>
                  <span>Office: {selectedLawmaker.capitolOffice}</span>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => onOpenAiChat(`Analyze the legislative roll call voting record (85R through 90R), floor speeches, and filed bills of ${selectedLawmaker.name}. How have they historically voted on public school vouchers, healthcare access, and electric grid accountability?`)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Voting Record Deep Dive</span>
              </button>
            </div>

            {/* Behavioral Profile & Legislative Tenor */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Legislative Behavioral Profile & Tenor</span>
              </h4>
              <p className="text-xs md:text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                {selectedLawmaker.behavioralProfile}
              </p>
            </div>

            {/* Metric Strips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Policy Alignment</div>
                <div className="text-lg font-bold font-mono text-amber-300 mt-1">
                  {selectedLawmaker.alignmentScore}%
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">overall score</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Key Roll Calls</div>
                <div className="text-lg font-bold font-mono text-slate-100 mt-1">
                  {allVotes.length} Votes
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">85R to 89R</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Vote Alignment</div>
                <div className="text-xs font-mono mt-1 text-slate-300">
                  <span className="text-emerald-400 font-bold">{alignedVotesCount} Aligned</span> /{' '}
                  <span className="text-rose-400 font-bold">{contraryVotesCount} Contrary</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">on priority legislation</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Total Filed</div>
                <div className="text-lg font-bold font-mono text-slate-100 mt-1">
                  {selectedLawmaker.totalBillsFiled}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{selectedLawmaker.passedBills} passed chamber</div>
              </div>
            </div>

            {/* Profile Tab Navigation: Votes vs Career vs Authored */}
            <div className="border-b border-slate-800 flex items-center gap-1 pt-2">
              <button
                onClick={() => setActiveProfileTab('votes')}
                className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
                  activeProfileTab === 'votes'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Vote className="w-3.5 h-3.5" />
                <span>Roll-Call Voting Record ({allVotes.length})</span>
              </button>

              <button
                onClick={() => setActiveProfileTab('career')}
                className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
                  activeProfileTab === 'career'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Career Multi-Session Ledger</span>
              </button>

              <button
                onClick={() => setActiveProfileTab('bills')}
                className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
                  activeProfileTab === 'bills'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Authored Bills Tracked ({authoredBills.length})</span>
              </button>
            </div>

            {/* TAB 1: Roll-Call Voting Record (85R–90R) */}
            {activeProfileTab === 'votes' && (
              <div className="space-y-4">
                
                {/* Voting Record Filters */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">Filter Ledger:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Session Filter */}
                    <select
                      value={voteSessionFilter}
                      onChange={(e) => setVoteSessionFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ALL">All Sessions (85R–90R)</option>
                      <option value="89R">89R (2025)</option>
                      <option value="88R">88R (2023)</option>
                      <option value="87R">87R (2021)</option>
                      <option value="86R">86R (2019)</option>
                      <option value="85R">85R (2017)</option>
                    </select>

                    {/* Vote Cast Filter */}
                    <select
                      value={voteCastFilter}
                      onChange={(e) => setVoteCastFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ALL">All Votes Cast</option>
                      <option value="Aye">Aye Only</option>
                      <option value="Nay">Nay Only</option>
                      <option value="Present Not Voting">PNV</option>
                      <option value="Absent">Absent</option>
                    </select>

                    {/* Alignment Filter */}
                    <select
                      value={voteAlignmentFilter}
                      onChange={(e) => setVoteAlignmentFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ALL">All Alignments</option>
                      <option value="ALIGNED">Aligned with Priorities</option>
                      <option value="CONTRARY">Contrary to Priorities</option>
                    </select>
                  </div>
                </div>

                {/* Vote Ledger List */}
                {filteredVotes.length === 0 ? (
                  <div className="p-6 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center font-mono">
                    No historical votes match the selected filters.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredVotes.map((vote) => {
                      const isAye = vote.voteCast === 'Aye';
                      const isNay = vote.voteCast === 'Nay';
                      const isAligned = vote.alignmentWithUser === 'ALIGNED';

                      return (
                        <div
                          key={vote.id}
                          className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition space-y-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                                {vote.session}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded">
                                {vote.billNumber}
                              </span>
                              {vote.recordVoteNumber && (
                                <span className="font-mono text-[11px] text-slate-400">
                                  {vote.recordVoteNumber}
                                </span>
                              )}
                              <span className="font-mono text-[11px] text-slate-500">
                                {vote.date}
                              </span>
                            </div>

                            {/* Vote Cast Badge + Alignment Tag */}
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span
                                className={`px-2 py-0.5 rounded font-bold ${
                                  isAye
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                    : isNay
                                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                Voted: {vote.voteCast.toUpperCase()}
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                                  isAligned
                                    ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/30'
                                    : 'bg-rose-950/30 text-rose-400 border border-rose-800/30'
                                }`}
                              >
                                {isAligned ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                                <span>{isAligned ? 'Aligned with Goals' : 'Contrary to Goals'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Caption */}
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {vote.caption}
                          </p>

                          {/* Floor Result & Topic Footer */}
                          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-2">
                            <div className="flex items-center gap-3">
                              <span>Topic: <strong className="text-slate-300">{vote.topic}</strong></span>
                              <span>•</span>
                              <span>
                                Floor Result: <strong className={vote.overallResult === 'Passed' ? 'text-emerald-400' : 'text-rose-400'}>{vote.overallResult}</strong> ({vote.ayes} Ayes / {vote.nays} Nays)
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                const found = bills.find((b) => b.billNumber === vote.billNumber);
                                if (found) onSelectBill(found);
                                else {
                                  onOpenAiChat(`Provide an in-depth analysis of Texas bill ${vote.billNumber} from the ${vote.session} session. Explain why ${selectedLawmaker.name} voted ${vote.voteCast} and how this impacts public education and governance.`);
                                }
                              }}
                              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition underline"
                            >
                              <span>Inspect Bill & Analysis</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Multi-Session Career Ledger */}
            {activeProfileTab === 'career' && (
              <div className="space-y-4">
                <div className="text-xs font-mono text-slate-400">
                  Historical activity across Texas legislative sessions (85R to 90R):
                </div>

                {selectedLawmaker.historicalStats && selectedLawmaker.historicalStats.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="p-3">Session</th>
                          <th className="p-3">Year</th>
                          <th className="p-3 text-right">Bills Filed</th>
                          <th className="p-3 text-right">Passed</th>
                          <th className="p-3 text-right">Floor Ayes</th>
                          <th className="p-3 text-right">Floor Nays</th>
                          <th className="p-3 text-right">Alignment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                        {selectedLawmaker.historicalStats.map((stat) => (
                          <tr key={stat.session} className="hover:bg-slate-900/60 transition">
                            <td className="p-3 font-bold text-amber-300">{stat.session}</td>
                            <td className="p-3 text-slate-400">{stat.years}</td>
                            <td className="p-3 text-right tabular-nums font-bold text-slate-200">
                              {stat.totalFiled}
                            </td>
                            <td className="p-3 text-right tabular-nums text-slate-300">
                              {stat.passedBills}
                            </td>
                            <td className="p-3 text-right tabular-nums text-emerald-400">
                              {stat.ayeVotes}
                            </td>
                            <td className="p-3 text-right tabular-nums text-rose-400">
                              {stat.nayVotes}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              <span
                                className={`font-bold ${
                                  stat.alignmentScore >= 70
                                    ? 'text-emerald-400'
                                    : stat.alignmentScore <= 30
                                    ? 'text-rose-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {stat.alignmentScore}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono text-center">
                    Multi-session statistics pending compilation.
                  </div>
                )}

                {/* Committee & Topic Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    <div className="text-xs font-mono text-slate-400 uppercase mb-2">Committee Assignments</div>
                    <div className="space-y-1 text-xs text-slate-300">
                      {selectedLawmaker.committeeAssignments.map((comm, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          <span>{comm}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    <div className="text-xs font-mono text-slate-400 uppercase mb-2">Key Topic Areas</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLawmaker.keyTopics.map((topic, idx) => (
                        <span key={idx} className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Authored Bills Tracked */}
            {activeProfileTab === 'bills' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Authored Legislation Tracked ({authoredBills.length})</span>
                  </h4>
                  {firstBill && (
                    <span className="text-[11px] font-mono text-amber-300">
                      First Filed: <strong>{firstBill.billNumber}</strong> ({firstBill.dateFiled})
                    </span>
                  )}
                </div>

                {authoredBills.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center font-mono">
                    No authored bills by {selectedLawmaker.name} in current view. Use the session selector to view bills from previous sessions.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {authoredBills.map((bill, index) => (
                      <div
                        key={bill.id}
                        onClick={() => onSelectBill(bill)}
                        className="cursor-pointer p-3.5 rounded-lg bg-slate-950 hover:bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex items-start justify-between gap-3 group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-100">
                              {bill.billNumber}
                            </span>
                            {index === 0 && (
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                First Filed Bill
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 font-mono">
                              Filed {bill.dateFiled}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                            {bill.caption}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                              bill.stance === 'OPPOSE'
                                ? 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
                                : bill.stance === 'SUPPORT'
                                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                                : 'text-slate-400 bg-slate-800'
                            }`}
                          >
                            {bill.stance}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};

