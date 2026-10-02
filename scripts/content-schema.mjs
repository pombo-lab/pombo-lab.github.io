// Describes every tab of content/lab-content.xlsx: which columns exist, what
// they mean, and how each value is checked. Both the importer and the template
// exporter read this file, so adding a column here adds it everywhere.
//
// Column types:
//   text       single line of text
//   multiline  text that may contain line breaks (each line = one paragraph / bullet)
//   int        whole number
//   bool       yes / no (also accepts y, true, 1, x)
//   date       a date; written to the site as YYYY-MM-DD
//   url        a web address, email, or a file name in public/images
//   choice     one of a fixed list (see `choices`)
//   site       a site code from the Sites tab (several may be joined with "/")

const SHOW = {
	key: 'show',
	label: 'Show',
	type: 'bool',
	default: true,
	width: 9,
	help: 'Set to "no" to hide this row on the website without deleting it.',
};

export const KEY_VALUE_SHEETS = [
	{
		name: 'Settings',
		key: 'settings',
		required: true,
		description: 'Lab-wide text: the name, homepage headline, contact email, and the short introductions at the top of each page.',
		fields: [
			{ key: 'labName', label: 'Lab name', required: true, help: 'Shown in the header, footer and browser tab.' },
			{ key: 'tagline', label: 'Tagline', help: 'Small line under the lab name in the header, e.g. "Baltimore · Berlin".' },
			{ key: 'description', label: 'Site description', help: 'One or two sentences used by search engines and link previews.' },
			{ key: 'heroTitle', label: 'Homepage headline', required: true, help: 'The large sentence at the top of the homepage.' },
			{ key: 'heroSubtitle', label: 'Homepage subheading', help: 'Smaller line directly under the homepage headline. Leave blank for none.' },
			{ key: 'heroText', label: 'Homepage introduction', type: 'multiline', help: 'Paragraph under the homepage headline.' },
			{ key: 'about', label: 'Footer blurb', type: 'multiline', help: 'Short description in the footer of every page.' },
			{ key: 'email', label: 'Contact email', required: true, type: 'url', help: 'Main lab contact address.' },
			{ key: 'labDescription', label: 'Lab description', type: 'multiline', help: 'The "About the lab" text on the homepage. One paragraph per line.' },
			{ key: 'researchIntro', label: 'Research description', type: 'multiline', help: 'The Research page text. The first paragraph is also shown on the homepage.' },
			{ key: 'teamIntro', label: 'Team introduction', type: 'multiline', help: 'Text at the top of the Team page.' },
			{ key: 'alumniIntro', label: 'Alumni introduction', type: 'multiline', help: 'Text at the top of the Alumni page.' },
			{ key: 'newsIntro', label: 'News introduction', type: 'multiline', help: 'Text at the top of the News page.' },
			{ key: 'publicationsIntro', label: 'Publications introduction', type: 'multiline', help: 'Text at the top of the Publications page.' },
			{ key: 'patentsIntro', label: 'Patents introduction', type: 'multiline', help: 'Text at the top of the Patents page.' },
		],
	},
	{
		name: 'PI',
		key: 'pi',
		required: true,
		description: 'The principal investigator. Add more "Bio paragraph" rows for more paragraphs.',
		fields: [
			{ key: 'name', label: 'Name', required: true },
			{ key: 'title', label: 'Title', help: 'e.g. "Bloomberg Distinguished Professor of Genome Biology".' },
			{ key: 'photo', label: 'Photo', type: 'url', help: 'File name of a photo in public/images/people (e.g. "ana1.jpeg"), or a full web address.' },
			{ key: 'email', label: 'Email', type: 'url', list: true, repeatable: true, help: 'One address per row; add another "Email" row for each extra address. The first is the main one. Leave blank to use the lab contact email.' },
			{ key: 'bio', label: 'Bio paragraph', type: 'multiline', list: true, repeatable: true, help: 'One paragraph per row. Add as many "Bio paragraph" rows as you need.' },
		],
	},
];

export const TABLE_SHEETS = [
	{
		name: 'PI Details',
		key: 'piDetails',
		description: 'Facts listed beside the PI biography, grouped by section. Every row is one bullet; rows with the same Section are grouped together.',
		columns: [
			{ key: 'section', label: 'Section', required: true, width: 20, help: 'Group heading, e.g. "Appointments", "Education", "Honors", "Links".' },
			{ key: 'item', label: 'Item', required: true, width: 80, help: 'The text of the bullet.' },
			{ key: 'link', label: 'Link', type: 'url', width: 40, help: 'Optional web address. If filled in, the item becomes a link.' },
			SHOW,
		],
	},
	{
		name: 'Sites',
		key: 'sites',
		description: 'Lab locations. Current sites get their own section on the Team page and a column in the footer. Past sites are only used to label alumni.',
		columns: [
			{ key: 'code', label: 'Code', required: true, unique: true, width: 10, help: 'Short code used in the Site column of the Members and Alumni tabs, e.g. "JHU".' },
			{ key: 'short', label: 'Short name', width: 14, help: 'Label shown on badges. Defaults to the code.' },
			{ key: 'name', label: 'Full name', required: true, width: 40 },
			{ key: 'department', label: 'Department', type: 'multiline', width: 60 },
			{ key: 'address', label: 'Location', width: 26 },
			{ key: 'color', label: 'Colour', width: 11, help: 'Optional badge colour as a hex code, e.g. #2B5CB8.' },
			{ key: 'current', label: 'Current site', type: 'bool', default: true, width: 12, help: '"yes" for an active site, "no" for a past one.' },
		],
	},
	{
		name: 'Members',
		key: 'members',
		description: 'Current lab members (not the PI, not alumni). Rows appear in this order within each site.',
		columns: [
			{ key: 'name', label: 'Name', required: true, width: 28 },
			{ key: 'site', label: 'Site', type: 'site', required: true, width: 8, help: 'A code from the Sites tab.' },
			{ key: 'position', label: 'Position', required: true, width: 24, help: 'e.g. PhD Student, Postdoctoral Fellow, Senior Scientist.' },
			{ key: 'department', label: 'Department / Program', width: 50 },
			{ key: 'focus', label: 'Research focus', type: 'multiline', width: 50, help: 'One or two sentences on what this person works on. Leave blank to omit.' },
			{ key: 'email', label: 'Email', type: 'url', width: 30 },
			{ key: 'photo', label: 'Photo', type: 'url', width: 20, help: 'File name of a photo in public/images/people, or a full web address. Leave blank to show initials.' },
			{ key: 'website', label: 'Website', type: 'url', width: 26, help: 'Personal page, Google Scholar, ORCID, etc.' },
			SHOW,
		],
	},
	{
		name: 'Alumni',
		key: 'alumni',
		description: 'Former members. The website sorts them by most recent year automatically.',
		columns: [
			{ key: 'name', label: 'Name', required: true, width: 28 },
			{ key: 'years', label: 'Years', width: 12, help: 'e.g. "2019–2022" or "2021".' },
			{ key: 'site', label: 'Site', type: 'site', width: 9, help: 'A code from the Sites tab. Several sites can be joined with "/", e.g. "L/MDC".' },
			{ key: 'position', label: 'Position', width: 20, help: 'Position in the lab, e.g. PhD, Postdoc, MSc.' },
			{ key: 'now', label: 'Now', type: 'multiline', width: 70, help: 'Current position. Leave blank if unknown.' },
			{ key: 'thesis', label: 'Thesis', width: 40, help: 'Optional thesis title. The column only appears on the site if at least one alumnus has one.' },
			SHOW,
		],
	},
	{
		name: 'News',
		key: 'news',
		description: 'News items. The website sorts them newest first, so new rows can go anywhere.',
		columns: [
			{ key: 'date', label: 'Date', type: 'date', required: true, width: 13, help: 'Date of the news item, e.g. 2026-06-02.' },
			{ key: 'category', label: 'Category', width: 12, help: 'e.g. Lab, Paper, Award, Press.' },
			{ key: 'title', label: 'Title', required: true, width: 60 },
			{ key: 'text', label: 'Text', type: 'multiline', width: 80 },
			{ key: 'link', label: 'Link', type: 'url', width: 34, help: 'Optional "Read more" link. Can be a web address or a page on this site like /publications.' },
			SHOW,
		],
	},
	{
		name: 'Publications',
		key: 'publications',
		description: 'Publications. The website groups them by year, newest first. Only fill in the links you have; empty ones are not shown.',
		columns: [
			{ key: 'year', label: 'Year', type: 'int', required: true, width: 7 },
			{ key: 'title', label: 'Title', required: true, width: 70 },
			{ key: 'authors', label: 'Authors', type: 'multiline', width: 60, help: 'Author list as it should appear, e.g. "Beagrie, R. A., Pombo, A.".' },
			{ key: 'journal', label: 'Journal', width: 30 },
			{ key: 'details', label: 'Volume / pages', width: 22, help: 'e.g. "21(7), 735–775".' },
			{ key: 'doi', label: 'DOI', type: 'url', width: 30, help: 'e.g. 10.1038/s41586-021-04081-2 or the full https://doi.org/… address.' },
			{ key: 'pdf', label: 'PDF', type: 'url', width: 20 },
			{ key: 'code', label: 'Code', type: 'url', width: 20 },
			{ key: 'data', label: 'Data', type: 'url', width: 20 },
			{ key: 'link', label: 'Other link', type: 'url', width: 20 },
			{ key: 'featured', label: 'Featured', type: 'bool', default: false, width: 10, help: '"yes" to show it on the homepage and mark it as featured.' },
			SHOW,
		],
	},
	{
		name: 'Patents',
		key: 'patents',
		description: 'Patents and applications, grouped by year on the website. The Patents menu item only appears once at least one row is shown.',
		columns: [
			{ key: 'year', label: 'Year', type: 'int', required: true, width: 7 },
			{ key: 'title', label: 'Title', required: true, width: 60 },
			{ key: 'inventors', label: 'Inventors', width: 40 },
			{ key: 'number', label: 'Number', width: 28, help: 'Application or publication number.' },
			{ key: 'status', label: 'Status', type: 'choice', choices: ['Filed', 'Published', 'Granted'], width: 12 },
			{ key: 'office', label: 'Office', width: 18, help: 'e.g. USPTO, EPO, WIPO.' },
			{ key: 'link', label: 'Link', type: 'url', width: 30 },
			SHOW,
		],
	},
];

// Folder in public/ where file names in each image column are looked up.
export const IMAGE_FOLDERS = {
	'pi.photo': 'images/people',
	'members.photo': 'images/people',
};

export const ALL_SHEETS = [...KEY_VALUE_SHEETS, ...TABLE_SHEETS];
