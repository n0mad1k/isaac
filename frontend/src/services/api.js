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
export const previewPlantImport = (url) => api.post('/plants/import/preview/', { url })
export const importPlant = (url) => api.post('/plants/import/', { url })
export const waterPlant = (plantId, notes = null) =>
  api.post(`/plants/${plantId}/water/`, null, { params: { notes } })
export const skipWatering = (plantId, reason, notes = null) =>
  api.post(`/plants/${plantId}/skip-watering/`, { reason, notes })
export const getWateringHistory = (plantId) =>
  api.get(`/plants/${plantId}/watering-history/`)

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

// Settings
export const getSettings = () => api.get('/settings/')
export const getSetting = (key) => api.get(`/settings/${key}/`)
export const updateSetting = (key, value) => api.put(`/settings/${key}/`, { value })
export const resetSetting = (key) => api.post(`/settings/${key}/reset/`)
export const resetAllSettings = () => api.post('/settings/reset-all/')
export const testColdProtectionEmail = () => api.post('/settings/test-cold-protection-email/')
export const testCalendarSync = () => api.post('/settings/test-calendar-sync/', {}, { timeout: 15000 })
export const syncCalendar = () => api.post('/settings/sync-calendar/', {}, { timeout: 15000 }) // 15sec timeout for CalDAV connection
export const getVersionInfo = () => api.get('/settings/version/')
export const toggleKeyboard = () => api.post('/settings/keyboard/toggle/')
export const updateApplication = () => api.post('/settings/update/')
export const pushToProduction = () => api.post('/settings/push-to-prod/', {}, { timeout: 300000 }) // 5 min for build
export const pullFromProduction = () => api.post('/settings/pull-from-prod/', {}, { timeout: 60000 }) // 1 min for db copy
export const getRecentCommits = () => api.get('/settings/recent-commits/')
export const getLogFiles = () => api.get('/settings/logs/files/')
export const getAppLogs = (lines = 100, level = null, search = null, logFile = 'app') => {
  const params = new URLSearchParams({ lines: lines.toString(), log_file: logFile })
  if (level) params.append('level', level)
  if (search) params.append('search', search)
  return api.get(`/settings/logs/?${params.toString()}`)
}
export const clearAppLogs = () => api.post('/settings/logs/clear/')

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
export const completeOrder = (id) => api.post(`/production/orders/${id}/complete/`)

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

export default api
