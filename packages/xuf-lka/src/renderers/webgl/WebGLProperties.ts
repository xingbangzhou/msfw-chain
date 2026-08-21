/**
 * WebGLProperties — 每个对象的 GPU 侧私有状态
 *
 * 使用 WeakMap 存储 Texture / Source 的 GPU 状态（WebGLTexture 句柄、
 * 已上传版本号、缓存 key 等），对象被回收时状态自动清理。
 */
export class WebGLProperties {
  private properties = new WeakMap<object, Record<string, unknown>>()

  has(object: object): boolean {
    return this.properties.has(object)
  }

  get<T extends Record<string, unknown> = Record<string, unknown>>(object: object): T {
    let map = this.properties.get(object)

    if (map === undefined) {
      map = {}
      this.properties.set(object, map)
    }

    return map as T
  }

  remove(object: object): void {
    this.properties.delete(object)
  }

  dispose() {
    this.properties = new WeakMap()
  }
}
