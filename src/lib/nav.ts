import { lab } from './data';

export interface NavItem {
	label: string;
	href: string;
	children?: NavItem[];
}

const more: NavItem[] = [
	...(lab.patents.length ? [{ label: 'Patents', href: '/patents' }] : []),
	{ label: 'Support', href: '/support' },
];

export const NAV: NavItem[] = [
	{ label: 'Home', href: '/' },
	{
		label: 'Research',
		href: '/research',
		children: [
			{ label: 'Overview', href: '/research' },
			...lab.research.map((r) => ({ label: r.title, href: `/research/${r.slug}` })),
		],
	},
	{
		label: 'Team',
		href: '/team',
		children: [
			{ label: 'Principal Investigator', href: '/team/pi' },
			{ label: 'Members', href: '/team' },
			...(lab.alumni.length ? [{ label: 'Alumni', href: '/team/alumni' }] : []),
		],
	},
	{ label: 'Publications', href: '/publications' },
	{ label: 'News', href: '/news' },
	{ label: 'Join', href: '/join' },
	more.length === 1 ? more[0] : { label: 'More', href: more[0].href, children: more },
];
