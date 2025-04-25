import ReactDOM from 'react-dom/client'
import App from './pages/App'

const root = document.querySelector('#root')

root ? ReactDOM.createRoot(root).render(<App />) : console.error('Bootstrap Has Error: No Root Div')
