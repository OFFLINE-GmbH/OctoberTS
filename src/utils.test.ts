import {extractPartials, paramToObj} from './utils'

describe('utils', () => {

    it('extracts partials', () => {
        const out = extractPartials({'partial::one': '.selector', 'partial::two': '.selector'})
        expect(out).toBe('partial::one&partial::two')
    })

    it('converts params to objects', () => {
        const expected = {
            propA: 'value, .selector',
            propB: true,
            propC: '',
        }
        const out = paramToObj(`propA: 'value, .selector', propB: 'true', propC: ''`)
        expect(out).toEqual(expected)
    })

    it('passes valid param objects along', () => {
        const expected = {
            propA: 'value',
            propB: true
        }
        // Since the ' are missing around true, this won't be matched
        // by the RegEx but it is a JSONable object that gets returned directly.
        const out = paramToObj(`{"propA": 'value', "propB": true}`)
        expect(out).toEqual(expected)
    })

    it('throws on invalid param input', () => {
        expect(() => {
            const out = paramToObj(`invalid`)
            console.log(out)
        }).toThrowError(/turn the given param into JS object/)
    })

})
