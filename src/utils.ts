import {UpdateOption} from './Request'

export interface StringDictionary {
    [key: string]: string
}

export function error (message: string): Error {
    return new Error('[OctoberTS] ' + message)
}

export function logError (...messages: any[]) {
    console.error('[OctoberTS]', messages)
}

// extractPartial turns a update object into a query string containing partial names
export function extractPartials (update: UpdateOption): string {
    const result = []

    for (var partial in update) {
        result.push(partial)
    }

    return result.join('&')
}

// paramToObj turns a parameter string into a proper JS object.
export function paramToObj (param: string | undefined): object {
    if (!param) {
        return {}
    }

    param = param.replace(/\'/g, '"')

    try {
        // Try to parse the string as JSON, return if possible.
        return JSON.parse(param)
    } catch (e) {
        // Carry on...
    }

    // Match all key:value pairs from the input string to build a proper object.
    const regex = /,?\s*([a-z0-9_]+?)\s*:\s*[\'\"]\s*,?\s*(.*?)[\'\"]/gmi
    const ret: { [key: string]: string } = {}

    let match
    while ((match = regex.exec(param)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (match.index === regex.lastIndex) {
            regex.lastIndex ++
        }

        let key: string
        match.forEach((match, index) => {
            if (index === 0) {
                return
            } else if (index === 1) {
                key = match
            } else if (index === 2) {
                ret[key] = convertType(match)
            }
        })
    }

    // If we had input but the returned object is empty,
    // we were unable to parse it correctly.
    if (param.length > 0 && JSON.stringify(ret) === '{}') {
        throw error(
            `Failed to turn the given param into JS object. Make sure to enclose the values
            in quotes or provide a valid JSON object. Input was: ${param}`
        )
    }

    return ret
}

// converType converts common string representations of types to a native type.
function convertType (input: any): any {
    switch (input.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "1":
            return true
        case "false":
        case "no":
        case "0":
        case null:
            return false
        case !isNaN(input):
            return Number(input)
        default:
            return input
    }
}

// getParents returns all matching parents up the tree.
export function getParents (elem: HTMLElement | null, selector: string): HTMLElement[] {
    if (!elem) {
        return []
    }

    const parents = []
    for (; elem; elem = elem.parentElement) {
        if (elem.matches(selector)) {
            parents.push(elem)
        }
    }
    return parents
}

// isInput checks if a given element is a HTML input element.
export function isInput (element: HTMLElement) {
    return [
        'input', 'textarea', 'select'
    ].includes(element.tagName.toLowerCase())
}
