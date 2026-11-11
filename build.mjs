// Builds roguefusegames.com into dist/ from site.json, static/ and games/<slug>/ (no dependencies: Node 18+).
//   node build.mjs           build dist/
//   node build.mjs --serve   build, then serve dist/ on http://localhost:8080 (clean URLs like GitHub Pages)
// Adding a game = a new games/<slug>/ folder with game.json and img/ (and privacy.html / terms.html, or links to
// policies hosted elsewhere). See README.md.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.json"), "utf8"));

// ===== Data =========================================================================================================
const REQUIRED = ["name", "tagline", "summary", "status", "status_kind", "icon", "privacy", "terms"];

function loadGames() {
	const dir = path.join(ROOT, "games");
	const games = [];
	for (const slug of fs.readdirSync(dir)) {
		const file = path.join(dir, slug, "game.json");
		if (!fs.existsSync(file)) {
			continue;
		}
		const g = JSON.parse(fs.readFileSync(file, "utf8"));
		if (g.hidden) {
			continue;
		}
		for (const key of REQUIRED) {
			if (g[key] === undefined) {
				throw new Error(`games/${slug}/game.json: missing "${key}"`);
			}
		}
		g.slug = slug;
		g.dir = path.join(dir, slug);
		g.base = `/${slug}/`;
		g.email = g.email || site.email;
		games.push(g);
	}
	games.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
	return games;
}

// ===== Helpers ======================================================================================================
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const asset = (g, rel) => g.base + rel;
const abs = (p) => site.url + p;
// Wide-screen gallery columns: landscape 4; portrait up to 7 in a row, balanced into full rows (8 shots: 2 rows of 4).
const galleryCols = (g) => {
	const n = g.shots.items.length;
	if (g.shots.orientation !== "portrait") return 4;
	return n <= 7 ? Math.max(n, 1) : Math.ceil(n / Math.ceil(n / 7));
};
const fill = (text, vars) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
// A policy is its own page (/<slug>/privacy/), hosted elsewhere ("external"), or not written yet ("pending": before launch).
const policyUrl = (g, kind) => (g[kind].pending ? null : g[kind].external || `${g.base}${kind}/`);
// Links to a game's privacy policy and terms, or nothing while they're pending.
const policyLinks = (g, cls, labels = ["Privacy Policy", "Terms of Use"]) => ["privacy", "terms"].filter((k) => policyUrl(g, k)).map((k, i) => `<a${cls ? ` class="${cls}"` : ""} href="${esc(policyUrl(g, k))}">${labels[k === "privacy" ? 0 : 1]}</a>`).join("");

const ICONS = {
	play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5v17L20 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
	arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	film: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>',
	mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};
// Feature icons, picked in order for each game's features.
const FEATURE_ICONS = [
	'<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3.5"/>',
	'<path d="M4 6c5-3 11-3 16 0M6 10c4-2 8-2 12 0M8 14c3-1.5 5-1.5 8 0M10 18c1.5-.7 2.5-.7 4 0"/>',
	'<path d="M3 20l5-9 4 5 3-4 6 8zM15 4l2 2M19 3l-1 3M20 8l-3-1"/>',
	'<path d="M3 15h18l-2 4H5zM6 15v-3h9l2 3M10 12V9h5M15 10.5h6"/>',
	'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
	'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5"/>',
	'<path d="M5 21V3M5 4h12l-2.5 4L17 12H5"/>',
	'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
];
const VALUE_ICONS = {
	fair: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5"/>',
	physics: '<path d="M3 20c3-9 7-14 18-16M3 20l4-1M3 20l1-4"/><circle cx="17" cy="8" r="2"/>',
	privacy: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
	offline: '<path d="M4 9a13 13 0 0 1 16 0M7.5 12.5a8 8 0 0 1 9 0M10.5 16a3 3 0 0 1 3 0M12 19.5h.01"/>',
};

// ===== Layout =======================================================================================================
function head({ title, description, canonical, image, accent, accent2, extra = "" }) {
	const style = accent ? ` style="--accent:${accent};--accent2:${accent2 || accent}"` : "";
	return `<!doctype html>
<html lang="en"${style}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#07090d">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.studio)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image || abs("/img/og.jpg"))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/icon_180.png" type="image/png" sizes="180x180">
<link rel="icon" href="/img/icon_96.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/img/icon_180.png">
<link rel="preload" href="/fonts/russo-one.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/rajdhani-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css?v=${BUILD_ID}">
${extra}</head>`;
}

function header(current) {
	const nav = [["/#games", "Games", "games"], ["/support/", "Support", "support"]];
	return `<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
	<a class="brand" href="/" aria-label="${esc(site.studio)} home"><img src="/img/emblem_128.webp" alt="" width="40" height="40"><span>Rogue <b>Fuse</b></span></a>
	<nav aria-label="Site">${nav.map(([href, label, key]) => `<a href="${href}"${key === current ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
</div></header>`;
}

function footer(games) {
	return `<footer class="site"><div class="wrap">
	<div class="about">
		<a class="brand" href="/"><img src="/img/emblem_128.webp" alt="" width="40" height="40"><span>Rogue <b>Fuse</b> Games</span></a>
		<p>${esc(site.tagline)}</p>
	</div>
	<div>
		<h2>Games</h2>
		<ul>${games.map((g) => `<li><a href="${g.base}">${esc(g.name)}</a></li>`).join("")}</ul>
	</div>
	<div>
		<h2>Studio</h2>
		<ul>
			<li><a href="/support/">Support &amp; contact</a></li>
			<li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
			<li><a href="/privacy/">Website privacy</a></li>
		</ul>
	</div>
	<div class="legal"><span>© ${site.year} ${esc(site.studio)}. All rights reserved.</span><span>Google Play and the Google Play logo are trademarks of Google LLC.</span></div>
</div></footer>`;
}

function page(meta, current, body, games, scripts = "", mainClass = "") {
	return `${head(meta)}
${header(current)}
<main id="main"${mainClass ? ` class="${mainClass}"` : ""}>
${body}
</main>
${footer(games)}
${scripts}</body>
</html>
`;
}

function storeBadge(g) {
	const gp = g.stores && g.stores.google_play;
	if (!gp) {
		return "";
	}
	if (gp.live && gp.url) {
		return `<a class="play-badge" href="${esc(gp.url)}" rel="noopener">${ICONS.play}<span><small>Get it on</small>Google Play</span></a>`;
	}
	return `<span class="play-badge soon">${ICONS.play}<span><small>Coming soon to</small>Google Play</span></span>`;
}

// ===== Pages ========================================================================================================
function homePage(games) {
	const cards = games.map((g) => `
		<li><a class="game-card" href="${g.base}" style="--accent:${g.accent};--accent2:${g.accent2 || g.accent}">
			<div class="art"><img src="${asset(g, g.card_image || g.icon)}" alt="" width="640" height="360" decoding="async"${g.card_position ? ` style="object-position:${g.card_position}"` : ""}><span class="pill ${esc(g.status_kind)}">${esc(g.status)}</span></div>
			<div class="body">
				<img class="icon" src="${asset(g, g.icon)}" alt="" width="72" height="72" loading="lazy">
				<div>
					<h3>${esc(g.store_title || g.name)}</h3>
					<p class="tag">${esc(g.tagline)}</p>
					<p class="sum">${esc(g.summary)}</p>
					<span class="more">See the game ${ICONS.arrow}</span>
				</div>
			</div>
		</a></li>`).join("");
	const values = [
		["physics", "Big moments", "Real physics and destruction: craters that tear the ground, storms that throw the scenery."],
		["fair", "Fair to play", "No paid loot boxes and nothing you have to buy to progress. Ads you watch are your choice."],
		["offline", "Plays anywhere", "Short sessions, one-handed where it counts, and single-player that works offline."],
		["privacy", "Privacy first", "We collect as little as we can, say exactly what in each game's policy, and never sell it."],
	].map(([ico, t, p]) => `<li><span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${VALUE_ICONS[ico]}</svg></span><h3>${t}</h3><p>${p}</p></li>`).join("");
	const body = `
<section class="studio-hero">
	<picture class="banner">
		<source media="(max-width: 700px)" srcset="/img/banner_169.webp" width="1000" height="563">
		<source media="(max-width: 1300px)" srcset="/img/banner_wide_1200.webp" width="1200" height="480">
		<img src="/img/banner_wide.webp" alt="Rogue Fuse Games" width="1983" height="793" fetchpriority="high" decoding="async">
	</picture>
	<div class="wrap intro">
		<h1 class="sr-only">Rogue Fuse Games</h1>
		<p class="kicker">Independent game studio</p>
		<p class="lead">${esc(site.lead)}</p>
		<div class="cta-row">
			<a class="cta primary" href="#games">Our games ${ICONS.arrow}</a>
			<a class="cta ghost" href="/support/">Support &amp; contact</a>
		</div>
	</div>
</section>
<section class="section" id="games">
	<div class="wrap">
		<div class="sec-head"><div><h2 class="sec-title">Our games</h2><p class="sec-sub">Each game has its own page, privacy policy and terms.</p></div></div>
		<ul class="games">${cards}
		</ul>
	</div>
</section>
<section class="section">
	<div class="wrap">
		<div class="sec-head"><h2 class="sec-title">How we make games</h2></div>
		<ul class="values">${values}</ul>
	</div>
</section>
<section class="section">
	<div class="wrap">
		<div class="band-cta">
			<div><h2>Need a hand?</h2><p>Questions, bugs, purchases or your data: one email reaches the people who make the games.</p></div>
			<div class="cta-row"><a class="cta primary" href="mailto:${esc(site.email)}">${ICONS.mail} Email us</a><a class="cta ghost" href="/support/">Support page</a></div>
		</div>
	</div>
</section>`;
	const ld = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: site.studio,
		url: site.url,
		logo: abs("/img/icon_512.png"),
		email: site.email,
	};
	return page({
		title: `${site.studio} | Independent mobile games`,
		description: `${site.studio}: ${site.lead}`,
		canonical: abs("/"),
		extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`,
	}, "games", body, games);
}

function gamePage(g, games) {
	let hero;
	if (g.hero && g.hero.type === "art") {
		hero = `<section class="game-hero art">
	<picture class="bg">
		${g.hero.mobile ? `<source media="(max-width: 760px)" srcset="${asset(g, g.hero.mobile)}" type="image/webp">` : ""}
		<source srcset="${asset(g, g.hero.image)}" type="image/webp">
		<img src="${asset(g, g.hero.fallback || g.hero.image)}" alt="" width="1920" height="1080" fetchpriority="high" decoding="async"${g.hero.position ? ` style="object-position:${g.hero.position}"` : ""}>
	</picture>
	<div class="wrap"><div class="text">${heroText(g)}</div></div>
</section>`;
	} else {
		// the screen keeps the screenshot's own shape (hero.width/height, default a 720x1560 phone)
		const hw = g.hero.width || 720, hh = g.hero.height || 1560;
		hero = `<section class="game-hero phone">
	<div class="wrap">
		<div class="text">${heroText(g)}</div>
		<div class="phone-frame"><img src="${asset(g, g.hero.image)}" alt="${esc(g.name)} gameplay" width="${hw}" height="${hh}" style="aspect-ratio: ${hw} / ${hh}" fetchpriority="high" decoding="async"></div>
	</div>
</section>`;
	}
	const stats = g.stats && g.stats.length ? `<ul class="stats">${g.stats.map(([n, t]) => `<li><b>${esc(n)}</b>${esc(t)}</li>`).join("")}</ul>` : "";
	const trailer = g.trailer ? `
<section class="section" id="trailer">
	<div class="wrap">
		<div class="sec-head"><h2 class="sec-title">The trailer</h2></div>
		<div class="yt" data-yt="${esc(g.trailer.youtube)}">
			<a class="yt-facade" href="https://www.youtube.com/watch?v=${esc(g.trailer.youtube)}" target="_blank" rel="noopener" aria-label="Play the ${esc(g.name)} trailer">
				<picture><source srcset="${asset(g, g.trailer.poster)}" type="image/webp"><img src="${asset(g, g.trailer.poster_fallback || g.trailer.poster)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></picture>
				<span class="yt-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3l16 9-16 9z"/></svg></span>
			</a>
		</div>
		<p class="note">The video loads from YouTube only when you press play.</p>
	</div>
</section>` : "";
	const shots = g.shots && g.shots.items.length ? `
<section class="section" id="screenshots">
	<div class="wrap">
		<div class="sec-head"><h2 class="sec-title">Screenshots</h2></div>
		<ul class="gallery ${g.shots.orientation === "portrait" ? "portrait" : "landscape"}" id="gallery" style="--cols: ${galleryCols(g)}">${g.shots.items.map((s) => `
			<li><a href="${asset(g, s.full)}"><img src="${asset(g, s.thumb)}" width="${g.shots.width}" height="${g.shots.height}" loading="lazy" decoding="async" alt="${esc(s.caption)}"><span class="cap">${esc(s.caption)}</span></a></li>`).join("")}
		</ul>
	</div>
</section>` : "";
	const features = g.features && g.features.length ? `
<section class="section" id="features">
	<div class="wrap">
		<div class="sec-head"><h2 class="sec-title">Features</h2></div>
		<div class="features${g.features.length % 4 === 0 ? " n4" : ""}">${g.features.map((f, i) => `
			<div class="feature"><span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${FEATURE_ICONS[i % FEATURE_ICONS.length]}</svg></span><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join("")}
		</div>
	</div>
</section>` : "";
	const facts = [
		["Status", esc(g.status)],
		["Genre", esc(g.genre || "")],
		["Platforms", esc((g.platforms || []).join(", "))],
		["Developer", esc(site.studio)],
		g.package ? ["Package", `<code>${esc(g.package)}</code>`] : null,
		["Support", `<a href="mailto:${esc(g.email)}">${esc(g.email)}</a>`],
		["Legal", policyUrl(g, "privacy") ? `<a href="${esc(policyUrl(g, "privacy"))}">Privacy Policy</a> · <a href="${esc(policyUrl(g, "terms"))}">Terms</a>` : "Privacy policy and terms before launch"],
	].filter(Boolean).filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
	const body = `${hero}
${stats}
<section class="section" id="about">
	<div class="wrap about-game">
		<div class="prose"><h2 class="sec-title" style="margin-bottom:16px">About the game</h2>${(g.description || [g.summary]).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
		<dl class="facts">${facts}</dl>
	</div>
</section>${trailer}${shots}${features}
<section class="section">
	<div class="wrap">
		<div class="band-cta">
			<div><h2>Help with ${esc(g.name)}</h2><p>Bugs, purchases, privacy questions: email us and include your phone model.</p></div>
			<div class="cta-row"><a class="cta primary" href="mailto:${esc(g.email)}?subject=${encodeURIComponent(g.name)}">${ICONS.mail} Email support</a>${policyLinks(g, "cta ghost", ["Privacy", "Terms"])}</div>
		</div>
	</div>
</section>
${lightbox()}`;
	const ld = {
		"@context": "https://schema.org",
		"@type": "VideoGame",
		name: g.store_title || g.name,
		description: g.summary,
		url: abs(g.base),
		image: abs(asset(g, g.icon)),
		genre: g.genre,
		gamePlatform: g.platforms,
		applicationCategory: "Game",
		operatingSystem: (g.platforms || []).join(", "),
		author: { "@type": "Organization", name: site.studio, url: site.url },
	};
	const ogImage = g.hero && g.hero.type === "art" ? abs(asset(g, g.hero.fallback || g.hero.image)) : abs(asset(g, g.og_image || g.icon));
	return page({
		title: `${g.store_title || g.name} | ${site.studio}`,
		description: g.summary,
		canonical: abs(g.base),
		image: ogImage,
		accent: g.accent,
		accent2: g.accent2,
		extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`,
	}, "games", body, games, `<script src="/game.js?v=${BUILD_ID}" defer></script>\n`);
}

// "Stormchaser: Extreme Weather" shows as the short name with the subtitle on its own line.
function titleHtml(g) {
	const t = g.store_title || g.name;
	const m = t.startsWith(g.name) && t.slice(g.name.length).match(/^\s*[:\-–—]\s*(.+)$/);
	return m ? `${esc(g.name)}<span class="sub">${esc(m[1])}</span>` : esc(t);
}

function heroText(g) {
	const links = (g.links || []).map((l) => `<a class="cta ${l.primary ? "primary" : "ghost"}" href="${esc(l.url)}"${/^https?:/.test(l.url) ? ' rel="noopener"' : ""}>${esc(l.label)}${/^https?:/.test(l.url) && !l.primary ? ` ${ICONS.out}` : ""}</a>`).join("");
	const trailer = g.trailer ? `<a class="cta ghost" href="#trailer">${ICONS.film} Trailer</a>` : "";
	return `
		<div class="title-row"><img src="${asset(g, g.icon)}" alt="" width="76" height="76"><div><p class="kicker">${esc(g.kicker || g.genre || "")}</p><span class="pill ${esc(g.status_kind)}">${esc(g.status)}</span></div></div>
		<h1>${titleHtml(g)}</h1>
		<p class="tag">${esc(g.tagline)}</p>
		<p class="lead">${esc(g.summary)}</p>
		<div class="cta-row">${links}${storeBadge(g)}${trailer}</div>`;
}

function lightbox() {
	return `<dialog class="lightbox" id="lightbox" aria-label="Screenshots">
	<div class="lb-stage" id="lb-stage"><img id="lb-img" alt=""><p class="lb-cap"><span id="lb-cap"></span><span class="lb-count" id="lb-count"></span></p></div>
	<button class="lb-btn lb-close" id="lb-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
	<button class="lb-btn lb-prev" id="lb-prev" type="button" aria-label="Previous screenshot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
	<button class="lb-btn lb-next" id="lb-next" type="button" aria-label="Next screenshot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
</dialog>`;
}

function crumbs(g, label) {
	return `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">${esc(site.studio)}</a><span aria-hidden="true">›</span>${g ? `<img src="${asset(g, g.icon)}" alt="" width="22" height="22"><a href="${g.base}">${esc(g.name)}</a><span aria-hidden="true">›</span>` : ""}<span>${esc(label)}</span></nav>`;
}

// A game's privacy policy or terms: its own fragment (games/<slug>/privacy.html with {{name}} etc.), or a redirect to
// the copy hosted elsewhere (Crater Tanks keeps its policies on cratertanks.com, their canonical home).
function policyPage(g, kind, games) {
	const label = kind === "privacy" ? "Privacy Policy" : "Terms of Use";
	const p = g[kind];
	if (p.external) {
		return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(label)}: ${esc(g.name)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(p.external)}">
<meta http-equiv="refresh" content="0; url=${esc(p.external)}">
<link rel="stylesheet" href="/style.css?v=${BUILD_ID}">
</head>
<body><main class="doc"><h1>${esc(label)}</h1><p>The ${esc(g.name)} ${esc(label.toLowerCase())} lives at <a href="${esc(p.external)}">${esc(p.external)}</a>.</p></main></body>
</html>
`;
	}
	const vars = { name: esc(g.name), title: esc(g.store_title || g.name), studio: esc(site.studio), email: esc(g.email), effective: esc(p.effective), url: abs(g.base) };
	const html = fill(fs.readFileSync(path.join(g.dir, p.file), "utf8"), vars);
	const other = kind === "privacy" ? "terms" : "privacy";
	const body = `${crumbs(g, label)}
<h1>${esc(label)}</h1>
<p class="updated">${esc(g.store_title || g.name)} · Effective ${esc(p.effective)}</p>
${html}
<div class="doc-nav"><a class="cta ghost" href="${g.base}">${esc(g.name)}</a><a class="cta ghost" href="${esc(policyUrl(g, other))}">${other === "privacy" ? "Privacy Policy" : "Terms of Use"}</a><a class="cta ghost" href="/support/">Support</a></div>`;
	return page({
		title: `${label}: ${g.store_title || g.name} | ${site.studio}`,
		description: `The ${label.toLowerCase()} for ${g.store_title || g.name} by ${site.studio}.`,
		canonical: abs(`${g.base}${kind}/`),
		accent: g.accent,
		accent2: g.accent2,
	}, "", body, games, "", "doc");
}

function supportPage(games) {
	const blocks = games.map((g) => `
<section class="game-block" id="${g.slug}" style="--accent:${g.accent};--accent2:${g.accent2 || g.accent}">
	<h3><img src="${asset(g, g.icon)}" alt="" width="40" height="40">${esc(g.name)}</h3>
	<ul>${(g.data || []).map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
	<p>Email <a href="mailto:${esc(g.email)}?subject=${encodeURIComponent(g.name)}">${esc(g.email)}</a></p>
	<div class="legal-links"><a href="${g.base}">Game page</a>${policyLinks(g, "")}</div>
</section>`).join("");
	const body = `${crumbs(null, "Support")}
<h1>Support &amp; contact</h1>
<p class="updated">We read every email, and a person who makes the games answers it.</p>
<div class="support-card">
	<p>For help with any of our games, purchases, privacy or your data, and for business enquiries:</p>
	<a class="email" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
</div>
<h2>When you write</h2>
<ul>
	<li>Name the game, and tell us your phone model and Android version.</li>
	<li>For a purchase, include the order number from your Google Play receipt (it starts with GPA.). Never send us card details or passwords.</li>
	<li>For a bug, say what you were doing when it happened. A screenshot helps.</li>
</ul>
<h2>Our games</h2>
${blocks}
<h2>Refunds</h2>
<p>Purchases in our games are made through Google Play, so refunds follow <a href="https://support.google.com/googleplay/answer/2479637">Google Play's refund policy</a>. You can request one from your Google Play order history. If something you bought didn't arrive, try Restore purchases in the game first, then email us.</p>
<h2>Privacy requests</h2>
<p>To ask what data we hold about you, or to have it corrected or deleted, email us from any address and name the game. Each game's privacy policy explains what it collects and how to delete it yourself.</p>`;
	return page({
		title: `Support & contact | ${site.studio}`,
		description: `Get help with ${games.map((g) => g.name).join(" and ")}, purchases, privacy and your data.`,
		canonical: abs("/support/"),
	}, "support", body, games, "", "doc");
}

function sitePrivacyPage(games) {
	const body = `${crumbs(null, "Website privacy")}
<h1>Website privacy</h1>
<p class="updated">Effective November 4, 2026</p>
<p>This notice covers the ${esc(site.domain)} website. Each game has its own privacy policy:
${games.filter((g) => policyUrl(g, "privacy")).map((g) => `<a href="${esc(policyUrl(g, "privacy"))}">${esc(g.name)}</a>`).join(", ")}.</p>
<h2>What this site collects</h2>
<p>Nothing on purpose. The site has no accounts, forms, cookies, analytics, ads or tracking pixels, and it loads no
fonts or scripts from other companies. Videos are embedded only after you press play, from youtube-nocookie.com.</p>
<p>The site is hosted on GitHub Pages (GitHub, Inc.). Like any web host, GitHub receives your IP address and browser
details when you visit, to deliver the pages and keep the service secure, and may keep them in its logs. See
<a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub's privacy statement</a>.</p>
<h2>Email</h2>
<p>If you email us, we use your message and address only to answer you, and keep them only as long as we need to.</p>
<h2>Contact</h2>
<p>${esc(site.studio)}: <a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>`;
	return page({
		title: `Website privacy | ${site.studio}`,
		description: `What the ${site.domain} website collects (nothing on purpose).`,
		canonical: abs("/privacy/"),
	}, "", body, games, "", "doc");
}

function notFoundPage(games) {
	const body = `<div class="notfound"><h1>404</h1><p>That page went up in smoke.</p><div class="cta-row" style="justify-content:center"><a class="cta primary" href="/">Home</a><a class="cta ghost" href="/support/">Support</a></div></div>`;
	return page({ title: `Not found | ${site.studio}`, description: "Page not found.", canonical: abs("/404.html") }, "", body, games);
}

// ===== Build ========================================================================================================
const BUILD_ID = Date.now().toString(36);

function write(rel, content) {
	const file = path.join(DIST, rel);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}

function build() {
	const games = loadGames();
	fs.rmSync(DIST, { recursive: true, force: true });
	fs.cpSync(path.join(ROOT, "static"), DIST, { recursive: true });
	write("index.html", homePage(games));
	write("support/index.html", supportPage(games));
	write("privacy/index.html", sitePrivacyPage(games));
	write("404.html", notFoundPage(games));
	const urls = ["/", "/support/", "/privacy/"];
	for (const g of games) {
		fs.cpSync(path.join(g.dir, "img"), path.join(DIST, g.slug, "img"), { recursive: true });
		write(`${g.slug}/index.html`, gamePage(g, games));
		urls.push(g.base);
		for (const kind of ["privacy", "terms"].filter((k) => !g[k].pending)) {
			write(`${g.slug}/${kind}/index.html`, policyPage(g, kind, games));
			if (!g[kind].external) {
				urls.push(`${g.base}${kind}/`);
			}
		}
	}
	write("app-ads.txt", `google.com, ${site.admob_publisher}, DIRECT, f08c47fec0942fa0\n`);
	write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${abs("/sitemap.xml")}\n`);
	write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `\t<url><loc>${abs(u)}</loc></url>`).join("\n")}\n</urlset>\n`);
	write("CNAME", `${site.domain}\n`);
	write(".nojekyll", "");
	console.log(`built ${games.length} games (${games.map((g) => g.slug).join(", ")}) into dist/`);
}

// ===== Local preview server (clean URLs and 404.html, like GitHub Pages) ============================================
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };

function serve(port) {
	http.createServer((req, res) => {
		const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
		let file = path.join(DIST, url);
		if (!file.startsWith(DIST)) {
			res.writeHead(403).end();
			return;
		}
		if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
			if (!url.endsWith("/")) {
				res.writeHead(301, { Location: url + "/" }).end();
				return;
			}
			file = path.join(file, "index.html");
		}
		if (!fs.existsSync(file)) {
			res.writeHead(404, { "Content-Type": TYPES[".html"] }).end(fs.readFileSync(path.join(DIST, "404.html")));
			return;
		}
		res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
		fs.createReadStream(file).pipe(res);
	}).listen(port, () => console.log(`serving dist/ on http://localhost:${port}`));
}

build();
if (process.argv.includes("--serve")) {
	serve(Number(process.env.PORT) || 8080);
}
