const nav = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
export const ANDROID = /android|adr/i.test(nav)
export const MOBILE = /(mobile)/i.test(nav) && ANDROID
export const MACOS = !(/(mobile)/i.test(nav) || MOBILE) && /Mac OS X/i.test(nav)
export const IPHONE = /(iphone|ipad|ipod)/i.test(nav)
export const IOS_VERSION = Number((nav.match(/OS (\d+)[._]/i) || [])[1] || 0)
export const IOS16_PLUS = IPHONE && IOS_VERSION >= 16
export const SAFARI_OR_IOS_WEBVIEW = /^((?!chrome|android).)*safari/i.test(nav) || IPHONE
export const IS_CHROME_83 = /Chrome\/83/.test(navigator.userAgent)
export const IS_ANDROID_LOW_VERSION = ANDROID && /Android [4-8]/.test(navigator.userAgent)
