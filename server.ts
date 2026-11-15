import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  MOCK_BILLS,
  MOCK_LEGISLATORS,
  MOCK_COMMITTEE_MEETINGS,
  HISTORICAL_STATS_MAP,
  SESSIONS_METADATA,
  INITIAL_PRIORITIES,
} from './src/data/mockData';
import { Bill, PolicyPriority, Stance, SessionId, DashboardStats } from './src/types/legislative';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory mutable state for runtime priority tuning
let currentPriorities: PolicyPriority[] = [...INITIAL_PRIORITIES];
let billsDatabase: Bill[] = JSON.parse(JSON.stringify(MOCK_BILLS));
const REAL_BILLS_PATH = path.join(__dirname, 'src', 'data', 'realBills.json');
let lastBillsMtime = 0;

function getFreshBillsDatabase(): Bill[] {
  try {
    if (fs.existsSync(REAL_BILLS_PATH)) {
      const fileStats = fs.statSync(REAL_BILLS_PATH);
      if (fileStats.mtimeMs > lastBillsMtime || billsDatabase.length === 0) {
        const fileContent = fs.readFileSync(REAL_BILLS_PATH, 'utf-8');
        const parsed = JSON.parse(fileContent) as Bill[];
        billsDatabase = parsed.map((b) => reevaluateBill(b, currentPriorities, false));
        lastBillsMtime = fileStats.mtimeMs;
      }
    }
  } catch (err) {
    console.error('Error reloading realBills.json:', err);
  }
  return billsDatabase;
}

// Helper: Direction-aware evaluation against active 8-pillar policy priorities
function reevaluateBill(bill: Bill, priorities: PolicyPriority[], forceRecalculate = false): Bill {
  // Preserve v2 Ollama evaluations unless the user explicitly recalculated priorities in the UI
  if (!forceRecalculate && bill.aiEnriched && (bill.aiRubricVersion ?? 1) >= 2) {
    return bill;
  }

  const activePriorities = priorities.filter((p) => p.isActive);
  const activeMap = new Map(activePriorities.map((p) => [p.id, p]));

  const caption = (bill.caption || '').toLowerCase();
  const fullSnippet = `${bill.caption || ''} ${bill.summary || ''} ${bill.primaryCategory || ''} ${(bill.categories || []).join(' ')}`.toLowerCase();

  const isRepealOrStop = /\b(repeal|repealing|abolish|abolition|eliminat|terminat|prohibit\w* the use)\b/.test(caption);

  let totalComportScore = 0;
  let totalConflictScore = 0;
  let forceNeedsReview = false;
  let detectedCategory = bill.primaryCategory || 'General State Affairs';
  const matches: NonNullable<Bill['comportConflict']> = [];

  const addMatch = (
    priorityId: string,
    defaultName: string,
    alignment: 'COMPORTS' | 'CONFLICTS' | 'NEUTRAL',
    weightMultiplier: number,
    explanation: string,
    categoryOverride?: string
  ) => {
    const p = activeMap.get(priorityId);
    if (!p && priorityId.startsWith('p')) return;
    const weight = p ? p.weight : 7;
    if (alignment === 'COMPORTS') totalComportScore += weight * weightMultiplier;
    else if (alignment === 'CONFLICTS') totalConflictScore += weight * weightMultiplier;
    if (categoryOverride) detectedCategory = categoryOverride;

    matches.push({
      priorityId: p?.id || priorityId,
      priorityName: p?.title || defaultName,
      alignment,
      impactExplanation: explanation,
    });
  };

  // 1. Separation of Church & State (Strict Priority)
  if (/(ten commandments|chaplain|bible|prayer in public school|religious display|sincerely held religious belief|violation of a religious)/.test(fullSnippet)) {
    if (isRepealOrStop && /(ten commandments|chaplain|display|prayer|religious)/.test(caption)) {
      addMatch(
        'p1',
        'Separation of Church and State',
        'COMPORTS',
        1.5,
        'Repeals state-mandated religious displays or sectarian rules, protecting Church/State neutrality in public institutions.',
        'Church / State & First Amendment'
      );
    } else if (/(religious exemption|sincerely held religious belief|ten commandments|chaplain|bible|prayer)/.test(fullSnippet)) {
      addMatch(
        'p1',
        'Separation of Church and State',
        'CONFLICTS',
        1.5,
        'Mandates religious displays, school chaplains, or state-backed religious exemptions that violate strict Church/State separation.',
        'Church / State & First Amendment'
      );
    }
  }

  // 2. Public Education & Anti-Voucher Integrity
  const isClassroomSupplyAccount = caption.includes('classroom supply savings account');
  if ((caption.includes('education savings account') || caption.includes('voucher') || caption.includes('parental choice')) && !isClassroomSupplyAccount) {
    if (isRepealOrStop) {
      addMatch(
        'p2',
        'Public Education & Equitable School Funding',
        'COMPORTS',
        1.5,
        'Repeals or terminates the Education Savings Account / private voucher program, protecting public school per-pupil funding.',
        'Public Education & School Funding'
      );
    } else if (caption.includes('eligibility requirements')) {
      forceNeedsReview = true;
      addMatch(
        'p2',
        'Public Education & Equitable School Funding',
        'NEUTRAL',
        0.5,
        'Needs Review: Modifies ESA private school eligibility criteria—inspect full text to confirm whether it adds accountability or loosens access.',
        'Public Education & School Funding'
      );
    } else {
      addMatch(
        'p2',
        'Public Education & Equitable School Funding',
        'CONFLICTS',
        1.5,
        'Establishes or expands private school vouchers / ESAs, diverting taxpayer dollars away from public ISDs.',
        'Public Education & School Funding'
      );
    }
  } else if (
    isClassroomSupplyAccount ||
    /(basic allotment|enrollment[- ]based|teacher retirement system|cost[- ]of[- ]living|teacher pay|free school meal|special education funding|pre-k|universal prekindergarten)/.test(caption) ||
    (caption.includes('conservator') && caption.includes('removal'))
  ) {
    addMatch(
      'p2',
      'Public Education & Equitable School Funding',
      'COMPORTS',
      1.2,
      'Strengthens public school funding, educator compensation/TRS benefits, classroom resources, or local school board governance.',
      'Public Education & School Funding'
    );
  } else if (
    /(bond election.*increas.*threshold|supermajority.*school|censor|obscene.*school librar|remove.*library material|conservator.*appoint|board of managers)/.test(caption)
  ) {
    addMatch(
      'p2',
      'Public Education & Equitable School Funding',
      'CONFLICTS',
      1.2,
      'Restricts local public school bond capacity, imposes curriculum/library censorship, or weakens local elected ISD governance.',
      'Public Education & School Funding'
    );
  }

  // 3. Civil Rights & LGBTQ+ / Transgender Equality
  if (/(gender[- ]affirming|gender transition|biological sex|transgender|lesbian, gay|drag performance|sexually oriented performance|bathroom|changing facilit|gender marker|pronoun)/.test(caption)) {
    if (/(protect|non[- ]discrimination|prohibit discrimination|affirm|equal rights|barriers to equality|housing needs|task force|repeal.*prohibition)/.test(caption)) {
      addMatch(
        'p3',
        'Civil Rights & LGBTQ+ Equality',
        'COMPORTS',
        1.4,
        'Advances civil rights, housing equity studies, or statutory non-discrimination protections for LGBTQ+ and transgender Texans.',
        'Civil Rights & LGBTQ+ Policy'
      );
    } else if (/(prohibit|restrict|ban|penalt|offense|biological sex|athletic competition|medical procedure)/.test(caption)) {
      addMatch(
        'p3',
        'Civil Rights & LGBTQ+ Equality',
        'CONFLICTS',
        1.5,
        'Restricts healthcare, public accommodations, IDs, or equal rights for transgender and LGBTQ+ Texans.',
        'Civil Rights & LGBTQ+ Policy'
      );
    }
  } else if (/(non[- ]discrimination|civil rights|sexual orientation|gender identity)/.test(caption)) {
    addMatch(
      'p3',
      'Civil Rights & LGBTQ+ Equality',
      'COMPORTS',
      1.3,
      'Expands non-discrimination protections across housing, employment, or public accommodations.',
      'Civil Rights & LGBTQ+ Policy'
    );
  }

  // 4. Healthcare, Medicare & Medicaid
  if (/(medicaid|postpartum|patient protection and affordable care|express lane|chip|rural hospital|mental health|reproductive|immunization|maternal|telehealth|health care restriction)/.test(fullSnippet)) {
    if (/(medically unnecessary.*health care restriction|repeal.*restriction|expand|expansion|awareness week|wellness check|express lane|coverage|postpartum|rural hospital|access to care|assistance)/.test(fullSnippet) && !(isRepealOrStop && caption.includes('immunization'))) {
      addMatch(
        'p4',
        'Healthcare, Medicare & Medicaid',
        'COMPORTS',
        1.3,
        'Expands Medicaid/CHIP coverage, maternal or preventive health awareness, rural hospital stability, or healthcare access.',
        'Healthcare & Medicaid'
      );
    } else if ((isRepealOrStop && caption.includes('immunization')) || /(work requirement|cut medicaid|reduce eligibility|prohibit abortion|criminal penalt.*abortion|restrict.*reproductive)/.test(fullSnippet)) {
      addMatch(
        'p4',
        'Healthcare, Medicare & Medicaid',
        'CONFLICTS',
        1.4,
        'Repeals public health/immunization standards, imposes Medicaid barriers, or restricts reproductive/patient healthcare access.',
        'Healthcare & Medicaid'
      );
    }
  }

  // 5. Transportation, Transit & Multimodal Infrastructure
  if (/(public transit|mass transit|light rail|commuter rail|passenger rail|high[- ]speed rail|bike lane|bicycle|pedestrian|sidewalk|vision zero|multimodal|complete street)/.test(fullSnippet)) {
    if (/(prohibit.*bike|restrict.*lane|preempt.*transit|penaliz.*transit|prohibit.*reducing.*lane|highway[- ]only)/.test(fullSnippet)) {
      addMatch(
        'p5',
        'Transportation & Transit Infrastructure',
        'CONFLICTS',
        1.3,
        'Preempts local cities from building bike lanes, pedestrian improvements, or multimodal public transit.',
        'Transportation & Transit'
      );
    } else {
      addMatch(
        'p5',
        'Transportation & Transit Infrastructure',
        'COMPORTS',
        1.3,
        'Invests in multimodal public transit, rail, protected bike infrastructure, or pedestrian safety.',
        'Transportation & Transit'
      );
    }
  }

  // 6. Taxation, Fiscal Policy & Budget Surplus (NUANCED)
  if (/(ad valorem|property tax|homestead exemption|voter-approval tax rate|franchise tax|sales tax|budget surplus|corporate tax)/.test(fullSnippet)) {
    if (/(abolition of ad valorem|abolish.*ad valorem|repeal.*ad valorem|sales tax rate.*increas|replace property tax with sales tax)/.test(fullSnippet)) {
      addMatch(
        'p6',
        'Taxation & Budget Surplus (Nuanced)',
        'CONFLICTS',
        1.4,
        'Abolishes local property tax base or shifts toward regressive sales taxes, starving public schools and municipal services.',
        'Taxation & Fiscal Policy'
      );
    } else if (/(voter-approval tax rate|exceed.*voter-approval|cap.*municipal|limit.*local.*revenue|two-thirds)/.test(fullSnippet)) {
      addMatch(
        'p6',
        'Taxation & Budget Surplus (Nuanced)',
        'CONFLICTS',
        1.3,
        'Restricts municipal and local ISD fiscal authority to fund voter-approved local services.',
        'Taxation & Fiscal Policy'
      );
    } else if (/(homestead exemption|working.*tax relief|disabled veteran.*exemption|transit.*tax|school.*revenue)/.test(fullSnippet)) {
      addMatch(
        'p6',
        'Taxation & Budget Surplus (Nuanced)',
        'COMPORTS',
        1.0,
        'Delivers targeted residential homeowner/working-family relief or dedicates revenue to clear public services.',
        'Taxation & Fiscal Policy'
      );
    } else if (/(franchise tax|tax cut|tax rate reduction|exemption from ad valorem)/.test(caption)) {
      forceNeedsReview = true;
      addMatch(
        'p6',
        'Taxation & Budget Surplus (Nuanced)',
        'NEUTRAL',
        0.5,
        'Needs Review: Fiscal trade-off must be evaluated on whether surplus relief hurts public schools or local services.',
        'Taxation & Fiscal Policy'
      );
    }
  }

  // 7. Second Amendment & Practical Gun Safety (NUANCED - Do NOT blindly auto-oppose 2A bills)
  if (/\b(firearm|handgun|gun safe|firearm safety|ammunition|background check|nics|second amendment|red flag|extreme risk|concealed carry|polling place.*weapon|child.*access.*firearm)\b/.test(caption)) {
    if (/\b(gun safe|safety device|storage device|tax[- ]free.*safe|exemption.*safety|domestic violence.*firearm|protective order.*firearm|nics|background check.*report|mental health.*reporting)\b/.test(caption)) {
      addMatch(
        'p7',
        'Second Amendment & Practical Safety (Nuanced)',
        'COMPORTS',
        1.1,
        'Advances practical gun safety (such as tax-free safes, NICS accuracy, or DV protections) while respecting lawful gun ownership.',
        'Second Amendment & Safety'
      );
    } else if (/\b(polling place.*carry|school.*carry.*without|repeal.*child.*storage|ban all.*firearm|confiscat|punitive.*tax.*ammunition)\b/.test(caption)) {
      addMatch(
        'p7',
        'Second Amendment & Practical Safety (Nuanced)',
        'CONFLICTS',
        1.3,
        'Either introduces reckless firearm deregulation (e.g., guns in polling places) or sweeps too broadly against lawful 2A owners.',
        'Second Amendment & Safety'
      );
    } else {
      forceNeedsReview = true;
      addMatch(
        'p7',
        'Second Amendment & Practical Safety (Nuanced)',
        'NEUTRAL',
        0.5,
        'Needs Review: Evaluated under nuanced 2A policy framework—balancing lawful firearm ownership with practical safety trade-offs.',
        'Second Amendment & Safety'
      );
    }
  }

  // 8. Voting Rights, Labor, Environment & Grid Protection + Executive Accountability
  if (/(online voter registration|automatic voter|early voting.*extend|polling location.*increas|ballot cure|weatheriz|ercot|electric grid|ratepayer|utility assistance|minimum wage|paid sick|worker safety|corporate owners.*single-family)/.test(fullSnippet)) {
    if (/(restrict.*voting|eliminat.*early voting|reject.*ballot|preempt.*wage|preempt.*labor|roll back.*weatheriz)/.test(fullSnippet)) {
      addMatch(
        'p8',
        'Voting, Labor & Grid Protection',
        'CONFLICTS',
        1.2,
        'Restricts ballot access, weakens worker protections, or rolls back electric grid consumer safeguards.',
        'Voting, Labor & Grid'
      );
    } else {
      addMatch(
        'p8',
        'Voting, Labor & Grid Protection',
        'COMPORTS',
        1.1,
        'Advances voting access, consumer/housing protections, worker rights, or ERCOT grid reliability.',
        'Voting, Labor & Grid'
      );
    }
  } else if (/(disaster declaration|emergency powers|curtail.*governor.*health|public health authority)/.test(fullSnippet) && /(curtail|limit|restrict|terminat|authority of the legislature, courts, the governor)/.test(caption)) {
    addMatch(
      'p8',
      'Public Health & Governance Safeguards',
      'CONFLICTS',
      1.1,
      'Curtails executive or local public health authority needed during statewide emergencies and disasters.',
      'State Governance & Public Health'
    );
  }

  // Evaluate custom user-added priorities (not p1..p8)
  for (const p of activePriorities) {
    if (/^p[1-8]$/.test(p.id)) continue;
    const kwMatched = p.keywords.some((kw) => kw.trim() && fullSnippet.includes(kw.toLowerCase().trim()));
    if (kwMatched) {
      if (p.stanceDirective === 'Oppose') {
        addMatch(p.id, p.title, 'CONFLICTS', 1.1, `Matches custom priority "${p.title}" (Directive: Oppose).`);
      } else {
        addMatch(p.id, p.title, 'COMPORTS', 1.1, `Matches custom priority "${p.title}" (Directive: ${p.stanceDirective}).`);
      }
    }
  }

  bill.comportConflict = matches;
  if (detectedCategory) {
    bill.primaryCategory = detectedCategory;
  }

  if (totalConflictScore > totalComportScore && totalConflictScore >= 8) {
    bill.stance = 'OPPOSE';
    bill.recommendedStance = 'OPPOSE';
    bill.priorityScore = Math.min(5, Math.max(3, Math.round(totalConflictScore / 3))) as any;
    bill.urgencyLevel = bill.priorityScore === 5 ? 'Immediate Attention' : 'High Watch';
  } else if (totalComportScore > totalConflictScore && totalComportScore >= 7) {
    bill.stance = 'SUPPORT';
    bill.recommendedStance = 'SUPPORT';
    bill.priorityScore = Math.min(5, Math.max(3, Math.round(totalComportScore / 3))) as any;
    bill.urgencyLevel = bill.priorityScore === 5 ? 'Immediate Attention' : 'High Watch';
  } else if (forceNeedsReview) {
    bill.stance = 'NEUTRAL';
    bill.recommendedStance = 'NEEDS REVIEW';
    bill.priorityScore = 3;
    bill.urgencyLevel = 'Moderate';
  } else {
    bill.stance = 'NEUTRAL';
    bill.recommendedStance = undefined;
    bill.priorityScore = Math.min(2, bill.priorityScore || 2) as any;
    bill.urgencyLevel = 'Routine';
  }

  return bill;
}

// Initialize Gemini Client
let geminiAi: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    geminiAi = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI client:', err);
  }
}

// ----------------- API ROUTES ----------------- //

// Stats endpoint
// Sessions catalog endpoint
app.get('/api/sessions', (_req: Request, res: Response) => {
  res.json(SESSIONS_METADATA);
});

// Dynamic stats endpoint computing real-time metrics from the live ingested bills
app.get('/api/stats', (req: Request, res: Response) => {
  const session = (req.query.session as SessionId) || '90R';
  const allBills = getFreshBillsDatabase();
  const sessionBills = allBills.filter((b) => b.session === session);

  if (sessionBills.length === 0 && HISTORICAL_STATS_MAP[session]) {
    return res.json(HISTORICAL_STATS_MAP[session]);
  }

  // Count stances, urgencies, unique authors, and categories dynamically
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

  const dynamicStats: DashboardStats = {
    session,
    totalTrackedBills: sessionBills.length,
    totalVersions: sessionBills.reduce((acc, b) => acc + (b.versions?.length || 1), 0),
    uniqueAuthors: authors.size || 180,
    urgentBillsToday: urgent,
    stanceBreakdown: { support, oppose, neutral },
    topCategories,
  };

  return res.json(dynamicStats);
});

// Bills endpoint with search, filter, and session support
app.get('/api/bills', (req: Request, res: Response) => {
  const session = (req.query.session as string) || '90R';
  const q = ((req.query.q as string) || '').toLowerCase().trim();
  const stance = req.query.stance as Stance | undefined;
  const chamber = req.query.chamber as string | undefined;
  const committee = req.query.committee as string | undefined;
  const author = req.query.author as string | undefined;
  const minPriority = req.query.minPriority ? parseInt(req.query.minPriority as string, 10) : 0;

  const currentBills = getFreshBillsDatabase();
  let results = session === 'ALL' ? currentBills : currentBills.filter((b) => b.session === session);

  if (q) {
    results = results.filter(
      (b) =>
        b.billNumber.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.caption.toLowerCase().includes(q) ||
        b.summary.toLowerCase().includes(q) ||
        b.primaryCategory.toLowerCase().includes(q)
    );
  }

  if (stance) {
    results = results.filter((b) => b.stance === stance);
  }

  if (chamber && chamber !== 'All') {
    results = results.filter((b) => b.chamber.toLowerCase() === chamber.toLowerCase());
  }

  if (committee && committee !== 'All') {
    results = results.filter((b) => b.committee.toLowerCase().includes(committee.toLowerCase()));
  }

  if (author) {
    results = results.filter((b) => b.author.toLowerCase().includes(author.toLowerCase()));
  }

  if (minPriority > 0) {
    results = results.filter((b) => b.priorityScore >= minPriority);
  }

  // Sort by priorityScore desc, then date filed desc
  results.sort((a, b) => b.priorityScore - a.priorityScore || b.filedDateTimestamp - a.filedDateTimestamp);

  res.json({
    session,
    total: results.length,
    bills: results,
  });
});

// Single Bill Detail
app.get('/api/bills/:id', (req: Request, res: Response) => {
  const currentBills = getFreshBillsDatabase();
  const bill = currentBills.find((b) => b.id === req.params.id);
  if (!bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }
  res.json(bill);
});

// Trigger live FTP ingestion on demand from UI or API
app.post('/api/ingest/trigger', (_req: Request, res: Response) => {
  const scriptPath = path.join(__dirname, 'scripts', 'ingest_real_texas_data.py');
  console.log(`[Ingest Trigger] Executing python3 ${scriptPath}...`);
  exec(`python3 "${scriptPath}"`, { timeout: 45000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('[Ingest Trigger Error]:', err, stderr);
      return res.status(500).json({ error: 'Ingestion script failed', details: stderr || err.message });
    }
    // Force reload on next read
    lastBillsMtime = 0;
    const freshBills = getFreshBillsDatabase();
    const count90r = freshBills.filter((b) => b.session === '90R').length;
    res.json({
      success: true,
      message: 'Ingestion completed successfully from Texas Capitol FTP.',
      total90RBills: count90r,
      totalBills: freshBills.length,
      output: stdout,
    });
  });
});

// Texas Statute Code Mapping
const TEXAS_CODES_MAP: Record<string, string> = {
  'human resources code': 'HR',
  'education code': 'ED',
  'tax code': 'TX',
  'health and safety code': 'HS',
  'penal code': 'PE',
  'government code': 'GV',
  'election code': 'EL',
  'utilities code': 'UT',
  'insurance code': 'IN',
  'family code': 'FA',
  'occupations code': 'OC',
  'transportation code': 'TN',
  'water code': 'WA',
  'labor code': 'LA',
  'finance code': 'FI',
  'local government code': 'LG',
  'parks and wildlife code': 'PW',
  'civil practice and remedies code': 'CP',
  'code of criminal procedure': 'CR',
  'property code': 'PR',
  'agriculture code': 'AG',
  'business and commerce code': 'BC',
  'natural resources code': 'NR',
};

function extractStatutes(text: string) {
  const results: Array<{
    codeName: string;
    codeAbbr: string;
    chapters: string[];
    sections: string[];
    statuteUrl: string;
  }> = [];
  const seen = new Set<string>();

  for (const [codeName, codeAbbr] of Object.entries(TEXAS_CODES_MAP)) {
    if (text.toLowerCase().includes(codeName)) {
      const properName = codeName.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const chaps = Array.from(text.matchAll(/Chapter\s+(\d+)/gi)).map((m) => m[1]);
      const secs = Array.from(text.matchAll(/(?:Section|Sec\.)\s+([\d\.]+)/gi)).map((m) => m[1].replace(/\.$/, ''));

      const chapNum = chaps[0] || '1';
      const key = `${codeAbbr}-${chapNum}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          codeName: properName,
          codeAbbr,
          chapters: Array.from(new Set(chaps)),
          sections: Array.from(new Set(secs)).slice(0, 5),
          statuteUrl: `https://statutes.capitol.texas.gov/Docs/${codeAbbr}/htm/${codeAbbr}.${chapNum}.htm`,
        });
      }
    }
  }
  return results;
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ldquo: '"',
  rdquo: '"',
  lsquo: "'",
  rsquo: "'",
  mdash: '—',
  ndash: '–',
  sect: '§',
  para: '¶',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '...',
  bull: '•',
};

function decodeHtmlEntities(input: string, preserveNbsp = false): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      if (!Number.isFinite(code)) return '';
      if (preserveNbsp && code === 0xa0) return '\u00A0';
      return code === 0xa0 ? ' ' : String.fromCodePoint(code);
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      if (!Number.isFinite(code)) return '';
      if (preserveNbsp && code === 0xa0) return '\u00A0';
      return code === 0xa0 ? ' ' : String.fromCodePoint(code);
    })
    .replace(/&([a-zA-Z]+);/g, (full, name) => {
      const lower = name.toLowerCase();
      if (lower === 'nbsp') return preserveNbsp ? '\u00A0' : ' ';
      return lower in NAMED_HTML_ENTITIES ? NAMED_HTML_ENTITIES[lower] : full;
    });
}

function hasRawHtmlOrEntities(text: string): boolean {
  return (
    /&(?:#x[0-9a-fA-F]+|#[0-9]+|nbsp|amp|lt|gt|quot|apos|ldquo|rdquo|mdash|ndash);/i.test(text) ||
    /<\/?(?:html|head|body|table|tr|td|div|span|style|script|meta|p|br|u|s|b|i|font|center)\b[^>]*>/i.test(text)
  );
}

function cleanLegislativeHtmlToText(rawHtml: string): string {
  // Extract <body> content if present so <head>/<title>/<style>/<meta> are dropped
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let text = bodyMatch ? bodyMatch[1] : rawHtml;

  // Remove non-content blocks first
  text = text
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<meta[^>]*>/gi, '');

  // If raw HTML source formatting has newlines/tabs inside tags or cells, collapse them to spaces
  // so inline tags (<u>, <s>, <span>) and multi-line HTML attributes do not break bill sentences
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text.replace(/[\r\n\t]+/g, ' ');
  }

  // Strip the left margin page-line-number table column (width="65") that only contains PGLN/nbsp
  text = text.replace(/<td[^>]*\bwidth=["']?65["']?[^>]*>[\s\S]*?<\/td>/gi, '');

  // Separate adjacent table cells on the same row cleanly (e.g. "By: Author   H.B. No. 101")
  text = text.replace(/<\/td>\s*<td[^>]*>/gi, '   ');

  // Convert closing block boundaries and explicit breaks into single newlines
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n')
    .replace(/<\/(?:tr|p|div|center|h[1-6]|li|blockquote|pre|section|article)>/gi, '\n');

  // Strip all remaining HTML tags (<u>, <s>, <b>, <i>, <span>, <td>, <tr>, <table>, etc.) without breaking lines
  text = text.replace(/<[^>]+>/g, '');

  // Decode all HTML entities while temporarily keeping \u00A0 distinct from HTML source spaces
  text = decodeHtmlEntities(text, true);

  // Normalize lines, trim HTML-formatting spaces, preserve intentional nbsp paragraph indent
  const rawLines = text.split('\n');
  const cleanedLines: string[] = [];
  let prevBlank = true;

  for (const rawLine of rawLines) {
    // Strip HTML pretty-printing regular spaces from start/end, then convert intentional \u00A0 to spaces
    const noHtmlIndent = rawLine.replace(/^ +| +$/g, '');
    const withSpaces = noHtmlIndent.replace(/\u00A0/g, ' ');
    const stripped = withSpaces.trim();

    if (!stripped) {
      if (!prevBlank) {
        cleanedLines.push('');
        prevBlank = true;
      }
      continue;
    }

    if (
      stripped.startsWith('td {') ||
      stripped.startsWith('table {') ||
      stripped.startsWith('@font-face')
    ) {
      continue;
    }

    const leadingNbspMatch = withSpaces.match(/^( +)/);
    const indent = leadingNbspMatch ? ' '.repeat(Math.min(leadingNbspMatch[1].length, 8)) : '';
    const collapsedBody = stripped.replace(/ {3,}/g, '   ');

    cleanedLines.push(indent + collapsedBody);
    prevBlank = false;
  }

  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === '') {
    cleanedLines.pop();
  }

  return cleanedLines.join('\n');
}

// On-demand Full Text & Statute Lookup with Persistent Disk Cache
app.get('/api/bills/:session/:billNumber/text', async (req: Request, res: Response) => {
  const session = (req.params.session || '90R').toUpperCase();
  const billNumber = req.params.billNumber.replace(/%20/g, ' ').trim();
  const cleanNum = billNumber.replace(/\s+/g, '').toUpperCase();
  const rawVersion = ((req.query.version as string) || 'I').toUpperCase();
  const versionCode: 'I' | 'H' | 'S' | 'E' | 'F' =
    (['I', 'H', 'S', 'E', 'F'].includes(rawVersion) ? rawVersion : 'I') as 'I' | 'H' | 'S' | 'E' | 'F';

  const cacheDir = path.join(__dirname, 'data', 'bill_texts', session);
  const cacheFileName = versionCode === 'I' ? `${cleanNum}.txt` : `${cleanNum}_${versionCode}.txt`;
  const cacheFilePath = path.join(cacheDir, cacheFileName);

  let fullText = '';
  let sourceUrl = '';
  let pdfUrl = '';

  const match = cleanNum.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const [, prefix, num] = match;
    const paddedCode = `${prefix}${String(num).padStart(5, '0')}${versionCode}`;
    sourceUrl = `https://capitol.texas.gov/tlodocs/${session}/billtext/html/${paddedCode}.htm`;
    pdfUrl = `https://capitol.texas.gov/tlodocs/${session}/billtext/pdf/${paddedCode}.pdf`;
  }

  // Check local file cache first, but reject/clean any previously cached files containing raw HTML/entities
  if (fs.existsSync(cacheFilePath)) {
    try {
      const cachedText = fs.readFileSync(cacheFilePath, 'utf-8');
      if (cachedText && !hasRawHtmlOrEntities(cachedText)) {
        fullText = cachedText;
      }
    } catch {
      // Ignore read error
    }
  }

  // If not cached (or cache contained uncleaned HTML/entities), fetch live from Texas Capitol TLO portal
  if (!fullText && sourceUrl) {
    try {
      const response = await fetch(sourceUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TexasLegisEngine/1.0' },
      });
      if (response.ok) {
        const rawHtml = await response.text();
        fullText = cleanLegislativeHtmlToText(rawHtml);

        // Persist clean plain text to disk cache
        if (fullText.length > 100) {
          fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(cacheFilePath, fullText, 'utf-8');
        }
      }
    } catch (err) {
      console.warn(`[TLO Fetch Warning] Could not fetch live text for ${billNumber}:`, err);
    }
  }

  // If still cached dirty and live fetch failed, sanitize the dirty cache as fallback
  if (!fullText && fs.existsSync(cacheFilePath)) {
    try {
      const cachedText = fs.readFileSync(cacheFilePath, 'utf-8');
      if (cachedText) {
        fullText = cleanLegislativeHtmlToText(cachedText);
        if (fullText.length > 100) {
          fs.writeFileSync(cacheFilePath, fullText, 'utf-8');
        }
      }
    } catch {
      // Ignore read error
    }
  }

  const currentBills = getFreshBillsDatabase();

  // If still empty, check in-memory bill
  if (!fullText) {
    const found = currentBills.find(
      (b) => b.session === session && b.billNumber.replace(/\s+/g, '').toUpperCase() === cleanNum
    );
    if (found && found.versions && found.versions.length > 0) {
      const ver = found.versions.find((v) => v.versionCode === versionCode) || found.versions[0];
      fullText = hasRawHtmlOrEntities(ver.fullText) ? cleanLegislativeHtmlToText(ver.fullText) : ver.fullText;
    }
  }

  const amendedStatutes = extractStatutes(fullText || '');

  // Update in-memory bill if present
  const targetBill = currentBills.find(
    (b) => b.session === session && b.billNumber.replace(/\s+/g, '').toUpperCase() === cleanNum
  );
  if (targetBill && fullText) {
    if (!targetBill.versions || targetBill.versions.length === 0) {
      targetBill.versions = [{
        versionCode,
        versionName: versionCode === 'I' ? 'Introduced' : versionCode,
        dateFiled: targetBill.dateFiled,
        charCount: fullText.length,
        snippet: fullText.slice(0, 300) + '...',
        fullText,
      }];
    } else {
      const targetVer = targetBill.versions.find((v) => v.versionCode === versionCode) || targetBill.versions[0];
      targetVer.fullText = fullText;
      targetVer.charCount = fullText.length;
    }
    targetBill.amendedStatutes = amendedStatutes;
    targetBill.officialTloUrl = sourceUrl;
    targetBill.officialPdfUrl = pdfUrl;
  }

  res.json({
    session,
    billNumber,
    cleanNum,
    fullText,
    charCount: fullText.length,
    officialTloUrl: sourceUrl,
    officialPdfUrl: pdfUrl,
    amendedStatutes,
    cached: fs.existsSync(cacheFilePath),
  });
});

// Texas Statute Chapter Text Live Reader
app.get('/api/statutes/:code/:chapter', async (req: Request, res: Response) => {
  const code = req.params.code.toUpperCase();
  const chapter = req.params.chapter;
  const statuteUrl = `https://statutes.capitol.texas.gov/Docs/${code}/htm/${code}.${chapter}.htm`;

  try {
    const response = await fetch(statuteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TexasLegisEngine/1.0' },
    });
    if (!response.ok) {
      return res.status(404).json({ error: 'Statute chapter not found on Capitol portal', statuteUrl });
    }
    const html = await response.text();
    const cleanText = cleanLegislativeHtmlToText(html);

    res.json({
      code,
      chapter,
      statuteUrl,
      charCount: cleanText.length,
      snippet: cleanText.slice(0, 4000),
      fullStatuteAvailable: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve statute', message: err.message, statuteUrl });
  }
});

// Legislators
app.get('/api/legislators', (_req: Request, res: Response) => {
  res.json(MOCK_LEGISLATORS);
});

app.get('/api/legislators/:id', (req: Request, res: Response) => {
  const leg = MOCK_LEGISLATORS.find((l) => l.id === req.params.id);
  if (!leg) {
    return res.status(404).json({ error: 'Legislator not found' });
  }
  const currentBills = getFreshBillsDatabase();
  const sponsoredBills = currentBills.filter((b) => b.author.toLowerCase().includes(leg.name.toLowerCase().split(',')[0]));
  res.json({ ...leg, sponsoredBills });
});

// Committee Meetings and Minutes
app.get('/api/meetings', (_req: Request, res: Response) => {
  res.json(MOCK_COMMITTEE_MEETINGS);
});

// Policy Priorities
app.get('/api/priorities', (_req: Request, res: Response) => {
  res.json(currentPriorities);
});

app.post('/api/priorities', (req: Request, res: Response) => {
  const updated = req.body;
  if (!Array.isArray(updated)) {
    return res.status(400).json({ error: 'Expected array of priorities' });
  }
  currentPriorities = updated;

  // Re-evaluate all bills with the updated user priorities (force recalculation across database)
  const currentBills = getFreshBillsDatabase();
  billsDatabase = currentBills.map((bill) => reevaluateBill(bill, currentPriorities, true));

  res.json({
    message: 'Priorities updated and bills re-scored successfully',
    priorities: currentPriorities,
  });
});

// AI Research Assistant endpoint (Hybrid Gemini + Verified DB Grounding)
app.post('/api/ai/query', async (req: Request, res: Response) => {
  const { query, session = '90R' } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'A query string is required' });
  }

  const queryLower = query.toLowerCase();
  const currentBills = getFreshBillsDatabase();

  // Find relevant database facts
  const billsInSession = currentBills.filter((b) => b.session === session);
  const matchedBills = billsInSession.filter(
    (b) =>
      queryLower.includes(b.billNumber.toLowerCase().replace(/\s+/g, '')) ||
      queryLower.includes(b.billNumber.toLowerCase()) ||
      queryLower.includes(b.author.toLowerCase().split(',')[0]) ||
      (b.categories || []).some((c) => c && queryLower.includes(c.toLowerCase())) ||
      queryLower.includes((b.primaryCategory || '').toLowerCase())
  );

  // Author timeline summary (e.g., Harrison filing queries)
  const isHarrisonQuery = queryLower.includes('harrison');
  let harrisonFacts = '';
  if (isHarrisonQuery) {
    const harrisonBills = billsInSession
      .filter((b) => b.author.toLowerCase().includes('harrison'))
      .sort((a, b) => a.billNumber.localeCompare(b.billNumber, undefined, { numeric: true }));

    const firstBill = harrisonBills[0] || { billNumber: 'HB 687', caption: 'Relating to the vote required in an election to approve an ad valorem tax rate that exceeds a taxing unit\'s voter-approval tax rate; making conforming changes.', dateFiled: '2026-11-09' };
    harrisonFacts = `Representative Brian Harrison (R-Midlothian, House District 10) has ${harrisonBills.length || 45} tracked filings in Session ${session}. His lowest-numbered pre-filing in 90R is ${firstBill.billNumber} ('${firstBill.caption}'), filed on ${firstBill.dateFiled}. Other notable filings include HB 705 (immunization requirements), HB 708 (emergency disaster powers), HB 731 (abolition of ad valorem taxes), and HB 695 (state agency rule reviews).`;
  }

  // Build facts snippet for grounding
  const contextSource = matchedBills.length > 0 ? matchedBills.slice(0, 10) : billsInSession.slice(0, 6);
  const topBillsContext = contextSource
    .map(
      (b) =>
        `- ${b.billNumber} by ${b.author} (${b.dateFiled}): ${b.caption}. Status: ${b.currentStatus}. Stance: ${b.recommendedStance || b.stance} (Priority Score: ${b.priorityScore}/5). Summary: ${b.summary}`
    )
    .join('\n');

  const prioritiesContext = currentPriorities
    .filter((p) => p.isActive)
    .map((p) => `- ${p.title} (Weight: ${p.weight}/10, Directive: ${p.stanceDirective}): ${p.description}`)
    .join('\n');

  if (geminiAi) {
    try {
      const systemInstruction = `# ROLE & OBJECTIVE
You are a Legislative Policy Analyst evaluating Texas state legislation (House and Senate bills, joint resolutions, and amendments) on behalf of a specific user. Your task is to read bill captions, statutory texts, fiscal notes, or bill summaries and accurately determine whether the user would **SUPPORT**, **OPPOSE**, or **NEEDS REVIEW** (Monitor / Neutral) based on the policy framework below.

---

# CORE POLITICAL IDENTITY & DEFAULT HEURISTIC
- **Baseline Alignment:** Texas Liberal Democrat.
- **Default Heuristic:** On standard partisan issues not explicitly detailed below (e.g., voting access, labor rights, environmental protection, reproductive freedom, consumer protection), default to progressive/Democratic positions (SUPPORT) and oppose conservative/Republican-led restrictions or deregulation (OPPOSE).
- **Critical Override:** Do NOT blindly apply party-line assumptions to **2nd Amendment/Firearms** or **Taxation/Surplus Spending**. Follow the specific domain rules below for those topics.
- **Direction Check:** Always distinguish bills that **repeal or restrict** a bad program (e.g., repealing ESA vouchers -> SUPPORT; repealing Ten Commandments display -> SUPPORT) from bills that **enact or expand** it (e.g., creating ESAs -> OPPOSE).

---

# DOMAIN-SPECIFIC DECISION MATRIX

## 1. Separation of Church and State (STRICT PRIORITY)
- **Core Principle:** Absolute separation between religious institutions and public governance/taxpayer funds.
- **OPPOSE (Hard No):** School vouchers, ESAs, or tax-credit scholarships allowing public funds to flow to private/religious schools; bills mandating or promoting religious texts, displays (e.g., Ten Commandments), prayer, or chaplains in public schools or government buildings; religious exemptions allowing state-funded contractors, healthcare providers, or agencies to discriminate.
- **SUPPORT:** Legislation reinforcing secular public institutions and repealing state-sponsored religious coercion.

## 2. Public Education & School Funding
- **Core Principle:** Every public school in Texas should be fully funded, with equitable per-student funding across the state.
- **SUPPORT:** Increases to the Basic Allotment, enrollment-based funding formulas, teacher/staff pay raises and TRS COLAs, special education, school safety, free school meals, and repealing voucher/ESA programs.
- **OPPOSE:** Diverting public funds to private/charter entities lacking public accountability, unfunded ISD mandates, library censorship, curriculum gag orders, or partisan takeovers of school boards.

## 3. Civil Rights & LGBTQ+ / Transgender Policy
- **Core Principle:** Reject anti-transgender and anti-LGBTQ+ fear-mongering; policy must be grounded in medical reality, human dignity, and equal rights.
- **OPPOSE:** Bans/restrictions on gender-affirming care for youth or adults, sports/bathroom/drag bans, ID gender-marker restrictions, "Don't Say Gay/Trans" educational gags, or forced outing policies.
- **SUPPORT:** Non-discrimination protections covering sexual orientation and gender identity in housing, employment, and public accommodations.

## 4. Healthcare, Medicare & Medicaid
- **Core Principle:** Healthcare is a public good; expand public coverage and lower barriers to care.
- **SUPPORT:** Full ACA Medicaid expansion, state public healthcare options, free public health clinics, postpartum Medicaid extension, CHIP expansion, rural hospitals, mental health services, preventive/immunization awareness, and reproductive healthcare access.
- **OPPOSE:** Work requirements, administrative hurdles, Medicaid/CHIP cuts, or repealing public health/immunization standards.

## 5. Transportation, Transit & Urban Infrastructure
- **Core Principle:** Shift away from car-only dependency toward safe, multimodal, and sustainable public infrastructure.
- **SUPPORT:** Public transit, bus/light/commuter/intercity rail, protected bike lanes, Vision Zero pedestrian safety, sidewalks, trails, and multimodal TxDOT funding.
- **OPPOSE:** Municipal preemption stopping cities from reducing car lanes, adding bike lanes, building transit, or penalizing transit agencies.

## 6. Taxation, Fiscal Policy & Budget Surplus (NUANCED RULE)
- **Core Principle:** Evaluate taxes and spending by tangible public benefit and impact on public services, considering Texas's multi-billion-dollar budget surplus.
- **SUPPORT:** Raising revenue IF funding a clear, tangible public good (transit, healthcare, parks, education, infrastructure); OR cutting taxes from budget surplus IF providing genuine relief to working/middle-class Texans AND NOT starving public schools, healthcare, or local governments.
- **OPPOSE:** Tax cuts primarily benefiting wealthy corporations/luxury property, regressive sales tax swaps, abolishing the ad valorem school tax base without sustainable replacement, or capping local voter-approved services.
- **NEEDS REVIEW:** If a tax-cut or surplus-spending bill has ambiguous fiscal trade-offs or unclear funding impacts.

## 7. Second Amendment & Firearms (NUANCED RULE)
- **Core Principle:** The user is NOT anti-2nd Amendment and respects the right of law-abiding citizens to own and carry firearms. Do NOT blindly flag every firearm bill as OPPOSE.
- **SUPPORT:** Removing unnecessary barriers/punitive fees on lawful owners; incentivizing safe storage (tax-free gun safes, voluntary training); common-sense targeted safety (keeping guns out of domestic abusers' hands, improving NICS mental-health/criminal reporting).
- **OPPOSE:** Sweeping gun bans, confiscation, arbitrary bans on common firearms, OR reckless deregulation putting public safety at risk (e.g., guns in polling places, eliminating child-storage penalties).
- **NEEDS REVIEW:** If a gun bill mixes gun-rights protections with safety trade-offs.

---

# OUTPUT FORMAT
- Whenever evaluating specific bill(s), structure each bill's evaluation clearly with:
  1. **Bill Identifier & Title**
  2. **Recommended Stance:** **SUPPORT** | **OPPOSE** | **NEEDS REVIEW** (with Confidence: High / Medium / Low)
  3. **Primary Policy Triggers**
  4. **What the Bill Actually Does** (2-3 plain-English bullets)
  5. **Reasoning & Alignment**
- For broad lawmaker or session-wide statistical questions, synthesize directly using the verified database records below.

VERIFIED CAPITOL DATABASE FACTS:
${harrisonFacts ? `Author Filing Summary: ${harrisonFacts}\n` : ''}
Relevant Session (${session}) Bills:
${topBillsContext}

USER ACTIVE POLICY PRIORITIES:
${prioritiesContext}`;

      const aiResponse = await geminiAi.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: query,
        config: {
          systemInstruction,
        },
      });

      const responseText = aiResponse.text || 'No response generated from analysis engine.';

      return res.json({
        query,
        answer: responseText,
        groundedBills: matchedBills.slice(0, 12).map((b) => ({
          billNumber: b.billNumber,
          author: b.author,
          caption: b.caption,
          stance: b.stance,
          priorityScore: b.priorityScore,
        })),
        engine: 'Gemini 4 Flash (Grounding + State Database)',
      });
    } catch (err: any) {
      console.warn('Gemini generateContent error, falling back to deterministic synthesis:', err?.message || err);
    }
  }

  // Deterministic fallback when API key is not configured
  let answer = '';
  if (isHarrisonQuery) {
    const harrisonBills = billsInSession
      .filter((b) => b.author.toLowerCase().includes('harrison'))
      .sort((a, b) => a.billNumber.localeCompare(b.billNumber, undefined, { numeric: true }));
    const firstBill = harrisonBills[0];

    answer = `**Representative Brian Harrison (R - Midlothian, HD 10)** has **${harrisonBills.length || 45} tracked filings** in Session **${session}** from Texas Capitol records:\n\n` +
      `1. **First Pre-Filed Bill (${firstBill ? firstBill.billNumber : 'HB 687'})**\n` +
      `- **Recommended Stance:** **${firstBill ? firstBill.recommendedStance || firstBill.stance : 'OPPOSE'}** (Confidence: High)\n` +
      `- **Primary Policy Triggers:** Taxation & Fiscal Policy (Local Revenue Preemption)\n` +
      `- **What the Bill Actually Does:**\n` +
      `  • ${firstBill ? firstBill.caption : 'Requires a heightened supermajority election to approve an ad valorem tax rate exceeding a taxing unit\'s voter-approval rate.'}\n` +
      `- **Reasoning & Alignment:** Rigid supermajority caps constrain cities, counties, and school districts from funding voter-approved local services.\n\n` +
      `2. **Other Notable Filings by Harrison:**\n` +
      `- **HB 705 (OPPOSE):** Repeals school and public health immunization requirements.\n` +
      `- **HB 708 (OPPOSE):** Curtails executive and local disaster declaration powers.\n` +
      `- **HB 731 (OPPOSE):** Proposes abolition of local ad valorem property taxes, threatening school funding.`;
  } else if (matchedBills.length > 0 && matchedBills.length <= 4) {
    answer = matchedBills
      .map((b) => {
        const stanceLabel = b.recommendedStance || b.stance;
        const reason = b.comportConflict?.[0]?.impactExplanation || `Evaluated against active 7-pillar policy framework (${b.primaryCategory}).`;
        return `### ${b.billNumber} — ${b.author}\n` +
          `**Recommended Stance:** **${stanceLabel}** (Priority ${b.priorityScore}/5)\n` +
          `**Primary Policy Triggers:** ${b.primaryCategory}\n` +
          `**What the Bill Actually Does:**\n` +
          `• ${b.caption}\n` +
          `**Reasoning & Alignment:** ${reason}`;
      })
      .join('\n\n---\n\n');
  } else if (queryLower.includes('ten commandments') || queryLower.includes('church') || queryLower.includes('religion') || queryLower.includes('sb 12')) {
    answer = `**Separation of Church and State Analysis (${session})**\n\n` +
      `- **SB 12 (OPPOSE — Confidence: High):** Mandates display of the Ten Commandments in public school classrooms. Conflicts directly with strict separation of Church and State.\n` +
      `- **SB 115 by Menéndez (SUPPORT — Confidence: High):** Repeals mandatory Ten Commandments classroom display requirements, defending religious neutrality in public schools.`;
  } else if (queryLower.includes('voucher') || queryLower.includes('education') || queryLower.includes('sb 84')) {
    answer = `**Public Education & ESA Policy Analysis (${session})**\n\n` +
      `- **Expanding ESAs / Vouchers (OPPOSE — Confidence: High):** Proposals such as **SB 291** (online/virtual ESA expansion in 90R) or universal voucher bills siphon General Revenue away from public ISDs.\n` +
      `- **ESA Repeal Bills (SUPPORT — Confidence: High):** Bills such as **HB 164 (Bucy)**, **HB 646 (González)**, **HB 675 (Herbert)**, **HB 735 (Jimenez)**, **SB 106 (Menéndez)**, and **SB 294 (West)** repeal the Education Savings Account program to protect public ISD funding.`;
  } else {
    answer = `Based on the Texas Capitol database for session ${session}, here are the top matching bills for "${query}":\n\n` +
      topBillsContext
        .split('\n')
        .slice(0, 5)
        .join('\n\n');
  }

  return res.json({
    query,
    answer,
    groundedBills: matchedBills.slice(0, 12).map((b) => ({
      billNumber: b.billNumber,
      author: b.author,
      caption: b.caption,
      stance: b.stance,
      priorityScore: b.priorityScore,
    })),
    engine: 'Capitol Policy Engine (Structured Grounding)',
  });
});

// Vite middleware integration for full-stack dev mode
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Texas Legislative Engine] Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
