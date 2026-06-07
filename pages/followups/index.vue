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
const followups = ref([])
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
  activity_type: '',
})

const activityOptions = ['teaching', 'prayer', 'followup', 'outreach', 'holyghost_meeting'].map((value) => ({ label: displayValue(value), value }))
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
  plugins: { legend: { position: 'bottom' } },
}
const activityChartData = computed(() => ({
  labels: ['Teaching', 'Prayer', 'Follow up', 'Outreach', 'Holyghost meeting'],
  datasets: [{
    data: [
      Number(totals.value.teaching_count || 0),
      Number(totals.value.prayer_count || 0),
      Number(totals.value.followup_count || 0),
      Number(totals.value.outreach_count || 0),
      Number(totals.value.holyghost_meeting_count || 0),
    ],
    backgroundColor: ['#a83632', '#2563eb', '#15803d', '#9333ea', '#f59e0b'],
  }],
}))
const targetChartData = computed(() => ({
  labels: ['Members', 'Outreach reports', 'Non members'],
  datasets: [{
    data: [
      Number(totals.value.member_followups_count || 0),
      Number(totals.value.outreach_followups_count || 0),
      Number(totals.value.non_members_followed_up_count || 0),
    ],
    backgroundColor: ['#a83632', '#2563eb', '#9ca3af'],
  }],
}))
const workerChartData = computed(() => ({
  labels: ['Workers engaged', 'Workers without activity'],
  datasets: [{
    label: 'Workers',
    data: [
      Number(totals.value.workers_engaged_count || 0),
      Number(totals.value.workers_not_engaged_count || 0),
    ],
    backgroundColor: ['#15803d', '#d1d5db'],
  }],
}))
const dailyChartData = computed(() => ({
  labels: (dashboard.value?.daily || []).map((row) => displayDate(row.date)),
  datasets: [{
    label: 'Follow up reports',
    data: (dashboard.value?.daily || []).map((row) => Number(row.total_reports_sent || row.total_followup_activities || 0)),
    borderColor: '#a83632',
    backgroundColor: '#a83632',
  }],
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

async function fetchFollowups(page = 1) {
  loading.value = true
  errorMessage.value = ''
  try {
    const [list, stats] = await Promise.all([
      request('/followups', { method: 'GET', query: query(page) }),
      request('/followup-dashboard', { method: 'GET', query: query(page) }),
    ])
    followups.value = list?.data || []
    meta.value = { ...meta.value, ...(list?.meta || {}) }
    dashboard.value = stats?.data || null
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load follow ups.'
  } finally {
    loading.value = false
  }
}

async function fetchWorkerOptions() {
  workersLoading.value = true
  try {
    const response = await request('/workers', {
      method: 'GET',
      query: { per_page: 500, sort_by: 'first_name', direction: 'asc' },
    })
    workerOptions.value = (response?.data || []).map((worker) => ({
      label: [worker.firstName, worker.lastName].filter(Boolean).join(' ') || `Worker ${worker.id}`,
      value: worker.id,
    }))
  } finally {
    workersLoading.value = false
  }
}

function viewFollowup(followup) {
  navigateTo(`/followups/${followup.id}`)
}

onMounted(async () => {
  await Promise.all([fetchFollowups(), fetchWorkerOptions()])
})
</script>

<template>
  <section class="space-y-5">
    <div>
      <p class="m-0 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Follow ups</p>
      <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">Follow up analytics</h1>
      <p class="m-0 mt-2 text-sm text-gray-500">Track follow up activities, worker engagement, and ministry responses within your scope.</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <div class="grid gap-4 md:grid-cols-4">
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Activities</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.total_followup_activities || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Reports</p><h2 class="m-0 mt-2 text-2xl font-semibold text-[#a83632]">{{ totals.total_reports_sent || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Workers engaged</p><h2 class="m-0 mt-2 text-2xl font-semibold text-green-700">{{ totals.workers_engaged_count || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Avg. time</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.average_time_spent || 0 }} mins</h2></template></Card>
    </div>

    <div class="grid gap-4 xl:grid-cols-4">
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Activity split</p>
          <div class="mt-4 h-64"><Doughnut :data="activityChartData" :options="chartOptions" /></div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Targets</p>
          <div class="mt-4 h-64"><Doughnut :data="targetChartData" :options="chartOptions" /></div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Worker coverage</p>
          <div class="mt-4 h-64"><Bar :data="workerChartData" :options="chartOptions" /></div>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm font-semibold text-gray-950">Reports by day</p>
          <div class="mt-4 h-64"><Line :data="dailyChartData" :options="chartOptions" /></div>
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
          <Select v-model="filters.activity_type" :options="activityOptions" option-label="label" option-value="value" placeholder="Activity" show-clear />
          <Button label="Apply" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="fetchFollowups()" />
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <DataTable :value="followups" :loading="loading" paginator lazy :rows="meta.per_page || 20" :total-records="meta.total || 0" row-hover @page="fetchFollowups($event.page + 1)">
          <Column field="timeFrom" header="Started"><template #body="{ data }">{{ displayDate(data.timeFrom) }}</template></Column>
          <Column field="timeTo" header="Ended"><template #body="{ data }">{{ displayDate(data.timeTo) }}</template></Column>
          <Column field="workerName" header="Worker" />
          <Column field="churchName" header="Church" />
          <Column field="fellowshipName" header="Fellowship"><template #body="{ data }">{{ displayValue(data.fellowshipName) }}</template></Column>
          <Column field="cellName" header="Cell"><template #body="{ data }">{{ displayValue(data.cellName) }}</template></Column>
          <Column field="reportCount" header="Reports" />
          <Column field="totalTimeSpent" header="Time"><template #body="{ data }">{{ data.totalTimeSpent || 0 }} mins</template></Column>
          <Column header="Action">
            <template #body="{ data }">
              <Button label="View" size="small" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="viewFollowup(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </section>
</template>
