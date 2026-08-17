export interface XufLinkFn {
  (on: boolean, cl: string): void
}

export interface XufInvokeFn {
  (...args: any[]): any
}

export interface XufSlotFn {
  (...args: any[]): void
}

export interface XufEventListener {
  (...args: any[]): void
}

export interface XufExtHandler {
  (...args: any[]): Promise<any>
}

export interface XufService {
  // 服务ID
  readonly clazz: string
  // 导出接口
  invoke(name: string, ...args: any[]): Promise<any>
  // 监听信号
  connectSignal(signal: string, slot: XufSlotFn): unknown
  // 取消监听信号
  disconnectSignal(signal: string, slot: XufSlotFn): unknown
}

export interface XufContextFuncs {
  /**
   * 上下文日志
   * @param name
   * @param args
   */
  log(name: string, ...args: any[]): void
  /**
   * 服务注册与反注册
   * @param service 服务类对象
   */
  register(service: XufService): void
  unregister(service: XufService): void
  /**
   * 服务监听与反监听
   * @param clazz 服务名
   * @param linker 处理函数
   */
  link(clazz: string, linker: XufLinkFn): void
  unlink(clazz: string, linker: XufLinkFn): void
  /**
   * 服务调用
   * @param clazz 服务名
   * @param name 函数名
   * @param args 参数列表
   */
  invoke(clazz: string, name: string, ...args: any[]): Promise<any>
  /**
   * 服务信号连接与反连接
   * @param clazz 服务名
   * @param signal 信号
   * @param slot 处理函数
   */
  connectSignal(clazz: string, signal: string, slot: XufSlotFn): void
  disconnectSignal(clazz: string, signal: string, slot: XufSlotFn): void
  /**
   * 全局时间分发
   * @param event 时间名
   * @param listener 监听函数
   */
  addEventListener(event: string, listener: XufEventListener): void
  removeEventListener(event: string, listener: XufEventListener): void
  postEvent(event: string, ...args: any[]): void
  /**
   * 模块上下文扩展接口
   */
  setExtHandler(name: string, handler: XufExtHandler): void
  invokeExt(name: string, ...args: any[]): Promise<any>
  onExtEvent(event: string, listener: XufEventListener): void
  offExtEvent(event: string, listener: XufEventListener): void
  emitExtEvent(event: string, ...args: any[]): void
}
