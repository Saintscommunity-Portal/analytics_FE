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

definePageMeta({ middleware: 'auth', layout: 'admin' })

const { request } = useAdminApi()
const authStore = useAuthStore()

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const formError = ref('')
const createOpen = ref(false)
const completeWarningOpen = ref(false)
const selectedMeeting = ref(null)
const meetings = ref([])
const dashboard = ref(null)
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 10 })
const participantSummaryOpen = ref(false)
const participantSummaryRows = ref([])
const participantSummaryLoading = ref(false)
const participantSummaryMeta = ref({ current_page: 1, from: 0, last_page: 1, per_page: 10, to: 0, total: 0 })
const participantSummaryInfo = ref({ heldMeetings: 0, dateFrom: '', dateTo: '' })
const participantSummaryFirst = ref(0)
const participantSummaryRowsPerPage = ref(10)

const filters = reactive({ type: '', status: '', church_id: '', fellowship_id: '', cell_id: '', date_from: '', date_to: '' })
const participantSummaryFilters = reactive({
  date_from: '',
  date_to: '',
  church_id: '',
  fellowship_id: '',
  cell_id: '',
  type: '',
  person_type: '',
  participation_min: null,
  participation_max: null,
})
const form = reactive({ meeting_name: '', type: 'sunday_service', meeting_id: '', church_id: null, fellowship_id: null, cell_id: null, meeting_date: '' })

const meetingTypes = [
  'sunday_service',
  'midweek_service',
  'cell_meetings',
  'workers_meetings',
  'cell_leaders_training',
  'custom_meeting',
].map((value) => ({ label: displayValue(value), value }))
const statusOptions = ['pending', 'completed'].map((value) => ({ label: displayValue(value), value }))
const role = computed(() => authStore.admin?.role)
const isFellowshipScoped = computed(() => ['fellowship_pastor', 'fellowship_leader'].includes(role.value))
const isCellScoped = computed(() => role.value === 'cell_leader')
const ownedFellowships = computed(() => authStore.entities?.fellowships || [])
const ownedCells = computed(() => authStore.entities?.cells || [])
const churchOptions = computed(() => {
  const churches = (authStore.entities?.churches || []).map((church) => ({
    label: church.name,
    value: church.id,
    fellowships: church.fellowships || [],
  }))

  if (churches.length > 0) return churches

  if (authStore.admin?.church_id) {
    return [{
      label: 'Assigned church',
      value: authStore.admin.church_id,
      fellowships: ownedFellowships.value,
    }]
  }

  return []
})
const fellowshipOptions = computed(() => {
  if (ownedFellowships.value.length > 0) {
    return ownedFellowships.value.map((fellowship) => ({
      label: fellowship.name,
      value: fellowship.id,
      cells: fellowship.cells || [],
    }))
  }

  if (isCellScoped.value && authStore.admin?.fellowship_id) {
    return [{
      label: 'Assigned fellowship',
      value: authStore.admin.fellowship_id,
      cells: ownedCells.value,
    }]
  }

  const selectedChurch = churchOptions.value.find((church) => Number(church.value) === Number(filters.church_id || form.church_id))
  const source = selectedChurch ? [selectedChurch] : churchOptions.value

  return source.flatMap((church) => (church.fellowships || []).map((fellowship) => ({
    label: fellowship.name,
    value: fellowship.id,
    cells: fellowship.cells || [],
  })))
})
const cellOptions = computed(() => {
  if (ownedCells.value.length > 0) {
    return ownedCells.value.map((cell) => ({
      label: cell.name,
      value: cell.id,
    }))
  }

  const selectedFellowship = fellowshipOptions.value.find((fellowship) => Number(fellowship.value) === Number(filters.fellowship_id || form.fellowship_id))
  const source = selectedFellowship ? [selectedFellowship] : fellowshipOptions.value

  return source.flatMap((fellowship) => (fellowship.cells || []).map((cell) => ({
    label: cell.name,
    value: cell.id,
  })))
})
const totals = computed(() => dashboard.value?.totals || {})
const totalParticipantSummaryRecords = computed(() => participantSummaryMeta.value?.total || 0)
const reportCountsTotal = computed(() => (
  Number(totals.value.ushers_count || 0)
  + Number(totals.value.first_timers_count || 0)
  + Number(totals.value.childrens_count || 0)
))
const meetingTypeRows = computed(() => listFrom(dashboard.value?.meetingTypes))
const dailyRows = computed(() => listFrom(dashboard.value?.daily))
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
  },
}
const attendanceChartData = computed(() => ({
  labels: ['Workers present', 'Workers absent', 'Members present', 'Members absent'],
  datasets: [{
    data: [
      Number(totals.value.worker_present_count || 0),
      Number(totals.value.worker_absent_count || 0),
      Number(totals.value.member_present_count || 0),
      Number(totals.value.member_absent_count || 0),
    ],
    backgroundColor: ['#166534', '#d1d5db', '#2563eb', '#e5e7eb'],
  }],
}))
const reportCountChartData = computed(() => ({
  labels: ['Adult', 'Children', 'First timers'],
  datasets: [{
    label: 'Reported count',
    data: [
      Number(totals.value.ushers_count || 0),
      Number(totals.value.childrens_count || 0),
      Number(totals.value.first_timers_count || 0),
    ],
    backgroundColor: ['#a83632', '#2563eb', '#15803d'],
  }],
}))
const meetingTypeChartData = computed(() => ({
  labels: meetingTypeRows.value.map((row) => displayValue(row.meeting_type)),
  datasets: [{
    label: 'Reported attendance',
    data: meetingTypeRows.value.map((row) => Number(row.total_reported_attendance || 0)),
    backgroundColor: '#a83632',
  }],
}))
const dailyAttendanceChartData = computed(() => ({
  labels: dailyRows.value.map((row) => displayDate(row.date)),
  datasets: [
    {
      label: 'Reported',
      data: dailyRows.value.map((row) => Number(row.total_reported_attendance || 0)),
      borderColor: '#a83632',
      backgroundColor: '#a83632',
    },
    {
      label: 'Physical',
      data: dailyRows.value.map((row) => Number(row.total_physical_attendance || 0)),
      borderColor: '#2563eb',
      backgroundColor: '#2563eb',
    },
  ],
}))

function listFrom(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

function displayValue(value) {
  if (!value) return '-'
  return String(value).replace(/_/g, ' ')
}

function displayDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function canManageMeetingScope(meeting) {
  if (!role.value || !meeting) return false

  if (meeting.cellId) {
    return ['pastor', 'admin', 'church_pastor', 'fellowship_pastor', 'fellowship_leader', 'cell_leader'].includes(role.value)
  }

  if (meeting.fellowshipId) {
    return ['pastor', 'admin', 'church_pastor', 'fellowship_pastor', 'fellowship_leader'].includes(role.value)
  }

  return ['pastor', 'admin', 'church_pastor'].includes(role.value)
}

function meetingActionLabel(meeting) {
  if (meeting.status === 'completed') return 'View details'
  return canManageMeetingScope(meeting) ? 'Complete this meeting' : 'View details'
}

function handleMeetingAction(meeting) {
  if (meeting.status === 'completed' || !canManageMeetingScope(meeting)) {
    viewAttendance(meeting)
    return
  }

  confirmCompleteMeeting(meeting)
}

function query(page = 1) {
  const output = { page, per_page: meta.value.per_page || 10 }
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null) output[key] = value
  })
  return output
}

function buildParticipantSummaryQuery(page = 1) {
  const output = { page, per_page: participantSummaryRowsPerPage.value }
  Object.entries(participantSummaryFilters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) output[key] = value
  })
  return output
}

async function fetchMeetings(page = 1) {
  loading.value = true
  errorMessage.value = ''
  try {
    const [list, stats] = await Promise.all([
      request('/church-meetings', { method: 'GET', query: query(page) }),
      request('/church-meeting-dashboard', { method: 'GET', query: query(page) }),
    ])
    meetings.value = list?.data || []
    meta.value = { ...meta.value, ...(list?.meta || {}) }
    dashboard.value = stats?.data || null
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load church meetings.'
  } finally {
    loading.value = false
  }
}

async function fetchParticipantSummary(page = 1) {
  participantSummaryLoading.value = true
  errorMessage.value = ''

  try {
    const response = await request('/church-meeting-participants/summary', {
      method: 'GET',
      query: buildParticipantSummaryQuery(page),
    })

    participantSummaryRows.value = Array.isArray(response?.data) ? response.data : []
    participantSummaryMeta.value = { ...participantSummaryMeta.value, ...(response?.meta || {}) }
    participantSummaryInfo.value = { ...participantSummaryInfo.value, ...(response?.summary || {}) }
    participantSummaryRowsPerPage.value = Number(participantSummaryMeta.value.per_page || participantSummaryRowsPerPage.value)
    participantSummaryFirst.value = ((Number(participantSummaryMeta.value.current_page) || page) - 1) * participantSummaryRowsPerPage.value
  } catch (error) {
    participantSummaryRows.value = []
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load church meeting participant summary.'
  } finally {
    participantSummaryLoading.value = false
  }
}

function openParticipantSummary() {
  participantSummaryFilters.date_from = filters.date_from
  participantSummaryFilters.date_to = filters.date_to
  participantSummaryFilters.church_id = filters.church_id
  participantSummaryFilters.fellowship_id = filters.fellowship_id
  participantSummaryFilters.cell_id = filters.cell_id
  participantSummaryFilters.type = filters.type
  participantSummaryFilters.person_type = ''
  participantSummaryFilters.participation_min = null
  participantSummaryFilters.participation_max = null
  participantSummaryFirst.value = 0
  participantSummaryOpen.value = true
  fetchParticipantSummary(1)
}

function applyParticipantSummaryFilters() {
  participantSummaryFirst.value = 0
  fetchParticipantSummary(1)
}

function clearParticipantSummaryFilters() {
  participantSummaryFilters.date_from = filters.date_from
  participantSummaryFilters.date_to = filters.date_to
  participantSummaryFilters.church_id = ''
  participantSummaryFilters.fellowship_id = ''
  participantSummaryFilters.cell_id = ''
  participantSummaryFilters.type = ''
  participantSummaryFilters.person_type = ''
  participantSummaryFilters.participation_min = null
  participantSummaryFilters.participation_max = null
  participantSummaryFirst.value = 0
  fetchParticipantSummary(1)
}

function onParticipantSummaryPage(event) {
  participantSummaryRowsPerPage.value = event.rows
  participantSummaryFirst.value = event.first
  fetchParticipantSummary(event.page + 1)
}

function openCreate() {
  form.meeting_name = ''
  form.type = 'sunday_service'
  form.meeting_id = ''
  form.church_id = churchOptions.value[0]?.value || null
  form.fellowship_id = isFellowshipScoped.value || isCellScoped.value
    ? fellowshipOptions.value[0]?.value || authStore.admin?.fellowship_id || null
    : null
  form.cell_id = isCellScoped.value
    ? cellOptions.value[0]?.value || authStore.admin?.cell_id || null
    : null
  form.meeting_date = ''
  formError.value = ''
  createOpen.value = true
}

async function createMeeting() {
  saving.value = true
  formError.value = ''
  try {
    await request('/church-meetings', { method: 'POST', body: { ...form } })
    createOpen.value = false
    await fetchMeetings()
  } catch (error) {
    formError.value = error?.data?.message || error?.message || 'Unable to create meeting.'
  } finally {
    saving.value = false
  }
}

function confirmCompleteMeeting(meeting) {
  selectedMeeting.value = meeting
  completeWarningOpen.value = true
}

async function completeMeeting() {
  saving.value = true
  errorMessage.value = ''

  try {
    await request(`/church-meetings/${selectedMeeting.value.id}/complete`, { method: 'PATCH' })
    completeWarningOpen.value = false
    await fetchMeetings(meta.value.current_page || 1)
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to complete meeting.'
  } finally {
    saving.value = false
  }
}

function viewAttendance(meeting) {
  navigateTo(`/church-meetings/${meeting.id}`)
}

onMounted(fetchMeetings)
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="m-0 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Church meetings</p>
        <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">Meetings</h1>
        <p class="m-0 mt-2 text-sm text-gray-500">Create meetings, complete them, record offerings, and manage report counts.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          label="Participant summary"
          icon="pi pi-users"
          severity="secondary"
          outlined
          class="!border-[#a83632] !text-[#a83632]"
          @click="openParticipantSummary"
        />
        <Button label="New meeting" icon="pi pi-plus" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="openCreate" />
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <div class="grid gap-4 md:grid-cols-4">
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Reported attendance</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.total_reported_attendance || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Report counts</p><h2 class="m-0 mt-2 text-2xl font-semibold text-[#a83632]">{{ reportCountsTotal }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Offerings</p><h2 class="m-0 mt-2 text-2xl font-semibold text-green-700">{{ totals.total_offering_amount || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">First timers</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.first_timers_count || 0 }}</h2></template></Card>
    </div>

    <div class="grid gap-4 xl:grid-cols-4">
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Attendance split</p>
          <div class="mt-4 h-64">
            <Doughnut :data="attendanceChartData" :options="chartOptions" />
          </div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Reported count</p>
          <div class="mt-4 h-64">
            <Bar :data="reportCountChartData" :options="chartOptions" />
          </div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Meeting types</p>
          <div class="mt-4 h-64">
            <Bar :data="meetingTypeChartData" :options="chartOptions" />
          </div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Daily attendance</p>
          <div class="mt-4 h-64">
            <Line :data="dailyAttendanceChartData" :options="chartOptions" />
          </div>
        </template>
      </Card>
    </div>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Select v-model="filters.type" :options="meetingTypes" option-label="label" option-value="value" placeholder="Type" show-clear />
          <Select v-model="filters.status" :options="statusOptions" option-label="label" option-value="value" placeholder="Status" show-clear />
          <Select v-model="filters.church_id" :options="churchOptions" option-label="label" option-value="value" placeholder="Church" show-clear />
          <Select v-model="filters.fellowship_id" :options="fellowshipOptions" option-label="label" option-value="value" placeholder="Fellowship" show-clear />
          <Select v-model="filters.cell_id" :options="cellOptions" option-label="label" option-value="value" placeholder="Cell" show-clear />
          <InputText v-model="filters.date_from" type="date" />
          <InputText v-model="filters.date_to" type="date" />
          <Button label="Apply" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="fetchMeetings()" />
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 shadow-sm">
      <template #content>
        <DataTable class="church-meetings-table text-sm" :value="meetings" :loading="loading" paginator lazy :rows="meta.per_page || 10" :total-records="meta.total || 0" @page="fetchMeetings($event.page + 1)">
          <Column field="meetingName" header="Meeting" />
          <Column field="type" header="Type"><template #body="{ data }">{{ displayValue(data.type) }}</template></Column>
          <Column field="churchName" header="Church" />
          <Column field="meetingDate" header="Date"><template #body="{ data }">{{ displayDate(data.meetingDate) }}</template></Column>
          <Column field="status" header="Status"><template #body="{ data }">{{ displayValue(data.status) }}</template></Column>
          <Column header="Action">
            <template #body="{ data }">
              <Button
                :label="meetingActionLabel(data)"
                size="small"
                class="!border-[#a83632] !bg-[#a83632] !text-white"
                @click="handleMeetingAction(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="createOpen" modal header="New church meeting" class="w-[92vw] max-w-xl">
      <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
      <div class="grid gap-4">
        <InputText v-model="form.meeting_name" placeholder="Meeting name" />
        <Select v-model="form.type" :options="meetingTypes" option-label="label" option-value="value" placeholder="Type" />
        <InputText v-model="form.meeting_id" placeholder="Meeting ID (optional)" />
        <Select v-model="form.church_id" :options="churchOptions" option-label="label" option-value="value" placeholder="Church" />
        <Select v-model="form.fellowship_id" :options="fellowshipOptions" option-label="label" option-value="value" placeholder="Fellowship" show-clear />
        <Select v-model="form.cell_id" :options="cellOptions" option-label="label" option-value="value" placeholder="Cell" show-clear />
        <InputText v-model="form.meeting_date" type="datetime-local" />
      </div>
      <template #footer><Button label="Cancel" severity="secondary" outlined @click="createOpen = false" /><Button label="Create" :loading="saving" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="createMeeting" /></template>
    </Dialog>

    <Dialog
      v-model:visible="participantSummaryOpen"
      modal
      header="Church meeting participant summary"
      :style="{ width: 'min(96vw, 1120px)' }"
    >
      <div class="space-y-4">
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div class="grid gap-3 md:grid-cols-4">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">From</label>
              <InputText v-model="participantSummaryFilters.date_from" type="date" class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">To</label>
              <InputText v-model="participantSummaryFilters.date_to" type="date" class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Person</label>
              <Select
                v-model="participantSummaryFilters.person_type"
                :options="[
                  { label: 'Workers and members', value: '' },
                  { label: 'Workers', value: 'worker' },
                  { label: 'Members', value: 'member' },
                ]"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Meetings held</label>
              <div class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-950">
                {{ participantSummaryInfo.heldMeetings || 0 }}
              </div>
            </div>
          </div>

          <div class="mt-3 grid gap-3 md:grid-cols-4">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Church</label>
              <Select v-model="participantSummaryFilters.church_id" :options="churchOptions" option-label="label" option-value="value" placeholder="Church" show-clear class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Fellowship</label>
              <Select v-model="participantSummaryFilters.fellowship_id" :options="fellowshipOptions" option-label="label" option-value="value" placeholder="Fellowship" show-clear class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Cell</label>
              <Select v-model="participantSummaryFilters.cell_id" :options="cellOptions" option-label="label" option-value="value" placeholder="Cell" show-clear class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Meeting type</label>
              <Select v-model="participantSummaryFilters.type" :options="meetingTypes" option-label="label" option-value="value" placeholder="Meeting type" show-clear class="w-full" />
            </div>
          </div>

          <div class="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Participation min</label>
              <InputNumber v-model="participantSummaryFilters.participation_min" :min="0" :max="participantSummaryInfo.heldMeetings || undefined" show-buttons class="w-full" input-class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Participation max</label>
              <InputNumber v-model="participantSummaryFilters.participation_max" :min="0" :max="participantSummaryInfo.heldMeetings || undefined" show-buttons class="w-full" input-class="w-full" />
            </div>
            <Button label="Reset" severity="secondary" outlined @click="clearParticipantSummaryFilters" />
            <Button label="Apply" icon="pi pi-filter" class="!border-[#a83632] !bg-[#a83632] !text-white" :loading="participantSummaryLoading" @click="applyParticipantSummaryFilters" />
          </div>
        </div>

        <div class="rounded-xl border border-[#a83632]/20 bg-[#a83632]/5 px-4 py-3 text-sm text-gray-700">
          Participation count is based on present attendance records in the selected range.
          Example: <strong>2/4</strong> means a person was present for 2 out of 4 meetings held.
        </div>

        <DataTable
          :value="participantSummaryRows"
          lazy
          paginator
          :first="participantSummaryFirst"
          :rows="participantSummaryRowsPerPage"
          :total-records="totalParticipantSummaryRecords"
          :rows-per-page-options="[10, 25, 50, 100]"
          scrollable
          scroll-height="520px"
          table-style="min-width: 980px"
          class="church-meetings-table text-sm"
          :loading="participantSummaryLoading"
          @page="onParticipantSummaryPage"
        >
          <Column field="name" header="Name" style="min-width: 220px" />
          <Column field="participationLabel" header="Participation" style="min-width: 140px">
            <template #body="{ data }">
              <span class="rounded-full bg-[#a83632]/10 px-3 py-1 text-sm font-semibold text-[#a83632]">
                {{ data.participationLabel }}
              </span>
            </template>
          </Column>
          <Column field="absentCount" header="Absent" style="min-width: 110px" />
          <Column field="personType" header="Type" style="min-width: 110px">
            <template #body="{ data }">{{ displayValue(data.personType) }}</template>
          </Column>
          <Column field="churchName" header="Church" style="min-width: 180px" />
          <Column field="fellowshipName" header="Fellowship" style="min-width: 180px" />
          <Column field="cellName" header="Cell" style="min-width: 160px" />
        </DataTable>
      </div>
    </Dialog>

    <Dialog v-model:visible="completeWarningOpen" modal header="Complete this meeting?" class="w-[92vw] max-w-md">
      <div class="space-y-3">
        <Message severity="warn" :closable="false">
          Completing this meeting will mark it as completed and generate attendance records for expected participants.
        </Message>
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p class="m-0 text-sm font-semibold text-gray-950">{{ selectedMeeting?.meetingName }}</p>
          <p class="m-0 mt-1 text-xs text-gray-500">{{ displayDate(selectedMeeting?.meetingDate) }}</p>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" outlined :disabled="saving" @click="completeWarningOpen = false" />
        <Button label="Proceed" :loading="saving" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="completeMeeting" />
      </template>
    </Dialog>

  </section>
</template>

<style scoped>
:global(.dark) :deep(.church-meetings-table .p-datatable-tbody > tr > td),
:global(.dark) :deep(.church-meetings-table .p-datatable-tbody > tr > td span:not(.p-tag-label)),
:global(.dark) :deep(.church-meetings-table .p-datatable-tbody > tr > td p),
:global(.dark) :deep(.church-meetings-table .p-datatable-tbody > tr > td div),
:global(.dark) :deep(.church-meetings-table .p-datatable-tbody > tr > td strong) {
  color: #f9fafb !important;
}
</style>
