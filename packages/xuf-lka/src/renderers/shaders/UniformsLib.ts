/**
 * UniformsLib — 可复用的 uniform 分组
 * 当 uniform 在多个 shader 间重复时，按组注册与合并
 */

export type UniformValue<T = unknown> = {value: T}
export type UniformMap = Record<string, UniformValue>

export class UniformsLib {
  private _groups: Map<string, UniformMap> = new Map()

  /** 注册一个 uniform 分组 */
  register(name: string, uniforms: UniformMap): this {
    this._groups.set(name, uniforms)
    return this
  }

  /** 获取分组（返回原始引用，不克隆） */
  get(name: string): UniformMap | undefined {
    return this._groups.get(name)
  }

  /** 是否存在 */
  has(name: string): boolean {
    return this._groups.has(name)
  }

  /**
   * 合并多个 uniform 分组，返回深克隆的安全副本
   * 支持分组名（字符串）或直接传入 UniformMap
   */
  merge(groups: Array<string | UniformMap>): UniformMap {
    const result: UniformMap = {}

    for (const group of groups) {
      let uniforms: UniformMap

      if (typeof group === 'string') {
        const resolved = this._groups.get(group)
        if (resolved === undefined) {
          console.warn(`[LKA] UniformGroupLibrary: Unknown group "${group}"`)
          continue
        }
        uniforms = resolved
      } else {
        uniforms = group
      }

      for (const [key, uniform] of Object.entries(uniforms)) {
        // 后面的分组覆盖前面的同名 uniform
        result[key] = cloneUniform(uniform)
      }
    }

    return result
  }

  /** 克隆一个 UniformMap */
  clone(uniforms: UniformMap): UniformMap {
    const result: UniformMap = {}
    for (const [key, uniform] of Object.entries(uniforms)) {
      result[key] = cloneUniform(uniform)
    }
    return result
  }

  clear(): void {
    this._groups.clear()
  }
}

/** 克隆单个 uniform 值 */
function cloneUniform<T>(uniform: UniformValue<T>): UniformValue<T> {
  const value = uniform.value

  if (value === null || value === undefined) {
    return {value: null} as UniformValue<T>
  }

  // 数组 / TypedArray 克隆
  if (Array.isArray(value)) {
    return {value: [...value]} as UniformValue<T>
  }
  if (ArrayBuffer.isView(value)) {
    return {value: new (value.constructor as any)(value)} as UniformValue<T>
  }

  // 矩阵类（含 elements 属性）
  if (value && typeof value === 'object' && 'elements' in value) {
    return {value: {elements: [...(value as any).elements]}} as UniformValue<T>
  }

  // 原始值（number, boolean）直接返回
  return {value}
}
