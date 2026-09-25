import rss from '@astrojs/rss';
import { lab, newsId, settings } from '../lib/data';

export function GET(context) {
	const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
	return rss({
		title: `${settings.labName} news`,
		description: settings.description,
		site: context.site,
		items: lab.news.map((n) => ({
			title: n.title,
			description: n.text,
			pubDate: new Date(`${n.date}T00:00:00Z`),
			link: `${base}/news/#${newsId(n)}`,
		})),
	});
}
