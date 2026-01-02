import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
})

// Dashboard
export const getDashboard = () => api.get('/dashboard/')
export const getQuickStats = () => api.get('/dashboard/quick-stats/')
export const getCalendarMonth = (year, month) =>
  api.get(`/dashboard/calendar/${year}/${month}/`)
export const getColdProtection = () => api.get('/dashboard/cold-protection/')

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

export default api
