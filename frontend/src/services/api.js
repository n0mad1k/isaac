import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  withCredentials: true,  // Include cookies for session auth
})

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses by redirecting to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Dashboard
export const getDashboard = () => api.get('/dashboard/')
export const getQuickStats = () => api.get('/dashboard/quick-stats/')
export const getCalendarMonth = (year, month) =>
  api.get(`/dashboard/calendar/${year}/${month}/`)
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
export const getAnimalTotalExpenses = (animalId) =>
  api.get(`/animals/${animalId}/expenses/total/`)
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
export const createTask = (data) => api.post('/tasks/', data)
export const updateTask = (id, data) => api.patch(`/tasks/${id}/`, data)
export const completeTask = (id) => api.post(`/tasks/${id}/complete/`)
export const uncompleteTask = (id) => api.post(`/tasks/${id}/uncomplete/`)
export const deleteTask = (id) => api.delete(`/tasks/${id}/`)
export const setupMaintenanceTasks = () => api.post('/tasks/setup-maintenance/')
export const getCalDAVStatus = () => api.get('/tasks/caldav/status/')
export const syncTasksToCalDAV = () => api.post('/tasks/caldav/sync/')

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
export const testCalendarSync = () => api.post('/settings/test-calendar-sync/')
export const syncCalendar = () => api.post('/settings/sync-calendar/')

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
  api.put(`/vehicles/maintenance/${taskId}/`, data)
export const deleteVehicleMaintenance = (taskId) =>
  api.delete(`/vehicles/maintenance/${taskId}/`)
export const completeVehicleMaintenance = (taskId, data) =>
  api.post(`/vehicles/maintenance/${taskId}/complete/`, data)
export const setVehicleMaintenanceDueDate = (taskId, dueDate) =>
  api.put(`/vehicles/maintenance/${taskId}/due-date/`, { due_date: dueDate })
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

// Role Management (Admin only)
export const getRoles = () => api.get('/auth/roles')
export const getRole = (roleId) => api.get(`/auth/roles/${roleId}`)
export const createRole = (data) => api.post('/auth/roles', data)
export const updateRole = (roleId, data) => api.put(`/auth/roles/${roleId}`, data)
export const deleteRole = (roleId) => api.delete(`/auth/roles/${roleId}`)
export const getPermissionCategories = () => api.get('/auth/permissions')

export default api
