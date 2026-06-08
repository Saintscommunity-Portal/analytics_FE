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

const loading = ref(false)
const errorMessage = ref('')
const activeSection = ref('people')
const sectionLoading = reactive({})
const sectionErrors = reactive({})
const dashboards = reactive({
  people: null,
  prayer: null,
  study: null,
  meetings: null,
  outreach: null,
  followups: null,
})

const filters = reactive({
  date_from: '',
  date_to: '',
  church_id: '',
  fellowship_id: '',
  cell_id: '',
})

const sections = [
  { key: 'people', label: 'People', subtitle: 'Workers, members, age and status mix', endpoint: '/people-dashboard', route: '/workers' },
  { key: 'prayer', label: 'Prayer', subtitle: 'Prayer group and vigil attendance', endpoint: '/prayer-dashboard', route: '/prayer-group' },
  { key: 'study', label: 'Study Group', subtitle: 'Submissions, defaulted work and grading', endpoint: '/study-group-dashboard', route: '/study-group' },
  { key: 'meetings', label: 'Meetings', subtitle: 'Church meeting attendance and offerings', endpoint: '/church-meeting-dashboard', route: '/church-meetings' },
  { key: 'outreach', label: 'Outreach', subtitle: 'Evangelism reports and outcomes', endpoint: '/outreach-dashboard', route: '/outreaches' },
  { key: 'followups', label: 'Follow Ups', subtitle: 'Follow-up activity and worker coverage', endpoint: '/followup-dashboard', route: '/followups' },
]

const entities = computed(() => authStore.entities || {})
const churchOptions = computed(() => (entities.value.churches || []).map((church) => ({ label: church.name, value: church.id, fellowships: church.fellowships || [] })))
const fellowshipOptions = computed(() => {
  if (Array.isArray(entities.value.fellowships)) {
    return entities.value.fellowships.map((item) => ({ label: item.name, value: item.id, cells: item.cells || [] }))
  }

  const selectedChurch = churchOptions.value.find((church) => Number(church.value) === Number(filters.church_id))
  const source = selectedChurch ? [selectedChurch] : churchOptions.value
  return source.flatMap((church) => (church.fellowships || []).map((item) => ({ label: item.name, value: item.id, cells: item.cells || [] })))
})
const cellOptions = computed(() => {
  if (Array.isArray(entities.value.cells)) {
    return entities.value.cells.map((item) => ({ label: item.name, value: item.id }))
  }

  const selectedFellowship = fellowshipOptions.value.find((item) => Number(item.value) === Number(filters.fellowship_id))
  const source = selectedFellowship ? [selectedFellowship] : fellowshipOptions.value
  return source.flatMap((fellowship) => (fellowship.cells || []).map((cell) => ({ label: cell.name, value: cell.id })))
})

const people = computed(() => dashboards.people || {})
const peopleTotals = computed(() => people.value?.totals || {})
const activeDashboard = computed(() => dashboards[activeSection.value] || {})
const activeTotals = computed(() => activeDashboard.value?.totals || {})
const activeConfig = computed(() => sections.find((section) => section.key === activeSection.value) || sections[0])
const overviewCards = computed(() => [
  { label: 'Workers', value: peopleTotals.value.workers || 0, detail: 'Total workers' },
  { label: 'Members', value: peopleTotals.value.members || 0, detail: 'Total members' },
  { label: 'Members added', value: peopleTotals.value.membersAddedInPeriod || 0, detail: 'Selected period' },
  { label: 'Children', value: peopleTotals.value.children || 0, detail: 'Member records' },
])

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
}

const barOptions = {
  ...chartOptions,
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
}

const chartPalette = ['#a83632', '#2563eb', '#15803d', '#f59e0b', '#7c3aed', '#0f766e', '#db2777', '#6b7280']

function paletteFor(items) {
  return items.map((_, index) => chartPalette[index % chartPalette.length])
}

const peopleAgeData = computed(() => ({
  labels: (people.value.memberAgeDistribution || []).map((item) => item.label),
  datasets: [{
    label: 'Members',
    data: (people.value.memberAgeDistribution || []).map((item) => item.count),
    backgroundColor: paletteFor(people.value.memberAgeDistribution || []),
    borderRadius: 8,
  }],
}))

const peopleStatusData = computed(() => ({
  labels: (people.value.workersByStatus || []).map((item) => item.label),
  datasets: [{ data: (people.value.workersByStatus || []).map((item) => item.count), backgroundColor: paletteFor(people.value.workersByStatus || []) }],
}))

const prayerData = computed(() => ({
  labels: ['Present', 'Absent', 'Early', 'Late'],
  datasets: [{
    label: 'Prayer',
    data: [
      activeTotals.value.total_present || 0,
      activeTotals.value.total_absent || 0,
      activeTotals.value.early_count || 0,
      activeTotals.value.late_count || 0,
    ],
    backgroundColor: ['#15803d', '#d1d5db', '#2563eb', '#a83632'],
  }],
}))

const studyData = computed(() => ({
  labels: ['Submitted', 'Defaulted', 'Pending', 'Approved', 'Rejected'],
  datasets: [{
    label: 'Study group',
    data: [
      activeTotals.value.totalSubmitted || 0,
      activeTotals.value.totalDefaulted || 0,
      activeTotals.value.totalPending || 0,
      activeTotals.value.totalApproved || 0,
      activeTotals.value.totalRejected || 0,
    ],
    backgroundColor: ['#15803d', '#d1d5db', '#f59e0b', '#2563eb', '#a83632'],
  }],
}))

const meetingData = computed(() => ({
  labels: ['Reported', 'Physical', 'Workers present', 'Members present', 'Offerings'],
  datasets: [{
    label: 'Meetings',
    data: [
      activeTotals.value.total_reported_attendance || 0,
      activeTotals.value.total_physical_attendance || 0,
      activeTotals.value.worker_present_count || 0,
      activeTotals.value.member_present_count || 0,
      Number(activeTotals.value.total_offering_amount || 0),
    ],
    backgroundColor: ['#a83632', '#2563eb', '#15803d', '#0f766e', '#f59e0b'],
  }],
}))

const outreachData = computed(() => ({
  labels: ['Reports', 'Saved', 'Filled', 'Healed', 'Has follow up'],
  datasets: [{
    label: 'Outreach',
    data: [
      activeTotals.value.total_reports || 0,
      activeTotals.value.total_saved || 0,
      activeTotals.value.total_filled || 0,
      activeTotals.value.total_healed || 0,
      activeTotals.value.has_followup_count || 0,
    ],
    backgroundColor: ['#a83632', '#15803d', '#2563eb', '#7c3aed', '#0f766e'],
  }],
}))

const followupData = computed(() => ({
  labels: ['Activities', 'Reports', 'Members', 'Outreach reports', 'Workers engaged'],
  datasets: [{
    label: 'Follow ups',
    data: [
      activeTotals.value.total_followup_activities || 0,
      activeTotals.value.total_reports_sent || 0,
      activeTotals.value.member_followups_count || 0,
      activeTotals.value.outreach_followups_count || 0,
      activeTotals.value.workers_engaged_count || 0,
    ],
    backgroundColor: ['#a83632', '#2563eb', '#15803d', '#7c3aed', '#0f766e'],
  }],
}))

const activeChartData = computed(() => {
  if (activeSection.value === 'people') return peopleAgeData.value
  if (activeSection.value === 'prayer') return prayerData.value
  if (activeSection.value === 'study') return studyData.value
  if (activeSection.value === 'meetings') return meetingData.value
  if (activeSection.value === 'outreach') return outreachData.value
  return followupData.value
})

const activeChartType = computed(() => activeSection.value === 'people' ? 'doughnut' : 'bar')

const timelineData = computed(() => {
  const daily = activeDashboard.value?.daily || activeDashboard.value?.participationDaily || []
  const labels = daily.map((row) => row.date || row.week || row.month)
  const values = daily.map((row) => Number(row.total_present || row.total_submitted || row.total_reported_attendance || row.total_outreaches || row.total_followup_activities || row.total_reports_sent || row.count || 0))

  return {
    labels,
    datasets: [{ label: activeConfig.value.label, data: values, borderColor: '#a83632', backgroundColor: '#a83632' }],
  }
})

function toDateInput(date) {
  return date.toISOString().slice(0, 10)
}

function setDefaultRange() {
  const today = new Date()
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  filters.date_from = toDateInput(lastMonth)
  filters.date_to = toDateInput(today)
}

function buildQuery(sectionKey = activeSection.value) {
  const query = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== null) query[key] = value
  }

  if (['outreach', 'followups'].includes(sectionKey)) {
    query.from_date = query.date_from
    query.to_date = query.date_to
    delete query.date_from
    delete query.date_to
  }

  return query
}

async function fetchSection(sectionKey, force = false) {
  const config = sections.find((section) => section.key === sectionKey)
  if (!config || (dashboards[sectionKey] && !force)) return

  sectionLoading[sectionKey] = true
  sectionErrors[sectionKey] = ''

  try {
    const response = await request(config.endpoint, { method: 'GET', query: buildQuery(sectionKey) })
    dashboards[sectionKey] = response?.data || null
  } catch (error) {
    dashboards[sectionKey] = null
    sectionErrors[sectionKey] = error?.data?.message || error?.message || `Unable to load ${config.label}.`
  } finally {
    sectionLoading[sectionKey] = false
  }
}

async function fetchOverview(force = false) {
  loading.value = true
  errorMessage.value = ''

  try {
    await fetchSection('people', force)
    await fetchSection(activeSection.value, force)
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load dashboard.'
  } finally {
    loading.value = false
  }
}

async function selectSection(sectionKey) {
  activeSection.value = sectionKey
  await fetchSection(sectionKey)
}

function applyFilters() {
  Object.keys(dashboards).forEach((key) => {
    dashboards[key] = null
  })
  fetchOverview(true)
}

function resetFilters() {
  filters.church_id = ''
  filters.fellowship_id = ''
  filters.cell_id = ''
  setDefaultRange()
  applyFilters()
}

watch(() => filters.church_id, () => {
  filters.fellowship_id = ''
  filters.cell_id = ''
})

watch(() => filters.fellowship_id, () => {
  filters.cell_id = ''
})

onMounted(() => {
  setDefaultRange()
  fetchOverview()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Executive Overview</p>
        <h1 class="m-0 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">Activity Dashboard</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          A compact view of people, prayer, learning, meetings, outreach, and follow-up activity.
        </p>
      </div>
      <Button label="Refresh" icon="pi pi-refresh" class="!border-[#a83632] !bg-[#a83632] !text-white" :loading="loading" @click="applyFilters" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <template #content>
        <div class="grid gap-3 md:grid-cols-5">
          <InputText v-model="filters.date_from" type="date" class="w-full" />
          <InputText v-model="filters.date_to" type="date" class="w-full" />
          <Select v-model="filters.church_id" :options="churchOptions" option-label="label" option-value="value" placeholder="Church" show-clear class="w-full" />
          <Select v-model="filters.fellowship_id" :options="fellowshipOptions" option-label="label" option-value="value" placeholder="Fellowship" show-clear class="w-full" />
          <Select v-model="filters.cell_id" :options="cellOptions" option-label="label" option-value="value" placeholder="Cell" show-clear class="w-full" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <Button label="Reset" severity="secondary" outlined @click="resetFilters" />
          <Button label="Apply filters" class="!border-[#a83632] !bg-[#a83632] !text-white" :loading="loading" @click="applyFilters" />
        </div>
      </template>
    </Card>

    <div class="grid gap-4 md:grid-cols-4">
      <Card v-for="card in overviewCards" :key="card.label" class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <template #content>
          <p class="m-0 text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{{ card.value }}</h2>
          <p class="m-0 mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.detail }}</p>
        </template>
      </Card>
    </div>

    <div class="grid gap-3 lg:grid-cols-6">
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="rounded-2xl border p-4 text-left transition"
        :class="activeSection === section.key ? 'border-[#a83632] bg-[#a83632]/10 text-[#a83632] dark:bg-[#a83632]/20' : 'border-gray-200 bg-white text-gray-700 hover:border-[#a83632]/40 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200'"
        @click="selectSection(section.key)"
      >
        <span class="block text-sm font-semibold">{{ section.label }}</span>
        <span class="mt-1 block text-xs opacity-75">{{ section.subtitle }}</span>
      </button>
    </div>

    <Message v-if="sectionErrors[activeSection]" severity="error" :closable="false">{{ sectionErrors[activeSection] }}</Message>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <template #content>
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 class="m-0 text-base font-semibold text-gray-950 dark:text-white">{{ activeConfig.label }}</h2>
              <p class="m-0 mt-1 text-sm text-gray-500 dark:text-gray-400">{{ activeConfig.subtitle }}</p>
            </div>
            <NuxtLink :to="activeConfig.route" class="text-sm font-semibold text-[#a83632] no-underline">View full report</NuxtLink>
          </div>
          <Skeleton v-if="sectionLoading[activeSection]" height="20rem" border-radius="16px" />
          <div v-else class="h-80">
            <Doughnut v-if="activeChartType === 'doughnut'" :data="activeChartData" :options="chartOptions" />
            <Bar v-else :data="activeChartData" :options="barOptions" />
          </div>
        </template>
      </Card>

      <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <template #content>
          <h2 class="m-0 text-base font-semibold text-gray-950 dark:text-white">Quick stats</h2>
          <div class="mt-4 space-y-3">
            <div v-for="(value, key) in activeTotals" :key="key" class="flex items-center justify-between gap-4 rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-gray-800">
              <span class="capitalize text-gray-500 dark:text-gray-400">{{ String(key).replace(/_/g, ' ').replace(/([A-Z])/g, ' $1') }}</span>
              <strong class="text-gray-950 dark:text-white">{{ value ?? 0 }}</strong>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <template #content>
        <h2 class="m-0 text-base font-semibold text-gray-950 dark:text-white">Timeline</h2>
        <p class="m-0 mt-1 text-sm text-gray-500 dark:text-gray-400">Loaded only for the selected section.</p>
        <div class="mt-4 h-72">
          <Line :data="timelineData" :options="chartOptions" />
        </div>
      </template>
    </Card>
  </section>
</template>
