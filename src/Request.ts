import HttpClient, {DefaultClient, RequestResult} from './HttpClient'
import {FrameworkEvents} from './Events'
import {FrameworkHeaders, FrameworkResponseFields, Headers} from './Headers'
import {error, extractPartials, getParents, isInput, paramToObj, StringDictionary} from './utils'

export interface UpdateOption {
    [partial: string]: string
}

interface RequestOptions {
    beforeUpdate?: (data: any, textStatus: string, jqXHR: Response | undefined) => boolean
    ajaxGlobal?: string // request-ajax-global,
    confirm?: string // request-confirm,
    redirect?: string // request-redirect,
    loading?: HTMLElement // request-loading,
    flash?: boolean // request-flash,
    files?: string // request-files,
    form?: HTMLFormElement // request-form,
    url?: string // request-url,
    headers?: StringDictionary // request-url,

    update?: UpdateOption // data-request-update
    data?: StringDictionary // data-request-data

    handleFlashMessage?: (message: string, type: string) => void
    client?: HttpClient
}

interface GlobalContext {
    handler: string
    options: object
}

export interface ValidationErrors {
    [field: string]: string[]
}

const PrependModifier = '^'
const AppendModifier = '@'

interface HandlerContext {
    data: object
    textStatus: string
    response: Response | undefined
}

export class Request {
    // The request handler
    public handler: string
    // The element this request is triggered from
    public element: HTMLElement
    // The form for this request
    public form: HTMLFormElement | null
    // The request options
    public options: RequestOptions
    // The HttpClient implementation used for this request
    protected client: HttpClient | undefined
    protected context: GlobalContext

    public constructor (element: HTMLElement, handler: string, options?: RequestOptions) {
        // Merge defaults and provided options.
        options = {...this.defaultOptions, ...options}

        if (!handler.match(/^(?:\w+\:{2})?on*/)) {
            throw error('Invalid handler name. The correct handler name format is: "onEvent".')
        }

        if (!element) {
            throw error('Provide a valid DOM node as first parameter.')
        }

        this.options = options
        this.handler = handler.trim()
        this.client = options.client
        this.element = element
        this.form = options.form ?? element.closest('form')
        this.context = {handler: this.handler, options: this.options}
    }

    public async do (): Promise<boolean> {
        if (this.options.confirm && !this.handleConfirmMessage(this.options.confirm)) {
            return false
        }

        if (this.triggerEvent(FrameworkEvents.BeforeRequest) === false) {
            return false
        }

        this.loadingShow()

        this.triggerEventOn(window, FrameworkEvents.BeforeSend, this.context)
        this.triggerEvent(FrameworkEvents.Promise, this.context)

        let headers: Headers = {
            [FrameworkHeaders.Handler]: this.handler,
            [FrameworkHeaders.Partials]: this.options.update ? extractPartials(this.options.update) : '',
        }

        if (this.options.flash) {
            headers[FrameworkHeaders.Flash] = '1'
        }

        // Merge in provided http headers
        headers = {...headers, ...this.options.headers}

        // Use any provided options data as base.
        let data: StringDictionary = {...this.options.data}
        // Merge in all parent element data values.
        getParents(this.element, '[data-request-data]').reverse().forEach(el => {
            data = {...data, ...paramToObj(el.dataset.requestData)}
        })
        // If the element is an input, add it's value to the data as well. If we have a
        // parent form, the value will be included there anyways, so skip this step.
        if (!this.form && isInput(this.element)) {
            const name = (this.element as HTMLInputElement).name
            // Add the value if a name is available and it wasn't explicitly
            // declared in the data option.
            if (name !== undefined && data[name] === undefined) {
                data[name] = (this.element as HTMLInputElement).value
            }
        }

        // Create a new FormData object form the existing form.
        const requestData = new FormData(this.form ?? undefined)
        // Append all additional data to the FormData object.
        for (let key in data) {
            requestData.append(key, data[key])
        }

        if (!this.client) {
            throw error('no client is set for request execution')
        }

        const result = await this.client.fetch('', {
            data: requestData,
            headers
        })

        const context: HandlerContext = {
            data: result.data,
            textStatus: result.textStatus,
            response: result.response
        }

        // The request failed!
        if (result.success === false) {
            await this.error(context, result)
            this.complete(context, result)
            return false
        }

        const successResult = this.success(context, result)
        this.complete(context, result)
        return successResult
    }

    protected loadingShow () {
        if (this.options.loading) {
            this.options.loading.style.display = 'block'
        }
    }

    protected loadingHide () {
        if (this.options.loading) {
            this.options.loading.style.display = 'none'
        }
    }

    protected complete (context: HandlerContext, result: RequestResult) {
        // Trigger the ajax event only if no redirect is present
        if (result.data && !result.data.hasOwnProperty(FrameworkResponseFields.Redirect)) {
            this.triggerEvent(FrameworkEvents.Always, {context: this.context, ...context})
        }

        this.loadingHide()
        this.triggerEvent(FrameworkEvents.Complete, {context: this.context, ...context})
    }

    protected success (context: HandlerContext, result: RequestResult): boolean {
        // Trigger the ajax event only if no redirect is present
        if (result.data && !result.data.hasOwnProperty(FrameworkResponseFields.Redirect)) {
            this.triggerEvent(FrameworkEvents.Done, {context: this.context, ...context})
        }

        if (this.options.beforeUpdate && this.options.beforeUpdate(result.data, result.textStatus, result.response) === false) {
            return false
        }

        if (this.triggerEvent(FrameworkEvents.BeforeUpdate, context) === false) {
            return false
        }

        // Trigger flash messages
        if (this.options.flash && result.data.hasOwnProperty(FrameworkResponseFields.FlashMessages)) {
            const messages = result.data[FrameworkResponseFields.FlashMessages]
            delete result.data[FrameworkResponseFields.FlashMessages]
            for (let type in messages) {
                if (messages.hasOwnProperty(type) && this.options.handleFlashMessage) {
                    this.options.handleFlashMessage(messages[type], type)
                }
            }
        }

        this.handleUpdateResponse(context, result)

        this.triggerEvent(FrameworkEvents.Success, {context: this.context, ...context})

        return true
    }

    protected handleUpdateResponse (context: HandlerContext, result: RequestResult) {
        for (let partial in result.data) {
            if (!this.options.update) {
                continue
            }

            // If a partial has been supplied on the client side that matches the server supplied key, look up
            // it's selector and use that. If not, we assume it is an explicit selector reference.
            let selector = this.options.update[partial] ? this.options.update[partial] : partial

            let modifier = selector.charAt(0)
            if (modifier === AppendModifier || modifier === PrependModifier) {
                // Remove the modifier if one was set
                selector = selector.substr(1)
            } else {
                modifier = ''
            }

            const els = document.querySelectorAll(selector)
            if (els.length > 0) {
                els.forEach(element => {
                    if (!modifier) {
                        // If no modifier is present, this is a replace operation, trigger the event.
                        this.triggerEventOn(element, FrameworkEvents.BeforeReplace)
                    }

                    if (modifier === PrependModifier) {
                        element.innerHTML = result.data[partial] + element.innerHTML
                    } else if (modifier === AppendModifier) {
                        element.innerHTML = element.innerHTML + result.data[partial]
                    } else {
                        element.innerHTML = result.data[partial]
                    }

                    this.triggerEventOn(element, FrameworkEvents.Update, {context: this.context, ...context})
                })

                this.triggerEventOn(window, FrameworkEvents.UpdateComplete, {context: this.context, ...context})
                window.dispatchEvent(new Event('resize'))
            }
        }

        // handleRedirect
        if (result.data.hasOwnProperty(FrameworkResponseFields.Redirect)) {
            this.handleRedirectResponse(result.data[FrameworkResponseFields.Redirect])
            return true
        }

        // handle validation
        if (result.data.hasOwnProperty(FrameworkResponseFields.ErrorFields)) {
            this.handleValidationMessage(result.data[FrameworkResponseFields.ErrorMessage], result.data[FrameworkResponseFields.ErrorFields])
        }
    }

    protected async error (context: HandlerContext, result: RequestResult) {
        // Skip if the page is unloading (redirect, etc)
        if ((window.ocUnloading !== undefined && window.ocUnloading)) {
            return
        }

        // Trigger the ajax event only if no redirect is present
        if (result.data && !result.data.hasOwnProperty(FrameworkResponseFields.Redirect)) {
            this.triggerEvent(FrameworkEvents.Fail, {context: this.context, ...context})
        }

        // Disable redirects
        this.options.redirect = undefined

        // Error 406 is a "smart error" that returns response object that is
        // processed in the same fashion as a successful response.
        let errorMsg
        if (result.response && result.response.status == 406 && result.data) {
            errorMsg = result.data[FrameworkResponseFields.ErrorMessage]
            this.handleUpdateResponse(context, result)
        } else {
            errorMsg = result.data
            if (!errorMsg) {
                errorMsg = result.response ? result.response.statusText : 'Unknown error'
            }
        }
        this.element.setAttribute('data-error', errorMsg)

        if (this.triggerEvent(FrameworkEvents.Error, {context: this.context, ...context}) === false) {
            return
        }

        this.handleErrorMessage(errorMsg)
    }

    get defaultOptions (): RequestOptions {
        return {
            ajaxGlobal: "",
            confirm: "",
            data: {},
            beforeUpdate: (data, textStatus, response) => true,
            files: "",
            flash: false,
            form: undefined,
            loading: undefined,
            redirect: "",
            update: {},
            headers: {},
            url: "",
            client: new DefaultClient(),
            handleFlashMessage: (message, type) => {
            }
        }
    }

    /**
     * The element where events are triggered on.
     * Uses the closest form if available, otherwise the element.
     */
    get triggerElement (): HTMLElement {
        return this.form ?? this.element
    }

    /**
     * Trigger an event on the trigger element.
     * If the event default was prevented, returns false, otherwise true.
     * @param event
     * @param context
     */
    public triggerEvent (event: FrameworkEvents, context: object = {}): boolean {
        const e = new CustomEvent(event, {cancelable: true, bubbles: true, detail: {...context, ...this.context}})
        return this.triggerElement.dispatchEvent(e)
    }

    public triggerEventOn (element: Window | Element, event: FrameworkEvents, context: object = {}): boolean {
        const e = new CustomEvent(event, {cancelable: true, bubbles: true, detail: {...context, ...this.context}})
        return element.dispatchEvent(e)
    }

    /**
     * Replace the HttpClient.
     * @param client
     */
    public setClient (client: HttpClient) {
        this.client = client
    }

    protected handleRedirectResponse (url: string) {
        window.location.href = url
    }

    protected handleValidationMessage (message: string, fields: ValidationErrors) {
        // Without a form the validation step is skipped.
        if (!this.form) {
            return
        }

        this.triggerEvent(FrameworkEvents.Validation, {message, fields, ...this.context})

        let isFirstInvalidField = true
        for (let field in fields) {
            let messages = fields[field]
            field = field.replace(/\.(\w+)/g, '[$1]')

            let matching = Array
                .from(this.form.querySelectorAll<HTMLInputElement>(
                    '[name="' + field + '"], [name="' + field + '[]"], [name$="[' + field + ']"], [name$="[' + field + '][]"]'
                ))
                .filter(f => !f.disabled)

            if (matching.length > 0) {
                let targetField = matching[0]

                let prevented = this.triggerEventOn(targetField, FrameworkEvents.InvalidField, {
                    field,
                    messages,
                    isFirstInvalidField
                })

                if (isFirstInvalidField) {
                    isFirstInvalidField = false
                    if (prevented === false) {
                        targetField.focus()
                    }
                }
            }
        }
    }

    protected handleErrorMessage (message: string) {
        if (this.triggerEventOn(window, FrameworkEvents.ErrorMessage, {message}) === false) {
            return
        }

        if (message) {
            alert(message)
        }
    }

    protected handleConfirmMessage (message: string) {
        if (this.triggerEventOn(window, FrameworkEvents.ConfirmMessage, {message}) === false) {
            return false
        }

        if (message) {
            return confirm(message)
        }

        return false
    }
}
