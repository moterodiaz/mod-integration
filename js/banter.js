// Shared by index.html, apply/index.html and admin/index.html.
// One place for the project URL/key so rotation is one edit, and one
// renderTimeline() so the admin's Preview shows exactly what visitors see.

export const SUPABASE_URL = 'https://lvnfhgsmwtwztlgmxtap.supabase.co';
// Legacy anon JWT — public by design. submit-response runs verify_jwt=true
// and requires a real JWT, so a sb_publishable_ key will NOT work here.
// It grants exactly what RLS/table grants allow anon: select on site_config,
// nothing on survey_responses or matches.
// The SERVICE ROLE key must never appear in this repo.
export const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bmZoZ3Ntd3R3enRsZ214dGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNzE2MDAsImV4cCI6MjEwNDY0NzYwMH0.iAzBg2UcSMyZ-K1d5aWfKvvHe0H6rq_waUQVw_0gS0k';

// Exported so admin/index.html validates admin-entered links against the
// same allow-list this file uses to decide what the public page renders as
// a link, rather than keeping a second copy of the pattern in sync by hand.
export const SAFE_HREF = /^(https?:|\/|mailto:)/;

export const todayET = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

export function deriveDeadlines(milestones, prev = {}) {
  const derived = {};
  for (const m of milestones || []) {
    const date = m.date;
    for (const cell of m.cells || []) {
      const match = cell.href?.match(/\/apply\/?\?cohort=([a-z_]+)/);
      if (!match) continue;
      const role = match[1];
      const d = derived[role] || (derived[role] = {});
      if (m.end) d.open = !d.open || date < d.open ? date : d.open;
      d.close = !d.close || (m.end || date) > d.close ? (m.end || date) : d.close;
    }
  }
  for (const [role, deadlines] of Object.entries(prev)) {
    if (!derived[role]) derived[role] = deadlines;
  }
  for (const role of Object.keys(derived)) {
    if (derived[role] && prev[role]) derived[role].open ??= prev[role].open;
  }
  if (derived.mentor_alums) derived.alumni = derived.mentor_alums;
  return derived;
}

function ordinal(n) {
  return n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const month = new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${month} ${ordinal(d)}`;
}

export async function loadCycle() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/site_config?key=eq.banter_cycle&select=value`,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        // Exactly one row expected; a missing/duplicated row 406s instead of
        // silently rendering an empty table.
        Accept: 'application/vnd.pgrst.object+json',
      },
    },
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const body = await res.json();
  return body.value;
}

/** Renders `cycle` (the shape loadCycle() returns) into `table`, an element
 *  that already has a <thead> and a <tbody>. Rebuilds both from scratch. */
export function renderTimeline(table, cycle) {
  const thead = table.tHead;
  const tbody = table.tBodies[0];
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headRow = thead.insertRow();
  const dateHeader = document.createElement('th');
  dateHeader.scope = 'col';
  dateHeader.textContent = `Date (${cycle.year})`;
  headRow.appendChild(dateHeader);
  for (const col of cycle.columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = col;
    headRow.appendChild(th);
  }

  const today = todayET();
  const currentIdx = cycle.milestones.findIndex((m) => (m.end || m.date) >= today);

  cycle.milestones.forEach((m, i) => {
    const tr = tbody.insertRow();
    if (currentIdx === -1 || i < currentIdx) tr.className = 'past';
    else if (i === currentIdx) tr.className = 'current';

    const dateCell = tr.insertCell();
    dateCell.textContent = m.display || `${formatDate(m.date)}${m.end ? ` – ${formatDate(m.end)}` : ''}`;

    for (let c = 0; c < cycle.columns.length; c++) {
      const cell = m.cells[c] || {};
      const td = tr.insertCell();
      if (!cell.label) continue;
      if (cell.href && SAFE_HREF.test(cell.href)) {
        const a = document.createElement('a');
        a.href = cell.href;
        a.textContent = cell.label;
        td.appendChild(a);
      } else {
        td.textContent = cell.label;
      }
    }
  });

  table.setAttribute('aria-busy', 'false');
}

export function renderTimelineError(table, err) {
  const tbody = table.tBodies[0];
  tbody.innerHTML = '';
  const td = tbody.insertRow().insertCell();
  td.colSpan = (table.tHead?.rows[0]?.cells.length) || 4;
  const strong = document.createElement('strong');
  strong.textContent = "We couldn't load this year's dates just now. ";
  td.appendChild(strong);
  td.append('Please try reloading, or email ');
  const a = document.createElement('a');
  a.href = 'mailto:banter@olin.edu';
  a.textContent = 'banter@olin.edu';
  td.appendChild(a);
  td.append(' and we\'ll send them to you.');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Technical details';
  const code = document.createElement('code');
  code.textContent = String(err);
  details.append(summary, code);
  td.appendChild(details);
  table.setAttribute('aria-busy', 'false');
}


export function renderFaq(container, cycle) {
  if (!cycle.faq?.length) return;
  container.replaceChildren();
  function appendText(parent, text) {
    const pattern = /(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      parent.append(document.createTextNode(text.slice(last, match.index)));
      let value = match[0].replace(/["'>.,!?;:]+$/, '');
      while ((value.match(/\)/g) || []).length > (value.match(/\(/g) || []).length) value = value.slice(0, -1);
      const href = value.includes('@') ? `mailto:${value}` : value;
      if (SAFE_HREF.test(href)) { const a = document.createElement('a'); a.href = href; a.textContent = value; parent.append(a); }
      else parent.append(document.createTextNode(value));
      parent.append(document.createTextNode(match[0].slice(value.length)));
      last = match.index + match[0].length;
    }
    parent.append(document.createTextNode(text.slice(last)));
  }
  for (const item of cycle.faq) {
    const h = document.createElement('h5'); h.textContent = item.q || ''; container.append(h);
    for (const paragraph of (item.a || '').split(/\n\s*\n/).filter(Boolean)) {
      const p = document.createElement('p'); appendText(p, paragraph); container.append(p);
    }
  }
  for (const paragraph of (cycle.faq_footer || '').split(/\n\s*\n/).filter(Boolean)) {
    const p = document.createElement('p'); appendText(p, paragraph); container.append(p);
  }
}
