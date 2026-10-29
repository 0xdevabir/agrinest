import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Climate } from './pages/Climate'
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
        <Route path="/guardian/history" element={<Guardian />} />
        <Route path="/guardian/treatment" element={<Guardian />} />
        <Route path="/precision" element={<Precision />} />
        <Route path="/precision/irrigation" element={<Precision />} />
        <Route path="/precision/fertilizer" element={<Precision />} />
        <Route path="/precision/stage" element={<Precision />} />
        <Route path="/climate" element={<Climate />} />
        <Route path="/climate/variety" element={<Climate />} />
        <Route path="/climate/outlook" element={<Climate />} />
        <Route path="/yield" element={<YieldPage />} />
        <Route path="/yield/drivers" element={<YieldPage />} />
        <Route path="/yield/baseline" element={<YieldPage />} />
        <Route path="/market" element={<Market />} />
        <Route path="/market/hint" element={<Market />} />
        <Route path="/market/listings" element={<Market />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
