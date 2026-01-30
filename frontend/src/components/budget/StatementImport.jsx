import React, { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle2, AlertTriangle, X, Check } from 'lucide-react'
import { importChaseStatement, confirmBudgetImport, getBudgetAccounts, getBudgetCategories } from '../../services/api'

function StatementImport() {
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [statementYear, setStatementYear] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  // Load accounts and categories on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [accRes, catRes] = await Promise.all([getBudgetAccounts(), getBudgetCategories()])
        setAccounts(accRes.data || [])
        setCategories(catRes.data || [])
        if (accRes.data?.length > 0) {
          setSelectedAccountId(String(accRes.data[0].id))
        }
      } catch (err) {
        console.error('Failed to load accounts:', err)
      }
    }
    loadData()
  }, [])

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are accepted')
        return
      }
      setFile(selected)
      setError('')
      setPreview(null)
      setResult(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      if (!dropped.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are accepted')
        return
      }
      setFile(dropped)
      setError('')
      setPreview(null)
      setResult(null)
    }
  }

  const handleParse = async () => {
    if (!file || !selectedAccountId) return
    setParsing(true)
    setError('')
    try {
      const res = await importChaseStatement(
        file,
        parseInt(selectedAccountId),
        statementYear ? parseInt(statementYear) : null
      )
      setPreview(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse statement')
    } finally {
      setParsing(false)
    }
  }

  const handleCategoryChange = (idx, categoryId) => {
    setPreview(prev => {
      const txns = [...prev.transactions]
      txns[idx] = {
        ...txns[idx],
        suggested_category_id: categoryId ? parseInt(categoryId) : null,
        suggested_category_name: categoryId
          ? categories.find(c => c.id === parseInt(categoryId))?.name || null
          : null,
      }
      return { ...prev, transactions: txns }
    })
  }

  const handleConfirmImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const transactions = preview.transactions
        .filter(t => !t.is_duplicate)
        .map(t => ({
          date: t.date,
          description: t.description,
          original_description: t.original_description,
          amount: t.amount,
          transaction_type: t.transaction_type,
          import_hash: t.import_hash,
          category_id: t.suggested_category_id,
          account_id: parseInt(selectedAccountId),
        }))

      const res = await confirmBudgetImport({ transactions })
      setResult(res.data)
      setPreview(null)
      setFile(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to import transactions')
    } finally {
      setImporting(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const nonDuplicateCount = preview
    ? preview.transactions.filter(t => !t.is_duplicate).length
    : 0

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          Import Statement
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <option value="">Select Account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Statement Year (optional)</label>
            <input
              type="number"
              placeholder="Auto-detect"
              value={statementYear}
              onChange={(e) => setStatementYear(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
              min={2020}
              max={2030}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Format</label>
            <div className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Chase PDF
            </div>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-gray-500 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{file.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setResult(null) }}
                className="p-0.5 rounded hover:bg-gray-700"
              >
                <X className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>
          ) : (
            <div>
              <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Drop a PDF statement here or click to browse
              </p>
            </div>
          )}
        </div>

        {file && !preview && (
          <button
            onClick={handleParse}
            disabled={parsing || !selectedAccountId}
            className="mt-3 w-full py-2 bg-farm-green text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {parsing ? 'Parsing...' : 'Parse Statement'}
          </button>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-red-900/30 border border-red-700/50">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}
      </div>

      {/* Import Result */}
      {result && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Import Complete</h4>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-green-400">{result.imported}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Imported</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">{result.skipped_duplicates}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Duplicates Skipped</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">{result.errors}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Errors</div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Table */}
      {preview && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div>
              <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Preview ({preview.total_parsed} transactions)
              </h4>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {preview.categorized} auto-categorized, {preview.duplicates} duplicates
              </p>
            </div>
            <button
              onClick={handleConfirmImport}
              disabled={importing || nonDuplicateCount === 0}
              className="px-4 py-1.5 bg-farm-green text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${nonDuplicateCount} Transactions`}
            </button>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[80px_1fr_140px_90px_70px] gap-2 px-4 py-2 border-b border-gray-700 sticky top-0" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Date</span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Description</span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Category</span>
              <span className="text-xs font-medium text-right" style={{ color: 'var(--color-text-muted)' }}>Amount</span>
              <span className="text-xs font-medium text-center" style={{ color: 'var(--color-text-muted)' }}>Status</span>
            </div>

            {preview.transactions.map((txn, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-1 md:grid-cols-[80px_1fr_140px_90px_70px] gap-1 md:gap-2 px-4 py-2 border-b border-gray-800 ${
                  txn.is_duplicate ? 'opacity-40' : ''
                }`}
              >
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{txn.date}</span>
                <span className="text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>{txn.description}</span>
                <select
                  value={txn.suggested_category_id || ''}
                  onChange={(e) => handleCategoryChange(idx, e.target.value)}
                  disabled={txn.is_duplicate}
                  className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <option value="">Uncategorized</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span className={`text-xs text-right ${txn.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(txn.amount)}
                </span>
                <div className="flex justify-center">
                  {txn.is_duplicate ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400">Dup</span>
                  ) : txn.suggested_category_id ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default StatementImport
