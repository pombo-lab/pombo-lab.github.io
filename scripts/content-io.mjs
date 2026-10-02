// Reading, checking and writing the lab content spreadsheet.
//
//   readSources(paths)      -> raw rows from .xlsx workbooks and/or .csv files
//   buildModel(raw)         -> { model, errors, warnings }   (model keeps hidden rows)
//   toSiteData(model)       -> the JSON the Astro site reads (hidden rows removed)
//   writeWorkbook(model, f) -> a formatted .xlsx with notes and dropdowns
//   writeCsvFolder(model,d) -> one .csv per tab

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { ALL_SHEETS, IMAGE_FOLDERS, KEY_VALUE_SHEETS, TABLE_SHEETS } from './content-schema.mjs';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

export function sheetForName(name) {
	const n = norm(name);
	return ALL_SHEETS.find((s) => norm(s.name) === n || norm(s.key) === n);
}

// A CSV exported from Google Sheets is named "<workbook> - <Tab>.csv", from
// Excel just "<Tab>.csv". Pick the longest tab name contained in the file name
// so "PI Details.csv" wins over "PI".
export function sheetForFileName(file) {
	const n = norm(path.basename(file, path.extname(file)));
	const hits = ALL_SHEETS.filter((s) => n.endsWith(norm(s.name)) || n.endsWith(norm(s.key)));
	hits.sort((a, b) => norm(b.name).length - norm(a.name).length);
	return hits[0];
}

/* ------------------------------------------------------------------ reading */

function decodeText(buf, file, warnings) {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
	} catch {
		warnings.push(
			`${path.basename(file)} is not saved as UTF-8, so accented letters (é, ü, ó…) may look wrong. ` +
				'In Excel choose File › Save As › "CSV UTF-8".',
		);
		return new TextDecoder('windows-1252').decode(buf);
	}
}

export function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;
	const delim = detectDelimiter(text);
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
			else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"' && field === '') quoted = true;
		else if (c === delim) { row.push(field); field = ''; }
		else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field); rows.push(row); row = []; field = '';
		} else field += c;
	}
	if (field !== '' || row.length) { row.push(field); rows.push(row); }
	return rows;
}

// Excel in many European locales saves "CSV" with semicolons.
function detectDelimiter(text) {
	const firstLine = text.slice(0, text.search(/\r?\n|$/));
	const count = (ch) => firstLine.split(ch).length - 1;
	if (count('\t') > count(',') && count('\t') > count(';')) return '\t';
	return count(';') > count(',') ? ';' : ',';
}

function cellText(value, preferLink) {
	if (value == null) return '';
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (typeof value === 'object') {
		if (value.richText) return value.richText.map((r) => r.text).join('');
		if ('hyperlink' in value) {
			const text = cellText(value.text, false);
			const link = String(value.hyperlink || '').replace(/^mailto:/i, '');
			return preferLink || !text ? link : text;
		}
		if ('result' in value) return cellText(value.result, preferLink);
		if ('error' in value) return '';
		if ('text' in value) return cellText(value.text, preferLink);
		return '';
	}
	if (typeof value === 'boolean') return value ? 'yes' : 'no';
	return String(value);
}

async function readXlsx(file) {
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.readFile(file);
	const out = [];
	wb.eachSheet((ws) => {
		const schema = sheetForName(ws.name);
		if (!schema) return; // README and any extra tabs are ignored
		const rows = [];
		ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			const cells = [];
			row.eachCell({ includeEmpty: true }, (cell, col) => {
				cells[col - 1] = cell.value;
			});
			rows.push({ rowNumber, cells });
		});
		out.push({ schema, rows, source: `${path.basename(file)} › ${ws.name}` });
	});
	return out;
}

function readCsv(file, warnings) {
	const schema = sheetForFileName(file);
	if (!schema) {
		throw new Error(
			`Can't tell which tab "${path.basename(file)}" belongs to. Name the file after the tab, ` +
				`e.g. ${TABLE_SHEETS.map((s) => `"${s.name}.csv"`).slice(0, 4).join(', ')}.`,
		);
	}
	const text = decodeText(fs.readFileSync(file), file, warnings);
	const rows = parseCsv(text).map((cells, i) => ({ rowNumber: i + 1, cells }));
	return [{ schema, rows, source: path.basename(file) }];
}

// Returns Map(schema.key -> { schema, rows, source }). Later files replace
// earlier ones tab by tab, so "base.xlsx members.csv" swaps in just Members.
export async function readSources(files, warnings = []) {
	const sheets = new Map();
	for (const file of files) {
		const ext = path.extname(file).toLowerCase();
		let found;
		if (ext === '.xlsx' || ext === '.xlsm') found = await readXlsx(file);
		else if (ext === '.csv' || ext === '.tsv' || ext === '.txt') found = readCsv(file, warnings);
		else if (ext === '.xls' || ext === '.numbers' || ext === '.ods')
			throw new Error(`${path.basename(file)}: please save it as an Excel Workbook (.xlsx) or CSV first.`);
		else throw new Error(`${path.basename(file)}: unsupported file type. Use .xlsx or .csv.`);
		for (const s of found) sheets.set(s.schema.key, s);
	}
	return sheets;
}

/* ----------------------------------------------------------------- checking */

const TRUE = new Set(['yes', 'y', 'true', '1', 'x', '✓', '✔', 'ja', 'show']);
const FALSE = new Set(['no', 'n', 'false', '0', 'hide', 'hidden', 'nein']);
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

function parseDate(v) {
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	if (typeof v === 'number') {
		// Excel serial date (days since 1899-12-30)
		return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
	}
	const s = String(v).trim();
	let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
	if (m) return iso(+m[1], +m[2], +m[3]);
	m = s.match(/^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/);
	if (m) {
		const [a, b, y] = [+m[1], +m[3], +m[4]];
		if (m[2] === '.' || a > 12) return iso(y, b, a); // 02.06.2026 or 25/06/2026: day first
		if (b > 12) return iso(y, a, b); // 06/25/2026: month first
		return null; // 06/02/2026 could be either, so ask for YYYY-MM-DD
	}
	m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/); // 2 June 2026
	if (m && MONTHS.includes(m[2].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
	m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/); // June 2, 2026
	if (m && MONTHS.includes(m[1].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
	return null;
}

function iso(y, mo, d) {
	const date = new Date(Date.UTC(y, mo - 1, d));
	if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
	return date.toISOString().slice(0, 10);
}

export function slugify(s) {
	return String(s)
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function cleanText(s) {
	return String(s).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/ /g, ' ').trim();
}

const lines = (s) => cleanText(s).split('\n').map((l) => l.replace(/^\s*(?:[-•*·▪]\s+)/, '').trim()).filter(Boolean);

// Checks one value against its column/field definition.
// Returns { value } or { error }.
function convert(def, raw, imageFolder) {
	const preferLink = def.type === 'url';
	const text = cleanText(cellText(raw, preferLink));
	if (text === '') {
		if (def.required) return { error: `"${def.label}" is required but empty.` };
		if (def.type === 'bool') return { value: def.default ?? false };
		if (def.list) return { value: [] };
		return { value: '' };
	}
	switch (def.type) {
		case 'int': {
			const n = typeof raw === 'number' ? raw : Number(text);
			if (!Number.isInteger(n)) return { error: `"${def.label}" should be a whole number (found "${text}").` };
			return { value: n };
		}
		case 'bool': {
			const t = text.toLowerCase();
			if (TRUE.has(t)) return { value: true };
			if (FALSE.has(t)) return { value: false };
			return { error: `"${def.label}" should be yes or no (found "${text}").` };
		}
		case 'date': {
			const d = parseDate(raw instanceof Date || typeof raw === 'number' ? raw : text);
			if (!d && /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(text))
				return { error: `"${def.label}" "${text}" could be read as day/month or month/day. Please write it as year-month-day, e.g. 2026-06-02.` };
			if (!d) return { error: `"${def.label}" should be a date like 2026-06-02 (found "${text}").` };
			return { value: d };
		}
		case 'choice': {
			const hit = def.choices.find((c) => c.toLowerCase() === text.toLowerCase());
			if (!hit) return { error: `"${def.label}" should be one of ${def.choices.join(', ')} (found "${text}").` };
			return { value: hit };
		}
		case 'url': {
			if (!def.list) return convertUrl(def, text, imageFolder);
			const out = [];
			for (const line of lines(text)) {
				const r = convertUrl(def, line, imageFolder);
				if (r.error) return r;
				out.push(r.value);
			}
			return { value: out };
		}
		default:
			return { value: def.list ? lines(text) : text };
	}
}

function convertUrl(def, text, imageFolder) {
	const t = text.trim();
	if (def.key === 'doi') {
		const doi = t.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '');
		if (/^10\.\d{4,9}\/\S+$/.test(doi)) return { value: `https://doi.org/${doi}` };
		if (/^https?:\/\//i.test(t)) return { value: t };
		return { error: `"DOI" doesn't look like a DOI (found "${t}"). It should start with 10.` };
	}
	if (/^(https?:|mailto:)/i.test(t)) return { value: t };
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { value: t, email: true };
	if (t.startsWith('/') || t.startsWith('#')) return { value: t };
	if (imageFolder && /^[^\s/]+\.(jpe?g|png|webp|gif|svg|avif)$/i.test(t)) {
		const rel = `/${imageFolder}/${t}`;
		const file = path.join(PUBLIC_DIR, imageFolder, t);
		if (!fs.existsSync(file)) return { value: rel, warning: `image "${t}" was not found in public/${imageFolder}/.` };
		const mb = fs.statSync(file).size / 1e6;
		if (mb > 2) return { value: rel, warning: `image "${t}" is ${mb.toFixed(1)} MB, which will load slowly. Resize it to about 2000 pixels wide before uploading.` };
		return { value: rel };
	}
	if (/^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(t)) return { value: `https://${t}` };
	return { error: `"${def.label}" doesn't look like a web address or file name (found "${t}").` };
}

const isPlaceholder = (s) => typeof s === 'string' && /\[(add|todo|tbd)\b[^\]]*\]/i.test(s);

function headerIndex(cells, defs) {
	const map = new Map();
	const unknown = [];
	cells.forEach((c, i) => {
		const h = norm(cellText(c, false));
		if (!h) return;
		const def = defs.find((d) => norm(d.label) === h || norm(d.key) === h);
		if (def) map.set(def.key, i);
		else unknown.push(cellText(c, false).trim());
	});
	return { map, unknown };
}

function readKeyValue(sheet, schema, errors, warnings) {
	const out = {};
	for (const f of schema.fields) out[f.key] = f.list ? [] : '';
	if (!sheet) {
		errors.push(`The "${schema.name}" tab is missing.`);
		return out;
	}
	const seen = new Set();
	for (const { rowNumber, cells } of sheet.rows) {
		const label = cleanText(cellText(cells[0], false));
		if (!label) continue;
		if (rowNumber === sheet.rows[0].rowNumber && ['setting', 'field', 'name', 'key'].includes(norm(label))) continue; // header
		const f = schema.fields.find((d) => norm(d.label) === norm(label) || norm(d.key) === norm(label));
		if (!f) {
			warnings.push(`${sheet.source}, row ${rowNumber}: unknown setting "${label}" was ignored.`);
			continue;
		}
		const folder = IMAGE_FOLDERS[`${schema.key}.${f.key}`];
		const res = convert({ ...f, required: false }, cells[1], folder);
		if (res.error) { errors.push(`${sheet.source}, row ${rowNumber}: ${res.error}`); continue; }
		if (res.warning) warnings.push(`${sheet.source}, row ${rowNumber}: ${res.warning}`);
		if (f.list) out[f.key].push(...res.value);
		else {
			if (seen.has(f.key) && res.value) warnings.push(`${sheet.source}, row ${rowNumber}: "${f.label}" appears more than once; the last one is used.`);
			if (res.value !== '' || !seen.has(f.key)) out[f.key] = res.value;
		}
		seen.add(f.key);
	}
	for (const f of schema.fields) {
		const v = out[f.key];
		if (f.required && (v === '' || (Array.isArray(v) && !v.length))) errors.push(`${sheet.source}: "${f.label}" is required but empty.`);
	}
	return out;
}

function readTable(sheet, schema, errors, warnings) {
	if (!sheet || !sheet.rows.length) {
		if (!sheet) warnings.push(`The "${schema.name}" tab is missing, so it is treated as empty.`);
		return [];
	}
	const [head, ...body] = sheet.rows;
	const { map, unknown } = headerIndex(head.cells, schema.columns);
	if (unknown.length) warnings.push(`${sheet.source}: column${unknown.length > 1 ? 's' : ''} ${unknown.map((u) => `"${u}"`).join(', ')} ${unknown.length > 1 ? 'are' : 'is'} not used by the website.`);
	const missing = schema.columns.filter((c) => c.required && !map.has(c.key));
	if (missing.length) {
		errors.push(`${sheet.source}: missing column${missing.length > 1 ? 's' : ''} ${missing.map((c) => `"${c.label}"`).join(', ')} in the first row.`);
		return [];
	}
	const out = [];
	for (const { rowNumber, cells } of body) {
		if (!cells.some((c) => cleanText(cellText(c, false)) !== '')) continue;
		const rec = { _row: rowNumber };
		let ok = true;
		for (const col of schema.columns) {
			const i = map.get(col.key);
			const folder = IMAGE_FOLDERS[`${schema.key}.${col.key}`];
			const res = convert(col, i == null ? undefined : cells[i], folder);
			if (res.error) { errors.push(`${sheet.source}, row ${rowNumber}: ${res.error}`); ok = false; continue; }
			if (res.warning) warnings.push(`${sheet.source}, row ${rowNumber}: ${res.warning}`);
			rec[col.key] = res.value;
		}
		if (ok) out.push(rec);
	}
	return out;
}

export function buildModel(sheets) {
	const errors = [];
	const warnings = [];
	const model = {};
	for (const s of KEY_VALUE_SHEETS) model[s.key] = readKeyValue(sheets.get(s.key), s, errors, warnings);
	for (const s of TABLE_SHEETS) model[s.key] = readTable(sheets.get(s.key), s, errors, warnings);

	const where = (key, rec) => `${sheets.get(key)?.source ?? key}, row ${rec._row}`;

	// Site codes must be unique and every Site cell must use one of them.
	const codes = new Map();
	for (const s of model.sites) {
		const k = s.code.toUpperCase();
		if (codes.has(k)) errors.push(`${where('sites', s)}: site code "${s.code}" is used twice.`);
		codes.set(k, s.code);
	}
	for (const key of ['members', 'alumni']) {
		for (const rec of model[key]) {
			if (!rec.site) continue;
			const parts = rec.site.split('/').map((p) => p.trim()).filter(Boolean);
			const bad = parts.filter((p) => !codes.has(p.toUpperCase()));
			if (bad.length) errors.push(`${where(key, rec)}: site "${bad.join('/')}" is not in the Sites tab (use ${[...codes.values()].join(', ')}).`);
			rec.site = parts.map((p) => codes.get(p.toUpperCase()) ?? p).join('/');
		}
	}
	for (const m of model.members) {
		const site = model.sites.find((s) => s.code === m.site);
		if (site && !site.current) warnings.push(`${where('members', m)}: ${m.name} is at "${m.site}", which is not marked as a current site, so they won't be listed.`);
	}

	// Likely duplicates and leftover placeholders.
	const titles = new Map();
	for (const p of model.publications.filter((p) => p.show)) {
		const k = norm(p.title);
		if (titles.has(k)) warnings.push(`${where('publications', p)}: same title as row ${titles.get(k)._row} — possible duplicate.`);
		else titles.set(k, p);
	}
	for (const s of TABLE_SHEETS) {
		for (const rec of model[s.key]) {
			if (rec.show === false) continue;
			const col = s.columns.find((c) => isPlaceholder(rec[c.key]));
			if (col) warnings.push(`${where(s.key, rec)}: "${col.label}" still contains placeholder text "${rec[col.key]}".`);
		}
	}
	return { model, errors, warnings };
}

/* ------------------------------------------------------- JSON for the site */

const strip = ({ _row, show, ...rest }) => rest;
const visible = (rows) => rows.filter((r) => r.show !== false).map(strip);

export function toSiteData(model) {
	const details = [];
	for (const d of visible(model.piDetails)) {
		let group = details.find((g) => g.section === d.section);
		if (!group) details.push((group = { section: d.section, items: [] }));
		group.items.push({ text: d.item, link: d.link });
	}

	return {
		settings: model.settings,
		sites: model.sites.map(strip),
		pi: {
			...model.pi,
			email: model.pi.email[0] || model.settings.email,
			emails: model.pi.email.length ? model.pi.email : [model.settings.email],
			details,
		},
		members: visible(model.members),
		alumni: visible(model.alumni),
		news: visible(model.news).sort((a, b) => b.date.localeCompare(a.date)),
		publications: visible(model.publications).sort((a, b) => b.year - a.year),
		patents: visible(model.patents).sort((a, b) => b.year - a.year),
		gallery: visible(model.gallery),
	};
}

/* ------------------------------------------------------------------ writing */

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
const KEY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FA' } };
const HELP_FONT = { italic: true, color: { argb: 'FF666666' } };
const VALIDATION_ROWS = 1000;

function colLetter(n) {
	let s = '';
	for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
	return s;
}

function exportValue(def, v) {
	if (v == null || v === '') return null;
	if (def.type === 'bool') return v ? 'yes' : 'no';
	if (def.type === 'date') {
		const [y, m, d] = v.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d));
	}
	if (Array.isArray(v)) return v.length ? v.join('\n') : null;
	if (typeof v === 'string') {
		// Show image files by their short name, the way people type them.
		for (const folder of Object.values(IMAGE_FOLDERS)) {
			if (v.startsWith(`/${folder}/`)) return v.slice(folder.length + 2);
		}
		if (def.key === 'doi') return v.replace(/^https:\/\/doi\.org\//, '');
	}
	return v;
}

function addReadme(wb) {
	const ws = wb.addWorksheet('README', { properties: { tabColor: { argb: 'FF003366' } } });
	ws.getColumn(1).width = 26;
	ws.getColumn(2).width = 110;
	const put = (a, b, style) => {
		const row = ws.addRow([a, b]);
		row.alignment = { wrapText: true, vertical: 'top' };
		if (style) row.font = style;
		return row;
	};
	put('Lab website content', null, { bold: true, size: 16 });
	put(null, 'Everything on the lab website comes from this workbook. Edit a tab, save, and the website is rebuilt from it.');
	put();
	put('How to publish changes', null, { bold: true, size: 13 });
	put('1.', 'Download this file from GitHub (content/lab-content.xlsx) or open your latest copy.');
	put('2.', 'Edit the tabs below. Keep the first row of each tab (the column names) as it is.');
	put('3.', 'Save as an Excel Workbook (.xlsx). Google Sheets: File › Download › Microsoft Excel (.xlsx).');
	put('4.', 'On GitHub, open the "content" folder, choose Add file › Upload files, drop in the file (it must be named lab-content.xlsx), and commit.');
	put('5.', 'The website rebuilds itself in a few minutes. If something in the file is wrong, the check on GitHub turns red and lists the row to fix.');
	put();
	put('Tips', null, { bold: true, size: 13 });
	put('Hide a row', 'Set the "Show" column to "no". The row stays in the file but disappears from the website.');
	put('New line in a cell', 'Excel on Windows: Alt+Enter. Excel on Mac: Control+Option+Return. Google Sheets: Ctrl+Enter (Cmd+Enter on Mac). Each line becomes its own paragraph or bullet point.');
	put('Links in text', 'Write [link text](https://example.org). Email addresses and pages on this site (e.g. [our papers](/publications)) work too.');
	put('Bold text', 'Wrap words in double stars: **like this**.');
	put('Photos', 'Upload the photo on GitHub, then type just its file name, e.g. "jane-doe.jpg". People photos go in public/images/people, Gallery photos in public/images/gallery. Resize large phone photos to about 2000 pixels wide first.');
	put('Column help', 'Hover over a column name (the small red triangle) to see what it is for.');
	put();
	put('Tabs', null, { bold: true, size: 13 });
	for (const s of ALL_SHEETS) put(s.name, s.description);
}

function addKeyValueSheet(wb, schema, data) {
	const ws = wb.addWorksheet(schema.name, { views: [{ state: 'frozen', ySplit: 1 }] });
	ws.columns = [
		{ header: 'Setting', width: 28 },
		{ header: 'Value', width: 90 },
		{ header: 'Help', width: 60 },
	];
	styleHeader(ws.getRow(1), 3);
	for (const f of schema.fields) {
		const v = data[f.key];
		const values = f.repeatable ? (v?.length ? v : ['']) : [exportValue(f, v)];
		for (const value of values) {
			const row = ws.addRow([f.label, value === '' ? null : value, f.help || null]);
			row.alignment = { wrapText: true, vertical: 'top' };
			row.getCell(1).font = { bold: true };
			row.getCell(1).fill = KEY_FILL;
			row.getCell(3).font = HELP_FONT;
		}
	}
}

function styleHeader(row, n) {
	row.height = 22;
	for (let i = 1; i <= n; i++) {
		const c = row.getCell(i);
		c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		c.fill = HEADER_FILL;
		c.alignment = { vertical: 'middle' };
	}
}

function addTableSheet(wb, schema, rows, siteCount) {
	const ws = wb.addWorksheet(schema.name, { views: [{ state: 'frozen', ySplit: 1 }] });
	ws.columns = schema.columns.map((c) => ({ header: c.label, key: c.key, width: c.width || 20 }));
	styleHeader(ws.getRow(1), schema.columns.length);
	schema.columns.forEach((c, i) => {
		const bits = [c.help, c.required ? 'Required.' : null].filter(Boolean);
		if (bits.length) ws.getRow(1).getCell(i + 1).note = bits.join(' ');
	});
	for (const rec of rows) {
		const row = ws.addRow(schema.columns.map((c) => exportValue(c, rec[c.key])));
		row.alignment = { wrapText: true, vertical: 'top' };
	}
	schema.columns.forEach((c, i) => {
		const L = colLetter(i + 1);
		const col = ws.getColumn(i + 1);
		if (c.type === 'date') col.numFmt = 'yyyy-mm-dd';
		let formulae;
		if (c.type === 'bool') formulae = ['"yes,no"'];
		if (c.type === 'choice') formulae = [`"${c.choices.join(',')}"`];
		if (c.type === 'site' && schema.key === 'members') formulae = [`Sites!$A$2:$A$${Math.max(siteCount + 1, 50)}`];
		if (formulae) {
			ws.dataValidations.add(`${L}2:${L}${VALIDATION_ROWS}`, {
				type: 'list',
				allowBlank: !c.required,
				formulae,
				showErrorMessage: true,
				errorStyle: 'warning',
				errorTitle: c.label,
				error: c.help || `Choose a value from the list.`,
			});
		}
	});
	ws.autoFilter = { from: 'A1', to: `${colLetter(schema.columns.length)}1` };
}

export async function writeWorkbook(model, file) {
	const wb = new ExcelJS.Workbook();
	wb.creator = 'Lab website';
	addReadme(wb);
	for (const s of KEY_VALUE_SHEETS) addKeyValueSheet(wb, s, model[s.key]);
	for (const s of TABLE_SHEETS) addTableSheet(wb, s, model[s.key], model.sites.length);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	await wb.xlsx.writeFile(file);
}

const csvCell = (v) => {
	if (v == null) return '';
	const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function writeCsvFolder(model, dir) {
	fs.mkdirSync(dir, { recursive: true });
	const write = (name, rows) =>
		fs.writeFileSync(path.join(dir, `${name}.csv`), '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
	for (const s of KEY_VALUE_SHEETS) {
		const rows = [['Setting', 'Value']];
		for (const f of s.fields) {
			const v = model[s.key][f.key];
			for (const value of f.repeatable ? (v?.length ? v : ['']) : [exportValue(f, v)]) rows.push([f.label, value]);
		}
		write(s.name, rows);
	}
	for (const s of TABLE_SHEETS) {
		write(s.name, [s.columns.map((c) => c.label), ...model[s.key].map((r) => s.columns.map((c) => exportValue(c, r[c.key])))]);
	}
}
