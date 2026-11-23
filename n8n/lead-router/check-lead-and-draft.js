// Check Lead + Draft (Pass on leads helper)
// A port of the directory-ops "lead-routing" helper (Pass on leads) by Frey:
//   skills/lead-routing/check_lead.py  -> the email / phone / date checks
//   skills/lead-routing/REFERENCE.md   -> name, spam and business address checks
//   skills/lead-routing/TEMPLATES.md   -> Template A (first lead free) and B2 (paid, reply yes)
// Mode: draft only. Nothing here emails a business. The draft goes to Grant to approve.

// ---- Owner settings (helper rule 3: never invent these; fill them in once) ----
const OWNER = {
  first_name: 'Grant',
  postal_address: '12 Example St, Morisset',
  price_per_lead: '$25',
};

// ---- The 11 sites. site_source in the payload must match a key here. ----
const SITES = {
  'sydney-asbestos-pro':          { name: 'Sydney Asbestos Pro',          niche: 'asbestos removal companies', request: 'asbestos removal', repo: 'sydneyasbestospro', built: true },
  'sydney-bond-clean-pro':        { name: 'Sydney Bond Clean Pro',        niche: 'bond cleaners',              request: 'bond cleaning',    repo: 'sydneybondcleanpro', built: true },
  'sydney-skip-bin-pro':          { name: 'Sydney Skip Bin Pro',          niche: 'skip bin companies',         request: 'skip bin',         repo: 'sydneyskipbinpro', built: true },
  'sydney-tree-removal-pro':      { name: 'Sydney Tree Removal Pro',      niche: 'tree removal companies',     request: 'tree removal',     repo: 'sydneytreeremovalpro', built: true },
  'central-coast-asbestos-pro':   { name: 'Central Coast Asbestos Pro',   niche: 'asbestos removal companies', request: 'asbestos removal', repo: 'centralcoastasbestospro', built: true },
  'central-coast-bond-clean-pro': { name: 'Central Coast Bond Clean Pro', niche: 'bond cleaners',              request: 'bond cleaning',    repo: 'centralcoastbondcleanpro', built: true },
  'central-coast-skip-bin-pro':   { name: 'Central Coast Skip Bin Pro',   niche: 'skip bin companies',         request: 'skip bin',         repo: 'centralcoastskipbinpro', built: true },
  'newcastle-asbestos-pro':       { name: 'Newcastle Asbestos Pro',       niche: 'asbestos removal companies', request: 'asbestos removal', repo: 'newcastleasbestospro', built: true },
  'newcastle-bond-clean-pro':     { name: 'Newcastle Bond Clean Pro',     niche: 'bond cleaners',              request: 'bond cleaning',    repo: 'newcastlebondcleanpro', built: true },
  'newcastle-skip-bin-pro':       { name: 'Newcastle Skip Bin Pro',       niche: 'skip bin companies',         request: 'skip bin',         repo: 'newcastleskipbinpro', built: true },
  'morisset-directory':           { name: 'Morisset Directory',           niche: 'local trades',               request: 'trade',            repo: 'morissetdirectory', built: false },
};

const lead = { ...$('Normalize Lead Data').item.json };
const dns = $json || {};
const order = { pass: 0, review: 1, skip: 2, reject: 3 };
let verdict = 'pass';
const reasons = [];
const worse = (v, why) => { if (order[v] > order[verdict]) verdict = v; if (why) reasons.push(why); };

// ---- Site ----
const siteKey = String(lead.site_source || '').replace(/^TEST\s+/i, '').trim().toLowerCase();
const site = SITES[siteKey];
if (!site) worse('review', 'unknown site_source "' + lead.site_source + '" (not one of the 11 sites)');
if (site && !site.built) reasons.push(site.name + ' is not built yet (frozen until 1 Mar 2027), so this lead came from a test or a manual post');

// ---- check_lead.py: email ----
const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
const email = String(lead.lead_email || '').trim();
if (!email) {
  worse('review', 'no email given (phone only lead)');
} else if (!EMAIL_RE.test(email)) {
  worse('reject', 'email format is not valid');
} else if (!dns || dns.Status === undefined) {
  worse('review', "couldn't check the email domain (DNS lookup failed)");
} else {
  const answers = (dns.Answer || []).filter(a => a.type === 15);
  const real = answers.filter(a => !/^0\s+\.?$/.test(String(a.data || '').trim()));
  if (real.length === 0) worse('reject', "email domain can't receive mail (no MX record)");
}

// ---- check_lead.py: phone (non US rule: 7 to 15 digits) ----
const phone = String(lead.lead_phone || '').trim();
if (!phone) {
  reasons.push('no phone number (route by email)');
} else {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) worse('reject', 'phone has the wrong number of digits');
  else if (new Set(digits).size === 1) worse('reject', 'phone is one repeated digit');
}

// ---- check_lead.py: needed by date (only when the form sends a real date) ----
const tf = String(lead.timeframe || '');
if (/^\d{4}-\d{2}-\d{2}/.test(tf)) {
  const d = new Date(tf.slice(0, 10));
  const today = new Date(new Date().toISOString().slice(0, 10));
  if (d < today) worse('skip', 'needed-by date already passed');
  else if (d - today > 548 * 864e5) worse('review', 'needed-by date is more than 18 months away');
}

// ---- REFERENCE.md quality check: name and spam ----
const name = String(lead.lead_name || '').trim();
if (name.length < 2) worse('reject', 'name is missing or a single letter');
else if (/^(test|asdf|qwerty|aaa+|xxx+|n\/?a)$/i.test(name)) worse('reject', 'name looks fake');
const msg = String(lead.lead_message || '');
if (/https?:\/\/|www\./i.test(msg)) worse('reject', 'message has links (spam)');
if (/\b(seo|backlinks?|crypto|casino|loan offer|web design services)\b/i.test(msg)) worse('reject', 'message is a sales pitch (spam)');
if (!lead.suburb) worse('review', 'no suburb or location given');

// ---- REFERENCE.md address sanity check for the business ----
let bizEmail = String(lead.listing_contact_email || '').trim().toLowerCase();
let bizNote = '';
if (bizEmail && (!EMAIL_RE.test(bizEmail) || /(^|[.@])(test|demo|example)[.@-]|noreply|no-reply|donotreply|careers|billing|privacy/.test(bizEmail))) {
  bizNote = 'business email "' + bizEmail + '" looks like a placeholder, test or no-reply address, so it is not used';
  bizEmail = '';
}

// ---- Route ----
const isTest = lead.is_test === true || lead.is_test === 'true';
let route;
if (verdict !== 'pass') route = 'hold';
else if (!bizEmail) route = 'no_business';
else route = 'draft';

// ---- One free lead per business (helper rule 2; drafts count) ----
const store = $getWorkflowStaticData('global');
store.freeLeads = store.freeLeads || {};
const alreadyFree = !!store.freeLeads[bizEmail];
const template = route === 'draft' ? (alreadyFree ? 'B2' : 'A') : '';
if (route === 'draft' && template === 'A' && !isTest) {
  store.freeLeads[bizEmail] = { site: siteKey, at: new Date().toISOString(), lead: name };
}

// ---- TEMPLATES.md (no em dashes, no hyphen ranges, stop line + postal address) ----
const siteName = site ? site.name : 'our directory';
const clean = v => { const s = String(v || '').trim(); return /^(other|not sure|n\/?a|none|-)$/i.test(s) ? '' : s; };
const details = [
  ['Service', clean(lead.service)],
  ['Property type', clean(lead.property_type)],
  ['Timeframe', clean(lead.timeframe)],
].filter(p => p[1]).map(p => p[0] + ': ' + p[1]).join('\n');
const requestType = (clean(lead.service) || (site ? site.request : 'quote')).toLowerCase();
const subject = 'New ' + requestType + ' request in ' + (lead.suburb || 'your area');
const whoLine = lead.company_slug
  ? 'A customer chose you on ' + siteName + ' and asked for a quote'
  : 'Someone near you just asked for a quote';
const footer = OWNER.first_name + '\n' + siteName + '\n' + OWNER.postal_address + '\n\nReply "stop" and I won\'t email you again.';
let body = '';
if (template === 'A') {
  body = [
    'Hi ' + (lead.listing_business || 'there') + ' team,', '',
    'I run ' + siteName + ', a directory of ' + (site ? site.niche : 'local trades') + '. ' + whoLine + ', and I want to send it to you for free.', '',
    ['Name: ' + name, phone && 'Phone: ' + phone, email && 'Email: ' + email, 'Location: ' + lead.suburb + ', NSW', details, msg && 'Notes: ' + msg].filter(Boolean).join('\n'), '',
    "No catch. If it's a good fit, I can send you more requests in your area. After this one, each lead is " + OWNER.price_per_lead + ', and you only pay for the ones you want. Just reply "yes" and I\'ll keep them coming.', '',
    footer,
  ].join('\n');
} else if (template === 'B2') {
  body = [
    'Hi ' + (lead.listing_business || 'there') + ' team,', '',
    'New request near you on ' + siteName + ':', '',
    ['Location: ' + lead.suburb + ', NSW', details].filter(Boolean).join('\n'), '',
    "Want the customer's name, phone and email? Reply \"yes\" and I'll send them over with an invoice for " + OWNER.price_per_lead + '.', '',
    footer,
  ].join('\n');
}
body = body.replace(/—|–/g, ',');

return {
  json: {
    ...lead,
    site_key: siteKey,
    site_name: siteName,
    site_built: site ? site.built : false,
    site_repo: site ? site.repo : '',
    is_test: isTest,
    sheet_site_source: (isTest ? 'TEST ' : '') + (siteKey || lead.site_source || 'unknown'),
    verdict,
    reasons: reasons.join('; '),
    biz_email: bizEmail,
    biz_note: bizNote,
    route,
    template,
    already_had_free_lead: alreadyFree,
    draft_to: bizEmail,
    draft_subject: subject,
    draft_body: body,
  },
};
