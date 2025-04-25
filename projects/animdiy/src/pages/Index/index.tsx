import {memo} from 'react'
import {HashRouter as Router, Route, Routes} from 'react-router-dom'
import App from '../App'
import Login from '../Login'

const Index = memo(function Index() {
  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<App />}></Route>
        <Route path="/login" element={<Login />}></Route>
      </Routes>
    </Router>
  )
})

export default Index
