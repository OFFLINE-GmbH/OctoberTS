import {StringDictionary} from './utils'

export default interface HttpClient {
    fetch (url: string, options: object): Promise<RequestResult>
}

export class RequestResult {

    public success: boolean = false
    public response!: Response | undefined
    public data!: {[key: string]: any}
    public error!: Error | undefined
    public textStatus!: string

    public static success (response: Response, data: object): RequestResult {
        const r = new RequestResult()
        r.success = response.ok
        r.response = response
        r.textStatus = response.statusText
        r.data = data
        return r
    }

    public static error (error?: Error, response?: Response): RequestResult {
        const r = new RequestResult()
        r.success = false
        r.error = error
        r.response = response
        return r
    }

}

export class DefaultClient implements HttpClient {
    public async fetch (url: string, options: RequestOptions): Promise<RequestResult> {
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: options.data,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    ...options.headers
                },

            })

            try {
                const data = await response.json()
                return RequestResult.success(response, data)
            } catch (e) {
                return RequestResult.error(undefined, response)
            }
        } catch (e) {
            return RequestResult.error(e)
        }
    }
}

export interface RequestOptions {
    data: FormData
    headers: StringDictionary
}

export class MockClient implements HttpClient {
    public url: string = ''
    public options!: RequestOptions
    public data: string = ''

    public fetch (url: string, options: RequestOptions): Promise<RequestResult> {
        this.url = url
        this.options = options

        this.data = transformData(options.data)

        return new Promise((resolve => {
            resolve(RequestResult.success(new Response(), {}))
        }))
    }
}

function transformData (data: FormData): string {
    const parts: string[] = []
    data.forEach((value, key) => {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value.toString()))
    })
    return parts.join('&')
}
