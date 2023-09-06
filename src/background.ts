import * as Sentry from "@sentry/browser";

// dict with default settings that should be applied when installing/updating the extension
const defaults = {
    // no way to prevent videochatru.com and ome.tv from loading content script,
    // so I decided to add a way to prevent them from loading drivers if necessary
    "legacyPrevent": {
        "7fef97eb-a5cc-4caa-8d19-75dab7407b6b": false,
        "98ea82db-9d50-4951-935e-2405d9fe892e": false,
        // omegle is registered in edge's manifest
        "13fa70ac-6a70-4eab-8410-0fca063fbdea": false
    },
    // dict contains states if content scripts should be registered: UUID: boolean
    "scripts": {},
    // default favorites list, which consists of sites listed in the manifest's content script
    // these sites does not require additional permissions to inject the content script
    // if other chats were found in open tabs on first install,
    // then default favorites are replaced with found chats
    "favorites": function () {
        let favorites: string[] = []
        switch (getUserBrowser()) {
            case "chrome":
                // videochatru.com, ome.tv
                favorites = ["7fef97eb-a5cc-4caa-8d19-75dab7407b6b", "98ea82db-9d50-4951-935e-2405d9fe892e"]
                break;

            case "edge":
                // videochatru.com, ome.tv, omegle.com
                favorites = ["7fef97eb-a5cc-4caa-8d19-75dab7407b6b", "98ea82db-9d50-4951-935e-2405d9fe892e", "13fa70ac-6a70-4eab-8410-0fca063fbdea"]
                break;

            case "firefox":
                // mv3 in firefox requires user to confirm extension's right to access the site every single time,
                // so there are no content scripts in the firefox manifest, all scripts are dynamic to avoid confused ux
                break;
        }
        return favorites
    }(),
    // dict containing site uuid and last opened unix timestamp
    "recentDict": {},
    // if extension should display legacy 'Chatruletka (ome.tv) Extension' icon
    // if enabled, allowSetBadgeText and allowSetLastIcon dont work
    "legacyIcon": false,
    // if extension should add 'ext' badge text
    "allowSetBadgeText": true,
    // if extension should change its icon to a last chat
    "allowSetLastIcon": true,
    // allows open changelog on any supported website if there was an update
    // minimalism mode should not contain changelog
    "allowShowChangelog": true,
    // lastIconName in format "favicon.png"
    "lastIconName": "",
    // lastDomain for switch command
    "lastDomain": "",
    // sentry.io error tracking
    'sentry': true,
    // if firstInstall, should add chats from active tabs to favorites
    'firstInstall': true,
    // displays whether the migration of the old settings from v1.6.3 has occurred
    'completedOldSettingsMigration': false,
    // used to show changelog from last version + 1
    "lastVersion": "",
    // if the user wants the browser to check if user has opened a supported chat site, but has not yet given permission to work with it
    "missingPermissionCheck": true,
    // if user wants to see more detailed info on welcome screens
    "curious": false,
    // settings managed by PlatformSettings
    // "98ea82db-9d50-4951-935e-2405d9fe892e": {},
    // patreon integration
    "patreonIsPatron": false,
    "patreonLoggedIn": false,
    "patreonAccessToken": "",
    "patreonRefreshToken": "",
    "patreonTokenExpires": -1,
    "patreonSettingWired": false,
    "patreonSettingCellural": false
};

// actual content script list, ensureContentScriptsAreRegistered() should reregister on change
// const content = ["content.js"]
const content = ["vendor.js", "content_script.js"]

async function ensureSettingsAreUpToDate() {
    let result = await chrome.storage.sync.get(defaults)
    if (!result.completedOldSettingsMigration) {
        let allSettings = await chrome.storage.sync.get()

        // need to filter UUIDs because they are not listed in defaults
        let keysAllSettings = Object.keys(allSettings).filter(filterUUID)

        let keysDefault = Object.keys(defaults)

        let chatruletka = await getValue("7390db38-a617-4f6e-8a8a-ee353b76cc25", {})
        let ometv = await getValue("8fa234f6-1767-4d81-897e-758df844ae31", {})

        let keysToRemove = []

        for (const key of keysAllSettings) {
            if (keysDefault.includes(key)) {
                console.dir(`exists: ${key}`)
            } else {
                chatruletka[key] = allSettings[key]
                ometv[key] = allSettings[key]
                keysToRemove.push(key)
                console.dir(`legacy: ${key}`)
            }
        }

        if (keysToRemove.length > 0) {
            // the stats of both sites were counted together, but they belong to different platforms,
            // which would break the calculation of the overall statistics due to duplication
            // so we believe that the user used mostly the last platform and reset the other one

            if (allSettings.lastInstanceOpened) {
                if (allSettings.lastInstanceOpened.includes("ome.tv")) {
                    chatruletka.stats = JSON.parse(JSON.stringify(chatruletka.stats))
                    if (chatruletka.stats) {
                        Object.keys(chatruletka.stats).forEach(key => chatruletka.stats[key] = 0);
                    }
                } else if (allSettings.lastInstanceOpened.includes("videochatru.com")) {
                    ometv.stats = JSON.parse(JSON.stringify(ometv.stats))
                    if (ometv.stats) {
                        Object.keys(ometv.stats).forEach(key => ometv.stats[key] = 0);
                    }
                }
            }

            await chrome.storage.sync.set({"7390db38-a617-4f6e-8a8a-ee353b76cc25": chatruletka})
            await chrome.storage.sync.set({"8fa234f6-1767-4d81-897e-758df844ae31": ometv})

            await chrome.storage.sync.remove(keysToRemove)

            result.legacyIcon = true
        }
    }
    result.completedOldSettingsMigration = true

    await chrome.storage.sync.set(result);
}

async function syncBadgeIcon() {
    let result = await chrome.storage.sync.get(["legacyIcon", "lastIconName", "allowSetBadgeText", "allowSetLastIcon"]);
    if (result.legacyIcon) {
        await chrome.action.setIcon({path: "resources/img/legacy_icon.png"});
        await hideBadge()
    } else {
        if (result.allowSetBadgeText) {
            await showBadge()
        } else {
            await hideBadge()
        }
        if (result.allowSetLastIcon && result.lastIconName !== "") {
            await chrome.action.setIcon({path: `popup/icons/${result.lastIconName}`});
        } else {
            await resetIcon()
        }
    }
}

async function onPermissionsAdded(permissions: chrome.permissions.Permissions) {
    if (permissions.origins && permissions.origins.length > 0) {
        await ensureSettingsAreUpToDate()

        let sites: any[] = []
        let platforms = await fetchPlatforms()
        platforms.forEach((platform: { id: string, sites: any[]; }) => {
            platform.sites.forEach((site) => {
                if (permissions.origins!.includes(site.origin)) {
                    sites.push(site)
                }
            })
        })

        let bulkContentScripts: chrome.scripting.RegisteredContentScript[] = []

        for (const site of sites) {
            bulkContentScripts.push({
                allFrames: true,
                id: site.id,
                js: content,
                matches: [site.origin],
                persistAcrossSessions: true,
                runAt: "document_idle"
            })
        }

        if (bulkContentScripts.length > 0) {
            console.time('bulk')
            await chrome.scripting.registerContentScripts(bulkContentScripts)
            console.timeEnd('bulk')

            console.time('updateStatus')
            for (const script of bulkContentScripts) {
                await updScriptStatus(script.id, true)
            }
            console.timeEnd('updateStatus')
        }
    }
}

async function onRuntimeInstalled(_reason: chrome.runtime.InstalledDetails) {
    await ensureSettingsAreUpToDate()

    if (_reason.reason === "install") {
        let firstInstall = await getValue('firstInstall', true)
        if (firstInstall) {
            await chrome.windows.getAll({populate: true}, async function (windows) {
                let platforms = await fetchPlatforms()
                let toFind: any[] = []
                for (const platform of platforms) {
                    for (const site of platform.sites) {
                        toFind.push(site)
                    }
                }
                let found: any[] = []
                await windows.forEach(function (window) {
                    if (window.tabs) {
                        window.tabs.forEach(function (tab) {
                            toFind.forEach(site => {
                                if (tab.url && tab.url.includes(site.text)) {
                                    if (!found.includes(site)) {
                                        found.push(site)
                                    }
                                }
                            })
                        });
                    }
                });
                // If found any chat, then dont add videochatru.com and ome.tv and omegle
                if (found.length > 0) {
                    let favorites: string[] = []
                    found.forEach(site => {
                        if (!favorites.includes(site.id)) {
                            favorites.push(site.id)
                        }
                    })
                    await setValue("favorites", favorites)
                }
            });

            await setValue("lastVersion", chrome.runtime.getManifest().version)
        }

        await chrome.tabs.create({
            url: 'welcome/welcome.html'
        });
    }

    await setValue('firstInstall', false)
}

async function ensureContentScriptsAreRegistered() {
    console.time('ensureContentScriptsAreRegistered')
    if (chrome.scripting) {
        await ensureSettingsAreUpToDate()

        // TODO: add check which should remove from favorites all uuids not found in the platforms.json
        let platforms = await fetchPlatforms()
        // TODO: chrome.storage.sync.set({'script':{}}) fixes very rare DUPLICATED SCRIPT ID issue
        let scripts = (await chrome.storage.sync.get({scripts: {}})).scripts
        let actualScripts = (await chrome.scripting.getRegisteredContentScripts())

        let supposedScripts = []
        for (const [key, value] of Object.entries(scripts)) {
            if (value) {
                supposedScripts.push(key)
            }
        }

        for (const script of actualScripts) {
            if (supposedScripts.includes(script.id)) {
                if (script.js) {
                    const a2 = script.js!.slice().sort();
                    if (!(content.length === script.js!.length && content.slice().sort().every(function (value, index) {
                        return value === a2[index];
                    }))) {
                        let site = getSiteById(script.id, platforms)
                        if (site) {
                            await disableReg(script.id)
                        }
                    }
                } else {
                    let site = getSiteById(script.id, platforms)
                    if (site) {
                        await disableReg(script.id)
                    }
                }
            } else {
                let site = getSiteById(script.id, platforms)
                if (site) {
                    await disableReg(script.id)
                }
            }
        }

        let actualScriptsArray = (await chrome.scripting.getRegisteredContentScripts()).map(s => s.id)

        let bulkContentScripts: chrome.scripting.RegisteredContentScript[] = []

        for (const id of supposedScripts) {
            if (!actualScriptsArray.includes(id)) {
                let site = getSiteById(id, platforms)
                if (site) {
                    bulkContentScripts.push({
                        allFrames: true,
                        id: id,
                        js: content,
                        matches: [site.site.origin],
                        persistAcrossSessions: true,
                        runAt: "document_idle"
                    })
                }
            }
        }

        if (bulkContentScripts.length > 0) {
            console.time('bulk')
            await chrome.scripting.registerContentScripts(bulkContentScripts)
            console.timeEnd('bulk')

            console.time('updateStatus')
            for (const script of bulkContentScripts) {
                await updScriptStatus(script.id, true)
            }
            console.timeEnd('updateStatus')
        }
    }
    console.timeEnd('ensureContentScriptsAreRegistered')
}

async function onStorageChanged(changes: {
    [p: string]: chrome.storage.StorageChange
}, namespace: chrome.storage.AreaName) {
    if (namespace === "sync") {
        if (changes.allowSetBadgeText || changes.legacyIcon || changes.allowSetLastIcon || changes.lastIconName) {
            await syncBadgeIcon()
        }
    }
}

// this handles commands AKA hotkeys
// the 'switch' command is processed by a background service worker, the rest are transferred to the active chat tab
async function commandsOnCommand(command: string, tab: chrome.tabs.Tab) {
    // tabId = last active tab, can not be videochat
    // curId = current active tab, can be also videochat
    // chatId = videochat tab id
    let data = await chrome.storage.local.get({tabId: -1, chatId: -1, curId: -1})
    switch (command) {
        // this does not work good on Firefox because hotkeys work only if extension has host permission (?)
        // on FF it allows only to switch from chat tab to previous non-chat tab, but not from non-chat tab to the chat
        // switch command is not listed in the firefox manifest
        case "switch": {
            // do nothing if any of tabs === -1
            if (data.curId === -1 || data.chatId === -1 || data.tabId === -1)
                return
            if (data.curId === data.chatId) {
                // selects the non-videochat tab because the videochat tab is active
                await chrome.tabs.update(data.tabId, {active: true});
                data.curId = data.tabId;
            } else {
                // selects the videochat tab because the non-videochat tab is active
                await chrome.tabs.update(data.chatId, {active: true});
                data.curId = data.chatId;
            }
            await chrome.storage.local.set(data)
            break;
        }

        default:
            // redirect the command to the active videochat's content script
            await chrome.tabs.sendMessage(data.chatId, {command: command})
            break;
    }
}

// triggered when the active tab changes
// requires 'tab' permission
// it is mainly used to track the active chat tab
function tabsOnActivated(chTab: chrome.tabs.TabActiveInfo) {
    chrome.tabs.get(chTab["tabId"], async function (tab) {
        if (tab && tab["url"] !== undefined && tab["id"] !== undefined) {
            // torrentWindowId variable tracks window id where iknowwhatyoudownload.com tabs opens
            let data = await chrome.storage.local.get({tabId: -1, chatId: -1, curId: -1, torrentWindowId: -1})
            let lastDomain = await getValue('lastDomain', "")
            if (tab["url"].includes(lastDomain)) {
                // if the chat is open in torrentWindowId then torrentWindowId can no longer be used for iknowwhatyoudownload tabs
                if (tab.windowId === data.torrentWindowId) {
                    data.torrentWindowId = -1;
                }

                // store active videochat tab id
                data.chatId = tab["id"];
            } else {
                // if the active tab is not a videochat, then store tab id in the 'tabId' variable
                data.tabId = tab["id"];
            }
            // store active tab id in the 'curId' variable
            data.curId = tab["id"];

            await chrome.storage.local.set(data)

            if (await getValue('missingPermissionCheck', true)) {
                await checkIfMissingPermissions(tab.windowId, tab["url"], chTab["tabId"])
            }
        }
    });
}

function geo(urls: {
    url: string,
    options: RequestInit,
    service: string
}[], index: number, failed: string[], sendResponse: (response?: any) => void) {
    const nextIndex = index + 1
    fetchWithTimeout(urls[index].url, urls[index].options, 5000)
        .then((response: any) => {
            if (response.ok) {
                response.json().then((data: any) => {
                    if (urls[index].url.includes('patron')) {
                        if (data.bdc_data && data.ipapi_data) {
                            let json = {
                                "status": data.bdc.location ? "success" : "fail",
                                "country": data.bdc.country.name || "unknown",
                                "countryCode": data.bdc.country.isoAlpha2 || "unknown",
                                "region": data.bdc.location.isoPrincipalSubdivisionCode.substring(3) || "unknown",
                                "regionName": data.bdc.location.principalSubdivision || "unknown",
                                "city": data.bdc.location.city || "unknown",
                                "lat": data.bdc.location.latitude || 0,
                                "lon": data.bdc.location.longitude || 0,
                                "confidence": data.bdc.confidence,
                                "confidenceArea": data.bdc.confidenceArea,
                                "timezone": data.bdc.location.timeZone.ianaTimeId || "unknown",
                                "isp": data.bdc.network.organisation || "unknown",
                                "mobile": data.bdc.hazardReport.isCellular || false,
                                "proxy": (data.bdc.hazardReport.isKnownAsTorServer || data.bdc.hazardReport.isKnownAsVpn || data.bdc.hazardReport.isKnownAsProxy) || false,
                                "hosting": data.bdc.hazardReport.isHostingAsn || false,
                                "query": data.bdc.ip || data.ipapi.query,
                                "ipapi": data.ipapi
                            }
                            console.dir('PATREON DATA!!!')
                            console.dir(data)
                            sendResponse({status: response.status, failed: failed, body: json})
                        } else if (data.ipapi_data) {
                            data = data.ipapi
                        } else {
                            if (nextIndex == urls.length) {
                                sendResponse({status: response.status, failed: failed, body: {}})
                            } else {
                                geo(urls, nextIndex, failed, sendResponse)
                            }
                        }
                    }
                    let json = {
                        "status": data.status || "success",
                        "country": data.country || "unknown",
                        "countryCode": data.countryCode || data.country_code || "unknown",
                        "region": data.hasOwnProperty("status") ? data.region : (data.hasOwnProperty("region") ? data.region.substring(0, 2).toUpperCase() : "unknown"),
                        "regionName": data.regionName || data.region || "unknown",
                        "city": data.city || "unknown",
                        "lat": data.lat || parseFloat(data.latitude) || 0,
                        "lon": data.lon || parseFloat(data.longitude) || 0,
                        "timezone": data.timezone || "unknown",
                        "isp": data.isp || data.organization_name || "unknown",
                        "mobile": data.hasOwnProperty("mobile") ? data.mobile : (data.hasOwnProperty("accuracy") ? (data.accuracy > 100) : false),
                        "proxy": data.proxy || false,
                        "hosting": data.hosting || false,
                        "query": data.query || data.ip
                    }
                    sendResponse({status: response.status, failed: failed, body: json})
                })
            } else {
                if (nextIndex == urls.length) {
                    sendResponse({status: response.status, failed: failed, body: {}})
                } else {
                    geo(urls, nextIndex, failed, sendResponse)
                }
            }
        })
        .catch(
            (error) => {
                if (["timeout", "Failed to fetch"].includes(error.message)) {
                    failed.push(urls[index].service)
                }
                if (nextIndex == urls.length) {
                    sendResponse({status: 0, failed: failed, body: `${error.message}`})
                } else {
                    geo(urls, nextIndex, failed, sendResponse)
                }
            }
        )
}

function geolocate(ip: string, language: string, allow: {
    [key: string]: { options: {}, config?: { wired: boolean, cellural: boolean } }
}, sendResponse: (response?: any) => void) {
    const urls: { url: string, options: RequestInit, service: string }[] = []
    const failed: string[] = []
    let allow_dict = Object.keys(allow)
    if (allow_dict.includes('ve-api-patron')) {
        if (allow['ve-api-patron'].config?.wired || allow['ve-api-patron'].config?.cellural) {
            urls.push({
                url: `https://ve-api.starbase.wiki/patron-geo?ip=${ip}&lang=${language}&requestWired=${allow['ve-api-patron'].config?.wired}&requestCellural=${allow['ve-api-patron'].config?.cellural}`,
                options: allow['ve-api-patron'].options,
                service: "ve-api-patron"
            })
        }
    }

    if (allow_dict.includes('ve-api')) {
        urls.push({
            url: `https://ve-api.starbase.wiki/geo?ip=${ip}&lang=${language}`,
            options: allow['ve-api'].options,
            service: "ve-api"
        })
    }
    if (allow_dict.includes('ip-api')) {
        urls.push({
            url: `http://ip-api.com/json/${ip}?fields=17032159&lang=${language}`,
            options: allow['ip-api'].options,
            service: "ip-api"
        })
    }
    if (allow_dict.includes('geojs')) {
        urls.push({
            url: `https://get.geojs.io/v1/ip/geo/${ip}.json`,
            options: allow['geojs'].options,
            service: "geojs"
        })
    }

    if (urls.length === 0) {
        sendResponse({status: 0, body: `please allow some providers`})
        return
    }

    let index = 0
    geo(urls, index, failed, sendResponse)
}

function runtimeOnMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    // makes a request to the geolocation service with the requested IP address and language
    // making a request via service worker helps avoid http restrictions
    if (request.makeGeolocationRequest) {
        geolocate(request.makeGeolocationRequest, request.language, request.allow, sendResponse)
        return true;
    }

    // this opens new iknowwhatyoudownload tab in the torrentWindowId window
    // if torrentWindowId window does not exist, proceeds with creating one
    if (request.checkTorrents) {
        chrome.windows.getAll().then(async (res) => {
            // this variable tracks window id where iknowwhatyoudownload.com tabs opens
            // these tabs open in separate window for convenience and to avoid IP address leaking
            let data = await chrome.storage.local.get({torrentWindowId: -1})
            let found = false
            for (var prop in res) {
                if (res[prop].id === data.torrentWindowId) {
                    chrome.tabs.create({
                        url: request.url,
                        windowId: data.torrentWindowId,
                        active: true
                    })
                    found = true

                    // gets all unactive iknowwhatyoudownload tabs in the torrentWindowId window and closes them
                    chrome.windows.get(data.torrentWindowId, {populate: true}).then(res => {
                        let list_to_close: (number)[] = []

                        res.tabs?.forEach((tab) => {
                            if (tab.url && tab.id) {
                                if (!tab.active && tab.url.includes("iknowwhatyoudownload")) {
                                    list_to_close.push(tab.id)
                                }
                            }
                        })

                        chrome.tabs.remove(list_to_close)
                    })

                    break;
                }
            }
            // if torrentWindowId window was not found, creates a new one
            if (!found) {
                chrome.windows.create({
                    url: request.url
                }).then(res => {
                        if (res.id) {
                            data.torrentWindowId = res.id;
                            chrome.storage.local.set(data)
                        }
                    }
                );
            }

        })

        sendResponse('k');
    }

    if (request.openWelcome) {
        chrome.tabs.create({
            url: `welcome/welcome.html`
        });
    }

    if (request.openSetup) {
        chrome.tabs.create({
            url: `obs/setup.html`
        });
    }

    if (request.openPopupPatreon) {
        chrome.tabs.create({
            url: chrome.runtime.getURL("popup/popup.html?zoom=120&patreon")
        })
    }
}

async function checkIfMissingPermissions(windowId: number, url: string, fromTabId: number) {
    let windowType = (await chrome.windows.get(windowId)).type
    if (windowType == "normal" && url.startsWith('http')) {
        let platforms = (await chrome.storage.local.get("domains")).domains
        if (!platforms) {
            let domains: string[] = [];
            let platformsJson = await fetchPlatforms();
            platformsJson.forEach((platform: any) => {
                let ignore: string[] = []

                let contentScripts = chrome.runtime.getManifest().content_scripts
                if (contentScripts) {
                    for (const script of contentScripts) {
                        if (script.matches) {
                            for (const match of script.matches) {
                                let domain = extractHost(match)
                                if (domain) {
                                    let site = getSiteByDomain(domain, platformsJson)
                                    if (site && site.site && site.site.id) {
                                        ignore.push(site.site.id)
                                    }
                                }
                            }
                        }
                    }
                }

                platform.sites.forEach((site: any) => {
                    if (!ignore.includes(site.id)) {
                        domains.push(site.text)
                    }
                })
            })
            await chrome.storage.local.set({"domains": domains})
            platforms = (await chrome.storage.local.get("domains")).domains
        }
        let domain = extractHost(url)
        if (domain && platforms.includes(domain)) {
            let arr = (await chrome.storage.local.get({"stopPermissionCheck": []})).stopPermissionCheck
            let site = getSiteByDomain(domain, (await fetchPlatforms()))

            if (site && site.site && site.site.id) {
                let recentDict = await getValue("recentDict", {})
                recentDict[site.site.id] = Math.ceil(Date.now() / 1000)
                await setValue("recentDict", recentDict)
            }

            if (!arr.includes(domain)) {
                arr.push(domain)
                // I was supposed to use chrome.storage.session, but firefox doesn't support...
                await chrome.storage.local.set({"stopPermissionCheck": arr})

                if (site && site.site && site.site.origin) {
                    let recentDict = await getValue("recentDict", {})
                    recentDict[site.site.id] = Math.ceil(Date.now() / 1000)
                    await setValue("recentDict", recentDict)

                    console.dir(site)

                    let permission = await chrome.permissions.contains({
                        origins: [site.site.origin]
                    })
                    if (!permission) {
                        let text = site.site.text
                        setTimeout(() => {
                            chrome.tabs.create({
                                url: `popup/popup.html?missingPermission=${text}&fromTabId=${fromTabId}&recent`
                            });
                        }, 500)
                    }
                }
            }
        }
    }
}

function init() {
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.permissions.onAdded.addListener(onPermissionsAdded)

    // Show the demo page once the extension is installed
    chrome.runtime.onInstalled.addListener(onRuntimeInstalled);
    chrome.runtime.onInstalled.addListener(syncBadgeIcon);
    chrome.runtime.onInstalled.addListener(ensureContentScriptsAreRegistered)
    chrome.runtime.onInstalled.addListener(async () => {
        await chrome.storage.local.set({"stopPermissionCheck": []})
        await chrome.storage.local.remove(["domains"])
    })

    chrome.runtime.onStartup.addListener(syncBadgeIcon)
    chrome.runtime.onStartup.addListener(ensureContentScriptsAreRegistered)
    // resetting certain values in chrome.storage.local because firefox doesn't support chrome.storage.session
    chrome.runtime.onStartup.addListener(async () => {
        await chrome.storage.local.set({"stopPermissionCheck": []})
        await chrome.storage.local.remove(["domains"])
    })

    chrome.commands.onCommand.addListener(commandsOnCommand);

    chrome.tabs.onActivated.addListener(tabsOnActivated);

    chrome.tabs.onUpdated.addListener(async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
        if (tab && changeInfo.url) {
            if (await getValue('missingPermissionCheck', true)) {
                await checkIfMissingPermissions(tab.windowId, changeInfo.url, tabId)
            }
        }
    });

    // this thing handles all messages coming from content scripts
    chrome.runtime.onMessage.addListener(runtimeOnMessage);

    chrome.runtime.setUninstallURL(chrome.i18n.getMessage('lang') === "ru" ? "https://videochat-extension.starbase.wiki/ru?uninstall-ru" : "https://videochat-extension.starbase.wiki/en?uninstall-en")
}

try {
    Sentry.init({
        dsn: "https://09512316dbc3422f931ad37d4fb12ed2@o1272228.ingest.sentry.io/6533563",
        release: "videochat-extension@" + chrome.runtime.getManifest().version,
        environment: chrome.runtime.getManifest().update_url ? getUserBrowser() : "development",
        autoSessionTracking: false, // disable session tracking
        ignoreErrors: [
            "Extension context invalidated."
        ],
        async beforeSend(event) {
            let enabled = await (await chrome.storage.sync.get({['sentry']: 'true'}))['sentry']
            if (enabled) return event;
            return null;
        },
    });
} catch (e) {
    console.dir(e)
}

init()

// import export does not work in service workers ¯\_(ツ)_/¯
function filterUUID(str: string) {
    const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
    return !regexExp.test(str)
}

function extractHost(url: string) {
    return new URL(url.replace(/(\*\.)|(www\.)/g, '')).hostname;
}

async function showBadge() {
    // TODO: do I need to change color?
    await chrome.action.setBadgeBackgroundColor({color: "#000000"})
    await chrome.action.setBadgeText({
        text: "ext",
    });
}

async function hideBadge() {
    await chrome.action.setBadgeText({
        text: "",
    });
}

async function fetchPlatforms() {
    return await (await fetch(chrome.runtime.getURL('platforms.json'))).json()
}

function getSiteById(id: string, platforms: any[]) {
    for (const platform of platforms) {
        for (const site of platform.sites) {
            if (site.id == id) {
                return {site: site, platform: platform.id}
            }
        }
    }
}

function getSiteByDomain(domain: string, platforms: any[]) {
    for (const platform of platforms) {
        for (const site of platform.sites) {
            if (site.text == domain) {
                return {site: site, platform: platform.id}
            }
        }
    }
}

async function resetIcon() {
    await chrome.action.setIcon({path: "resources/img/icon.png"});
}

async function updScriptStatus(siteId: string, bool: boolean) {
    let scripts = (await chrome.storage.sync.get({
        "scripts": {}
    })).scripts;
    if (scripts[siteId] !== bool) {
        scripts[siteId] = bool
        await setValue("scripts", scripts)
    }
    // try to tell popup.js to update siteId status
    try {
        await chrome.runtime.sendMessage({updateStatus: {siteId: siteId, bool: bool}})
    } catch (e) {
        console.dir(e)
    }
}

async function isRegistered(siteId: string) {
    if (chrome.scripting) {
        const scripts = await chrome.scripting.getRegisteredContentScripts();
        const siteIds = scripts.map(script => script.id);
        return (siteIds.includes(siteId))
    } else {
        return false
    }
}

async function unreg(siteId: string) {
    if (await isRegistered(siteId)) {
        await chrome.scripting.unregisterContentScripts({ids: [siteId]})
    }
}

async function reg(siteId: any, origin: string, content: string[]) {
    await chrome.scripting.registerContentScripts([{
        allFrames: true,
        id: siteId,
        js: content,
        matches: [origin],
        persistAcrossSessions: true,
        runAt: "document_idle"
    }])
}

async function enableReg(siteId: string, origin: string, content: string[]) {
    await unreg(siteId)
    await reg(siteId, origin, content)
    await updScriptStatus(siteId, true)
}

async function disableReg(siteId: string) {
    await unreg(siteId)
    await updScriptStatus(siteId, false)
}

async function getValue(key: string, defValue: any) {
    return (await chrome.storage.sync.get({[key]: defValue}))[key]
}

// quota: 120 writes/minute
async function setValue(key: string, value: any) {
    return (await chrome.storage.sync.set({[key]: value}))
}

function getUserBrowser(): string {
    let manifest = chrome.runtime.getManifest()
    if (manifest.browser_specific_settings) {
        return "firefox"
    } else {
        if (manifest.update_url) {
            if (manifest.update_url.includes('microsoft') || manifest.update_url.includes('edge')) {
                return "edge"
            } else if (manifest.update_url.includes('google')) {
                return "chrome"
            }
        } else {
            return Math.round(Math.random()) ? "edge" : "chrome"
        }
    }
    return "chrome"
}

function fetchWithTimeout(url: RequestInfo | URL, options?: RequestInit | undefined, timeout = 5000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeout)
        )
    ]);
}