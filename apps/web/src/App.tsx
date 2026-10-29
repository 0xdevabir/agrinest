import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Guardian } from './pages/Guardian'
import { Home } from './pages/Home'
import { Market } from './pages/Market'
import { Onboarding } from './pages/Onboarding'
import { Precision } from './pages/Precision'
import { YieldPage } from './pages/YieldPage'
import { loadSession } from './api'

function RequireSession({ children }: { children: React.ReactNode }) {
  const { fieldId } = loadSession()
  if (!fieldId) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        element={
          <RequireSession>
            <Layout />
          </RequireSession>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/guardian" element={<Guardian />} />
        <Route path="/precision" element={<Precision />} />
        <Route path="/yield" element={<YieldPage />} />
        <Route path="/market" element={<Market />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
