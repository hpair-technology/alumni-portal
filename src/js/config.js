/* ============================================================================
   HPAIR Alumni Portal: shared constants
   ----------------------------------------------------------------------------
   Anything an admin is likely to want to change lives here, in one place.
   ========================================================================== */

/* Accounts that always get admin powers. Anyone else can be promoted by an
   admin from the Admin tab, which sets role:"admin" on their users document.
   This list is mirrored in firestore.rules (isStaffEmail) and storage.rules.
   Change all three together. */
export const ADMIN_EMAILS = new Set([
  "tech-help@hpair.org",
  "finance@hpair.org",
  "cqiu@college.harvard.edu",
]);

export const CONTACT = {
  alumni: "alumni@hpair.org",
  tech: "tech-help@hpair.org",
  presidents: "presidents@hpair.org",
  site: "https://www.hpair.org",
};

/* Figures published on hpair.org. Update when HPAIR updates theirs. */
export const FACTS = {
  founded: 1991,
  conferences: 49,
  hostCountries: 34,
  delegates: "40,000",
  countries: 42,
  speakers: 500,
};

export const INDUSTRIES = [
  "Academia/Research",
  "Arts/Entertainment",
  "Engineering",
  "Entrepreneurship",
  "Financial Services (including Private Equity/Hedge Funds)",
  "Government/Politics",
  "Healthcare",
  "Law",
  "Management Consulting",
  "Media",
  "Non-Profit/Social Enterprise",
  "Technology",
];
export const SHORT_INDUSTRY = {
  "Financial Services (including Private Equity/Hedge Funds)": "Financial Services",
};
export const shortIndustry = (i) => SHORT_INDUSTRY[i] || i;

export const MENTORING = {
  "": "Not at the moment",
  mentor: "Happy to mentor",
  mentee: "Looking for a mentor",
  both: "Happy to mentor, and looking for one",
};

/* Career hub post types. HPAIR's own calls (hosting bids, partnerships, team
   roles) lead the list. */
export const OPP_TYPES = ["HPAIR", "Job", "Internship", "Fellowship", "Scholarship", "Resource", "Other"];
export const OPP_LABEL = { HPAIR: "HPAIR call" };
export const oppLabel = (t) => OPP_LABEL[t] || t || "Other";

export const EVENT_TYPES = [
  "Harvard Conference",
  "Asia Conference",
  "Virtual Conference",
  "Youth Leadership Summit",
  "Alumni gathering",
  "Other",
];

export const QUESTION_TYPES = {
  short: "Short answer",
  long: "Long answer",
  select: "Multiple choice",
  checkbox: "Checkboxes",
  file: "File upload",
};

/* HPAIR Asia Conference hosts, 1992 to 2026, as [year, city, country].
   Compiled from the public conference record (Wikipedia); hpair.org does not
   publish a past-host list. Alumni Relations should correct any entry that
   disagrees with HPAIR's own archive. */
export const ASIA_CONFERENCES = [
  [1992, "Taipei", "Taiwan"],
  [1993, "Hong Kong", "Hong Kong SAR"],
  [1994, "Manila", "Philippines"],
  [1995, "Jakarta", "Indonesia"],
  [1996, "Seoul", "South Korea"],
  [1997, "Bangkok", "Thailand"],
  [1998, "Kuala Lumpur", "Malaysia"],
  [1999, "Hong Kong", "Hong Kong SAR"],
  [2000, "Beijing", "China"],
  [2001, "Singapore", "Singapore"],
  [2002, "Sydney", "Australia"],
  [2003, "Seoul", "South Korea"],
  [2004, "Shanghai", "China"],
  [2005, "Tokyo", "Japan"],
  [2006, "Mumbai", "India"],
  [2006, "Singapore", "Singapore"],
  [2007, "Hong Kong", "Hong Kong SAR"],
  [2007, "Beijing", "China"],
  [2008, "Kuala Lumpur", "Malaysia"],
  [2009, "Tokyo", "Japan"],
  [2009, "Seoul", "South Korea"],
  [2010, "Singapore", "Singapore"],
  [2011, "Seoul", "South Korea"],
  [2012, "Taipei", "Taiwan"],
  [2013, "Dubai", "United Arab Emirates"],
  [2014, "Tokyo", "Japan"],
  [2015, "Manila", "Philippines"],
  [2016, "Hong Kong", "Hong Kong SAR"],
  [2017, "Sydney", "Australia"],
  [2018, "Kuala Lumpur", "Malaysia"],
  [2019, "Nur-Sultan", "Kazakhstan"],
  [2021, "Taipei", "Taiwan"],
  [2022, "New Delhi", "India"],
  [2023, "Hong Kong", "Hong Kong SAR"],
  [2024, "Bangkok", "Thailand"],
  [2025, "Tokyo", "Japan"],
  [2026, "Hanoi", "Vietnam"],
];

/* Labels alumni can attach to their profile under "Conferences attended". */
export function conferenceOptions(currentYear = new Date().getFullYear()) {
  const out = [];
  for (let y = currentYear + 1; y >= FACTS.founded; y--) out.push(`Harvard Conference ${y}`);
  for (const [y, city] of [...ASIA_CONFERENCES].reverse()) out.push(`Asia Conference ${y} (${city})`);
  for (let y = currentYear + 1; y >= 2020; y--) out.push(`Virtual Conference ${y}`);
  for (let y = currentYear + 1; y >= 2022; y--) out.push(`Youth Leadership Summit ${y}`);
  return out;
}

/* Presence: someone is "online" for this long after their last heartbeat. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const HEARTBEAT_MS = 60 * 1000;

/* Upload limits (mirrored in storage.rules). */
export const LIMITS = {
  headshotMB: 5,
  headshotPickMB: 12,
  attachmentMB: 8,
  bio: 600,
  oppDescription: 1500,
  milestone: 4000,
  caption: 200,
};
