/**
 * ShaderChunkRegistry — GLSL 代码片段注册表
 * 提供 #include <name> 解析的源码查找，支持循环依赖检测
 */
export class ShaderChunkRegistry {
  private _chunks: Map<string, string> = new Map()

  /** 注册一个 GLSL 代码片段 */
  register(name: string, code: string): this {
    this._chunks.set(name, code)
    return this
  }

  /** 批量注册 */
  registerAll(chunks: Record<string, string>): this {
    for (const [name, code] of Object.entries(chunks)) {
      this._chunks.set(name, code)
    }
    return this
  }

  /** 获取片段 */
  get(name: string): string | undefined {
    return this._chunks.get(name)
  }

  /** 是否存在 */
  has(name: string): boolean {
    return this._chunks.has(name)
  }

  /** 所有已注册的片段名 */
  names(): string[] {
    return Array.from(this._chunks.keys())
  }

  /** 移除片段 */
  remove(name: string): boolean {
    return this._chunks.delete(name)
  }

  /** 清空所有 */
  clear(): void {
    this._chunks.clear()
  }
}

/**
 * IncludeResolver — 递归解析 #include <name> 指令
 * 支持循环依赖检测和缺失片段报告
 */
const includePattern = /^[ \t]*#include +<([\w\d./]+)>/gm

export class IncludeResolver {
  constructor(private _registry: ShaderChunkRegistry) {}

  /**
   * 递归解析 shader 源码中的 #include 指令
   * @param source 待解析的源码
   * @param includeStack 用于检测循环依赖的调用栈（内部使用）
   */
  resolve(source: string, includeStack: string[] = []): string {
    return source.replace(includePattern, (match, chunkName) => {
      // 循环依赖检测
      if (includeStack.includes(chunkName)) {
        console.error(
          `[LKA] IncludeResolver: Circular dependency detected — ${[...includeStack, chunkName].join(' → ')}`,
        )
        return match
      }

      const chunk = this._registry.get(chunkName)
      if (chunk === undefined) {
        console.warn(`[LKA] IncludeResolver: Unknown chunk <${chunkName}>`)
        return match
      }

      // 递归解析，传递调用栈
      return this.resolve(chunk, [...includeStack, chunkName])
    })
  }
}
