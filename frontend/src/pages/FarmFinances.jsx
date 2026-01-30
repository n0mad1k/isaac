import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DollarSign,
  Beef,
  Apple,
  Calendar,
  Scale,
  Trash2,
  TrendingUp,
  Plus,
  X,
  ShoppingCart,
  Users,
  ClipboardList,
  Edit,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  PiggyBank,
  Percent,
  Home as HomeIcon,
  Gift,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Sprout,
  Receipt,
  Upload,
  Clipboard,
  FileText,
  Image,
} from 'lucide-react'
import MottoDisplay from '../components/MottoDisplay'
import {
  getProductionStats,
  getLivestockProductions,
  getPlantHarvests,
  deleteLivestockProduction,
  deletePlantHarvest,
  getSales,
  createSale,
  deleteSale,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  addOrderPayment,
  deleteOrderPayment,
  completeOrder,
  sendOrderReceipt,
  getFinancialSummary,
  getOutstandingPayments,
  getLivestockAllocations,
  createLivestockAllocation,
  deleteLivestockAllocation,
  allocatePersonal,
  getHarvestAllocations,
  createHarvestAllocation,
  deleteHarvestAllocation,
  allocateConsumed,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadExpenseReceipt,
  deleteExpenseReceipt,
  getExpenseReceiptUrl,
} from '../services/api'
import { format } from 'date-fns'

const SALE_CATEGORIES = [
  { value: 'livestock', label: 'Livestock' },
  { value: 'plant', label: 'Plant/Nursery' },
  { value: 'produce', label: 'Produce' },
  { value: 'other', label: 'Other' },
]

const ORDER_STATUSES = [
  { value: 'reserved', label: 'Reserved', color: 'bg-blue-600' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-600' },
  { value: 'ready', label: 'Ready', color: 'bg-green-600' },
  { value: 'completed', label: 'Completed', color: 'bg-gray-600' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-600' },
]

const PAYMENT_TYPES = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'partial', label: 'Partial Payment' },
  { value: 'final', label: 'Final Payment' },
  { value: 'refund', label: 'Refund' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

const PORTION_TYPES = [
  { value: 'whole', label: 'Whole', percentage: 100 },
  { value: 'half', label: 'Half', percentage: 50 },
  { value: 'quarter', label: 'Quarter', percentage: 25 },
  { value: 'custom', label: 'Custom', percentage: null },
]

const ALLOCATION_TYPES = [
  { value: 'sale', label: 'Sale', icon: DollarSign, color: 'text-green-400' },
  { value: 'personal', label: 'Personal', icon: HomeIcon, color: 'text-blue-400' },
  { value: 'gift', label: 'Gift', icon: Gift, color: 'text-purple-400' },
  { value: 'loss', label: 'Loss', icon: AlertTriangle, color: 'text-red-400' },
]

const HARVEST_USE_TYPES = [
  { value: 'sold', label: 'Sold', icon: DollarSign, color: 'text-green-400' },
  { value: 'consumed', label: 'Consumed', icon: HomeIcon, color: 'text-blue-400' },
  { value: 'gifted', label: 'Gifted', icon: Gift, color: 'text-purple-400' },
  { value: 'preserved', label: 'Preserved', icon: Clock, color: 'text-yellow-400' },
  { value: 'spoiled', label: 'Spoiled', icon: AlertTriangle, color: 'text-red-400' },
]

const EXPENSE_CATEGORIES = [
  { value: 'feed', label: 'Feed' },
  { value: 'vet', label: 'Vet' },
  { value: 'processing', label: 'Processing' },
  { value: 'seeds', label: 'Seeds' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'labor', label: 'Labor' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'fencing', label: 'Fencing' },
  { value: 'bedding', label: 'Bedding' },
  { value: 'other', label: 'Other' },
]

const EXPENSE_SCOPES = [
  { value: 'business', label: 'Business' },
  { value: 'homestead', label: 'Homestead' },
  { value: 'shared', label: 'Shared' },
]

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function FarmFinances() {
  const [searchParams] = useSearchParams()
  const initialTab = useMemo(() => searchParams.get('tab') || 'overview', [])
  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Data states
  const [financialSummary, setFinancialSummary] = useState(null)
  const [livestock, setLivestock] = useState([])
  const [harvests, setHarvests] = useState([])
  const [sales, setSales] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [outstandingPayments, setOutstandingPayments] = useState([])
  const [expenses, setExpenses] = useState([])

  // Modal states
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [showHarvestAllocationModal, setShowHarvestAllocationModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  // Edit states
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editingOrder, setEditingOrder] = useState(null)
  const [editingExpense, setEditingExpense] = useState(null)
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null)
  const [selectedProductionForAllocation, setSelectedProductionForAllocation] = useState(null)
  const [selectedHarvestForAllocation, setSelectedHarvestForAllocation] = useState(null)

  // Expense scope filter for the modal (which tab opened it)
  const [expenseModalDefaultScope, setExpenseModalDefaultScope] = useState('business')

  // Form states
  const [saleFormData, setSaleFormData] = useState({
    category: 'produce',
    item_name: '',
    description: '',
    quantity: 1,
    unit: 'each',
    unit_price: 0,
    sale_date: format(new Date(), 'yyyy-MM-dd'),
    customer_id: null,
  })

  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })

  const [orderFormData, setOrderFormData] = useState({
    customer_id: null,
    customer_name: '',
    livestock_production_id: null,
    description: '',
    portion_type: 'whole',
    portion_percentage: 100,
    estimated_weight: '',
    price_per_pound: '',
    estimated_total: '',
    status: 'reserved',
    order_date: format(new Date(), 'yyyy-MM-dd'),
    expected_ready_date: '',
    notes: '',
  })

  const [paymentFormData, setPaymentFormData] = useState({
    payment_type: 'deposit',
    payment_method: 'cash',
    amount: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    reference: '',
    notes: '',
  })

  const [allocationFormData, setAllocationFormData] = useState({
    allocation_type: 'personal',
    percentage: '',
    notes: '',
  })

  const [harvestAllocationFormData, setHarvestAllocationFormData] = useState({
    use_type: 'consumed',
    quantity: '',
    notes: '',
  })

  const [expenseFormData, setExpenseFormData] = useState({
    category: 'feed',
    scope: 'business',
    amount: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    vendor: '',
    notes: '',
    business_split_pct: 50,
    is_recurring: false,
    recurring_interval: '',
  })

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [summaryRes, livestockRes, harvestsRes, salesRes, customersRes, ordersRes, outstandingRes, expensesRes] = await Promise.all([
        getFinancialSummary(selectedYear),
        getLivestockProductions({ year: selectedYear }),
        getPlantHarvests({ year: selectedYear }),
        getSales({ year: selectedYear }),
        getCustomers({ active_only: false }),
        getOrders(),
        getOutstandingPayments(),
        getExpenses({ year: selectedYear }),
      ])
      setFinancialSummary(summaryRes.data)
      setLivestock(livestockRes.data)
      setHarvests(harvestsRes.data)
      setSales(salesRes.data)
      setCustomers(customersRes.data)
      setOrders(ordersRes.data)
      setOutstandingPayments(outstandingRes.data)
      setExpenses(expensesRes.data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  // Customer handlers
  const handleCustomerSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, customerFormData)
      } else {
        await createCustomer(customerFormData)
      }
      setShowCustomerModal(false)
      setEditingCustomer(null)
      setCustomerFormData({ name: '', email: '', phone: '', address: '', notes: '' })
      fetchData()
    } catch (error) {
      console.error('Failed to save customer:', error)
      alert('Failed to save customer')
    }
  }

  const handleDeleteCustomer = async (id, name) => {
    if (confirm(`Deactivate customer "${name}"?`)) {
      try {
        await deleteCustomer(id)
        fetchData()
      } catch (error) {
        console.error('Failed to delete customer:', error)
      }
    }
  }

  // Order handlers
  const handleOrderSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...orderFormData,
        estimated_weight: orderFormData.estimated_weight ? parseFloat(orderFormData.estimated_weight) : null,
        price_per_pound: orderFormData.price_per_pound ? parseFloat(orderFormData.price_per_pound) : null,
        estimated_total: orderFormData.estimated_total ? parseFloat(orderFormData.estimated_total) : null,
        customer_id: orderFormData.customer_id || null,
        livestock_production_id: orderFormData.livestock_production_id || null,
      }
      if (editingOrder) {
        await updateOrder(editingOrder.id, data)
      } else {
        await createOrder(data)
      }
      setShowOrderModal(false)
      setEditingOrder(null)
      resetOrderForm()
      fetchData()
    } catch (error) {
      console.error('Failed to save order:', error)
      alert('Failed to save order')
    }
  }

  const handleDeleteOrder = async (id) => {
    if (confirm('Delete this order? This cannot be undone.')) {
      try {
        await deleteOrder(id)
        fetchData()
      } catch (error) {
        console.error('Failed to delete order:', error)
      }
    }
  }

  const handleCompleteOrder = async (id) => {
    if (confirm('Mark this order as completed?')) {
      try {
        await completeOrder(id)
        fetchData()
      } catch (error) {
        console.error('Failed to complete order:', error)
      }
    }
  }

  const handleSendReceipt = async (id) => {
    try {
      const res = await sendOrderReceipt(id)
      alert(res.data.message || 'Receipt sent!')
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to send receipt'
      alert(msg)
    }
  }

  // Payment handlers
  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    try {
      await addOrderPayment(selectedOrderForPayment.id, {
        ...paymentFormData,
        amount: parseFloat(paymentFormData.amount),
      })
      setShowPaymentModal(false)
      setSelectedOrderForPayment(null)
      setPaymentFormData({
        payment_type: 'deposit',
        payment_method: 'cash',
        amount: '',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        reference: '',
        notes: '',
      })
      fetchData()
    } catch (error) {
      console.error('Failed to add payment:', error)
      alert('Failed to add payment')
    }
  }

  const handleDeletePayment = async (orderId, paymentId) => {
    if (confirm('Delete this payment?')) {
      try {
        await deleteOrderPayment(orderId, paymentId)
        fetchData()
      } catch (error) {
        console.error('Failed to delete payment:', error)
      }
    }
  }

  // Sale handlers
  const handleSaleSubmit = async (e) => {
    e.preventDefault()
    try {
      await createSale(saleFormData)
      setShowSaleModal(false)
      setSaleFormData({
        category: 'produce',
        item_name: '',
        description: '',
        quantity: 1,
        unit: 'each',
        unit_price: 0,
        sale_date: format(new Date(), 'yyyy-MM-dd'),
        customer_id: null,
      })
      fetchData()
    } catch (error) {
      console.error('Failed to create sale:', error)
      alert('Failed to create sale')
    }
  }

  const handleDeleteSale = async (id, name) => {
    if (confirm(`Delete sale "${name}"?`)) {
      try {
        await deleteSale(id)
        fetchData()
      } catch (error) {
        console.error('Failed to delete sale:', error)
      }
    }
  }

  // Livestock/Harvest delete handlers
  const handleDeleteLivestock = async (id, name) => {
    if (confirm(`Delete production record for "${name}"?`)) {
      try {
        await deleteLivestockProduction(id)
        fetchData()
      } catch (error) {
        console.error('Failed to delete:', error)
      }
    }
  }

  const handleDeleteHarvest = async (id, name) => {
    if (confirm(`Delete harvest record for "${name}"?`)) {
      try {
        await deletePlantHarvest(id)
        fetchData()
      } catch (error) {
        console.error('Failed to delete:', error)
      }
    }
  }

  // Allocation handlers
  const handleAllocationSubmit = async (e) => {
    e.preventDefault()
    try {
      await allocatePersonal(
        selectedProductionForAllocation.id,
        parseFloat(allocationFormData.percentage),
        allocationFormData.notes || null
      )
      setShowAllocationModal(false)
      setSelectedProductionForAllocation(null)
      setAllocationFormData({ allocation_type: 'personal', percentage: '', notes: '' })
      fetchData()
    } catch (error) {
      console.error('Failed to create allocation:', error)
      alert('Failed to create allocation')
    }
  }

  const handleHarvestAllocationSubmit = async (e) => {
    e.preventDefault()
    try {
      await allocateConsumed(
        selectedHarvestForAllocation.id,
        parseFloat(harvestAllocationFormData.quantity),
        harvestAllocationFormData.notes || null
      )
      setShowHarvestAllocationModal(false)
      setSelectedHarvestForAllocation(null)
      setHarvestAllocationFormData({ use_type: 'consumed', quantity: '', notes: '' })
      fetchData()
    } catch (error) {
      console.error('Failed to create allocation:', error)
      alert('Failed to create allocation')
    }
  }

  // Expense handlers
  const handleExpenseSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...expenseFormData,
        amount: parseFloat(expenseFormData.amount),
        business_split_pct: expenseFormData.scope === 'shared' ? parseFloat(expenseFormData.business_split_pct) : 100,
      }
      if (editingExpense) {
        await updateExpense(editingExpense.id, data)
        setShowExpenseModal(false)
        setEditingExpense(null)
        resetExpenseForm()
      } else {
        const resp = await createExpense(data)
        // Keep modal open with saved expense so user can add receipt
        setEditingExpense(resp.data)
      }
      fetchData()
    } catch (error) {
      console.error('Failed to save expense:', error)
      alert('Failed to save expense')
    }
  }

  const handleDeleteExpense = async (id, description) => {
    if (confirm(`Delete expense "${description}"?`)) {
      try {
        await deleteExpense(id)
        fetchData()
      } catch (error) {
        console.error('Failed to delete expense:', error)
      }
    }
  }

  const resetOrderForm = () => {
    setOrderFormData({
      customer_id: null,
      customer_name: '',
      livestock_production_id: null,
      description: '',
      portion_type: 'whole',
      portion_percentage: 100,
      estimated_weight: '',
      price_per_pound: '',
      estimated_total: '',
      status: 'reserved',
      order_date: format(new Date(), 'yyyy-MM-dd'),
      expected_ready_date: '',
      notes: '',
    })
  }

  const resetExpenseForm = () => {
    setExpenseFormData({
      category: 'feed',
      scope: 'business',
      amount: '',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      vendor: '',
      notes: '',
      business_split_pct: 50,
      is_recurring: false,
      recurring_interval: '',
    })
  }

  const openExpenseModal = (defaultScope = 'business') => {
    setEditingExpense(null)
    setExpenseModalDefaultScope(defaultScope)
    setExpenseFormData({
      ...expenseFormData,
      category: 'feed',
      scope: defaultScope,
      amount: '',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      vendor: '',
      notes: '',
      business_split_pct: 50,
      is_recurring: false,
      recurring_interval: '',
    })
    setShowExpenseModal(true)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0)
  }

  const formatAnimalType = (type) => {
    if (!type) return ''
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const formatQuality = (quality) => {
    const colors = {
      excellent: 'bg-green-600 text-white',
      good: 'bg-blue-600 text-white',
      fair: 'bg-yellow-600 text-black',
      poor: 'bg-red-600 text-white',
    }
    return colors[quality] || 'bg-gray-600 text-white'
  }

  const getCategoryColor = (category) => {
    const colors = {
      livestock: 'border-red-500',
      plant: 'border-green-500',
      produce: 'border-yellow-500',
      other: 'border-gray-500',
    }
    return colors[category] || 'border-gray-500'
  }

  const getStatusBadge = (status) => {
    const config = ORDER_STATUSES.find(s => s.value === status)
    return config ? config : { label: status, color: 'bg-gray-600' }
  }

  const getPaymentProgress = (order) => {
    const total = order.final_total || order.estimated_total || 0
    if (total === 0) return 0
    return Math.min(100, ((order.total_paid || 0) / total) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'business', label: 'Business', icon: Briefcase },
    { key: 'homestead', label: 'Homestead', icon: Sprout },
  ]

  // Filter expenses by scope for each tab
  const businessExpenses = expenses.filter(e => e.scope === 'business' || e.scope === 'shared')
  const homesteadExpenses = expenses.filter(e => e.scope === 'homestead' || e.scope === 'shared')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 flex-shrink-0">
          <DollarSign className="w-7 h-7 text-green-500" />
          Production
        </h1>
        <MottoDisplay />
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-farm-green text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          summary={financialSummary}
          outstandingPayments={outstandingPayments}
          formatCurrency={formatCurrency}
          onAddPayment={(order) => {
            setSelectedOrderForPayment(order)
            setShowPaymentModal(true)
          }}
        />
      )}

      {activeTab === 'business' && (
        <BusinessTab
          sales={sales}
          livestock={livestock}
          orders={orders}
          customers={customers}
          expenses={businessExpenses}
          formatCurrency={formatCurrency}
          formatAnimalType={formatAnimalType}
          getCategoryColor={getCategoryColor}
          getStatusBadge={getStatusBadge}
          getPaymentProgress={getPaymentProgress}
          handleDeleteSale={handleDeleteSale}
          handleDeleteLivestock={handleDeleteLivestock}
          handleDeleteOrder={handleDeleteOrder}
          handleCompleteOrder={handleCompleteOrder}
          handleSendReceipt={handleSendReceipt}
          handleDeleteCustomer={handleDeleteCustomer}
          handleDeleteExpense={handleDeleteExpense}
          handleDeletePayment={handleDeletePayment}
          onAddSale={() => setShowSaleModal(true)}
          onAddOrder={() => {
            setEditingOrder(null)
            resetOrderForm()
            setShowOrderModal(true)
          }}
          onAddCustomer={() => {
            setEditingCustomer(null)
            setCustomerFormData({ name: '', email: '', phone: '', address: '', notes: '' })
            setShowCustomerModal(true)
          }}
          onAddExpense={() => openExpenseModal('business')}
          onEditCustomer={(customer) => {
            setEditingCustomer(customer)
            setCustomerFormData({
              name: customer.name,
              email: customer.email || '',
              phone: customer.phone || '',
              address: customer.address || '',
              notes: customer.notes || '',
            })
            setShowCustomerModal(true)
          }}
          onEditOrder={(order) => {
            setEditingOrder(order)
            setOrderFormData({
              customer_id: order.customer_id,
              customer_name: order.customer_name || '',
              livestock_production_id: order.livestock_production_id,
              description: order.description || '',
              portion_type: order.portion_type,
              portion_percentage: order.portion_percentage,
              estimated_weight: order.estimated_weight || '',
              price_per_pound: order.price_per_pound || '',
              estimated_total: order.estimated_total || order.final_total || '',
              status: order.status,
              order_date: order.order_date,
              expected_ready_date: order.expected_ready_date || '',
              notes: order.notes || '',
            })
            setShowOrderModal(true)
          }}
          onEditExpense={(expense) => {
            setEditingExpense(expense)
            setExpenseFormData({
              category: expense.category,
              scope: expense.scope,
              amount: expense.amount,
              expense_date: expense.expense_date,
              description: expense.description,
              vendor: expense.vendor || '',
              notes: expense.notes || '',
              business_split_pct: expense.business_split_pct || 50,
              is_recurring: expense.is_recurring || false,
              recurring_interval: expense.recurring_interval || '',
            })
            setShowExpenseModal(true)
          }}
          onAddPayment={(order) => {
            setSelectedOrderForPayment(order)
            setShowPaymentModal(true)
          }}
          onAllocate={(prod) => {
            setSelectedProductionForAllocation(prod)
            setAllocationFormData({ allocation_type: 'personal', percentage: '', notes: '' })
            setShowAllocationModal(true)
          }}
        />
      )}

      {activeTab === 'homestead' && (
        <HomesteadTab
          harvests={harvests}
          expenses={homesteadExpenses}
          summary={financialSummary}
          formatCurrency={formatCurrency}
          formatQuality={formatQuality}
          handleDeleteHarvest={handleDeleteHarvest}
          handleDeleteExpense={handleDeleteExpense}
          onAddExpense={() => openExpenseModal('homestead')}
          onEditExpense={(expense) => {
            setEditingExpense(expense)
            setExpenseFormData({
              category: expense.category,
              scope: expense.scope,
              amount: expense.amount,
              expense_date: expense.expense_date,
              description: expense.description,
              vendor: expense.vendor || '',
              notes: expense.notes || '',
              business_split_pct: expense.business_split_pct || 50,
              is_recurring: expense.is_recurring || false,
              recurring_interval: expense.recurring_interval || '',
            })
            setShowExpenseModal(true)
          }}
          onAllocate={(harvest) => {
            setSelectedHarvestForAllocation(harvest)
            setHarvestAllocationFormData({ use_type: 'consumed', quantity: '', notes: '' })
            setShowHarvestAllocationModal(true)
          }}
        />
      )}


      {/* Sale Modal */}
      {showSaleModal && (
        <SaleModal
          formData={saleFormData}
          setFormData={setSaleFormData}
          customers={customers}
          onSubmit={handleSaleSubmit}
          onClose={() => setShowSaleModal(false)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <CustomerModal
          formData={customerFormData}
          setFormData={setCustomerFormData}
          editing={editingCustomer}
          onSubmit={handleCustomerSubmit}
          onClose={() => {
            setShowCustomerModal(false)
            setEditingCustomer(null)
          }}
        />
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <OrderModal
          formData={orderFormData}
          setFormData={setOrderFormData}
          customers={customers}
          livestock={livestock}
          editing={editingOrder}
          onSubmit={handleOrderSubmit}
          onClose={() => {
            setShowOrderModal(false)
            setEditingOrder(null)
          }}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrderForPayment && (
        <PaymentModal
          order={selectedOrderForPayment}
          formData={paymentFormData}
          setFormData={setPaymentFormData}
          onSubmit={handlePaymentSubmit}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedOrderForPayment(null)
          }}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Allocation Modal */}
      {showAllocationModal && selectedProductionForAllocation && (
        <AllocationModal
          production={selectedProductionForAllocation}
          formData={allocationFormData}
          setFormData={setAllocationFormData}
          onSubmit={handleAllocationSubmit}
          onClose={() => {
            setShowAllocationModal(false)
            setSelectedProductionForAllocation(null)
          }}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Harvest Allocation Modal */}
      {showHarvestAllocationModal && selectedHarvestForAllocation && (
        <HarvestAllocationModal
          harvest={selectedHarvestForAllocation}
          formData={harvestAllocationFormData}
          setFormData={setHarvestAllocationFormData}
          onSubmit={handleHarvestAllocationSubmit}
          onClose={() => {
            setShowHarvestAllocationModal(false)
            setSelectedHarvestForAllocation(null)
          }}
        />
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <ExpenseModal
          formData={expenseFormData}
          setFormData={setExpenseFormData}
          editing={editingExpense}
          onSubmit={handleExpenseSubmit}
          onClose={() => {
            setShowExpenseModal(false)
            setEditingExpense(null)
            resetExpenseForm()
          }}
          formatCurrency={formatCurrency}
          onReceiptChange={async () => {
            await fetchData()
            // Refresh the editing expense to get updated receipt_path
            if (editingExpense?.id) {
              try {
                const resp = await getExpenses()
                const updated = resp.data.find(e => e.id === editingExpense.id)
                if (updated) setEditingExpense(updated)
              } catch (err) { /* ignore */ }
            }
          }}
        />
      )}
    </div>
  )
}

// ==================== Collapsible Section ====================

function CollapsibleSection({ title, icon: Icon, iconColor, count, children, defaultOpen = true, actions }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          {Icon && <Icon className={`w-5 h-5 ${iconColor || 'text-gray-400'}`} />}
          <h3 className="text-lg font-semibold">{title}</h3>
          {count !== undefined && (
            <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">{count}</span>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ==================== Tab Components ====================

function OverviewTab({ summary, outstandingPayments, formatCurrency, onAddPayment }) {
  if (!summary) return null

  return (
    <div className="space-y-6">
      {/* Top P&L Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Revenue</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrency(summary.summary?.total_revenue)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Expenses</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {formatCurrency(summary.summary?.total_expenses)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <PiggyBank className="w-4 h-4" />
            <span className="text-sm">Net Profit</span>
          </div>
          <div className={`text-2xl font-bold ${(summary.summary?.net_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(summary.summary?.net_profit)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Outstanding</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">
            {formatCurrency(summary.summary?.outstanding_payments)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <HomeIcon className="w-4 h-4" />
            <span className="text-sm">Homestead</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {formatCurrency(summary.summary?.homestead_costs)}
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Beef className="w-4 h-4 text-red-400" />
            <span className="text-sm">Processed</span>
          </div>
          <div className="text-xl font-bold">{summary.livestock?.total_processed || 0}</div>
          <div className="text-xs text-gray-500">{(summary.livestock?.total_meat_lbs || 0).toFixed(0)} lbs</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Apple className="w-4 h-4 text-green-400" />
            <span className="text-sm">Harvests</span>
          </div>
          <div className="text-xl font-bold">{summary.harvests?.total_harvests || 0}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <ClipboardList className="w-4 h-4 text-blue-400" />
            <span className="text-sm">Active Orders</span>
          </div>
          <div className="text-xl font-bold">{summary.orders?.active_orders || 0}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Scale className="w-4 h-4 text-cyan-400" />
            <span className="text-sm">Avg Cost/lb</span>
          </div>
          <div className="text-xl font-bold text-cyan-400">{formatCurrency(summary.livestock?.avg_cost_per_pound)}</div>
        </div>
      </div>

      {/* Monthly Trends */}
      {summary.monthly_trends && summary.monthly_trends.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-400" />
            Monthly Trends
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2 text-gray-400">Month</th>
                  <th className="text-right p-2 text-gray-400">Revenue</th>
                  <th className="text-right p-2 text-gray-400">Expenses</th>
                  <th className="text-right p-2 text-gray-400">Net</th>
                </tr>
              </thead>
              <tbody>
                {summary.monthly_trends.map((row) => {
                  const net = row.revenue - row.expenses
                  return (
                    <tr key={row.month} className="border-b border-gray-700/50">
                      <td className="p-2 font-medium">{MONTH_NAMES[row.month]}</td>
                      <td className="p-2 text-right text-green-400">{formatCurrency(row.revenue)}</td>
                      <td className="p-2 text-right text-yellow-400">{formatCurrency(row.expenses)}</td>
                      <td className={`p-2 text-right font-medium ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Outstanding Payments */}
      {outstandingPayments.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            Outstanding Payments ({outstandingPayments.length})
          </h3>
          <div className="space-y-3">
            {outstandingPayments.map((item) => (
              <div key={item.order.id} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{item.order.customer_name || 'Unknown Customer'}</div>
                  <div className="text-sm text-gray-400">{item.order.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-orange-400 font-bold">{formatCurrency(item.balance_due)} due</div>
                  <div className="text-sm text-gray-400">
                    {formatCurrency(item.total_paid)} of {formatCurrency(item.total_due)} paid
                  </div>
                  <button
                    onClick={() => onAddPayment(item.order)}
                    className="mt-1 text-xs text-farm-green hover:text-farm-green-light"
                  >
                    + Add Payment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Breakdown by Category */}
      {summary.standalone_expenses && Object.keys(summary.standalone_expenses.by_category || {}).length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-yellow-400" />
            Expense Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(summary.standalone_expenses.by_category).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
              <div key={cat} className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400 capitalize">{cat}</div>
                <div className="text-lg font-bold text-yellow-400">{formatCurrency(amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BusinessTab({
  sales, livestock, orders, customers, expenses,
  formatCurrency, formatAnimalType, getCategoryColor, getStatusBadge, getPaymentProgress,
  handleDeleteSale, handleDeleteLivestock, handleDeleteOrder, handleCompleteOrder, handleSendReceipt,
  handleDeleteCustomer, handleDeleteExpense, handleDeletePayment,
  onAddSale, onAddOrder, onAddCustomer, onAddExpense,
  onEditCustomer, onEditOrder, onEditExpense,
  onAddPayment, onAllocate,
}) {
  return (
    <div className="space-y-4">
      {/* Sales Section */}
      <CollapsibleSection
        title="Sales"
        icon={ShoppingCart}
        iconColor="text-green-400"
        count={sales.length}
        actions={
          <button onClick={onAddSale} className="flex items-center gap-1 px-3 py-1 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors text-sm">
            <Plus className="w-4 h-4" /> Record Sale
          </button>
        }
      >
        {sales.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No sales recorded yet</p>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className={`bg-gray-700 rounded-lg p-3 border-l-4 ${getCategoryColor(sale.category)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{sale.item_name}</h4>
                      <span className="text-xs px-2 py-0.5 bg-gray-600 rounded capitalize">{sale.category}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="text-green-400 font-medium">{formatCurrency(sale.total_price)}</span>
                      <span className="text-gray-400">{sale.quantity} {sale.unit} @ {formatCurrency(sale.unit_price)}/{sale.unit}</span>
                      {sale.sale_date && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(sale.sale_date), 'MM/dd/yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteSale(sale.id, sale.item_name)} className="p-1 text-gray-400 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Livestock Production Section */}
      <CollapsibleSection
        title="Livestock Production"
        icon={Beef}
        iconColor="text-red-400"
        count={livestock.length}
      >
        {livestock.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No livestock production records. Archive livestock from the Animals page.</p>
        ) : (
          <div className="space-y-3">
            {livestock.map((record) => (
              <div key={record.id} className="bg-gray-700 rounded-lg p-3 border-l-4 border-red-500">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{record.animal_name}</h4>
                      <span className="text-sm text-gray-400">{formatAnimalType(record.animal_type)}</span>
                      {record.breed && <span className="text-sm text-gray-500">- {record.breed}</span>}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-1 text-sm">
                      {record.slaughter_date && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(record.slaughter_date), 'MM/dd/yyyy')}
                        </span>
                      )}
                      {record.final_weight && <span className="text-gray-400">Final: <span className="text-green-400 font-medium">{record.final_weight} lbs</span></span>}
                      {record.cost_per_pound > 0 && <span className="text-gray-400">Cost/lb: <span className="text-cyan-400">{formatCurrency(record.cost_per_pound)}</span></span>}
                      {record.total_expenses > 0 && <span className="text-gray-400">Expenses: <span className="text-yellow-400">{formatCurrency(record.total_expenses)}</span></span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onAllocate(record)} className="p-1 text-gray-400 hover:text-blue-400" title="Allocate">
                      <Percent className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteLivestock(record.id, record.animal_name)} className="p-1 text-gray-400 hover:text-red-400" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Orders & Payments Section */}
      <CollapsibleSection
        title="Orders & Payments"
        icon={ClipboardList}
        iconColor="text-blue-400"
        count={orders.length}
        actions={
          <button onClick={onAddOrder} className="flex items-center gap-1 px-3 py-1 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors text-sm">
            <Plus className="w-4 h-4" /> New Order
          </button>
        }
      >
        {orders.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No orders yet</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusBadge = getStatusBadge(order.status)
              const progress = getPaymentProgress(order)
              const total = order.final_total || order.estimated_total || 0

              return (
                <div key={order.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{order.customer_name || 'Unknown Customer'}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded ${statusBadge.color} text-white`}>{statusBadge.label}</span>
                      </div>
                      {order.description && <p className="text-gray-400 text-sm mt-1">{order.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => onEditOrder(order)} className="p-1 text-gray-400 hover:text-blue-400" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleSendReceipt(order.id)} className="p-1 text-gray-400 hover:text-amber-400" title="Email Receipt"><Receipt className="w-4 h-4" /></button>
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button onClick={() => handleCompleteOrder(order.id)} className="p-1 text-gray-400 hover:text-green-400" title="Complete"><CheckCircle2 className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => handleDeleteOrder(order.id)} className="p-1 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                    <div><span className="text-gray-400">Portion:</span> <span className="capitalize">{order.portion_type}</span></div>
                    {total > 0 && <div><span className="text-gray-400">Total:</span> <span className="text-green-400 font-medium">{formatCurrency(total)}</span></div>}
                    {order.estimated_weight && <div><span className="text-gray-400">Est:</span> {order.estimated_weight} lbs</div>}
                    {order.order_date && <div><span className="text-gray-400">Date:</span> {format(new Date(order.order_date), 'MM/dd/yyyy')}</div>}
                  </div>

                  {/* Payment Progress */}
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Payment</span>
                      <span><span className="text-green-400">{formatCurrency(order.total_paid)}</span> / {formatCurrency(total)}</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                    </div>
                    {order.balance_due > 0 && <div className="text-right text-xs mt-1 text-orange-400">{formatCurrency(order.balance_due)} remaining</div>}
                  </div>

                  {/* Payments */}
                  {order.payments && order.payments.length > 0 && (
                    <div className="border-t border-gray-600 pt-2 mt-2 space-y-1">
                      {order.payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-3 h-3 text-gray-400" />
                            <span className="capitalize">{payment.payment_type}</span>
                            <span className="text-gray-500">via {payment.payment_method}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={payment.payment_type === 'refund' ? 'text-red-400' : 'text-green-400'}>
                              {payment.payment_type === 'refund' ? '-' : '+'}{formatCurrency(payment.amount)}
                            </span>
                            <span className="text-gray-500">{format(new Date(payment.payment_date), 'MM/dd/yyyy')}</span>
                            <button onClick={() => handleDeletePayment(order.id, payment.id)} className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {order.status !== 'completed' && order.status !== 'cancelled' && (
                    <button onClick={() => onAddPayment(order)} className="mt-2 text-sm text-farm-green hover:text-farm-green-light flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Payment
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Customers Section */}
      <CollapsibleSection
        title="Customers"
        icon={Users}
        iconColor="text-purple-400"
        count={customers.filter(c => c.is_active).length}
        defaultOpen={false}
        actions={
          <button onClick={onAddCustomer} className="flex items-center gap-1 px-3 py-1 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors text-sm">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        }
      >
        {customers.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No customers yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left p-2 text-gray-400">Name</th>
                  <th className="text-left p-2 text-gray-400">Contact</th>
                  <th className="text-left p-2 text-gray-400 hidden md:table-cell">Notes</th>
                  <th className="text-right p-2 text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.filter(c => c.is_active).map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="p-2 font-medium">{customer.name}</td>
                    <td className="p-2 text-gray-400">
                      {customer.phone && <div>{customer.phone}</div>}
                      {customer.email && <div>{customer.email}</div>}
                    </td>
                    <td className="p-2 hidden md:table-cell text-gray-500 italic">{customer.notes}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => onEditCustomer(customer)} className="p-1 text-gray-400 hover:text-blue-400"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteCustomer(customer.id, customer.name)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* Business Expenses Section */}
      <CollapsibleSection
        title="Business Expenses"
        icon={Receipt}
        iconColor="text-yellow-400"
        count={expenses.length}
        defaultOpen={false}
        actions={
          <button onClick={onAddExpense} className="flex items-center gap-1 px-3 py-1 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors text-sm">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        }
      >
        <ExpenseList
          expenses={expenses}
          formatCurrency={formatCurrency}
          onEdit={onEditExpense}
          onDelete={handleDeleteExpense}
        />
      </CollapsibleSection>
    </div>
  )
}

function HomesteadTab({
  harvests, expenses, summary,
  formatCurrency, formatQuality,
  handleDeleteHarvest, handleDeleteExpense,
  onAddExpense, onEditExpense, onAllocate,
}) {
  return (
    <div className="space-y-4">
      {/* Harvests Section */}
      <CollapsibleSection
        title="Harvests"
        icon={Apple}
        iconColor="text-green-400"
        count={harvests.length}
      >
        {harvests.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No harvest records. Record harvests from the Plants page.</p>
        ) : (
          <div className="space-y-3">
            {harvests.map((record) => (
              <div key={record.id} className="bg-gray-700 rounded-lg p-3 border-l-4 border-green-500">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{record.plant_name}</h4>
                      {record.plant_variety && <span className="text-sm text-gray-400">({record.plant_variety})</span>}
                      <span className={`text-xs px-2 py-0.5 rounded ${formatQuality(record.quality)}`}>{record.quality}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="text-green-400 font-medium">{record.quantity} {record.unit}</span>
                      {record.harvest_date && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(record.harvest_date), 'MM/dd/yyyy')}
                        </span>
                      )}
                    </div>
                    {record.notes && <p className="text-sm text-gray-500 mt-1">{record.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onAllocate(record)} className="p-1 text-gray-400 hover:text-blue-400" title="Track Usage"><Percent className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteHarvest(record.id, record.plant_name)} className="p-1 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Homestead Expenses Section */}
      <CollapsibleSection
        title="Homestead Expenses"
        icon={Receipt}
        iconColor="text-yellow-400"
        count={expenses.length}
        defaultOpen={false}
        actions={
          <button onClick={onAddExpense} className="flex items-center gap-1 px-3 py-1 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors text-sm">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        }
      >
        <ExpenseList
          expenses={expenses}
          formatCurrency={formatCurrency}
          onEdit={onEditExpense}
          onDelete={handleDeleteExpense}
        />
      </CollapsibleSection>

      {/* Personal Use Summary */}
      {summary && (
        <CollapsibleSection
          title="Personal Use Summary"
          icon={HomeIcon}
          iconColor="text-purple-400"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-sm text-gray-400">Meat Kept</div>
              <div className="text-xl font-bold">{(summary.allocations?.personal_weight || 0).toFixed(0)} lbs</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-sm text-gray-400">Meat Sold</div>
              <div className="text-xl font-bold">{(summary.allocations?.sold_weight || 0).toFixed(0)} lbs</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-sm text-gray-400">Personal Value</div>
              <div className="text-xl font-bold text-cyan-400">{formatCurrency(summary.allocations?.personal_cost)}</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-sm text-gray-400">Harvests Consumed</div>
              <div className="text-xl font-bold text-blue-400">{summary.harvests?.consumed || 0}</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-sm text-gray-400">Preserved</div>
              <div className="text-xl font-bold text-yellow-400">{summary.harvests?.preserved || 0}</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-sm text-gray-400">Gifted</div>
              <div className="text-xl font-bold text-purple-400">{summary.harvests?.gifted || 0}</div>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

// ==================== Expense List Component ====================

function ExpenseList({ expenses, formatCurrency, onEdit, onDelete }) {
  if (expenses.length === 0) {
    return <p className="text-gray-500 text-sm py-4 text-center">No expenses recorded</p>
  }

  return (
    <div className="space-y-2">
      {expenses.map((expense) => (
        <div key={expense.id} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{expense.description}</span>
              <span className="text-xs px-2 py-0.5 bg-gray-600 rounded capitalize">{expense.category}</span>
              {expense.scope === 'shared' && (
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">
                  Shared ({expense.business_split_pct}% biz)
                </span>
              )}
              {expense.is_recurring && (
                <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded capitalize">
                  {expense.recurring_interval || 'recurring'}
                </span>
              )}
              {expense.receipt_path && (
                <a
                  href={getExpenseReceiptUrl(expense.receipt_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-0.5 bg-green-900/50 text-green-300 rounded flex items-center gap-1 hover:bg-green-800/50"
                  title="View receipt"
                >
                  <Receipt className="w-3 h-3" />
                  Receipt
                </a>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm">
              <span className="text-yellow-400 font-medium">{formatCurrency(expense.amount)}</span>
              {expense.vendor && <span className="text-gray-400">{expense.vendor}</span>}
              {expense.expense_date && (
                <span className="flex items-center gap-1 text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(expense.expense_date), 'MM/dd/yyyy')}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(expense)} className="p-1 text-gray-400 hover:text-blue-400"><Edit className="w-4 h-4" /></button>
            <button onClick={() => onDelete(expense.id, expense.description)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== Modal Components ====================

function SaleModal({ formData, setFormData, customers, onSubmit, onClose, formatCurrency }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h2 className="text-lg font-semibold">Record Sale</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              {SALE_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Customer (Optional)</label>
            <select
              value={formData.customer_id || ''}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              <option value="">-- No Customer --</option>
              {customers.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Item Name *</label>
            <input
              type="text"
              required
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              placeholder="e.g., Beef - Ground, Tomato Seedlings, Eggs"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantity *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="lbs, dozen, each"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Price/Unit *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-3 text-center">
            <span className="text-gray-400">Total:</span>
            <span className="text-2xl font-bold text-green-400 ml-2">
              {formatCurrency(formData.quantity * formData.unit_price)}
            </span>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Sale Date</label>
            <input
              type="date"
              value={formData.sale_date}
              onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Optional notes"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors">Record Sale</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerModal({ formData, setFormData, editing, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h2 className="text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Phone</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Address</label>
            <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors">{editing ? 'Save Changes' : 'Add Customer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OrderModal({ formData, setFormData, customers, livestock, editing, onSubmit, onClose, formatCurrency }) {
  const [showWeightDetails, setShowWeightDetails] = useState(
    !!(formData.estimated_weight || formData.price_per_pound)
  )

  const handlePortionChange = (portionType) => {
    const portion = PORTION_TYPES.find(p => p.value === portionType)
    setFormData({
      ...formData,
      portion_type: portionType,
      portion_percentage: portion?.percentage || formData.portion_percentage,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-sm sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h2 className="text-lg font-semibold">{editing ? 'Edit Order' : 'New Order'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Customer</label>
            <select value={formData.customer_id || ''} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green">
              <option value="">-- Select Customer --</option>
              {customers.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {!formData.customer_id && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Customer Name (if not in list)</label>
              <input type="text" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Linked Livestock (Optional)</label>
            <select value={formData.livestock_production_id || ''} onChange={(e) => setFormData({ ...formData, livestock_production_id: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green">
              <option value="">-- No Link --</option>
              {livestock.map(l => (
                <option key={l.id} value={l.id}>{l.animal_name} ({l.animal_type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="e.g., 1/2 Beef - Brody" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Portion</label>
              <select value={formData.portion_type} onChange={(e) => handlePortionChange(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green">
                {PORTION_TYPES.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
              </select>
            </div>
            {formData.portion_type === 'custom' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Percentage</label>
                <input type="number" min="0" max="100" value={formData.portion_percentage} onChange={(e) => setFormData({ ...formData, portion_percentage: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Order Total ($)</label>
            <input type="number" min="0" step="0.01" value={formData.estimated_total || ''} onChange={(e) => setFormData({ ...formData, estimated_total: e.target.value })} placeholder="Total price for this order" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green text-lg" />
          </div>

          <button type="button" onClick={() => setShowWeightDetails(!showWeightDetails)} className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-1">
            {showWeightDetails ? '▾' : '▸'} Weight & Price/lb Details (optional)
          </button>

          {showWeightDetails && (
            <div className="grid grid-cols-2 gap-4 pl-3 border-l-2 border-gray-600">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Estimated Weight (lbs)</label>
                <input type="number" min="0" step="0.1" value={formData.estimated_weight} onChange={(e) => setFormData({ ...formData, estimated_weight: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Price per Pound</label>
                <input type="number" min="0" step="0.01" value={formData.price_per_pound} onChange={(e) => setFormData({ ...formData, price_per_pound: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Order Date</label>
              <input type="date" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Expected Ready Date</label>
              <input type="date" value={formData.expected_ready_date} onChange={(e) => setFormData({ ...formData, expected_ready_date: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green">
              {ORDER_STATUSES.map(s => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors">{editing ? 'Save Changes' : 'Create Order'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaymentModal({ order, formData, setFormData, onSubmit, onClose, formatCurrency }) {
  const remaining = (order.final_total || order.estimated_total || 0) - (order.total_paid || 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-2 bg-gray-700/50">
          <div className="text-sm text-gray-400">Order: {order.customer_name}</div>
          <div className="text-sm">Balance: <span className="text-orange-400 font-medium">{formatCurrency(remaining)}</span></div>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Payment Type</label>
              <select value={formData.payment_type} onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green">
                {PAYMENT_TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Method</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green">
                {PAYMENT_METHODS.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount *</label>
            <input type="number" required min="0" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder={`Remaining: ${formatCurrency(remaining)}`} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Payment Date</label>
              <input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Reference #</label>
              <input type="text" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} placeholder="Check #, ID, etc." className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors">Add Payment</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AllocationModal({ production, formData, setFormData, onSubmit, onClose, formatCurrency }) {
  const calculatedWeight = formData.percentage && production.final_weight
    ? (parseFloat(formData.percentage) / 100) * production.final_weight
    : 0
  const calculatedCost = calculatedWeight && production.cost_per_pound
    ? calculatedWeight * production.cost_per_pound
    : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Allocate for Personal Use</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-2 bg-gray-700/50">
          <div className="text-sm text-gray-400">{production.animal_name} ({production.animal_type})</div>
          <div className="text-sm">
            Total Weight: <span className="font-medium">{production.final_weight} lbs</span>
            {production.cost_per_pound && (
              <span className="ml-3">Cost/lb: <span className="text-cyan-400">{formatCurrency(production.cost_per_pound)}</span></span>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Percentage to Keep *</label>
            <input type="number" required min="0" max="100" step="0.1" value={formData.percentage} onChange={(e) => setFormData({ ...formData, percentage: e.target.value })} placeholder="e.g., 50 for half" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>

          {calculatedWeight > 0 && (
            <div className="bg-gray-700 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Weight:</span>
                <span className="font-medium">{calculatedWeight.toFixed(1)} lbs</span>
              </div>
              {calculatedCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cost Value:</span>
                  <span className="text-cyan-400 font-medium">{formatCurrency(calculatedCost)}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors">Allocate</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HarvestAllocationModal({ harvest, formData, setFormData, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Track Harvest Usage</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-2 bg-gray-700/50">
          <div className="text-sm text-gray-400">{harvest.plant_name}</div>
          <div className="text-sm">Total Harvest: <span className="font-medium">{harvest.quantity} {harvest.unit}</span></div>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Quantity Consumed *</label>
            <div className="flex gap-2">
              <input type="number" required min="0" step="0.1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
              <span className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">{harvest.unit}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors">Record Usage</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ExpenseModal({ formData, setFormData, editing, onSubmit, onClose, formatCurrency, onReceiptChange }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = React.useRef(null)

  const handleReceiptUpload = async (file) => {
    if (!editing?.id) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await uploadExpenseReceipt(editing.id, fd)
      if (onReceiptChange) onReceiptChange()
    } catch (err) {
      console.error('Failed to upload receipt:', err)
      alert(err?.userMessage || 'Failed to upload receipt')
    } finally {
      setUploading(false)
    }
  }

  const handlePaste = async () => {
    if (!editing?.id) return
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const ext = type.split('/')[1] || 'png'
            const file = new File([blob], `pasted-receipt.${ext}`, { type })
            await handleReceiptUpload(file)
            return
          }
        }
      }
      alert('No image found in clipboard')
    } catch (err) {
      console.error('Clipboard paste failed:', err)
      alert('Could not read clipboard. Try uploading instead.')
    }
  }

  const handleDeleteReceipt = async () => {
    if (!editing?.id) return
    try {
      await deleteExpenseReceipt(editing.id)
      if (onReceiptChange) onReceiptChange()
    } catch (err) {
      console.error('Failed to delete receipt:', err)
    }
  }

  const receiptUrl = editing?.receipt_path ? getExpenseReceiptUrl(editing.receipt_path) : null
  const isPdf = editing?.receipt_path?.toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h2 className="text-lg font-semibold">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Scope *</label>
            <div className="flex gap-2">
              {EXPENSE_SCOPES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, scope: s.value })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.scope === s.value
                      ? 'bg-farm-green text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Date *</label>
            <input
              type="date"
              required
              value={formData.expense_date}
              onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description *</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Monthly feed order, Vet visit"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Vendor</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              placeholder="e.g., Tractor Supply, Local Vet"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {formData.scope === 'shared' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Business Split %</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.business_split_pct}
                  onChange={(e) => setFormData({ ...formData, business_split_pct: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm w-16 text-right">{formData.business_split_pct}% biz</span>
              </div>
              {formData.amount && (
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Business: {formatCurrency(parseFloat(formData.amount) * formData.business_split_pct / 100)}</span>
                  <span>Homestead: {formatCurrency(parseFloat(formData.amount) * (100 - formData.business_split_pct) / 100)}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-400">Recurring expense</span>
            </label>
          </div>

          {formData.is_recurring && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Interval</label>
              <select
                value={formData.recurring_interval}
                onChange={(e) => setFormData({ ...formData, recurring_interval: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <option value="">Select interval</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Optional notes"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Receipt Section */}
          {editing?.id ? (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Receipt</label>
              {receiptUrl ? (
                <div className="space-y-2">
                  <div className="bg-gray-700 rounded-lg p-3">
                    {isPdf ? (
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                        <FileText className="w-8 h-8" />
                        <span className="text-sm">View PDF Receipt</span>
                      </a>
                    ) : (
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                        <img src={receiptUrl} alt="Receipt" className="max-h-32 rounded object-contain" />
                      </a>
                    )}
                  </div>
                  <button type="button" onClick={handleDeleteReceipt}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remove receipt
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) handleReceiptUpload(file)
                      e.target.value = ''
                    }}
                  />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50">
                    <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <button type="button" onClick={handlePaste} disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50">
                    <Clipboard className="w-4 h-4" /> Paste
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">Save the expense first, then add a receipt.</p>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors">{editing ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FarmFinances
