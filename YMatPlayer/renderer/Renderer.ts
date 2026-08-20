import {
  LayerProps,
  LayerType,
  PlayerEventMap,
  PlayInfo,
  SvgaSwapItemInfo,
  TransformProps,
  YMatKeyInfo,
  YMatKeyProps,
  YMatPlayProps,
} from '../types'

export default interface Renderer {
  on<E extends keyof PlayerEventMap>(event: E, cb?: PlayerEventMap[E]): PlayerEventMap[E] | undefined

  // 加载ymat资源
  load(props: {
    file: ArrayBufferLike | string
    keys?: YMatKeyProps | YMatKeyProps[]
    mockJson?: YMatPlayProps
    isPreview?: boolean
  }): Promise<
    | {
        keys: YMatKeyInfo[] | undefined
        info: PlayInfo
        previewProps?: YMatPlayProps | undefined
      }
    | undefined
  >

  /**
   * 通过纯json启动ymat播放器，不需要加载.ymat文件
   * @param mockJson 就是配置的json
   */
  loadJson(mockJson: YMatPlayProps): Promise<
    | {
        keys: YMatKeyInfo[] | undefined
        info: PlayInfo
      }
    | undefined
  >

  // 加载Eva(透明通道的mp4文件)
  loadEva(props: {
    file: string | Blob
    effects?: {
      [k: string]: any
      fontColor?: string
      fontSize?: number
      fontStyle?: string
    }
  }): Promise<
    | {
        keys: YMatKeyInfo[] | undefined
        info: PlayInfo
      }
    | undefined
  >

  // 加载Svga
  loadSvga(props: {file: string | Blob; effects?: Record<string, SvgaSwapItemInfo[]>}): Promise<
    | {
        keys: YMatKeyInfo[] | undefined
        info: PlayInfo
      }
    | undefined
  >

  /**
   * 设置特效key
   * @param keys<object> {key: key的名称, type: 'image' | 'video' | 'text', value: 远程url}
   */
  setKeys(keys: YMatKeyProps | YMatKeyProps[]): void

  play(): void

  replay(): void

  pause(): void

  resizeCanvasToDisplaySize(width?: number, height?: number): void

  destroy(): void

  /**
   * 动态插入元素
   * @param layerInfo 就是配置的json里面的tagetComponent
   */
  insertItem(layerInfo: LayerProps): void

  /**
   * 修改元素位移、旋转、透明度
   * @param transformInfo 就是动画配置，可增量覆盖、新增，但是不能删除
   * @param itemId 需要动态修改的图层的id
   */
  transformItem(transformInfo: TransformProps, itemId: number): void

  /**
   * 抓取图层
   */
  grap(x: number, y: number): Promise<{id: number; name: string; type: LayerType} | null>
}
