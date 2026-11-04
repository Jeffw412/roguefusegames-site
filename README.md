# roguefusegames.com

The Rogue Fuse Games studio website: a home page listing every game, a page per game, per-game privacy policies and
terms, a support page, and `/app-ads.txt` for AdMob. It's a static site built by `build.mjs` (Node 18+, no
dependencies) and hosted on GitHub Pages. Every push to `main` rebuilds and publishes it
(`.github/workflows/pages.yml`).

```bash
node build.mjs            # build into dist/
node build.mjs --serve    # build, then preview on http://localhost:8080
```

## Layout

| Path | What |
|---|---|
| `site.json` | Studio name, domain, support email, home-page text, AdMob publisher ID (writes `app-ads.txt`) |
| `games/<slug>/game.json` | One game: name, tagline, status, colours, description, features, screenshots, store links, policies |
| `games/<slug>/privacy.html`, `terms.html` | The game's policy text as an HTML fragment. `{{name}}`, `{{studio}}`, `{{email}}` are filled in at build time |
| `games/<slug>/img/` | The game's icon, card and hero art, screenshots (copied to `/<slug>/img/`) |
| `static/` | Copied as-is: `style.css`, `game.js`, fonts (OFL), studio logo and icons |
| `build.mjs` | Page templates and the build |

The URL of each game is its folder name: `https://roguefusegames.com/<slug>/`, with `/<slug>/privacy/` and
`/<slug>/terms/`. **Never rename a slug after its policy URL is in Play Console or AdMob.** To rename a game, change
`name` (and `store_title`) in its `game.json`: every page, title and policy updates from it.

## Adding a game

1. Copy `games/stormchaser/` to `games/<new-slug>/`.
2. Edit `game.json`. Required: `name`, `tagline`, `summary`, `status`, `status_kind` (`dev`, `beta` or `live`), `icon`,
   `privacy`, `terms`. `order` sets its place on the home page. `hero.type` is `phone` (a portrait screenshot in a phone
   frame) or `art` (landscape key art behind the text). `shots.orientation` is `portrait` or `landscape`.
   `"hidden": true` keeps a game off the site.
3. Replace `img/` and rewrite `privacy.html` / `terms.html` for what that game really does. A game whose policies live
   on its own site uses `"privacy": { "external": "https://..." }` instead (as Crater Tanks does), and its
   `/<slug>/privacy/` page redirects there.
4. When it goes live on Google Play, set `stores.google_play.live` to `true`.
5. `node build.mjs --serve`, check the pages, commit and push.

Screenshots: full images about 720 px wide (portrait) or 1280 px (landscape) as WebP, plus `_s` thumbnails at half
size (`ffmpeg -i in.png -quality 82 out.webp`).

## Hosting and DNS

GitHub Pages serves `dist/` with the custom domain in `CNAME`. DNS at Namecheap (Advanced DNS):

| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 (four records) |
| CNAME | www | jeffw412.github.io. |

The support address uses Namecheap's free email forwarding (Domain ▸ Mail settings ▸ Email Forwarding), which adds its own
MX and SPF records.

cratertanks.com is separate: it's served from the Crater Tanks repo (`server/site`) by the game server's Caddy. This site
links to it and doesn't replace it.
