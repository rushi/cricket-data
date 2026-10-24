#!/usr/bin/env npx zx
/**
 * Assembles the static site into _site/: the SQLite db, landing page,
 * custom theme, and a pinned copy of Datasette Lite.
 */
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { $, chalk } from 'zx/core';

$.verbose = false;

const LITE_COMMIT = '779b2d4da76a5dc2f1d9aea0d7c8d854f6e1497b';
const LITE_FILES = ['index.html', 'app.css', 'webworker.js'];
const SITE_FILES = ['cricket.db', 'index.html', 'custom.css', 'metadata.json', 'favicon.svg'];
const COUNTED_TABLES = ['players', 'stats', 'teams', 'countries', 'formats', 'styles'];

/** Fills the {{tokens}} in index.html with live numbers from the db. */
async function fillTokens() {
    const countsSql = COUNTED_TABLES.map((table) => `select '${table}' as name, count(*) as n from ${table}`).join(' union all ');
    const counts = JSON.parse((await $`sqlite-utils query cricket.db ${countsSql}`).stdout);
    const { size } = await stat('cricket.db');

    const tokens = {
        '{{table_count}}': String(COUNTED_TABLES.length),
        '{{total_rows}}': counts.reduce((sum, { n }) => sum + n, 0).toLocaleString('en-US'),
        '{{db_size}}': `${(size / 1e6).toFixed(1)} MB`,
        ...Object.fromEntries(counts.map(({ name, n }) => [`{{${name}_rows}}`, n.toLocaleString('en-US')])),
    };

    let html = await readFile('_site/index.html', 'utf8');
    for (const [token, value] of Object.entries(tokens)) {
        if (!html.includes(token)) {
            throw new Error(`${token} not found in index.html`);
        }
        html = html.replaceAll(token, value);
    }
    await writeFile('_site/index.html', html);
}

async function fetchLite() {
    await Promise.all(
        LITE_FILES.map(async (file) => {
            const url = `https://raw.githubusercontent.com/simonw/datasette-lite/${LITE_COMMIT}/${file}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`${url} returned HTTP ${res.status}`);
            }
            await writeFile(`_site/lite/${file}`, await res.text());
        }),
    );

    // Inject our theme after Datasette Lite's own stylesheet
    const litePath = '_site/lite/index.html';
    const html = await readFile(litePath, 'utf8');
    const appCssLink = '<link rel="stylesheet" href="app.css">';
    if (!html.includes(appCssLink)) {
        throw new Error('app.css link not found in datasette-lite index.html');
    }
    await writeFile(litePath, html.replace(appCssLink, `${appCssLink}\n  <link rel="stylesheet" href="../custom.css">`));
}

async function main() {
    await rm('_site', { recursive: true, force: true });
    await mkdir('_site/lite', { recursive: true });

    $.verbose = true;
    await $`node build.mjs`;
    await $`node verify.mjs`;
    $.verbose = false;

    await Promise.all(SITE_FILES.map((file) => copyFile(file, `_site/${file}`)));
    await fillTokens();
    await fetchLite();
    console.log(chalk.green('Assembled _site/'));
}

main().catch((err) => {
    console.error(chalk.red(err.message));
    process.exit(1);
});
