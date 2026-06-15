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
const filters = reactive({
  from_date: '',
  to_date: '',
  church_id: '',
  fellowship_id: '',
  cell_id: '',
  worker_id: '',
})

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

function viewOutreach(outreach) {
  navigateTo(`/outreaches/${outreach.id}`)
}

onMounted(async () => {
  await Promise.all([fetchOutreaches(), fetchWorkerOptions()])
})
</script>

<template>
  <section class="space-y-5">
    <div>
      <p class="m-0 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Outreach</p>
      <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">Outreach analytics</h1>
      <p class="m-0 mt-2 text-sm text-gray-500">Review worker outreach activities and reports within your scope.</p>
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
  </section>
</template>
