export type SessionId = '90R' | '89R' | '88R' | '87R' | '86R' | '85R';
export type Chamber = 'House' | 'Senate';
export type Stance = 'SUPPORT' | 'OPPOSE' | 'NEUTRAL';
export type PriorityScore = 1 | 2 | 3 | 4 | 5;

export interface BillVersion {
  versionCode: 'I' | 'S' | 'H' | 'E' | 'F';
  versionName: string; // e.g. "Introduced", "House Committee Report", "Engrossed", "Enrolled"
  dateFiled: string;
  charCount: number;
  snippet: string;
  fullText: string;
}

export interface CommitteeVote {
  date: string;
  committee: string;
  ayes: number;
  nays: number;
  pnv: number; // Present Not Voting
  absent: number;
  result: 'Reported Favorably' | 'Left Pending' | 'Failed' | 'Substitute Adopted';
  rollCall: Array<{
    member: string;
    vote: 'Aye' | 'Nay' | 'PNV' | 'Absent';
  }>;
}

export interface Amendment {
  id: string;
  author: string;
  number: string;
  action: 'Adopted' | 'Failed' | 'Tabled' | 'Withdrawn';
  date: string;
  summary: string;
}

export interface FiscalNote {
  preparedBy: string; // e.g. "Legislative Budget Board"
  fiveYearCost: string;
  impactOnLocalGov: string;
  impactOnGeneralRevenue: string;
  methodologySummary: string;
}

export interface BillAnalysis {
  agency: string; // e.g. "Texas Legislative Council", "House Research Organization"
  author: string;
  subject: string;
  background: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
  impactedStatutes: string[];
}

export interface ComportConflictReason {
  priorityId: string;
  priorityName: string;
  alignment: 'COMPORTS' | 'CONFLICTS' | 'NEUTRAL';
  impactExplanation: string;
}

export interface Bill {
  id: string; // e.g. "90R-HB126"
  session: SessionId;
  billNumber: string; // "HB 126"
  chamber: Chamber;
  author: string;
  coauthors: string[];
  dateFiled: string;
  lastAction: string;
  lastActionDate: string;
  currentStatus: 'Filed / Introduced' | 'Referred to Committee' | 'In Committee Hearing' | 'Reported Favorably' | 'Passed Chamber' | 'Signed by Governor';
  committee: string;
  caption: string;
  summary: string;
  stance: Stance;
  priorityScore: PriorityScore;
  primaryCategory: string;
  categories: string[];
  comportConflict: ComportConflictReason[];
  versions: BillVersion[];
  votes: CommitteeVote[];
  amendments: Amendment[];
  fiscalNote?: FiscalNote;
  billAnalysis?: BillAnalysis;
  impactedAgencies: string[];
  amendedStatutes?: AmendedStatute[];
  officialTloUrl?: string;
  officialPdfUrl?: string;
  urgencyLevel: 'Immediate Attention' | 'High Watch' | 'Moderate' | 'Routine';
  filedDateTimestamp: number;
}

export interface AmendedStatute {
  codeName: string;
  codeAbbr: string;
  chapters: string[];
  sections: string[];
  statuteUrl: string;
  currentLawSnippet?: string;
}

export interface Legislator {
  id: string;
  name: string;
  chamber: Chamber;
  party: 'R' | 'D' | 'I';
  district: string;
  hometown: string;
  capitolOffice: string;
  phone: string;
  email: string;
  committeeAssignments: string[];
  totalBillsFiled: number;
  passedBills: number;
  alignmentScore: number; // 0 to 100%
  stanceBreakdown: {
    support: number;
    oppose: number;
    neutral: number;
  };
  keyTopics: string[];
  behavioralProfile: string;
  authoredBillNumbers?: string[];
  sessionsServed?: SessionId[];
  historicalStats?: LegislatorSessionStats[];
  votingRecord?: HistoricalVote[];
}

export interface HistoricalVote {
  id: string;
  session: SessionId;
  billNumber: string;
  billId?: string;
  caption: string;
  recordVoteNumber?: string;
  chamber: Chamber;
  date: string;
  voteCast: 'Aye' | 'Nay' | 'Present Not Voting' | 'Absent';
  overallResult: 'Passed' | 'Failed';
  ayes: number;
  nays: number;
  stance: Stance;
  alignmentWithUser: 'ALIGNED' | 'CONTRARY' | 'NEUTRAL';
  topic: string;
}

export interface LegislatorSessionStats {
  session: SessionId;
  years: string;
  totalFiled: number;
  passedBills: number;
  ayeVotes: number;
  nayVotes: number;
  alignmentScore: number;
}

export interface SessionMetadata {
  session: SessionId;
  name: string;
  years: string;
  conveneDate: string;
  adjournDate: string;
  governor: string;
  speaker: string;
  ltGovernor: string;
  totalFiled: number;
  totalPassed: number;
  totalVetoed: number;
  politicalContext: string;
}

export interface CommitteeMeeting {
  id: string;
  committeeName: string;
  chamber: Chamber;
  meetingDate: string;
  meetingTime: string;
  location: string;
  status: 'Scheduled' | 'In Progress' | 'Adjourned';
  agendaBills: string[];
  witnessRegistrationOpen: boolean;
  minutesSummary?: string;
  witnessCount?: number;
  recordingUrl?: string;
}

export interface PolicyPriority {
  id: string;
  title: string;
  description: string;
  weight: number; // 1 to 10
  stanceDirective: 'Defend' | 'Oppose' | 'Promote';
  keywords: string[];
  isActive: boolean;
}

export interface DashboardStats {
  session: SessionId;
  totalTrackedBills: number;
  totalVersions: number;
  uniqueAuthors: number;
  urgentBillsToday: number;
  stanceBreakdown: {
    support: number;
    oppose: number;
    neutral: number;
  };
  topCategories: Array<{ category: string; count: number }>;
}
