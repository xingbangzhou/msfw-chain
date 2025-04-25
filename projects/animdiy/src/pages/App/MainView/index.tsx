import {memo} from 'react'
import * as styles from './index.module.scss'

const MainView = memo(function MainView() {
  return <div className={styles.mainView}></div>
})

export default MainView
