import { lab } from './data';

export interface NavItem {
	label: string;
	href: string;
	children?: NavItem[];
}

export const NAV: NavItem[] = [
	{ label: 'Home', href: '/' },
	{ label: 'Research', href: '/research' },
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
	...(lab.patents.length ? [{ label: 'Patents', href: '/patents' }] : []),
];
