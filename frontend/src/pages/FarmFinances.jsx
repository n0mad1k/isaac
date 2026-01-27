import React, { useState, useEffect } from 'react'
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

function FarmFinances() {
  const [activeTab, setActiveTab] = useState('overview')
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

  // Modal states
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [showHarvestAllocationModal, setShowHarvestAllocationModal] = useState(false)

  // Edit states
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editingOrder, setEditingOrder] = useState(null)
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null)
  const [selectedProductionForAllocation, setSelectedProductionForAllocation] = useState(null)
  const [selectedHarvestForAllocation, setSelectedHarvestForAllocation] = useState(null)

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

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [summaryRes, livestockRes, harvestsRes, salesRes, customersRes, ordersRes, outstandingRes] = await Promise.all([
        getFinancialSummary(selectedYear),
        getLivestockProductions({ year: selectedYear }),
        getPlantHarvests({ year: selectedYear }),
        getSales({ year: selectedYear }),
        getCustomers({ active_only: false }),
        getOrders(),
        getOutstandingPayments(),
      ])
      setFinancialSummary(summaryRes.data)
      setLivestock(livestockRes.data)
      setHarvests(harvestsRes.data)
      setSales(salesRes.data)
      setCustomers(customersRes.data)
      setOrders(ordersRes.data)
      setOutstandingPayments(outstandingRes.data)
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
      status: 'reserved',
      order_date: format(new Date(), 'yyyy-MM-dd'),
      expected_ready_date: '',
      notes: '',
    })
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
    { key: 'livestock', label: 'Livestock', icon: Beef },
    { key: 'harvests', label: 'Harvests', icon: Apple },
    { key: 'orders', label: 'Orders', icon: ClipboardList },
    { key: 'customers', label: 'Customers', icon: Users },
  ]

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
          {activeTab === 'customers' && (
            <button
              onClick={() => {
                setEditingCustomer(null)
                setCustomerFormData({ name: '', email: '', phone: '', address: '', notes: '' })
                setShowCustomerModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Customer
            </button>
          )}
          {activeTab === 'orders' && (
            <button
              onClick={() => {
                setEditingOrder(null)
                resetOrderForm()
                setShowOrderModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Order
            </button>
          )}
          {activeTab === 'overview' && (
            <button
              onClick={() => setShowSaleModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Record Sale
            </button>
          )}
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
          sales={sales}
          formatCurrency={formatCurrency}
          getCategoryColor={getCategoryColor}
          handleDeleteSale={handleDeleteSale}
          onAddPayment={(order) => {
            setSelectedOrderForPayment(order)
            setShowPaymentModal(true)
          }}
        />
      )}

      {activeTab === 'livestock' && (
        <LivestockTab
          livestock={livestock}
          formatAnimalType={formatAnimalType}
          formatCurrency={formatCurrency}
          handleDeleteLivestock={handleDeleteLivestock}
          onAllocate={(prod) => {
            setSelectedProductionForAllocation(prod)
            setAllocationFormData({ allocation_type: 'personal', percentage: '', notes: '' })
            setShowAllocationModal(true)
          }}
        />
      )}

      {activeTab === 'harvests' && (
        <HarvestsTab
          harvests={harvests}
          formatQuality={formatQuality}
          handleDeleteHarvest={handleDeleteHarvest}
          onAllocate={(harvest) => {
            setSelectedHarvestForAllocation(harvest)
            setHarvestAllocationFormData({ use_type: 'consumed', quantity: '', notes: '' })
            setShowHarvestAllocationModal(true)
          }}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersTab
          orders={orders}
          customers={customers}
          livestock={livestock}
          formatCurrency={formatCurrency}
          getStatusBadge={getStatusBadge}
          getPaymentProgress={getPaymentProgress}
          onEdit={(order) => {
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
              status: order.status,
              order_date: order.order_date,
              expected_ready_date: order.expected_ready_date || '',
              notes: order.notes || '',
            })
            setShowOrderModal(true)
          }}
          onDelete={handleDeleteOrder}
          onComplete={handleCompleteOrder}
          onAddPayment={(order) => {
            setSelectedOrderForPayment(order)
            setShowPaymentModal(true)
          }}
          onDeletePayment={handleDeletePayment}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersTab
          customers={customers}
          onEdit={(customer) => {
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
          onDelete={handleDeleteCustomer}
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
    </div>
  )
}

// ==================== Tab Components ====================

function OverviewTab({ summary, outstandingPayments, sales, formatCurrency, getCategoryColor, handleDeleteSale, onAddPayment }) {
  if (!summary) return null

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
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
            <Scale className="w-4 h-4" />
            <span className="text-sm">Cost/lb</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {formatCurrency(summary.livestock?.avg_cost_per_pound)}
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Livestock Stats */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Beef className="w-5 h-5 text-red-400" />
            Meat Production
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Animals Processed</span>
              <span>{summary.livestock?.total_processed || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Meat</span>
              <span>{(summary.livestock?.total_meat_lbs || 0).toFixed(0)} lbs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Avg Cost/lb</span>
              <span className="text-cyan-400">{formatCurrency(summary.livestock?.avg_cost_per_pound)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Expenses</span>
              <span className="text-yellow-400">{formatCurrency(summary.livestock?.total_expenses)}</span>
            </div>
          </div>
        </div>

        {/* Harvests Stats */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Apple className="w-5 h-5 text-green-400" />
            Harvests
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Harvests</span>
              <span>{summary.harvests?.total_harvests || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Consumed</span>
              <span className="text-blue-400">{summary.harvests?.consumed || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sold</span>
              <span className="text-green-400">{summary.harvests?.sold || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Preserved</span>
              <span className="text-yellow-400">{summary.harvests?.preserved || 0}</span>
            </div>
          </div>
        </div>

        {/* Orders Stats */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            Orders
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Orders</span>
              <span>{summary.orders?.total_orders || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Completed</span>
              <span className="text-green-400">{summary.orders?.completed_orders || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active</span>
              <span className="text-blue-400">{summary.orders?.active_orders || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Collected</span>
              <span className="text-green-400">{formatCurrency(summary.orders?.total_collected)}</span>
            </div>
          </div>
        </div>

        {/* Personal Use / Allocations */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <HomeIcon className="w-5 h-5 text-purple-400" />
            Personal Use
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Meat Kept</span>
              <span>{(summary.allocations?.personal_weight || 0).toFixed(0)} lbs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Meat Sold</span>
              <span>{(summary.allocations?.sold_weight || 0).toFixed(0)} lbs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Personal Value</span>
              <span className="text-cyan-400">{formatCurrency(summary.allocations?.personal_cost)}</span>
            </div>
          </div>
        </div>
      </div>

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

      {/* Recent Sales */}
      {sales.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-400" />
            Recent Sales
          </h3>
          {sales.slice(0, 5).map((sale) => (
            <div
              key={sale.id}
              className={`bg-gray-800 rounded-lg p-4 border-l-4 ${getCategoryColor(sale.category)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{sale.item_name}</h3>
                    <span className="text-xs px-2 py-0.5 bg-gray-700 rounded capitalize">
                      {sale.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-green-400 font-medium text-lg">
                      {formatCurrency(sale.total_price)}
                    </span>
                    <span className="text-gray-400">
                      {sale.quantity} {sale.unit} @ {formatCurrency(sale.unit_price)}/{sale.unit}
                    </span>
                    {sale.sale_date && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(sale.sale_date), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSale(sale.id, sale.item_name)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LivestockTab({ livestock, formatAnimalType, formatCurrency, handleDeleteLivestock, onAllocate }) {
  if (livestock.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
        <Beef className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>No livestock production records</p>
        <p className="text-sm mt-2">Archive livestock from the Animals page to track production</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {livestock.map((record) => (
        <div
          key={record.id}
          className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-lg">{record.animal_name}</h3>
                <span className="text-sm text-gray-400">
                  {formatAnimalType(record.animal_type)}
                </span>
                {record.breed && (
                  <span className="text-sm text-gray-500">- {record.breed}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                {record.slaughter_date && (
                  <span className="flex items-center gap-1 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(record.slaughter_date), 'MMM d, yyyy')}
                  </span>
                )}
                {record.processor && (
                  <span className="text-gray-400">Processor: {record.processor}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                {record.live_weight && (
                  <span className="text-gray-400">
                    Live: <span className="text-white">{record.live_weight} lbs</span>
                  </span>
                )}
                {record.hanging_weight && (
                  <span className="text-gray-400">
                    Hanging: <span className="text-white">{record.hanging_weight} lbs</span>
                  </span>
                )}
                {record.final_weight && (
                  <span className="text-gray-400">
                    Final: <span className="text-green-400 font-medium">{record.final_weight} lbs</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                {record.total_expenses > 0 && (
                  <span className="text-gray-400">
                    Expenses: <span className="text-yellow-400">{formatCurrency(record.total_expenses)}</span>
                  </span>
                )}
                {record.processing_cost > 0 && (
                  <span className="text-gray-400">
                    Processing: <span className="text-yellow-400">{formatCurrency(record.processing_cost)}</span>
                  </span>
                )}
                {record.cost_per_pound > 0 && (
                  <span className="text-gray-400">
                    Cost/lb: <span className="text-cyan-400 font-medium">{formatCurrency(record.cost_per_pound)}</span>
                  </span>
                )}
              </div>
              {record.notes && (
                <p className="text-sm text-gray-500 mt-2">{record.notes}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onAllocate(record)}
                className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                title="Allocate"
              >
                <Percent className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteLivestock(record.id, record.animal_name)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function HarvestsTab({ harvests, formatQuality, handleDeleteHarvest, onAllocate }) {
  if (harvests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
        <Apple className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>No harvest records</p>
        <p className="text-sm mt-2">Record harvests from the Plants page</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {harvests.map((record) => (
        <div
          key={record.id}
          className="bg-gray-800 rounded-lg p-4 border-l-4 border-green-500"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{record.plant_name}</h3>
                {record.plant_variety && (
                  <span className="text-sm text-gray-400">({record.plant_variety})</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded ${formatQuality(record.quality)}`}>
                  {record.quality}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-green-400 font-medium text-lg">
                  {record.quantity} {record.unit}
                </span>
                {record.harvest_date && (
                  <span className="flex items-center gap-1 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(record.harvest_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
              {record.notes && (
                <p className="text-sm text-gray-500 mt-2">{record.notes}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onAllocate(record)}
                className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                title="Track Usage"
              >
                <Percent className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteHarvest(record.id, record.plant_name)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function OrdersTab({ orders, customers, livestock, formatCurrency, getStatusBadge, getPaymentProgress, onEdit, onDelete, onComplete, onAddPayment, onDeletePayment }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
        <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>No orders yet</p>
        <p className="text-sm mt-2">Create orders to track livestock sales with multiple payments</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const statusBadge = getStatusBadge(order.status)
        const progress = getPaymentProgress(order)
        const total = order.final_total || order.estimated_total || 0

        return (
          <div key={order.id} className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-lg">{order.customer_name || 'Unknown Customer'}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusBadge.color} text-white`}>
                    {statusBadge.label}
                  </span>
                </div>
                {order.description && (
                  <p className="text-gray-400 text-sm mt-1">{order.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(order)}
                  className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {order.status !== 'completed' && order.status !== 'cancelled' && (
                  <button
                    onClick={() => onComplete(order.id)}
                    className="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Complete"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onDelete(order.id)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Order Details */}
            <div className="grid md:grid-cols-3 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-400">Portion:</span>{' '}
                <span className="capitalize">{order.portion_type}</span>
                {order.portion_percentage !== 100 && ` (${order.portion_percentage}%)`}
              </div>
              {order.estimated_weight && (
                <div>
                  <span className="text-gray-400">Est. Weight:</span>{' '}
                  {order.estimated_weight} lbs
                </div>
              )}
              {order.actual_weight && (
                <div>
                  <span className="text-gray-400">Actual Weight:</span>{' '}
                  <span className="text-green-400">{order.actual_weight} lbs</span>
                </div>
              )}
              {order.price_per_pound && (
                <div>
                  <span className="text-gray-400">Price/lb:</span>{' '}
                  {formatCurrency(order.price_per_pound)}
                </div>
              )}
              {order.order_date && (
                <div>
                  <span className="text-gray-400">Order Date:</span>{' '}
                  {format(new Date(order.order_date), 'MMM d, yyyy')}
                </div>
              )}
              {order.expected_ready_date && (
                <div>
                  <span className="text-gray-400">Expected Ready:</span>{' '}
                  {format(new Date(order.expected_ready_date), 'MMM d, yyyy')}
                </div>
              )}
            </div>

            {/* Payment Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Payment Progress</span>
                <span>
                  <span className="text-green-400">{formatCurrency(order.total_paid)}</span>
                  {' / '}
                  <span>{formatCurrency(total)}</span>
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {order.balance_due > 0 && (
                <div className="text-right text-sm mt-1">
                  <span className="text-orange-400">{formatCurrency(order.balance_due)} remaining</span>
                </div>
              )}
            </div>

            {/* Payments List */}
            {order.payments && order.payments.length > 0 && (
              <div className="border-t border-gray-700 pt-3 mt-3">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Payments</h4>
                <div className="space-y-2">
                  {order.payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <span className="capitalize">{payment.payment_type}</span>
                        <span className="text-gray-400">via {payment.payment_method}</span>
                        {payment.reference && (
                          <span className="text-gray-500">#{payment.reference}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={payment.payment_type === 'refund' ? 'text-red-400' : 'text-green-400'}>
                          {payment.payment_type === 'refund' ? '-' : '+'}{formatCurrency(payment.amount)}
                        </span>
                        <span className="text-gray-500">{format(new Date(payment.payment_date), 'M/d/yy')}</span>
                        <button
                          onClick={() => onDeletePayment(order.id, payment.id)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Payment Button */}
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <button
                onClick={() => onAddPayment(order)}
                className="mt-3 text-sm text-farm-green hover:text-farm-green-light flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Payment
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CustomersTab({ customers, onEdit, onDelete }) {
  const activeCustomers = customers.filter(c => c.is_active)
  const inactiveCustomers = customers.filter(c => !c.is_active)

  if (customers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>No customers yet</p>
        <p className="text-sm mt-2">Add customers to track sales and orders</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Active Customers Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left p-4 text-sm font-medium text-gray-400">Name</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Contact</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400 hidden md:table-cell">Address</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400 hidden lg:table-cell">Notes</th>
              <th className="text-right p-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeCustomers.map((customer) => (
              <tr key={customer.id} className="border-b border-gray-700 last:border-0 hover:bg-gray-700/50">
                <td className="p-4">
                  <span className="font-medium">{customer.name}</span>
                </td>
                <td className="p-4">
                  {customer.email && (
                    <div className="text-sm text-gray-400">{customer.email}</div>
                  )}
                  {customer.phone && (
                    <div className="text-sm text-gray-400">{customer.phone}</div>
                  )}
                </td>
                <td className="p-4 hidden md:table-cell">
                  {customer.address && (
                    <span className="text-sm text-gray-400">{customer.address}</span>
                  )}
                </td>
                <td className="p-4 hidden lg:table-cell">
                  {customer.notes && (
                    <span className="text-sm text-gray-500 italic">{customer.notes}</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onEdit(customer)}
                      className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(customer.id, customer.name)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inactive Customers */}
      {inactiveCustomers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Inactive Customers</h3>
          <div className="bg-gray-800/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                {inactiveCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-700 last:border-0 opacity-60">
                    <td className="p-4 font-medium">{customer.name}</td>
                    <td className="p-4 text-sm text-gray-400">{customer.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Modal Components ====================

function SaleModal({ formData, setFormData, customers, onSubmit, onClose, formatCurrency }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              Record Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerModal({ formData, setFormData, editing, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h2 className="text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              {editing ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OrderModal({ formData, setFormData, customers, livestock, editing, onSubmit, onClose, formatCurrency }) {
  const estimatedTotal = (formData.estimated_weight && formData.price_per_pound)
    ? parseFloat(formData.estimated_weight) * parseFloat(formData.price_per_pound)
    : 0

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
      <div className="bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h2 className="text-lg font-semibold">{editing ? 'Edit Order' : 'New Order'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Customer</label>
            <select
              value={formData.customer_id || ''}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              <option value="">-- Select Customer --</option>
              {customers.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {!formData.customer_id && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Customer Name (if not in list)</label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Linked Livestock (Optional)</label>
            <select
              value={formData.livestock_production_id || ''}
              onChange={(e) => setFormData({ ...formData, livestock_production_id: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              <option value="">-- No Link --</option>
              {livestock.map(l => (
                <option key={l.id} value={l.id}>{l.animal_name} ({l.animal_type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., 1/2 Beef - Brody"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Portion</label>
              <select
                value={formData.portion_type}
                onChange={(e) => handlePortionChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                {PORTION_TYPES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            {formData.portion_type === 'custom' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Percentage</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.portion_percentage}
                  onChange={(e) => setFormData({ ...formData, portion_percentage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Estimated Weight (lbs)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.estimated_weight}
                onChange={(e) => setFormData({ ...formData, estimated_weight: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Price per Pound</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price_per_pound}
                onChange={(e) => setFormData({ ...formData, price_per_pound: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          {estimatedTotal > 0 && (
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <span className="text-gray-400">Estimated Total:</span>
              <span className="text-2xl font-bold text-green-400 ml-2">
                {formatCurrency(estimatedTotal)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Order Date</label>
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Expected Ready Date</label>
              <input
                type="date"
                value={formData.expected_ready_date}
                onChange={(e) => setFormData({ ...formData, expected_ready_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              {ORDER_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              {editing ? 'Save Changes' : 'Create Order'}
            </button>
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
      <div className="bg-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2 bg-gray-700/50">
          <div className="text-sm text-gray-400">Order: {order.customer_name}</div>
          <div className="text-sm">
            Balance: <span className="text-orange-400 font-medium">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Payment Type</label>
              <select
                value={formData.payment_type}
                onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                {PAYMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
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
              placeholder={`Remaining: ${formatCurrency(remaining)}`}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Payment Date</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Reference #</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Check #, ID, etc."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              Add Payment
            </button>
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
      <div className="bg-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Allocate for Personal Use</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
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
            <input
              type="number"
              required
              min="0"
              max="100"
              step="0.1"
              value={formData.percentage}
              onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
              placeholder="e.g., 50 for half"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
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
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              Allocate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HarvestAllocationModal({ harvest, formData, setFormData, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Track Harvest Usage</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2 bg-gray-700/50">
          <div className="text-sm text-gray-400">{harvest.plant_name}</div>
          <div className="text-sm">
            Total Harvest: <span className="font-medium">{harvest.quantity} {harvest.unit}</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Quantity Consumed *</label>
            <div className="flex gap-2">
              <input
                type="number"
                required
                min="0"
                step="0.1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
              <span className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                {harvest.unit}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
            >
              Record Usage
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FarmFinances
