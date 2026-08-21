import {LkaPlayer, FillMode} from '@xuf/lka'
import demoUrl from './mocks/demo.lka?url'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

const stage = $('stage')
const playerBox = $('player')
const dropHint = $('dropHint')

const btnOpen = $('btnOpen') as HTMLButtonElement
const fileInput = $('file') as HTMLInputElement
const btnPlay = $('btnPlay') as HTMLButtonElement
const btnPause = $('btnPause') as HTMLButtonElement
const btnReplay = $('btnReplay') as HTMLButtonElement
const chkLoop = $('chkLoop') as HTMLInputElement
const chkChecker = $('chkChecker') as HTMLInputElement
const bgColor = $('bgColor') as HTMLInputElement

const seek = $('seek') as HTMLInputElement
const frameLabel = $('frameLabel')
const meta = $('meta')

let player: LkaPlayer | null = null
let totalFrames = 0

function setControlsEnabled(enabled: boolean) {
  btnPlay.disabled = !enabled
  btnPause.disabled = !enabled
  btnReplay.disabled = !enabled
  seek.disabled = !enabled
}

async function loadFile(file: File | ArrayBuffer) {
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer()

  // 重新创建 player 以应用当前「循环」设置
  player?.dispose()
  playerBox.innerHTML = ''
  player = new LkaPlayer(playerBox, {loop: chkLoop.checked, autoPlay: true, fillMode: FillMode.LongSide})

  const info = await player.load({file: buffer})
  if (!info) {
    dropHint.textContent = '加载失败：不是有效的 .lka 文件'
    dropHint.style.display = 'flex'
    setControlsEnabled(false)
    return
  }

  dropHint.style.display = 'none'
  setControlsEnabled(true)

  totalFrames = info.info.frames || 0
  seek.max = String(Math.max(0, totalFrames - 1))
  seek.value = '0'
  frameLabel.textContent = `0 / ${totalFrames}`

  meta.innerHTML =
    `尺寸: <b>${info.info.width} × ${info.info.height}</b><br />` +
    `时长: <b>${info.info.duration}s</b><br />` +
    `帧率: <b>${(info.info as any).frameRate ?? '-'}</b><br />` +
    `总帧: <b>${totalFrames}</b>`
}

// —— 交互 ——
btnOpen.onclick = () => fileInput.click()
fileInput.onchange = () => {
  const f = fileInput.files?.[0]
  if (f) loadFile(f)
}

btnPlay.onclick = () => player?.play()
btnPause.onclick = () => player?.pause()
btnReplay.onclick = () => {
  player?.replay()
}
seek.oninput = () => {
  const frameId = Number(seek.value)
  frameLabel.textContent = `${frameId} / ${totalFrames}`
  player?.pause()
  player?.seek(frameId)
}

// 背景 & 棋盘格
chkChecker.onchange = () => stage.classList.toggle('checker', chkChecker.checked)
bgColor.oninput = () => {
  stage.style.backgroundColor = bgColor.value
}

// 拖拽加载
;['dragenter', 'dragover'].forEach(ev =>
  stage.addEventListener(ev, e => {
    e.preventDefault()
    stage.classList.add('dragover')
  }),
)
;['dragleave', 'drop'].forEach(ev =>
  stage.addEventListener(ev, e => {
    e.preventDefault()
    stage.classList.remove('dragover')
  }),
)
stage.addEventListener('drop', e => {
  const f = (e as DragEvent).dataTransfer?.files?.[0]
  if (f) loadFile(f)
})

// 尺寸自适应
window.addEventListener('resize', () => player?.resizeCanvasToDisplaySize())

// 默认加载并播放 demo.lka
;(async () => {
  try {
    const res = await fetch(demoUrl)
    const buffer = await res.arrayBuffer()
    await loadFile(buffer)
  } catch (e) {
    console.warn('默认 demo.lka 加载失败:', e)
  }
})()
