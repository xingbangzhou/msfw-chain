export function uniformUrl(url: string) {
  return url.replace(/^http[s]?:/i, window.location.protocol)
}
