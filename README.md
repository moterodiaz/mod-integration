# Olin Banter

Standalone site for Banter, the Olin Alumni Association's mentoring program.

**Live:** https://moterodiaz.github.io/mod-integration/

## Pages

| Path | Purpose |
|------|---------|
| `/` | Program info and current-cycle timeline |
| `/apply/` | Mentor/mentee sign-up form |
| `/admin/` | Cycle and content management |
| `/decks/` | Mentor profile cards |

`js/banter.js` is shared by all pages and holds the Supabase project URL and
anon key — public by design, with access enforced by row-level security.
Shared assets (site stylesheet, logos, favicon) are served from
`olinalumni.org`.

## Deployment

GitHub Pages builds the root of the `banter-pages` branch, which is the
default branch of this fork. Pushing to `banter-pages` redeploys the site.

This repo is a fork of
[`olinalumni/olinalumni.github.io`](https://github.com/olinalumni/olinalumni.github.io)
trimmed to just the Banter pages.
