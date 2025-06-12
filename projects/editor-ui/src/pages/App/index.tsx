import './index.scss'
import TitleBar from './TitleBar'
import {memo, useEffect} from 'react'
import LeftBar from './LeftBar'
import MainView from './MainView'
import bizCore from 'src/core/bizCore'
import { MP4Demuxer } from 'src/core/media/mp4'

const demuxer = new MP4Demuxer()
demuxer.loadUrl('https://lxcode.bs2cdn.yy.com/bc59079c-8fee-42a8-80b6-3e60afa7caad.mp4')

const App = memo(function App() {
  useEffect(() => {
    bizCore.init()
  }, [])

  return (
    <div className="app">
      <TitleBar />
      <div className="mainArea">
        <LeftBar />
        <MainView />
      </div>
    </div>
  )
})

export default App
