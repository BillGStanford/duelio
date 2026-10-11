// End-to-end smoke test against a running server.
// Usage: BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... node tests/smoke.mjs
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
  if (!cond) failed++;
};

class Jar {
  c = {};
  set(res) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (v === '' ) delete this.c[k]; else this.c[k] = v;
    }
  }
  header() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join('; '); }
}
async function req(path, { jar, method = 'GET', json, form, headers = {}, redirect = 'manual', omitGuess = false } = {}) {
  const h = { ...headers };
  if (jar?.header()) h.cookie = jar.header();
  let body;
  if (path === '/api/vote' && !omitGuess && json && typeof json === 'object' && (json.side === 'a' || json.side === 'b')) {
    json = { ...json, guessedPctA: json.guessedPctA ?? 50 };
  }
  if (json !== undefined) { h['content-type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) { body = new URLSearchParams(form); }
  const res = await fetch(BASE + path, { method, headers: h, body, redirect });
  jar?.set(res);
  return res;
}

const voter = new Jar();

// pages
let r = await req('/');
let html = await r.text();
ok('homepage 200', r.status === 200);
ok('homepage names Duelio and shows headline', html.includes('Duelio') && html.includes('The internet disagrees with you.'));
ok('homepage has a social preview image', html.includes('property="og:image"') && html.includes('/opengraph-image'));
ok("homepage explains today's duel and shows yesterday result", html.includes("Today's dilemma") && html.includes('Read the dilemma and vote') && html.includes("Yesterday's result"));
ok('homepage provides clear navigation and side labels', html.includes('aria-label="Explore Duelio"') && html.includes('Browse dilemmas') && html.includes('Side A:') && html.includes('Side B:'));
ok('homepage shows seven dilemmas', (html.match(/View debate/g) || []).length >= 7, String((html.match(/View debate/g) || []).length));
const visibleHomepage = html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/Pick a side/g, '');
ok('no old branding on homepage', !/settle ?this|pick a side/i.test(visibleHomepage), 'found old brand string');
const dailySlug = html.match(/<section id="daily-duel"[\s\S]*?href="\/d\/([^"]+)"/)?.[1];
const yesterdaySlug = html.match(/id="yesterday-heading"[\s\S]*?href="\/d\/([^"]+)"/)?.[1];
const seededSlugs = [
  'roommate-electricity',
  'next-episode',
  'album-vs-streaming',
  'group-chat-lurker',
  'restaurant-check',
  'shoes-at-the-door',
  'long-voice-note',
];
const openSlugs = seededSlugs.filter((slug) => slug !== dailySlug && slug !== yesterdaySlug);
const [primarySlug, secondSlug, thirdSlug, fourthSlug, roomSlug] = openSlugs;
ok('daily and previous prompts are distinct', !!dailySlug && !!yesterdaySlug && dailySlug !== yesterdaySlug);
r = await req('/daily-duel.svg');
ok('locally generated daily illustration is served', r.status === 200 && (r.headers.get('content-type') || '').includes('image/svg+xml'));
r = await req('/api/vote', { method: 'POST', json: { slug: yesterdaySlug, side: 'a' } });
ok('yesterday daily vote is closed', r.status === 409, String(r.status));

r = await req(`/d/${primarySlug}`, { jar: voter });
html = await r.text();
ok('dilemma page 200', r.status === 200);
ok('dilemma prompt renders without decorative hero artwork', !html.includes('/debate-mural.svg'));
ok('canonical tag', html.includes('rel="canonical"') && html.includes(`/d/${primarySlug}`));
ok('og:title and og:image present', html.includes('og:title') && html.includes('og:image'));
ok('twitter card present', html.includes('twitter:card'));
// next/script injects the <script> in the browser; the server HTML carries the mount point and a preload hint.
ok('threadline mount point and script preload rendered from env', html.includes('id="threadline-comments"') && html.includes('https://www.threadline.ink/api/embed'));
ok('discussion prompt appears before the comments widget', html.indexOf('Join the discussion') < html.indexOf('id="threadline-comments"'));
ok('duplicate Threadline promotions are removed', !html.includes('Discussion powered by Threadline') && !html.includes('Want this discussion experience'));
ok('defense text input is removed', !html.includes('The best case for'));
ok('threadline fallback not shown when env is set', !html.includes('discussion is unavailable'));
ok('results hidden before voting', !/\d+% Yes/.test(html));
ok('Threadline attribution remains in the site footer', html.includes('Discussions powered by') && html.includes('href="https://www.threadline.ink"'));
ok('specific opening discussion question is rendered', html.includes('What would change your answer?'));

r = await req('/d/does-not-exist');
ok('unknown slug 404', r.status === 404);
r = await req('/d/' + encodeURIComponent("x'; drop table dilemmas;--"));
ok('malicious slug 404', r.status === 404);

r = await req('/d/roommate-electricity/opengraph-image');
ok('og image renders as png', r.status === 200 && (r.headers.get('content-type') || '').includes('image/png'), `${r.status} ${r.headers.get('content-type')}`);
r = await req('/opengraph-image');
ok('homepage social preview renders as png', r.status === 200 && (r.headers.get('content-type') || '').includes('image/png'), `${r.status} ${r.headers.get('content-type')}`);

for (const p of ['/submit', '/guidelines', '/robots.txt', '/sitemap.xml']) {
  r = await req(p);
  ok(`${p} 200`, r.status === 200);
}

// voting
r = await req('/api/vote', { jar: voter, method: 'POST', json: { slug: primarySlug, side: 'a', voterName: 'Rae' } });
let data = await r.json();
ok('vote accepted', r.status === 200 && data.ok && !data.duplicate && data.results.total === 1, JSON.stringify(data));
ok('public nickname is stored with vote', data.namedVotes?.some((vote) => vote.name === 'Rae' && vote.side === 'a'));
ok('crowd prediction is stored with the vote', data.crowdPrediction?.count === 1 && data.crowdPrediction?.averagePctA === 50);
ok('voter cookie is httpOnly', (r.headers.getSetCookie().join(';')).toLowerCase().includes('httponly'));
r = await req('/api/defense', { jar: voter, method: 'POST', json: { action: 'submit', slug: primarySlug, side: 'b', body: 'The other side has a fair point.' } });
data = await r.json();
ok('voter can submit one defense for the other side', r.status === 200 && data.defense?.side === 'b');
r = await req('/api/defense', { jar: voter, method: 'POST', json: { action: 'submit', slug: primarySlug, side: 'b', body: 'Another fair point from the other side.' } });
ok('second defense from same voter is rejected', r.status === 409);
r = await req('/api/vote', { jar: voter, method: 'POST', json: { slug: primarySlug, side: 'b' } });
data = await r.json();
ok('repeat vote flagged duplicate and not counted', data.duplicate === true && data.side === 'a' && data.results.total === 1, JSON.stringify(data));
r = await req('/api/vote', { jar: voter, method: 'POST', json: { slug: secondSlug, side: 'a' } });
data = await r.json();
ok('second distinct dilemma is tracked', r.status === 200 && data.secondDilemma === true, JSON.stringify(data));

const other = new Jar();
r = await req('/api/vote', { jar: other, method: 'POST', json: { slug: primarySlug, side: 'b' } });
data = await r.json();
ok('second voter counted, 50/50 split', data.results.total === 2 && data.results.pctA === 50, JSON.stringify(data));

r = await req(`/d/${primarySlug}`, { jar: voter });
html = await r.text();
ok('after refresh, vote state persists and result shown', html.includes('Your pick') && html.includes('50%'));
ok(
  'vote card preview is visible without opening a disclosure',
  html.includes('Make a vote card') &&
    html.includes(`/card/${primarySlug}/a?fmt=square`) &&
    !/<details[^>]*>[\s\S]*?Make a vote card/.test(html),
);
const visibleHtml = html.replace(/<!--.*?-->/g, '');
ok('public voter name is rendered beside the selected side', visibleHtml.includes('Votes by name') && visibleHtml.includes('Rae picked'));

for (const [name, body] of [
  ['bad side', { slug: primarySlug, side: 'c' }],
  ['bad slug', { slug: '../x', side: 'a' }],
  ['missing body fields', {}],
]) {
  r = await req('/api/vote', { jar: new Jar(), method: 'POST', json: body });
  ok(`vote rejects ${name}`, r.status === 400, String(r.status));
}
r = await req('/api/vote', { jar: new Jar(), method: 'POST', json: { slug: 'nope-nope', side: 'a' } });
ok('vote on unknown dilemma 404', r.status === 404);
r = await req('/api/vote', { jar: new Jar(), method: 'POST', body: 'x'.repeat(20000), headers: { 'content-type': 'application/json' } });
ok('oversized body rejected', r.status === 400, String(r.status));
r = await req('/api/vote', { jar: new Jar(), method: 'POST', json: { slug: primarySlug, side: 'a' }, headers: { origin: 'https://evil.example' } });
ok('cross-site origin blocked', r.status === 403, String(r.status));
r = await req('/api/vote', { jar: new Jar(), method: 'POST', json: { slug: primarySlug, side: 'a' }, omitGuess: true });
ok('vote requires a crowd prediction first', r.status === 422, String(r.status));

// submissions
r = await req('/api/submit', { method: 'POST', json: { question: 'Should couples share their phone passwords?', sideA: 'Yes. Transparency matters.', sideB: 'No. Privacy still matters.', context: '', submitterName: 'Sam' } });
let submission = await r.json();
ok('submission accepted and published', r.status === 200 && submission.ok && submission.slug === 'should-couples-share-their-phone-passwords', JSON.stringify(submission));
r = await req(`/d/${submission.slug}`);
ok('submitted dilemma is immediately public', r.status === 200, String(r.status));
r = await req('/');
html = await r.text();
ok('submitted dilemma appears in the main feed', html.includes('Should couples share their phone passwords?'));
r = await req('/?q=passwords');
html = await r.text();
ok('homepage search finds submitted dilemmas', html.includes('Should couples share their phone passwords?') && html.includes('1 result for'));
r = await req('/api/submit', { method: 'POST', json: { question: 'Does coffee belong in the refrigerator?', sideA: 'Yes. It stays fresh and cold.', sideB: 'No. A sealed container keeps it fresh.' } });
const hotSubmission = await r.json();
ok('second dilemma accepted for pin test', r.status === 200 && hotSubmission.ok);
for (let i = 0; i < 10; i++) {
  r = await req('/api/vote', {
    jar: new Jar(),
    method: 'POST',
    json: { slug: hotSubmission.slug, side: i % 2 === 0 ? 'a' : 'b' },
  });
  if (r.status !== 200) {
    ok('hot dilemma received ten votes', false, String(r.status));
    break;
  }
}
r = await req('/');
html = await r.text();
const visibleHotHtml = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');
const hotQuestionOccurrences = visibleHotHtml.split('Does coffee belong in the refrigerator?').length - 1;
ok('high-vote dilemma is pinned and remains in the full feed', visibleHotHtml.includes('Hot · 10 votes') && hotQuestionOccurrences >= 2, String(hotQuestionOccurrences));
r = await req('/api/submit', { method: 'POST', json: { question: 'Should couples share their phone passwords?', sideA: 'Email me at a@b.com', sideB: 'No. Privacy still matters.' } });
ok('submission with email rejected', r.status === 422);
r = await req('/api/submit', { method: 'POST', json: { question: '<script>alert(1)</script> is this ok??', sideA: 'x'.repeat(500), sideB: 'No.' } });
ok('oversized submission rejected', r.status === 422);
r = await req('/api/submit', { method: 'POST', json: { question: 'Bots fill every field in forms', sideA: 'Yes they do', sideB: 'No they dont', website: 'http://spam' } });
ok('honeypot silently accepted', r.status === 200);

// reports
r = await req('/api/report', { method: 'POST', json: { slug: 'next-episode', targetType: 'discussion', reason: 'A comment from "Sam" is abusive' } });
ok('report accepted', r.status === 200, String(r.status));
r = await req('/api/report', { method: 'POST', json: { slug: 'next-episode', targetType: 'nope', reason: 'x' } });
ok('bad report rejected', r.status === 422);

// events
r = await req('/api/events', { method: 'POST', json: { name: 'share_clicked', props: { slug: 'next-episode', method: 'copy' } } });
ok('event accepted', r.status === 200);
r = await req('/api/events', { method: 'POST', json: { name: 'share_copy_a_started' } });
ok('share-copy experiment event accepted', r.status === 200);
r = await req('/api/events', { method: 'POST', json: { name: 'second_dilemma_vote', props: { slug: secondSlug } } });
ok('second-dilemma retention event accepted', r.status === 200);
r = await req('/api/events', { method: 'POST', json: { name: 'not_allowed' } });
ok('unknown event rejected', r.status === 400);

// cards, group rooms and the crowd-take profile
const ip = (n) => ({ 'x-forwarded-for': `10.9.0.${n}` });
const isPng = async (res) => res.status === 200 && (res.headers.get('content-type') || '').includes('image/png') && (await res.arrayBuffer()).byteLength > 2000;
r = await req('/card/next-episode/a?fmt=story');
ok('vote card (story) renders as png', await isPng(r), String(r.status));
r = await req('/card/next-episode/b?fmt=wide');
ok('vote card (post) renders as png', await isPng(r), String(r.status));
r = await req('/card/next-episode/room?g=abc123');
ok('group preview card renders as png', await isPng(r), String(r.status));
r = await req('/card/next-episode/zzz');
ok('unknown card kind 404', r.status === 404);
r = await req('/card/' + encodeURIComponent('bad slug') + '/a');
ok('malicious card slug 404', r.status === 404);

// every card comes in the four standard sizes
const pngSize = async (res) => {
  const b = Buffer.from(await res.arrayBuffer());
  return b.length > 24 && b.toString('latin1', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : [0, 0];
};
const SIZES = { story: [1080, 1920], portrait: [1080, 1350], square: [1080, 1080], wide: [1200, 630] };
for (const [f, [w, h]] of Object.entries(SIZES)) {
  let [pw, ph] = await pngSize(await req(`/card/next-episode/a?fmt=${f}`));
  ok(`vote card ${f} is ${w}x${h}`, pw === w && ph === h, `${pw}x${ph}`);
  [pw, ph] = await pngSize(await req(`/card/next-episode/room?g=abc123&fmt=${f}`));
  ok(`group card ${f} is ${w}x${h}`, pw === w && ph === h, `${pw}x${ph}`);
}
{
  const [pw, ph] = await pngSize(await req('/card/next-episode/b'));
  ok('card defaults to the 1080x1080 square', pw === 1080 && ph === 1080, `${pw}x${ph}`);
  const [bw, bh] = await pngSize(await req('/card/next-episode/b?fmt=bogus'));
  ok('unknown size falls back to square', bw === 1080 && bh === 1080, `${bw}x${bh}`);
}

const vs = [new Jar(), new Jar(), new Jar(), new Jar()];
for (const [i, j] of vs.slice(0, 3).entries())
  for (const slug of [secondSlug, thirdSlug, fourthSlug])
    await req('/api/vote', { jar: j, method: 'POST', json: { slug, side: 'a' }, headers: ip(i + 1) });
await req('/api/vote', { jar: vs[3], method: 'POST', json: { slug: secondSlug, side: 'b' }, headers: ip(4) });
r = await req('/api/take', { jar: vs[0] });
data = await r.json();
ok('take unlocks after 3 counted debates', data.pct === 100 && data.considered === 3 && !!data.label, JSON.stringify(data));
r = await req('/api/take', { jar: vs[3] });
data = await r.json();
ok('take stays locked for a new voter', data.pct === null && data.unlockIn > 0, JSON.stringify(data));
r = await req('/card/take', { jar: vs[0] });
ok('take card renders for unlocked voter', await isPng(r), String(r.status));
for (const [f, [w, h]] of Object.entries(SIZES)) {
  const [pw, ph] = await pngSize(await req(`/card/take?fmt=${f}`, { jar: vs[0] }));
  ok(`take card ${f} is ${w}x${h}`, pw === w && ph === h, `${pw}x${ph}`);
}
r = await req('/card/take', { jar: vs[3] });
ok('take card 404 while locked', r.status === 404, String(r.status));
r = await req('/card/take');
ok('take card 404 with no cookie', r.status === 404);

const room = 'k7m2pq';
const rj = [new Jar(), new Jar(), new Jar()];
r = await req(`/d/${roomSlug}?g=${room}`, { jar: rj[0] });
html = await r.text();
ok('room page shows group verdict pending', html.includes('Group chat verdict pending'));
ok('group tally stays with the main voting panel before discussion', html.indexOf('Group chat verdict pending') < html.indexOf('Join the discussion'));
ok('room page has its own preview card and is noindex', html.includes(`/card/${roomSlug}/room?g=${room}`) && html.includes('noindex'));
r = await req('/api/vote', { jar: rj[0], method: 'POST', json: { slug: roomSlug, side: 'a', room }, headers: ip(11) });
ok('vote inside a room accepted', r.status === 200);
await req('/api/vote', { jar: rj[1], method: 'POST', json: { slug: roomSlug, side: 'b', room }, headers: ip(12) });
r = await req(`/api/room?slug=${roomSlug}&g=${room}`, { jar: rj[2] });
data = await r.json();
ok('non-voter sees only the count, not the split', data.total === 2 && data.results === null && data.inRoom === false, JSON.stringify(data));
await req('/api/vote', { jar: rj[2], method: 'POST', json: { slug: roomSlug, side: 'a' }, headers: ip(13) });
r = await req(`/api/room?slug=${roomSlug}&g=${room}`, { jar: rj[2] });
data = await r.json();
ok('voted outside the room: still not in room, split hidden', data.voted === true && data.inRoom === false && data.results === null, JSON.stringify(data));
r = await req('/api/room', { jar: rj[2], method: 'POST', json: { slug: roomSlug, room }, headers: ip(13) });
ok('earlier vote can be counted into the room', r.status === 200, String(r.status));
r = await req('/api/room', { jar: rj[2], method: 'POST', json: { slug: roomSlug, room }, headers: ip(13) });
ok('joining twice refused', r.status === 409, String(r.status));
r = await req(`/api/room?slug=${roomSlug}&g=${room}`, { jar: rj[0] });
data = await r.json();
ok('room members see live split', data.results && data.results.total === 3 && data.results.a === 2 && data.results.b === 1, JSON.stringify(data));
r = await req(`/d/${roomSlug}?g=${room}`, { jar: rj[0] });
html = await r.text();
ok('room page renders the split server-side for members', html.includes('Group chat verdict so far'));
r = await req(`/api/room?slug=${roomSlug}&g=NOPE`);
ok('bad room code rejected', r.status === 400);
r = await req('/api/room', { method: 'POST', json: { slug: roomSlug, room }, headers: { origin: 'https://evil.example' } });
ok('room join blocks cross-site origin', r.status === 403);

// admin
r = await req('/admin');
ok('admin redirects when signed out', r.status === 307 || r.status === 308 || r.status === 303, String(r.status));
r = await req('/api/admin/action', { method: 'POST', form: { action: 'remove', id: 'x' } });
ok('admin action without session is 401', r.status === 401, String(r.status));

if (ADMIN_PASSWORD) {
  const admin = new Jar();
  r = await req('/api/admin/login', { jar: admin, method: 'POST', form: { password: 'wrong' } });
  ok('wrong admin password refused', (r.headers.get('location') || '').includes('error=1') && !admin.c.duelio_admin);
  r = await req('/api/admin/login', { jar: admin, method: 'POST', form: { password: ADMIN_PASSWORD } });
  ok('admin login sets cookie', !!admin.c.duelio_admin);
  r = await req('/admin', { jar: admin });
  html = await r.text();
  ok('admin desk loads with metrics, published dilemma and report', r.status === 200 && html.includes('Editor desk') && html.includes('Should couples share their phone passwords?') && html.includes('/d/next-episode'));
  ok('admin page is noindex', html.includes('noindex'));

  // Confirm the public submission can still be managed from the editor desk.
  const dilemmaStart = html.lastIndexOf('<li', html.indexOf('/d/should-couples-share-their-phone-passwords'));
  const dilemmaEnd = html.indexOf('</li>', dilemmaStart);
  const dilemmaRow = html.slice(dilemmaStart, dilemmaEnd);
  const dilemmaId = dilemmaRow.match(/name="id" value="([^"]+)"/)?.[1];
  ok('published submission is manageable in the editor desk', !!dilemmaId && dilemmaRow.includes('Status:') && dilemmaRow.includes('published'));

  // close it in the past -> results shown to everyone, voting rejected
  r = await req('/api/vote', { jar: new Jar(), method: 'POST', json: { slug: 'should-couples-share-their-phone-passwords', side: 'a' } });
  ok('vote on open new dilemma', r.status === 200);
  r = await req('/api/admin/action', { jar: admin, method: 'POST', form: { action: 'update', id: dilemmaId, question: 'Should couples share their phone passwords?', context: '', sideALabel: 'Share', sideBLabel: 'Keep private', sideADescription: 'Yes. Transparency matters.', sideBDescription: 'No. Privacy still matters.', closesAt: '2020-01-01T00:00' } });
  r = await req('/d/should-couples-share-their-phone-passwords');
  html = await r.text();
  ok('closed dilemma shows "The vote is in." and crowd verdict', html.includes('The vote is in.') && html.includes('The crowd picked Share.') && !html.includes('objectively'));
  r = await req('/api/vote', { jar: new Jar(), method: 'POST', json: { slug: 'should-couples-share-their-phone-passwords', side: 'b' } });
  ok('voting on closed dilemma refused', r.status === 409, String(r.status));

  // remove -> friendly removed page
  r = await req('/api/admin/action', { jar: admin, method: 'POST', form: { action: 'remove', id: dilemmaId } });
  r = await req('/d/should-couples-share-their-phone-passwords');
  html = await r.text();
  ok('removed dilemma shows removal notice', html.includes('This dilemma was removed.'));
} else {
  console.log('SKIP  admin tests (set ADMIN_PASSWORD)');
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll smoke checks passed');
process.exit(failed ? 1 : 0);
