import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSite, publicationTimestamp, validatePost } from './build.mjs';

const NOW = new Date('2026-09-07T12:00:00Z');
// Fixtures exist only in temporary test directories and are removed after each test.
const post = (slug, extra = {}) => ({ title: `TEST ONLY ${slug}`, slug, status: 'published', publishedAt: '2026-09-01', summary: `TEST SUMMARY ${slug}`, body: [{ type: 'paragraph', text: `TEST BODY ${slug}` }], ...extra });
async function fixture(t) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sonerberse-blog-test-'));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  await fs.mkdir(path.join(rootDir, 'content', 'posts'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'content', 'drafts', 'media'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'content', 'media'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(rootDir, 'index.html'), '<!doctype html><html><head><meta name="robots" content="index, follow"></head><body><h1>TEST</h1><!-- BLOG_LATEST_START -->old<!-- BLOG_LATEST_END --></body></html>');
  await fs.writeFile(path.join(rootDir, 'sitemap.xml'), '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://sonerberse.com/</loc><lastmod>2026-06-12</lastmod></url><url><loc>https://sonerberse.com/other/</loc></url><url><loc>https://sonerberse.com/yazilar/retired/</loc></url></urlset>');
  await fs.writeFile(path.join(rootDir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  return rootDir;
}
async function save(rootDir, item, folder = 'posts') {
  await fs.writeFile(path.join(rootDir, 'content', folder, `${item.slug}.json`), JSON.stringify(item));
}
const read = (rootDir, file) => fs.readFile(path.join(rootDir, file), 'utf8');
async function absent(rootDir, file) {
  await assert.rejects(fs.access(path.join(rootDir, file)), { code: 'ENOENT' });
}

test('empty site produces finished archive with no fabricated article', async t => {
  const rootDir = await fixture(t);
  const result = await buildSite({ rootDir, now: NOW });
  assert.equal(result.published, 0);
  const archive = await read(rootDir, 'dist/yazilar/index.html');
  assert.match(archive, /<h1>Yazılarım<\/h1>/);
  assert.match(archive, /Henüz yayımlanmış yazı yok/);
  assert.doesNotMatch(archive, /blog-card-title|TEST ONLY/);
  assert.deepEqual(await fs.readdir(path.join(rootDir, 'dist/yazilar')), ['index.html']);
});

test('published pages, archive and latest three are ordered; private sources never ship', async t => {
  const rootDir = await fixture(t);
  for (let day = 1; day <= 4; day++) await save(rootDir, post(`published-${day}`, { publishedAt: `2026-09-0${day}` }));
  await save(rootDir, post('secret-draft', { status: 'draft' }), 'drafts');
  await save(rootDir, post('future-secret', { publishedAt: '2026-09-08' }), 'drafts');
  await fs.writeFile(path.join(rootDir, '.env'), 'SECRET=NO');
  await fs.writeFile(path.join(rootDir, 'package.json'), '{}');
  const result = await buildSite({ rootDir, now: NOW });
  assert.equal(result.published, 4);
  const home = await read(rootDir, 'dist/index.html');
  const archive = await read(rootDir, 'dist/yazilar/index.html');
  const sitemap = await read(rootDir, 'dist/sitemap.xml');
  assert.equal((home.match(/class="blog-card"/g) || []).length, 3);
  assert(home.indexOf('published-4') < home.indexOf('published-3'));
  assert(home.indexOf('published-3') < home.indexOf('published-2'));
  assert.doesNotMatch(home, /published-1|secret-draft|future-secret/);
  assert.equal((archive.match(/class="blog-card"/g) || []).length, 4);
  assert.match(sitemap, /https:\/\/sonerberse.com\/other\//);
  assert.match(sitemap, /<lastmod>2026-06-12<\/lastmod>/);
  assert.match(sitemap, /https:\/\/sonerberse.com\/yazilar\/published-1\//);
  assert.doesNotMatch(sitemap, /secret-draft|future-secret|retired|_taslaklar/);
  for (const file of ['dist/.env', 'dist/package.json', 'dist/content', 'dist/_taslaklar', 'dist/yazilar/secret-draft', 'dist/yazilar/future-secret']) await absent(rootDir, file);
});

test('preview keeps draft pages and images isolated from published URLs, listings and sitemap', async t => {
  const rootDir = await fixture(t);
  await save(rootDir, post('published', { image: { url: 'media/shared.jpg', alt: 'Published test image' } }));
  await save(rootDir, post('local-draft', { status: 'draft', publishedAt: undefined, image: { url: 'media/shared.jpg', alt: 'Private draft image' } }), 'drafts');
  await save(rootDir, post('future-post', { publishedAt: '2026-10-01' }), 'drafts');
  await save(rootDir, post('private-approved', { status: 'published' }), 'drafts');
  await fs.writeFile(path.join(rootDir, 'content/media/shared.jpg'), 'PUBLISHED IMAGE');
  await fs.writeFile(path.join(rootDir, 'content/drafts/media/shared.jpg'), 'SECRET IMAGE');
  await fs.writeFile(path.join(rootDir, 'content/media/unused.jpg'), 'UNREFERENCED IMAGE');
  const result = await buildSite({ rootDir, preview: true, now: NOW });
  assert.equal(result.drafts, 3);
  assert.equal(result.published, 1);
  const draft = await read(rootDir, '.preview/_taslaklar/local-draft/index.html');
  assert.match(draft, /Taslak önizlemesi/);
  assert.match(draft, /noindex, nofollow/);
  assert.match(draft, /Yayın tarihi belirlenmedi/);
  assert.match(draft, /src="\/_taslaklar\/local-draft\/media\/shared.jpg"/);
  assert.doesNotMatch(draft, /rel="canonical"|application\/ld\+json/);
  assert.equal(await read(rootDir, '.preview/_taslaklar/local-draft/media/shared.jpg'), 'SECRET IMAGE');
  assert.equal(await read(rootDir, '.preview/assets/posts/shared.jpg'), 'PUBLISHED IMAGE');
  await absent(rootDir, '.preview/assets/posts/unused.jpg');
  for (const file of ['.preview/index.html', '.preview/yazilar/index.html', '.preview/yazilar/published/index.html']) {
    const html = await read(rootDir, file);
    assert.match(html, /noindex, nofollow/);
    assert.doesNotMatch(html, /local-draft|future-post|private-approved|SECRET IMAGE/);
  }
  assert.doesNotMatch(await read(rootDir, '.preview/sitemap.xml'), /local-draft|future-post|private-approved|_taslaklar/);
  assert.match(await read(rootDir, '.preview/robots.txt'), /Disallow: \//);
  await absent(rootDir, '.preview/yazilar/local-draft');
  await buildSite({ rootDir, now: NOW });
  await absent(rootDir, 'dist/_taslaklar');
  assert.equal(await read(rootDir, 'dist/assets/posts/shared.jpg'), 'PUBLISHED IMAGE');
});

test('a private malformed draft does not affect production', async t => {
  const rootDir = await fixture(t);
  await fs.writeFile(path.join(rootDir, 'content/drafts/incomplete.json'), '{');
  await buildSite({ rootDir, now: NOW });
  await assert.rejects(buildSite({ rootDir, preview: true, now: NOW }), /JSON okunamadı/);
});

test('tracked draft or future content blocks production with privacy guidance', async t => {
  const rootDir = await fixture(t);
  await save(rootDir, post('future', { publishedAt: '2026-09-08' }));
  await assert.rejects(buildSite({ rootDir, now: NOW }), /yerel content\/drafts/);
  await absent(rootDir, 'dist');
  await fs.unlink(path.join(rootDir, 'content/posts/future.json'));
  await save(rootDir, post('draft', { status: 'draft' }));
  await assert.rejects(buildSite({ rootDir, now: NOW }), /yerel content\/drafts/);
  await buildSite({ rootDir, preview: true, now: NOW });
  assert.doesNotMatch(await read(rootDir, '.preview/sitemap.xml'), /\/draft\//);
});

test('calendar dates publish at Istanbul midnight while explicit ISO times stay exact', async t => {
  const rootDir = await fixture(t);
  const shortlyAfterLocalMidnight = new Date('2026-09-08T00:30:00+03:00');
  assert.equal(publicationTimestamp('2026-09-08'), Date.parse('2026-09-07T21:00:00Z'));
  assert.equal(publicationTimestamp('2026-09-07T21:15:00Z'), Date.parse('2026-09-08T00:15:00+03:00'));
  await save(rootDir, post('previous-date', { publishedAt: '2026-09-07' }));
  await save(rootDir, post('local-today', { publishedAt: '2026-09-08' }));
  await save(rootDir, post('explicit-past', { publishedAt: '2026-09-07T21:15:00Z' }));
  const result = await buildSite({ rootDir, now: shortlyAfterLocalMidnight });
  assert.equal(result.published, 3);
  const home = await read(rootDir, 'dist/index.html');
  assert(home.indexOf('explicit-past') < home.indexOf('local-today'));
  assert(home.indexOf('local-today') < home.indexOf('previous-date'));
  assert.match(await read(rootDir, 'dist/yazilar/local-today/index.html'), /8 Eylül 2026/);
  await save(rootDir, post('future-date', { publishedAt: '2026-09-09' }));
  await save(rootDir, post('explicit-future', { publishedAt: '2026-09-08T00:45:00+03:00' }));
  await assert.rejects(buildSite({ rootDir, now: shortlyAfterLocalMidnight }), /yerel content\/drafts/);
  const preview = await buildSite({ rootDir, preview: true, now: shortlyAfterLocalMidnight });
  assert.equal(preview.published, 3);
  assert.equal(preview.drafts, 2);
  assert.doesNotMatch(await read(rootDir, '.preview/yazilar/index.html'), /future-date|explicit-future/);
  assert.doesNotMatch(await read(rootDir, '.preview/sitemap.xml'), /future-date|explicit-future/);
});

test('article text, attributes and structured data escape markup without losing content', async t => {
  const rootDir = await fixture(t);
  const title = '</script><script>alert("test")</script> & title';
  const item = post('escaping', { title, summary: '"Quoted" <summary> & text', tags: ['<test-tag>'], body: [
    { type: 'paragraph', text: '<img src=x onerror=alert(1)>\nsecond line' },
    { type: 'heading', text: 'Test heading', level: 2 },
    { type: 'list', ordered: true, items: ['<first>', 'second'] },
    { type: 'quote', text: 'Test quote', attribution: 'Test attribution' },
    { type: 'link', text: '<reference>', url: 'https://example.org/?x=1&y=2' },
  ], sources: [{ title: '<source>', url: 'https://example.org/source' }], relatedPublications: [{ title: 'Test publication', url: 'https://example.org/publication' }] });
  await save(rootDir, item);
  await buildSite({ rootDir, now: NOW });
  const html = await read(rootDir, 'dist/yazilar/escaping/index.html');
  assert.match(html, /<time datetime="2026-09-01">1 Eylül 2026<\/time>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;<br>second line/);
  assert.match(html, /&lt;test-tag&gt;/);
  assert.match(html, /href="https:\/\/example.org\/\?x=1&amp;y=2"/);
  assert.match(html, /Kaynaklar/);
  assert.match(html, /İlişkili yayınlar/);
  assert.doesNotMatch(html, /<script>alert|<img src=x|<source>/);
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(json).headline, title);
  assert.match(html, /rel="canonical" href="https:\/\/sonerberse.com\/yazilar\/escaping\/"/);
});

test('APA sources render escaped hanging-indent entries while legacy links keep their format', async t => {
  const rootDir = await fixture(t);
  const source = {
    title: 'Test Author, A. (2026). <script>Test title</script>.',
    publication: 'Test Journal & <journal>, 93',
    locator: 'Article <104847>',
    url: 'https://doi.org/10.0000/test?one=1&two=2',
  };
  await save(rootDir, post('apa', {
    sources: [source, { title: 'Second test reference.', publication: 'Another Journal, 88', locator: 'Article 104549', url: 'https://example.org/second' }],
    relatedPublications: [{ title: 'Legacy related title', url: 'https://example.org/related' }],
  }));
  await buildSite({ rootDir, now: NOW });
  const html = await read(rootDir, 'dist/yazilar/apa/index.html');
  const references = html.match(/<section class="blog-references blog-references-apa">([\s\S]*?)<\/section>/)[1];
  assert.match(references, /<h2>Kaynakça<\/h2>/);
  assert.equal((references.match(/class="blog-apa-reference"/g) || []).length, 2);
  assert.doesNotMatch(references, /<ul|<ol|<li|<script|<journal>/);
  assert.match(references, /Test Author, A\. \(2026\)\. &lt;script&gt;Test title&lt;\/script&gt;\. <em>Test Journal &amp; &lt;journal&gt;, 93<\/em>, Article &lt;104847&gt;\. <a href="https:\/\/doi\.org\/10\.0000\/test\?one=1&amp;two=2">https:\/\/doi\.org\/10\.0000\/test\?one=1&amp;two=2<\/a>/);
  assert(references.indexOf('Test Author') < references.indexOf('Second test reference'));
  assert.match(html, /<section class="blog-related"><h2>İlişkili yayınlar<\/h2><ul><li><a href="https:\/\/example\.org\/related">Legacy related title<\/a><\/li><\/ul><\/section>/);
  for (const field of ['publication', 'locator']) {
    for (const invalid of ['', '   ', null, 42]) {
      assert.throws(() => validatePost(post('invalid-apa', { sources: [{ ...source, [field]: invalid }] })), new RegExp(`sources\\[0\\]\\.${field}`));
    }
  }
  assert.throws(() => validatePost(post('invalid-related', { relatedPublications: [{ title: 'Legacy', url: 'https://example.org/', publication: 'Not supported' }] })), /bilinmeyen alan publication/);
  await save(rootDir, post('mixed', { sources: [{ title: 'Legacy source title', url: 'https://example.org/legacy' }, source] }));
  await buildSite({ rootDir, now: NOW });
  assert.match(await read(rootDir, 'dist/yazilar/mixed/index.html'), /<ul><li><a href="https:\/\/example\.org\/legacy">Legacy source title<\/a><\/li><\/ul>/);
});

test('invalid schema, unsafe URLs, invalid dates and duplicate slugs fail clearly', async t => {
  for (const invalid of [
    { slug: '../escape' }, { slug: 'Uppercase' }, { status: 'public' }, { publishedAt: '2026-02-30' },
    { publishedAt: 'tomorrow' }, { publishedAt: '2026-09-01T12:00:00' }, { body: [] },
    { body: [{ type: 'heading', text: 'h', level: 1 }] },
    { body: [{ type: 'html', text: '<div>' }] },
    { sources: [{ title: 'Bad', url: 'javascript:alert(1)' }] },
    { image: { url: 'media/../private.jpg', alt: 'Bad' } },
    { image: { url: 'https://user:password@example.org/photo.jpg', alt: 'Bad' } },
    { unknownField: true },
  ]) assert.throws(() => validatePost(post('valid', invalid)));
  const rootDir = await fixture(t);
  await save(rootDir, post('duplicate'));
  await fs.writeFile(path.join(rootDir, 'content/posts/another.json'), JSON.stringify(post('duplicate')));
  await assert.rejects(buildSite({ rootDir, now: NOW }), /tekrar eden slug/);
  await fs.unlink(path.join(rootDir, 'content/posts/another.json'));
  await save(rootDir, post('duplicate', { status: 'draft' }), 'drafts');
  await assert.rejects(buildSite({ rootDir, preview: true, now: NOW }), /aynı slug/);
});

test('rebuilding removes retired URLs and abandoned draft output', async t => {
  const rootDir = await fixture(t);
  await save(rootDir, post('retired'));
  await save(rootDir, post('discarded', { status: 'draft' }), 'drafts');
  await buildSite({ rootDir, now: NOW });
  await buildSite({ rootDir, preview: true, now: NOW });
  await fs.unlink(path.join(rootDir, 'content/posts/retired.json'));
  await fs.unlink(path.join(rootDir, 'content/drafts/discarded.json'));
  await buildSite({ rootDir, now: NOW });
  await buildSite({ rootDir, preview: true, now: NOW });
  await absent(rootDir, 'dist/yazilar/retired');
  await absent(rootDir, '.preview/_taslaklar/discarded');
  assert.doesNotMatch(await read(rootDir, 'dist/sitemap.xml'), /\/retired\//);
});

test('missing marker and missing referenced image stop incomplete builds', async t => {
  const rootDir = await fixture(t);
  await save(rootDir, post('missing-image', { image: { url: 'media/missing.jpg', alt: 'Test image' } }));
  await assert.rejects(buildSite({ rootDir, now: NOW }), /görseli bulunamadı/);
  await fs.writeFile(path.join(rootDir, 'index.html'), '<html><head></head><body></body></html>');
  await assert.rejects(buildSite({ rootDir, now: NOW }), /BLOG_LATEST_START/);
});

test('existing user public files and unowned output directories are preserved', async t => {
  const rootDir = await fixture(t);
  await fs.mkdir(path.join(rootDir, 'public'));
  await fs.writeFile(path.join(rootDir, 'public/user-original.JPG'), 'USER ORIGINAL');
  await buildSite({ rootDir, now: NOW });
  assert.equal(await read(rootDir, 'public/user-original.JPG'), 'USER ORIGINAL');
  await fs.unlink(path.join(rootDir, 'dist/.sonerberse-generated'));
  await fs.writeFile(path.join(rootDir, 'dist/user-file.txt'), 'DO NOT DELETE');
  await assert.rejects(buildSite({ rootDir, now: NOW }), /Mevcut dosyalar korundu/);
  assert.equal(await read(rootDir, 'dist/user-file.txt'), 'DO NOT DELETE');
  await fs.mkdir(path.join(rootDir, '.preview'));
  await fs.writeFile(path.join(rootDir, '.preview/user-file.txt'), 'LOCAL FILE');
  await assert.rejects(buildSite({ rootDir, preview: true, now: NOW }), /Mevcut dosyalar korundu/);
  assert.equal(await read(rootDir, '.preview/user-file.txt'), 'LOCAL FILE');
});

test('theme configuration reaches home, blog pages and output manifest without changing sources', async t => {
  const rootDir = await fixture(t);
  const originalHome = (await read(rootDir, 'index.html')).replace('<html>', '<html lang="tr" data-theme="dark">');
  const originalManifest = JSON.stringify({ name: 'TEST SITE', theme_color: '#0a0f1e', background_color: '#0a0f1e', icons: [{ src: '/assets/test.png' }] });
  await fs.writeFile(path.join(rootDir, 'index.html'), originalHome);
  await fs.writeFile(path.join(rootDir, 'manifest.json'), originalManifest);
  await fs.writeFile(path.join(rootDir, 'site.config.json'), JSON.stringify({ theme: 'light' }));
  await save(rootDir, post('published-theme'));
  await save(rootDir, post('draft-theme', { status: 'draft' }), 'drafts');
  await buildSite({ rootDir, preview: true, now: NOW });
  for (const file of ['.preview/index.html', '.preview/yazilar/index.html', '.preview/yazilar/published-theme/index.html', '.preview/_taslaklar/draft-theme/index.html']) {
    const html = await read(rootDir, file);
    assert.equal((html.match(/data-theme="light"/g) || []).length, 1);
    assert.doesNotMatch(html, /data-theme="dark"/);
    assert.match(html, /<meta name="theme-color" content="#f8f6f1">/);
    if (file !== '.preview/index.html') {
      assert.match(html, /href="\/assets\/theme-light.css"/);
      assert.match(html, /href="\/assets\/blog-light.css"/);
    }
  }
  const outputManifest = JSON.parse(await read(rootDir, '.preview/manifest.json'));
  assert.equal(outputManifest.theme_color, '#f8f6f1');
  assert.equal(outputManifest.background_color, '#f8f6f1');
  assert.deepEqual(outputManifest.icons, [{ src: '/assets/test.png' }]);
  assert.equal(await read(rootDir, 'manifest.json'), originalManifest);
  assert.equal(await read(rootDir, 'index.html'), originalHome);
  await absent(rootDir, '.preview/site.config.json');
  await fs.writeFile(path.join(rootDir, 'site.config.json'), JSON.stringify({ theme: 'dark' }));
  await buildSite({ rootDir, now: NOW });
  assert.match(await read(rootDir, 'dist/index.html'), /data-theme="dark"/);
  assert.match(await read(rootDir, 'dist/yazilar/index.html'), /<meta name="theme-color" content="#0a0f1e">/);
  assert.equal(await read(rootDir, 'dist/manifest.json'), originalManifest);
  await fs.unlink(path.join(rootDir, 'site.config.json'));
  await buildSite({ rootDir, now: NOW });
  assert.match(await read(rootDir, 'dist/yazilar/published-theme/index.html'), /data-theme="dark"/);
  await fs.writeFile(path.join(rootDir, 'site.config.json'), JSON.stringify({ theme: 'invalid' }));
  await assert.rejects(buildSite({ rootDir, now: NOW }), /light veya dark/);
});
