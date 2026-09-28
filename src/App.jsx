import { useState } from 'react'
import LandingPage from './components/LandingPage'
import SoftwareTicketPage from './components/SoftwareTicketPage'

export default function App() {
  const [page, setPage] = useState('home')

  if (page === 'software') {
    return <SoftwareTicketPage onBack={() => setPage('home')} />
  }

  return <LandingPage onNavigate={setPage} />
}
