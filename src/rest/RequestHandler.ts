import * as Constants from "../util/Constants";
import {RequestOptions, Response} from "../types";

export class RequestHandler {
    rejectIfNotValid: boolean = true;
    rateLimit = 10
    readonly #apiToken: string;

    constructor(apiToken: string) {
        this.#apiToken = apiToken
    }

    public async request<T>(path: string, options: RequestOptions) {
        return this.exec<T>(path, options)
    }

    private async exec<T>(path: string, options: RequestOptions, retries = 0): Promise<Response<T>> {
        try {
            let contentType = 'application/json';
            if(options.additionalHeaders?.["content-type"]){
                contentType = options.additionalHeaders["content-type"];
                delete options.additionalHeaders["content-type"];
            }
            const headers = {
                'Authorization': `Bearer ${this.#apiToken}`,
                'Content-Type': contentType,
                ...options.additionalHeaders
            }
            const res = await fetch(`${Constants.APIBaseURL}${path}`, {
                method: options.method, headers: headers,
                body: options.method !== 'GET' ? options.body : undefined
            })

            if (res.status === 504 && retries < this.rateLimit) {
                return this.exec<T>(path, options, ++retries)
            }

            if (res.status === 204) return {data: {} as unknown as T, status: res.status, maxAge: 0, path, ok: true}

            const data = await res.json()
            const isOk = res.status === 200 || res.status === 201

            if (!isOk) throw new Error(`non valid: ${res.status} ${JSON.stringify(data)}`)

            return {data, status: res.status, maxAge: 0, path, ok: isOk}
            //https://developer.moneybird.com/#responses
        } catch (e) {
            // fetch error timeout and rate-limit not reached yet -> Try again
            if (e instanceof Error && e.message === 'fetch failed' && retries < this.rateLimit) {
                return this.exec<T>(path, options, ++retries)
            }
            if (this.rejectIfNotValid) throw e
            return {data: {message: (e as Error).message} as unknown as T, maxAge: 0, status: 500, path, ok: false};
        }
    }
}