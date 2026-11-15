import {
  Bill,
  Chamber,
  HistoricalVote,
  Legislator,
  LegislatorSessionStats,
  SessionId,
} from '../types/legislative';

export type TloKeyRule = string | { key: string; chamber?: Chamber };

export interface LawmakerRosterSpec {
  id: string;
  name: string;
  chamber: Chamber;
  party: 'R' | 'D' | 'I';
  district: string;
  hometown: string;
  tloKeys: TloKeyRule[];
  committeeAssignments?: string[];
  roleNote?: string;
}

const SESSION_ORDER: SessionId[] = ['90R', '89R', '88R', '87R', '86R', '85R'];

const SESSION_YEARS: Record<SessionId, string> = {
  '90R': '2027',
  '89R': '2025',
  '88R': '2023',
  '87R': '2021',
  '86R': '2019',
  '85R': '2017',
};

/**
 * Normalize a TLO author/coauthor token or search string so accented characters
 * (e.g. "Anchía", "Gámez", "González", "Menéndez", "Muñoz", "Rodríguez")
 * match deterministically regardless of diacritic input.
 */
export function normalizeTloToken(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Extract all individual author and coauthor tokens from a Bill record.
 */
export function extractBillAuthorTokens(bill: Pick<Bill, 'author' | 'coauthors'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const rawParts = [
    ...(bill.author || '').split('|'),
    ...((bill.coauthors || []) as string[]),
  ];

  for (const raw of rawParts) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) continue;
    const norm = normalizeTloToken(trimmed);
    if (!norm || norm === 'et al.' || norm === 'et al') continue;
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/**
 * Verified Texas Legislature roster mapping all active 90R lawmakers and
 * historical 85R-89R sponsors/authors present in TLO filings.
 */
export const TEXAS_LAWMAKER_ROSTER: LawmakerRosterSpec[] = [
  // ======================== TEXAS SENATE ========================
  {
    id: 'sen-alvarado-carol',
    name: 'Alvarado, Carol',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 6',
    hometown: 'Houston',
    tloKeys: ['Alvarado', 'Alvarado, Carol'],
  },
  {
    id: 'sen-ashby-trent',
    name: 'Ashby, Trent',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 3',
    hometown: 'Lufkin',
    tloKeys: ['Ashby', 'Ashby, Trent'],
    roleNote: 'Elected to Senate SD 3 in Nov 2026 (previously served in TX House HD 9).',
  },
  {
    id: 'sen-bettencourt-paul',
    name: 'Bettencourt, Paul',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 7',
    hometown: 'Houston',
    tloKeys: ['Bettencourt', 'Bettencourt, Paul'],
  },
  {
    id: 'sen-blanco-cesar',
    name: 'Blanco, César',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 29',
    hometown: 'El Paso',
    tloKeys: ['Blanco', 'Blanco, César'],
  },
  {
    id: 'sen-campbell-donna',
    name: 'Campbell, Donna',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 25',
    hometown: 'New Braunfels',
    tloKeys: ['Campbell', 'Campbell, Donna'],
  },
  {
    id: 'sen-cook-david',
    name: 'Cook, David',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 22',
    hometown: 'Mansfield',
    tloKeys: ['Cook, David', { key: 'Cook', chamber: 'House' }],
    roleNote: 'Elected to Senate SD 22 in Nov 2026 (previously served in TX House HD 96).',
  },
  {
    id: 'sen-cook-molly',
    name: 'Cook, Molly',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 15',
    hometown: 'Houston',
    tloKeys: ['Cook, Molly'],
  },
  {
    id: 'sen-creighton-brandon',
    name: 'Creighton, Brandon',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 4',
    hometown: 'Conroe',
    tloKeys: ['Creighton', 'Creighton, Brandon'],
    roleNote: 'Former TX Senator for SD 4 (85R-89R).',
  },
  {
    id: 'sen-flores-pete',
    name: 'Flores, Pete',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 24',
    hometown: 'Pleasanton',
    tloKeys: [{ key: 'Flores', chamber: 'Senate' }, 'Flores, Pete'],
  },
  {
    id: 'sen-gutierrez-roland',
    name: 'Gutierrez, Roland',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 19',
    hometown: 'San Antonio',
    tloKeys: ['Gutierrez', 'Gutierrez, Roland'],
  },
  {
    id: 'sen-hagenbuch-brent',
    name: 'Hagenbuch, Brent',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 30',
    hometown: 'Denton',
    tloKeys: ['Hagenbuch', 'Hagenbuch, Brent'],
  },
  {
    id: 'sen-hall-bob',
    name: 'Hall, Bob',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 2',
    hometown: 'Edgewood',
    tloKeys: ['Hall', 'Hall, Bob'],
  },
  {
    id: 'sen-hinojosa-adam',
    name: 'Hinojosa, Adam',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 27',
    hometown: 'Corpus Christi',
    tloKeys: ['Hinojosa, Adam'],
  },
  {
    id: 'sen-hinojosa-juan',
    name: 'Hinojosa, Juan "Chuy"',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 20',
    hometown: 'McAllen',
    tloKeys: ['Hinojosa, Juan "Chuy"'],
  },
  {
    id: 'sen-huffman-joan',
    name: 'Huffman, Joan',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 17',
    hometown: 'Houston',
    tloKeys: ['Huffman', 'Huffman, Joan'],
  },
  {
    id: 'sen-hughes-bryan',
    name: 'Hughes, Bryan',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 1',
    hometown: 'Mineola',
    tloKeys: ['Hughes', 'Hughes, Bryan'],
  },
  {
    id: 'sen-kolkhorst-lois',
    name: 'Kolkhorst, Lois',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 18',
    hometown: 'Brenham',
    tloKeys: ['Kolkhorst', 'Kolkhorst, Lois'],
  },
  {
    id: 'sen-ligon-brett',
    name: 'Ligon, Brett',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 4',
    hometown: 'Conroe',
    tloKeys: ['Ligon', 'Ligon, Brett'],
  },
  {
    id: 'sen-menendez-jose',
    name: 'Menéndez, José',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 26',
    hometown: 'San Antonio',
    tloKeys: ['Menéndez', 'Menéndez, José'],
  },
  {
    id: 'sen-miles-borris',
    name: 'Miles, Borris',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 13',
    hometown: 'Houston',
    tloKeys: ['Miles', 'Miles, Borris'],
  },
  {
    id: 'sen-parker-tan',
    name: 'Parker, Tan',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 12',
    hometown: 'Flower Mound',
    tloKeys: ['Parker', 'Parker, Tan'],
  },
  {
    id: 'sen-paul-dennis',
    name: 'Paul, Dennis',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 11',
    hometown: 'Webster',
    tloKeys: ['Paul', 'Paul, Dennis'],
  },
  {
    id: 'sen-paxton-angela',
    name: 'Paxton, Angela',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 8',
    hometown: 'McKinney',
    tloKeys: ['Paxton', 'Paxton, Angela'],
  },
  {
    id: 'sen-perry-charles',
    name: 'Perry, Charles',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 28',
    hometown: 'Lubbock',
    tloKeys: ['Perry', 'Perry, Charles'],
  },
  {
    id: 'sen-rehmet-taylor',
    name: 'Rehmet, Taylor',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 9',
    hometown: 'Fort Worth',
    tloKeys: ['Rehmet', 'Rehmet, Taylor'],
  },
  {
    id: 'sen-sparks-kevin',
    name: 'Sparks, Kevin',
    chamber: 'Senate',
    party: 'R',
    district: 'SD 31',
    hometown: 'Midland',
    tloKeys: ['Sparks', 'Sparks, Kevin'],
  },
  {
    id: 'sen-west-royce',
    name: 'West, Royce',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 23',
    hometown: 'Dallas',
    tloKeys: ['West', 'West, Royce'],
  },
  {
    id: 'sen-zaffirini-judith',
    name: 'Zaffirini, Judith',
    chamber: 'Senate',
    party: 'D',
    district: 'SD 21',
    hometown: 'Laredo',
    tloKeys: ['Zaffirini', 'Zaffirini, Judith'],
  },

  // ======================== TEXAS HOUSE ========================
  {
    id: 'rep-anchia-rafael',
    name: 'Anchía, Rafael',
    chamber: 'House',
    party: 'D',
    district: 'HD 103',
    hometown: 'Dallas',
    tloKeys: ['Anchía', 'Anchía, Rafael'],
  },
  {
    id: 'rep-barry-jeff',
    name: 'Barry, Jeff',
    chamber: 'House',
    party: 'R',
    district: 'HD 29',
    hometown: 'Pearland',
    tloKeys: ['Barry', 'Barry, Jeff'],
  },
  {
    id: 'rep-bell-cecil',
    name: 'Bell, Cecil',
    chamber: 'House',
    party: 'R',
    district: 'HD 3',
    hometown: 'Magnolia',
    tloKeys: ['Bell, Cecil'],
  },
  {
    id: 'rep-bell-keith',
    name: 'Bell, Keith',
    chamber: 'House',
    party: 'R',
    district: 'HD 4',
    hometown: 'Forney',
    tloKeys: ['Bell, Keith'],
  },
  {
    id: 'rep-bernal-diego',
    name: 'Bernal, Diego',
    chamber: 'House',
    party: 'D',
    district: 'HD 123',
    hometown: 'San Antonio',
    tloKeys: ['Bernal', 'Bernal, Diego'],
  },
  {
    id: 'rep-bhojani-salman',
    name: 'Bhojani, Salman',
    chamber: 'House',
    party: 'D',
    district: 'HD 92',
    hometown: 'Euless',
    tloKeys: ['Bhojani', 'Bhojani, Salman'],
  },
  {
    id: 'rep-bonnen-greg',
    name: 'Bonnen, Greg',
    chamber: 'House',
    party: 'R',
    district: 'HD 24',
    hometown: 'Friendswood',
    tloKeys: ['Bonnen', 'Bonnen, Greg'],
  },
  {
    id: 'rep-bowers-rhetta',
    name: 'Bowers, Rhetta',
    chamber: 'House',
    party: 'D',
    district: 'HD 113',
    hometown: 'Garland',
    tloKeys: ['Bowers', 'Bowers, Rhetta'],
  },
  {
    id: 'rep-buckley-brad',
    name: 'Buckley, Brad',
    chamber: 'House',
    party: 'R',
    district: 'HD 54',
    hometown: 'Salado',
    tloKeys: ['Buckley', 'Buckley, Brad'],
  },
  {
    id: 'rep-bucy-john',
    name: 'Bucy, John',
    chamber: 'House',
    party: 'D',
    district: 'HD 136',
    hometown: 'Austin',
    tloKeys: ['Bucy', 'Bucy, John'],
  },
  {
    id: 'rep-bumgarner-ben',
    name: 'Bumgarner, Ben',
    chamber: 'House',
    party: 'R',
    district: 'HD 63',
    hometown: 'Flower Mound',
    tloKeys: ['Bumgarner', 'Bumgarner, Ben'],
    roleNote: 'Former TX House Member for HD 63 (88R-89R).',
  },
  {
    id: 'rep-burrows-dustin',
    name: 'Burrows, Dustin',
    chamber: 'House',
    party: 'R',
    district: 'HD 83',
    hometown: 'Lubbock',
    tloKeys: ['Burrows', 'Burrows, Dustin'],
  },
  {
    id: 'rep-button-angie',
    name: 'Button, Angie Chen',
    chamber: 'House',
    party: 'R',
    district: 'HD 112',
    hometown: 'Garland',
    tloKeys: ['Button', 'Button, Angie Chen'],
    roleNote: 'Former TX House Member for HD 112 (served through 89R).',
  },
  {
    id: 'rep-campos-liz',
    name: 'Campos, Liz',
    chamber: 'House',
    party: 'D',
    district: 'HD 119',
    hometown: 'San Antonio',
    tloKeys: ['Campos', 'Campos, Liz'],
  },
  {
    id: 'rep-canales-terry',
    name: 'Canales, Terry',
    chamber: 'House',
    party: 'D',
    district: 'HD 40',
    hometown: 'Edinburg',
    tloKeys: ['Canales', 'Canales, Terry'],
  },
  {
    id: 'rep-capriglione-giovanni',
    name: 'Capriglione, Giovanni',
    chamber: 'House',
    party: 'R',
    district: 'HD 98',
    hometown: 'Southlake',
    tloKeys: ['Capriglione', 'Capriglione, Giovanni'],
    roleNote: 'Former TX House Member for HD 98 (served through 89R).',
  },
  {
    id: 'rep-carraway-angie',
    name: 'Carraway, Angie',
    chamber: 'House',
    party: 'D',
    district: 'HD 89',
    hometown: 'Plano',
    tloKeys: ['Carraway', 'Carraway, Angie'],
  },
  {
    id: 'rep-cole-sheryl',
    name: 'Cole, Sheryl',
    chamber: 'House',
    party: 'D',
    district: 'HD 46',
    hometown: 'Austin',
    tloKeys: ['Cole', 'Cole, Sheryl'],
  },
  {
    id: 'rep-collier-nicole',
    name: 'Collier, Nicole',
    chamber: 'House',
    party: 'D',
    district: 'HD 95',
    hometown: 'Fort Worth',
    tloKeys: ['Collier', 'Collier, Nicole'],
  },
  {
    id: 'rep-cortez-philip',
    name: 'Cortez, Philip',
    chamber: 'House',
    party: 'D',
    district: 'HD 117',
    hometown: 'San Antonio',
    tloKeys: ['Cortez', 'Cortez, Philip'],
  },
  {
    id: 'rep-craddick-tom',
    name: 'Craddick, Tom',
    chamber: 'House',
    party: 'R',
    district: 'HD 82',
    hometown: 'Midland',
    tloKeys: ['Craddick', 'Craddick, Tom'],
  },
  {
    id: 'rep-curry-pat',
    name: 'Curry, Pat',
    chamber: 'House',
    party: 'R',
    district: 'HD 56',
    hometown: 'Waco',
    tloKeys: ['Curry', 'Curry, Pat'],
  },
  {
    id: 'rep-darby-drew',
    name: 'Darby, Drew',
    chamber: 'House',
    party: 'R',
    district: 'HD 72',
    hometown: 'San Angelo',
    tloKeys: ['Darby', 'Darby, Drew'],
  },
  {
    id: 'rep-davis-aicha',
    name: 'Davis, Aicha',
    chamber: 'House',
    party: 'D',
    district: 'HD 109',
    hometown: 'Dallas',
    tloKeys: ['Davis, Aicha'],
  },
  {
    id: 'rep-deayala-mano',
    name: 'DeAyala, Mano',
    chamber: 'House',
    party: 'R',
    district: 'HD 133',
    hometown: 'Houston',
    tloKeys: ['DeAyala', 'DeAyala, Mano'],
  },
  {
    id: 'rep-dean-jay',
    name: 'Dean, Jay',
    chamber: 'House',
    party: 'R',
    district: 'HD 7',
    hometown: 'Longview',
    tloKeys: ['Dean', 'Dean, Jay'],
  },
  {
    id: 'rep-dorazio-mark',
    name: 'Dorazio, Mark',
    chamber: 'House',
    party: 'R',
    district: 'HD 122',
    hometown: 'San Antonio',
    tloKeys: ['Dorazio', 'Dorazio, Mark'],
  },
  {
    id: 'rep-dutton-harold',
    name: 'Dutton, Harold',
    chamber: 'House',
    party: 'D',
    district: 'HD 142',
    hometown: 'Houston',
    tloKeys: ['Dutton', 'Dutton, Harold'],
  },
  {
    id: 'rep-dyson-paul',
    name: 'Dyson, Paul',
    chamber: 'House',
    party: 'R',
    district: 'HD 14',
    hometown: 'College Station',
    tloKeys: ['Dyson', 'Dyson, Paul'],
  },
  {
    id: 'rep-evbagharu-odus',
    name: 'Evbagharu, Odus',
    chamber: 'House',
    party: 'D',
    district: 'HD 135',
    hometown: 'Houston',
    tloKeys: ['Evbagharu', 'Evbagharu, Odus'],
  },
  {
    id: 'rep-fairly-caroline',
    name: 'Fairly, Caroline',
    chamber: 'House',
    party: 'R',
    district: 'HD 87',
    hometown: 'Amarillo',
    tloKeys: ['Fairly', 'Fairly, Caroline'],
  },
  {
    id: 'rep-flores-lulu',
    name: 'Flores, Lulu',
    chamber: 'House',
    party: 'D',
    district: 'HD 51',
    hometown: 'Austin',
    tloKeys: [{ key: 'Flores', chamber: 'House' }, 'Flores, Lulu'],
  },
  {
    id: 'rep-frank-james',
    name: 'Frank, James',
    chamber: 'House',
    party: 'R',
    district: 'HD 69',
    hometown: 'Wichita Falls',
    tloKeys: ['Frank', 'Frank, James'],
  },
  {
    id: 'rep-gamez-erin',
    name: 'Gámez, Erin',
    chamber: 'House',
    party: 'D',
    district: 'HD 38',
    hometown: 'Brownsville',
    tloKeys: ['Gámez', 'Gámez, Erin'],
  },
  {
    id: 'rep-garcia-hernandez-cassandra',
    name: 'Garcia Hernandez, Cassandra',
    chamber: 'House',
    party: 'D',
    district: 'HD 115',
    hometown: 'Irving',
    tloKeys: ['Garcia Hernandez, Cassandra'],
  },
  {
    id: 'rep-garcia-josey',
    name: 'Garcia, Josey',
    chamber: 'House',
    party: 'D',
    district: 'HD 124',
    hometown: 'San Antonio',
    tloKeys: ['Garcia, Josey'],
  },
  {
    id: 'rep-garcia-linda',
    name: 'Garcia, Linda',
    chamber: 'House',
    party: 'D',
    district: 'HD 107',
    hometown: 'Mesquite',
    tloKeys: ['Garcia, Linda'],
  },
  {
    id: 'rep-gates-gary',
    name: 'Gates, Gary',
    chamber: 'House',
    party: 'R',
    district: 'HD 28',
    hometown: 'Richmond',
    tloKeys: ['Gates', 'Gates, Gary'],
  },
  {
    id: 'rep-gerdes-stan',
    name: 'Gerdes, Stan',
    chamber: 'House',
    party: 'R',
    district: 'HD 17',
    hometown: 'Bastrop',
    tloKeys: ['Gerdes', 'Gerdes, Stan'],
  },
  {
    id: 'rep-geren-charlie',
    name: 'Geren, Charlie',
    chamber: 'House',
    party: 'R',
    district: 'HD 99',
    hometown: 'Fort Worth',
    tloKeys: ['Geren', 'Geren, Charlie'],
  },
  {
    id: 'rep-gervin-hawkins-barbara',
    name: 'Gervin-Hawkins, Barbara',
    chamber: 'House',
    party: 'D',
    district: 'HD 120',
    hometown: 'San Antonio',
    tloKeys: ['Gervin-Hawkins', 'Gervin-Hawkins, Barbara'],
  },
  {
    id: 'rep-gonzalez-jessica',
    name: 'González, Jessica',
    chamber: 'House',
    party: 'D',
    district: 'HD 104',
    hometown: 'Dallas',
    tloKeys: ['González, Jessica'],
  },
  {
    id: 'rep-gonzalez-mary',
    name: 'González, Mary',
    chamber: 'House',
    party: 'D',
    district: 'HD 75',
    hometown: 'Clint',
    tloKeys: ['González, Mary'],
  },
  {
    id: 'rep-guillen-ryan',
    name: 'Guillen, Ryan',
    chamber: 'House',
    party: 'R',
    district: 'HD 31',
    hometown: 'Rio Grande City',
    tloKeys: ['Guillen', 'Guillen, Ryan'],
  },
  {
    id: 'rep-harris-cody',
    name: 'Harris, Cody',
    chamber: 'House',
    party: 'R',
    district: 'HD 8',
    hometown: 'Palestine',
    tloKeys: ['Harris', 'Harris, Cody'],
  },
  {
    id: 'rep-harrison-brian',
    name: 'Harrison, Brian',
    chamber: 'House',
    party: 'R',
    district: 'HD 10',
    hometown: 'Midlothian',
    tloKeys: ['Harrison', 'Harrison, Brian'],
  },
  {
    id: 'rep-hayes-richard',
    name: 'Hayes, Richard',
    chamber: 'House',
    party: 'R',
    district: 'HD 57',
    hometown: 'Denton',
    tloKeys: ['Hayes', 'Hayes, Richard'],
  },
  {
    id: 'rep-hefner-cole',
    name: 'Hefner, Cole',
    chamber: 'House',
    party: 'R',
    district: 'HD 5',
    hometown: 'Mount Pleasant',
    tloKeys: ['Hefner', 'Hefner, Cole'],
  },
  {
    id: 'rep-herbert-zach',
    name: 'Herbert, Zach',
    chamber: 'House',
    party: 'D',
    district: 'HD 112',
    hometown: 'Garland',
    tloKeys: ['Herbert', 'Herbert, Zach'],
  },
  {
    id: 'rep-hickland-hillary',
    name: 'Hickland, Hillary',
    chamber: 'House',
    party: 'R',
    district: 'HD 55',
    hometown: 'Belton',
    tloKeys: ['Hickland', 'Hickland, Hillary'],
  },
  {
    id: 'rep-holt-janis',
    name: 'Holt, Janis',
    chamber: 'House',
    party: 'R',
    district: 'HD 18',
    hometown: 'Silsbee',
    tloKeys: ['Holt', 'Holt, Janis'],
  },
  {
    id: 'rep-howard-donna',
    name: 'Howard, Donna',
    chamber: 'House',
    party: 'D',
    district: 'HD 48',
    hometown: 'Austin',
    tloKeys: ['Howard', 'Howard, Donna'],
  },
  {
    id: 'rep-huberty-dan',
    name: 'Huberty, Dan',
    chamber: 'House',
    party: 'R',
    district: 'HD 127',
    hometown: 'Kingwood',
    tloKeys: ['Huberty', 'Huberty, Dan'],
    roleNote: 'Former TX House Member for HD 127 (82R-87R).',
  },
  {
    id: 'rep-hull-lacey',
    name: 'Hull, Lacey',
    chamber: 'House',
    party: 'R',
    district: 'HD 138',
    hometown: 'Houston',
    tloKeys: ['Hull', 'Hull, Lacey'],
  },
  {
    id: 'rep-hunter-todd',
    name: 'Hunter, Todd',
    chamber: 'House',
    party: 'R',
    district: 'HD 32',
    hometown: 'Corpus Christi',
    tloKeys: ['Hunter', 'Hunter, Todd'],
  },
  {
    id: 'rep-isaac-carrie',
    name: 'Isaac, Carrie',
    chamber: 'House',
    party: 'R',
    district: 'HD 73',
    hometown: 'Dripping Springs',
    tloKeys: ['Isaac', 'Isaac, Carrie'],
  },
  {
    id: 'rep-jimenez-chris',
    name: 'Jimenez, Chris',
    chamber: 'House',
    party: 'D',
    district: 'HD 52',
    hometown: 'Round Rock',
    tloKeys: ['Jimenez', 'Jimenez, Chris'],
  },
  {
    id: 'rep-johnson-ann',
    name: 'Johnson, Ann',
    chamber: 'House',
    party: 'D',
    district: 'HD 134',
    hometown: 'Houston',
    tloKeys: ['Johnson', 'Johnson, Ann'],
  },
  {
    id: 'rep-jones-jolanda',
    name: 'Jones, Jolanda',
    chamber: 'House',
    party: 'D',
    district: 'HD 147',
    hometown: 'Houston',
    tloKeys: ['Jones, Jolanda'],
  },
  {
    id: 'rep-jones-venton',
    name: 'Jones, Venton',
    chamber: 'House',
    party: 'D',
    district: 'HD 100',
    hometown: 'Dallas',
    tloKeys: ['Jones, Venton'],
  },
  {
    id: 'rep-kerwin-helen',
    name: 'Kerwin, Helen',
    chamber: 'House',
    party: 'R',
    district: 'HD 58',
    hometown: 'Glen Rose',
    tloKeys: ['Kerwin', 'Kerwin, Helen'],
  },
  {
    id: 'rep-king-ken',
    name: 'King, Ken',
    chamber: 'House',
    party: 'R',
    district: 'HD 88',
    hometown: 'Canadian',
    tloKeys: ['King', 'King, Ken'],
  },
  {
    id: 'rep-kitzman-stan',
    name: 'Kitzman, Stan',
    chamber: 'House',
    party: 'R',
    district: 'HD 85',
    hometown: 'Pattison',
    tloKeys: ['Kitzman', 'Kitzman, Stan'],
    roleNote: 'TX House Member for HD 85 (88R-89R).',
  },
  {
    id: 'rep-lahood-marc',
    name: 'LaHood, Marc',
    chamber: 'House',
    party: 'R',
    district: 'HD 121',
    hometown: 'San Antonio',
    tloKeys: ['LaHood', 'LaHood, Marc'],
  },
  {
    id: 'rep-lalani-suleman',
    name: 'Lalani, Suleman',
    chamber: 'House',
    party: 'D',
    district: 'HD 76',
    hometown: 'Sugar Land',
    tloKeys: ['Lalani', 'Lalani, Suleman'],
  },
  {
    id: 'rep-lambert-stan',
    name: 'Lambert, Stan',
    chamber: 'House',
    party: 'R',
    district: 'HD 71',
    hometown: 'Abilene',
    tloKeys: ['Lambert', 'Lambert, Stan'],
  },
  {
    id: 'rep-landgraf-brooks',
    name: 'Landgraf, Brooks',
    chamber: 'House',
    party: 'R',
    district: 'HD 81',
    hometown: 'Odessa',
    tloKeys: ['Landgraf', 'Landgraf, Brooks'],
  },
  {
    id: 'rep-leach-jeff',
    name: 'Leach, Jeff',
    chamber: 'House',
    party: 'R',
    district: 'HD 67',
    hometown: 'Plano',
    tloKeys: ['Leach', 'Leach, Jeff'],
  },
  {
    id: 'rep-leo-wilson-terri',
    name: 'Leo Wilson, Terri',
    chamber: 'House',
    party: 'R',
    district: 'HD 23',
    hometown: 'Galveston',
    tloKeys: ['Leo Wilson', 'Leo Wilson, Terri'],
  },
  {
    id: 'rep-little-mitch',
    name: 'Little, Mitch',
    chamber: 'House',
    party: 'R',
    district: 'HD 65',
    hometown: 'Lewisville',
    tloKeys: ['Little', 'Little, Mitch'],
  },
  {
    id: 'rep-longoria-oscar',
    name: 'Longoria, Oscar',
    chamber: 'House',
    party: 'D',
    district: 'HD 35',
    hometown: 'Mission',
    tloKeys: ['Longoria', 'Longoria, Oscar'],
  },
  {
    id: 'rep-lopez-janie',
    name: 'Lopez, Janie',
    chamber: 'House',
    party: 'R',
    district: 'HD 37',
    hometown: 'San Benito',
    tloKeys: ['Lopez, Janie'],
    roleNote: 'Former TX House Member for HD 37 (88R-89R).',
  },
  {
    id: 'rep-lopez-ray',
    name: 'Lopez, Ray',
    chamber: 'House',
    party: 'D',
    district: 'HD 125',
    hometown: 'San Antonio',
    tloKeys: ['Lopez, Ray'],
  },
  {
    id: 'rep-lopez-resendez-samantha',
    name: 'Lopez-Resendez, Samantha',
    chamber: 'House',
    party: 'D',
    district: 'HD 50',
    hometown: 'Austin',
    tloKeys: ['Lopez-Resendez', 'Lopez-Resendez, Samantha'],
  },
  {
    id: 'rep-louderback-aj',
    name: 'Louderback, A.J.',
    chamber: 'House',
    party: 'R',
    district: 'HD 30',
    hometown: 'Victoria',
    tloKeys: ['Louderback', 'Louderback, A.J.'],
  },
  {
    id: 'rep-lowe-david',
    name: 'Lowe, David',
    chamber: 'House',
    party: 'R',
    district: 'HD 91',
    hometown: 'North Richland Hills',
    tloKeys: ['Lowe', 'Lowe, David'],
  },
  {
    id: 'rep-lozano-jm',
    name: 'Lozano, J.M.',
    chamber: 'House',
    party: 'R',
    district: 'HD 43',
    hometown: 'Kingsville',
    tloKeys: ['Lozano', 'Lozano, J.M.'],
  },
  {
    id: 'rep-lujan-john',
    name: 'Lujan, John',
    chamber: 'House',
    party: 'R',
    district: 'HD 118',
    hometown: 'San Antonio',
    tloKeys: ['Lujan', 'Lujan, John'],
  },
  {
    id: 'rep-luther-shelley',
    name: 'Luther, Shelley',
    chamber: 'House',
    party: 'R',
    district: 'HD 62',
    hometown: 'Sherman',
    tloKeys: ['Luther', 'Luther, Shelley'],
  },
  {
    id: 'rep-manuel-christian',
    name: 'Manuel, Christian',
    chamber: 'House',
    party: 'D',
    district: 'HD 22',
    hometown: 'Beaumont',
    tloKeys: ['Manuel', 'Manuel, Christian'],
  },
  {
    id: 'rep-martinez-armando',
    name: 'Martinez, Armando "Mando"',
    chamber: 'House',
    party: 'D',
    district: 'HD 39',
    hometown: 'Weslaco',
    tloKeys: ['Martinez', 'Martinez, Armando'],
  },
  {
    id: 'rep-martinez-fischer-trey',
    name: 'Martinez Fischer, Trey',
    chamber: 'House',
    party: 'D',
    district: 'HD 116',
    hometown: 'San Antonio',
    tloKeys: ['Martinez Fischer', 'Martinez Fischer, Trey'],
  },
  {
    id: 'rep-mclaughlin-don',
    name: 'McLaughlin, Don',
    chamber: 'House',
    party: 'R',
    district: 'HD 80',
    hometown: 'Uvalde',
    tloKeys: ['McLaughlin', 'McLaughlin, Don'],
  },
  {
    id: 'rep-metcalf-will',
    name: 'Metcalf, Will',
    chamber: 'House',
    party: 'R',
    district: 'HD 16',
    hometown: 'Conroe',
    tloKeys: ['Metcalf', 'Metcalf, Will'],
  },
  {
    id: 'rep-meyer-morgan',
    name: 'Meyer, Morgan',
    chamber: 'House',
    party: 'R',
    district: 'HD 108',
    hometown: 'Dallas',
    tloKeys: ['Meyer', 'Meyer, Morgan'],
  },
  {
    id: 'rep-mizani-armin',
    name: 'Mizani, Armin',
    chamber: 'House',
    party: 'R',
    district: 'HD 98',
    hometown: 'Keller',
    tloKeys: ['Mizani', 'Mizani, Armin'],
  },
  {
    id: 'rep-money-brent',
    name: 'Money, Brent',
    chamber: 'House',
    party: 'R',
    district: 'HD 2',
    hometown: 'Greenville',
    tloKeys: ['Money', 'Money, Brent'],
  },
  {
    id: 'rep-moody-joe',
    name: 'Moody, Joe',
    chamber: 'House',
    party: 'D',
    district: 'HD 78',
    hometown: 'El Paso',
    tloKeys: ['Moody', 'Moody, Joe'],
  },
  {
    id: 'rep-morales-eddie',
    name: 'Morales, Eddie',
    chamber: 'House',
    party: 'D',
    district: 'HD 74',
    hometown: 'Eagle Pass',
    tloKeys: ['Morales, Eddie'],
  },
  {
    id: 'rep-morgan-matt',
    name: 'Morgan, Matt',
    chamber: 'House',
    party: 'R',
    district: 'HD 26',
    hometown: 'Richmond',
    tloKeys: ['Morgan', 'Morgan, Matt'],
  },
  {
    id: 'rep-munoz-sergio',
    name: 'Muñoz, Sergio',
    chamber: 'House',
    party: 'D',
    district: 'HD 36',
    hometown: 'Mission',
    tloKeys: ['Muñoz', 'Muñoz, Sergio'],
  },
  {
    id: 'rep-noble-candy',
    name: 'Noble, Candy',
    chamber: 'House',
    party: 'R',
    district: 'HD 89',
    hometown: 'Lucas',
    tloKeys: ['Noble', 'Noble, Candy'],
    roleNote: 'Former TX House Member for HD 89 (86R-89R).',
  },
  {
    id: 'rep-obrien-duzan-katie',
    name: "O'Brien Duzan, Katie",
    chamber: 'House',
    party: 'D',
    district: 'HD 94',
    hometown: 'Arlington',
    tloKeys: ["O'Brien Duzan", "O'Brien Duzan, Katie"],
  },
  {
    id: 'rep-ochoa-oziel',
    name: 'Ochoa, Oziel',
    chamber: 'House',
    party: 'D',
    district: 'HD 37',
    hometown: 'Brownsville',
    tloKeys: ['Ochoa', 'Ochoa, Oziel'],
  },
  {
    id: 'rep-olcott-mike',
    name: 'Olcott, Mike',
    chamber: 'House',
    party: 'R',
    district: 'HD 60',
    hometown: 'Aledo',
    tloKeys: ['Olcott', 'Olcott, Mike'],
  },
  {
    id: 'rep-oliverson-tom',
    name: 'Oliverson, Tom',
    chamber: 'House',
    party: 'R',
    district: 'HD 130',
    hometown: 'Cypress',
    tloKeys: ['Oliverson', 'Oliverson, Tom'],
  },
  {
    id: 'rep-ordaz-claudia',
    name: 'Ordaz, Claudia',
    chamber: 'House',
    party: 'D',
    district: 'HD 79',
    hometown: 'El Paso',
    tloKeys: ['Ordaz', 'Ordaz, Claudia'],
  },
  {
    id: 'rep-orr-angelia',
    name: 'Orr, Angelia',
    chamber: 'House',
    party: 'R',
    district: 'HD 13',
    hometown: 'Itasca',
    tloKeys: ['Orr', 'Orr, Angelia'],
  },
  {
    id: 'rep-patterson-jared',
    name: 'Patterson, Jared',
    chamber: 'House',
    party: 'R',
    district: 'HD 106',
    hometown: 'Frisco',
    tloKeys: ['Patterson', 'Patterson, Jared'],
  },
  {
    id: 'rep-perez-mary-ann',
    name: 'Perez, Mary Ann',
    chamber: 'House',
    party: 'D',
    district: 'HD 144',
    hometown: 'Houston',
    tloKeys: ['Perez, Mary Ann'],
  },
  {
    id: 'rep-perez-vincent',
    name: 'Perez, Vincent',
    chamber: 'House',
    party: 'D',
    district: 'HD 77',
    hometown: 'El Paso',
    tloKeys: ['Perez, Vincent'],
  },
  {
    id: 'rep-phelan-dade',
    name: 'Phelan, Dade',
    chamber: 'House',
    party: 'R',
    district: 'HD 21',
    hometown: 'Beaumont',
    tloKeys: ['Phelan', 'Phelan, Dade'],
  },
  {
    id: 'rep-pierson-katrina',
    name: 'Pierson, Katrina',
    chamber: 'House',
    party: 'R',
    district: 'HD 33',
    hometown: 'Rockwall',
    tloKeys: ['Pierson', 'Pierson, Katrina'],
  },
  {
    id: 'rep-plesa-mihaela',
    name: 'Plesa, Mihaela',
    chamber: 'House',
    party: 'D',
    district: 'HD 70',
    hometown: 'Dallas',
    tloKeys: ['Plesa', 'Plesa, Mihaela'],
  },
  {
    id: 'rep-raymond-richard',
    name: 'Raymond, Richard Peña',
    chamber: 'House',
    party: 'D',
    district: 'HD 42',
    hometown: 'Laredo',
    tloKeys: ['Raymond', 'Raymond, Richard Peña'],
  },
  {
    id: 'rep-reynolds-ron',
    name: 'Reynolds, Ron',
    chamber: 'House',
    party: 'D',
    district: 'HD 27',
    hometown: 'Missouri City',
    tloKeys: ['Reynolds', 'Reynolds, Ron'],
  },
  {
    id: 'rep-richardson-keresa',
    name: 'Richardson, Keresa',
    chamber: 'House',
    party: 'R',
    district: 'HD 61',
    hometown: 'McKinney',
    tloKeys: ['Richardson', 'Richardson, Keresa'],
  },
  {
    id: 'rep-rodriguez-ramos-ana-maria',
    name: 'Rodríguez Ramos, Ana-María',
    chamber: 'House',
    party: 'D',
    district: 'HD 102',
    hometown: 'Richardson',
    tloKeys: ['Rodríguez Ramos', 'Rodríguez Ramos, Ana-María'],
  },
  {
    id: 'rep-rose-toni',
    name: 'Rose, Toni',
    chamber: 'House',
    party: 'D',
    district: 'HD 110',
    hometown: 'Dallas',
    tloKeys: ['Rose', 'Rose, Toni'],
  },
  {
    id: 'rep-salinas-julio',
    name: 'Salinas, Julio',
    chamber: 'House',
    party: 'D',
    district: 'HD 41',
    hometown: 'McAllen',
    tloKeys: ['Salinas', 'Salinas, Julio'],
  },
  {
    id: 'rep-schaefer-matt',
    name: 'Schaefer, Matt',
    chamber: 'House',
    party: 'R',
    district: 'HD 6',
    hometown: 'Tyler',
    tloKeys: ['Schaefer', 'Schaefer, Matt'],
    roleNote: 'Former TX House Member for HD 6 (83R-88R).',
  },
  {
    id: 'rep-schofield-mike',
    name: 'Schofield, Mike',
    chamber: 'House',
    party: 'R',
    district: 'HD 132',
    hometown: 'Katy',
    tloKeys: ['Schofield', 'Schofield, Mike'],
  },
  {
    id: 'rep-schoolcraft-alan',
    name: 'Schoolcraft, Alan',
    chamber: 'House',
    party: 'R',
    district: 'HD 44',
    hometown: 'McQueeney',
    tloKeys: ['Schoolcraft', 'Schoolcraft, Alan'],
  },
  {
    id: 'rep-sethi-pooja',
    name: 'Sethi, Pooja',
    chamber: 'House',
    party: 'D',
    district: 'HD 47',
    hometown: 'Austin',
    tloKeys: ['Sethi', 'Sethi, Pooja'],
  },
  {
    id: 'rep-shaheen-matt',
    name: 'Shaheen, Matt',
    chamber: 'House',
    party: 'R',
    district: 'HD 66',
    hometown: 'Plano',
    tloKeys: ['Shaheen', 'Shaheen, Matt'],
  },
  {
    id: 'rep-shofner-joanne',
    name: 'Shofner, Joanne',
    chamber: 'House',
    party: 'R',
    district: 'HD 11',
    hometown: 'Nacogdoches',
    tloKeys: ['Shofner', 'Shofner, Joanne'],
  },
  {
    id: 'rep-simmons-lauren-ashley',
    name: 'Simmons, Lauren Ashley',
    chamber: 'House',
    party: 'D',
    district: 'HD 146',
    hometown: 'Houston',
    tloKeys: ['Simmons', 'Simmons, Lauren Ashley'],
  },
  {
    id: 'rep-slawson-shelby',
    name: 'Slawson, Shelby',
    chamber: 'House',
    party: 'R',
    district: 'HD 59',
    hometown: 'Stephenville',
    tloKeys: ['Slawson', 'Slawson, Shelby'],
  },
  {
    id: 'rep-smithee-john',
    name: 'Smithee, John',
    chamber: 'House',
    party: 'R',
    district: 'HD 86',
    hometown: 'Amarillo',
    tloKeys: ['Smithee', 'Smithee, John'],
  },
  {
    id: 'rep-spencer-chris',
    name: 'Spencer, Chris',
    chamber: 'House',
    party: 'R',
    district: 'HD 1',
    hometown: 'Texarkana',
    tloKeys: ['Spencer', 'Spencer, Chris'],
  },
  {
    id: 'rep-spiller-david',
    name: 'Spiller, David',
    chamber: 'House',
    party: 'R',
    district: 'HD 68',
    hometown: 'Jacksboro',
    tloKeys: ['Spiller', 'Spiller, David'],
  },
  {
    id: 'rep-swanson-valoree',
    name: 'Swanson, Valoree',
    chamber: 'House',
    party: 'R',
    district: 'HD 150',
    hometown: 'Spring',
    tloKeys: ['Swanson', 'Swanson, Valoree'],
  },
  {
    id: 'rep-tepper-carl',
    name: 'Tepper, Carl',
    chamber: 'House',
    party: 'R',
    district: 'HD 84',
    hometown: 'Lubbock',
    tloKeys: ['Tepper', 'Tepper, Carl'],
  },
  {
    id: 'rep-thompson-senfronia',
    name: 'Thompson, Senfronia',
    chamber: 'House',
    party: 'D',
    district: 'HD 141',
    hometown: 'Houston',
    tloKeys: ['Thompson', 'Thompson, Senfronia'],
  },
  {
    id: 'rep-tinderholt-tony',
    name: 'Tinderholt, Tony',
    chamber: 'House',
    party: 'R',
    district: 'HD 94',
    hometown: 'Arlington',
    tloKeys: ['Tinderholt', 'Tinderholt, Tony'],
    roleNote: 'Former TX House Member for HD 94 (84R-89R).',
  },
  {
    id: 'rep-toth-steve',
    name: 'Toth, Steve',
    chamber: 'House',
    party: 'R',
    district: 'HD 15',
    hometown: 'Conroe',
    tloKeys: ['Toth', 'Toth, Steve'],
    roleNote: 'Former TX House Member for HD 15 (86R-89R).',
  },
  {
    id: 'rep-troxclair-ellen',
    name: 'Troxclair, Ellen',
    chamber: 'House',
    party: 'R',
    district: 'HD 19',
    hometown: 'Lakeway',
    tloKeys: ['Troxclair', 'Troxclair, Ellen'],
  },
  {
    id: 'rep-turner-chris',
    name: 'Turner, Chris',
    chamber: 'House',
    party: 'D',
    district: 'HD 101',
    hometown: 'Grand Prairie',
    tloKeys: ['Turner', 'Turner, Chris'],
  },
  {
    id: 'rep-vandeaver-gary',
    name: 'VanDeaver, Gary',
    chamber: 'House',
    party: 'R',
    district: 'HD 1',
    hometown: 'New Boston',
    tloKeys: ['VanDeaver', 'VanDeaver, Gary'],
    roleNote: 'Former TX House Member for HD 1 (84R-89R).',
  },
  {
    id: 'rep-vasut-cody',
    name: 'Vasut, Cody',
    chamber: 'House',
    party: 'R',
    district: 'HD 25',
    hometown: 'Angleton',
    tloKeys: ['Vasut', 'Vasut, Cody'],
  },
  {
    id: 'rep-villalobos-denise',
    name: 'Villalobos, Denise',
    chamber: 'House',
    party: 'R',
    district: 'HD 34',
    hometown: 'Corpus Christi',
    tloKeys: ['Villalobos', 'Villalobos, Denise'],
  },
  {
    id: 'rep-virdell-wesley',
    name: 'Virdell, Wesley "Wes"',
    chamber: 'House',
    party: 'R',
    district: 'HD 53',
    hometown: 'Brady',
    tloKeys: ['Virdell', 'Virdell, Wesley'],
  },
  {
    id: 'rep-walle-armando',
    name: 'Walle, Armando',
    chamber: 'House',
    party: 'D',
    district: 'HD 140',
    hometown: 'Houston',
    tloKeys: ['Walle', 'Walle, Armando'],
  },
  {
    id: 'rep-ward-johnson-charlene',
    name: 'Ward Johnson, Charlene',
    chamber: 'House',
    party: 'D',
    district: 'HD 139',
    hometown: 'Houston',
    tloKeys: ['Ward Johnson', 'Ward Johnson, Charlene'],
  },
  {
    id: 'rep-wharton-trey',
    name: 'Wharton, Trey',
    chamber: 'House',
    party: 'R',
    district: 'HD 12',
    hometown: 'Huntsville',
    tloKeys: ['Wharton', 'Wharton, Trey'],
  },
  {
    id: 'rep-white-james',
    name: 'White, James',
    chamber: 'House',
    party: 'R',
    district: 'HD 19',
    hometown: 'Hillister',
    tloKeys: ['White', 'White, James'],
    roleNote: 'Former TX House Member for HD 19 (82R-87R).',
  },
  {
    id: 'rep-wilson-terry',
    name: 'Wilson, Terry',
    chamber: 'House',
    party: 'R',
    district: 'HD 20',
    hometown: 'Georgetown',
    tloKeys: ['Wilson', 'Wilson, Terry'],
  },
  {
    id: 'rep-wooten-denise',
    name: 'Wooten, Denise',
    chamber: 'House',
    party: 'D',
    district: 'HD 63',
    hometown: 'Flower Mound',
    tloKeys: ['Wooten', 'Wooten, Denise'],
  },
  {
    id: 'rep-zwiener-erin',
    name: 'Zwiener, Erin',
    chamber: 'House',
    party: 'D',
    district: 'HD 45',
    hometown: 'Driftwood',
    tloKeys: ['Zwiener', 'Zwiener, Erin'],
  },
];

interface NormalizedKeyRule {
  key: string;
  chamber?: Chamber;
}

const ROSTER_BY_ID = new Map<string, LawmakerRosterSpec>();
const NORMALIZED_RULES_BY_ID = new Map<string, NormalizedKeyRule[]>();
const TOKEN_OWNER_CHAMBERS = new Map<string, Set<Chamber>>();

for (const spec of TEXAS_LAWMAKER_ROSTER) {
  ROSTER_BY_ID.set(spec.id, spec);
  const rules: NormalizedKeyRule[] = spec.tloKeys.map((rule) => {
    if (typeof rule === 'string') {
      const key = normalizeTloToken(rule);
      if (!TOKEN_OWNER_CHAMBERS.has(key)) TOKEN_OWNER_CHAMBERS.set(key, new Set());
      TOKEN_OWNER_CHAMBERS.get(key)!.add(spec.chamber);
      return { key };
    }
    const key = normalizeTloToken(rule.key);
    if (!TOKEN_OWNER_CHAMBERS.has(key)) TOKEN_OWNER_CHAMBERS.set(key, new Set());
    TOKEN_OWNER_CHAMBERS.get(key)!.add(rule.chamber || spec.chamber);
    return { key, chamber: rule.chamber };
  });
  NORMALIZED_RULES_BY_ID.set(spec.id, rules);
}

/**
 * Match a Legislator record accurately against a Bill's author/coauthors without
 * substring collisions (e.g. "Johnson" vs "Ward Johnson", "Flores" House vs Senate,
 * "Cook, David" vs "Cook, Molly").
 */
export function doesLawmakerMatchBill(
  lawmaker: Pick<Legislator, 'id' | 'name' | 'chamber'>,
  bill: Pick<Bill, 'author' | 'coauthors' | 'chamber'>
): boolean {
  const billTokens = extractBillAuthorTokens(bill);
  if (billTokens.length === 0) return false;

  const rules = NORMALIZED_RULES_BY_ID.get(lawmaker.id);
  if (rules) {
    for (const rule of rules) {
      const ownsMultipleChambers = (TOKEN_OWNER_CHAMBERS.get(rule.key)?.size || 0) > 1;
      const requiredChamber = rule.chamber || (ownsMultipleChambers ? lawmaker.chamber : undefined);
      if (requiredChamber && bill.chamber !== requiredChamber) continue;
      if (billTokens.includes(rule.key)) return true;
    }
    return false;
  }

  // Fallback for dynamically synthesized future lawmakers not yet in TEXAS_LAWMAKER_ROSTER
  if (bill.chamber !== lawmaker.chamber) return false;
  const normFull = normalizeTloToken(lawmaker.name);
  const normLast = normalizeTloToken(lawmaker.name.split(',')[0]);
  return billTokens.some((tok) => tok === normFull || tok === normLast);
}

function collectRollCallVotesForLawmaker(
  lawmaker: Pick<Legislator, 'name'>,
  matchedBills: Bill[]
): HistoricalVote[] {
  const normLast = normalizeTloToken(lawmaker.name.split(',')[0]);
  const votes: HistoricalVote[] = [];

  for (const bill of matchedBills) {
    for (let idx = 0; idx < (bill.votes || []).length; idx++) {
      const vote = bill.votes[idx];
      const match = (vote.rollCall || []).find((entry) => {
        const memberNorm = normalizeTloToken(entry.member);
        return memberNorm === normLast || memberNorm.startsWith(`${normLast},`);
      });
      if (!match) continue;

      const voteCast =
        match.vote === 'PNV' ? 'Present Not Voting' : match.vote;
      const alignmentWithUser =
        bill.stance === 'NEUTRAL' || voteCast === 'Absent' || voteCast === 'Present Not Voting'
          ? 'NEUTRAL'
          : (bill.stance === 'SUPPORT' && voteCast === 'Aye') ||
              (bill.stance === 'OPPOSE' && voteCast === 'Nay')
            ? 'ALIGNED'
            : 'CONTRARY';

      votes.push({
        id: `${bill.id}-rc-${idx}`,
        session: bill.session,
        billNumber: bill.billNumber,
        billId: bill.id,
        caption: bill.caption,
        chamber: bill.chamber,
        date: vote.date,
        voteCast,
        overallResult:
          vote.result === 'Reported Favorably' || vote.result === 'Substitute Adopted'
            ? 'Passed'
            : 'Failed',
        ayes: vote.ayes,
        nays: vote.nays,
        stance: bill.stance,
        alignmentWithUser,
        topic: bill.primaryCategory || 'Texas Legislation',
      });
    }
  }
  return votes;
}

function computeHistoricalStats(matchedBills: Bill[]): LegislatorSessionStats[] {
  const bySession = new Map<SessionId, Bill[]>();
  for (const bill of matchedBills) {
    const arr = bySession.get(bill.session) || [];
    arr.push(bill);
    bySession.set(bill.session, arr);
  }

  return SESSION_ORDER.filter((sess) => bySession.has(sess)).map((sess) => {
    const sessBills = bySession.get(sess)!;
    let support = 0;
    let oppose = 0;
    let passed = 0;
    for (const b of sessBills) {
      if (b.stance === 'SUPPORT') support++;
      else if (b.stance === 'OPPOSE') oppose++;
      if (b.currentStatus === 'Signed by Governor' || b.currentStatus === 'Passed Chamber') {
        passed++;
      }
    }
    const decided = support + oppose;
    return {
      session: sess,
      years: SESSION_YEARS[sess] || '',
      totalFiled: sessBills.length,
      passedBills: passed,
      ayeVotes: 0,
      nayVotes: 0,
      alignmentScore: decided > 0 ? Math.round((support / decided) * 100) : 50,
    };
  });
}

function slugifyIdPart(raw: string): string {
  return normalizeTloToken(raw)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildLegislatorFromMatchedBills(
  spec: LawmakerRosterSpec,
  matchedBills: Bill[],
  base?: Legislator
): Legislator {
  let support = 0;
  let oppose = 0;
  let neutral = 0;
  let livePassed = 0;
  const topicCounts = new Map<string, number>();

  for (const b of matchedBills) {
    if (b.stance === 'SUPPORT') support++;
    else if (b.stance === 'OPPOSE') oppose++;
    else neutral++;

    if (b.currentStatus === 'Signed by Governor' || b.currentStatus === 'Passed Chamber') {
      livePassed++;
    }
    const cat = (b.primaryCategory || '').trim();
    if (cat && cat !== 'General') {
      topicCounts.set(cat, (topicCounts.get(cat) || 0) + 1);
    }
  }

  const decided = support + oppose;
  const computedAlignment =
    decided > 0
      ? Math.round((support / decided) * 100)
      : base?.alignmentScore ?? 50;

  const sortedTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([topic]) => topic);

  const keyTopics =
    sortedTopics.length > 0
      ? sortedTopics
      : base?.keyTopics?.length
        ? base.keyTopics
        : ['Texas Legislation'];

  const sessionSet = new Set<SessionId>(matchedBills.map((b) => b.session));
  for (const s of base?.sessionsServed || []) sessionSet.add(s);
  if (sessionSet.size === 0) sessionSet.add('90R');
  const sessionsServed = SESSION_ORDER.filter((s) => sessionSet.has(s));

  const authoredBillNumbers = matchedBills.slice(0, 24).map((b) => `${b.session} ${b.billNumber}`);
  const computedStats = computeHistoricalStats(matchedBills);
  const historicalStats =
    base?.historicalStats && base.historicalStats.length > computedStats.length
      ? base.historicalStats
      : computedStats;

  const rollCallVotes = collectRollCallVotesForLawmaker(spec, matchedBills);
  const votingRecord =
    base?.votingRecord && base.votingRecord.length > 0 ? base.votingRecord : rollCallVotes;

  const chamberTitle =
    spec.chamber === 'Senate' ? 'Texas Senator' : 'Texas State Representative';
  const defaultProfile = spec.roleNote
    ? `${chamberTitle} for ${spec.district} (${spec.hometown}). ${spec.roleNote}`
    : `${chamberTitle} representing ${spec.district} (${spec.hometown}). Metrics below reflect live policy evaluation across ${matchedBills.length} authored and coauthored bills in the TLO feed.`;

  return {
    id: spec.id,
    name: base?.name || spec.name,
    chamber: base?.chamber || spec.chamber,
    party: base?.party || spec.party,
    district: base?.district || spec.district,
    hometown: base?.hometown || spec.hometown,
    capitolOffice: base?.capitolOffice || `Texas Capitol · ${spec.chamber} Offices, Austin`,
    phone: base?.phone || '(512) 463-4630',
    email: base?.email || 'Listed via capitol.texas.gov',
    committeeAssignments:
      base?.committeeAssignments?.length
        ? base.committeeAssignments
        : spec.committeeAssignments?.length
          ? spec.committeeAssignments
          : [`${spec.chamber} Member — 90th Legislature`],
    totalBillsFiled: matchedBills.length > 0 ? matchedBills.length : base?.totalBillsFiled ?? 0,
    passedBills: Math.max(livePassed, base?.passedBills ?? 0),
    alignmentScore: computedAlignment,
    stanceBreakdown:
      matchedBills.length > 0
        ? { support, oppose, neutral }
        : base?.stanceBreakdown || { support: 0, oppose: 0, neutral: 0 },
    keyTopics,
    behavioralProfile: base?.behavioralProfile || defaultProfile,
    authoredBillNumbers:
      authoredBillNumbers.length > 0 ? authoredBillNumbers : base?.authoredBillNumbers || [],
    sessionsServed,
    historicalStats,
    votingRecord,
  };
}

/**
 * Build the complete deduplicated Legislator directory covering every member in
 * TEXAS_LAWMAKER_ROSTER plus any additional TLO authors appearing dynamically in `bills`.
 */
export function buildCompleteLegislatorsList(
  bills: Bill[],
  baseLegislators: Legislator[] = []
): Legislator[] {
  const baseById = new Map<string, Legislator>();
  for (const leg of baseLegislators) {
    baseById.set(leg.id, leg);
  }

  const result: Legislator[] = [];
  const matchedBillTokensCovered = new Set<string>();

  for (const spec of TEXAS_LAWMAKER_ROSTER) {
    const matchedBills = bills.filter((bill) => doesLawmakerMatchBill(spec, bill));
    const legislator = buildLegislatorFromMatchedBills(
      spec,
      matchedBills,
      baseById.get(spec.id)
    );
    result.push(legislator);

    for (const rule of NORMALIZED_RULES_BY_ID.get(spec.id) || []) {
      const ruleChamber = rule.chamber;
      if (ruleChamber) {
        matchedBillTokensCovered.add(`${ruleChamber}||${rule.key}`);
      } else {
        matchedBillTokensCovered.add(`House||${rule.key}`);
        matchedBillTokensCovered.add(`Senate||${rule.key}`);
      }
    }
  }

  // Synthesize profiles for any new/unlisted TLO authors so no synced bill author is orphaned
  const unknownPairs = new Map<string, { chamber: Chamber; displayName: string }>();
  for (const bill of bills) {
    const rawParts = [...(bill.author || '').split('|'), ...(bill.coauthors || [])];
    for (const raw of rawParts) {
      const trimmed = String(raw || '').trim();
      if (!trimmed) continue;
      const norm = normalizeTloToken(trimmed);
      if (!norm || norm === 'et al.' || norm === 'et al') continue;
      const pairKey = `${bill.chamber}||${norm}`;
      if (matchedBillTokensCovered.has(pairKey)) continue;
      if (!unknownPairs.has(pairKey)) {
        unknownPairs.set(pairKey, { chamber: bill.chamber, displayName: trimmed });
      }
    }
  }

  for (const [, info] of unknownPairs) {
    const prefix = info.chamber === 'Senate' ? 'sen' : 'rep';
    const synthSpec: LawmakerRosterSpec = {
      id: `${prefix}-tlo-${slugifyIdPart(info.displayName)}`,
      name: info.displayName,
      chamber: info.chamber,
      party: 'I',
      district: `${info.chamber} Member`,
      hometown: 'Texas',
      tloKeys: [{ key: info.displayName, chamber: info.chamber }],
      roleNote: 'Auto-discovered from live TLO bill feed.',
    };
    const matchedBills = bills.filter(
      (b) => b.chamber === info.chamber && extractBillAuthorTokens(b).includes(normalizeTloToken(info.displayName))
    );
    result.push(buildLegislatorFromMatchedBills(synthSpec, matchedBills));
  }

  return result.sort((a, b) => {
    if (b.totalBillsFiled !== a.totalBillsFiled) {
      return b.totalBillsFiled - a.totalBillsFiled;
    }
    return a.name.localeCompare(b.name);
  });
}
