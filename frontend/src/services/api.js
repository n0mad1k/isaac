import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  withCredentials: true,  // Include HttpOnly cookies for session auth
})

// No Authorization header interceptor - auth is handled by HttpOnly cookies
// This is more secure as cookies can't be accessed by JavaScript/XSS attacks

// Handle auth errors with better messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const detail = error.response?.data?.detail

    if (status === 401) {
      localStorage.removeItem('auth_user')
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (status === 403) {
      // Permission denied - create a more user-friendly error
      const message = detail || 'You do not have permission to perform this action'
      error.userMessage = message
      console.warn('Permission denied:', message)
    }

    // Enhance error with user-friendly message for display
    if (!error.userMessage) {
      if (status === 400) {
        error.userMessage = detail || 'Invalid request. Please check your input.'
      } else if (status === 404) {
        error.userMessage = detail || 'The requested item was not found.'
      } else if (status >= 500) {
        error.userMessage = 'Server error. Please try again later.'
      } else if (error.code === 'ECONNABORTED') {
        error.userMessage = 'Request timed out. Please try again.'
      } else if (!error.response) {
        error.userMessage = 'Network error. Please check your connection.'
      } else {
        error.userMessage = detail || 'An error occurred. Please try again.'
      }
    }

    return Promise.reject(error)
  }
)

// Dashboard - longer timeout for complex queries
export const getDashboard = () => api.get('/dashboard/', { timeout: 20000 })
export const getQuickStats = () => api.get('/dashboard/quick-stats/')
export const getCalendarMonth = (year, month) =>
  api.get(`/dashboard/calendar/${year}/${month}`)
export const getCalendarWeek = (year, month, day) =>
  api.get(`/dashboard/calendar/week/${year}/${month}/${day}`)
export const getColdProtection = () => api.get('/dashboard/cold-protection/')
export const getFreezeWarning = () => api.get('/dashboard/freeze-warning/')

// Weather
export const getCurrentWeather = () => api.get('/weather/current/')
export const refreshWeather = () => api.post('/weather/refresh/')
export const getWeatherAlerts = () => api.get('/weather/alerts/')
export const getWeatherForecast = () => api.get('/weather/forecast/')
export const getRainForecast = () => api.get('/weather/rain-forecast/')
export const acknowledgeAlert = (id) => api.post(`/weather/alerts/${id}/acknowledge/`)
export const dismissAlert = (id) => api.post(`/weather/alerts/${id}/dismiss/`)

// Plants
export const getPlants = (params) => api.get('/plants/', { params })
export const getPlant = (id) => api.get(`/plants/${id}/`)
export const createPlant = (data) => api.post('/plants/', data)
export const updatePlant = (id, data) => api.patch(`/plants/${id}/`, data)
export const deletePlant = (id) => api.delete(`/plants/${id}/`)
export const addPlantCareLog = (plantId, data) =>
  api.post(`/plants/${plantId}/care-logs/`, data)
export const getPlantCareLogs = (plantId, params) =>
  api.get(`/plants/${plantId}/care-logs/`, { params })
export const getPlantTags = () => api.get('/plants/tags/')
export const createPlantTag = (name, color) =>
  api.post('/plants/tags/', null, { params: { name, color } })
export const getPlantsNeedingWater = () => api.get('/plants/needs-water/today/')
export const getPlantsNeedingFertilizer = () => api.get('/plants/needs-fertilizer/today/')
export const getFrostSensitivePlants = () => api.get('/plants/frost-sensitive/list/')
export const getWaterOverview = (days = 7) => api.get('/plants/water-overview/', { params: { days } })
export const searchPlantImport = (q) => api.get('/plants/import/search/', { params: { q } })
export const previewPlantImport = (url) => api.post('/plants/import/preview/', { url })
export const importPlant = (url) => api.post('/plants/import/', { url })
export const waterPlant = (plantId, notes = null) =>
  api.post(`/plants/${plantId}/water/`, null, { params: { notes } })
export const skipWatering = (plantId, reason, notes = null) =>
  api.post(`/plants/${plantId}/skip-watering/`, { reason, notes })
export const getWateringHistory = (plantId) =>
  api.get(`/plants/${plantId}/watering-history/`)
export const uploadPlantPhoto = (id, formData) =>
  api.post(`/plants/${id}/photo/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
export const deletePlantPhoto = (id) => api.delete(`/plants/${id}/photo/`)
export const getPlantPhotoUrl = (path) =>
  path ? `${api.defaults.baseURL}/plants/photos/${path.split('/').pop()}` : null

// Animals
export const getAnimals = (params) => api.get('/animals/', { params })
export const getAnimal = (id) => api.get(`/animals/${id}/`)
export const createAnimal = (data) => api.post('/animals/', data)
export const updateAnimal = (id, data) => api.patch(`/animals/${id}/`, data)
export const deleteAnimal = (id) => api.delete(`/animals/${id}/`)
export const addAnimalCareLog = (animalId, data) =>
  api.post(`/animals/${animalId}/care-logs/`, data)
export const getAnimalCareLogs = (animalId, params) =>
  api.get(`/animals/${animalId}/care-logs/`, { params })
// Animal expenses
export const getAnimalExpenses = (animalId, params) =>
  api.get(`/animals/${animalId}/expenses/`, { params })
export const addAnimalExpense = (animalId, data) =>
  api.post(`/animals/${animalId}/expenses/`, data)
export const updateAnimalExpense = (expenseId, data) =>
  api.put(`/animals/expenses/${expenseId}/`, data)
export const deleteAnimalExpense = (expenseId) =>
  api.delete(`/animals/expenses/${expenseId}/`)
export const getAnimalTotalExpenses = (animalId) =>
  api.get(`/animals/${animalId}/expenses/total/`)
export const createSplitExpense = (data) =>
  api.post('/animals/expenses/split/', data)
export const uploadAnimalExpenseReceipt = (id, formData) =>
  api.post(`/animals/expenses/${id}/receipt/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
export const deleteAnimalExpenseReceipt = (id) => api.delete(`/animals/expenses/${id}/receipt/`)
export const getAnimalExpenseReceiptUrl = (path) =>
  path ? `${api.defaults.baseURL}/animals/expenses/receipts/${path.split('/').pop()}` : null
export const exportAnimalExpenses = (animalId) =>
  `${api.defaults.baseURL}/animals/${animalId}/expenses/export/`
export const exportAllExpenses = () =>
  `${api.defaults.baseURL}/animals/expenses/export/all/`
// Category lists
export const getPets = () => api.get('/animals/pets/list/')
export const getLivestock = () => api.get('/animals/livestock/list/')
// Care due endpoints
export const getAnimalsNeedingWorming = (days = 14) =>
  api.get('/animals/care-due/worming/', { params: { days } })
export const getAnimalsNeedingVaccination = (days = 30) =>
  api.get('/animals/care-due/vaccination/', { params: { days } })
export const getAnimalsNeedingHoofTrim = (days = 14) =>
  api.get('/animals/care-due/hoof-trim/', { params: { days } })
export const getAnimalsNeedingDental = (days = 30) =>
  api.get('/animals/care-due/dental/', { params: { days } })
export const getLivestockApproachingSlaughter = (days = 30) =>
  api.get('/animals/livestock/approaching-slaughter/', { params: { days } })
export const getColdSensitiveAnimals = (temp) =>
  api.get('/animals/cold-sensitive/', { params: temp ? { temp } : {} })
export const getAnimalsNeedingBlanket = (temp) =>
  api.get('/animals/needs-blanket/', { params: { temp } })
// Animal Care Schedules
export const getAnimalCareSchedules = (animalId) =>
  api.get(`/animals/${animalId}/care-schedules/`)
export const createCareSchedule = (animalId, data) =>
  api.post(`/animals/${animalId}/care-schedules/`, data)
export const updateCareSchedule = (animalId, scheduleId, data) =>
  api.patch(`/animals/${animalId}/care-schedules/${scheduleId}/`, data)
export const completeCareSchedule = (animalId, scheduleId) =>
  api.post(`/animals/${animalId}/care-schedules/${scheduleId}/complete/`)
export const deleteCareSchedule = (animalId, scheduleId) =>
  api.delete(`/animals/${animalId}/care-schedules/${scheduleId}/`)
export const createBulkCareSchedule = (data) =>
  api.post('/animals/care-schedules/bulk/', data)
// Animal Feeds
export const getAnimalFeeds = (animalId) =>
  api.get(`/animals/${animalId}/feeds/`)
export const createAnimalFeed = (animalId, data) =>
  api.post(`/animals/${animalId}/feeds/`, data)
export const updateAnimalFeed = (animalId, feedId, data) =>
  api.patch(`/animals/${animalId}/feeds/${feedId}/`, data)
export const deleteAnimalFeed = (animalId, feedId) =>
  api.delete(`/animals/${animalId}/feeds/${feedId}/`)

// Tasks
export const getTasks = (params) => api.get('/tasks/', { params })
export const getTodaysTasks = () => api.get('/tasks/today/')
export const getUpcomingTasks = (days = 7) =>
  api.get('/tasks/upcoming/', { params: { days } })
export const getOverdueTasks = () => api.get('/tasks/overdue/')
export const getTasksByEntity = (entityType, entityId) => api.get(`/tasks/by-entity/${entityType}/${entityId}`)
export const createTask = (data) => api.post('/tasks/', data)
export const updateTask = (id, data) => api.patch(`/tasks/${id}/`, data)
export const completeTask = (id) => api.post(`/tasks/${id}/complete/`)
export const uncompleteTask = (id) => api.post(`/tasks/${id}/uncomplete/`)
export const toggleBacklog = (id) => api.post(`/tasks/${id}/backlog/`)
export const deleteTask = (id) => api.delete(`/tasks/${id}/`)
export const deleteTaskOccurrence = (id, date) => api.post(`/tasks/${id}/delete-occurrence/`, { date })
export const editTaskOccurrence = (id, data) => api.post(`/tasks/${id}/edit-occurrence/`, data)
export const setupMaintenanceTasks = () => api.post('/tasks/setup-maintenance/')
export const getCalDAVStatus = () => api.get('/tasks/caldav/status/')
export const syncTasksToCalDAV = () => api.post('/tasks/caldav/sync/')
export const getTaskMetrics = () => api.get('/tasks/metrics/')

// Seeds
export const getSeeds = (params) => api.get('/seeds/', { params })
export const getSeed = (id) => api.get(`/seeds/${id}/`)
export const createSeed = (data) => api.post('/seeds/', data)
export const updateSeed = (id, data) => api.patch(`/seeds/${id}/`, data)
export const deleteSeed = (id) => api.delete(`/seeds/${id}/`)
export const getSeedStats = () => api.get('/seeds/stats/')
export const getSeedCategories = () => api.get('/seeds/categories/')
export const uploadSeedPhoto = (id, formData) =>
  api.post(`/seeds/${id}/photo/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
export const deleteSeedPhoto = (id) => api.delete(`/seeds/${id}/photo/`)
export const getSeedPhotoUrl = (path) =>
  path ? `${api.defaults.baseURL}/seeds/photos/${path.split('/').pop()}` : null

// Garden Planner
export const getFrostDates = () => api.get('/garden/frost-dates/')
export const updateFrostDates = (data) => api.put('/garden/frost-dates/', data)
export const getPlantingSchedule = (year) => api.get('/garden/planting-schedule/', { params: year ? { year } : {} })
export const getGardenOverview = () => api.get('/garden/overview/')
export const getPlantingEvents = (year) => api.get('/garden/events/', { params: year ? { year } : {} })
export const createPlantingEvent = (data) => api.post('/garden/events/', data)
export const updatePlantingEvent = (id, data) => api.patch(`/garden/events/${id}/`, data)
export const deletePlantingEvent = (id) => api.delete(`/garden/events/${id}/`)
export const completePlantingEvent = (id) => api.post(`/garden/events/${id}/complete/`)
export const startFromSeed = (data) => api.post('/plants/start-from-seed/', data)

// Succession Planting
export const createSuccessionPlanting = (data) => api.post('/garden/events/succession/', data)
export const deleteSuccessionGroup = (groupId) => api.delete(`/garden/events/succession/${groupId}/`)

// Garden Journal
export const getJournalEntries = (params) => api.get('/garden/journal/', { params })
export const createJournalEntry = (data) => api.post('/garden/journal/', data)
export const updateJournalEntry = (id, data) => api.patch(`/garden/journal/${id}/`, data)
export const deleteJournalEntry = (id) => api.delete(`/garden/journal/${id}/`)
export const uploadJournalPhoto = (id, formData) =>
  api.post(`/garden/journal/${id}/photo/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
export const getJournalPhotoUrl = (path) =>
  path ? `${api.defaults.baseURL}/garden/journal/photos/${path.split('/').pop()}` : null

// Companion Planting
export const getCompanionChart = () => api.get('/garden/companions/')
export const getCompanions = (plantName) => api.get(`/garden/companions/${encodeURIComponent(plantName)}`)

// Garden Beds
export const getGardenBeds = () => api.get('/garden/beds/')
export const createGardenBed = (data) => api.post('/garden/beds/', data)
export const updateGardenBed = (id, data) => api.patch(`/garden/beds/${id}/`, data)
export const deleteGardenBed = (id) => api.delete(`/garden/beds/${id}/`)
export const addBedPlanting = (bedId, data) => api.post(`/garden/beds/${bedId}/plantings/`, data)
export const removeBedPlanting = (bedId, plantingId) => api.delete(`/garden/beds/${bedId}/plantings/${plantingId}/`)
export const moveBedPlanting = (bedId, plantingId, data) => api.patch(`/garden/beds/${bedId}/plantings/${plantingId}/`, data)

// Settings
export const getSettings = () => api.get('/settings/')
export const getSetting = (key) => api.get(`/settings/${key}/`)
export const updateSetting = (key, value) => api.put(`/settings/${key}/`, { value })
export const resetSetting = (key) => api.post(`/settings/${key}/reset/`)
export const resetAllSettings = () => api.post('/settings/reset-all/')
export const testColdProtectionEmail = () => api.post('/settings/test-cold-protection-email/')
export const testCalendarSync = () => api.post('/settings/test-calendar-sync/', {}, { timeout: 15000 })
export const testDailyDigest = () => api.post('/settings/test-daily-digest/')
export const testGearAlerts = () => api.post('/settings/test-gear-alerts/')
export const testTrainingAlerts = () => api.post('/settings/test-training-alerts/')
export const testMedicalAlerts = () => api.post('/settings/test-medical-alerts/')
export const testTeamAlertsDigest = () => api.post('/settings/test-team-alerts-digest/')
export const syncCalendar = () => api.post('/settings/sync-calendar/', {}, { timeout: 15000 }) // 15sec timeout for CalDAV connection
export const getVersionInfo = () => api.get('/settings/version/')
export const toggleKeyboard = () => api.post('/settings/keyboard/toggle/')
export const updateApplication = () => api.post('/settings/update/')
export const pushToProduction = () => api.post('/settings/push-to-prod/', {}, { timeout: 300000 }) // 5 min for build
export const pullFromProduction = () => api.post('/settings/pull-from-prod/', {}, { timeout: 60000 }) // 1 min for db copy
export const getRecentCommits = () => api.get('/settings/recent-commits/')
export const getLogFiles = () => api.get('/settings/admin-logs/files/')
export const getAppLogs = (lines = 100, level = null, search = null, logFile = 'app') => {
  const params = new URLSearchParams({ lines: lines.toString(), log_file: logFile })
  if (level) params.append('level', level)
  if (search) params.append('search', search)
  return api.get(`/settings/admin-logs/?${params.toString()}`)
}
export const clearAppLogs = () => api.post('/settings/admin-logs/clear/')

// Health Monitoring
export const runHealthCheck = () => api.get('/settings/health-check/')
export const getHealthLogs = (limit = 100, status = null) => {
  const params = new URLSearchParams({ limit: limit.toString() })
  if (status) params.append('status', status)
  return api.get(`/settings/health-logs/?${params.toString()}`)
}
export const getHealthSummary = () => api.get('/settings/health-summary/')
export const clearHealthLogs = (olderThanDays = 7) =>
  api.delete(`/settings/health-logs/`, { params: { older_than_days: olderThanDays } })

// Storage
export const getStorageStats = () => api.get('/dashboard/storage/')
export const clearLogs = () => api.post('/dashboard/storage/clear-logs/')

// Home Maintenance
export const getHomeMaintenance = (params) => api.get('/home-maintenance/', { params })
export const getHomeMaintenanceTask = (id) => api.get(`/home-maintenance/${id}/`)
export const createHomeMaintenance = (data) => api.post('/home-maintenance/', data)
export const updateHomeMaintenance = (id, data) => api.put(`/home-maintenance/${id}/`, data)
export const deleteHomeMaintenance = (id) => api.delete(`/home-maintenance/${id}/`)
export const completeHomeMaintenance = (id, data) => api.post(`/home-maintenance/${id}/complete/`, data)
export const setHomeMaintenanceDueDate = (id, dueDate) =>
  api.put(`/home-maintenance/${id}/due-date/`, { due_date: dueDate })
export const getHomeMaintenanceLogs = (id) => api.get(`/home-maintenance/${id}/logs/`)
export const getHomeMaintenanceCategories = () => api.get('/home-maintenance/categories/list/')
export const getHomeMaintenanceAreas = () => api.get('/home-maintenance/areas/list/')

// Vehicles
export const getVehicles = (params) => api.get('/vehicles/', { params })
export const getVehicle = (id) => api.get(`/vehicles/${id}/`)
export const createVehicle = (data) => api.post('/vehicles/', data)
export const updateVehicle = (id, data) => api.put(`/vehicles/${id}/`, data)
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}/`)
export const updateVehicleMileage = (id, mileage, hours) =>
  api.put(`/vehicles/${id}/mileage/`, null, { params: { mileage, hours } })
export const getVehicleMaintenance = (vehicleId, params) =>
  api.get(`/vehicles/${vehicleId}/maintenance/`, { params })
export const createVehicleMaintenance = (vehicleId, data) =>
  api.post(`/vehicles/${vehicleId}/maintenance/`, data)
export const updateVehicleMaintenance = (taskId, data) =>
  api.put(`/vehicles/maintenance/${taskId}`, data)
export const deleteVehicleMaintenance = (taskId) =>
  api.delete(`/vehicles/maintenance/${taskId}`)
export const completeVehicleMaintenance = (taskId, data) =>
  api.post(`/vehicles/maintenance/${taskId}/complete`, data)
export const setVehicleMaintenanceDueDate = (taskId, dueDate) =>
  api.put(`/vehicles/maintenance/${taskId}/due-date`, { due_date: dueDate })
export const getVehicleLogs = (vehicleId) => api.get(`/vehicles/${vehicleId}/logs/`)
export const getVehicleTypes = () => api.get('/vehicles/types/list/')

// Equipment
export const getEquipment = (params) => api.get('/equipment/', { params })
export const getEquipmentItem = (id) => api.get(`/equipment/${id}/`)
export const createEquipment = (data) => api.post('/equipment/', data)
export const updateEquipment = (id, data) => api.put(`/equipment/${id}/`, data)
export const deleteEquipment = (id) => api.delete(`/equipment/${id}/`)
export const updateEquipmentHours = (id, hours) =>
  api.put(`/equipment/${id}/hours/`, null, { params: { hours } })
export const getEquipmentMaintenance = (equipmentId, params) =>
  api.get(`/equipment/${equipmentId}/maintenance/`, { params })
export const createEquipmentMaintenance = (equipmentId, data) =>
  api.post(`/equipment/${equipmentId}/maintenance/`, data)
export const updateEquipmentMaintenance = (taskId, data) =>
  api.put(`/equipment/maintenance/${taskId}/`, data)
export const deleteEquipmentMaintenance = (taskId) =>
  api.delete(`/equipment/maintenance/${taskId}/`)
export const completeEquipmentMaintenance = (taskId, data) =>
  api.post(`/equipment/maintenance/${taskId}/complete/`, data)
export const setEquipmentMaintenanceDueDate = (taskId, dueDate) =>
  api.put(`/equipment/maintenance/${taskId}/due-date/`, { due_date: dueDate })
export const getEquipmentLogs = (equipmentId) => api.get(`/equipment/${equipmentId}/logs/`)
export const getEquipmentTypes = () => api.get('/equipment/types/list/')

// Farm Areas
export const getFarmAreas = (params) => api.get('/farm-areas/', { params })
export const getFarmArea = (id) => api.get(`/farm-areas/${id}/`)
export const createFarmArea = (data) => api.post('/farm-areas/', data)
export const updateFarmArea = (id, data) => api.put(`/farm-areas/${id}/`, data)
export const deleteFarmArea = (id) => api.delete(`/farm-areas/${id}/`)
export const getFarmAreaMaintenance = (areaId, params) =>
  api.get(`/farm-areas/${areaId}/maintenance/`, { params })
export const createFarmAreaMaintenance = (areaId, data) =>
  api.post(`/farm-areas/${areaId}/maintenance/`, data)
export const updateFarmAreaMaintenance = (taskId, data) =>
  api.put(`/farm-areas/maintenance/${taskId}/`, data)
export const deleteFarmAreaMaintenance = (taskId) =>
  api.delete(`/farm-areas/maintenance/${taskId}/`)
export const completeFarmAreaMaintenance = (taskId, data) =>
  api.post(`/farm-areas/maintenance/${taskId}/complete/`, data)
export const setFarmAreaMaintenanceDueDate = (taskId, dueDate) =>
  api.put(`/farm-areas/maintenance/${taskId}/due-date/`, { due_date: dueDate })
export const getFarmAreaLogs = (areaId) => api.get(`/farm-areas/${areaId}/logs/`)
export const getFarmAreaTypes = () => api.get('/farm-areas/types/list/')

// Production
export const getProductionStats = (year) =>
  api.get('/production/stats/', { params: year ? { year } : {} })
export const getLivestockProductions = (params) =>
  api.get('/production/livestock/', { params })
export const getLivestockProduction = (id) => api.get(`/production/livestock/${id}/`)
export const archiveLivestock = (data) => api.post('/production/livestock/', data)
export const updateLivestockProduction = (id, data) =>
  api.patch(`/production/livestock/${id}/`, data)
export const deleteLivestockProduction = (id) => api.delete(`/production/livestock/${id}/`)
export const getPlantHarvests = (params) => api.get('/production/harvests/', { params })
export const getPlantHarvest = (id) => api.get(`/production/harvests/${id}/`)
export const recordPlantHarvest = (data) => api.post('/production/harvests/', data)
export const updatePlantHarvest = (id, data) => api.patch(`/production/harvests/${id}/`, data)
export const deletePlantHarvest = (id) => api.delete(`/production/harvests/${id}/`)
// Sales
export const getSales = (params) => api.get('/production/sales/', { params })
export const getSale = (id) => api.get(`/production/sales/${id}/`)
export const createSale = (data) => api.post('/production/sales/', data)
export const updateSale = (id, data) => api.patch(`/production/sales/${id}/`, data)
export const deleteSale = (id) => api.delete(`/production/sales/${id}/`)

// Customers
export const getCustomers = (params) => api.get('/production/customers/', { params })
export const getCustomer = (id) => api.get(`/production/customers/${id}/`)
export const createCustomer = (data) => api.post('/production/customers/', data)
export const updateCustomer = (id, data) => api.patch(`/production/customers/${id}/`, data)
export const deleteCustomer = (id) => api.delete(`/production/customers/${id}/`)

// Livestock Orders
export const getOrders = (params) => api.get('/production/orders/', { params })
export const getOrder = (id) => api.get(`/production/orders/${id}/`)
export const createOrder = (data) => api.post('/production/orders/', data)
export const updateOrder = (id, data) => api.patch(`/production/orders/${id}/`, data)
export const deleteOrder = (id) => api.delete(`/production/orders/${id}/`)
export const addOrderPayment = (orderId, data) => api.post(`/production/orders/${orderId}/payments/`, data)
export const deleteOrderPayment = (orderId, paymentId) => api.delete(`/production/orders/${orderId}/payments/${paymentId}/`)
export const sendPaymentReceipt = (orderId, paymentId, data) => api.post(`/production/orders/${orderId}/payments/${paymentId}/send-receipt/`, data || undefined)
export const completeOrder = (id) => api.post(`/production/orders/${id}/complete/`)
export const sendOrderReceipt = (id, data) => api.post(`/production/orders/${id}/send-receipt/`, data || undefined)
export const sendOrderInvoice = (id, data) => api.post(`/production/orders/${id}/send-invoice/`, data || undefined)
export const sendSaleReceipt = (id, data) => api.post(`/production/sales/${id}/send-receipt/`, data || undefined)

// Scheduled Invoices
export const getScheduledInvoices = (orderId) => api.get(`/production/orders/${orderId}/scheduled-invoices/`)
export const createScheduledInvoice = (orderId, data) => api.post(`/production/orders/${orderId}/scheduled-invoices/`, data)
export const updateScheduledInvoice = (invoiceId, data) => api.patch(`/production/scheduled-invoices/${invoiceId}/`, data)
export const deleteScheduledInvoice = (invoiceId) => api.delete(`/production/scheduled-invoices/${invoiceId}/`)
export const sendScheduledInvoice = (invoiceId) => api.post(`/production/scheduled-invoices/${invoiceId}/send/`)

// Production Allocations
export const getLivestockAllocations = (productionId) => api.get(`/production/livestock/${productionId}/allocations/`)
export const createLivestockAllocation = (productionId, data) => api.post(`/production/livestock/${productionId}/allocations/`, data)
export const deleteLivestockAllocation = (id) => api.delete(`/production/allocations/${id}/`)
export const allocatePersonal = (productionId, percentage, notes) =>
  api.post(`/production/livestock/${productionId}/allocate-personal/`, null, { params: { percentage, notes } })

// Harvest Allocations
export const getHarvestAllocations = (harvestId) => api.get(`/production/harvests/${harvestId}/allocations/`)
export const createHarvestAllocation = (harvestId, data) => api.post(`/production/harvests/${harvestId}/allocations/`, data)
export const deleteHarvestAllocation = (id) => api.delete(`/production/harvest-allocations/${id}/`)
export const allocateConsumed = (harvestId, quantity, notes) =>
  api.post(`/production/harvests/${harvestId}/allocate-consumed/`, null, { params: { quantity, notes } })

// Farm Expenses
export const getExpenses = (params) => api.get('/production/expenses/', { params })
export const createExpense = (data) => api.post('/production/expenses/', data)
export const updateExpense = (id, data) => api.patch(`/production/expenses/${id}/`, data)
export const deleteExpense = (id) => api.delete(`/production/expenses/${id}/`)
export const uploadExpenseReceipt = (id, formData) =>
  api.post(`/production/expenses/${id}/receipt/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
export const deleteExpenseReceipt = (id) => api.delete(`/production/expenses/${id}/receipt/`)
export const getExpenseReceiptUrl = (path) =>
  path ? `${api.defaults.baseURL}/production/expenses/receipts/${path.split('/').pop()}` : null

// Financial Summary
export const getFinancialSummary = (year) =>
  api.get('/production/financial-summary/', { params: year ? { year } : {} })
export const getOutstandingPayments = () => api.get('/production/outstanding-payments/')

// Authentication
export const checkAuth = () => api.get('/auth/check')
export const login = (username, password) =>
  api.post('/auth/login', { username, password })
export const logout = () => api.post('/auth/logout')
export const getCurrentUser = () => api.get('/auth/me')
export const updateCurrentUser = (data) => api.put('/auth/me', data)
export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/me/password', { current_password: currentPassword, new_password: newPassword })
export const initialSetup = (data) => api.post('/auth/setup', data)

// User Management (Admin only)
export const getUsers = () => api.get('/auth/users')
export const createUser = (data) => api.post('/auth/users', data)
export const updateUser = (userId, data) => api.put(`/auth/users/${userId}`, data)
export const updateUserRole = (userId, role) => api.put(`/auth/users/${userId}/role`, { role })
export const toggleUserStatus = (userId) => api.put(`/auth/users/${userId}/status`)
export const deleteUser = (userId) => api.delete(`/auth/users/${userId}`)
export const resetUserPassword = (userId, newPassword) =>
  api.post(`/auth/users/${userId}/reset-password`, { new_password: newPassword })

// User Invitations (Admin only)
export const inviteUser = (data) => api.post('/auth/invite', data)
export const resendInvite = (userId) => api.post(`/auth/invite/${userId}/resend`)
export const getInvitationInfo = (token) => api.get(`/auth/invitation/${token}`)
export const acceptInvitation = (token, data) => api.post(`/auth/invitation/${token}/accept`, data)

// Role Management (Admin only)
export const getRoles = () => api.get('/auth/roles')
export const getRole = (roleId) => api.get(`/auth/roles/${roleId}`)
export const createRole = (data) => api.post('/auth/roles', data)
export const updateRole = (roleId, data) => api.put(`/auth/roles/${roleId}`, data)
export const deleteRole = (roleId) => api.delete(`/auth/roles/${roleId}`)
export const getPermissionCategories = () => api.get('/auth/permissions')

// Workers
export const getWorkers = (params) => api.get('/workers/', { params })
export const getWorker = (id) => api.get(`/workers/${id}/`)
export const createWorker = (data) => api.post('/workers/', data)
export const updateWorker = (id, data) => api.patch(`/workers/${id}/`, data)
export const deleteWorker = (id) => api.delete(`/workers/${id}/`)
export const getWorkerTasks = (workerId, params) => api.get(`/workers/${workerId}/tasks/`, { params })
export const completeWorkerTask = (workerId, taskId, note) =>
  api.post(`/workers/${workerId}/tasks/${taskId}/complete/`, null, { params: { note } })
export const uncompleteWorkerTask = (workerId, taskId) =>
  api.post(`/workers/${workerId}/tasks/${taskId}/uncomplete/`)
export const blockWorkerTask = (workerId, taskId, reason) =>
  api.post(`/workers/${workerId}/tasks/${taskId}/block/`, null, { params: { reason } })
export const unblockWorkerTask = (workerId, taskId) =>
  api.post(`/workers/${workerId}/tasks/${taskId}/unblock/`)
export const updateWorkerNote = (workerId, taskId, note) =>
  api.post(`/workers/${workerId}/tasks/${taskId}/note/`, null, { params: { note } })
export const startWorkerTask = (workerId, taskId) =>
  api.post(`/workers/${workerId}/tasks/${taskId}/start/`)
export const stopWorkerTask = (workerId, taskId) =>
  api.post(`/workers/${workerId}/tasks/${taskId}/stop/`)
export const getAssignableTasks = () => api.get('/workers/assignable-tasks/')
export const assignTaskToWorker = (workerId, taskId) =>
  api.post(`/workers/${workerId}/assign/${taskId}/`)
export const unassignTaskFromWorker = (workerId, taskId) =>
  api.post(`/workers/${workerId}/unassign/${taskId}/`)
export const reorderWorkerTasks = (workerId, taskIds) =>
  api.post(`/workers/${workerId}/tasks/reorder/`, { task_ids: taskIds })
export const toggleWorkerTaskBacklog = (workerId, taskId) =>
  api.post(`/workers/${workerId}/tasks/${taskId}/backlog/`)

// Supply Requests
export const getSupplyRequests = (params) => api.get('/supply-requests/', { params })
export const getWorkerSupplyRequests = (workerId, params) =>
  api.get(`/supply-requests/worker/${workerId}/`, { params })
export const getPendingSupplyRequests = () => api.get('/supply-requests/pending/')
export const createSupplyRequest = (data) => api.post('/supply-requests/', data)
export const updateSupplyRequest = (id, data) => api.patch(`/supply-requests/${id}/`, data)
export const deleteSupplyRequest = (id) => api.delete(`/supply-requests/${id}/`)

// Dev Tracker (Dev instance only)
export const getDevTrackerItems = (params) => api.get('/dev-tracker/', { params })
export const getDevTrackerItem = (id) => api.get(`/dev-tracker/${id}/`)
export const createDevTrackerItem = (data) => api.post('/dev-tracker/', data)
export const updateDevTrackerItem = (id, data) => api.put(`/dev-tracker/${id}/`, data)
export const deleteDevTrackerItem = (id) => api.delete(`/dev-tracker/${id}/`)
export const seedFromChangelog = (version) => api.post('/dev-tracker/seed-from-changelog/', null, { params: { version } })
export const getDevTrackerStats = () => api.get('/dev-tracker/stats/summary/')
export const getDevTrackerMetrics = () => api.get('/dev-tracker/metrics/')

// Dev Tracker Images
export const uploadDevTrackerImage = (itemId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/dev-tracker/${itemId}/images/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const deleteDevTrackerImage = (itemId, imageId) => api.delete(`/dev-tracker/${itemId}/images/${imageId}/`)
export const getDevTrackerImageUrl = (filename) => `${api.defaults.baseURL}/dev-tracker/images/${filename}`

// Customer Feedback
export const checkFeedbackEnabled = () => api.get('/feedback/enabled/')
export const submitFeedback = (data) => api.post('/feedback/submit/', data)
export const getFeedbackList = (params) => api.get('/feedback/', { params })
export const pullFeedbackToTracker = () => api.post('/feedback/pull-to-tracker/')
export const pullFeedbackFromProd = () => api.post('/feedback/pull-from-prod/')
export const dismissFeedback = (id) => api.delete(`/feedback/${id}/`)
export const toggleFeedbackOnProd = (enable) =>
  api.post('/feedback/toggle-on-prod/', null, { params: { enable } })
export const getProdFeedbackStatus = () => api.get('/feedback/prod-status/')
export const listProdFeedback = () => api.get('/feedback/prod-list/')
export const reviewFeedback = (id, data) => api.post(`/feedback/review/${id}/`, data)
export const deleteProdFeedback = (id) => api.delete(`/feedback/prod/${id}/`)

// User feedback management (for viewing/editing own feedback)
export const getMyFeedback = () => api.get('/feedback/my/')
export const updateMyFeedback = (id, data) => api.put(`/feedback/my/${id}/`, data)
export const deleteMyFeedback = (id) => api.delete(`/feedback/my/${id}/`)

// Team Management
export const getTeamSettings = () => api.get('/team/settings/')
export const updateTeamSettings = (data) => api.put('/team/settings/', data)
export const getTeamOverview = () => api.get('/team/overview/')
export const getSkillMatrix = () => api.get('/team/skill-matrix/')

// Team Members
export const getTeamMembers = (params) => api.get('/team/members/', { params })
export const getTeamMember = (id) => api.get(`/team/members/${id}/`)
export const createTeamMember = (data) => api.post('/team/members/', data)
export const updateTeamMember = (id, data) => api.patch(`/team/members/${id}/`, data)
export const deleteTeamMember = (id) => api.delete(`/team/members/${id}/`)
export const uploadMemberPhoto = (id, formData) =>
  api.post(`/team/members/${id}/photo/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
export const deleteMemberPhoto = (id) => api.delete(`/team/members/${id}/photo/`)
export const uploadTeamLogo = (formData) =>
  api.post('/team/logo/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

// Weight Tracking
export const getWeightHistory = (memberId) => api.get(`/team/members/${memberId}/weight-history/`)
export const logWeight = (memberId, data) => api.post(`/team/members/${memberId}/weight/`, data)
export const updateWeightLog = (memberId, logId, data) => api.put(`/team/members/${memberId}/weight/${logId}/`, data)
export const deleteWeightLog = (memberId, logId) => api.delete(`/team/members/${memberId}/weight/${logId}/`)

// Vitals Tracking
export const getVitalsHistory = (memberId, vitalType = null) => {
  const params = vitalType ? `?vital_type=${vitalType}` : ''
  return api.get(`/team/members/${memberId}/vitals/${params}`)
}
export const getVitalsAverages = (memberId) => api.get(`/team/members/${memberId}/vitals/averages/`)
export const logVital = (memberId, data) => api.post(`/team/members/${memberId}/vitals/`, data)
export const deleteVital = (memberId, vitalId) => api.delete(`/team/members/${memberId}/vitals/${vitalId}/`)
export const updateVital = (memberId, vitalId, data) => api.put(`/team/members/${memberId}/vitals/${vitalId}/`, data)
export const getVitalTypes = () => api.get('/team/vitals/types/')
export const getReadinessAnalysis = (memberId, lookbackDays = 30, force = false) =>
  api.get(`/team/members/${memberId}/readiness-analysis/`, {
    params: { lookback_days: lookbackDays, force }
  })
export const calculateBodyFat = (memberId) => api.post(`/team/members/${memberId}/calculate-body-fat/`)

// Child Growth & Development Tracking
export const getGrowthData = (memberId) => api.get(`/team/members/${memberId}/growth-data/`)
export const getGrowthCurves = (memberId, measurementType) =>
  api.get(`/team/members/${memberId}/growth-curves/${measurementType}/`)
export const getGrowthReference = (gender, measurementType) =>
  api.get(`/team/growth-reference/${gender}/${measurementType}/`)
export const getMemberMilestones = (memberId) => api.get(`/team/members/${memberId}/milestones/`)
export const toggleMilestone = (memberId, milestoneId, data) =>
  api.put(`/team/members/${memberId}/milestones/${milestoneId}/`, data)
export const bulkToggleMilestones = (memberId, data) =>
  api.put(`/team/members/${memberId}/milestones-bulk/`, data)

// Workout/Fitness Tracking
export const getWorkoutTypes = () => api.get('/team/workout-types/')
export const getWorkouts = (memberId, params = {}) =>
  api.get(`/team/members/${memberId}/workouts/`, { params })
export const getWorkoutStats = (memberId, daysBack = 30) =>
  api.get(`/team/members/${memberId}/workouts/stats/`, { params: { days_back: daysBack } })
export const logWorkout = (memberId, data) => api.post(`/team/members/${memberId}/workouts/`, data)
export const updateWorkout = (memberId, workoutId, data) =>
  api.put(`/team/members/${memberId}/workouts/${workoutId}/`, data)
export const deleteWorkout = (memberId, workoutId) =>
  api.delete(`/team/members/${memberId}/workouts/${workoutId}/`)

// Daily Check-in and Fitness Profile
export const submitDailyCheckin = (memberId, data) =>
  api.post(`/team/members/${memberId}/daily-checkin/`, data)
export const getFitnessProfile = (memberId, daysBack = 30) =>
  api.get(`/team/members/${memberId}/fitness-profile/`, { params: { days_back: daysBack } })

// Medical Tracking
export const getMedicalHistory = (memberId) => api.get(`/team/members/${memberId}/medical-history/`)
export const logMedicalChange = (memberId, data) => api.post(`/team/members/${memberId}/medical/`, data)
export const updateMedicalStatus = (memberId, data) => api.put(`/team/members/${memberId}/medical-status/`, data)

// Mentoring Sessions
export const getMentoringSessions = (memberId, params) =>
  api.get(`/team/members/${memberId}/sessions/`, { params })
export const createMentoringSession = (memberId, data) =>
  api.post(`/team/members/${memberId}/sessions/`, data)
export const getMentoringSession = (memberId, sessionId) =>
  api.get(`/team/members/${memberId}/sessions/${sessionId}/`)
export const updateMentoringSession = (memberId, sessionId, data) =>
  api.patch(`/team/members/${memberId}/sessions/${sessionId}/`, data)
export const getCurrentWeekSession = (memberId) =>
  api.get(`/team/members/${memberId}/sessions/current-week/`)

// Values Assessment
export const getValuesHistory = (memberId) => api.get(`/team/members/${memberId}/values-history/`)
export const getValuesSummary = () => api.get('/team/values-summary/')

// Weekly Observations
export const getMemberObservations = (memberId, params) =>
  api.get(`/team/members/${memberId}/observations/`, { params })
export const createObservation = (memberId, data) =>
  api.post(`/team/members/${memberId}/observations/`, data)
export const updateObservation = (observationId, data) =>
  api.patch(`/team/observations/${observationId}/`, data)
export const deleteObservation = (observationId) =>
  api.delete(`/team/observations/${observationId}/`)
export const getWeekObservations = (date) => api.get(`/team/observations/week/${date}/`)

// Weekly AAR
export const getAARs = (params) => api.get('/team/aar/', { params })
export const getCurrentAAR = () => api.get('/team/aar/current/')
export const createAAR = (data) => api.post('/team/aar/', data)
export const updateAAR = (id, data) => api.patch(`/team/aar/${id}/`, data)

// Readiness
export const getTeamReadiness = () => api.get('/team/readiness/')
export const updateMemberReadiness = (memberId, params) =>
  api.put(`/team/members/${memberId}/readiness/`, null, { params })

// Team-Wide Gear (Pool/Inventory)
export const getTeamGear = (params) =>
  api.get('/team/gear/', { params })
export const createPoolGear = (data) =>
  api.post('/team/gear/', data)
export const getTeamGearItem = (gearId) =>
  api.get(`/team/gear/${gearId}/`)
export const updateTeamGear = (gearId, data) =>
  api.patch(`/team/gear/${gearId}/`, data)
export const deleteTeamGear = (gearId) =>
  api.delete(`/team/gear/${gearId}/`)
export const assignGear = (gearId, memberId) =>
  api.patch(`/team/gear/${gearId}/assign`, { member_id: memberId })

// Member Gear
export const getMemberGear = (memberId, params) =>
  api.get(`/team/members/${memberId}/gear/`, { params })
export const createMemberGear = (memberId, data) =>
  api.post(`/team/members/${memberId}/gear/`, data)
export const getMemberGearItem = (memberId, gearId) =>
  api.get(`/team/members/${memberId}/gear/${gearId}/`)
export const updateMemberGear = (memberId, gearId, data) =>
  api.patch(`/team/members/${memberId}/gear/${gearId}/`, data)
export const deleteMemberGear = (memberId, gearId) =>
  api.delete(`/team/members/${memberId}/gear/${gearId}/`)

// Gear Maintenance
export const getGearMaintenance = (memberId, gearId) =>
  api.get(`/team/members/${memberId}/gear/${gearId}/maintenance/`)
export const createGearMaintenance = (memberId, gearId, data) =>
  api.post(`/team/members/${memberId}/gear/${gearId}/maintenance/`, data)
export const updateGearMaintenance = (memberId, gearId, maintId, data) =>
  api.patch(`/team/members/${memberId}/gear/${gearId}/maintenance/${maintId}/`, data)
export const deleteGearMaintenance = (memberId, gearId, maintId) =>
  api.delete(`/team/members/${memberId}/gear/${gearId}/maintenance/${maintId}/`)
export const completeGearMaintenance = (memberId, gearId, maintId, data) =>
  api.post(`/team/members/${memberId}/gear/${gearId}/maintenance/${maintId}/complete/`, data)

// Gear Contents (member-assigned)
export const getGearContents = (memberId, gearId) =>
  memberId
    ? api.get(`/team/members/${memberId}/gear/${gearId}/contents/`)
    : api.get(`/team/gear/${gearId}/contents/`)
export const createGearContents = (memberId, gearId, data) =>
  memberId
    ? api.post(`/team/members/${memberId}/gear/${gearId}/contents/`, data)
    : api.post(`/team/gear/${gearId}/contents/`, data)
export const updateGearContents = (memberId, gearId, contentId, data) =>
  memberId
    ? api.patch(`/team/members/${memberId}/gear/${gearId}/contents/${contentId}/`, data)
    : api.patch(`/team/gear/${gearId}/contents/${contentId}/`, data)
export const deleteGearContents = (memberId, gearId, contentId) =>
  memberId
    ? api.delete(`/team/members/${memberId}/gear/${gearId}/contents/${contentId}/`)
    : api.delete(`/team/gear/${gearId}/contents/${contentId}/`)

// Member Training
export const getMemberTraining = (memberId, params) =>
  api.get(`/team/members/${memberId}/training/`, { params })
export const createMemberTraining = (memberId, data) =>
  api.post(`/team/members/${memberId}/training/`, data)
export const updateMemberTraining = (memberId, trainingId, data) =>
  api.patch(`/team/members/${memberId}/training/${trainingId}/`, data)
export const deleteMemberTraining = (memberId, trainingId) =>
  api.delete(`/team/members/${memberId}/training/${trainingId}/`)
export const logTrainingSession = (memberId, trainingId, data) =>
  api.post(`/team/members/${memberId}/training/${trainingId}/log/`, data)
export const getTrainingHistory = (memberId, trainingId) =>
  api.get(`/team/members/${memberId}/training/${trainingId}/history/`)
export const getTrainingSummary = () => api.get('/team/training-summary/')

// Member Medical Appointments
export const getMemberAppointments = (memberId, params) =>
  api.get(`/team/members/${memberId}/appointments/`, { params })
export const createMemberAppointment = (memberId, data) =>
  api.post(`/team/members/${memberId}/appointments/`, data)
export const updateMemberAppointment = (memberId, apptId, data) =>
  api.patch(`/team/members/${memberId}/appointments/${apptId}/`, data)
export const deleteMemberAppointment = (memberId, apptId) =>
  api.delete(`/team/members/${memberId}/appointments/${apptId}/`)
export const completeMemberAppointment = (memberId, apptId, data) =>
  api.post(`/team/members/${memberId}/appointments/${apptId}/complete/`, data)

// Member Supply Requests
export const getMemberSupplyRequests = (memberId, params) =>
  api.get(`/team/members/${memberId}/supply-requests/`, { params })
export const createMemberSupplyRequest = (memberId, data) =>
  api.post(`/team/members/${memberId}/supply-requests/`, data)
export const updateMemberSupplyRequest = (requestId, data) =>
  api.patch(`/team/supply-requests/${requestId}/`, data)
export const deleteMemberSupplyRequest = (requestId) =>
  api.delete(`/team/supply-requests/${requestId}/`)
export const getAllMemberSupplyRequests = (params) =>
  api.get('/team/supply-requests/', { params })

// Member Tasks
export const getMemberTasks = (memberId, params) =>
  api.get(`/team/members/${memberId}/tasks/`, { params })
export const getMemberBacklog = (memberId) =>
  api.get(`/team/members/${memberId}/backlog/`)

// Worker Standard Tasks & Visits
export const getWorkerStandardTasks = (workerId) =>
  api.get(`/workers/${workerId}/standard-tasks/`)
export const createWorkerStandardTask = (workerId, data) =>
  api.post(`/workers/${workerId}/standard-tasks/`, data)
export const updateWorkerStandardTask = (workerId, taskId, data) =>
  api.put(`/workers/${workerId}/standard-tasks/${taskId}/`, data)
export const deleteWorkerStandardTask = (workerId, taskId) =>
  api.delete(`/workers/${workerId}/standard-tasks/${taskId}/`)
export const reorderWorkerStandardTasks = (workerId, taskIds) =>
  api.post(`/workers/${workerId}/standard-tasks/reorder/`, { task_ids: taskIds })

export const getWorkerVisits = (workerId, params) =>
  api.get(`/workers/${workerId}/visits/`, { params })
export const getCurrentWorkerVisit = (workerId) =>
  api.get(`/workers/${workerId}/visits/current/`)
export const addWorkerVisitTask = (workerId, visitId, data) =>
  api.post(`/workers/${workerId}/visits/${visitId}/tasks/`, data)
export const updateWorkerVisitTask = (workerId, visitId, taskId, data) =>
  api.put(`/workers/${workerId}/visits/${visitId}/tasks/${taskId}/`, data)
export const deleteWorkerVisitTask = (workerId, visitId, taskId) =>
  api.delete(`/workers/${workerId}/visits/${visitId}/tasks/${taskId}/`)
export const reorderWorkerVisitTasks = (workerId, visitId, taskIds) =>
  api.post(`/workers/${workerId}/visits/${visitId}/tasks/reorder/`, { task_ids: taskIds })
export const completeWorkerVisit = (workerId, visitId) =>
  api.post(`/workers/${workerId}/visits/${visitId}/complete/`)
export const duplicateWorkerVisit = (workerId, visitId) =>
  api.post(`/workers/${workerId}/visits/${visitId}/duplicate/`)

// Budget & Finance
export const getBudgetAccounts = () => api.get('/budget/accounts/')
export const createBudgetAccount = (data) => api.post('/budget/accounts/', data)
export const updateBudgetAccount = (id, data) => api.put(`/budget/accounts/${id}/`, data)
export const deleteBudgetAccount = (id) => api.delete(`/budget/accounts/${id}/`)
export const getAccountsWithBalances = () => api.get('/budget/accounts/balances/')
export const getAccountDetail = (id) => api.get(`/budget/accounts/${id}/detail/`)
export const getAccountTransactions = (id, params) => api.get(`/budget/accounts/${id}/transactions/`, { params })

export const getBudgetCategories = () => api.get('/budget/categories/')
export const createBudgetCategory = (data) => api.post('/budget/categories/', data)
export const updateBudgetCategory = (id, data) => api.put(`/budget/categories/${id}/`, data)
export const deleteBudgetCategory = (id) => api.delete(`/budget/categories/${id}/`)

export const getBudgetTransactions = (params) => api.get('/budget/transactions/', { params })
export const createBudgetTransaction = (data) => api.post('/budget/transactions/', data)
export const updateBudgetTransaction = (id, data) => api.put(`/budget/transactions/${id}/`, data)
export const deleteBudgetTransaction = (id) => api.delete(`/budget/transactions/${id}/`)

export const getBudgetRules = () => api.get('/budget/rules/')
export const createBudgetRule = (data) => api.post('/budget/rules/', data)
export const updateBudgetRule = (id, data) => api.put(`/budget/rules/${id}/`, data)
export const deleteBudgetRule = (id) => api.delete(`/budget/rules/${id}/`)

export const getBudgetIncome = () => api.get('/budget/income/')
export const createBudgetIncome = (data) => api.post('/budget/income/', data)
export const updateBudgetIncome = (id, data) => api.put(`/budget/income/${id}/`, data)
export const deleteBudgetIncome = (id) => api.delete(`/budget/income/${id}/`)

export const getBudgetPeriodSummary = (startDate, endDate) =>
  api.get('/budget/summary/period/', { params: { start_date: startDate, end_date: endDate } })
export const getBudgetMonthlySummary = (year, month) =>
  api.get('/budget/summary/monthly/', { params: { year, month } })
export const getBudgetDashboard = () => api.get('/budget/summary/dashboard/')
export const getBudgetPayPeriods = (year, month) =>
  api.get('/budget/pay-periods/', { params: { year, month } })

export const importChaseStatement = (file, accountId, statementYear) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/budget/import/chase/?account_id=${accountId}${statementYear ? `&statement_year=${statementYear}` : ''}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const confirmBudgetImport = (data) => api.post('/budget/import/confirm/', data)
export const runBudgetCategorize = () => api.post('/budget/categorize/')

// AI Chat & Insights
export const getAiHealth = () => api.get('/chat/health/')
export const getAiModels = () => api.get('/chat/models/')
export const createConversation = (topic = null) => api.post('/chat/conversations/', { topic })
export const getConversations = (limit = 50) => api.get('/chat/conversations/', { params: { limit } })
export const getConversation = (id) => api.get(`/chat/conversations/${id}/`)
export const deleteConversation = (id) => api.delete(`/chat/conversations/${id}/`)
// sendMessage returns a fetch() Response for SSE streaming (not axios)
export const sendMessage = async (conversationId, content) => {
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content }),
  })
  return response
}
export const getInsights = (params) => api.get('/chat/insights/', { params })
export const getAllInsights = (limit = 100) => api.get('/chat/insights/all/', { params: { limit } })
export const getUnreadInsightCount = () => api.get('/chat/insights/unread-count/')
export const markInsightRead = (id) => api.put(`/chat/insights/${id}/read/`)
export const dismissInsight = (id) => api.put(`/chat/insights/${id}/dismiss/`)
export const createInsight = (data) => api.post('/chat/insights/', data)
export const updateInsight = (id, data) => api.put(`/chat/insights/${id}/`, data)
export const deleteInsight = (id) => api.delete(`/chat/insights/${id}/`)
export const regenerateInsights = (type = 'all') => api.post('/chat/insights/regenerate/', null, { params: { insight_type: type } })
export const createTaskFromChat = (data) => api.post('/chat/create-task/', data)

export default api
