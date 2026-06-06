<script setup>
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip)

definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const { request } = useAdminApi()
const authStore = useAuthStore()
const locationsStore = useLocationsStore()

const loading = ref(true)
const errorMessage = ref('')
const filtersOpen = ref(true)
const chartsOpen = ref(true)
const dashboard = ref(null)

const filters = reactive({
  date_from: '',
  date_to: '',
  church_id: null,
  fellowship_id: null,
  cell_id: null,
  country: '',
  state: '',
  area: '',
})

const entities = computed(() => authStore.entities || {})
const totals = computed(() => dashboard.value?.totals || {})
const memberAgeDistribution = computed(() => dashboard.value?.memberAgeDistribution || [])
const workerAgeDistribution = computed(() => dashboard.value?.workerAgeDistribution || [])
const workersByStatus = computed(() => dashboard.value?.workersByStatus || [])
const hasFilters = computed(() => Object.values(filters).some((value) => value !== '' && value !== null))

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

const churchDisabled = computed(() => !Array.isArray(entities.value.churches))
const fellowshipDisabled = computed(() => !Array.isArray(entities.value.fellowships) && fellowshipOptions.value.length === 0)
const cellDisabled = computed(() => !Array.isArray(entities.value.cells) && cellOptions.value.length === 0)
const countryOptions = computed(() => locationsStore.countryOptions)
const stateOptions = computed(() => locationsStore.stateOptions(filters.country))
const stateDisabled = computed(() => !filters.country || stateOptions.value.length === 0)
const areaOptions = computed(() => locationsStore.subdivisionOptions(filters.country, filters.state))
const areaDisabled = computed(() => !filters.country || !filters.state || areaOptions.value.length === 0)

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

const barOptions = {
  ...chartOptions,
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#4b5563',
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0,
        color: '#4b5563',
      },
      grid: {
        color: '#f3f4f6',
      },
    },
  },
}

const memberAgeChartData = computed(() => ({
  labels: memberAgeDistribution.value.map((item) => item.label),
  datasets: [
    {
      label: 'Members',
      data: memberAgeDistribution.value.map((item) => item.count),
      backgroundColor: '#a83632',
      borderRadius: 8,
    },
  ],
}))

const workerAgeChartData = computed(() => ({
  labels: workerAgeDistribution.value.map((item) => item.label),
  datasets: [
    {
      label: 'Workers',
      data: workerAgeDistribution.value.map((item) => item.count),
      backgroundColor: '#2563eb',
      borderRadius: 8,
    },
  ],
}))

const workerStatusChartData = computed(() => ({
  labels: workersByStatus.value.map((item) => item.label),
  datasets: [
    {
      data: workersByStatus.value.map((item) => item.count),
      backgroundColor: ['#a83632', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#6b7280'],
      borderColor: '#ffffff',
      borderWidth: 3,
    },
  ],
}))

const childAdultChartData = computed(() => ({
  labels: ['Children', 'Adult members'],
  datasets: [
    {
      data: [totals.value.children || 0, totals.value.adultMembers || 0],
      backgroundColor: ['#a83632', '#d1d5db'],
      borderColor: '#ffffff',
      borderWidth: 3,
    },
  ],
}))

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

function buildQuery() {
  const query = {}

  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== null) {
      query[key] = value
    }
  }

  return query
}

async function fetchDashboard() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await request('/people-dashboard', {
      method: 'GET',
      query: buildQuery(),
    })

    dashboard.value = response?.data || null
  } catch (error) {
    dashboard.value = null
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load dashboard statistics.'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  fetchDashboard()
}

function resetFilters() {
  for (const key of Object.keys(filters)) {
    filters[key] = key.endsWith('_id') ? null : ''
  }

  setDefaultRange()
  fetchDashboard()
}

watch(() => filters.church_id, () => {
  filters.fellowship_id = null
  filters.cell_id = null
})

watch(() => filters.fellowship_id, () => {
  filters.cell_id = null
})

watch(() => filters.country, () => {
  filters.state = ''
  filters.area = ''
})

watch(() => filters.state, () => {
  filters.area = ''
})

onMounted(() => {
  locationsStore.fetchCountries()
  setDefaultRange()
  fetchDashboard()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">
          Overview
        </p>
        <h1 class="m-0 text-3xl font-semibold tracking-tight text-gray-950">
          Dashboard
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Worker and member analytics scoped to your assigned access.
        </p>
      </div>
    </div>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 text-left"
          @click="filtersOpen = !filtersOpen"
        >
          <div>
            <h2 class="m-0 text-sm font-semibold text-gray-950">Dashboard filters</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">Filter totals and distributions by date period, hierarchy, and location.</p>
          </div>
          <i
            class="pi text-sm text-gray-500 transition-transform"
            :class="filtersOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
          />
        </button>

        <div v-if="filtersOpen" class="mt-5 space-y-5 border-t border-gray-100 pt-5">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InputText v-model="filters.date_from" type="date" class="h-11 w-full" />
            <InputText v-model="filters.date_to" type="date" class="h-11 w-full" />
            <Select
              v-model="filters.country"
              :options="countryOptions"
              option-label="label"
              option-value="value"
              placeholder="Country"
              show-clear
              filter
              class="w-full"
            />
            <Select
              v-model="filters.state"
              :options="stateOptions"
              option-label="label"
              option-value="value"
              placeholder="State"
              show-clear
              filter
              class="w-full"
              :disabled="stateDisabled"
            />
            <Select
              v-model="filters.area"
              :options="areaOptions"
              option-label="label"
              option-value="value"
              placeholder="Area"
              show-clear
              filter
              class="w-full"
              :disabled="areaDisabled"
            />
            <Select
              v-model="filters.church_id"
              :options="churchOptions"
              option-label="name"
              option-value="id"
              placeholder="Church"
              show-clear
              class="w-full"
              :disabled="churchDisabled"
            />
            <Select
              v-model="filters.fellowship_id"
              :options="fellowshipOptions"
              option-label="name"
              option-value="id"
              placeholder="Fellowship"
              show-clear
              class="w-full"
              :disabled="fellowshipDisabled"
            />
            <Select
              v-model="filters.cell_id"
              :options="cellOptions"
              option-label="name"
              option-value="id"
              placeholder="Cell"
              show-clear
              class="w-full"
              :disabled="cellDisabled"
            />
          </div>

          <div class="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button
              label="Reset"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              :disabled="loading || !hasFilters"
              @click="resetFilters"
            />
            <Button
              label="Apply filters"
              icon="pi pi-filter"
              class="!border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c] hover:!text-white"
              :loading="loading"
              @click="applyFilters"
            />
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

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm text-gray-500">Total workers</p>
          <Skeleton v-if="loading" class="mt-3" height="2rem" border-radius="8px" />
          <h2 v-else class="mb-0 mt-3 text-2xl font-semibold text-gray-950">{{ totals.workers || 0 }}</h2>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm text-gray-500">Total members</p>
          <Skeleton v-if="loading" class="mt-3" height="2rem" border-radius="8px" />
          <h2 v-else class="mb-0 mt-3 text-2xl font-semibold text-gray-950">{{ totals.members || 0 }}</h2>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm text-gray-500">Members added in period</p>
          <Skeleton v-if="loading" class="mt-3" height="2rem" border-radius="8px" />
          <h2 v-else class="mb-0 mt-3 text-2xl font-semibold text-gray-950">{{ totals.membersAddedInPeriod || 0 }}</h2>
        </template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <p class="m-0 text-sm text-gray-500">Children</p>
          <Skeleton v-if="loading" class="mt-3" height="2rem" border-radius="8px" />
          <h2 v-else class="mb-0 mt-3 text-2xl font-semibold text-gray-950">{{ totals.children || 0 }}</h2>
        </template>
      </Card>
    </div>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 text-left"
          @click="chartsOpen = !chartsOpen"
        >
          <div>
            <h2 class="m-0 text-sm font-semibold text-gray-950">People charts</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">Age distributions, worker statuses, and child/adult member split.</p>
          </div>
          <i
            class="pi text-sm text-gray-500 transition-transform"
            :class="chartsOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
          />
        </button>

        <div v-if="chartsOpen" class="mt-5 grid gap-4 border-t border-gray-100 pt-5 xl:grid-cols-2">
          <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 class="m-0 text-sm font-semibold text-gray-950">Member age distribution</h3>
            <div class="mt-4 h-72">
              <Skeleton v-if="loading" height="100%" border-radius="16px" />
              <Bar v-else :data="memberAgeChartData" :options="barOptions" />
            </div>
          </div>

          <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 class="m-0 text-sm font-semibold text-gray-950">Worker age distribution</h3>
            <div class="mt-4 h-72">
              <Skeleton v-if="loading" height="100%" border-radius="16px" />
              <Bar v-else :data="workerAgeChartData" :options="barOptions" />
            </div>
          </div>

          <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 class="m-0 text-sm font-semibold text-gray-950">Workers by status</h3>
            <div class="mt-4 h-72">
              <Skeleton v-if="loading" height="100%" border-radius="16px" />
              <Doughnut v-else :data="workerStatusChartData" :options="chartOptions" />
            </div>
          </div>

          <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 class="m-0 text-sm font-semibold text-gray-950">Children vs adult members</h3>
            <div class="mt-4 h-72">
              <Skeleton v-if="loading" height="100%" border-radius="16px" />
              <Doughnut v-else :data="childAdultChartData" :options="chartOptions" />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </section>
</template>
