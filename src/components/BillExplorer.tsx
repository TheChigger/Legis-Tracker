import React, { useState } from 'react';
import { Bill, Chamber, Stance } from '../types/legislative';
import { 
  Filter, 
  Search, 
  ArrowUpDown, 
  FileText, 
  Building, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  MinusCircle,
  ExternalLink
} from 'lucide-react';

interface BillExplorerProps {
  bills: Bill[];
  onSelectBill: (bill: Bill) => void;
  session: string;
}

export const BillExplorer: React.FC<BillExplorerProps> = ({
  bills,
  onSelectBill,
  session,
}) => {
  const [search, setSearch] = useState('');
  const [selectedChamber, setSelectedChamber] = useState<string>('All');
  const [selectedStance, setSelectedStance] = useState<string>('All');
  const [minPriority, setMinPriority] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'bill'>('priority');

  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.caption.toLowerCase().includes(search.toLowerCase()) ||
      b.primaryCategory.toLowerCase().includes(search.toLowerCase());

    const matchesChamber = selectedChamber === 'All' || b.chamber === selectedChamber;
    const matchesStance = selectedStance === 'All' || b.stance === selectedStance;
    const matchesPriority = b.priorityScore >= minPriority;

    return matchesSearch && matchesChamber && matchesStance && matchesPriority;
  });

  // Sort
  filteredBills.sort((a, b) => {
    if (sortBy === 'priority') {
      return b.priorityScore - a.priorityScore || b.filedDateTimestamp - a.filedDateTimestamp;
    }
    if (sortBy === 'date') {
      return b.filedDateTimestamp - a.filedDateTimestamp;
    }
    return a.billNumber.localeCompare(b.billNumber);
  });

  return (
    <div className="space-y-6">
      
      {/* Header and Filter Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <span>Texas Legislative Bill Catalog ({session})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Browse, filter, and inspect full statutory texts, committee analyses, and fiscal notes for every filed bill.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">
              Showing <span className="font-bold text-slate-200 tabular-nums">{filteredBills.length}</span> of {bills.length} bills
            </span>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill, author, topic..."
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          {/* Chamber */}
          <div>
            <select
              value={selectedChamber}
              onChange={(e) => setSelectedChamber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/60"
            >
              <option value="All">All Chambers (House & Senate)</option>
              <option value="House">House of Representatives</option>
              <option value="Senate">Texas Senate</option>
            </select>
          </div>

          {/* Stance */}
          <div>
            <select
              value={selectedStance}
              onChange={(e) => setSelectedStance(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/60"
            >
              <option value="All">All Stances</option>
              <option value="SUPPORT">SUPPORT (Comports with Priorities)</option>
              <option value="OPPOSE">OPPOSE (Conflicts with Priorities)</option>
              <option value="NEUTRAL">NEUTRAL (Procedural/Routine)</option>
            </select>
          </div>

          {/* Min Priority */}
          <div>
            <select
              value={minPriority}
              onChange={(e) => setMinPriority(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/60"
            >
              <option value={0}>All Priority Levels</option>
              <option value={5}>★ 5 Only (Immediate Attention)</option>
              <option value={4}>★ 4+ (High Watch)</option>
              <option value={3}>★ 3+ (Moderate)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/60"
            >
              <option value="priority">Sort by: Priority (High to Low)</option>
              <option value="date">Sort by: Date Filed (Newest First)</option>
              <option value="bill">Sort by: Bill Number</option>
            </select>
          </div>

        </div>
      </div>

      {/* Bill Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Bill #</th>
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Caption / Subject</th>
                <th className="py-3 px-4">Status & Committee</th>
                <th className="py-3 px-4 text-center">Priority</th>
                <th className="py-3 px-4 text-center">Stance</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No bills match your current filter parameters. Try clearing filters.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const isOppose = bill.stance === 'OPPOSE';
                  const isSupport = bill.stance === 'SUPPORT';

                  return (
                    <tr
                      key={bill.id}
                      onClick={() => onSelectBill(bill)}
                      className="hover:bg-slate-850/60 transition cursor-pointer group"
                    >
                      {/* Bill Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{bill.billNumber}</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({bill.chamber.slice(0, 1)})
                          </span>
                        </div>
                      </td>

                      {/* Author */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-200">
                        <div>
                          <span>{bill.author}</span>
                          {bill.coauthors.length > 0 && (
                            <div className="text-[10px] text-slate-400">
                              +{bill.coauthors.length} co-authors
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Caption & Subject */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-medium text-slate-200 line-clamp-2">
                          {bill.caption}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span className="text-amber-400/90 font-medium">{bill.primaryCategory}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">Filed {bill.dateFiled}</span>
                        </div>
                      </td>

                      {/* Status & Committee */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-300 text-[11px]">
                          {bill.currentStatus}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {bill.committee}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          ★ {bill.priorityScore}/5
                        </span>
                      </td>

                      {/* Stance */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`font-mono text-[11px] font-bold px-2.5 py-0.5 rounded ${
                            isOppose
                              ? 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
                              : isSupport
                              ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                              : 'text-slate-400 bg-slate-800 border border-slate-700'
                          }`}
                        >
                          {bill.stance}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBill(bill);
                          }}
                          className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 group-hover:border-amber-500/40 inline-flex items-center gap-1 transition"
                        >
                          <span>Deep Dive</span>
                          <ExternalLink className="w-3 h-3 text-amber-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
