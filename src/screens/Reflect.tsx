import { useState } from 'react'
import type { JournalTarget } from '../App'
import { PageHeader, Segmented } from '../components/ui'
import JournalScreen from './Journal'
import { GoalsMap } from './ReflectGoals'

export type ReflectView = 'goals' | 'journal'

export default function Reflect({ view: initialView, onView, journal }: { view: ReflectView; onView: (v: ReflectView) => void; journal: JournalTarget | null }) {
  const [view, setViewState] = useState<ReflectView>(initialView)
  const setView = (v: ReflectView) => { setViewState(v); onView(v) }
  return (
    <div>
      <PageHeader en="Reflect" ja="ふりかえり・目標" />
      <div className="space-y-4 px-4">
        <Segmented value={view} onChange={setView} options={[{ value: 'goals', label: '目標' }, { value: 'journal', label: '日記・ふりかえり' }]} />
        {view === 'goals' ? <GoalsMap /> : <JournalScreen key={journal ? journal.kind + journal.periodKey : 'j'} initial={journal} embedded />}
      </div>
    </div>
  )
}
