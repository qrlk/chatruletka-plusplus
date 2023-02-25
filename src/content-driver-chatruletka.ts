import $ from "jquery";
import {detectGender, injectFaceApi} from "./content-module-faceapi";
import {checkApi, injectIpEventListener} from "./content-module-geolocation";
import {injectSwitchModeButton} from "./content-swal-switchmode";
// import {injectCounter} from "./content-controls-tab-api";

import {injectStreamerMode} from "./content-module-streamermode";
import {HotkeysModule} from "./content-module-hotkeys";
import {AutomationModule} from "./content-module-automation";
import {InterfaceModule} from "./content-module-interface";
import {ControlsModule} from "./content-module-controls";

export class ChatruletkaDriver {
    private static instanceRef: ChatruletkaDriver;
    // Stages: stop = 0 | search = 1 | found = 2 | connected = 3 | play = 4
    public stage: 0 | 1 | 2 | 3 | 4 = 0
    public modules: any = {}
    private stageObserver: MutationObserver;

    private constructor() {
        this.stageObserver = new MutationObserver(this.onChangeStage)
    }

    static getInstance(): ChatruletkaDriver {
        if (ChatruletkaDriver.instanceRef === undefined) {
            ChatruletkaDriver.instanceRef = new ChatruletkaDriver();
        }

        return ChatruletkaDriver.instanceRef;
    }

    public stopAndStart(delay?: number | undefined): void {
        if (typeof delay !== "undefined") {
            (document.getElementsByClassName('buttons__button stop-button')[0] as HTMLElement).click()
            clearTimeout(globalThis.timeout)
            globalThis.timeout = setTimeout(() => {
                (document.getElementsByClassName('buttons__button start-button')[0] as HTMLElement).click()
            }, delay)
        } else {
            globalThis.requestToStartTiming = +new Date();
            (document.getElementsByClassName('buttons__button stop-button')[0] as HTMLElement).click()
        }
    }

    public start(element: HTMLElement): boolean {
        this.initModules()

        this.modules.controls.injectControls()

        this.modules.interface.tweakLoginWindow()
        this.modules.interface.applyTweaks()

        injectIpEventListener()

        injectSwitchModeButton()

        document.getElementsByClassName('buttons__button start-button')[0].addEventListener("click", (e) => {
            if (globalThis.driver.stage === 4)
                globalThis.settings.stats.countManSkip++

            clearTimeout(globalThis.timeout)
        })

        document.getElementsByClassName('buttons__button stop-button')[0].addEventListener("click", (e: any) => { // TODO: fix type
            if (e.pointerType !== "") {
                (document.getElementById("remoteInfo") as HTMLElement).innerHTML = chrome.i18n.getMessage("main")
                checkApi()
            }
            clearTimeout(globalThis.timeout)
        })


        // injectCounter()

        checkApi()


        this.modules.automation.injectAutomationSkipFourSec()
        this.modules.automation.injectAutomationSkipWrongCountry()
        if (globalThis.settings.autoResume) {
            this.modules.automation.injectAutomationAutoResume()
        }

        if (!globalThis.settings.ipApiLocalisation)
            globalThis.language = "en"

        if (globalThis.settings.hotkeys) {
            this.modules.hotkeys.unregister()
            this.modules.hotkeys.register()
        }

        if (globalThis.settings.skipMale || globalThis.settings.skipFemale || globalThis.settings.enableFaceApi) {
            injectFaceApi()
        }

        if (globalThis.settings.streamer) {
            injectStreamerMode()
        }


        new ResizeObserver(globalThis.mapModule.outputsize).observe(document.getElementById("overlay") as HTMLElement)

        this.stageObserver.observe(element, {attributes: true});

        return true
    }

    protected initModules() {
        this.modules.controls = ControlsModule.initInstance(this)
        this.modules.hotkeys = HotkeysModule.initInstance(this)
        this.modules.automation = AutomationModule.initInstance(this)
        this.modules.interface = InterfaceModule.initInstance(this)
    }

    private onChangeStage = (mutations: any[]) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "class") {
                if (this.stage === 4) {
                    globalThis.settings.stats.time += Math.ceil((Date.now() - globalThis.play) / 1000)
                }

                const attributeValue = String($(mutation.target).prop(mutation.attributeName));
                if (attributeValue.includes("s-stop")) {
                    this.stage = 0;

                    clearInterval(globalThis.tim)
                    globalThis.curIps = []
                    // (document.getElementById("remoteInfo") as HTMLElement).innerHTML = ''
                    globalThis.needToClear = true;
                    (document.getElementById("remoteFace") as HTMLElement).innerHTML = '';

                    if (globalThis.requestToStartTiming !== 0 && +new Date() - globalThis.requestToStartTiming < 1000) {
                        globalThis.requestToStartTiming = 0;
                        (document.getElementsByClassName('buttons__button start-button')[0] as HTMLElement).click()
                    }
                }
                if (attributeValue.includes("s-search")) {
                    this.stage = 1

                    globalThis.curIps = []
                    globalThis.needToClear = true
                    globalThis.needToCheckTarget = true

                    clearInterval(globalThis.tim);
                    // (document.getElementById("remoteFace") as HTMLElement).innerHTML = ''
                    if (globalThis.play < globalThis.search) {
                        // console.log("Dialog ended before even started")
                    }

                    globalThis.search = Date.now()
                } else if (attributeValue.includes("s-found")) {
                    this.stage = 2;

                    globalThis.needToCheckTarget = true

                    globalThis.found = Date.now()
                } else if (attributeValue.includes("s-connected")) {
                    this.stage = 3;
                } else if (attributeValue.includes("s-play")) {
                    this.stage = 4;

                    clearInterval(globalThis.tim)
                    globalThis.tim = setTimeout(detectGender, 0)

                    globalThis.play = Date.now()
                    console.log("Loading took: ", ((globalThis.play - globalThis.found) / 1000).toFixed(2), "sec")

                    globalThis.settings.stats.countAll++
                }
                //TODO: FIX updStats
                // updStats(false)
            }
        });
    }
}