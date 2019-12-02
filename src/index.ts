import HttpClient, {DefaultClient, MockClient} from './HttpClient'
import {Request} from './Request'
import {FrameworkEvents} from './Events'
import ValidationHandler from './ValidationHandler'
import {error} from './utils'

declare global {
    interface Window {
        ocUnloading: boolean
    }
}

class Framework {

    public constructor (protected httpClient: HttpClient) {
        window.addEventListener('beforeunload', this.unloadEventListener)
        this.unloadHandlers.push(() => {
            window.removeEventListener('beforeunload', this.unloadEventListener)
        })
    }

    public defaultTrackInputInterval = 300

    protected unloadHandlers: Function[] = []

    protected readonly dataRequestChangeQuerySelector = `
        select[data-request],
        input[type=radio][data-request],
        input[type=checkbox][data-request],
        input[type=file][data-request]
    `
    protected readonly dataRequestClickQuerySelector = `
        a[data-request],
        button[data-request],
        input[type=button][data-request],
        input[type=submit][data-request]
    `
    protected readonly dataRequestKeyDownQuerySelector = `
        input[type=text][data-request],
        input[type=submit][data-request],
        input[type=password][data-request]
    `
    protected readonly dataTrackInputQuerySelector = `
        input[data-request][data-track-input]
    `

    protected trackInputTimer: number = 0
    protected trackInputRequestInProgress: boolean = false
    protected loaderClass = 'oc-loading'

    public setClient (cli: HttpClient) {
        this.httpClient = cli
    }

    public attachRequests () {
        let els = document.querySelectorAll<HTMLInputElement>(this.dataRequestChangeQuerySelector)
        if (els.length > 0) {
            els.forEach(el => el.addEventListener('change', this.requestChangeEventListener(el)))
        }
        els = document.querySelectorAll<HTMLInputElement>(this.dataRequestClickQuerySelector)
        if (els.length > 0) {
            els.forEach(el => el.addEventListener('click', this.requestClickEventListener(el)))
        }
        els = document.querySelectorAll<HTMLInputElement>(this.dataRequestKeyDownQuerySelector)
        if (els.length > 0) {
            els.forEach(el => el.addEventListener('keydown', this.requestKeyDownEventListener(el)))
        }
        document.addEventListener('submit', this.documentSubmitEventListener.bind(this))

        this.unloadHandlers.push(() => {
            document.removeEventListener('submit', this.documentSubmitEventListener)
            let els = document.querySelectorAll<HTMLInputElement>(this.dataRequestChangeQuerySelector)
            if (els.length > 0) {
                els.forEach(el => el.removeEventListener('change', this.requestChangeEventListener(el)))
            }
            els = document.querySelectorAll<HTMLInputElement>(this.dataRequestClickQuerySelector)
            if (els.length > 0) {
                els.forEach(el => el.removeEventListener('click', this.requestClickEventListener(el)))
            }
            els = document.querySelectorAll<HTMLInputElement>(this.dataRequestKeyDownQuerySelector)
            if (els.length > 0) {
                els.forEach(el => el.removeEventListener('keydown', this.requestKeyDownEventListener(el)))
            }
        })
    }

    public attachTrackInputs () {
        document.addEventListener('input', this.trackInputEventListener.bind(this))
        this.unloadHandlers.push(() => {
            document.removeEventListener('input', this.trackInputEventListener.bind(this))
            if (this.trackInputTimer) {
                clearTimeout(this.trackInputTimer)
            }
        })
    }

    public attachValidation () {
        document.addEventListener(FrameworkEvents.Validation, this.requestValidateEventListener.bind(this))
        document.addEventListener(FrameworkEvents.Promise, this.requestValidatePromiseEventListener.bind(this))
        this.unloadHandlers.push(() => {
            document.removeEventListener(FrameworkEvents.Validation, this.requestValidateEventListener.bind(this))
            document.removeEventListener(FrameworkEvents.Promise, this.requestValidatePromiseEventListener.bind(this))
        })
    }

    public attachLoading (loaderClass: string = 'oc-loading') {
        this.loaderClass = loaderClass
        document.addEventListener(FrameworkEvents.Promise, this.attachLoadingPromiseEventListener.bind(this))
        document.addEventListener(FrameworkEvents.Fail, this.attachLoadingDoneEventListener.bind(this))
        document.addEventListener(FrameworkEvents.Done, this.attachLoadingDoneEventListener.bind(this))
        this.unloadHandlers.push(() => {
            document.removeEventListener(FrameworkEvents.Promise, this.attachLoadingPromiseEventListener.bind(this))
            document.removeEventListener(FrameworkEvents.Fail, this.attachLoadingDoneEventListener.bind(this))
            document.removeEventListener(FrameworkEvents.Done, this.attachLoadingDoneEventListener.bind(this))
        })
    }

    protected attachLoadingPromiseEventListener (e: Event) {
        const target = e.target as HTMLInputElement
        if (!target.matches('[data-request]')) {
            return
        }

        // Add the css class and disable the element.
        const apply = (el: HTMLInputElement) => {
            el.classList.add(this.loaderClass)
            el.disabled = true
        }

        // Lock the target itself
        if (target.dataset.attachLoading) {
            apply(target)
        }

        // If the target is a form, lock all children.
        if (target.tagName.toLowerCase() === 'form') {
            const els = target.querySelectorAll<HTMLInputElement>('[data-attach-loading]')
            if (els.length > 0) {
                els.forEach(el => apply(el))
            }
        }
    }

    protected attachLoadingDoneEventListener (e: Event) {
        const target = e.target as HTMLInputElement
        if (!target.matches('[data-request]')) {
            return
        }

        // Add the css class and disable the element.
        const apply = (el: HTMLInputElement) => {
            el.classList.remove(this.loaderClass)
            el.disabled = false
        }

        // Lock the target itself
        if (target.dataset.attachLoading) {
            apply(target)
        }

        // If the target is a form, lock all children.
        if (target.tagName.toLowerCase() === 'form') {
            const els = target.querySelectorAll<HTMLInputElement>('[data-attach-loading]')
            if (els.length > 0) {
                els.forEach(el => apply(el))
            }
        }
    }

    protected requestChangeEventListener (el: HTMLInputElement) {
        return async () => await this.request(el)
    }

    protected requestClickEventListener (el: HTMLInputElement) {
        return async (e: MouseEvent) => {
            e.preventDefault()
            return await this.request(el)
        }
    }

    protected async documentSubmitEventListener (e: Event) {
        const el = e.target as HTMLInputElement
        if (el.matches('[data-request]')) {
            e.preventDefault()
            return await this.request(el)
        }
    }

    protected unloadEventListener () {
        window.ocUnloading = true
    }

    protected trackInputEventListener (e: Event) {
        const el = e.target as HTMLInputElement

        if (!el.matches(this.dataTrackInputQuerySelector)) {
            return
        }
        if (!el.matches('[type=email],[type=number],[type=password],[type=search],[type=text]')) {
            return
        }

        const lastValue = el.dataset.lastValue
        // No change, do nothing
        if (lastValue !== undefined && lastValue === el.value) {
            return
        }

        el.dataset.lastValue = el.value
        if (this.trackInputTimer) {
            clearTimeout(this.trackInputTimer)
        }

        let interval = Number(el.dataset.trackInput)
        if (!interval) {
            interval = this.defaultTrackInputInterval
        }

        this.trackInputTimer = setTimeout(async () => {
            if (this.trackInputRequestInProgress) {
                return
            }
            this.trackInputRequestInProgress = true
            await this.request(el)
            this.trackInputRequestInProgress = false
        }, interval)
    }

    protected requestValidateEventListener (e: Event) {
        if (!e.target) {
            return
        }

        const el = e.target as HTMLFormElement

        if (!el.matches('[data-request][data-request-validate]')) {
            return
        }

        const v = new ValidationHandler(e as CustomEvent)
        v.handle()
    }

    protected requestValidatePromiseEventListener (e: Event) {
        if (!e.target) {
            return
        }

        // Remove visible classes on the error items before a request is sent.
        const els = (e.target as HTMLFormElement).querySelectorAll('[data-validate-for], [data-validate-error]')
        if (els.length > 0) {
            els.forEach(i => i.classList.remove('visible'))
        }
    }

    public async request (el: HTMLInputElement) {
        if (el.dataset.request === undefined) {
            throw error('missing data-request attribute on target element')
        }

        const r = new Request(el, el.dataset.request)
        r.setClient(this.httpClient)
        return await r.do()
    }

    protected requestKeyDownEventListener (el: HTMLInputElement) {
        return async (e: KeyboardEvent) => {
            if (e.key === '13') {
                e.preventDefault()
                if (this.trackInputTimer) {
                    clearTimeout(this.trackInputTimer)
                }

                return await this.request(el)
            }
        }
    }

    public destroy () {
        this.unloadHandlers.forEach(fn => fn())
    }
}

type confFn = (f: Framework) => void

const framework = Build(
    withClient(new MockClient()),
    withRequest(),
    withTrackInput(),
)

// withRequest attaches all data-request event handlers
export function withRequest (): confFn {
    return function (f: Framework) {
        f.attachRequests()
    }
}

// withTrackInput attaches all data-track-input event handlers
export function withTrackInput (interval: number = 300): confFn {
    return function (f: Framework) {
        f.defaultTrackInputInterval = interval
        f.attachTrackInputs()
    }
}

// withClient sets a custom HttpClient implementation.
export function withClient (cli: HttpClient): confFn {
    return function (f: Framework) {
        f.setClient(cli)
    }
}

// withValidation enables data-request-validate form validation
export function withValidation (): confFn {
    return function (f: Framework) {
        f.attachValidation()
    }
}

// withAttachLoading enables data-attach-loading elements
export function withAttachLoading (loaderClass: string = 'oc-loading'): confFn {
    return function (f: Framework) {
        f.attachLoading(loaderClass)
    }
}

export function Build (...confFn: confFn[]): Framework {
    const framework = new Framework(
        new DefaultClient()
    )

    confFn.forEach(fn => fn(framework))
    return framework
}
