import type { Publication } from '../lib/data';
import { slugify } from '../lib/data';

// "Beagrie, R. A., Thieme, C. J., et al., Pombo, A." -> ["Beagrie, R. A.", "Thieme, C. J.", "others", "Pombo, A."]
function splitAuthors(list: string) {
	const parts = list.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
	const out: string[] = [];
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		if (/^et al\.?$/i.test(p)) out.push('others');
		else if (/^([A-ZÀ-Ý][a-z]?\.?[\s-]*)+$/.test(parts[i + 1] ?? '')) out.push(`${p}, ${parts[++i]}`);
		else out.push(p);
	}
	return out;
}

export function toBibtex(p: Publication) {
	const authors = splitAuthors(p.authors);
	const first = slugify(authors[0]?.split(',')[0] ?? 'anon').replace(/-/g, '');
	const word = slugify(p.title).split('-').find((w) => w.length > 3) ?? 'paper';
	const [, volume, number, pages] = p.details.match(/^\s*([^(,\s]+)?\s*(?:\(([^)]+)\))?\s*,?\s*(.+)?$/) ?? [];
	const fields: [string, string | number | undefined][] = [
		['title', `{${p.title}}`],
		['author', authors.join(' and ')],
		['journal', p.journal],
		['year', p.year],
		['volume', volume],
		['number', number],
		['pages', pages?.replace(/[–—]/g, '--')],
		['doi', p.doi.replace(/^https:\/\/doi\.org\//, '') || undefined],
		['url', p.link || p.pdf || undefined],
	];
	const body = fields
		.filter(([, v]) => v !== undefined && v !== '')
		.map(([k, v]) => `  ${k} = {${v}}`)
		.join(',\n');
	return `@article{${first}${p.year}${word},\n${body}\n}`;
}
