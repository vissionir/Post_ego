# Public URL convention

Public HTML pages use `/ru/`, `/en/`, and `/th/`. Atom routes use the same
lowercase English identifier in every language: `/ru/atoms/reality`.
Source Markdown paths and wiki-links remain unchanged.

`quartz/util/atom-routes.json` records the correspondence between Russian and
English source filenames (without `.md`). Thai source filenames match English.
When publishing a new atom, add its RU/EN filename pair to this registry.
The build deliberately rejects missing mappings instead of silently publishing
a Cyrillic URL or sending readers to the wrong translation. Do not change an
existing public identifier casually; renamed source files need explicit legacy
aliases and a route migration.

The final `CanonicalRoutes` transformer rewrites page IDs, article links and
graph edges only after Quartz has resolved the source wiki-links. Navigation,
canonical tags, hreflang, sitemap and AI exports use these public IDs.

Legacy URLs remain as immediate HTML redirects with canonical targets, a
clickable fallback and query/hash-preserving JavaScript. GitHub Pages cannot
configure HTTP 301 rules; these are HTML redirects, not claimed HTTP 301s.
Keep them indefinitely for shared links. The root URL redirects to `/ru/`.

`node --import tsx scripts/check-public-routes.ts` validates the built site.
The deploy workflow runs it before uploading the artifact. On case-insensitive
macOS volumes, redirects differing only by case cannot coexist with the page;
they are skipped locally and checked in the Linux deployment build.

The sitemap stays at `https://post-ego.com/sitemap.xml`, now containing only
canonical ASCII URLs and three language alternatives per page. DNS, domain
verification and the Search Console domain property remain unchanged.
