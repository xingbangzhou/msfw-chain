import {memo, useEffect, useRef} from 'react'
import * as styles from './index.module.scss'
import {WebGLRenderer} from '@msfw/ly3d'

const Ly3dView = memo(function Ly3dView() {
  const rootRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<WebGLRenderer>()

  useEffect(() => {
    const renderer = new WebGLRenderer()
    // TODO: Init

    rendererRef.current = renderer
  }, [])

  return <div ref={rootRef} className={styles.ly3dViewRoot}></div>
})

export default Ly3dView
