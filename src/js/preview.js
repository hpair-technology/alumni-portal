/* ============================================================================
   Design preview (development only)
   ----------------------------------------------------------------------------
   `npm run dev`, then open /portal?preview=admin or /portal?preview=member to
   see the signed-in portal filled with sample data and no Firebase account.
   Vite strips this module from production builds: portal.js only imports it
   when import.meta.env.DEV is true. Every person below is fictional.
   ========================================================================== */
import {
  state, Users, Presence, Opportunities, Milestones, Events, Photos, Submissions, AmbConfig, FormsConfig,
} from "./state.js";

const day = 86_400_000;
const ago = (d) => Date.now() - d * day;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const IMG = `${location.origin}/img/aconf-delegates.jpg`;

const ME = { uid: "preview-me", email: "preview@hpair.org", displayName: "Eleanor Whitfield", emailVerified: true };

const USERS = [
  { id: "preview-me", email: "preview@hpair.org", name: "Eleanor Whitfield", gradYear: 2015, title: "Alumni Relations", company: "HPAIR", location: "Cambridge", country: "United States", industries: ["Non-Profit/Social Enterprise"], conferences: ["Harvard Conference 2015", "Asia Conference 2015 (Manila)"], mentoring: "mentor", bio: "Delegate 2015, staff 2016. I run alumni@hpair.org.", linkedin: "https://www.linkedin.com/in/example", showEmail: true, createdAt: ago(400), role: "" },
  { id: "u1", email: "m.tanaka@example.jp", name: "Mei-Lin Tanaka", gradYear: 2012, title: "Senior Policy Adviser", company: "Ministry of Foreign Affairs", location: "Tokyo", country: "Japan", industries: ["Government/Politics"], conferences: ["Asia Conference 2012 (Taipei)", "Harvard Conference 2013"], mentoring: "mentor", bio: "Trade policy. Happy to talk about the foreign service.", linkedin: "https://www.linkedin.com/in/example", showEmail: true, createdAt: ago(300) },
  { id: "u2", email: "arjun@example.sg", name: "Arjun Mehta", gradYear: 2016, title: "Principal", company: "Temasek", location: "Singapore", country: "Singapore", industries: ["Financial Services (including Private Equity/Hedge Funds)"], conferences: ["Asia Conference 2016 (Hong Kong)"], mentoring: "both", bio: "Infrastructure investing, Southeast Asia.", showEmail: true, createdAt: ago(120) },
  { id: "u3", email: "sofia@example.ph", name: "Sofia Reyes", gradYear: 2019, title: "Reporter", company: "Rappler", location: "Manila", country: "Philippines", industries: ["Media"], conferences: ["Harvard Conference 2019", "Asia Conference 2024 (Bangkok)"], mentoring: "", bio: "", showEmail: false, createdAt: ago(80) },
  { id: "u4", email: "d.okafor@example.co.uk", name: "Daniel Okafor", gradYear: 2009, title: "Partner", company: "Bain & Company", location: "London", country: "United Kingdom", industries: ["Management Consulting"], conferences: ["Asia Conference 2009 (Tokyo)"], mentoring: "mentor", bio: "", showEmail: true, createdAt: ago(600) },
  { id: "u5", email: "hana.kim@example.kr", name: "Hana Kim", gradYear: 2021, title: "PhD candidate", company: "Seoul National University", location: "Seoul", country: "South Korea", industries: ["Academia/Research"], conferences: ["Asia Conference 2021 (Taipei)"], mentoring: "mentee", bio: "International relations. Interested in think-tank fellowships in the US.", showEmail: true, createdAt: ago(40) },
  { id: "u6", email: "an.nguyen@example.vn", name: "Nguyen Thanh An", gradYear: 2026, title: "Co-founder", company: "Vinh Logistics", location: "Hanoi", country: "Vietnam", industries: ["Entrepreneurship"], conferences: ["Asia Conference 2026 (Hanoi)"], mentoring: "mentee", bio: "", showEmail: true, createdAt: ago(9) },
  { id: "u7", email: "priya@example.in", name: "Priya Raman", gradYear: 2022, title: "Associate", company: "Clifford Chance", location: "New Delhi", country: "India", industries: ["Law"], conferences: ["Asia Conference 2022 (New Delhi)", "Harvard Conference 2023"], mentoring: "", bio: "M&A. Delegate experience team, New Delhi 2022.", showEmail: true, createdAt: ago(200) },
  { id: "u8", email: "lucas@example.ch", name: "Lucas Fernández", gradYear: 2014, title: "Programme Officer", company: "World Health Organization", location: "Geneva", country: "Switzerland", industries: ["Healthcare"], conferences: ["Asia Conference 2014 (Tokyo)"], mentoring: "mentor", bio: "", showEmail: true, createdAt: ago(500) },
  { id: "u9", email: "aisha@example.my", name: "Aisha Rahman", gradYear: 2018, title: "Product Manager", company: "Grab", location: "Kuala Lumpur", country: "Malaysia", industries: ["Technology"], conferences: ["Asia Conference 2018 (Kuala Lumpur)"], mentoring: "both", bio: "Payments. Was on the logistics team for KL 2018.", showEmail: true, createdAt: ago(150) },
];

const OPPS = [
  { id: "o1", type: "HPAIR", title: "Host city bids, Asia Conference 2028", org: "HPAIR", location: "Asia-Pacific", deadline: iso(60), description: "Universities and partner institutions can bid to host the 2028 Asia Conference. Requirements and the bid form are on hpair.org.", link: "https://www.hpair.org/host-aconf", posterUid: "preview-me", posterEmail: "preview@hpair.org", posterName: "Eleanor Whitfield", createdAt: ago(3) },
  { id: "o2", type: "Job", title: "Policy Analyst, Indo-Pacific", org: "Asia Society Policy Institute", location: "New York or remote", deadline: iso(21), description: "Two-year position. Trade and technology policy. Japanese or Mandarin helpful.", link: "https://example.org", posterUid: "u1", posterEmail: "m.tanaka@example.jp", posterName: "Mei-Lin Tanaka", createdAt: ago(6) },
  { id: "o3", type: "Fellowship", title: "Schwarzman Scholars 2027–28", org: "Tsinghua University", location: "Beijing", deadline: iso(35), description: "One-year master's in global affairs, fully funded. A few HPAIR alumni have done it and can answer questions.", link: "https://www.schwarzmanscholars.org", posterUid: "u4", posterEmail: "d.okafor@example.co.uk", posterName: "Daniel Okafor", createdAt: ago(12) },
  { id: "o4", type: "Internship", title: "Summer Analyst, Infrastructure", org: "Temasek", location: "Singapore", deadline: iso(-4), description: "Ten weeks from June. Penultimate-year undergraduates.", posterUid: "u2", posterEmail: "arjun@example.sg", posterName: "Arjun Mehta", createdAt: ago(40) },
];

const MILESTONES = [
  { id: "m1", title: "Asia Conference 2026, Hanoi", authorName: "Eleanor Whitfield", createdAt: ago(20), content: "The conference ran 19 to 23 August with 480 delegates from 41 countries and 62 speakers.\n\nThank you to the alumni who spoke and who hosted dinners. Photographs will be added to the library over the next few weeks. If you took any, please submit them.\n\nHarvard Conference 2027 dates are on the Conferences tab." },
  { id: "m2", title: "New board", authorName: "Co-Presidents", createdAt: ago(75), content: "The 2026–27 board took office this month.\n\nThis portal replaces the old alumni mailing list. Please fill in your profile and post any openings you know of. Questions to alumni@hpair.org." },
];

const EVENTS = [
  { id: "e1", type: "Harvard Conference", title: "Harvard Conference 2027", city: "Cambridge", country: "United States", startDate: iso(140), endDate: iso(143), format: "In person", link: "https://www.hpair.org/hconf", description: "Applications open in November." },
  { id: "e2", type: "Alumni gathering", title: "Alumni dinner, Singapore", city: "Singapore", country: "Singapore", startDate: iso(52), endDate: "", format: "In person", link: "", description: "Details by email." },
  { id: "e3", type: "Asia Conference", title: "Asia Conference 2027", city: "To be announced", country: "", startDate: iso(330), endDate: iso(334), format: "In person", link: "https://www.hpair.org/aconf", description: "" },
  { id: "e0", type: "Virtual Conference", title: "Virtual Conference 2026", city: "", country: "", startDate: iso(-33), endDate: iso(-31), format: "Online", link: "https://www.hpair.org/vconf", description: "" },
];

const PHOTOS = [
  { id: "p1", imageUrl: IMG, caption: "Performance Night", city: "Hanoi", year: 2026, uploaderUid: "preview-me", uploaderName: "Eleanor Whitfield", status: "published", createdAt: ago(10) },
  { id: "p2", imageUrl: IMG, caption: "Closing ceremony", city: "Bangkok", year: 2024, uploaderUid: "u3", uploaderName: "Sofia Reyes", status: "published", createdAt: ago(300) },
  { id: "p3", imageUrl: IMG, caption: "Trade panel", city: "Hanoi", year: 2026, uploaderUid: "u6", uploaderName: "Nguyen Thanh An", status: "pending", createdAt: ago(2) },
];

const AMB = { open: true, questions: [
  { id: "qa", label: "Which city or region would you represent?", type: "short", required: true, options: [] },
  { id: "qb", label: "Why do you want to be an ambassador?", type: "long", required: true, options: [] },
  { id: "qc", label: "How much time can you give each month?", type: "select", required: true, options: ["A few hours", "Half a day", "A day or more"] },
] };

const SUBMISSIONS = [
  { id: "u9", uid: "u9", email: "aisha@example.my", name: "Aisha Rahman", questions: AMB.questions.map((q) => q.label), answers: { q_0: "Kuala Lumpur", q_1: "I already meet KL alumni informally a couple of times a year. I would organise a dinner each term and keep a list of who is in the city.", q_2: "Half a day" }, submittedAt: ago(5), status: "new", createdAt: ago(5) },
  { id: "u5", uid: "u5", email: "hana.kim@example.kr", name: "Hana Kim", questions: AMB.questions.map((q) => q.label), answers: { q_0: "Seoul", q_1: "There are many alumni in Seoul and no one is coordinating. I would start with a list and one meeting.", q_2: "A few hours" }, submittedAt: ago(14), status: "reviewing", createdAt: ago(14) },
];

function fill(col, items) {
  col.items = items;
  col.ready = true;
  col.started = true;   // start() becomes a no-op
  col.mode = "local";
}

export function startPreview(mode, { enterShell }) {
  const admin = mode === "admin";
  state.user = ME;
  state.profile = { ...USERS[0], role: admin ? "admin" : "" };
  state.mySubmission = null;

  fill(Users, USERS);
  fill(Presence, [
    { id: "preview-me", status: "online", lastSeen: Date.now() },
    { id: "u2", status: "online", lastSeen: Date.now() - 60_000 },
    { id: "u6", status: "online", lastSeen: Date.now() - 120_000 },
  ]);
  fill(Opportunities, OPPS);
  fill(Milestones, MILESTONES);
  fill(Events, EVENTS);
  fill(Photos, PHOTOS);
  fill(Submissions, admin ? SUBMISSIONS : []);
  AmbConfig.data = AMB; AmbConfig.started = true; AmbConfig.mode = "local";
  FormsConfig.data = { feedbackUrl: "" }; FormsConfig.started = true; FormsConfig.mode = "local";

  document.title = `Preview · ${document.title}`;
  enterShell({ forceAdmin: admin });
}
