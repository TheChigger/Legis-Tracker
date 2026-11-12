import { Bill, Legislator, CommitteeMeeting, PolicyPriority, DashboardStats, SessionMetadata, SessionId } from '../types/legislative';

export const INITIAL_PRIORITIES: PolicyPriority[] = [
  {
    id: 'p1',
    title: 'Church / State Separation & Religious Neutrality',
    description: 'Ensure public schools and state agencies maintain strict religious neutrality, oppose mandatory religious displays, and prevent state-sanctioned indoctrination.',
    weight: 10,
    stanceDirective: 'Defend',
    keywords: ['ten commandments', 'chaplain', 'religious', 'bible', 'display', 'prayer', 'creed'],
    isActive: true,
  },
  {
    id: 'p2',
    title: 'Public Education Defense & Anti-Voucher Integrity',
    description: 'Oppose diversion of public tax revenue to private or religious schools via vouchers or education savings accounts (ESAs); protect ISD funding and basic allotment.',
    weight: 9,
    stanceDirective: 'Defend',
    keywords: ['voucher', 'education savings account', 'parental choice', 'instructional materials', 'school finance', 'basic allotment', 'school district', 'teacher', 'library materials'],
    isActive: true,
  },
  {
    id: 'p3',
    title: 'Healthcare Access, Reproductive Rights & Medicaid',
    description: 'Expand affordable healthcare, protect full-spectrum reproductive rights, extend Medicaid postpartum coverage, and defend public immunization standards.',
    weight: 8,
    stanceDirective: 'Promote',
    keywords: ['medicaid', 'postpartum', 'affordable care act', 'patient protection', 'immunization', 'vaccine', 'health care restriction', 'maternal', 'telehealth', 'mental health'],
    isActive: true,
  },
  {
    id: 'p4',
    title: 'Voting Rights & Civic Access',
    description: 'Protect mail-in ballots, oppose restrictive polling measures, expand automatic and online voter registration, and support independent election administration.',
    weight: 8,
    stanceDirective: 'Promote',
    keywords: ['voter registration', 'ballot', 'mail-in', 'polling location', 'county election', 'provisional ballot', 'online voter registration', 'election integrity'],
    isActive: true,
  },
  {
    id: 'p5',
    title: 'Electric Grid Weatherization & Consumer Rate Protection',
    description: 'Mandate comprehensive weatherization across gas and electric sectors, curb regressive capacity surcharges, and incentivize dispatchable clean energy.',
    weight: 7,
    stanceDirective: 'Promote',
    keywords: ['ercot', 'weatherization', 'grid', 'puc', 'transmission', 'blackout', 'dispatchable', 'ratepayer', 'power generation', 'nuclear energy', 'winter storm'],
    isActive: true,
  },
  {
    id: 'p6',
    title: 'Property Tax Relief with Progressive Distribution',
    description: 'Provide substantial homestead exemption increases and school M&O tax cuts without disproportionately defunding municipal emergency services or public schools.',
    weight: 6,
    stanceDirective: 'Promote',
    keywords: ['property tax', 'homestead exemption', 'appraisal cap', 'ad valorem', 'tax rate', 'voter-approval', 'exemption from ad valorem', 'tax relief'],
    isActive: true,
  },
];

export const SESSIONS_METADATA: SessionMetadata[] = [
  {
    "session": "90R",
    "name": "90th Regular Session",
    "years": "2027 (Current Pre-filing)",
    "conveneDate": "2027-01-12",
    "adjournDate": "2027-06-01",
    "governor": "Greg Abbott (R)",
    "speaker": "Dade Phelan (R)",
    "ltGovernor": "Dan Patrick (R)",
    "totalFiled": 1378,
    "totalPassed": 0,
    "totalVetoed": 0,
    "politicalContext": "Pre-filing opened November 9, 2026. Focus areas include school choice / ESA vouchers, property tax abolition proposals, Medicaid expansion pushes, and executive emergency disaster authorities."
  },
  {
    "session": "89R",
    "name": "89th Regular Session",
    "years": "2025",
    "conveneDate": "2025-01-14",
    "adjournDate": "2025-06-02",
    "governor": "Greg Abbott (R)",
    "speaker": "Dade Phelan (R)",
    "ltGovernor": "Dan Patrick (R)",
    "totalFiled": 11503,
    "totalPassed": 3562,
    "totalVetoed": 48,
    "politicalContext": "Debated school finance expansion (HB 2 enacted), textbook standards (HB 100 enacted), 12-month maternal Medicaid coverage (HB 12 enacted), and religious classroom displays (SB 12 passed Senate)."
  },
  {
    "session": "88R",
    "name": "88th Regular Session",
    "years": "2023",
    "conveneDate": "2023-01-10",
    "adjournDate": "2023-05-29",
    "governor": "Greg Abbott (R)",
    "speaker": "Dade Phelan (R)",
    "ltGovernor": "Dan Patrick (R)",
    "totalFiled": 11807,
    "totalPassed": 4091,
    "totalVetoed": 76,
    "politicalContext": "Historic session dominated by public school library book ratings (HB 900 READER Act), university anti-DEI bans (SB 17), Ten Commandments mandates (SB 1515), four special sessions on education savings accounts, and $18B property tax compression."
  },
  {
    "session": "87R",
    "name": "87th Regular Session",
    "years": "2021",
    "conveneDate": "2021-01-12",
    "adjournDate": "2021-05-31",
    "governor": "Greg Abbott (R)",
    "speaker": "Dade Phelan (R)",
    "ltGovernor": "Dan Patrick (R)",
    "totalFiled": 10672,
    "totalPassed": 4960,
    "totalVetoed": 50,
    "politicalContext": "Winter Storm Uri electric grid failure investigations and ERCOT mandates, permitless firearm carry (HB 1927), Texas Heartbeat Act (SB 8), election omnibus restrictions (SB 1), and pandemic executive emergency powers."
  },
  {
    "session": "86R",
    "name": "86th Regular Session",
    "years": "2019",
    "conveneDate": "2019-01-08",
    "adjournDate": "2019-05-27",
    "governor": "Greg Abbott (R)",
    "speaker": "Dennis Bonnen (R)",
    "ltGovernor": "Dan Patrick (R)",
    "totalFiled": 10877,
    "totalPassed": 4581,
    "totalVetoed": 58,
    "politicalContext": "Known as the 'Meat and Potatoes' bipartisan session. Passed monumental public school finance overhaul (HB 3) providing $11.6B in education funding and property tax rate compression, along with 3.5% property tax caps (SB 2)."
  },
  {
    "session": "85R",
    "name": "85th Regular Session",
    "years": "2017",
    "conveneDate": "2017-01-10",
    "adjournDate": "2017-05-29",
    "governor": "Greg Abbott (R)",
    "speaker": "Joe Straus (R)",
    "ltGovernor": "Dan Patrick (R)",
    "totalFiled": 10000,
    "totalPassed": 3804,
    "totalVetoed": 50,
    "politicalContext": "Fierce chamber conflicts between Straus House and Patrick Senate over the controversial 'Bathroom Bill' (SB 6), anti-sanctuary cities enforcement (SB 4), straight-ticket voting elimination (HB 25), and public school funding adequacy."
  }
];

export const MOCK_LEGISLATORS: Legislator[] = [
  {
    "id": "rep-harrison-brian",
    "name": "Harrison, Brian",
    "chamber": "House",
    "party": "R",
    "district": "HD 10 (Ellis County / Midlothian / Waxahachie)",
    "hometown": "Midlothian, TX",
    "capitolOffice": "E2.318",
    "phone": "(512) 463-0516",
    "email": "Brian.Harrison@house.texas.gov",
    "committeeAssignments": [
      "House State Affairs",
      "House Energy Resources"
    ],
    "totalBillsFiled": 123,
    "passedBills": 8,
    "alignmentScore": 14,
    "stanceBreakdown": {
      "support": 4,
      "oppose": 68,
      "neutral": 12
    },
    "keyTopics": [
      "Vaccine Mandate Repeal",
      "Executive Emergency Limits",
      "Abolition of Property Taxes",
      "Tax Rate Vote Caps",
      "Regulatory Sunset"
    ],
    "behavioralProfile": "Former Chief of Staff at the U.S. Department of Health and Human Services (HHS). Elected in a 2021 special election. Highly combative conservative floor leader who frequently opposes House leadership and omnibus budgets from the right. In the 90th pre-filing, he filed 45 bills on opening day led by HB 687 (tax rate elections), HB 705 (vaccine mandate repeal), and HB 708 (curtailing executive emergency powers).",
    "sessionsServed": [
      "90R",
      "89R",
      "88R",
      "87R"
    ],
    "historicalStats": [
      {
        "session": "90R",
        "years": "2027",
        "totalFiled": 45,
        "passedBills": 0,
        "ayeVotes": 0,
        "nayVotes": 0,
        "alignmentScore": 12
      },
      {
        "session": "89R",
        "years": "2025",
        "totalFiled": 75,
        "passedBills": 5,
        "ayeVotes": 820,
        "nayVotes": 140,
        "alignmentScore": 15
      },
      {
        "session": "88R",
        "years": "2023",
        "totalFiled": 58,
        "passedBills": 3,
        "ayeVotes": 790,
        "nayVotes": 165,
        "alignmentScore": 14
      },
      {
        "session": "87R",
        "years": "2021",
        "totalFiled": 12,
        "passedBills": 0,
        "ayeVotes": 140,
        "nayVotes": 22,
        "alignmentScore": 16
      }
    ],
    "votingRecord": [
      {
        "id": "vote-harrison-89r-hb2",
        "session": "89R",
        "billNumber": "HB 2",
        "caption": "Relating to public education and public school finance (teacher pay & basic allotment increase).",
        "recordVoteNumber": "RV#4040",
        "chamber": "House",
        "date": "2025-05-24",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 138,
        "nays": 6,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      },
      {
        "id": "vote-harrison-89r-hb12",
        "session": "89R",
        "billNumber": "HB 12",
        "caption": "Relating to 12-month Medicaid postpartum coverage for new mothers.",
        "recordVoteNumber": "RV#3901",
        "chamber": "House",
        "date": "2025-05-18",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 132,
        "nays": 8,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Healthcare & Maternal Health"
      },
      {
        "id": "vote-harrison-88r-hb900",
        "session": "88R",
        "billNumber": "HB 900",
        "caption": "Relating to the regulation of library books and materials in public schools (READER Act).",
        "recordVoteNumber": "RV#1245",
        "chamber": "House",
        "date": "2023-04-19",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 95,
        "nays": 52,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Public Education & Censorship"
      },
      {
        "id": "vote-harrison-88r-sb17",
        "session": "88R",
        "billNumber": "SB 17",
        "caption": "Prohibiting diversity, equity, and inclusion offices in public higher education.",
        "recordVoteNumber": "RV#1890",
        "chamber": "House",
        "date": "2023-05-22",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 83,
        "nays": 60,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Higher Education"
      },
      {
        "id": "vote-harrison-88r-hb1",
        "session": "88R",
        "billNumber": "HB 1",
        "caption": "General Appropriations State Budget (FY 2024-2025).",
        "recordVoteNumber": "RV#982",
        "chamber": "House",
        "date": "2023-04-06",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 142,
        "nays": 6,
        "stance": "SUPPORT",
        "alignmentWithUser": "CONTRARY",
        "topic": "State Appropriations"
      }
    ]
  },
  {
    "id": "rep-howard-donna",
    "name": "Howard, Donna",
    "chamber": "House",
    "party": "D",
    "district": "HD 48 (Travis County / Austin / West Lake Hills)",
    "hometown": "Austin, TX",
    "capitolOffice": "1W.11",
    "phone": "(512) 463-0631",
    "email": "Donna.Howard@house.texas.gov",
    "committeeAssignments": [
      "House Appropriations",
      "House State Affairs"
    ],
    "totalBillsFiled": 210,
    "passedBills": 64,
    "alignmentScore": 95,
    "stanceBreakdown": {
      "support": 142,
      "oppose": 4,
      "neutral": 14
    },
    "keyTopics": [
      "Healthcare Restrictions Repeal",
      "Maternal Healthcare",
      "Public Education Funding",
      "Higher Education"
    ],
    "behavioralProfile": "Former critical care nurse and Austin ISD trustee. Premier budget negotiator in the Texas Capitol who co-authored the landmark 12-month Medicaid postpartum expansion (HB 12) and persistently champions evidence-based healthcare, reproductive freedom, and church/state separation.",
    "sessionsServed": [
      "90R",
      "89R",
      "88R",
      "87R",
      "86R",
      "85R"
    ],
    "historicalStats": [
      {
        "session": "90R",
        "years": "2027",
        "totalFiled": 18,
        "passedBills": 0,
        "ayeVotes": 0,
        "nayVotes": 0,
        "alignmentScore": 96
      },
      {
        "session": "89R",
        "years": "2025",
        "totalFiled": 42,
        "passedBills": 14,
        "ayeVotes": 910,
        "nayVotes": 85,
        "alignmentScore": 95
      },
      {
        "session": "88R",
        "years": "2023",
        "totalFiled": 45,
        "passedBills": 12,
        "ayeVotes": 880,
        "nayVotes": 95,
        "alignmentScore": 94
      },
      {
        "session": "87R",
        "years": "2021",
        "totalFiled": 38,
        "passedBills": 11,
        "ayeVotes": 850,
        "nayVotes": 110,
        "alignmentScore": 96
      },
      {
        "session": "86R",
        "years": "2019",
        "totalFiled": 35,
        "passedBills": 15,
        "ayeVotes": 920,
        "nayVotes": 60,
        "alignmentScore": 93
      },
      {
        "session": "85R",
        "years": "2017",
        "totalFiled": 32,
        "passedBills": 12,
        "ayeVotes": 840,
        "nayVotes": 90,
        "alignmentScore": 95
      }
    ],
    "votingRecord": [
      {
        "id": "vote-howard-89r-hb12",
        "session": "89R",
        "billNumber": "HB 12",
        "caption": "Relating to 12-month Medicaid postpartum coverage for new mothers.",
        "recordVoteNumber": "RV#3901",
        "chamber": "House",
        "date": "2025-05-18",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 132,
        "nays": 8,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Healthcare & Maternal Health"
      },
      {
        "id": "vote-howard-89r-hb2",
        "session": "89R",
        "billNumber": "HB 2",
        "caption": "Public school finance reform and basic allotment increase.",
        "recordVoteNumber": "RV#4040",
        "chamber": "House",
        "date": "2025-05-24",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 138,
        "nays": 6,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      },
      {
        "id": "vote-howard-88r-hb900",
        "session": "88R",
        "billNumber": "HB 900",
        "caption": "Regulation of library books and materials in public schools (READER Act).",
        "recordVoteNumber": "RV#1245",
        "chamber": "House",
        "date": "2023-04-19",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 95,
        "nays": 52,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public Education & Civil Rights"
      },
      {
        "id": "vote-howard-88r-sb17",
        "session": "88R",
        "billNumber": "SB 17",
        "caption": "Prohibiting diversity, equity, and inclusion offices in public higher education.",
        "recordVoteNumber": "RV#1890",
        "chamber": "House",
        "date": "2023-05-22",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 83,
        "nays": 60,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Higher Education"
      },
      {
        "id": "vote-howard-87r-sb1",
        "session": "87R",
        "billNumber": "SB 1",
        "caption": "Election integrity restrictions on mail-in voting and poll watchers.",
        "recordVoteNumber": "RV#2214",
        "chamber": "House",
        "date": "2021-08-30",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 80,
        "nays": 41,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Voting Rights"
      },
      {
        "id": "vote-howard-86r-hb3",
        "session": "86R",
        "billNumber": "HB 3",
        "caption": "Historic public school finance reform ($11.6B investment) and property tax compression.",
        "recordVoteNumber": "RV#3100",
        "chamber": "House",
        "date": "2019-04-27",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 149,
        "nays": 0,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      },
      {
        "id": "vote-howard-85r-sb4",
        "session": "85R",
        "billNumber": "SB 4",
        "caption": "Prohibiting sanctuary cities and mandating local ICE compliance.",
        "recordVoteNumber": "RV#1420",
        "chamber": "House",
        "date": "2017-04-27",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 94,
        "nays": 53,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Civil Rights & Local Governance"
      }
    ]
  },
  {
    "id": "sen-hughes-bryan",
    "name": "Hughes, Bryan",
    "chamber": "Senate",
    "party": "R",
    "district": "SD 1 (East Texas / Mineola / Tyler / Texarkana)",
    "hometown": "Mineola, TX",
    "capitolOffice": "3E.8",
    "phone": "(512) 463-0101",
    "email": "Bryan.Hughes@senate.texas.gov",
    "committeeAssignments": [
      "Senate State Affairs (Chair)",
      "Senate Jurisprudence",
      "Senate Nominations"
    ],
    "totalBillsFiled": 240,
    "passedBills": 88,
    "alignmentScore": 18,
    "stanceBreakdown": {
      "support": 14,
      "oppose": 135,
      "neutral": 18
    },
    "keyTopics": [
      "Religious Displays",
      "Election Oversight",
      "Judicial Selection",
      "Social Conservatism"
    ],
    "behavioralProfile": "Chair of the Senate State Affairs Committee and conservative powerhouse in the upper chamber. Primary sponsor of landmark conservative social legislation including SB 12 / SB 1515 (Ten Commandments in public school classrooms), SB 1 (2021 election integrity omnibus), and SB 8 (Texas Heartbeat Act).",
    "sessionsServed": [
      "90R",
      "89R",
      "88R",
      "87R",
      "86R",
      "85R"
    ],
    "historicalStats": [
      {
        "session": "90R",
        "years": "2027",
        "totalFiled": 14,
        "passedBills": 0,
        "ayeVotes": 0,
        "nayVotes": 0,
        "alignmentScore": 18
      },
      {
        "session": "89R",
        "years": "2025",
        "totalFiled": 58,
        "passedBills": 22,
        "ayeVotes": 620,
        "nayVotes": 42,
        "alignmentScore": 18
      },
      {
        "session": "88R",
        "years": "2023",
        "totalFiled": 54,
        "passedBills": 24,
        "ayeVotes": 640,
        "nayVotes": 38,
        "alignmentScore": 16
      },
      {
        "session": "87R",
        "years": "2021",
        "totalFiled": 48,
        "passedBills": 19,
        "ayeVotes": 610,
        "nayVotes": 45,
        "alignmentScore": 15
      },
      {
        "session": "86R",
        "years": "2019",
        "totalFiled": 36,
        "passedBills": 14,
        "ayeVotes": 590,
        "nayVotes": 30,
        "alignmentScore": 22
      },
      {
        "session": "85R",
        "years": "2017",
        "totalFiled": 30,
        "passedBills": 9,
        "ayeVotes": 580,
        "nayVotes": 35,
        "alignmentScore": 18
      }
    ],
    "votingRecord": [
      {
        "id": "vote-hughes-89r-sb12",
        "session": "89R",
        "billNumber": "SB 12",
        "caption": "Mandatory prominent display of Ten Commandments in public schools.",
        "recordVoteNumber": "Senate Floor Vote",
        "chamber": "Senate",
        "date": "2025-04-18",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 17,
        "nays": 12,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Church / State Separation"
      },
      {
        "id": "vote-hughes-88r-sb1515",
        "session": "88R",
        "billNumber": "SB 1515",
        "caption": "Display of the Ten Commandments in public school classrooms.",
        "recordVoteNumber": "Senate Floor Vote",
        "chamber": "Senate",
        "date": "2023-04-20",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 17,
        "nays": 12,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Church / State Separation"
      },
      {
        "id": "vote-hughes-87r-sb1",
        "session": "87R",
        "billNumber": "SB 1",
        "caption": "Omnibus election integrity and mail-in ballot restriction act.",
        "recordVoteNumber": "RV#1105",
        "chamber": "Senate",
        "date": "2021-07-13",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 18,
        "nays": 11,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Voting Rights"
      },
      {
        "id": "vote-hughes-86r-hb3",
        "session": "86R",
        "billNumber": "HB 3",
        "caption": "Public school finance reform and $5B property tax compression.",
        "recordVoteNumber": "Senate Floor Vote",
        "chamber": "Senate",
        "date": "2019-05-21",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 31,
        "nays": 0,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      },
      {
        "id": "vote-hughes-85r-sb6",
        "session": "85R",
        "billNumber": "SB 6",
        "caption": "Public facilities bathroom privacy bill based on biological sex.",
        "recordVoteNumber": "Senate Floor Vote",
        "chamber": "Senate",
        "date": "2017-03-15",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 21,
        "nays": 10,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Civil Rights & Public Facilities"
      }
    ]
  },
  {
    "id": "rep-burrows-dustin",
    "name": "Burrows, Dustin",
    "chamber": "House",
    "party": "R",
    "district": "HD 83 (Lubbock / South Plains)",
    "hometown": "Lubbock, TX",
    "capitolOffice": "GW.12",
    "phone": "(512) 463-0542",
    "email": "Dustin.Burrows@house.texas.gov",
    "committeeAssignments": [
      "House Calendars (Chair)",
      "House State Affairs",
      "House Ways & Means"
    ],
    "totalBillsFiled": 184,
    "passedBills": 62,
    "alignmentScore": 48,
    "stanceBreakdown": {
      "support": 38,
      "oppose": 45,
      "neutral": 15
    },
    "keyTopics": [
      "Property Tax Relief",
      "State Regulatory Consistency",
      "Agriculture",
      "Water Resources"
    ],
    "behavioralProfile": "Chairman of House Calendars. Establishment strategist who orchestrated landmark state regulatory consistency preemption laws, major property tax compression compromises, and served as chief House floor manager for pivotal bipartisan education funding measures.",
    "sessionsServed": [
      "90R",
      "89R",
      "88R",
      "87R",
      "86R",
      "85R"
    ],
    "historicalStats": [
      {
        "session": "90R",
        "years": "2027",
        "totalFiled": 12,
        "passedBills": 0,
        "ayeVotes": 0,
        "nayVotes": 0,
        "alignmentScore": 48
      },
      {
        "session": "89R",
        "years": "2025",
        "totalFiled": 31,
        "passedBills": 14,
        "ayeVotes": 880,
        "nayVotes": 70,
        "alignmentScore": 50
      },
      {
        "session": "88R",
        "years": "2023",
        "totalFiled": 38,
        "passedBills": 16,
        "ayeVotes": 850,
        "nayVotes": 75,
        "alignmentScore": 46
      },
      {
        "session": "87R",
        "years": "2021",
        "totalFiled": 35,
        "passedBills": 12,
        "ayeVotes": 830,
        "nayVotes": 65,
        "alignmentScore": 45
      },
      {
        "session": "86R",
        "years": "2019",
        "totalFiled": 36,
        "passedBills": 11,
        "ayeVotes": 910,
        "nayVotes": 40,
        "alignmentScore": 54
      },
      {
        "session": "85R",
        "years": "2017",
        "totalFiled": 32,
        "passedBills": 9,
        "ayeVotes": 820,
        "nayVotes": 50,
        "alignmentScore": 46
      }
    ],
    "votingRecord": [
      {
        "id": "vote-burrows-89r-hb2",
        "session": "89R",
        "billNumber": "HB 2",
        "caption": "Public school finance reform and basic allotment increase.",
        "recordVoteNumber": "RV#4040",
        "chamber": "House",
        "date": "2025-05-24",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 138,
        "nays": 6,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      },
      {
        "id": "vote-burrows-88r-hb900",
        "session": "88R",
        "billNumber": "HB 900",
        "caption": "Regulation of library books and materials in public schools (READER Act).",
        "recordVoteNumber": "RV#1245",
        "chamber": "House",
        "date": "2023-04-19",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 95,
        "nays": 52,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Public Education & Civil Rights"
      },
      {
        "id": "vote-burrows-86r-hb3",
        "session": "86R",
        "billNumber": "HB 3",
        "caption": "Historic public school finance reform and property tax compression.",
        "recordVoteNumber": "RV#3100",
        "chamber": "House",
        "date": "2019-04-27",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 149,
        "nays": 0,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      },
      {
        "id": "vote-burrows-86r-sb2",
        "session": "86R",
        "billNumber": "SB 2",
        "caption": "Property tax cap of 3.5% on cities and counties.",
        "recordVoteNumber": "RV#2890",
        "chamber": "House",
        "date": "2019-05-20",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 88,
        "nays": 61,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Property Tax"
      },
      {
        "id": "vote-burrows-85r-sb4",
        "session": "85R",
        "billNumber": "SB 4",
        "caption": "Prohibiting sanctuary cities and mandating ICE detainer compliance.",
        "recordVoteNumber": "RV#1420",
        "chamber": "House",
        "date": "2017-04-27",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 94,
        "nays": 53,
        "stance": "OPPOSE",
        "alignmentWithUser": "CONTRARY",
        "topic": "Civil Rights & Local Governance"
      }
    ]
  },
  {
    "id": "rep-bucy-john",
    "name": "Bucy, John",
    "chamber": "House",
    "party": "D",
    "district": "HD 136 (Williamson County / Austin / Cedar Park)",
    "hometown": "Austin, TX",
    "capitolOffice": "E2.704",
    "phone": "(512) 463-0696",
    "email": "John.Bucy@house.texas.gov",
    "committeeAssignments": [
      "House Elections",
      "House Transportation"
    ],
    "totalBillsFiled": 115,
    "passedBills": 28,
    "alignmentScore": 94,
    "stanceBreakdown": {
      "support": 82,
      "oppose": 2,
      "neutral": 8
    },
    "keyTopics": [
      "Medicaid Expansion",
      "Voting Rights",
      "Public Transportation",
      "Special Education"
    ],
    "behavioralProfile": "Author of HB 101 in the 90th Session to expand Medicaid coverage under the ACA. Tenacious floor advocate for expanding voter registration and defending public education from voucher programs.",
    "sessionsServed": [
      "90R",
      "89R",
      "88R",
      "87R",
      "86R"
    ],
    "historicalStats": [
      {
        "session": "90R",
        "years": "2027",
        "totalFiled": 15,
        "passedBills": 0,
        "ayeVotes": 0,
        "nayVotes": 0,
        "alignmentScore": 96
      },
      {
        "session": "89R",
        "years": "2025",
        "totalFiled": 28,
        "passedBills": 7,
        "ayeVotes": 890,
        "nayVotes": 80,
        "alignmentScore": 95
      },
      {
        "session": "88R",
        "years": "2023",
        "totalFiled": 26,
        "passedBills": 8,
        "ayeVotes": 870,
        "nayVotes": 90,
        "alignmentScore": 94
      },
      {
        "session": "87R",
        "years": "2021",
        "totalFiled": 24,
        "passedBills": 6,
        "ayeVotes": 840,
        "nayVotes": 95,
        "alignmentScore": 95
      },
      {
        "session": "86R",
        "years": "2019",
        "totalFiled": 22,
        "passedBills": 7,
        "ayeVotes": 900,
        "nayVotes": 50,
        "alignmentScore": 93
      }
    ],
    "votingRecord": [
      {
        "id": "vote-bucy-89r-hb2",
        "session": "89R",
        "billNumber": "HB 2",
        "caption": "Public school finance reform and basic allotment increase.",
        "recordVoteNumber": "RV#4040",
        "chamber": "House",
        "date": "2025-05-24",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 138,
        "nays": 6,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      },
      {
        "id": "vote-bucy-88r-hb900",
        "session": "88R",
        "billNumber": "HB 900",
        "caption": "Regulation of library books and materials in public schools (READER Act).",
        "recordVoteNumber": "RV#1245",
        "chamber": "House",
        "date": "2023-04-19",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 95,
        "nays": 52,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public Education & Civil Rights"
      },
      {
        "id": "vote-bucy-87r-sb1",
        "session": "87R",
        "billNumber": "SB 1",
        "caption": "Election integrity restrictions on mail-in voting and poll watchers.",
        "recordVoteNumber": "RV#2214",
        "chamber": "House",
        "date": "2021-08-30",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 80,
        "nays": 41,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Voting Rights"
      },
      {
        "id": "vote-bucy-86r-hb3",
        "session": "86R",
        "billNumber": "HB 3",
        "caption": "Historic public school finance reform ($11.6B investment).",
        "recordVoteNumber": "RV#3100",
        "chamber": "House",
        "date": "2019-04-27",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 149,
        "nays": 0,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      }
    ]
  },
  {
    "id": "sen-zaffirini-judith",
    "name": "Zaffirini, Judith",
    "chamber": "Senate",
    "party": "D",
    "district": "SD 21 (Laredo / San Antonio / South Texas)",
    "hometown": "Laredo, TX",
    "capitolOffice": "1E.14",
    "phone": "(512) 463-0121",
    "email": "Judith.Zaffirini@senate.texas.gov",
    "committeeAssignments": [
      "Senate State Affairs",
      "Senate Natural Resources & Economic Development"
    ],
    "totalBillsFiled": 310,
    "passedBills": 142,
    "alignmentScore": 92,
    "stanceBreakdown": {
      "support": 160,
      "oppose": 12,
      "neutral": 20
    },
    "keyTopics": [
      "Medicaid Expansion",
      "Higher Education",
      "Child Welfare",
      "Government Transparency"
    ],
    "behavioralProfile": "Dean of the Texas Senate and President Pro Tempore. Renowned for cast-iron discipline and perfect voting record spanning tens of thousands of consecutive roll calls. Authored SB 31 in 90R for Medicaid expansion and consistently defends public education and reproductive health.",
    "sessionsServed": [
      "90R",
      "89R",
      "88R",
      "87R",
      "86R",
      "85R"
    ],
    "historicalStats": [
      {
        "session": "90R",
        "years": "2027",
        "totalFiled": 22,
        "passedBills": 0,
        "ayeVotes": 0,
        "nayVotes": 0,
        "alignmentScore": 94
      },
      {
        "session": "89R",
        "years": "2025",
        "totalFiled": 64,
        "passedBills": 28,
        "ayeVotes": 640,
        "nayVotes": 45,
        "alignmentScore": 92
      },
      {
        "session": "88R",
        "years": "2023",
        "totalFiled": 60,
        "passedBills": 30,
        "ayeVotes": 630,
        "nayVotes": 50,
        "alignmentScore": 91
      },
      {
        "session": "87R",
        "years": "2021",
        "totalFiled": 58,
        "passedBills": 26,
        "ayeVotes": 615,
        "nayVotes": 55,
        "alignmentScore": 92
      },
      {
        "session": "86R",
        "years": "2019",
        "totalFiled": 54,
        "passedBills": 31,
        "ayeVotes": 620,
        "nayVotes": 35,
        "alignmentScore": 93
      },
      {
        "session": "85R",
        "years": "2017",
        "totalFiled": 52,
        "passedBills": 27,
        "ayeVotes": 600,
        "nayVotes": 45,
        "alignmentScore": 91
      }
    ],
    "votingRecord": [
      {
        "id": "vote-zaffirini-89r-sb12",
        "session": "89R",
        "billNumber": "SB 12",
        "caption": "Ten Commandments classroom display mandate.",
        "recordVoteNumber": "Senate Floor Vote",
        "chamber": "Senate",
        "date": "2025-04-18",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 17,
        "nays": 12,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Church / State Separation"
      },
      {
        "id": "vote-zaffirini-88r-sb1515",
        "session": "88R",
        "billNumber": "SB 1515",
        "caption": "Ten Commandments classroom display mandate.",
        "recordVoteNumber": "Senate Floor Vote",
        "chamber": "Senate",
        "date": "2023-04-20",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 17,
        "nays": 12,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Church / State Separation"
      },
      {
        "id": "vote-zaffirini-87r-sb1",
        "session": "87R",
        "billNumber": "SB 1",
        "caption": "Election omnibus voting restrictions.",
        "recordVoteNumber": "RV#1105",
        "chamber": "Senate",
        "date": "2021-07-13",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 18,
        "nays": 11,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Voting Rights"
      },
      {
        "id": "vote-zaffirini-86r-hb3",
        "session": "86R",
        "billNumber": "HB 3",
        "caption": "Public school finance reform ($11.6B investment).",
        "recordVoteNumber": "Senate Floor Vote",
        "chamber": "Senate",
        "date": "2019-05-21",
        "voteCast": "Aye",
        "overallResult": "Passed",
        "ayes": 31,
        "nays": 0,
        "stance": "SUPPORT",
        "alignmentWithUser": "ALIGNED",
        "topic": "Public School Finance"
      },
      {
        "id": "vote-zaffirini-85r-sb6",
        "session": "85R",
        "billNumber": "SB 6",
        "caption": "Bathroom bill restricting public restroom access.",
        "recordVoteNumber": "Senate Floor Vote",
        "chamber": "Senate",
        "date": "2017-03-15",
        "voteCast": "Nay",
        "overallResult": "Passed",
        "ayes": 21,
        "nays": 10,
        "stance": "OPPOSE",
        "alignmentWithUser": "ALIGNED",
        "topic": "Civil Rights"
      }
    ]
  }
];

export const MOCK_COMMITTEE_MEETINGS: CommitteeMeeting[] = [
  {
    id: 'cm-1',
    committeeName: 'House State Affairs',
    chamber: 'House',
    meetingDate: '2026-11-18',
    meetingTime: '10:30 AM',
    location: 'Room E2.010, Capitol Extension',
    status: 'Scheduled',
    agendaBills: ['HB 687', 'HB 695', 'HB 708'],
    witnessRegistrationOpen: true,
    minutesSummary: 'Organizational hearing scheduled on pre-filed measures regarding regulatory agency sunset and disaster emergency powers. Witness portal open for online public testimony registration.',
  },
  {
    id: 'cm-2',
    committeeName: 'Senate State Affairs',
    chamber: 'Senate',
    meetingDate: '2026-11-19',
    meetingTime: '9:00 AM',
    location: 'Senate Chamber / Capitol E1.036',
    status: 'Scheduled',
    agendaBills: ['SB 31'],
    witnessRegistrationOpen: true,
    minutesSummary: 'Hearing scheduled on Medicaid expansion proposals under federal ACA Title XIX matching guidelines (SB 31 by Zaffirini).',
  },
  {
    id: 'cm-3',
    committeeName: 'House Public Education',
    chamber: 'House',
    meetingDate: '2026-11-20',
    meetingTime: '8:00 AM',
    location: 'Room E2.036, Capitol Extension',
    status: 'Scheduled',
    agendaBills: ['HB 101', 'HB 126'],
    witnessRegistrationOpen: true,
    minutesSummary: 'Hearing on public school healthcare safety nets and curriculum support.',
  }
];

export const HISTORICAL_STATS_MAP: Record<SessionId, DashboardStats> = {
  "90R": {
    "session": "90R",
    "totalTrackedBills": 1378,
    "totalVersions": 1498,
    "uniqueAuthors": 180,
    "urgentBillsToday": 14,
    "stanceBreakdown": {
      "support": 310,
      "oppose": 420,
      "neutral": 648
    },
    "topCategories": [
      {
        "category": "Healthcare Access & Medicaid",
        "count": 184
      },
      {
        "category": "Property Tax & Revenue",
        "count": 142
      },
      {
        "category": "Public Health Regulations",
        "count": 96
      },
      {
        "category": "Public Education & School Finance",
        "count": 88
      },
      {
        "category": "Executive Powers & State Governance",
        "count": 74
      }
    ]
  },
  "89R": {
    "session": "89R",
    "totalTrackedBills": 11503,
    "totalVersions": 18420,
    "uniqueAuthors": 181,
    "urgentBillsToday": 0,
    "stanceBreakdown": {
      "support": 2140,
      "oppose": 3410,
      "neutral": 5953
    },
    "topCategories": [
      {
        "category": "Public Education & School Finance",
        "count": 1890
      },
      {
        "category": "Healthcare Access & Medicaid",
        "count": 1420
      },
      {
        "category": "Property Tax & Revenue",
        "count": 1240
      },
      {
        "category": "Church / State & First Amendment",
        "count": 870
      },
      {
        "category": "Electric Grid & Energy Reliability",
        "count": 760
      }
    ]
  },
  "88R": {
    "session": "88R",
    "totalTrackedBills": 11807,
    "totalVersions": 19200,
    "uniqueAuthors": 181,
    "urgentBillsToday": 0,
    "stanceBreakdown": {
      "support": 1980,
      "oppose": 3620,
      "neutral": 6207
    },
    "topCategories": [
      {
        "category": "Public Education & Civil Rights",
        "count": 1920
      },
      {
        "category": "Church / State & First Amendment",
        "count": 940
      },
      {
        "category": "Higher Education & DEI Bans",
        "count": 890
      },
      {
        "category": "Property Tax Compression",
        "count": 1410
      },
      {
        "category": "Healthcare & Postpartum Medicaid",
        "count": 1150
      }
    ]
  },
  "87R": {
    "session": "87R",
    "totalTrackedBills": 10672,
    "totalVersions": 17800,
    "uniqueAuthors": 181,
    "urgentBillsToday": 0,
    "stanceBreakdown": {
      "support": 1850,
      "oppose": 3540,
      "neutral": 5282
    },
    "topCategories": [
      {
        "category": "Voting Rights & Elections",
        "count": 1240
      },
      {
        "category": "Electric Grid & Winter Storm Uri",
        "count": 1150
      },
      {
        "category": "Second Amendment & Permitless Carry",
        "count": 780
      },
      {
        "category": "Public Health & Pandemic Powers",
        "count": 920
      }
    ]
  },
  "86R": {
    "session": "86R",
    "totalTrackedBills": 10877,
    "totalVersions": 18100,
    "uniqueAuthors": 181,
    "urgentBillsToday": 0,
    "stanceBreakdown": {
      "support": 2350,
      "oppose": 2890,
      "neutral": 5637
    },
    "topCategories": [
      {
        "category": "Public School Finance (HB 3)",
        "count": 1780
      },
      {
        "category": "Property Tax Reform (SB 2)",
        "count": 1450
      },
      {
        "category": "Healthcare & Telemedicine",
        "count": 1050
      },
      {
        "category": "Teacher Retirement System",
        "count": 680
      }
    ]
  },
  "85R": {
    "session": "85R",
    "totalTrackedBills": 10000,
    "totalVersions": 16900,
    "uniqueAuthors": 181,
    "urgentBillsToday": 0,
    "stanceBreakdown": {
      "support": 1650,
      "oppose": 3280,
      "neutral": 5070
    },
    "topCategories": [
      {
        "category": "Immigration & Sanctuary Cities (SB 4)",
        "count": 1340
      },
      {
        "category": "Civil Rights & Bathroom Bill (SB 6)",
        "count": 910
      },
      {
        "category": "Voting & Straight-Ticket Elimination",
        "count": 820
      },
      {
        "category": "Public School Funding Adequacy",
        "count": 1240
      }
    ]
  }
};

export const MOCK_STATS_90R: DashboardStats = HISTORICAL_STATS_MAP['90R'];
export const MOCK_STATS_89R: DashboardStats = HISTORICAL_STATS_MAP['89R'];
export const MOCK_STATS_88R: DashboardStats = HISTORICAL_STATS_MAP['88R'];
export const MOCK_STATS_87R: DashboardStats = HISTORICAL_STATS_MAP['87R'];
export const MOCK_STATS_86R: DashboardStats = HISTORICAL_STATS_MAP['86R'];
export const MOCK_STATS_85R: DashboardStats = HISTORICAL_STATS_MAP['85R'];

import realBillsJson from './realBills.json';
export const MOCK_BILLS: Bill[] = realBillsJson as unknown as Bill[];
