import React, { useState } from 'react'
import { BarChart3, List, Calendar, Receipt, Upload, Settings } from 'lucide-react'
import BudgetOverview from './BudgetOverview'
import BudgetTransactions from './BudgetTransactions'
import MonthlyBudget from './MonthlyBudget'
import BillsSummary from './BillsSummary'
import StatementImport from './StatementImport'
import BudgetSettings from './BudgetSettings'

const SUB_TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'transactions', label: 'Transactions', icon: List },
  { key: 'monthly', label: 'Monthly Budget', icon: Calendar },
  { key: 'bills', label: 'Bills', icon: Receipt },
  { key: 'import', label: 'Import', icon: Upload },
  { key: 'settings', label: 'Settings', icon: Settings },
]

function BudgetTab() {
  const [activeSubTab, setActiveSubTab] = useState('overview')

  return (
    <div className="space-y-4 pb-20">
      {/* Sub-navigation */}
      <div className="flex gap-2 flex-wrap">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeSubTab === tab.key
                ? 'bg-farm-green text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'overview' && <BudgetOverview />}
      {activeSubTab === 'transactions' && <BudgetTransactions />}
      {activeSubTab === 'monthly' && <MonthlyBudget />}
      {activeSubTab === 'bills' && <BillsSummary />}
      {activeSubTab === 'import' && <StatementImport />}
      {activeSubTab === 'settings' && <BudgetSettings />}
    </div>
  )
}

export default BudgetTab
