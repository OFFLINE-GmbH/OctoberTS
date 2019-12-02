export enum FrameworkHeaders {
    Handler = 'X-OCTOBER-REQUEST-HANDLER',
    Partials = 'X-OCTOBER-REQUEST-PARTIALS',
    Flash = 'X-OCTOBER-REQUEST-FLASH',
}

export enum FrameworkResponseFields {
    ErrorMessage = "X_OCTOBER_ERROR_MESSAGE",
    ErrorFields = "X_OCTOBER_ERROR_FIELDS",
    Redirect = 'X_OCTOBER_REDIRECT',
    FlashMessages = 'X_OCTOBER_FLASH_MESSAGES',
}

export interface Headers {
    [key: string]: string
}
