import {ValidationErrors} from './Request'
import {FrameworkEvents} from './Events'

export default class ValidationHandler {
    public constructor (public e: CustomEvent) {
    }

    public handle () {
        let messages: string[] = []

        const form = this.e.target as HTMLFormElement
        const fields = this.e.detail.fields as ValidationErrors
        const message = this.e.detail.message as string

        let container = form.querySelector('[data-validate-error]')

        // Add inline errors
        for (let fieldName in fields) {
            let fieldMessages = fields[fieldName]
            messages = [...fieldMessages, ...messages]

            const field = form.querySelector(`[data-validate-for="${fieldName}"]`) as HTMLElement
            if (field) {
                if (!field.textContent || field.dataset.emptyMode == 'true') {
                    field.dataset['emptyMode'] = 'true'
                    field.textContent = fieldMessages.join(', ')
                }
                field.classList.add('visible')
            }
        }

        if (!container) {
            container = form.querySelector('[data-validate-error]')
        }

        if (container) {
            const oldMessages = container.querySelectorAll('[data-message]')
            container.classList.add('visible')

            // if data-message objects are available, use them as "templates",
            // clone the element, change the message and remove the old element.
            if (oldMessages.length > 0) {
                const template = oldMessages[0]

                messages.forEach(message => {
                    const clone = template.cloneNode() as HTMLElement
                    clone.textContent = message
                    clone.dataset.message = 'true'
                    if (template.parentNode) {
                        template.parentNode.insertBefore(clone, template.nextSibling)
                    }
                })
                oldMessages.forEach(node => node.remove())
            } else {
                container.textContent = message
            }
        }

        // Suppress the default error handling by preventDefaulting the
        // event once (hence remove the listener right after executing it)
        form.addEventListener(FrameworkEvents.Error, function cb (e) {
            e.preventDefault()
            if (e.currentTarget) {
                e.currentTarget.removeEventListener(e.type, cb)
            }
        })
    }
}
