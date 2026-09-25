#!/usr/bin/env node
// Rewrites the content workbook with the current column layout, notes and
// dropdowns, keeping all of its data (including hidden rows). Use it after
// adding a column in scripts/content-schema.mjs, or to get CSV copies.
//
//   npm run content:template                    refresh content/lab-content.xlsx
//   npm run content:template -- out.xlsx        write a refreshed copy somewhere else
//   npm run content:template -- --csv folder    write one .csv per tab into folder
//   npm run content:template -- --blank out.xlsx  an empty workbook with just the headers

import fs from 'node:fs';
import path from 'node:path';
import { buildModel, readSources, ROOT, writeCsvFolder, writeWorkbook } from './content-io.mjs';
import { KEY_VALUE_SHEETS, TABLE_SHEETS } from './content-schema.mjs';

const CANONICAL = path.join(ROOT, 'content', 'lab-content.xlsx');
const args = process.argv.slice(2);
const csvIdx = args.indexOf('--csv');
const csvDir = csvIdx >= 0 ? args[csvIdx + 1] : null;
const blank = args.includes('--blank');
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && i !== csvIdx + 1) ?? CANONICAL);

let model;
if (blank) {
	model = {};
	for (const s of KEY_VALUE_SHEETS) model[s.key] = Object.fromEntries(s.fields.map((f) => [f.key, f.list ? [] : '']));
	for (const s of TABLE_SHEETS) model[s.key] = [];
} else {
	const warnings = [];
	const built = buildModel(await readSources([CANONICAL], warnings));
	if (built.errors.length) {
		console.error('✗ content/lab-content.xlsx has problems; fix them first (npm run content:check):');
		for (const e of built.errors) console.error(`  • ${e}`);
		process.exit(1);
	}
	model = built.model;
}

if (csvDir) {
	writeCsvFolder(model, path.resolve(csvDir));
	console.log(`✓ Wrote one CSV per tab to ${csvDir}`);
} else {
	if (fs.existsSync(path.join(path.dirname(out), `~$${path.basename(out)}`))) {
		console.error(`✗ ${path.basename(out)} is open in Excel. Close it and run this again.`);
		process.exit(1);
	}
	await writeWorkbook(model, out);
	console.log(`✓ Wrote ${path.relative(ROOT, out)}`);
}
