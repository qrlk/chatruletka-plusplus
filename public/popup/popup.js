// bi-star-fill
// bi-star
// bi-box-arrow-up-right
// bi-check-circle-fill
// bi-x-circle-fill
// bi-exclamation-triangle-fill

// FAIR WARNING: this popup is a performance mess
// it is based on a heavily modified https://github.com/chniter/bstreeview
// dev speed was a priority, in the future this should be rewritten / optimized

let content = ["vendor.js", "content_script.js"]

console.time("show tree")
$(async function () {
    console.time("get platforms dict")
    let platforms = await (await fetch(chrome.runtime.getURL('platforms.json'))).json()
    console.timeEnd("get platforms dict")

    console.time("get favorites")
    let favorites = (await chrome.storage.sync.get({'favorites': []}))["favorites"]
    console.timeEnd("get favorites")

    let forced_content = {
        ids: ["7fef97eb-a5cc-4caa-8d19-75dab7407b6b", "98ea82db-9d50-4951-935e-2405d9fe892e"],
        origins: ["https://*.ome.tv/*", "https://*.videochatru.com/*"]
    }

    console.time("get startPermissions")
    let startPermissions = (await chrome.permissions.getAll()).origins
    console.timeEnd("get startPermissions")
    console.time("get registered scripts")
    let startScripts = await getRegisteredScripts()
    console.timeEnd("get registered scripts")
    let t = []
    console.time("enrich sites")
    for (const platform of platforms) {
        for (const site of platform.sites) {
            t.push(site.origin)
            site.icon = 'bi-chat'
            site.favorite = favorites.includes(site.id)
            site.access = await hasPermision(site.origin, true)
            site.reg = await isRegistered(site.id, true)
            site.forcedByManifest = forced_content.ids.includes(site.id)
        }
    }
    console.dir(t)
    console.timeEnd("enrich sites")

    async function getRegisteredScripts() {
        if (chrome.scripting) {
            const scripts = await chrome.scripting.getRegisteredContentScripts();
            const siteIds = scripts.map(script => script.id);
            return siteIds
        } else {
            return []
        }
    }

    async function hasPermision(origin, initial) {
        if (forced_content.origins.includes(origin)) {
            return true
        } else {
            if (initial) {
                return startPermissions.includes(origin)
            } else {
                return await chrome.permissions.contains({
                    origins: [origin]
                })
            }
        }
    }

    async function isRegistered(siteId, initial) {
        if (forced_content.ids.includes(siteId)) {
            return !(await isLegacyPrevented(siteId));
        } else if (chrome.scripting) {
            if (initial) {
                return startScripts.includes(siteId)
            } else {
                const scripts = await chrome.scripting.getRegisteredContentScripts();
                const siteIds = scripts.map(script => script.id);
                return (siteIds.includes(siteId))
            }
        } else {
            return false
        }
    }


    async function unreg(siteId) {
        if (await isRegistered(siteId)) {
            await chrome.scripting.unregisterContentScripts({ids: [siteId]})
        }
    }

    async function reg(siteId, origin, content) {
        await chrome.scripting.registerContentScripts([{
            allFrames: true,
            id: siteId,
            js: content,
            matches: [origin],
            persistAcrossSessions: true,
            runAt: "document_idle"
        }])
    }

    async function enableReg(siteId, origin, content) {
        await unreg(siteId)
        await reg(siteId, origin, content)
        await updScriptStatus(siteId, true)
    }

    async function disableReg(siteId) {
        await unreg(siteId)
        await updScriptStatus(siteId, false)
    }

    async function requestOrigin(origin) {
        return await chrome.permissions.request({
            permissions: ["scripting"],
            origins: [origin]
        })
    }


    function getTitleByIconClass(newIconClass) {
        switch (newIconClass) {
            case "bi-check-circle-fill":
                return "Расширение активно для сайта. Нажмите, чтобы отключить."

            case "bi-x-circle-fill":
                return "Расширение отключено для сайта. Нажмите, чтобы включить."

            case "bi-exclamation-triangle-fill":
                return "Нажмите, чтобы предоставить расширению доступ к сайту."
        }
    }

    function dumbUpdStatus() {
        console.time("updStatus")
        $(`[type="status"]`).each(async (i, v) => {
            let access = await hasPermision(v.getAttribute("origin"))
            let reg = await isRegistered(v.getAttribute("siteId"))
            v.children[0].className = access ? (reg ? "bi-check-circle-fill" : "bi-x-circle-fill") : "bi-exclamation-triangle-fill"
            v.title = getTitleByIconClass(v.children[0].className)
        })
        console.timeEnd("updStatus")
    }

    async function handlePermission() {
        let siteId = this.getAttribute('siteId')
        let origin = this.getAttribute('origin')

        let icon = $(this.firstChild)
        let newIconClass

        if (icon.hasClass("bi-check-circle-fill")) {
            if (forced_content.ids.includes(siteId)) {
                return true
            } else {
                await disableReg(siteId)
                newIconClass = 'bi-x-circle-fill'
            }
        } else if (icon.hasClass('bi-x-circle-fill')) {
            await enableReg(siteId, origin, content)
            newIconClass = 'bi-check-circle-fill'
        } else {
            const result = await requestOrigin(origin)
            if (result) {
                setTimeout(dumbUpdStatus, 300)
                newIconClass = 'bi-x-circle-fill'
            } else {
                newIconClass = 'bi-exclamation-triangle-fill'
            }
        }

        let buttons = $(`[type="status"][siteId="${siteId}"]`)
        buttons.children().attr('class', newIconClass)
        buttons.attr('title', getTitleByIconClass(newIconClass))
    }

    async function isLegacyPrevented(id) {
        let legacyPrevent = (await chrome.storage.sync.get({
                "legacyPrevent": {
                    "7fef97eb-a5cc-4caa-8d19-75dab7407b6b": false,
                    "98ea82db-9d50-4951-935e-2405d9fe892e": false
                }
            }
        )).legacyPrevent
        return legacyPrevent[id]
    }

    async function updPreventLegacy(id, bool) {
        let legacyPrevent = (await chrome.storage.sync.get({
                "legacyPrevent": {
                    "7fef97eb-a5cc-4caa-8d19-75dab7407b6b": false,
                    "98ea82db-9d50-4951-935e-2405d9fe892e": false
                }
            }
        )).legacyPrevent
        legacyPrevent[id] = bool
        await chrome.storage.sync.set({"legacyPrevent": legacyPrevent})
    }

    async function updScriptStatus(siteId, bool) {
        let scripts = (await chrome.storage.sync.get({
            "scripts": {}
        })).scripts;
        if (scripts[siteId] !== bool) {
            scripts[siteId] = bool
            await chrome.storage.sync.set({"scripts": scripts})
        }
    }

    async function handleManifestPermission() {
        let siteId = this.getAttribute('siteId')
        let origin = this.getAttribute('origin')

        let icon = $(this.firstChild)
        let newIconClass

        if (icon.hasClass("bi-check-circle-fill")) {
            await updPreventLegacy(siteId, true)
            newIconClass = 'bi-x-circle-fill'
        } else if (icon.hasClass('bi-x-circle-fill')) {
            await updPreventLegacy(siteId, false)
            newIconClass = 'bi-check-circle-fill'
        }

        let buttons = $(`[type="status"][siteId="${siteId}"]`)
        buttons.children().attr('class', newIconClass)
        buttons.attr('title', getTitleByIconClass(newIconClass))
    }

    function handleStar() {
        let icon = $(this.firstChild)
        let siteId = this.getAttribute('siteId')
        let newIconClass

        if (icon.hasClass('bi-star')) {
            newIconClass = 'bi-star-fill'
            if ($(this.parentElement.parentElement).attr('favorite')) {
                this.parentElement.parentElement.remove()
            } else {
                let cur = document.getElementById("tree-item-0")
                let newFav = $(this.parentElement.parentElement).clone(true)
                newFav.attr('aria-level', 2)
                newFav.attr('favorite', true)
                newFav[0].style.paddingLeft = "2.5rem"
                cur.append(newFav[0])
            }
        } else {
            icon.removeClass()
            icon.addClass('bi-star')
            if ($(this.parentElement.parentElement).attr('favorite')) {
                this.parentElement.parentElement.remove()
                newIconClass = 'bi-star'
            } else {
                let children = document.getElementById('tree-item-0').children
                let findAndDestroy = this.parentElement.parentElement.getAttribute('text')
                let destroyArray = []
                for (let i = 0; i < children.length; i++) {
                    let child = children[i];
                    if (findAndDestroy === child.getAttribute('text')) {
                        destroyArray.push(child)
                    }
                }
                destroyArray.forEach((el) => {
                    el.remove()
                })
                newIconClass = 'bi-star'
            }
        }

        switch (newIconClass) {
            case 'bi-star': {
                let index = favorites.indexOf(siteId);
                if (index !== -1) {
                    favorites.splice(index, 1);
                }
                break;
            }
            case "bi-star-fill": {
                favorites.push(siteId)
                break;
            }
        }
        chrome.storage.sync.set({favorites: favorites})

        $(`[type="star"][siteId="${siteId}"]`).children().attr('class', newIconClass)
        toggleFavoritesVisibility()
    }

    function handleLink() {
        window.open($(this).attr('link'), "_blank")
    }

    function toggleFavoritesVisibility() {
        let cur = document.getElementById("tree-item-0")
        let fav = $("#favorites")
        if (cur) {
            if (cur.childElementCount === 0) {
                fav.removeClass('d-flex')
                fav.addClass('d-none')
            } else {
                fav.removeClass('d-none')
                fav.addClass('d-flex')
            }
        }
    }

    function createNode(site, favorite) {
        return {
            text: site.text,
            href: site.href,
            favorite: favorite,
            favicon: chrome.runtime.getURL(`popup/icons/${site.favicon}`),
            buttons: [{
                type: "status",
                icon: site.access ? (site.reg ? "bi-check-circle-fill" : "bi-x-circle-fill") : "bi-exclamation-triangle-fill",
                title: getTitleByIconClass(site.access ? (site.reg ? "bi-check-circle-fill" : "bi-x-circle-fill") : "bi-exclamation-triangle-fill"),
                origin: site.origin,
                siteId: site.id,
                onclick: site.forcedByManifest ? handleManifestPermission : handlePermission
            }, {
                type: "star",
                siteId: site.id,
                icon: site.favorite ? "bi-star-fill" : "bi-star",
                onclick: handleStar
            }, {
                type: "link",
                icon: "bi-box-arrow-up-right",
                link: site.href,
                onclick: handleLink
            }],
            icon: site.icon
        }
    }

    function createFavorites() {
        let favsNodes = []
        let favs = []
        platforms.forEach((platform) => {
            platform.sites.forEach((site) => {
                if (site.favorite) {
                    favs.push(site)
                }
            })
        })
        console.dir(favs)
        favs.sort(function (x, y) {
            let xt = recentDict[x.id] | 0
            let yt = recentDict[y.id] | 0
            console.dir(xt)
            if (xt > yt) {
                return -1;
            }
            if (xt < yt) {
                return 1;
            }
            return 0;
        });
        console.dir(favs)
        favs.forEach(site => {
            favsNodes.push(createNode(site, true))
        })

        return favsNodes
    }

    function createPlatform(text, nodes) {
        return [{
            text: text,
            badge: nodes.length,
            nodes: nodes
        }]
    }

    function createNodesFromPlatformList() {
        let nodes = []
        platforms.forEach((platform) => {
            let sitesNodes = []
            platform.sites.forEach((site) => {
                sitesNodes.push(createNode(site))
            })
            nodes = nodes.concat(createPlatform(platform.name, sitesNodes))
        })
        return nodes
    }

    function getArrayToFix(platforms) {
        let arrayToFix = []
        platforms.forEach((platform) => {
            platform.sites.forEach((site) => {
                if (!site.access) {
                    arrayToFix.push(site)
                }
            })
        })
        return arrayToFix
    }

    let recentDict = (await chrome.storage.sync.get({"recentDict": {}})).recentDict


    function getSiteById(id, platforms) {
        for (const platform of platforms) {
            for (const site of platform.sites) {
                if (site.id === id) {
                    return {site: site, platform: platform.id}
                }
            }
        }
    }

    function getSiteByDomain(domain, platforms) {
        for (const platform of platforms) {
            for (const site of platform.sites) {
                if (site.text === domain) {
                    return {site: site, platform: platform.id}
                }
            }
        }
    }

    async function createSetting(id, text) {
        return {
            switch: {
                id: id,
                text: text,
                checked: (await chrome.storage.sync.get({[id]: true}))[id],
                onchange: async function () {
                    chrome.storage.sync.set({[id]: this.checked})
                }
            }
        }
    }

    async function createSettings() {
        return [
            await createSetting('allowSetLastIcon', "Менять иконку расширения на иконку последнего видеочата."),
            await createSetting('allowSetBadgeText', "Устанавливать текст 'ext' под иконкой расширения."),
            await createSetting('sentry', "Разрешить расширению делиться с sentry.io обезличенной информацией о произошедших ошибках."),
            await createSetting('missingPermissionCheck', "Разрешить расширению запрашивать у вас доступ к поддерживаемому видеочату, к которому вы ещё не предоставили доступ.")
        ]
    }


    function createRecents(recents) {
        let recNodes = []
        console.dir(recents)
        let recArray = []
        for (const [key, value] of Object.entries(recents)) {
            recArray.push({id: key, timestamp: value})
        }
        recArray.sort(function (x, y) {
            if (x.timestamp > y.timestamp) {
                return -1;
            }
            if (x.timestamp < y.timestamp) {
                return 1;
            }
            return 0;
        });
        recArray = recArray.slice(0, 3)

        for (const site of recArray) {
            let s = getSiteById(site.id, platforms)
            if (s) {
                recNodes.push(createNode(s.site, false))
            }
        }

        return recNodes
    }


    async function createAbout() {
        return [
            {
                text: "github",
                href: "https://github.com/qrlk/videochat-extension",
                buttons: [{
                    type: "link",
                    icon: "bi-box-arrow-up-right",
                    link: "https://github.com/qrlk/videochat-extension",
                    onclick: handleLink
                }],
                icon: "bi-github"
            },
            {
                text: "discord",
                href: "https://discord.com",
                buttons: [{
                    type: "link",
                    icon: "bi-box-arrow-up-right",
                    link: "https://discord.com",
                    onclick: handleLink
                }],
                icon: "bi-discord"
            },
            {
                text: "info",
                href: chrome.runtime.getURL("welcome/welcome.html"),
                buttons: [{
                    type: "link",
                    icon: "bi-box-arrow-up-right",
                    link: chrome.runtime.getURL("welcome/welcome.html"),
                    onclick: handleLink
                }],
                icon: "bi-info-circle"
            },
        ]
    }

    async function fixAll(e) {
        let obj = getArrayToFix(platforms)
        let res = await chrome.permissions.request({
            permissions: ["scripting"],
            origins: obj.map(site => site.origin)
        }, async (res) => {
            if (res) {
                setTimeout(dumbUpdStatus, 300)
                e.target.style.display = "none"
            } else {
                e.target.style.display = ""
            }
        })
    }

    let json = [{
        text: "Favorites",
        expanded: true,
        id: "favorites",
        hide: favorites.length === 0,
        nodes: createFavorites()
    },
        {
            text: "Recent",
            id: "recents",
            expanded: favorites.length === 0,
            hide: Object.keys(recentDict).length === 0,
            nodes: createRecents(recentDict)
        },
        {
            text: "Supported sites",
            bigFixButton: {
                text: "Fix Permissions",
                display: function () {
                    let arrayToFix = getArrayToFix(platforms)
                    return arrayToFix.length > 0 ? "" : "none"
                }(),
                onclick: fixAll
            },
            nodes: createNodesFromPlatformList()
        },

        {
            text: "Settings",
            id: "settings",
            nodes: await createSettings()
        },

        {
            text: "Links",
            id: "about",
            nodes: await createAbout()
        },
    ];

    console.time("start tree")

    $('#tree').bstreeview({
        data: json,
        expandIcon: 'bi-caret-down',
        collapseIcon: 'bi-caret-right',
        indent: 1.25,
        parentsMarginLeft: '1.25rem',
        openNodeLinkOnNewTab: true
    });
    console.timeEnd("start tree")
    // toggleFavoritesVisibility()
    console.timeEnd("show tree")
    // document.getElementById('container').style.display=""

    let params = new URLSearchParams(window.location.search);
    if (params.has('zoom')) {
        document.body.style.zoom = params.get('zoom') + "%"
    }
    if (params.has('missingPermission')) {
        let site = getSiteByDomain(params.get("missingPermission"), platforms)
        let countAll = platforms.map(pl => pl.sites.length).reduce((partialSum, a) => partialSum + a, 0)
        Swal.fire({
            title: 'Missing permission detected',
            html: `You tried to open <b>${site.site.text}</b>, which is supported by the <b>Videochat Extension</b>, but you have not yet granted your permission to operate on this site.<br><br><button id="optButton"><b>Give the extension access to ${site.site.text}</b></button><br><br>Extension supports ${countAll} chat websites already and this optional permission system is the only way that works without disabling the extension on every update.<br><br><button id="allButton"><b>Fix missing permissions for ${getArrayToFix(platforms).length} / ${countAll} sites</b></button><br><br>If you want to disable the extension in a specific video chat, you just need to click on the checkmark in the list to turn it off/on.`,
            icon: 'warning',
            showDenyButton: true,
            showConfirmButton: false,
            didRender: () => {
                document.getElementById('optButton').onclick = async () => {
                    await requestOrigin(site.site.origin)
                    if (await hasPermision(site.site.origin)) {
                        setTimeout(() => {
                            chrome.tabs.update(parseInt(params.get('fromTabId')), {highlighted: true}, () => {
                                chrome.tabs.reload(parseInt(params.get('fromTabId'), false, () => {
                                    window.close()
                                }))
                            })
                        }, 1000)
                    }
                }
                document.getElementById('allButton').onclick = fixAll
            },
            denyButtonText: `Click to disable this check`,
        }).then(async (result) => {
            if (result.isDenied) {
                await chrome.storage.sync.set({"missingPermissionCheck": false})
                Swal.fire({
                    title: 'Проверка отключена',
                    text: 'Простите за неудобство',
                    confirmButtonText: "Вернуться назад в видочат",
                    icon: 'info'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        if (params.has('fromTabId')) {
                            chrome.tabs.update(parseInt(params.get('fromTabId')), {highlighted: true}, () => {
                                window.close()
                            })
                        } else {
                            window.close()
                        }
                    }
                })
            }
        })
    }
});
