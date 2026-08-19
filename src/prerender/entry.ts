/**
 * Build-time HTML shell generator. SPEC §10.
 *
 * "Pre-render each route to real HTML with the Hook and Reveal prose present in
 * the markup ... Search is the primary discovery channel; a client-rendered
 * blank div is fatal."
 *
 * §13 says to ask before adding a dependency, so this is the simple shell
 * generator §10 offers as the alternative to vite-plugin-ssr: it takes the
 * built `dist/index.html`, and for every route writes a copy with real head
 * metadata and the prose already in the document. React replaces the contents
 * of #root when it mounts.
 *
 * The prose markup here deliberately does not try to reproduce ExplorablePage's
 * CSS-module class names — those are hashed at build time. It is semantic HTML
 * carrying the same words in the same order, which is what a crawler needs; the
 * styled, interactive version arrives with the JavaScript.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { registry } from '../registry';
import type { ExplorableMeta } from '../engine/meta';

const DIST = join(process.cwd(), 'dist');

/**
 * Absolute origin, for canonical URLs, OG tags and the sitemap. Left unset it
 * still produces correct pages — it just omits the tags that are wrong when
 * guessed, rather than baking in a placeholder domain.
 */
const ORIGIN = (process.env.SITE_ORIGIN ?? '').replace(/\/$/, '');

const SITE_NAME = 'Explorables';
const SITE_DESCRIPTION =
  'A small library of interactive explanations in physics, mathematics, economics and statistics. ' +
  'Each one is a working model you take apart by hand.';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraphs(items: readonly string[]): string {
  return items.map((text) => `<p>${escapeHtml(text)}</p>`).join('\n');
}

/** Head tags for one route. */
function headFor(options: {
  title: string;
  description: string;
  path: string;
  image?: string | undefined;
}): string {
  const { title, description, path, image } = options;
  const url = ORIGIN ? `${ORIGIN}${path}` : null;
  const absoluteImage = image && ORIGIN ? `${ORIGIN}${image}` : null;

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    url ? `<link rel="canonical" href="${escapeHtml(url)}" />` : null,
    `<meta property="og:type" content="${path === '/' ? 'website' : 'article'}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    url ? `<meta property="og:url" content="${escapeHtml(url)}" />` : null,
    absoluteImage ? `<meta property="og:image" content="${escapeHtml(absoluteImage)}" />` : null,
    `<meta name="twitter:card" content="${absoluteImage ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    absoluteImage ? `<meta name="twitter:image" content="${escapeHtml(absoluteImage)}" />` : null,
  ];

  return tags.filter(Boolean).join('\n    ');
}

/** §7's spine, as plain semantic HTML. */
function explorableBody(meta: ExplorableMeta): string {
  return `
<article style="max-width:1080px;margin:0 auto;padding:2rem 1rem 4rem">
  <nav><a href="/">Explorables</a> / <span>${escapeHtml(meta.domain)} · ${meta.minutes} min</span></nav>
  <h1>${escapeHtml(meta.title)}</h1>
  ${paragraphs(meta.hook)}
  <p><em>${escapeHtml(meta.play)}</em></p>
  <h2>What is going on</h2>
  ${paragraphs(meta.reveal)}
  <h2>Try to break it</h2>
  <ul>
    ${meta.edges
      .map(
        (edge) =>
          `<li><p>${escapeHtml(edge.prompt)}</p><p>${escapeHtml(edge.answer)}</p></li>`,
      )
      .join('\n    ')}
  </ul>
  <h2>What this leaves out</h2>
  <ul>
    ${meta.limits.map((limit) => `<li>${escapeHtml(limit)}</li>`).join('\n    ')}
  </ul>
  <p>Updated ${escapeHtml(meta.updated)}</p>
</article>`.trim();
}

function indexBody(): string {
  const rows = registry
    .map(
      ({ meta }) =>
        `<li><h3><a href="/${meta.slug}">${escapeHtml(meta.title)}</a></h3>` +
        `<p>${escapeHtml(meta.blurb)}</p><p>${meta.minutes} min · ${escapeHtml(meta.domain)}</p></li>`,
    )
    .join('\n    ');

  return `
<article style="max-width:1080px;margin:0 auto;padding:2rem 1rem 4rem">
  <h1>${SITE_NAME}</h1>
  <p>${escapeHtml(SITE_DESCRIPTION)}</p>
  <ul>
    ${rows}
  </ul>
</article>`.trim();
}

/** JSON-LD, so a search engine can read the page as an article rather than guess. */
function jsonLd(meta: ExplorableMeta): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.blurb,
    dateModified: meta.updated,
    articleSection: meta.domain,
    ...(ORIGIN ? { url: `${ORIGIN}/${meta.slug}` } : {}),
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function renderPage(shell: string, head: string, body: string, extraHead = ''): string {
  return shell
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace('</head>', `  ${head}\n    ${extraHead}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

async function main() {
  const shell = await readFile(join(DIST, 'index.html'), 'utf8');

  // Dumped so scripts/build-og.mjs can read the registry without bundling it a
  // second time. Written beside this script's own output, not into dist.
  await mkdir(join(process.cwd(), '.prerender'), { recursive: true });
  await writeFile(
    join(process.cwd(), '.prerender', 'metas.json'),
    JSON.stringify(
      registry.map(({ meta }) => ({
        slug: meta.slug,
        title: meta.title,
        blurb: meta.blurb,
        domain: meta.domain,
        minutes: meta.minutes,
      })),
      null,
      2,
    ),
    'utf8',
  );

  // The index, at /
  await writeFile(
    join(DIST, 'index.html'),
    renderPage(
      shell,
      headFor({ title: SITE_NAME, description: SITE_DESCRIPTION, path: '/' }),
      indexBody(),
    ),
    'utf8',
  );
  console.log('  /');

  for (const { meta } of registry) {
    const head = headFor({
      title: `${meta.title} — ${SITE_NAME}`,
      description: meta.blurb,
      path: `/${meta.slug}`,
      image: `/og/${meta.slug}.png`,
    });
    const html = renderPage(shell, head, explorableBody(meta), jsonLd(meta));

    // Written in both shapes a static host might look for: `slug.html`, which
    // Cloudflare Pages and Netlify serve for an extensionless `/slug`, and
    // `slug/index.html`, which everything serves for `/slug/`. The canonical
    // tag in both names the extensionless form, so a crawler that finds two
    // paths is told which one counts.
    const dir = join(DIST, meta.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), html, 'utf8');
    await writeFile(join(DIST, `${meta.slug}.html`), html, 'utf8');
    console.log(`  /${meta.slug}`);
  }

  // §10: sitemap.xml generated from the registry at build time.
  if (ORIGIN) {
    const urls = ['/', ...registry.map(({ meta }) => `/${meta.slug}`)];
    const lastmod = registry.map(({ meta }) => meta.updated).sort().at(-1);
    const sitemap =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((path) => {
          const entry = registry.find(({ meta }) => `/${meta.slug}` === path);
          return (
            `  <url><loc>${ORIGIN}${path}</loc>` +
            `<lastmod>${entry?.meta.updated ?? lastmod}</lastmod></url>`
          );
        })
        .join('\n') +
      `\n</urlset>\n`;
    await writeFile(join(DIST, 'sitemap.xml'), sitemap, 'utf8');

    await writeFile(
      join(DIST, 'robots.txt'),
      `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`,
      'utf8',
    );
    console.log(`  sitemap.xml, robots.txt  (origin ${ORIGIN})`);
  } else {
    console.warn(
      '\n  SITE_ORIGIN is not set, so canonical URLs, absolute OG images,\n' +
        '  sitemap.xml and robots.txt were skipped. Set it to the deployed\n' +
        '  origin (e.g. SITE_ORIGIN=https://example.com npm run build) — a\n' +
        '  guessed domain in a canonical tag is worse than none.',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
