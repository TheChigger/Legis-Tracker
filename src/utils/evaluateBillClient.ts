import { Bill, PolicyPriority, PriorityScore } from '../types/legislative';

/**
 * Pure, immutable direction-aware evaluator against the 8-pillar policy matrix
 * and any user-added custom priorities. Safe to run on both server and client.
 */
export function reevaluateBillClient(
  bill: Bill,
  priorities: PolicyPriority[],
  forceRecalculate = false
): Bill {
  // Preserve v2 AI evaluations unless explicitly recalculated against custom priorities
  if (!forceRecalculate && bill.aiEnriched && (bill.aiRubricVersion ?? 1) >= 2) {
    return bill;
  }

  const nextBill: Bill = { ...bill };
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

  // 7. Second Amendment & Practical Gun Safety (NUANCED)
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

  nextBill.comportConflict = matches;
  if (detectedCategory) {
    nextBill.primaryCategory = detectedCategory;
  }

  if (totalConflictScore > totalComportScore && totalConflictScore >= 8) {
    nextBill.stance = 'OPPOSE';
    nextBill.recommendedStance = 'OPPOSE';
    nextBill.priorityScore = Math.min(5, Math.max(3, Math.round(totalConflictScore / 3))) as PriorityScore;
    nextBill.urgencyLevel = nextBill.priorityScore === 5 ? 'Immediate Attention' : 'High Watch';
  } else if (totalComportScore > totalConflictScore && totalComportScore >= 7) {
    nextBill.stance = 'SUPPORT';
    nextBill.recommendedStance = 'SUPPORT';
    nextBill.priorityScore = Math.min(5, Math.max(3, Math.round(totalComportScore / 3))) as PriorityScore;
    nextBill.urgencyLevel = nextBill.priorityScore === 5 ? 'Immediate Attention' : 'High Watch';
  } else if (forceNeedsReview) {
    nextBill.stance = 'NEUTRAL';
    nextBill.recommendedStance = 'NEEDS REVIEW';
    nextBill.priorityScore = 3;
    nextBill.urgencyLevel = 'Moderate';
  } else {
    nextBill.stance = 'NEUTRAL';
    nextBill.recommendedStance = undefined;
    nextBill.priorityScore = Math.min(2, bill.priorityScore || 2) as PriorityScore;
    nextBill.urgencyLevel = 'Routine';
  }

  return nextBill;
}
