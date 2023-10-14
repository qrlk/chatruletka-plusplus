import {ChatruletkaDriver} from "../content-driver-chatruletka";
import * as utils from "../../utils/utils";
import $ from "jquery";
import {ContentSwalChangelog} from "../../swal/content-swal-changelog";
import {ContentSwalInfoSimplified} from "./content-swal-info";
import {ControlsTabApi} from "./content-module-geolocation";
import Swal from "sweetalert2";
import {OmegleDriver} from "../content-driver-omegle";

require('tooltipster')

export class ControlsModule {
    public static defaults = {
        expand: true,
        ignoreSiteStyles: true,
        showHints: true,
        showHintsMoreOften: false,
        showHeaderVersion: true,
        showHeaderVersionFull: true,
    }
    public videoContainerHeight = 0
    public chatContainerHeight = 0
    public driver: ChatruletkaDriver | OmegleDriver;
    public vertical = false
    public header: ControlsHeader;
    public tabs: any = []
    public controls: HTMLElement | undefined;

    public constructor(driver: ChatruletkaDriver | OmegleDriver) {
        this.driver = driver
        if (driver.site.vertical) {
            this.vertical = true
        }

        this.header = new ControlsHeader(this.driver, this)
    }

    public start(tabs: any[]) {
        tabs.forEach((tab) => {
            this.tabs.push(tab)
        })
        this.controls = this.createControls();
    }

    public resizeControls = () => {
        if (this.vertical) {
            return
        }
        // TODO: CHECK IF FIX FOR OME.TV WORKED
        if ($('li.active')[0].innerText === chrome.i18n.getMessage("tab3")) {
            if (globalThis.platformSettings.get("expand")) {
                setTimeout(() => {
                    this.resizemap(true)
                }, 600)
            } else {
                this.videoContainerHeight = 0
                this.chatContainerHeight = 0
                this.resizemap(false)
            }
        } else {
            this.videoContainerHeight = 0
            this.chatContainerHeight = 0
            this.resizemap(false)
        }
    }

    // TODO: FIX IT ON OME.TV: GO SETTINGS -> resize window -> GO OTHER TAB -> size wont change
    public resizemap = (extend: boolean): void => {
        if (extend && globalThis.platformSettings.get("expand")) {
            let newVideoContainerHeight = parseFloat((document.getElementById("video-container") as HTMLElement).style.height)
            let newChatContainerHeight = parseFloat((document.getElementsByClassName("chat-container")[0] as HTMLElement).style.height)

            if (newVideoContainerHeight !== (newVideoContainerHeight + newChatContainerHeight) / 2) {
                this.videoContainerHeight = parseFloat((document.getElementById("video-container") as HTMLElement).style.height);
                this.chatContainerHeight = parseFloat((document.getElementsByClassName("chat-container")[0] as HTMLElement).style.height);
                // console.dir(this.videoContainerHeight);
                // console.dir(this.chatContainerHeight);
                // console.trace("1");

                (document.getElementById("video-container") as HTMLElement).style.height = (this.videoContainerHeight + this.chatContainerHeight) / 2 + "px";
                (document.getElementsByClassName("chat-container")[0] as HTMLElement).style.height = (this.videoContainerHeight + this.chatContainerHeight) / 2 + "px"
            }
        } else {
            // console.dir('resize false')
            // console.dir(this.videoContainerHeight)
            // console.dir(this.chatContainerHeight)
            if (this.videoContainerHeight !== 0 && this.chatContainerHeight !== 0) {
                (document.getElementById("video-container") as HTMLElement).style.height = this.videoContainerHeight + "px";
                (document.getElementsByClassName("chat-container")[0] as HTMLElement).style.height = this.chatContainerHeight + "px"
            }
        }

        let tabs = $(".tabs__caption")[0]

        // I remade the old hardcoded resize function to support the custom set of tabs,
        // but this must be redone normally in the future, without changing what the interface looks like
        // Array.from({length: 2}, () => {
        //     this.tabs.forEach((tab: any) => {
        //         let el = <HTMLElement>tab.content.lastElementChild
        //         if (el) {
        //             if (tab.content.childElementCount > 0) {
        //                 let newHeight = tab.content.offsetHeight - tabs.offsetHeight - tab.marginBottom
        //                 if (tab.content.childElementCount > 1) {
        //                     [...Array(tab.content.childElementCount - 1).keys()].forEach((key) => {
        //                         newHeight += -(tab.content.children[key] as HTMLElement).offsetHeight
        //                     })
        //                 }
        //                 if (this.vertical) {
        //                     newHeight += -15
        //                 }
        //                 el.style.height = newHeight + "px"
        //             }
        //         }
        //     })
        // });
        let newHeight = document.getElementById("controls")!.offsetHeight - document.getElementById("VE_header")!.offsetHeight - document.getElementById("VE_tab_selector")!.offsetHeight

        newHeight += -1
        document.getElementById("VE_tab_content")!.style.height = newHeight + "px"

        this.tabs.forEach((tab: any) => {
            tab.handleResize()
        })
    }

    public settings = [
        {
            type: "header",
            text: chrome.i18n.getMessage("settingsControls")
        },
        {
            type: "checkbox",
            important: false,
            key: "expand",
            text: chrome.i18n.getMessage("expand"),
            tooltip: chrome.i18n.getMessage("tooltipExpand"),
            enable: () => {
                setTimeout(() => {
                    this.resizemap(true)
                }, 100)
            },
            disable: () => {
                this.resizemap(false)
            }
        },
        {
            type: "checkbox",
            important: false,
            key: "ignoreSiteStyles",
            text: chrome.i18n.getMessage("ignoreSiteStyles"),
            tooltip: chrome.i18n.getMessage("tooltipIgnoreSiteStyles"),
            enable: () => {
                if (this.controls) {
                    if (!location.pathname.includes("embed")) {
                        this.controls.style.fontSize = "initial"
                    }
                }
            },
            disable: () => {
                if (this.controls) {
                    this.controls.style.fontSize = ""
                }
            }
        },
        {
            type: "checkbox",
            important: false,
            key: "showHints",
            controlsSection: 'showHintsEnabled',
            text: chrome.i18n.getMessage("showHints"),
            tooltip: chrome.i18n.getMessage("tooltipShowHints"),
        },
        {
            type: "section",
            hide: globalThis.platformSettings.get("showHints"),
            sectionId: "showHintsEnabled",
            children: [
                {
                    type: "checkbox",
                    important: false,
                    key: "showHintsMoreOften",
                    text: chrome.i18n.getMessage("showHintsMoreOften"),
                    tooltip: chrome.i18n.getMessage("tooltipshowHintsMoreOften")
                }
            ]
        },
        {
            type: "checkbox",
            important: false,
            key: "showHeaderVersion",
            text: chrome.i18n.getMessage("showHeaderVersion"),
            tooltip: chrome.i18n.getMessage("tooltipShowHeaderVersion"),
            enable: () => {
                this.header.updHeaderString()
            },
            disable: () => {
                this.header.updHeaderString()
            },
            controlsSection: 'showHeaderVersionEnabled',
        },
        {
            type: "section",
            hide: globalThis.platformSettings.get("showHeaderVersion"),
            sectionId: "showHeaderVersionEnabled",
            children: [
                {
                    type: "checkbox",
                    important: false,
                    key: "showHeaderVersionFull",
                    text: chrome.i18n.getMessage("showHeaderVersionFull"),
                    tooltip: chrome.i18n.getMessage("tooltipShowHeaderVersionFull"),
                    enable: () => {
                        this.header.updHeaderString()
                    },
                    disable: () => {
                        this.header.updHeaderString()
                    },
                },
            ]
        },
    ]

    public injectControls(tabs: any[]) {
        this.start(tabs)

        // TODO: do I really need both tooltipster and css-tooltip?
        const c = document.createElement('link');
        c.rel = "stylesheet";
        c.href = chrome.runtime.getURL('libs/css/css-tooltip.min.css');

        const cs = document.createElement('link');
        cs.rel = "stylesheet";
        cs.href = chrome.runtime.getURL("libs/css/tooltipster.bundle.min.css");

        (document.head || document.documentElement).appendChild(c);
        (document.head || document.documentElement).appendChild(cs);

        ($(".gender-selector")[0] as HTMLElement).parentElement!.remove()
        if (this.vertical) {
            let chat = $("[class='chat']")
            let controls = utils.createElement('div', {
                id: "videochat-extension-controls-container",
                style: "height:290px; width:390px; border: 1px solid #d5d5d5;box-shadow: 0 0 5px 0 rgba(0,0,0,.15) inset;background: #fff;"
            })
            controls.style.height = "225px"
            // controls.style.width = parseFloat($(".buttons__button.start-button")[0].style.width) * 2 + 8 + "px"
            $(controls).appendTo(chat)

            let body = $("[class='chat__body']")
            body[0].style.top = parseInt(controls.style.height) + 9 + "px"
            if (this.controls) {
                $(this.controls).appendTo("#videochat-extension-controls-container");
            }

        } else {
            if (this.controls) {
                $(this.controls).insertBefore(".chat");
            }
        }

        $('.tooltip').tooltipster({maxWidth: 300, distance: -1})

        if (!this.vertical) {
            let oldWidth = 0
            const observer = new MutationObserver((mutationList: any, observer: any) => {
                if (this.controls) {
                    for (const mutation of mutationList) {
                        if (mutation.type === "attributes" && mutation.attributeName === "style") {
                            if (oldWidth !== mutation.target.style.width) {
                                // console.dir("MUTATED")
                                oldWidth = mutation.target.style.width
                                let mar = parseInt(window.getComputedStyle(this.controls).marginRight)

                                let videoContainer = document.getElementById('video-container')
                                let correction = 0
                                if (videoContainer) {
                                    if (videoContainer.className.includes('full-width')) {
                                        correction = (<HTMLElement>document.querySelector(".chat-container")).offsetLeft
                                    }
                                }

                                mutation.target.style.maxWidth = (parseInt(mutation.target.style.width) - (parseInt(this.controls.style.width) + mar) / 2) - correction + "px"
                                this.driver.chat.style.maxWidth = (parseInt(mutation.target.style.width) - (parseInt(this.controls.style.width) + mar) / 2) - correction + "px"
                                this.resizeControls()
                            }
                        }
                    }
                }
            });
            observer.observe(this.driver.buttons, {attributes: true});
            new ResizeObserver(this.resizeControls).observe(document.getElementById("overlay") as HTMLElement)

            window.dispatchEvent(new Event('resize'));
        }
    }

    protected createStyle() {
        return utils.createElement('style', {
            textContent: `.tabs__content {
                display: none;
                padding-left: 5px;
                padding-right: 5px;
              }
              
              .tabs__content.active {
                display: block;
              }
              
              .tabs {
                position: relative;
                height: 100%;
                word-break: break-word;
                user-select: text;
              }
              
              .tabs__caption {
                display: flex;
                flex-wrap: wrap;
                list-style-type: none;
                bottom: 0px;
                background: #f8f8f8;
                margin: 0;
                padding: 0;
                position: absolute;
                width: 100%;
                border-bottom: 1px solid lightgray;
                user-select: none;
              }
              
              .tabs__caption li {
                padding: 0.2rem 0.5rem;
                text-decoration: none;
                color: black;
                text-align: center;
                flex-shrink: 0;
                flex-grow: 1;
              }
      
              .tabs__caption li:not(.active) {
                cursor: pointer;
              }
              
              .tabs__caption .active {
                font-weight: bold;
              }
              
              .controls__row:after {
                content: "";
                display: table;
                box-sizing: border-box;
                clear: both;
              }
              
              dd {
                margin-inline-start: 20px!important;
              }
              
              input {
                margin-left: 5px!important;
              }
              
              select {
                margin-left: 5px!important;
              }
              
              sup {
                top: initial
              } 
              
              p {
                display: inline-block;
              }
              
              .ve__header__button {
                    width: 22.67px;
                    padding-right: 0;
                    padding-left: 0;
                    height: 15px;
              }
              
              small {font-size: xx-small!important;}
              `
        })
    }

    protected createTabs() {
        let tabs: HTMLElement[] = []
        this.tabs.forEach((tab: any) => {
            tabs.push(tab.tab)
        })
        if (tabs.length > 0) {
            tabs[0].className = "active"
        }
        return utils.createElement('ul', {
            className: "tabs__caption",
            id: "VE_tab_selector"
        }, tabs)
    }

    protected createContent() {
        let content: HTMLElement[] = []
        this.tabs.forEach((tab: ControlsTabApi) => {
            content.push(tab.content)
        })
        return content
    }

    protected createControls() {
        let tabs = this.createTabs()
        this.addTabClickHandler(tabs)
        let content = [this.createStyle(), this.header.content, utils.createElement('div', {
            id: 'VE_tab_content', style: "width:100%; height: 100%;"
        }, this.createContent()), tabs]
        if (this.vertical) {
            return utils.createElement('div', {
                className: 'chatt', id: 'controls', style: "width:100%; height: 100%;"
            }, [utils.createElement('div', {
                className: "tabs"
            }, content)])
        } else {
            let con = utils.createElement('div', {
                className: 'chat', id: 'controls', style: "width:390px; margin-right: calc(100vh / 768 * 10)"
            }, [utils.createElement('div', {
                className: "tabs chat"
            }, content)])

            if (globalThis.platformSettings.get("ignoreSiteStyles")) {
                if (!location.pathname.includes("embed")) {
                    con.style.fontSize = "initial"
                }
            }
            return con
        }
    }

    protected doThisAfterTabClicked(tabElement: any) {

        this.tabs.forEach((tab: any) => {
            tab.handleTabClick()
        })


        if (tabElement.innerText === chrome.i18n.getMessage("tab3")) {
            this.resizemap(true)
        } else {
            this.resizemap(false)
        }
    }

    protected addTabClickHandler(tabs: HTMLElement) {
        let self = this
        $(tabs).on('click', 'li:not(.active)', function () {
            $(this)
                .addClass('active').siblings().removeClass('active')
                .closest('div.tabs').find('div.tabs__content').removeClass('active').eq($(this).index()).addClass('active');
            self.doThisAfterTabClicked(this)
        });
    }
}

export class ControlsTabAbout {
    public name = chrome.i18n.getMessage("tab4")
    public content: HTMLElement
    public tab: HTMLElement
    public readonly marginBottom = 5
    private driver: ChatruletkaDriver | OmegleDriver;
    private module: any;

    public constructor(driver: ChatruletkaDriver | OmegleDriver, module?: any) {
        this.driver = driver
        this.module = module
        this.tab = this.getTabHTML()
        this.content = this.getContentHTML()
    }

    public handleTabClick() {

    }

    public handleResize() {

    }

    protected getTabHTML() {
        return utils.createElement('li', {
            innerText: this.name
        })
    }

    protected getContentHTML() {
        return utils.createElement('div', {
            className: "tabs__content",
            id: "aboutPanel",
            style: "height:100%;"
        }, [
            utils.createElement('div', {
                    id: "aboutInfo",
                    style: "overflow-y: auto; height:100%;"
                },
                [
                    utils.createElement('span', {
                        innerHTML: chrome.i18n.getMessage("desc"),
                    }),
                    utils.createElement('br'),
                    utils.createElement('br'),
                    utils.createElement('span', {}, [
                        this.createBadgeLink("https://discord.gg/7DYWu5RF7Y", chrome.i18n.getMessage("discordBadge")),
                    ]),
                    utils.createElement('br'),
                    utils.createElement('br'),
                    utils.createElement('table', {}, [
                        utils.createElement('tr', {}, [
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://chrome.google.com/webstore/detail/alchldmijhnnapijdmchpkdeikibjgoi", `https://img.shields.io/chrome-web-store/v/alchldmijhnnapijdmchpkdeikibjgoi?logo=${chrome.i18n.getMessage('mainReviewLogoChrome')}`),
                            ]),
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://chrome.google.com/webstore/detail/alchldmijhnnapijdmchpkdeikibjgoi/reviews", "https://img.shields.io/chrome-web-store/rating/alchldmijhnnapijdmchpkdeikibjgoi"),
                            ]),
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://chrome.google.com/webstore/detail/alchldmijhnnapijdmchpkdeikibjgoi", "https://img.shields.io/chrome-web-store/users/alchldmijhnnapijdmchpkdeikibjgoi"),
                            ]),
                        ]),


                        utils.createElement('tr', {}, [
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://microsoftedge.microsoft.com/addons/detail/jdpiggacibaaecfbegkhakcmgaafjajn", `https://img.shields.io/badge/dynamic/json?label=edge%20add-on%E2%A0%80%E2%A0%80%E2%A0%80%E2%A0%80&prefix=v&query=%24.version&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fjdpiggacibaaecfbegkhakcmgaafjajn&logo=${chrome.i18n.getMessage('mainReviewLogoEdge')}`),
                            ]),
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://microsoftedge.microsoft.com/addons/detail/jdpiggacibaaecfbegkhakcmgaafjajn", "https://img.shields.io/badge/dynamic/json?label=rating&suffix=/5&query=%24.averageRating&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fjdpiggacibaaecfbegkhakcmgaafjajn&color=brightgreen"),
                            ]),
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://microsoftedge.microsoft.com/addons/detail/jdpiggacibaaecfbegkhakcmgaafjajn", "https://img.shields.io/badge/dynamic/json?label=users&query=%24.activeInstallCount&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fjdpiggacibaaecfbegkhakcmgaafjajn"),
                            ]),
                        ]),


                        utils.createElement('tr', {}, [
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://addons.mozilla.org/firefox/addon/videochat-extension-ip-locator/", `https://img.shields.io/amo/v/videochat-extension-ip-locator?label=mozilla add-on%E2%A0%80%E2%A0%80&logo=${chrome.i18n.getMessage('mainReviewLogoFirefox')}`, "width: 171px"),
                            ]),
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://addons.mozilla.org/firefox/addon/videochat-extension-ip-locator/reviews", "https://img.shields.io/amo/rating/videochat-extension-ip-locator"),
                            ]),
                            utils.createElement('th', {}, [
                                this.createBadgeLink("https://addons.mozilla.org/firefox/addon/videochat-extension-ip-locator/", "https://img.shields.io/amo/users/videochat-extension-ip-locator"),
                            ]),
                        ])
                    ]),
                    utils.createElement('br'),
                    utils.createElement('span', {
                        innerHTML: chrome.i18n.getMessage("github"),
                    }),
                    utils.createElement('br'),
                    utils.createElement('br'),
                    utils.createElement('dl', {
                            style: 'margin:0'
                        },
                        [
                            this.createDTHeader(chrome.i18n.getMessage("author")),
                            this.createDDLink("qrlk", "https://github.com/qrlk"),

                            this.createDTHeader(chrome.i18n.getMessage("inspired")),
                            this.createDDLink("rtcstats", "https://github.com/fippo/rtcstats"),

                            this.createDTHeader(chrome.i18n.getMessage("libs")),
                            this.createDDLink("jquery", "https://jquery.com/"),
                            this.createDDLink("FaceAPI", "https://github.com/vladmandic/face-api"),
                            this.createDDLink("arrive.js", "https://github.com/uzairfarooq/arrive"),
                            this.createDDLink("leaflet", "https://github.com/Leaflet/Leaflet"),
                            this.createDDLink("tooltipster", "https://github.com/calebjacob/tooltipster"),
                            this.createDDLink("sweetalert2", "https://github.com/sweetalert2/sweetalert2"),
                            this.createDDLink("DOMPurify", "https://github.com/cure53/DOMPurify"),

                            this.createDTHeader("<b>Css:</b>"),
                            this.createDDLink("dark reader", "https://darkreader.org/"),
                            this.createDDLink("css-tooltip", "https://github.com/alterebro/css-tooltip"),

                            this.createDTHeader(chrome.i18n.getMessage("3rdparty")),
                            this.createDDLink("ip-api", "https://ip-api.com/"),
                            this.createDDLink("carto", "https://carto.com"),
                        ]),
                    utils.createElement('br'),
                    utils.createElement('button', {
                        onclick: async () => {
                            ContentSwalChangelog.getInstance().showFromVersion((await chrome.storage.sync.get({'lastVersion': ''})).lastVersion)
                        },
                    }, [
                        utils.createElement('b', {
                            innerText: chrome.i18n.getMessage("changelogButtonText")
                        })
                    ]),
                    utils.createElement('br'),
                    utils.createElement('button', {
                        onclick: () => {
                            this.showSwalWelcome()
                        },
                    }, [
                        utils.createElement('b', {
                            innerText: chrome.i18n.getMessage("welcomeButtonText")
                        })
                    ]),
                    utils.createElement('br'),
                    utils.createElement('button', {
                        onclick: () => {
                            chrome.runtime.sendMessage({openWelcome: true})
                        },
                    }, [
                        utils.createElement('b', {
                            innerText: chrome.i18n.getMessage("postInstallButtonText")
                        })
                    ]),
                ]
            )
        ])
    }

    protected createBadgeLink(href: string, badgeSrc: string, badgeStyle?: string) {
        return utils.createElement('a', {
            target: "_blank",
            style: "text-decoration: none!important; margin-right: 3px",
            href: href
        }, [
            utils.createElement('img', {
                src: badgeSrc,
                style: badgeStyle
            }),
        ])
    }

    protected createDTHeader(innerHTML: string) {
        return utils.createElement('dt', {
            innerHTML: innerHTML
        })
    }

    protected createDDLink(innerText: string, href: string) {
        return utils.createElement('dd', {}, [
            utils.createElement('a', {
                href: href,
                innerText: innerText,
                style: "text-decoration: none!important;",
                target: "_blank"
            })
        ])
    }

    protected showSwalWelcome() {
        new ContentSwalInfoSimplified(this.driver.platform.name).showFromStart()
    }
}

export class ControlsHeader {
    public content: any;
    private driver: ChatruletkaDriver | OmegleDriver;
    private module: any
    private leftScreen: HTMLElement;
    private leftPip: HTMLElement;
    public leftBlur: HTMLElement;
    public leftMute: HTMLElement;
    private rightPip: HTMLElement;
    private rightScreen: HTMLElement;
    private left: HTMLElement;
    private right: HTMLElement;
    private header: HTMLElement;
    private headerText: HTMLElement;

    public remote = "remote-video"
    public echo = "echo-video"
    public local = "local-video"

    public constructor(driver: ChatruletkaDriver | OmegleDriver, module?: any) {
        this.driver = driver
        this.module = module

        this.leftScreen = this.createLeftScreen()
        this.leftPip = this.createLeftPip()
        this.leftBlur = this.createLeftBlur()
        this.leftMute = this.createLeftMute()

        this.rightPip = this.createRightPip()
        this.rightScreen = this.createRightScreen()

        this.left = this.createLeft()
        this.headerText = this.createExtensionHeaderText()
        this.updHeaderString()
        this.header = this.createExtensionHeader()
        this.right = this.createRight()

        this.content = utils.createElement('center', {
            style: "user-select:none;line-height: 1;font-family: \"PT Sans\",sans-serif;",
            id: "VE_header"
        }, [
            this.left,
            this.header,
            this.right
        ])
    }

    private createScreenshot(videoId: string) {
        let dwncanvas = document.createElement('canvas');
        dwncanvas.width = (document.getElementById(videoId) as HTMLVideoElement)?.videoWidth
        dwncanvas.height = (document.getElementById(videoId) as HTMLVideoElement)?.videoHeight

        let ctx = dwncanvas.getContext('2d');
        if (ctx instanceof CanvasRenderingContext2D) {
            ctx.drawImage((document.getElementById(videoId) as HTMLVideoElement), 0, 0, dwncanvas.width, dwncanvas.height);
            utils.downloadImage(dwncanvas.toDataURL('image/jpg'))
        }
        return
    }

    private handlePip(videoId: string) {
        if (utils.getUserBrowser() === "firefox") {
            // let parent: JQuery<HTMLElement>, vid: JQuery<HTMLElement>
            if (videoId === this.echo) {
                let vid = document.getElementById(this.echo)!
                if (vid.style.maxWidth === "0px") {
                    vid.style.maxWidth = "160px"
                    vid.style.zIndex = "99"
                } else {
                    vid.style.maxWidth = "0px"
                    vid.style.zIndex = ""
                }
            }
            Swal.fire({
                title: 'Picture-In-Picture',
                heightAuto: false,
                confirmButtonText: chrome.i18n.getMessage("denyButtonText"),
                html: videoId === this.echo ? chrome.i18n.getMessage("firefoxHandleStreamerPip") : chrome.i18n.getMessage("firefoxHandlePip"),
            }).then((result) => {

            })
        } else {
            let v = (document.getElementById(videoId) as HTMLVideoElement)

            if (document.pictureInPictureElement === v)
                document.exitPictureInPicture()
            else {
                if (v.readyState > 0) {
                    v.requestPictureInPicture()
                }
            }
        }
    }

    public minifyButtons() {
        this.leftScreen.style.width = "16px"
        this.leftPip.style.width = "16px"
        this.leftBlur.style.width = "16px"
        this.leftMute.style.width = "16px"
        this.rightPip.style.width = "16px"
        this.rightScreen.style.width = "16px"
    }

    public restoreButtons() {
        this.leftScreen.style.width = ""
        this.leftPip.style.width = ""
        this.leftBlur.style.width = ""
        this.leftMute.style.width = ""
        this.rightPip.style.width = ""
        this.rightScreen.style.width = ""
    }

    private createLeft() {
        return utils.createElement('div', {
            style: "display:flex; position:absolute; left:0; top:0",
        }, [
            this.leftScreen,
            this.leftPip,
            this.leftBlur,
            this.leftMute,
        ])
    }

    private createRight() {
        return utils.createElement('div', {
            style: "display:flex; position:absolute; right:0; top:0",
        }, [
            this.rightPip,
            this.rightScreen
        ])
    }

    private createLeftScreen() {
        return utils.createElement('button', {
            className: "ve__header__button",
            style: "color: red;",
            title: chrome.i18n.getMessage("screen_remote"),
            onclick: () => {
                this.createScreenshot(this.remote)
            }
        }, [
            utils.createElement('b', {
                innerText: "^"
            })
        ])
    }

    private createLeftPip() {
        return utils.createElement('button', {
            className: "ve__header__button",
            style: "color:green;",
            title: chrome.i18n.getMessage("pip_remote"),
            onclick: () => {
                this.handlePip(globalThis.platformSettings.get('streamer') ? this.echo : this.remote)
            },
        }, [
            utils.createElement('b', {
                innerText: "^"
            })
        ])
    }


    private createLeftBlur() {
        return utils.createElement('button', {
            id: "blurButton",
            className: "ve__header__button",
            style: function f() {
                if (globalThis.platformSettings.get("streamer")) {
                    return "line-height:0"
                } else {
                    return "line-height:0; display:none"
                }
            }(),
            title: "Hide / unhide",
            onclick: (e: MouseEvent) => {
                if (this.driver.modules.streamer) {
                    this.driver.modules.streamer.handleBlurButtonClick(e)
                }
            },
        }, [
            utils.createElement('b', {
                style: 'font-size: xx-small',
                innerText: "h"
            })
        ])
    }

    private createLeftMute() {
        return utils.createElement('button', {
            id: "muteButton",
            className: "ve__header__button",
            style: function f() {
                if (globalThis.platformSettings.get("streamer")) {
                    return "line-height:0"
                } else {
                    return "line-height:0; display:none"
                }
            }(),
            title: "Mute / unmute",
            onmousedown: (e: MouseEvent) => {
                if (this.driver.modules.streamer) {
                    this.driver.modules.streamer.handleMuteButtonDown(e)
                }
            },
            onmouseleave: (e: MouseEvent) => {
                if (this.driver.modules.streamer) {
                    this.driver.modules.streamer.handleMuteButtonLeave(e)
                }
            },
            onmouseup: (e: MouseEvent) => {
                if (this.driver.modules.streamer) {
                    this.driver.modules.streamer.handleMuteButtonUp(e)
                }
            }
        }, [
            utils.createElement('b', {
                style: 'font-size: xx-small',
                innerText: "m"
            })
        ])
    }

    public updHeaderString() {
        this.headerText.innerText = chrome.i18n.getMessage("extension_name_header") + (globalThis.platformSettings.get("showHeaderVersion") ? " v" + (globalThis.platformSettings.get("showHeaderVersionFull") ? chrome.runtime.getManifest().version : chrome.runtime.getManifest().version.substring(0, 3)) : "")
    }

    private createExtensionHeaderText() {
        return utils.createElement('b', {
            id: "VE_extension_name_header",
        })
    }

    private createExtensionHeader() {
        return utils.createElement('a', {
            target: "_blank",
            style: "text-decoration: none!important; color: #000000;",
            href: "https://chrome.google.com/webstore/detail/alchldmijhnnapijdmchpkdeikibjgoi"
        }, [
            this.headerText
        ])
    }

    private createRightPip() {
        return utils.createElement('button', {
            className: "ve__header__button",
            style: "color:green;",
            title: chrome.i18n.getMessage("pip_local"),
            onclick: () => {
                this.handlePip(this.local)
            },
        }, [
            utils.createElement('b', {
                innerText: "^"
            })
        ])
    }

    private createRightScreen() {
        return utils.createElement('button', {
            className: "ve__header__button",
            style: "color: red;",
            title: chrome.i18n.getMessage("screen_local"),
            onclick: () => {
                this.createScreenshot(this.local)
            },
        }, [
            utils.createElement('b', {
                innerText: "^"
            })
        ])
    }
}
