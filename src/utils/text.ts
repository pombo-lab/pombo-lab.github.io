// Turns spreadsheet text into safe HTML. Editors can write:
//   [link text](https://example.org)   [our papers](/publications)   [email us](someone@lab.org)
//   **bold words**
// and bare email addresses / web addresses become links automatically.
import { url } from './paths';

const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function anchor(href: string, labelHtml: string) {
	let target = href.trim();
	if (EMAIL.test(target)) target = `mailto:${target}`;
	else if (target.startsWith('/')) target = url(target);
	else if (!/^(https?:|mailto:|#)/i.test(target)) return labelHtml; // refuse javascript: and friends
	const ext = /^https?:/i.test(target) ? ' target="_blank" rel="noopener noreferrer"' : '';
	return `<a href="${esc(target)}"${ext}>${labelHtml}</a>`;
}

function plain(s: string, autolink: boolean) {
	let html = esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	if (!autolink) return html;
	return html
		.replace(/(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (_, pre, e) => pre + anchor(e, e))
		.replace(/(^|[\s(])(https?:\/\/[^\s<]+?)(?=[.,;:!?)]*(?:\s|$))/g, (_, pre, u) => pre + anchor(u.replace(/&amp;/g, '&'), u));
}

/** One line of text with links and bold. */
export function inline(src: string | undefined | null): string {
	const text = String(src ?? '');
	const out: string[] = [];
	const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
	let last = 0;
	for (let m; (m = re.exec(text)); last = re.lastIndex) {
		out.push(plain(text.slice(last, m.index), true), anchor(m[2], plain(m[1], false)));
	}
	out.push(plain(text.slice(last), true));
	return out.join('');
}

/** Splits a cell into paragraphs (one per line). */
export const paragraphs = (src: string | undefined | null) =>
	String(src ?? '')
		.split(/\n+/)
		.map((l) => l.trim())
		.filter(Boolean);
