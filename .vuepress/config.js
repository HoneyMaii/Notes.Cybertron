module.exports = {
    "title": "Notes.Cybertron",
    "description": "个人学习笔记",
    "dest": "public",
    "head": [
        [
            "link",
            {
                "rel": "icon",
                "href": "/favicon.ico"
            }
        ],
        [
            "meta",
            {
                "name": "viewport",
                "content": "width=device-width,initial-scale=1,user-scalable=no"
            }
        ]
    ],
    "theme": "reco",
    "themeConfig": {
        "nav": [{
                "text": "主页",
                "link": "/",
                "icon": "reco-home"
            },
            {
                "text": "时间轴",
                "link": "/timeline/",
                "icon": "reco-date"
            },
            {
                "text": "文档",
                "icon": "reco-message",
                "items": [{
                        text: 'vuepress-reco',
                        link: '/docs/theme-reco/'
                    },
                    {
                        text: '.NET',
                        link: '/docs/NET/'

                    }
                ]
            },
            {
                "text": "联系我",
                "icon": "reco-message",
                "items": [{
                    "text": "GitHub",
                    "link": "https://github.com/HoneyMaii",
                    "icon": "reco-github"
                }]
            }
        ],
        "sidebar": {
            "/docs/theme-reco/": [
                "",
                "theme",
                "plugin",
                "api"
            ],
            "/docs/NET/": [
                "",
                "thread",
                "netcore"
            ]
        },
        "type": "blog",
        "blogConfig": {
            "category": {
                "location": 2, // 在导航栏菜单中所占的位置，默认2
                "text": "Category" // 默认文案 “分类”
            },
            "tag": {
                "location": 3, // 在导航栏菜单中所占的位置，默认3
                "text": "标签" // 默认文案 “标签”
            },
            socialLinks: [ // 信息栏展示社交信息
                { icon: 'reco-github', link: 'https://github.com/HoneyMaii' }
            ]
        },
        "friendLink": [
            // {
            //       "title": "午后南杂",
            //       "desc": "Enjoy when you can, and endure when you must.",
            //       "email": "1156743527@qq.com",
            //       "link": "https://www.recoluan.com"
            //   },
            //   {
            //       "title": "vuepress-theme-reco",
            //       "desc": "A simple and beautiful vuepress Blog & Doc theme.",
            //       "avatar": "https://vuepress-theme-reco.recoluan.com/icon_vuepress_reco.png",
            //       "link": "https://vuepress-theme-reco.recoluan.com"
            //   }
        ],
        "logo": "/logo.png",
        "search": true,
        "searchMaxSuggestions": 10,
        "lastUpdated": "Last Updated",
        "author": "Edward Chu",
        "authorAvatar": "/avatar.png",
        "record": "",
        "startYear": "2021"
    },
    "markdown": {
        "lineNumbers": true
    }
}