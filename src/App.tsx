import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useGoods } from './hooks/useGoods'
import { DetailPage } from './pages/DetailPage'
import { EntryPage } from './pages/EntryPage'
import { HomePage } from './pages/HomePage'
import { StatsPage } from './pages/StatsPage'

export default function App() {
  const {
    entries,
    loading,
    stats,
    setPeriod,
    setCustom,
    saveEntry,
    removeEntry,
  } = useGoods()

  if (loading) {
    return <div className="loading">加载中…</div>
  }

  return (
    <HashRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomePage entries={entries} />} />
          <Route
            path="/entry"
            element={<EntryPage entries={entries} onSave={saveEntry} />}
          />
          <Route
            path="/edit/:id"
            element={<EntryPage entries={entries} onSave={saveEntry} />}
          />
          <Route
            path="/detail/:id"
            element={<DetailPage entries={entries} onDelete={removeEntry} />}
          />
          <Route
            path="/stats"
            element={
              <StatsPage
                stats={stats}
                entries={entries}
                onPeriod={setPeriod}
                onCustomRange={setCustom}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
