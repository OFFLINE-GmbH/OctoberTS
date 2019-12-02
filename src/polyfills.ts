import 'core-js/features/array'
import 'core-js/features/promise'
import 'core-js/features/weak-map'
import 'core-js/web/dom-collections'
import 'formdata-polyfill'
import 'whatwg-fetch'

if (!Element.prototype.matches) {
    Element.prototype.matches = (Element.prototype as any).msMatchesSelector ||
        Element.prototype.webkitMatchesSelector
}

if (!Element.prototype.closest) {
    Element.prototype.closest = function (s) {
        let el: any = this

        do {
            if (el.matches(s)) return el
            el = el.parentElement || el.parentNode
        } while (el !== null && el.nodeType === 1)
        return null
    }
}

// Custom Events
(function () {

    if (typeof window.CustomEvent === "function") return false

    function CustomEvent (event: string, params: any) {
        params = params || {bubbles: false, cancelable: false, detail: null}
        var evt = document.createEvent('CustomEvent')
        evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail)
        return evt
    }

    window.CustomEvent = CustomEvent
})()
