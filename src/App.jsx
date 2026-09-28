import { useState } from 'react'
import LandingPage from './components/LandingPage'
import SoftwareTicketPage from './components/SoftwareTicketPage'
import RenderPage from './components/RenderPage'
import AssetsLibraryPage from './components/AssetsLibraryPage'

export default function App() {
  const [page, setPage] = useState('home')

  if (page === 'software') {
    return <SoftwareTicketPage onBack={() => setPage('home')} />
  }

  if (page === 'render') {
    return <RenderPage onBack={() => setPage('home')} />
  }

  if (page === 'assets') {
    return <AssetsLibraryPage onBack={() => setPage('home')} />
  }

  return <LandingPage onNavigate={setPage} />
}
