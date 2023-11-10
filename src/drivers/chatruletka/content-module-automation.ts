import $ from "jquery";
import {ChatruletkaDriver} from "../content-driver-chatruletka";

require('arrive')

export class AutomationModule {
    private static instanceRef: AutomationModule;
    public static defaults = {
        skipFourSec: false,
        autoResume: false,
        skipwrongcountry: false,
        autostopafterskip: false,
    }
    public settings = [
        {
            type: "header",
            text: chrome.i18n.getMessage("settingsAutomation")
        },
        {
            type: "checkbox",
            important: false,
            key: "skipFourSec",
            text: chrome.i18n.getMessage("autoskipfour"),
            tooltip: chrome.i18n.getMessage("tooltipFour")
        },
        {
            type: "checkbox",
            important: false,
            key: "autoResume",
            text: chrome.i18n.getMessage("autoresume"),
            tooltip: chrome.i18n.getMessage("tooltipAutoresume"),
            enable: () => {
                this.autoResume.enable()
            },
            disable: () => {
                this.autoResume.disable()
            }
        },
        {
            type: "checkbox",
            important: false,
            key: "skipwrongcountry",
            text: chrome.i18n.getMessage("autoskipwrongcountry"),
            tooltip: chrome.i18n.getMessage("tooltipAutoskipWrongCountry")
        },
        {
            type: "checkbox",
            important: false,
            key: "autostopafterskip",
            text: chrome.i18n.getMessage("autostopafterskip"),
            tooltip: chrome.i18n.getMessage("tooltipAutoStopAfterSkip")
        },
    ]
    private driver: ChatruletkaDriver;

    private constructor(driver: ChatruletkaDriver) {
        this.driver = driver
    }

    static initInstance(driver: ChatruletkaDriver): AutomationModule {
        if (AutomationModule.instanceRef === undefined) {
            AutomationModule.instanceRef = new AutomationModule(driver);
        }

        return AutomationModule.instanceRef;
    }

    public injectAutomationSkipFourSec() {
        setInterval(() => {
            if (globalThis.platformSettings.get("skipFourSec")) {
                try {
                    if ((this.driver.stage === 3) && (this.driver.found + 4000 < Date.now())) {
                        console.dir("Skipping due to loading time limit");
                        (document.getElementsByClassName('buttons__button start-button')[0] as HTMLElement).click()
                    }
                } catch (e) {
                    // console.dir(e)
                }
            }
        }, 1000)
    }

    public autoResumeObserver: MutationObserver | undefined
    public autoResume = {
        enable: () => {
            (document.getElementById('overlay') as HTMLElement).style.background = "none";
            // document.getElementById('overlay').style.position = "unset"

            (document.getElementById('ShowFacePopup') as HTMLElement).style.filter = "opacity(0)"
            this.autoResumeObserver = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                        if (mutation.attributeName === "class") {
                            if ((mutation.target as HTMLElement).className.includes("disabled")) {
                                $(".ok").removeClass("disabled");
                                let disabledButton: HTMLElement = (document.getElementsByClassName("video-warning__btn")[0]).firstElementChild as HTMLElement
                                disabledButton.click()
                            }
                        }
                    }
                )
            });
            this.autoResumeObserver.observe($(".ok")[0], {attributes: true})
        },
        disable: () => {
            (document.getElementById('overlay') as HTMLElement).style.background = "";
            // document.getElementById('overlay').style.position = "unset"

            (document.getElementById('ShowFacePopup') as HTMLElement).style.filter = ""

            if (this.autoResumeObserver) {
                this.autoResumeObserver.disconnect()
                this.autoResumeObserver = undefined
            }
        }
    }
    public checkedCountry = false

    public injectAutomationSkipWrongCountry() {
        let self = this
        document.arrive(".tr-country", function (el: any) { // TODO: FIX TYPE
            if (globalThis.platformSettings.get("skipwrongcountry")) {
                try {
                    if (el.parentElement?.className === "message-bubble") {
                        let expectedCountry = "ZZ" // http://xml.coverpages.org/country3166.html#:~:text=ZZ,or%20unspecified%20country

                        if ($(".country-filter-popup__country").filter(".all").filter(".selected").length == 0) {
                            expectedCountry = $(".country-filter-popup__country").filter(".selected").children('span[data-tr]')[0].getAttribute('data-tr')!
                        }
                        let receivedCountry = el.dataset.tr
                        if (expectedCountry !== "ZZ" && expectedCountry !== receivedCountry) {
                            self.driver.stopAndStart()
                            console.dir(el)
                            console.dir(`SKIPPED WRONG COUNTRY. EXPECTED: ${expectedCountry}, RECEIVED: ${receivedCountry}.`)
                        } else {
                            console.dir(`FOUND TARGET COUNTRY. EXPECTED: ${expectedCountry}, RECEIVED: ${receivedCountry}.`)
                            console.dir(`PROCESSING DELAYED IPS: ${self.driver.modules.geolocation.delayIPs.length}.`)
                            self.checkedCountry = true
                            self.driver.modules.geolocation.processDelayed()
                        }
                    }
                } catch (e) {
                    console.dir("SKIP WRONG COUNTRY EXCEPTION BEGIN")
                    console.dir(e)
                    console.dir("SKIP WRONG COUNTRY EXCEPTION END")
                }
            }
        })
    }

    public needToStop = false;
}
