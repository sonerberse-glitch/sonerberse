import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://sonerberse.com';
const LATEST_START = '<!-- BLOG_LATEST_START -->';
const LATEST_END = '<!-- BLOG_LATEST_END -->';
const PUBLIC_FILES = [
  'index.html', 'robots.txt', 'llms.txt', 'sitemap.xml', 'manifest.json',
  'BingSiteAuth.xml', 'googlefb97bcaa4367a6a0.html',
  'edc38590f9b14e708c6bffb368506b94.txt',
];
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA_DIRECTORY = Symbol('mediaDirectory');
const PREVIEW_ONLY = Symbol('previewOnly');
const OUTPUT_MARKER = '.sonerberse-generated';
const OUTPUT_SIGNATURE = 'Soner Berse static blog build v1\n';
const themeColor = theme => theme === 'light' ? '#f8f6f1' : '#0a0f1e';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const htmlText = value => escapeHtml(value).replace(/\r?\n/g, '<br>');
const fail = message => { throw new Error(message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label}: boş olmayan metin gerekli.`);
};
function exactKeys(value, keys, label) {
  if (!isObject(value)) fail(`${label}: nesne gerekli.`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${label}: bilinmeyen alan ${key}.`);
}

export function publicationTimestamp(value) {
  // A calendar-only publication date starts at midnight in the site's Istanbul timezone.
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+03:00` : value);
}

function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    fail(`${label}: YYYY-MM-DD veya saat dilimli ISO tarih gerekli.`);
  }
  const datePart = value.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== datePart || !Number.isFinite(publicationTimestamp(value))) {
    fail(`${label}: geçersiz tarih.`);
  }
  return publicationTimestamp(value);
}

function validateUrl(value, label, image = false) {
  requireText(value, label);
  if (/^https:\/\//.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) fail(`${label}: HTTPS bağlantısı gerekli.`);
      return;
    } catch { fail(`${label}: geçersiz HTTPS bağlantısı.`); }
  }
  if (image && /^(?:\/assets\/|media\/)[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:avif|gif|jpe?g|png|webp)$/i.test(value) && !value.includes('//')) return;
  if (!image && /^\/(?!\/)[A-Za-z0-9/#?=&%._~-]*$/.test(value) && !value.includes('..')) return;
  fail(`${label}: HTTPS veya güvenli yerel ${image ? 'görsel' : 'site'} bağlantısı gerekli.`);
}

export function validatePost(post, filename = 'Yazı') {
  exactKeys(post, ['title', 'slug', 'status', 'publishedAt', 'summary', 'body', 'tags', 'image', 'sources', 'relatedPublications'], filename);
  for (const field of ['title', 'slug', 'summary']) requireText(post[field], `${filename}.${field}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || post.slug.length > 120) fail(`${filename}.slug: küçük harf, rakam ve tire kullanın (en fazla 120 karakter).`);
  if (!['draft', 'published'].includes(post.status)) fail(`${filename}.status: draft veya published gerekli.`);
  if (post.status === 'published' || post.publishedAt !== undefined) validDate(post.publishedAt, `${filename}.publishedAt`);
  if (post.tags !== undefined && (!Array.isArray(post.tags) || post.tags.some(tag => typeof tag !== 'string' || !tag.trim()))) fail(`${filename}.tags: metin dizisi gerekli.`);
  if (post.image !== undefined) {
    exactKeys(post.image, ['url', 'alt'], `${filename}.image`);
    validateUrl(post.image.url, `${filename}.image.url`, true);
    requireText(post.image.alt, `${filename}.image.alt`);
  }
  for (const field of ['sources', 'relatedPublications']) {
    if (post[field] === undefined) continue;
    if (!Array.isArray(post[field])) fail(`${filename}.${field}: dizi gerekli.`);
    post[field].forEach((item, index) => {
      const label = `${filename}.${field}[${index}]`;
      exactKeys(item, field === 'sources' ? ['title', 'url', 'publication', 'locator'] : ['title', 'url'], label);
      requireText(item.title, `${label}.title`);
      validateUrl(item.url, `${label}.url`);
      if (field === 'sources') for (const detail of ['publication', 'locator']) {
        if (item[detail] !== undefined) requireText(item[detail], `${label}.${detail}`);
      }
    });
  }
  if (!Array.isArray(post.body) || !post.body.length) fail(`${filename}.body: en az bir içerik bloğu gerekli.`);
  post.body.forEach((block, index) => {
    const label = `${filename}.body[${index}]`;
    if (!isObject(block)) fail(`${label}: içerik bloğu gerekli.`);
    switch (block.type) {
      case 'paragraph':
        exactKeys(block, ['type', 'text'], label);
        requireText(block.text, `${label}.text`);
        break;
      case 'heading':
        exactKeys(block, ['type', 'text', 'level'], label);
        requireText(block.text, `${label}.text`);
        if (block.level !== undefined && ![2, 3].includes(block.level)) fail(`${label}.level: 2 veya 3 olabilir.`);
        break;
      case 'list':
        exactKeys(block, ['type', 'items', 'ordered'], label);
        if (!Array.isArray(block.items) || !block.items.length) fail(`${label}.items: boş olmayan dizi gerekli.`);
        block.items.forEach((item, n) => requireText(item, `${label}.items[${n}]`));
        if (block.ordered !== undefined && typeof block.ordered !== 'boolean') fail(`${label}.ordered: true veya false olabilir.`);
        break;
      case 'quote':
        exactKeys(block, ['type', 'text', 'attribution'], label);
        requireText(block.text, `${label}.text`);
        if (block.attribution !== undefined) requireText(block.attribution, `${label}.attribution`);
        break;
      case 'link':
        exactKeys(block, ['type', 'text', 'url'], label);
        requireText(block.text, `${label}.text`);
        validateUrl(block.url, `${label}.url`);
        break;
      default: fail(`${label}.type: paragraph, heading, list, quote veya link gerekli.`);
    }
  });
  return post;
}

export async function loadPosts(rootDir, folder = 'posts') {
  const directory = path.join(rootDir, 'content', folder);
  const files = await fs.readdir(directory, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const posts = [];
  const slugs = new Set();
  for (const file of files.filter(file => file.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!file.isFile()) fail(`content/posts/${file.name}: normal JSON dosyası gerekli.`);
    let post;
    try { post = JSON.parse(await fs.readFile(path.join(directory, file.name), 'utf8')); }
    catch (error) { fail(`${file.name}: JSON okunamadı: ${error.message}`); }
    validatePost(post, file.name);
    Object.defineProperty(post, MEDIA_DIRECTORY, { value: path.join(rootDir, 'content', ...(folder === 'drafts' ? ['drafts', 'media'] : ['media'])) });
    if (slugs.has(post.slug)) fail(`${file.name}: tekrar eden slug: ${post.slug}`);
    slugs.add(post.slug);
    posts.push(post);
  }
  return posts;
}

const postUrl = post => `/yazilar/${post.slug}/`;
const imageUrl = (value, post) => value.startsWith('media/')
  ? (post?.[PREVIEW_ONLY] ? `/_taslaklar/${post.slug}/media/${value.slice(6)}` : `/assets/posts/${value.slice(6)}`)
  : value;
const formattedDate = value => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(publicationTimestamp(value)));
const renderTime = post => post.publishedAt ? `<time datetime="${escapeHtml(post.publishedAt)}">${formattedDate(post.publishedAt)}</time>` : '<span>Yayın tarihi belirlenmedi</span>';
const renderTags = post => post.tags?.length ? `<div class="blog-tags">${post.tags.map(tag => `<span class="blog-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : '';

export function renderCards(posts, headingLevel = 3) {
  if (!posts.length) return '<div class="blog-empty"><p class="blog-empty-title">Henüz yayımlanmış yazı yok.</p><p>Yeni yazılar burada yer alacak.</p></div>';
  return `<div class="blog-grid">${posts.map(post => `<article class="blog-card">
    ${post.image ? `<a class="blog-card-image" href="${postUrl(post)}" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(imageUrl(post.image.url, post))}" alt="" loading="lazy" width="800" height="500"></a>` : ''}
    <div class="blog-card-body"><div class="blog-card-meta">${renderTime(post)}</div>
      <h${headingLevel} class="blog-card-title"><a href="${postUrl(post)}">${escapeHtml(post.title)}</a></h${headingLevel}>
      <p class="blog-card-summary">${escapeHtml(post.summary)}</p>${renderTags(post)}
      <a class="blog-card-link" href="${postUrl(post)}" aria-label="${escapeHtml(post.title)} yazısını oku">Yazıyı oku <span aria-hidden="true">↗</span></a>
    </div></article>`).join('\n')}</div>`;
}

function renderBody(body) {
  return body.map(block => {
    switch (block.type) {
      case 'paragraph': return `<p>${htmlText(block.text)}</p>`;
      case 'heading': return `<h${block.level || 2}>${escapeHtml(block.text)}</h${block.level || 2}>`;
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        return `<${tag}>${block.items.map(item => `<li>${htmlText(item)}</li>`).join('')}</${tag}>`;
      }
      case 'quote': return `<blockquote><p>${htmlText(block.text)}</p>${block.attribution ? `<cite>${escapeHtml(block.attribution)}</cite>` : ''}</blockquote>`;
      case 'link': return `<p><a href="${escapeHtml(block.url)}">${escapeHtml(block.text)}</a></p>`;
    }
  }).join('\n');
}

function shell({ title, description, canonical, content, preview, structuredData, image, theme }) {
  const fullTitle = `${title} | Doç. Dr. Soner Berşe`;
  return `<!DOCTYPE html>
<html lang="tr" data-theme="${theme}"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fullTitle)}</title><meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="Doç. Dr. Soner Berşe"><meta name="robots" content="${preview ? 'noindex, nofollow' : 'index, follow'}">
  ${canonical ? `<link rel="canonical" href="${SITE_URL}${canonical}">` : ''}
  <meta property="og:title" content="${escapeHtml(fullTitle)}"><meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="${structuredData?.['@type'] === 'BlogPosting' ? 'article' : 'website'}">
  ${canonical ? `<meta property="og:url" content="${SITE_URL}${canonical}">` : ''}
  <meta property="og:locale" content="tr_TR"><meta property="og:site_name" content="Doç. Dr. Soner Berşe">
  <meta property="og:image" content="${escapeHtml(image || `${SITE_URL}/assets/og-image.jpg`)}">
  <meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="${themeColor(theme)}">
  <link rel="icon" type="image/png" href="/assets/icon-192.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/manifest.json">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/blog.css">
  <link rel="stylesheet" href="/assets/theme-light.css">
  <link rel="stylesheet" href="/assets/blog-light.css">
  ${structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>` : ''}
</head><body class="blog-page">
  <a class="blog-skip-link" href="#main-content">İçeriğe geç</a>
  <header class="blog-site-header"><div class="blog-header-inner blog-container">
    <a class="blog-brand" href="/"><span class="blog-brand-monogram" aria-hidden="true">SB</span><span>Doç. Dr. Soner Berşe<small>Akademisyen · Araştırmacı</small></span></a>
    <nav class="blog-nav" aria-label="Ana menü"><a href="/">Ana Sayfa</a><a href="/yazilar/"${canonical === '/yazilar/' ? ' aria-current="page"' : ' class="active"'}>Yazılarım</a><a href="/#contact">İletişim</a></nav>
  </div></header>
  <main class="blog-main blog-container" id="main-content">${content}</main>
  <footer class="blog-site-footer"><div class="blog-container"><p>Doç. Dr. Soner Berşe</p><a href="/">Ana sayfaya dön <span aria-hidden="true">↗</span></a></div></footer>
</body></html>\n`;
}

function renderArchive(posts, preview, theme) {
  const description = 'Akademik yaşam, eğitim ve güncel gelişmeler üzerine yazılar, deneyimler ve duyurular.';
  return shell({ title: 'Yazılarım', description, canonical: '/yazilar/', preview, theme,
    structuredData: { '@context': 'https://schema.org', '@type': 'Blog', name: 'Yazılarım — Soner Berşe', url: `${SITE_URL}/yazilar/`, description, author: { '@type': 'Person', name: 'Soner Berşe', url: SITE_URL } },
    content: `<div class="blog-page-heading"><p class="blog-eyebrow">Düşünceler · Deneyimler · Duyurular</p><h1>Yazılarım</h1><p class="blog-lead">${description}</p></div>${renderCards(posts, 2)}`,
  });
}

function renderResources(items, title, className) {
  return items?.length ? `<section class="${className}"><h2>${title}</h2><ul>${items.map(item => `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></li>`).join('')}</ul></section>` : '';
}

function renderSources(items) {
  const isApa = item => item.publication !== undefined || item.locator !== undefined;
  if (!items?.some(isApa)) return renderResources(items, 'Kaynaklar', 'blog-references');
  return `<section class="blog-references blog-references-apa"><h2>Kaynakça</h2>${items.map(item => {
    const link = `<a href="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a>`;
    if (!isApa(item)) return `<ul><li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></li></ul>`;
    const publication = item.publication === undefined ? '' : `<em>${escapeHtml(item.publication)}</em>`;
    const locator = item.locator === undefined ? '' : escapeHtml(item.locator);
    const details = [publication, locator].filter(Boolean).join(', ');
    return `<p class="blog-apa-reference">${escapeHtml(item.title)} ${details}. ${link}</p>`;
  }).join('')}</section>`;
}

function renderArticle(post, preview, unpublished, theme) {
  const heroImage = post.image ? imageUrl(post.image.url, post) : undefined;
  const absoluteImage = heroImage ? new URL(heroImage, SITE_URL).href : undefined;
  const canonical = unpublished ? undefined : postUrl(post);
  const structuredData = unpublished ? undefined : {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
    description: post.summary, datePublished: post.publishedAt, inLanguage: 'tr',
    author: { '@type': 'Person', name: 'Soner Berşe', url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}${canonical}`, ...(absoluteImage ? { image: absoluteImage } : {}),
  };
  return shell({ title: post.title, description: post.summary, canonical, preview, structuredData, image: absoluteImage, theme,
    content: `<article class="blog-article">
      <a class="blog-back" href="/yazilar/">← Tüm yazılar</a>
      ${unpublished ? '<aside class="blog-draft-notice" role="note">Taslak önizlemesi · Bu yazı henüz yayımlanmadı ve yalnızca yerel önizlemede görünür.</aside>' : ''}
      <header class="blog-article-header"><div class="blog-article-meta">${renderTime(post)}<span>Soner Berşe</span></div>
      <h1 class="blog-article-title">${escapeHtml(post.title)}</h1><p class="blog-article-summary">${escapeHtml(post.summary)}</p>${renderTags(post)}</header>
      ${post.image ? `<img class="blog-article-image" src="${escapeHtml(heroImage)}" alt="${escapeHtml(post.image.alt)}" width="1200" height="750">` : ''}
      <div class="blog-prose">${renderBody(post.body)}
      ${renderSources(post.sources)}
      ${renderResources(post.relatedPublications, 'İlişkili yayınlar', 'blog-related')}</div>
    </article>`,
  });
}

async function copyTree(source, target) {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) fail(`Sembolik bağlantı yayımlanamaz: ${source}`);
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    for (const entry of await fs.readdir(source)) await copyTree(path.join(source, entry), path.join(target, entry));
  } else if (stat.isFile()) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }
}

async function copyMedia(post, rootDir, outputDir) {
  const url = post.image?.url;
  if (!url || /^https:\/\//.test(url)) return;
  if (url.startsWith('/assets/')) {
    const stat = await fs.lstat(path.join(rootDir, url.slice(1))).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink()) fail(`${post.slug}: görsel bulunamadı: ${url}`);
    return;
  }
  const source = path.join(post[MEDIA_DIRECTORY], url.slice(6));
  const stat = await fs.lstat(source).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) fail(`${post.slug}: içerik görseli bulunamadı: ${url}`);
  await copyTree(source, path.join(outputDir, imageUrl(url, post).slice(1)));
}

async function writePage(outputDir, url, html) {
  const filename = path.join(outputDir, url, 'index.html');
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, html);
}

async function resetGeneratedDirectory(outputDir) {
  const stat = await fs.lstat(outputDir).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (stat) {
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`Çıktı yolu normal bir klasör olmalı: ${outputDir}`);
    const entries = await fs.readdir(outputDir);
    const signature = await fs.readFile(path.join(outputDir, OUTPUT_MARKER), 'utf8').catch(() => null);
    if (entries.length && signature !== OUTPUT_SIGNATURE) {
      fail(`Mevcut dosyalar korundu: ${outputDir} bu üreticiye ait değil. Bu klasörü kontrol edip başka yere taşıdıktan sonra yeniden deneyin.`);
    }
    await fs.rm(outputDir, { recursive: true, force: true });
  }
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, OUTPUT_MARKER), OUTPUT_SIGNATURE);
}

async function loadTheme(rootDir) {
  const source = await fs.readFile(path.join(rootDir, 'site.config.json'), 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (source === null) return 'dark';
  let config;
  try { config = JSON.parse(source); }
  catch { fail('site.config.json: geçerli JSON gerekli.'); }
  if (!isObject(config) || !['light', 'dark'].includes(config.theme)) fail('site.config.json.theme: light veya dark gerekli.');
  return config.theme;
}

export async function buildSite({ rootDir = ROOT_DIR, preview = false, now = new Date() } = {}) {
  rootDir = path.resolve(rootDir);
  const timestamp = new Date(now).getTime();
  if (!Number.isFinite(timestamp)) fail('Derleme zamanı geçersiz.');
  const theme = await loadTheme(rootDir);
  const posts = await loadPosts(rootDir);
  const localDrafts = preview ? await loadPosts(rootDir, 'drafts') : [];
  const allSlugs = new Set();
  for (const post of [...posts, ...localDrafts]) {
    if (allSlugs.has(post.slug)) fail(`Yayımlanmış yazı ve taslak aynı slug değerini kullanamaz: ${post.slug}`);
    allSlugs.add(post.slug);
  }
  const published = posts.filter(post => post.status === 'published' && publicationTimestamp(post.publishedAt) <= timestamp)
    .sort((a, b) => publicationTimestamp(b.publishedAt) - publicationTimestamp(a.publishedAt) || a.slug.localeCompare(b.slug));
  const misplacedDrafts = posts.filter(post => !published.includes(post));
  if (!preview && misplacedDrafts.length) {
    fail(`Yayımlanmamış yazıları herkese açık GitHub deposuna eklemeyin. Şu yazıları content/posts yerine yerel content/drafts klasörüne taşıyın: ${misplacedDrafts.map(post => post.slug).join(', ')}`);
  }
  const unpublished = [...misplacedDrafts, ...localDrafts];
  for (const post of unpublished) Object.defineProperty(post, PREVIEW_ONLY, { value: true });
  const outputDir = path.join(rootDir, preview ? '.preview' : 'dist');
  let home = await fs.readFile(path.join(rootDir, 'index.html'), 'utf8');
  if (home.split(LATEST_START).length !== 2 || home.split(LATEST_END).length !== 2 || home.indexOf(LATEST_START) > home.indexOf(LATEST_END)) {
    fail('index.html: tek bir BLOG_LATEST_START / BLOG_LATEST_END işaret çifti gerekli.');
  }
  home = `${home.slice(0, home.indexOf(LATEST_START) + LATEST_START.length)}\n${renderCards(published.slice(0, 3))}\n${home.slice(home.indexOf(LATEST_END))}`;
  home = home.replace(/<html\b([^>]*)>/i, (_, attributes) => `<html${attributes.replace(/\s+data-theme\s*=\s*(["']).*?\1/gi, '')} data-theme="${theme}">`);
  const themeMeta = `<meta name="theme-color" content="${themeColor(theme)}">`;
  home = /<meta\s+name=["']theme-color["'][^>]*>/i.test(home)
    ? home.replace(/<meta\s+name=["']theme-color["'][^>]*>/i, themeMeta)
    : home.replace('</head>', `${themeMeta}\n</head>`);
  if (preview) {
    home = home.replace(/<meta\s+name=["']robots["'][^>]*>/gi, '');
    home = home.replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>');
  }
  let sitemap = await fs.readFile(path.join(rootDir, 'sitemap.xml'), 'utf8');
  if (!sitemap.includes('</urlset>')) fail('sitemap.xml: geçerli urlset gerekli.');
  // Preserve non-blog entries; rebuild this section so retired posts disappear.
  sitemap = sitemap.replace(/\s*<url\b[^>]*>[\s\S]*?<\/url>/g, entry => /<loc>\s*https:\/\/sonerberse\.com\/(?:yazilar|_taslaklar)(?:\/|<)/.test(entry) ? '' : entry);
  const entries = [`  <url><loc>${SITE_URL}/yazilar/</loc></url>`, ...published.map(post => `  <url><loc>${SITE_URL}${postUrl(post)}</loc><lastmod>${escapeHtml(post.publishedAt)}</lastmod></url>`)];
  sitemap = sitemap.replace('</urlset>', `${entries.join('\n')}\n</urlset>`);

  await resetGeneratedDirectory(outputDir);
  for (const filename of PUBLIC_FILES) {
    try { await copyTree(path.join(rootDir, filename), path.join(outputDir, filename)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const assetDir = path.join(rootDir, 'assets');
  try { await copyTree(assetDir, path.join(outputDir, 'assets')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(path.join(outputDir, 'index.html'), home);
  await fs.writeFile(path.join(outputDir, 'sitemap.xml'), sitemap);
  if (theme === 'light') {
    const manifestSource = await fs.readFile(path.join(rootDir, 'manifest.json'), 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (manifestSource !== null) {
      const manifest = JSON.parse(manifestSource);
      await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify({ ...manifest, background_color: themeColor(theme), theme_color: themeColor(theme) }, null, 2)}\n`);
    }
  }
  if (preview) await fs.writeFile(path.join(outputDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await writePage(outputDir, 'yazilar', renderArchive(published, preview, theme));
  for (const post of published) {
    await copyMedia(post, rootDir, outputDir);
    await writePage(outputDir, path.join('yazilar', post.slug), renderArticle(post, preview, false, theme));
  }
  if (preview) for (const post of unpublished) {
    await copyMedia(post, rootDir, outputDir);
    await writePage(outputDir, path.join('_taslaklar', post.slug), renderArticle(post, true, true, theme));
  }
  return { outputDir, published: published.length, drafts: preview ? unpublished.length : 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = process.argv.slice(2);
  if (flags.some(flag => flag !== '--preview')) { console.error('Kullanım: node scripts/build.mjs [--preview]'); process.exitCode = 1; }
  else try {
    const result = await buildSite({ preview: flags.includes('--preview') });
    console.log(`${path.basename(result.outputDir)} hazır: ${result.published} yayımlanmış yazı${flags.includes('--preview') ? `, ${result.drafts} yerel taslak` : ''}.`);
  } catch (error) { console.error(`Derleme tamamlanamadı: ${error.message}`); process.exitCode = 1; }
}
