<script setup>
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'vue-chartjs'

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip)

definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const { request } = useAdminApi()
const authStore = useAuthStore()

const loading = ref(true)
const saving = ref(false)
const completingId = ref(null)
const errorMessage = ref('')
const formError = ref('')
const dialogOpen = ref(false)
const attendanceDialogOpen = ref(false)
const dashboardChartsOpen = ref(true)
const attendanceSearchOpen = ref(true)
const defaultPrayerGroup = ref(null)
const records = ref([])
const dashboard = ref(null)
const selectedRecord = ref(null)
const attendanceRows = ref([])
const participantStatusFilter = ref('all')
const participantOptions = ref([])
const participantSearchLoading = ref(false)
const participantSearchTerm = ref('')
const meta = ref({
  current_page: 1,
  from: 0,
  last_page: 1,
  per_page: 10,
  to: 0,
  total: 0,
})

const filters = reactive({
  type: '',
  date: '',
  church_id: null,
  fellowship_id: null,
  cell_id: null,
})

const dashboardFilters = reactive({
  date_from: '',
  date_to: '',
})

const form = reactive({
  type: 'custom',
  title: '',
  leader_name: '',
  time_started: '',
  time_ended: '',
  participants: '',
})

const attendanceForm = reactive({
  participant: null,
  arrival_status: 'early',
})

const first = ref(0)
const rows = ref(10)

const adminRole = computed(() => authStore.admin?.role || '')
const isChurchPastor = computed(() => adminRole.value === 'church_pastor')
const isPastor = computed(() => adminRole.value === 'pastor')
const canCreateRegularVigil = computed(() => ['pastor', 'church_pastor'].includes(adminRole.value))
const isPrayerGroupLeader = computed(() => Boolean(defaultPrayerGroup.value))
const canViewDashboard = computed(() => ['admin', 'pastor', 'church_pastor', 'fellowship_leader', 'cell_leader'].includes(adminRole.value))
const showBroadFilters = computed(() => isChurchPastor.value || authStore.admin?.role === 'pastor' || authStore.admin?.role === 'admin')
const entities = computed(() => authStore.entities || {})

const typeOptions = computed(() => {
  const options = [
    { label: 'Custom', value: 'custom' },
  ]

  if (isPrayerGroupLeader.value) {
    options.unshift({ label: 'Prayer group', value: 'prayer_group' })
  }

  if (canCreateRegularVigil.value) {
    options.push({ label: 'Regular vigil', value: 'regular_vigil' })
  }

  return options
})

const filterTypeOptions = [
  { label: 'Prayer group', value: 'prayer_group' },
  { label: 'Regular vigil', value: 'regular_vigil' },
  { label: 'Custom', value: 'custom' },
]

const churchOptions = computed(() => Array.isArray(entities.value.churches) ? entities.value.churches : [])
const fellowshipOptions = computed(() => {
  if (Array.isArray(entities.value.fellowships)) {
    return entities.value.fellowships
  }

  const selectedChurch = churchOptions.value.find((church) => church.id === filters.church_id)
  const source = selectedChurch ? [selectedChurch] : churchOptions.value

  return source.flatMap((church) => Array.isArray(church.fellowships) ? church.fellowships : [])
})
const cellOptions = computed(() => {
  if (Array.isArray(entities.value.cells)) {
    return entities.value.cells
  }

  const selectedFellowship = fellowshipOptions.value.find((fellowship) => fellowship.id === filters.fellowship_id)
  const source = selectedFellowship ? [selectedFellowship] : fellowshipOptions.value

  return source.flatMap((fellowship) => Array.isArray(fellowship.cells) ? fellowship.cells : [])
})

const tableRows = computed(() => {
  if (loading.value) {
    return Array.from({ length: rows.value }, (_, index) => ({
      id: `loading-${index}`,
      __loading: true,
    }))
  }

  return records.value
})

const totalRecords = computed(() => meta.value?.total || 0)
const hasFilters = computed(() => Object.values(filters).some((value) => value !== '' && value !== null))
const dashboardTotals = computed(() => dashboard.value?.totals || {})
const dashboardPercentages = computed(() => dashboard.value?.percentages || {})
const dashboardRecordTypes = computed(() => dashboard.value?.recordTypes || [])
const presentAttendance = computed(() => attendanceRows.value.filter((row) => row.participationStatus === 'present'))
const absentAttendance = computed(() => attendanceRows.value.filter((row) => row.participationStatus === 'absent'))
const displayedAttendance = computed(() => {
  if (participantStatusFilter.value === 'present') {
    return presentAttendance.value
  }

  if (participantStatusFilter.value === 'absent') {
    return absentAttendance.value
  }

  return attendanceRows.value
})
const attendanceSummary = computed(() => ({
  present: presentAttendance.value.length,
  absent: absentAttendance.value.length,
  workers: attendanceRows.value.filter((row) => row.personType === 'worker' && row.participationStatus === 'present').length,
  members: attendanceRows.value.filter((row) => row.personType === 'member' && row.participationStatus === 'present').length,
  early: presentAttendance.value.filter((row) => row.arrivalStatus === 'early').length,
  late: presentAttendance.value.filter((row) => row.arrivalStatus === 'late').length,
  regularDay: attendanceRows.value.filter((row) => row.attendanceGroup === 'regular_day').length,
  otherDays: attendanceRows.value.filter((row) => row.attendanceGroup === 'other_days').length,
}))

function displayDate(value) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString()
}

function typeLabel(value) {
  return String(value || '').replace(/_/g, ' ')
}

function attendanceGroupLabel(row) {
  if (
    row?.recordType === 'prayer_group'
    && row?.prayerGroupId
    && row?.expectedPrayerGroupId
    && Number(row.prayerGroupId) !== Number(row.expectedPrayerGroupId)
  ) {
    return 'Make Up'
  }

  return typeLabel(row?.attendanceGroup) || '-'
}

function typeSeverity(value) {
  if (value === 'prayer_group') return 'info'
  if (value === 'regular_vigil') return 'warning'
  return 'secondary'
}

function statusSeverity(value) {
  return value === 'completed' ? 'success' : 'warning'
}

function participationSeverity(value) {
  return value === 'present' ? 'success' : 'danger'
}

function buildQuery(page = 1) {
  const query = {
    page,
    per_page: rows.value,
  }

  const allowedFilters = showBroadFilters.value
    ? filters
    : { date: filters.date }

  for (const [key, value] of Object.entries(allowedFilters)) {
    if (value !== '' && value !== null) {
      query[key] = value
    }
  }

  return query
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10)
}

function setDefaultDashboardRange() {
  const today = new Date()
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  dashboardFilters.date_from = toDateInput(lastMonth)
  dashboardFilters.date_to = toDateInput(today)
}

function doughnutData(labels, values, colors) {
  return {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 3,
      },
    ],
  }
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 10,
        color: '#374151',
        font: {
          size: 11,
        },
      },
    },
  },
}

const attendanceChartData = computed(() => doughnutData(
  [
    `Present ${dashboardPercentages.value.attendance?.present || 0}%`,
    `Absent ${dashboardPercentages.value.attendance?.absent || 0}%`,
  ],
  [dashboardTotals.value.total_present || 0, dashboardTotals.value.total_absent || 0],
  ['#a83632', '#d1d5db'],
))

const peopleChartData = computed(() => doughnutData(
  [
    `Workers ${dashboardPercentages.value.presentPeople?.workers || 0}%`,
    `Members ${dashboardPercentages.value.presentPeople?.members || 0}%`,
  ],
  [dashboardTotals.value.worker_present || 0, dashboardTotals.value.member_present || 0],
  ['#a83632', '#2563eb'],
))

const arrivalChartData = computed(() => doughnutData(
  [
    `Early ${dashboardPercentages.value.arrival?.early || 0}%`,
    `Late ${dashboardPercentages.value.arrival?.late || 0}%`,
  ],
  [dashboardTotals.value.early_count || 0, dashboardTotals.value.late_count || 0],
  ['#16a34a', '#f59e0b'],
))

const recordTypeChartData = computed(() => ({
  labels: dashboardRecordTypes.value.map((item) => item.label),
  datasets: [
    {
      label: 'Present',
      data: dashboardRecordTypes.value.map((item) => item.totalPresent),
      backgroundColor: '#a83632',
      borderRadius: 8,
    },
    {
      label: 'Absent',
      data: dashboardRecordTypes.value.map((item) => item.totalAbsent),
      backgroundColor: '#d1d5db',
      borderRadius: 8,
    },
  ],
}))

const dailyChartData = computed(() => ({
  labels: (dashboard.value?.daily || []).map((item) => String(item.date).slice(0, 10)),
  datasets: [
    {
      label: 'Present',
      data: (dashboard.value?.daily || []).map((item) => Number(item.total_present || item.totalPresent || 0)),
      borderColor: '#a83632',
      backgroundColor: '#a83632',
      tension: 0.35,
    },
    {
      label: 'Absent',
      data: (dashboard.value?.daily || []).map((item) => Number(item.total_absent || item.totalAbsent || 0)),
      borderColor: '#6b7280',
      backgroundColor: '#6b7280',
      tension: 0.35,
    },
  ],
}))

async function fetchDefaultPrayerGroup() {
  try {
    const response = await request('/prayer-group', { method: 'GET' })
    defaultPrayerGroup.value = response?.data || null
  } catch {
    defaultPrayerGroup.value = null
  }
}

async function fetchRecords(page = 1) {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await request('/prayer-group-records', {
      method: 'GET',
      query: buildQuery(page),
    })

    records.value = Array.isArray(response?.data) ? response.data : []
    meta.value = {
      ...meta.value,
      ...(response?.meta || {}),
    }
    rows.value = Number(meta.value.per_page || rows.value)
    first.value = ((Number(meta.value.current_page) || page) - 1) * rows.value
  } catch (error) {
    records.value = []
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load prayer group records.'
  } finally {
    loading.value = false
  }
}

async function fetchDashboard() {
  if (!canViewDashboard.value) {
    dashboard.value = null
    return
  }

  try {
    const response = await request('/prayer-dashboard', {
      method: 'GET',
      query: {
        date_from: dashboardFilters.date_from || filters.date || undefined,
        date_to: dashboardFilters.date_to || filters.date || undefined,
        record_type: filters.type || undefined,
        church_id: filters.church_id || undefined,
        fellowship_id: filters.fellowship_id || undefined,
        cell_id: filters.cell_id || undefined,
      },
    })

    dashboard.value = response?.data || null
  } catch {
    dashboard.value = null
  }
}

function resetForm() {
  form.type = isPrayerGroupLeader.value ? 'prayer_group' : 'custom'
  form.title = form.type === 'prayer_group' ? `Prayer group - ${defaultPrayerGroup.value?.day || ''}`.trim() : ''
  form.leader_name = form.type === 'prayer_group' ? defaultPrayerGroup.value?.leaderName || '' : ''
  form.time_started = ''
  form.time_ended = ''
  form.participants = ''
  formError.value = ''
}

function openCreateDialog() {
  resetForm()
  dialogOpen.value = true
}

function participantPayload() {
  return String(form.participants || '')
    .split(/\n|,/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name }))
}

async function createRecord() {
  saving.value = true
  formError.value = ''

  try {
    await request('/prayer-group-records', {
      method: 'POST',
      body: {
        type: form.type,
        title: form.title,
        leader_name: form.leader_name,
        time_started: form.time_started,
        time_ended: form.time_ended,
        participants: participantPayload(),
      },
    })

    dialogOpen.value = false
    await fetchRecords(1)
    await fetchDashboard()
  } catch (error) {
    formError.value = error?.data?.message || error?.message || 'Unable to create prayer group record.'
  } finally {
    saving.value = false
  }
}

async function openAttendanceDialog(record) {
  selectedRecord.value = record
  attendanceRows.value = []
  attendanceForm.participant = null
  attendanceForm.arrival_status = 'early'
  participantOptions.value = []
  participantSearchTerm.value = ''
  participantStatusFilter.value = 'all'
  attendanceSearchOpen.value = true
  attendanceDialogOpen.value = true

  try {
    const response = await request(`/prayer-group-records/${record.id}/participants`, {
      method: 'GET',
      query: {
        per_page: 100,
      },
    })
    attendanceRows.value = Array.isArray(response?.data) ? response.data : []
  } catch {
    attendanceRows.value = []
  }
}

function addAttendanceRow() {
  const selected = attendanceForm.participant

  if (!selected) {
    formError.value = 'Search and select a worker or member.'
    return
  }

  const isWorker = selected.personType === 'worker'
  const id = isWorker ? selected.workerId : selected.memberId

  const exists = presentAttendance.value.some((row) => {
    return isWorker
      ? row.personType === 'worker' && Number(row.workerId) === Number(id)
      : row.personType === 'member' && String(row.memberId) === String(id)
  })

  if (exists) {
    formError.value = 'This participant has already been added.'
    return
  }

  attendanceRows.value = [
    ...presentAttendance.value,
    {
      id: `new-${selected.personType}-${id}`,
      personType: selected.personType,
      workerId: selected.workerId,
      memberId: selected.memberId,
      personName: selected.name || selected.label,
      slug: selected.slug,
      arrivalStatus: attendanceForm.arrival_status,
      participationStatus: 'present',
    },
  ]

  attendanceForm.participant = null
  formError.value = ''
}

async function searchParticipants(event) {
  const search = String(event?.query || event?.value || '').trim()
  participantSearchTerm.value = search

  if (search.length < 2) {
    participantOptions.value = []
    return
  }

  participantSearchLoading.value = true

  try {
    const response = await request('/prayer-participants/search', {
      method: 'GET',
      query: { search },
    })

    participantOptions.value = Array.isArray(response?.data) ? response.data : []
  } catch {
    participantOptions.value = []
  } finally {
    participantSearchLoading.value = false
  }
}

function updateArrival(row, value) {
  attendanceRows.value = attendanceRows.value.map((item) => {
    if (item === row || item.id === row.id) {
      return {
        ...item,
        arrivalStatus: value,
      }
    }

    return item
  })
}

function removeAttendanceRow(row) {
  attendanceRows.value = attendanceRows.value.filter((item) => {
    if (item.participationStatus !== 'present') {
      return true
    }

    if (row.id && item.id) {
      return item.id !== row.id
    }

    return !(item.personType === row.personType && String(item.workerId || item.memberId) === String(row.workerId || row.memberId))
  })
}

async function saveAttendance() {
  if (!selectedRecord.value) {
    return
  }

  saving.value = true
  formError.value = ''

  try {
    await request(`/prayer-group-records/${selectedRecord.value.id}/participants`, {
      method: 'PATCH',
      body: {
        participants: presentAttendance.value.map((row) => ({
          person_type: row.personType,
          worker_id: row.workerId,
          member_id: row.memberId,
          arrival_status: row.arrivalStatus,
        })),
      },
    })

    attendanceDialogOpen.value = false
    await fetchRecords(Math.max(1, Math.floor(first.value / rows.value) + 1))
    await fetchDashboard()
  } catch (error) {
    formError.value = error?.data?.message || error?.message || 'Unable to save attendance.'
  } finally {
    saving.value = false
  }
}

async function completeRecord(record) {
  completingId.value = record.id

  try {
    await request(`/prayer-group-records/${record.id}/complete`, {
      method: 'PATCH',
    })
    await fetchRecords(Math.max(1, Math.floor(first.value / rows.value) + 1))
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to complete this record.'
  } finally {
    completingId.value = null
  }
}

function onPage(event) {
  rows.value = event.rows
  first.value = event.first
  fetchRecords(event.page + 1)
}

function applyFilters() {
  first.value = 0
  fetchRecords(1)
  fetchDashboard()
}

function clearFilters() {
  for (const key of Object.keys(filters)) {
    filters[key] = key.endsWith('_id') ? null : ''
  }
  applyFilters()
}

function applyDashboardRange() {
  fetchDashboard()
}

function resetDashboardRange() {
  setDefaultDashboardRange()
  fetchDashboard()
}

watch(() => form.type, (type) => {
  if (type === 'prayer_group' && defaultPrayerGroup.value) {
    form.title = `Prayer group - ${defaultPrayerGroup.value.day || ''}`.trim()
    form.leader_name = defaultPrayerGroup.value.leaderName || ''
  } else if (type !== 'prayer_group') {
    form.title = ''
    form.leader_name = ''
  }
})

watch(() => filters.church_id, () => {
  filters.fellowship_id = null
  filters.cell_id = null
})

watch(() => filters.fellowship_id, () => {
  filters.cell_id = null
})

onMounted(async () => {
  setDefaultDashboardRange()
  await fetchDefaultPrayerGroup()
  await fetchRecords()
  await fetchDashboard()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">
          Records
        </p>
        <h1 class="m-0 text-3xl font-semibold tracking-tight text-gray-950">
          Prayer Group
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Create and review prayer group, regular vigil, and custom prayer records.
        </p>
      </div>

      <div class="flex flex-col gap-3 sm:items-end">
        <div class="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span class="font-semibold text-gray-950">{{ totalRecords }}</span>
          <span class="ml-1 text-gray-500">records found</span>
        </div>
        <Button
          label="New record"
          icon="pi pi-plus"
          class="!border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c] hover:!text-white"
          @click="openCreateDialog"
        />
      </div>
    </div>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select
            v-if="showBroadFilters"
            v-model="filters.type"
            :options="filterTypeOptions"
            option-label="label"
            option-value="value"
            placeholder="Type"
            show-clear
            class="w-full"
          />
          <InputText
            v-model="filters.date"
            type="date"
            class="h-11 w-full"
            placeholder="Date"
          />
          <Select
            v-if="showBroadFilters"
            v-model="filters.church_id"
            :options="churchOptions"
            option-label="name"
            option-value="id"
            placeholder="Church"
            show-clear
            class="w-full"
          />
          <Select
            v-if="showBroadFilters"
            v-model="filters.fellowship_id"
            :options="fellowshipOptions"
            option-label="name"
            option-value="id"
            placeholder="Fellowship"
            show-clear
            class="w-full"
          />
          <Select
            v-if="showBroadFilters"
            v-model="filters.cell_id"
            :options="cellOptions"
            option-label="name"
            option-value="id"
            placeholder="Cell"
            show-clear
            class="w-full"
          />
        </div>

        <div class="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button
            label="Reset"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            :disabled="loading || !hasFilters"
            @click="clearFilters"
          />
          <Button
            label="Apply filters"
            icon="pi pi-filter"
            class="!border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c] hover:!text-white"
            :loading="loading"
            @click="applyFilters"
          />
        </div>
      </template>
    </Card>

    <Card v-if="dashboard" class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="flex flex-col gap-4 border-b border-gray-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="m-0 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">
              Attendance dashboard
            </p>
            <h2 class="mb-0 mt-2 text-xl font-semibold tracking-tight text-gray-950">
              Prayer attendance performance
            </h2>
            <p class="m-0 mt-1 text-sm text-gray-500">
              Percentages and trends for the selected reporting period.
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-[150px_150px_auto_auto] sm:items-end">
            <div class="space-y-1">
              <label class="text-xs font-semibold uppercase tracking-wide text-gray-500">From</label>
              <InputText v-model="dashboardFilters.date_from" type="date" class="h-11 w-full" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold uppercase tracking-wide text-gray-500">To</label>
              <InputText v-model="dashboardFilters.date_to" type="date" class="h-11 w-full" />
            </div>
            <Button
              label="Last month"
              icon="pi pi-calendar"
              severity="secondary"
              outlined
              class="!h-11"
              @click="resetDashboardRange"
            />
            <Button
              label="Refresh"
              icon="pi pi-refresh"
              class="!h-11 !border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c] hover:!text-white"
              @click="applyDashboardRange"
            />
          </div>
        </div>

        <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p class="m-0 text-sm text-gray-500">Present attendance</p>
            <div class="mt-2 flex items-end justify-between gap-3">
              <h3 class="m-0 text-2xl font-semibold text-gray-950">{{ dashboardTotals.total_present || 0 }}</h3>
              <span class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#a83632] shadow-sm">
                {{ dashboardPercentages.attendance?.present || 0 }}%
              </span>
            </div>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p class="m-0 text-sm text-gray-500">Absent attendance</p>
            <div class="mt-2 flex items-end justify-between gap-3">
              <h3 class="m-0 text-2xl font-semibold text-gray-950">{{ dashboardTotals.total_absent || 0 }}</h3>
              <span class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                {{ dashboardPercentages.attendance?.absent || 0 }}%
              </span>
            </div>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p class="m-0 text-sm text-gray-500">Workers who prayed</p>
            <div class="mt-2 flex items-end justify-between gap-3">
              <h3 class="m-0 text-2xl font-semibold text-gray-950">{{ dashboardTotals.worker_present || 0 }}</h3>
              <span class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#a83632] shadow-sm">
                {{ dashboardPercentages.presentPeople?.workers || 0 }}%
              </span>
            </div>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p class="m-0 text-sm text-gray-500">Members who prayed</p>
            <div class="mt-2 flex items-end justify-between gap-3">
              <h3 class="m-0 text-2xl font-semibold text-gray-950">{{ dashboardTotals.member_present || 0 }}</h3>
              <span class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                {{ dashboardPercentages.presentPeople?.members || 0 }}%
              </span>
            </div>
          </div>
        </div>

        <div class="mt-5 rounded-2xl border border-gray-200 bg-gray-50">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            @click="dashboardChartsOpen = !dashboardChartsOpen"
          >
            <div>
              <h3 class="m-0 text-sm font-semibold text-gray-950">Prayer group charts</h3>
              <p class="m-0 mt-1 text-xs text-gray-500">Visual breakdowns for attendance, people type, arrival, record type, and daily trend.</p>
            </div>
            <i
              class="pi text-sm text-gray-500 transition-transform"
              :class="dashboardChartsOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
            />
          </button>

          <div v-if="dashboardChartsOpen" class="border-t border-gray-200 p-4">
            <div class="grid gap-4 xl:grid-cols-3">
              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="m-0 text-sm font-semibold text-gray-950">Present vs absent</h3>
                  <span class="text-xs text-gray-500">{{ dashboardPercentages.attendance?.present || 0 }}% present</span>
                </div>
                <div class="h-64">
                  <Doughnut :data="attendanceChartData" :options="chartOptions" />
                </div>
              </div>

              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="m-0 text-sm font-semibold text-gray-950">Workers vs members</h3>
                  <span class="text-xs text-gray-500">{{ dashboardPercentages.presentPeople?.workers || 0 }}% workers</span>
                </div>
                <div class="h-64">
                  <Doughnut :data="peopleChartData" :options="chartOptions" />
                </div>
              </div>

              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="m-0 text-sm font-semibold text-gray-950">Early vs late</h3>
                  <span class="text-xs text-gray-500">{{ dashboardPercentages.arrival?.early || 0 }}% early</span>
                </div>
                <div class="h-64">
                  <Doughnut :data="arrivalChartData" :options="chartOptions" />
                </div>
              </div>
            </div>

            <div class="mt-4 grid gap-4 xl:grid-cols-2">
              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 class="m-0 text-sm font-semibold text-gray-950">Attendance by prayer type</h3>
                  <span class="text-xs text-gray-500">Regular, regular vigil, and custom records</span>
                </div>
                <div class="h-72">
                  <Bar :data="recordTypeChartData" :options="chartOptions" />
                </div>
              </div>

              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 class="m-0 text-sm font-semibold text-gray-950">Daily attendance trend</h3>
                  <span class="text-xs text-gray-500">Present and absent counts by day</span>
                </div>
                <div class="h-72">
                  <Line :data="dailyChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Message
      v-if="errorMessage"
      severity="error"
      :closable="false"
    >
      {{ errorMessage }}
    </Message>

    <Card class="overflow-hidden border border-gray-200 bg-white shadow-sm">
      <template #content>
        <DataTable
          :value="tableRows"
          lazy
          paginator
          :first="first"
          :rows="rows"
          :total-records="totalRecords"
          :rows-per-page-options="[5, 10, 25, 50]"
          data-key="id"
          striped-rows
          scrollable
          scroll-height="560px"
          table-style="min-width: 980px"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
          current-page-report-template="{first} to {last} of {totalRecords}"
          class="prayer-records-table text-sm"
          @page="onPage"
        >
          <template #empty>
            <div class="py-12 text-center">
              <span class="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gray-100 text-gray-500">
                <i class="pi pi-search text-lg" />
              </span>
              <h2 class="mb-1 mt-4 text-base font-semibold text-gray-950">
                No prayer records found
              </h2>
              <p class="m-0 text-sm text-gray-500">
                Create a new record or adjust the filters.
              </p>
            </div>
          </template>

          <Column field="title" header="Title" style="min-width: 210px">
            <template #body="{ data }">
              <Skeleton v-if="data.__loading" height="1.25rem" border-radius="8px" />
              <span v-else class="record-title-pill">{{ data.title }}</span>
            </template>
          </Column>
          <Column field="type" header="Type" style="min-width: 150px">
            <template #body="{ data }">
              <Skeleton v-if="data.__loading" height="1.25rem" border-radius="8px" />
              <Tag v-else :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" rounded />
            </template>
          </Column>
          <Column field="leaderName" header="Leader" style="min-width: 170px">
            <template #body="{ data }">
              <Skeleton v-if="data.__loading" height="1.25rem" border-radius="8px" />
              <span v-else>{{ data.leaderName || '-' }}</span>
            </template>
          </Column>
          <Column field="timeStarted" header="Started" style="min-width: 190px">
            <template #body="{ data }">
              <Skeleton v-if="data.__loading" height="1.25rem" border-radius="8px" />
              <span v-else>{{ displayDate(data.timeStarted) }}</span>
            </template>
          </Column>
          <Column field="timeEnded" header="Ended" style="min-width: 190px">
            <template #body="{ data }">
              <Skeleton v-if="data.__loading" height="1.25rem" border-radius="8px" />
              <span v-else>{{ displayDate(data.timeEnded) }}</span>
            </template>
          </Column>
          <Column field="churchName" header="Church" style="min-width: 170px">
            <template #body="{ data }">
              <Skeleton v-if="data.__loading" height="1.25rem" border-radius="8px" />
              <span v-else>{{ data.churchName || '-' }}</span>
            </template>
          </Column>
          <Column field="status" header="Status" style="min-width: 140px">
            <template #body="{ data }">
              <Skeleton v-if="data.__loading" height="1.25rem" border-radius="8px" />
              <Tag v-else :value="data.status" :severity="statusSeverity(data.status)" rounded />
            </template>
          </Column>
          <Column header="Actions" frozen align-frozen="right" style="min-width: 150px">
            <template #body="{ data }">
              <Skeleton v-if="data.__loading" height="2rem" border-radius="8px" />
              <Button
                v-else
                label="Complete"
                icon="pi pi-check"
                size="small"
                outlined
                :disabled="data.status === 'completed'"
                :loading="completingId === data.id"
                class="!border-[#a83632] !px-3 !py-2 !text-[#a83632]"
                @click="completeRecord(data)"
              />
              <Button
                v-if="!data.__loading"
                label="Attendance"
                icon="pi pi-users"
                size="small"
                text
                class="!px-3 !py-2 !text-[#a83632]"
                @click="openAttendanceDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog
      v-model:visible="dialogOpen"
      modal
      header="New prayer record"
      :style="{ width: 'min(92vw, 560px)' }"
      :closable="!saving"
    >
      <div class="space-y-4">
        <Message v-if="formError" severity="error" :closable="false">
          {{ formError }}
        </Message>

        <div class="space-y-2">
          <label class="text-sm font-semibold text-gray-900">Type</label>
          <Select
            v-model="form.type"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-semibold text-gray-900">Title</label>
          <InputText v-model="form.title" class="w-full" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-semibold text-gray-900">Leader name</label>
          <InputText v-model="form.leader_name" class="w-full" />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-semibold text-gray-900">Time started</label>
            <InputText v-model="form.time_started" type="datetime-local" class="h-11 w-full" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-semibold text-gray-900">Time ended</label>
            <InputText v-model="form.time_ended" type="datetime-local" class="h-11 w-full" />
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-semibold text-gray-900">Participants</label>
          <Textarea
            v-model="form.participants"
            rows="4"
            class="w-full"
            placeholder="Enter participant names, one per line"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" severity="secondary" outlined :disabled="saving" @click="dialogOpen = false" />
          <Button
            label="Create record"
            icon="pi pi-save"
            class="!border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c] hover:!text-white"
            :loading="saving"
            @click="createRecord"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="attendanceDialogOpen"
      modal
      header="Manage attendance"
      :style="{ width: 'min(94vw, 720px)' }"
      :closable="!saving"
    >
      <div class="space-y-4">
        <Message v-if="formError" severity="error" :closable="false">
          {{ formError }}
        </Message>

        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div class="grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <p class="m-0 text-gray-500">Present</p>
              <p class="m-0 mt-1 text-lg font-semibold text-gray-950">{{ attendanceSummary.present }}</p>
            </div>
            <div>
              <p class="m-0 text-gray-500">Absent</p>
              <p class="m-0 mt-1 text-lg font-semibold text-gray-950">{{ attendanceSummary.absent }}</p>
            </div>
            <div>
              <p class="m-0 text-gray-500">Early / Late</p>
              <p class="m-0 mt-1 text-lg font-semibold text-gray-950">{{ attendanceSummary.early }} / {{ attendanceSummary.late }}</p>
            </div>
            <div>
              <p class="m-0 text-gray-500">Regular / Other</p>
              <p class="m-0 mt-1 text-lg font-semibold text-gray-950">{{ attendanceSummary.regularDay }} / {{ attendanceSummary.otherDays }}</p>
            </div>
          </div>
          <p
            v-if="['prayer_group', 'regular_vigil'].includes(selectedRecord?.type)"
            class="m-0 mt-3 text-xs leading-5 text-gray-500"
          >
            Saving attendance will recalculate expected absences for this {{ typeLabel(selectedRecord?.type) }} record.
          </p>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            @click="attendanceSearchOpen = !attendanceSearchOpen"
          >
            <div>
              <p class="m-0 text-sm font-semibold text-gray-950">Add worker/member</p>
              <p class="m-0 mt-1 text-xs text-gray-500">Search by slug or name, then set arrival status.</p>
            </div>
            <i
              class="pi text-sm text-gray-500 transition-transform"
              :class="attendanceSearchOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
            />
          </button>

          <div v-if="attendanceSearchOpen" class="grid gap-3 border-t border-gray-100 p-4 md:grid-cols-[minmax(0,1fr)_160px_120px]">
            <AutoComplete
              v-model="attendanceForm.participant"
              :suggestions="participantOptions"
              option-label="label"
              placeholder="Search by slug or name"
              dropdown
              force-selection
              :min-length="2"
              class="w-full"
              input-class="w-full"
              :loading="participantSearchLoading"
              @complete="searchParticipants"
            >
              <template #empty>
                <span class="block px-3 py-2 text-sm text-gray-500">
                  {{ participantSearchTerm.length < 2 ? 'Type at least 2 characters to search.' : 'No matching worker or member found.' }}
                </span>
              </template>
              <template #option="{ option }">
                <div class="flex flex-col">
                  <span class="font-semibold text-white">{{ option.name || option.label }}</span>
                  <span class="text-xs text-white/70">
                    {{ option.personType }}<template v-if="option.slug"> - {{ option.slug }}</template>
                  </span>
                </div>
              </template>
            </AutoComplete>
            <Select
              v-model="attendanceForm.arrival_status"
              :options="[
                { label: 'Early', value: 'early' },
                { label: 'Late', value: 'late' },
              ]"
              option-label="label"
              option-value="value"
              class="w-full"
            />
            <Button
              label="Add"
              icon="pi pi-plus"
              outlined
              class="!border-[#a83632] !text-[#a83632]"
              @click="addAttendanceRow"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="m-0 text-sm font-semibold text-gray-900">Participants</p>
          <SelectButton
            v-model="participantStatusFilter"
            :options="[
              { label: 'All', value: 'all' },
              { label: 'Present', value: 'present' },
              { label: 'Absent', value: 'absent' },
            ]"
            option-label="label"
            option-value="value"
            class="attendance-toggle"
          />
        </div>

        <DataTable
          :value="displayedAttendance"
          data-key="id"
          class="text-sm"
          table-style="min-width: 760px"
        >
          <Column field="personName" header="Person">
            <template #body="{ data }">
              <div class="flex flex-col">
                <span>{{ data.personName || `${data.personType} ${data.workerId || data.memberId}` }}</span>
                <span v-if="data.slug" class="text-xs text-gray-500">{{ data.slug }}</span>
              </div>
            </template>
          </Column>
          <Column field="personType" header="Type" />
          <Column field="participationStatus" header="Status">
            <template #body="{ data }">
              <Tag
                :value="data.participationStatus"
                :severity="participationSeverity(data.participationStatus)"
                rounded
              />
            </template>
          </Column>
          <Column field="attendanceGroup" header="Group">
            <template #body="{ data }">
              {{ attendanceGroupLabel(data) }}
            </template>
          </Column>
          <Column field="arrivalStatus" header="Arrival">
            <template #body="{ data }">
              <Select
                v-if="data.participationStatus === 'present'"
                :model-value="data.arrivalStatus"
                :options="[
                  { label: 'Early', value: 'early' },
                  { label: 'Late', value: 'late' },
                ]"
                option-label="label"
                option-value="value"
                class="w-32"
                @update:model-value="updateArrival(data, $event)"
              />
              <span v-else>-</span>
            </template>
          </Column>
          <Column header="Actions" style="width: 120px">
            <template #body="{ data }">
              <Button
                v-if="data.participationStatus === 'present'"
                label="Remove"
                severity="danger"
                text
                size="small"
                @click="removeAttendanceRow(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" severity="secondary" outlined :disabled="saving" @click="attendanceDialogOpen = false" />
          <Button
            label="Save attendance"
            icon="pi pi-save"
            class="!border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c] hover:!text-white"
            :loading="saving"
            @click="saveAttendance"
          />
        </div>
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
:deep(.prayer-records-table .p-datatable-header-cell) {
  background: #f9fafb;
  color: #111827;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

:deep(.prayer-records-table .p-datatable-tbody > tr:hover > td) {
  background: #f9fafb;
}

:deep(.prayer-records-table .p-datatable-tbody > tr:hover > td span:not(.p-tag):not(.p-tag-label):not(.record-title-pill)) {
  color: #111827;
}

:deep(.record-title-pill) {
  display: inline-flex;
  max-width: 16rem;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #ffffff;
  color: #111827;
  font-weight: 600;
  line-height: 1.25rem;
  padding: 0.25rem 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.prayer-records-table .p-datatable-tbody > tr:hover .record-title-pill) {
  background: #ffffff;
  color: #111827;
}

:deep(.prayer-records-table .p-paginator-page.p-paginator-page-selected) {
  background: #a83632;
  border-color: #a83632;
  color: #ffffff;
}

:deep(.attendance-toggle .p-togglebutton-checked) {
  background: #a83632;
  border-color: #a83632;
  color: #ffffff;
}
</style>
