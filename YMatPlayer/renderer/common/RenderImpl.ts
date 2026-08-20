import {YMatKeyProps} from '../../types'

export default interface RenderImpl {
  isReady(): boolean

  setKeys(keys: YMatKeyProps | YMatKeyProps[]): Promise<boolean | void>

  onResize(width: number, height: number): void

  render(): void

  destroy(): void

  checkReset(): void
}
