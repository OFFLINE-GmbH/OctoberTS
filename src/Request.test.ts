import {Request} from './Request'
import {MockClient} from './HttpClient'

import {GlobalWithFetchMock} from "jest-fetch-mock"
import {FrameworkResponseFields} from './Headers'
import {FrameworkEvents} from './Events'

const customGlobal: GlobalWithFetchMock = global as GlobalWithFetchMock
customGlobal.fetch = require('jest-fetch-mock')
customGlobal.fetchMock = customGlobal.fetch
customGlobal['alert'] = jest.fn()
customGlobal['confirm'] = jest.fn()

describe('Request', () => {

    beforeEach(() => {
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({data: '12345'}))
        document.body.innerHTML =
            `
            <form id="form" data-request-data="parentA: 'true', parentB: 'value'">
                <input id="input" name="input" value="x" />
                <button id="button" data-request-data="childA: 'false', childB: ''" />
            </form>
            <div id="target">existing</div>
            `
    })

    it('invalid handler name is rejected', () => {
        expect(() => {
            new Request(document.querySelector('#button'), 'invalid')
        }).toThrowError(/Invalid handler name/)
    })

    it('closest form is selected', () => {
        const r = new Request(document.querySelector('#button'), 'onEvent')

        expect(r.element).toBe(document.querySelector('#button'))
        expect(r.form).toBe(document.querySelector('#form'))
    })

    it('oc.onBefore event is triggered', () => {
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        let triggered = false
        form.addEventListener('oc.beforeRequest', () => triggered = true)

        r.do()

        expect(triggered).toBe(true)
    })

    it('oc.beforeRequest defaultPrevented stops execution', async () => {
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        form.addEventListener('oc.beforeRequest', e => e.preventDefault())

        expect(await r.do()).toBe(false)
    })

    it('data-request-data is included up the tree', async () => {
        const client = new MockClient()
        const r = new Request(document.querySelector<HTMLElement>('#button'), 'onEvent')
        r.setClient(client)

        expect(await r.do()).toBe(true)
        expect(client.data).toBe('input=x&parentA=true&parentB=value&childA=false&childB=')
    })

    it('includes an elements own value in the request data', async () => {
        // Setup the DOM without a form
        document.body.innerHTML = `<input id="input" name="xyz" value="abc" />`

        const client = new MockClient()
        const r = new Request(document.querySelector<HTMLElement>('#input'), 'onEvent')
        r.setClient(client)

        expect(await r.do()).toBe(true)
        expect(client.data).toBe("xyz=abc")
    })

    it('serializes form data correctly', async () => {
        document.body.innerHTML = `
        <form action="" id="form">        
            <input id="input" name="input" value="text" />
            <textarea name="textarea">value</textarea>
        </form>
        `

        const client = new MockClient()
        const r = new Request(document.querySelector<HTMLElement>('#input'), 'onEvent')
        r.setClient(client)

        expect(await r.do()).toBe(true)
        expect(client.data).toEqual("input=text&textarea=value")
    })

    it('stops execution when beforeUpdate returns false', async () => {
        const client = new MockClient()
        const r = new Request(document.querySelector<HTMLElement>('#input'), 'onEvent', {
            beforeUpdate: () => false
        })
        r.setClient(client)

        expect(await r.do()).toBe(false)
    })

    it('ajaxBeforeUpdate defaultPrevented stops execution', async () => {
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        form.addEventListener('ajaxBeforeUpdate', e => e.preventDefault())

        expect(await r.do()).toBe(false)
    })

    it('triggers flash messages', async () => {
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({
            [FrameworkResponseFields.FlashMessages]: {
                'success': 'message'
            }
        }))

        let check = {}
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent', {
            flash: true,
            handleFlashMessage (message, type) {
                check[type] = message
            }
        })

        expect(await r.do()).toBe(true)
        expect(check).toEqual({success: 'message'})
    })

    it('updates partials', async () => {
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({
            '#target': 'new content'
        }))

        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')
        const target = document.querySelector('#target')

        let ajaxBeforeReplaceFired = false
        let ajaxUpdateFired = false
        target.addEventListener('ajaxBeforeReplace', () => ajaxBeforeReplaceFired = true)
        target.addEventListener('ajaxUpdate', () => ajaxUpdateFired = true)

        expect(await r.do()).toBe(true)
        expect(ajaxBeforeReplaceFired).toBe(true)
        expect(ajaxUpdateFired).toBe(true)
        expect(target.innerHTML).toBe('new content')
    })

    it('updates partials (prepend)', async () => {
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({
            '^#target': 'new content'
        }))

        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')
        const target = document.querySelector('#target')

        let ajaxBeforeReplaceFired = false
        let ajaxUpdateFired = false
        target.addEventListener('ajaxBeforeReplace', () => ajaxBeforeReplaceFired = true)
        target.addEventListener('ajaxUpdate', () => ajaxUpdateFired = true)

        expect(await r.do()).toBe(true)
        expect(ajaxBeforeReplaceFired).toBe(false)
        expect(ajaxUpdateFired).toBe(true)
        expect(target.innerHTML).toBe('new contentexisting')
    })

    it('updates partials (append)', async () => {
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({
            '@#target': 'new content'
        }))

        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')
        const target = document.querySelector('#target')

        let ajaxBeforeReplaceFired = false
        let ajaxUpdateFired = false
        target.addEventListener('ajaxBeforeReplace', () => ajaxBeforeReplaceFired = true)
        target.addEventListener('ajaxUpdate', () => ajaxUpdateFired = true)

        expect(await r.do()).toBe(true)
        expect(ajaxBeforeReplaceFired).toBe(false)
        expect(ajaxUpdateFired).toBe(true)
        expect(target.innerHTML).toBe('existingnew content')
    })

    it('handles redirects', async () => {
        global['window'] = Object.create(window)
        Object.defineProperty(window, 'location', {
            value: {
                href: '/old'
            }
        })
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({
            [FrameworkResponseFields.Redirect]: '/new'
        }))

        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        expect(await r.do()).toBe(true)
        expect(window.location.href).toBe('/new')
    })

    it('handles validation', async () => {
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({
            [FrameworkResponseFields.ErrorMessage]: 'Error!',
            [FrameworkResponseFields.ErrorFields]: {
                input: ['Error 1', 'Error 2'],
                other: []
            }
        }))

        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        let validationEventFired = false
        let ajaxInvalidFieldFired = false
        let ajaxSuccessFired = false
        let ajaxCompleteFired = false
        form.addEventListener(FrameworkEvents.Validation, () => validationEventFired = true)
        form.addEventListener(FrameworkEvents.Success, () => ajaxSuccessFired = true)
        form.addEventListener(FrameworkEvents.Complete, () => ajaxCompleteFired = true)
        document.querySelector('#input').addEventListener(FrameworkEvents.InvalidField, () => ajaxInvalidFieldFired = true)

        expect(await r.do()).toBe(true)
        expect(validationEventFired).toBe(true)
        expect(ajaxInvalidFieldFired).toBe(true)
        expect(ajaxSuccessFired).toBe(true)
        expect(ajaxCompleteFired).toBe(true)
    })

    it('handles errors', async () => {
        const errorObj = {
            [FrameworkResponseFields.ErrorMessage]: 'Error!',
            [FrameworkResponseFields.ErrorFields]: {
                input: ['Error 1', 'Error 2'],
                other: []
            }
        }
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify(errorObj), {status: 406})

        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        let ajaxErrorFired = false
        let ajaxErrorMessageFired = false
        let ajaxCompleteFired = false
        form.addEventListener(FrameworkEvents.Error, () => ajaxErrorFired = true)
        form.addEventListener(FrameworkEvents.Complete, () => ajaxCompleteFired = true)
        window.addEventListener(FrameworkEvents.ErrorMessage, () => ajaxErrorMessageFired = true)

        expect(await r.do()).toBe(false)
        expect(form.dataset.error).toBe('Error!')
        expect(ajaxErrorFired).toBe(true)
        expect(ajaxErrorMessageFired).toBe(true)
        expect(ajaxCompleteFired).toBe(true)
        expect(window['alert']).toBeCalledTimes(1)
    })

    it('handles the confirm message', async () => {
        customGlobal['confirm'].mockRestore()
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent', {
            confirm: "Sure?",
        })

        let ajaxConfirmMessageFired = false
        window.addEventListener(FrameworkEvents.ConfirmMessage, () => ajaxConfirmMessageFired = true)

        expect(await r.do()).toBe(false)
        expect(window['confirm']).toBeCalledTimes(1)
    })

    it('handles custom confirm messages', async () => {
        customGlobal['confirm'].mockRestore()
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent', {
            confirm: "Sure?",
        })

        window.addEventListener(FrameworkEvents.ConfirmMessage, e => e.preventDefault())

        expect(await r.do()).toBe(false)
        expect(window['confirm']).toBeCalledTimes(0)
    })

    it('triggers ajax events before request is sent', async () => {
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        let ajaxBeforeSendFired = false
        let ajaxPromiseFired = false
        window.addEventListener(FrameworkEvents.BeforeSend, () => ajaxBeforeSendFired = true)
        form.addEventListener(FrameworkEvents.Promise, () => ajaxPromiseFired = true)

        expect(await r.do()).toBe(true)
        expect(ajaxBeforeSendFired).toBe(true)
        expect(ajaxPromiseFired).toBe(true)
    })

    it('triggers ajax events on fail', async () => {
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({
            [FrameworkResponseFields.ErrorMessage]: 'Error!',
            [FrameworkResponseFields.ErrorFields]: {
                input: ['Error 1', 'Error 2'],
                other: []
            }
        }), {status: 406})
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        let ajaxFailFired = false
        let ajaxAlwaysFired = false
        form.addEventListener(FrameworkEvents.Fail, () => ajaxFailFired = true)
        form.addEventListener(FrameworkEvents.Always, () => ajaxAlwaysFired = true)

        expect(await r.do()).toBe(false)
        expect(ajaxFailFired).toBe(true)
        expect(ajaxAlwaysFired).toBe(true)
    })

    it('triggers ajax events on success', async () => {
        customGlobal.fetch.resetMocks()
        customGlobal.fetch.mockResponseOnce(JSON.stringify({
          success: true
        }))
        const form = document.querySelector<HTMLElement>('#form')
        const r = new Request(form, 'onEvent')

        let ajaxDoneFired = false
        let ajaxAlwaysFired = false
        form.addEventListener(FrameworkEvents.Done, () => ajaxDoneFired = true)
        form.addEventListener(FrameworkEvents.Always, () => ajaxAlwaysFired = true)

        expect(await r.do()).toBe(true)
        expect(ajaxDoneFired).toBe(true)
        expect(ajaxAlwaysFired).toBe(true)
    })
})
