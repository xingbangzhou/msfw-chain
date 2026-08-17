export enum LogType {
  Log,
  Warn,
  Error,
}

export interface LogHandler {
  (type: LogType, name: string, tag?: string, ...args: any[]): void
}

export default class Logger {
  constructor(tag?: string) {
    this.tag = tag
  }

  protected tag?: string

  debug?: boolean
  handler?: LogHandler

  log(name: string, ...args: any[]) {
    this.debug &&
      console.log(`%c[Log][${name}]%c[${this.timeStr()}]${this.tag || ''}`, `color: #c678dd`, `color: gray`, ...args)

    this.handler?.(LogType.Log, name, this.tag, ...args)
  }

  warn(name: string, ...args: any[]) {
    this.debug &&
      console.warn(`%c[Warn][${name}]%c[${this.timeStr()}]${this.tag || ''}`, `color: #953800`, `color: gray`, ...args)

    this.handler?.(LogType.Warn, name, this.tag, ...args)
  }

  error(name: string, ...args: any[]) {
    this.debug &&
      console.error(`%c[Error][${name}]%c[${this.timeStr()}]${this.tag || ''}`, `color: red`, `color: gray`, ...args)

    this.handler?.(LogType.Error, name, this.tag, ...args)
  }

  private timeStr() {
    const dt = new Date()
    return `${dt.getHours()}:${dt.getMinutes()}:${dt.getSeconds()}.${dt.getMilliseconds()}`
  }
}
