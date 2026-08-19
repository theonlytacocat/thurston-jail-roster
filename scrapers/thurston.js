import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.co.thurston.wa.us/cm/sheriff/bureau-corrections-roster-search.asp';
const ROSTER_URL = `${BASE_URL}?mod=fourth`;
const DETAIL_BASE = `${BASE_URL}?mod=third&idnum=`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

export function detailUrl(idnum) {
  return DETAIL_BASE + idnum;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Full current-inmate list — a single unpaginated page listing everyone
// currently booked, each linking to a detail page via idnum.
export async function scrapeRoster() {
  const res = await axios.get(ROSTER_URL, { headers: HEADERS, timeout: 20000 });
  const $ = cheerio.load(res.data);

  const inmates = [];
  const seen = new Set();

  $('a[href*="mod=third"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/idnum=([A-Za-z0-9]+)/i);
    if (!m) return;
    const idnum = m[1];
    if (seen.has(idnum)) return;
    seen.add(idnum);

    // Anchor text is "LASTNAME , FIRSTNAME MIDDLENAME" once whitespace/nbsp collapse
    const raw = $(el).text().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    const commaIdx = raw.indexOf(',');
    if (commaIdx === -1) return;
    const last = raw.slice(0, commaIdx).trim();
    const firstMiddle = raw.slice(commaIdx + 1).trim();
    if (!last) return;

    inmates.push({
      idnum,
      name: firstMiddle ? `${last}, ${firstMiddle}` : last
    });
  });

  return inmates;
}

// Charge Information page for one inmate: repeating COURT / CAUSE NUMBER /
// CHARGE / BAIL / ARREST DATE label-value row pairs, one block per charge.
export async function scrapeDetail(idnum) {
  try {
    const res = await axios.get(detailUrl(idnum), { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data);

    const charges = [];
    let cur = null;

    $('table tr').each((_, row) => {
      const tds = $(row).find('td').map((_, td) =>
        $(td).text().replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
      ).get();
      if (tds.length < 2) return;

      const [label, value] = tds;

      if (/^COURT:/i.test(label)) {
        if (cur) charges.push(cur);
        cur = { court: value || null, causeNumber: null, charge: null, bail: null, arrestDate: null };
        return;
      }
      if (!cur) return;

      if (/^CAUSE NUMBER:/i.test(label)) cur.causeNumber = value || null;
      else if (/^CHARGE:/i.test(label))  cur.charge = value || null;
      else if (/^BAIL:/i.test(label))    cur.bail = value || null;
      else if (/^ARREST DATE:/i.test(label)) cur.arrestDate = value || null;
    });

    if (cur) charges.push(cur);

    return { charges };
  } catch (err) {
    console.error(`  Detail fetch failed for ${idnum}:`, err.message);
    return null;
  }
}

// Fetch detail pages for a batch of idnums sequentially, with a small delay
// between requests out of courtesy to the county's server.
export async function scrapeDetailBatch(idnums) {
  const results = {};
  for (const idnum of idnums) {
    results[idnum] = await scrapeDetail(idnum);
    await delay(400);
  }
  return results;
}
