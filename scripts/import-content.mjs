#!/usr/bin/env node
// Turns the lab content spreadsheet into the data file the website is built from.
//
//   npm run content                          read content/lab-content.xlsx
//   npm run content -- ~/Downloads/new.xlsx  use this workbook (it replaces content/lab-content.xlsx)
//   npm run content -- Members.csv News.csv  replace just those tabs of content/lab-content.xlsx
//   npm run content -- some/folder           every .xlsx / .csv file in that folder
//   npm run content:check -- file.xlsx       only check the file; change nothing
//
// It runs automatically before `npm run dev` and `npm run build`.

import fs from 'node:fs';
import path from 'node:path';
import { buildModel, readSources, ROOT, toSiteData, writeWorkbook } from './content-io.mjs';

const CANONICAL = path.join(ROOT, 'content', 'lab-content.xlsx');
const PREVIOUS = path.join(ROOT, 'content', '.previous-lab-content.xlsx');
const OUTPUT = path.join(ROOT, 'src', 'data', 'lab.json');
const IN_CI = !!process.env.GITHUB_ACTIONS;

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const quiet = args.includes('--quiet');
if (args.includes('--help') || args.includes('-h')) {
	console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
	process.exit(0);
}

const inputs = [];
for (const a of args.filter((a) => !a.startsWith('--'))) {
	const p = path.resolve(a);
	if (!fs.existsSync(p)) fail([`File not found: ${a}`]);
	if (fs.statSync(p).isDirectory()) {
		const found = fs.readdirSync(p).filter((f) => /\.(xlsx|csv)$/i.test(f) && !f.startsWith('~$')).sort();
		if (!found.length) fail([`No .xlsx or .csv files in ${a}`]);
		inputs.push(...found.map((f) => path.join(p, f)));
	} else inputs.push(p);
}

const workbooks = inputs.filter((f) => /\.xlsx?m?$/i.test(f));
const csvs = inputs.filter((f) => !workbooks.includes(f));
if (workbooks.length > 1) fail(['Give at most one .xlsx workbook at a time.']);

// Tabs from the base workbook, with any CSV files layered on top.
const base = workbooks[0] ?? (fs.existsSync(CANONICAL) ? CANONICAL : null);
if (!base && !csvs.length) fail([`${path.relative(ROOT, CANONICAL)} does not exist. Run "npm run content:template" to create it.`]);
const sources = [base, ...csvs].filter(Boolean);

const warnings = [];
let sheets;
try {
	sheets = await readSources(sources, warnings);
} catch (err) {
	fail([err.message]);
}
const { model, errors, warnings: more } = buildModel(sheets);
warnings.push(...more);

report(warnings, 'warning');
if (errors.length) fail(errors);

const data = toSiteData(model);

if (checkOnly) {
	log(`✓ ${sources.map((s) => path.basename(s)).join(' + ')} looks good. ${summary(data)}`);
	process.exit(0);
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(data, null, '\t') + '\n');

// Keep content/lab-content.xlsx as the single source of truth.
const replacesCanonical = sources.length !== 1 || path.resolve(sources[0]) !== CANONICAL;
if (replacesCanonical) {
	if (fs.existsSync(path.join(ROOT, 'content', '~$lab-content.xlsx'))) {
		fail(['content/lab-content.xlsx is open in Excel. Close it and run this again.']);
	}
	if (fs.existsSync(CANONICAL)) fs.copyFileSync(CANONICAL, PREVIOUS);
	if (csvs.length) await writeWorkbook(model, CANONICAL);
	else fs.copyFileSync(sources[0], CANONICAL);
	log(`✓ Updated content/lab-content.xlsx (previous version saved as content/${path.basename(PREVIOUS)}).`);
}

log(`✓ Website content updated from ${sources.map((s) => path.basename(s)).join(' + ')}. ${summary(data)}`);

/* ------------------------------------------------------------------ helpers */

function summary(d) {
	const n = (k, label) => `${d[k].length} ${label}`;
	return [n('members', 'members'), n('alumni', 'alumni'), n('news', 'news items'), n('publications', 'publications'), n('patents', 'patents'), n('funders', 'funders')].join(', ') + '.';
}

function log(msg) {
	if (!quiet) console.log(msg);
}

function report(list, level) {
	if (!list.length) return;
	if (IN_CI) for (const m of list) console.log(`::${level} title=Lab content::${m}`);
	else {
		console.log(`\n${list.length} ${level}${list.length > 1 ? 's' : ''} (the site still builds, but you may want to fix ${list.length > 1 ? 'these' : 'this'}):`);
		for (const m of list) console.log(`  • ${m}`);
		console.log('');
	}
}

function fail(list) {
	if (IN_CI) for (const m of list) console.log(`::error title=Lab content::${m}`);
	console.error(`\n✗ The website content was NOT updated. Please fix ${list.length > 1 ? `these ${list.length} problems` : 'this problem'} and try again:\n`);
	for (const m of list) console.error(`  • ${m}`);
	console.error('');
	process.exit(1);
}
