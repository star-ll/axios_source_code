/**
 * @type {import('vitepress').UserConfig}
 */
export default {
	title: "axios源码分析",
	description: "axios源码深入浅出",
	themeConfig: {
		outline: "deep",
		outlineTitle: "目录",
		// ignoreDeadLinks: true,
		nav: [
			{ text: "指南", link: "/" },
			{ text: "博客", link: "http://docs.yujin123.cn" },
			{ text: "github", link: "https://github.com/const-love-365-10000" },
		],
		sidebar: {
			index: [
				{
					text: "Guide",
					collapsible: true,
					items: [
						{ text: "introduction", link: "/introduction" },
						{ text: "core", link: "/core" },
						{ text: "helpers", link: "/helpers" },
						{ text: "cancel", link: "/cancel" },
						{ text: "adapters", link: "/adapters" },
					],
				},
			],
		},
	},
};
