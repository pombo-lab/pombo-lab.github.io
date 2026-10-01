// Typed access to src/data/lab.json, which `npm run content` generates from
// content/lab-content.xlsx. Edit the spreadsheet, not the JSON.
import raw from '../data/lab.json';
import { url } from '../utils/paths';

export interface Settings {
	labName: string;
	tagline: string;
	description: string;
	heroTitle: string;
	heroText: string;
	about: string;
	email: string;
	highlightAuthors: string[];
	labDescription: string;
	researchIntro: string;
	teamIntro: string;
	alumniIntro: string;
	newsIntro: string;
	publicationsIntro: string;
	patentsIntro: string;
}

export interface Site {
	code: string;
	short: string;
	name: string;
	department: string;
	address: string;
	color: string;
	current: boolean;
}

export interface PI {
	name: string;
	title: string;
	photo: string;
	email: string;
	emails: string[];
	bio: string[];
	details: { section: string; items: { text: string; link: string }[] }[];
}

export interface Member {
	name: string;
	site: string;
	position: string;
	department: string;
	focus: string;
	email: string;
	photo: string;
	website: string;
}

export interface Alumnus {
	name: string;
	years: string;
	site: string;
	position: string;
	now: string;
	thesis: string;
}

export interface NewsItem {
	date: string;
	category: string;
	title: string;
	text: string;
	link: string;
}

export interface Publication {
	year: number;
	title: string;
	authors: string;
	journal: string;
	details: string;
	doi: string;
	pdf: string;
	code: string;
	data: string;
	link: string;
	featured: boolean;
}

export interface Patent {
	year: number;
	title: string;
	inventors: string;
	number: string;
	status: string;
	office: string;
	link: string;
}

export interface LabData {
	settings: Settings;
	sites: Site[];
	pi: PI;
	members: Member[];
	alumni: Alumnus[];
	news: NewsItem[];
	publications: Publication[];
	patents: Patent[];
}

export const lab = raw as unknown as LabData;
export const settings = lab.settings;
export const currentSites = lab.sites.filter((s) => s.current);

const sitesByCode = new Map(lab.sites.map((s) => [s.code, s]));
export const siteFor = (code: string) => sitesByCode.get(code);

/** Resolves an image or link from the spreadsheet: site paths get the base path, web addresses stay as they are. */
export const asset = (p: string) => (!p ? '' : /^[a-z]+:/i.test(p) ? p : url(p));

export const isExternal = (href: string) => /^https?:/i.test(href);

export const formatDate = (iso: string, month: 'short' | 'long' = 'short') =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });

export const lastYear = (years: string) => {
	const m = String(years || '').match(/\d{4}/g);
	return m ? Number(m[m.length - 1]) : 0;
};

export const slugify = (s: string) =>
	String(s)
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

/** Anchor id for a news item on the News page. */
export const newsId = (n: NewsItem) => `${n.date}-${slugify(n.title).split('-').slice(0, 6).join('-')}`;

/** Turns a Link cell into an href: emails become mailto:, site paths get the base path. */
export const href = (link: string) =>
	!link ? '' : /^[^\s@/:]+@[^\s@]+\.[^\s@]+$/.test(link) ? `mailto:${link}` : asset(link);
