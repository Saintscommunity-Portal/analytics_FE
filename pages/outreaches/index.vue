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
const workersLoading = ref(false)
const errorMessage = ref('')
const outreaches = ref([])
const dashboard = ref(null)
const workerOptions = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 20 })
const workerSummaryOpen = ref(false)
const workerSummaryRows = ref([])
const workerSummaryLoading = ref(false)
const workerSummaryMeta = ref({ current_page: 1, from: 0, last_page: 1, per_page: 20, to: 0, total: 0 })
const workerSummaryInfo = ref({ dateFrom: '', dateTo: '', rangeWeekCount: 0, reportFilter: 'all' })
const workerSummaryFirst = ref(0)
const workerSummaryRowsPerPage = ref(20)
const filters = reactive({
  from_date: '',
  to_date: '',
  church_id: '',
  fellowship_id: '',
  cell_id: '',
  worker_id: '',
})
const workerSummaryFilters = reactive({
  from_date: '',
  to_date: '',
  church_id: '',
  fellowship_id: '',
  cell_id: '',
  worker_id: '',
  report_filter: 'all',
})
const reportFilterOptions = [
  { label: 'All souls reached', value: 'all' },
  { label: 'Saved only', value: 'saved' },
  { label: 'Filled only', value: 'filled' },
  { label: 'Healed only', value: 'healed' },
]

const churchOptions = computed(() => (authStore.entities?.churches || []).map((church) => ({ label: church.name, value: church.id, fellowships: church.fellowships || [] })))
const fellowshipOptions = computed(() => {
  if (authStore.entities?.fellowships?.length) {
    return authStore.entities.fellowships.map((fellowship) => ({ label: fellowship.name, value: fellowship.id, cells: fellowship.cells || [] }))
  }
  return churchOptions.value.flatMap((church) => (church.fellowships || []).map((fellowship) => ({ label: fellowship.name, value: fellowship.id, cells: fellowship.cells || [] })))
})
const cellOptions = computed(() => {
  if (authStore.entities?.cells?.length) {
    return authStore.entities.cells.map((cell) => ({ label: cell.name, value: cell.id }))
  }
  const selected = fellowshipOptions.value.find((fellowship) => Number(fellowship.value) === Number(filters.fellowship_id))
  const source = selected ? [selected] : fellowshipOptions.value
  return source.flatMap((fellowship) => (fellowship.cells || []).map((cell) => ({ label: cell.name, value: cell.id })))
})
const totals = computed(() => dashboard.value?.totals || {})
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
  },
}
const outcomeChartData = computed(() => ({
  labels: ['Saved', 'Filled', 'Healed'],
  datasets: [{
    data: [
      Number(totals.value.total_saved || 0),
      Number(totals.value.total_filled || 0),
      Number(totals.value.total_healed || 0),
    ],
    backgroundColor: ['#15803d', '#2563eb', '#a83632'],
  }],
}))
const followupChartData = computed(() => ({
  labels: ['No follow-up', 'Has follow-up'],
  datasets: [{
    data: [
      Number(totals.value.no_followup_count || 0),
      Number(totals.value.has_followup_count || 0),
    ],
    backgroundColor: ['#9ca3af', '#a83632'],
  }],
}))
const participationChartData = computed(() => ({
  labels: ['Workers reported', 'Workers did not report', 'Members reported', 'Members did not report'],
  datasets: [{
    label: 'Daily participation',
    data: [
      Number(totals.value.workers_reported_count || 0),
      Number(totals.value.workers_not_reported_count || 0),
      Number(totals.value.members_reported_count || 0),
      Number(totals.value.members_not_reported_count || 0),
    ],
    backgroundColor: ['#166534', '#d1d5db', '#2563eb', '#e5e7eb'],
  }],
}))
const dailyChartData = computed(() => ({
  labels: (dashboard.value?.daily || []).map((row) => displayDate(row.date)),
  datasets: [
    {
      label: 'Outreaches',
      data: (dashboard.value?.daily || []).map((row) => Number(row.total_outreaches || 0)),
      borderColor: '#a83632',
      backgroundColor: '#a83632',
    },
  ],
}))

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value).replace(/_/g, ' ')
}

function displayDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

function query(page = 1) {
  const output = { page, per_page: meta.value.per_page || 20 }
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null) output[key] = value
  })
  return output
}

function workerSummaryQuery(page = 1) {
  const output = { page, per_page: workerSummaryRowsPerPage.value }
  Object.entries(workerSummaryFilters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) output[key] = value
  })
  return output
}

async function fetchOutreaches(page = 1) {
  loading.value = true
  errorMessage.value = ''
  try {
    const [list, stats] = await Promise.all([
      request('/outreaches', { method: 'GET', query: query(page) }),
      request('/outreach-dashboard', { method: 'GET', query: query(page) }),
    ])
    outreaches.value = list?.data || []
    meta.value = { ...meta.value, ...(list?.meta || {}) }
    dashboard.value = stats?.data || null
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load outreaches.'
  } finally {
    loading.value = false
  }
}

async function fetchWorkerOptions() {
  workersLoading.value = true
  try {
    const response = await request('/workers', {
      method: 'GET',
      query: {
        per_page: 500,
        sort_by: 'first_name',
        direction: 'asc',
      },
    })
    workerOptions.value = (response?.data || []).map((worker) => ({
      label: [worker.firstName, worker.lastName].filter(Boolean).join(' ') || `Worker ${worker.id}`,
      value: worker.id,
    }))
  } finally {
    workersLoading.value = false
  }
}

async function fetchWorkerSummary(page = 1) {
  workerSummaryLoading.value = true
  errorMessage.value = ''

  try {
    const response = await request('/outreach-worker-summary', {
      method: 'GET',
      query: workerSummaryQuery(page),
    })
    workerSummaryRows.value = Array.isArray(response?.data) ? response.data : []
    workerSummaryMeta.value = { ...workerSummaryMeta.value, ...(response?.meta || {}) }
    workerSummaryInfo.value = { ...workerSummaryInfo.value, ...(response?.summary || {}) }
    workerSummaryRowsPerPage.value = Number(workerSummaryMeta.value.per_page || workerSummaryRowsPerPage.value)
    workerSummaryFirst.value = ((Number(workerSummaryMeta.value.current_page) || page) - 1) * workerSummaryRowsPerPage.value
  } catch (error) {
    workerSummaryRows.value = []
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load outreach worker summary.'
  } finally {
    workerSummaryLoading.value = false
  }
}

function openWorkerSummary() {
  workerSummaryFilters.from_date = filters.from_date
  workerSummaryFilters.to_date = filters.to_date
  workerSummaryFilters.church_id = filters.church_id
  workerSummaryFilters.fellowship_id = filters.fellowship_id
  workerSummaryFilters.cell_id = filters.cell_id
  workerSummaryFilters.worker_id = filters.worker_id
  workerSummaryFilters.report_filter = 'all'
  workerSummaryFirst.value = 0
  workerSummaryOpen.value = true
  fetchWorkerSummary(1)
}

function applyWorkerSummaryFilters() {
  workerSummaryFirst.value = 0
  fetchWorkerSummary(1)
}

function clearWorkerSummaryFilters() {
  workerSummaryFilters.from_date = filters.from_date
  workerSummaryFilters.to_date = filters.to_date
  workerSummaryFilters.church_id = ''
  workerSummaryFilters.fellowship_id = ''
  workerSummaryFilters.cell_id = ''
  workerSummaryFilters.worker_id = ''
  workerSummaryFilters.report_filter = 'all'
  workerSummaryFirst.value = 0
  fetchWorkerSummary(1)
}

function onWorkerSummaryPage(event) {
  workerSummaryRowsPerPage.value = event.rows
  workerSummaryFirst.value = event.first
  fetchWorkerSummary(event.page + 1)
}

function viewOutreach(outreach) {
  navigateTo(`/outreaches/${outreach.id}`)
}

onMounted(async () => {
  await Promise.all([fetchOutreaches(), fetchWorkerOptions()])
})
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="m-0 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Outreach</p>
        <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">Outreach analytics</h1>
        <p class="m-0 mt-2 text-sm text-gray-500">Review worker outreach activities and reports within your scope.</p>
      </div>
      <Button
        label="Worker activity summary"
        icon="pi pi-users"
        severity="secondary"
        outlined
        class="!border-[#a83632] !text-[#a83632]"
        @click="openWorkerSummary"
      />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <div class="grid gap-4 md:grid-cols-4">
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Outreaches</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.total_outreaches || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Reports</p><h2 class="m-0 mt-2 text-2xl font-semibold text-[#a83632]">{{ totals.total_reports || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Saved</p><h2 class="m-0 mt-2 text-2xl font-semibold text-green-700">{{ totals.total_saved || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Followed up</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.has_followup_count || 0 }}</h2></template></Card>
    </div>

    <div class="grid gap-4 xl:grid-cols-4">
      <Card class="border border-gray-200 bg-white shadow-sm xl:col-span-1">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Outcomes</p>
          <div class="mt-4 h-64">
            <Doughnut :data="outcomeChartData" :options="chartOptions" />
          </div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm xl:col-span-1">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Follow-up split</p>
          <div class="mt-4 h-64">
            <Doughnut :data="followupChartData" :options="chartOptions" />
          </div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm xl:col-span-1">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Reported vs not reported</p>
          <div class="mt-4 h-64">
            <Bar :data="participationChartData" :options="chartOptions" />
          </div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm xl:col-span-1">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Outreaches by day</p>
          <div class="mt-4 h-64">
            <Line :data="dailyChartData" :options="chartOptions" />
          </div>
        </template>
      </Card>
    </div>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <InputText v-model="filters.from_date" type="date" />
          <InputText v-model="filters.to_date" type="date" />
          <Select v-model="filters.church_id" :options="churchOptions" option-label="label" option-value="value" placeholder="Church" show-clear />
          <Select v-model="filters.fellowship_id" :options="fellowshipOptions" option-label="label" option-value="value" placeholder="Fellowship" show-clear />
          <Select v-model="filters.cell_id" :options="cellOptions" option-label="label" option-value="value" placeholder="Cell" show-clear />
          <Select v-model="filters.worker_id" :options="workerOptions" :loading="workersLoading" option-label="label" option-value="value" placeholder="Worker" show-clear />
          <Button label="Apply" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="fetchOutreaches()" />
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <DataTable :value="outreaches" :loading="loading" paginator lazy :rows="meta.per_page || 20" :total-records="meta.total || 0" row-hover @page="fetchOutreaches($event.page + 1)">
          <Column field="date" header="Date"><template #body="{ data }">{{ displayDate(data.date) }}</template></Column>
          <Column field="timeStarted" header="Time" />
          <Column field="locationCovered" header="Location" />
          <Column field="workerName" header="Worker" />
          <Column field="churchName" header="Church" />
          <Column field="fellowshipName" header="Fellowship"><template #body="{ data }">{{ displayValue(data.fellowshipName) }}</template></Column>
          <Column field="cellName" header="Cell"><template #body="{ data }">{{ displayValue(data.cellName) }}</template></Column>
          <Column field="reportCount" header="Reports" />
          <Column field="savedCount" header="Saved" />
          <Column field="filledCount" header="Filled" />
          <Column field="healedCount" header="Healed" />
          <Column field="followupCount" header="Follow ups" />
          <Column header="Action">
            <template #body="{ data }">
              <Button label="View" size="small" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="viewOutreach(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog
      v-model:visible="workerSummaryOpen"
      modal
      header="Outreach worker activity summary"
      :style="{ width: 'min(96vw, 1180px)' }"
    >
      <div class="space-y-4">
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div class="grid gap-3 md:grid-cols-4">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">From</label>
              <InputText v-model="workerSummaryFilters.from_date" type="date" class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">To</label>
              <InputText v-model="workerSummaryFilters.to_date" type="date" class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Report outcome</label>
              <Select v-model="workerSummaryFilters.report_filter" :options="reportFilterOptions" option-label="label" option-value="value" class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Weeks in range</label>
              <div class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-950">
                {{ workerSummaryInfo.rangeWeekCount || 0 }}
              </div>
            </div>
          </div>

          <div class="mt-3 grid gap-3 md:grid-cols-4">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Church</label>
              <Select v-model="workerSummaryFilters.church_id" :options="churchOptions" option-label="label" option-value="value" placeholder="Church" show-clear class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Fellowship</label>
              <Select v-model="workerSummaryFilters.fellowship_id" :options="fellowshipOptions" option-label="label" option-value="value" placeholder="Fellowship" show-clear class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Cell</label>
              <Select v-model="workerSummaryFilters.cell_id" :options="cellOptions" option-label="label" option-value="value" placeholder="Cell" show-clear class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Worker</label>
              <Select v-model="workerSummaryFilters.worker_id" :options="workerOptions" :loading="workersLoading" option-label="label" option-value="value" placeholder="Worker" show-clear class="w-full" />
            </div>
          </div>

          <div class="mt-3 flex flex-wrap justify-end gap-2">
            <Button label="Reset" severity="secondary" outlined @click="clearWorkerSummaryFilters" />
            <Button label="Apply" icon="pi pi-filter" class="!border-[#a83632] !bg-[#a83632] !text-white" :loading="workerSummaryLoading" @click="applyWorkerSummaryFilters" />
          </div>
        </div>

        <div class="rounded-xl border border-[#a83632]/20 bg-[#a83632]/5 px-4 py-3 text-sm text-gray-700">
          Outreach activity is counted from outreach records. Souls reached is counted from outreach reports and respects the selected outcome filter.
        </div>

        <DataTable
          :value="workerSummaryRows"
          lazy
          paginator
          :first="workerSummaryFirst"
          :rows="workerSummaryRowsPerPage"
          :total-records="workerSummaryMeta.total || 0"
          :rows-per-page-options="[10, 20, 50, 100]"
          scrollable
          scroll-height="520px"
          table-style="min-width: 1120px"
          class="text-sm"
          :loading="workerSummaryLoading"
          @page="onWorkerSummaryPage"
        >
          <Column field="workerName" header="Worker" style="min-width: 210px">
            <template #body="{ data }">
              <div>
                <p class="m-0 font-semibold text-gray-950">{{ data.workerName }}</p>
                <p class="m-0 text-xs text-gray-500">{{ data.workerSlug || '-' }}</p>
              </div>
            </template>
          </Column>
          <Column field="participationLabel" header="Participation" style="min-width: 140px">
            <template #body="{ data }">
              <span class="rounded-full bg-[#a83632]/10 px-3 py-1 text-sm font-semibold text-[#a83632]">
                {{ data.participationLabel }}
              </span>
            </template>
          </Column>
          <Column field="averageParticipationPerWeek" header="Avg / week" style="min-width: 120px" />
          <Column field="soulsReachedCount" header="Souls reached" style="min-width: 130px" />
          <Column field="savedCount" header="Saved" style="min-width: 100px" />
          <Column field="filledCount" header="Filled" style="min-width: 100px" />
          <Column field="healedCount" header="Healed" style="min-width: 100px" />
          <Column field="churchName" header="Church" style="min-width: 180px" />
          <Column field="fellowshipName" header="Fellowship" style="min-width: 180px" />
          <Column field="cellName" header="Cell" style="min-width: 160px" />
        </DataTable>
      </div>
    </Dialog>
  </section>
</template>
