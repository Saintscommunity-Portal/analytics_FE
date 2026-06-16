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
import TableDownloadDialog from '~/components/TableDownloadDialog.vue'
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
const deleting = ref(false)
const errorMessage = ref('')
const deleteError = ref('')
const deleteDialogOpen = ref(false)
const memberToDelete = ref(null)
const downloadDialogOpen = ref(false)
const filtersOpen = ref(true)
const analyticsOpen = ref(true)
const dashboardLoading = ref(false)
const dashboard = ref(null)
const members = ref([])
const meta = ref({
  current_page: 1,
  from: 0,
  last_page: 1,
  per_page: 10,
  to: 0,
  total: 0,
})

const filters = reactive({
  search: '',
  slug: '',
  gender: '',
  date_of_birth_from: '',
  date_of_birth_to: '',
  state: '',
  country: '',
  area: '',
  church_id: null,
  fellowship_id: null,
  cell_id: null,
  prayer_group_id: null,
})

const first = ref(0)
const rows = ref(10)
const sortField = ref('created_at')
const sortOrder = ref(-1)

const baseColumns = [
  { field: 'fullName', header: 'Full name', sortable: true },
  { field: 'slug', header: 'Slug', sortable: true },
  { field: 'workerName', header: 'Worker' },
  { field: 'prayerGroupId', header: 'Prayer group', sortable: true },
  { field: 'gender', header: 'Gender', sortable: true },
  { field: 'dateOfBirth', header: 'Date of birth', sortable: true },
  { field: 'isChild', header: 'Child' },
  { field: 'phone1', header: 'Phone 1', sortable: true },
  { field: 'phone2', header: 'Phone 2', sortable: true },
  { field: 'email', header: 'Email', sortable: true },
  { field: 'country', header: 'Country', sortable: true },
  { field: 'state', header: 'State', sortable: true },
  { field: 'area', header: 'Area', sortable: true },
  { field: 'churchName', header: 'Church' },
  { field: 'fellowshipName', header: 'Fellowship' },
  { field: 'cellName', header: 'Cell' },
  { field: 'homeAddress', header: 'Home address' },
  { field: 'workAddress', header: 'Work address' },
  { field: 'schoolAddress', header: 'School address' },
  { field: 'dateAdded', header: 'Date added', sortable: true },
  { field: 'notes', header: 'Notes' },
  { field: 'nameUpdatedAt', header: 'Name updated', sortable: true },
  { field: 'createdAt', header: 'Created', sortable: true },
  { field: 'updatedAt', header: 'Updated', sortable: true },
]

const sortFieldMap = {
  fullName: 'full_name',
  slug: 'slug',
  gender: 'gender',
  dateOfBirth: 'date_of_birth',
  phone1: 'phone_1',
  phone2: 'phone_2',
  email: 'email',
  country: 'country',
  state: 'state',
  area: 'area',
  churchName: 'church_id',
  fellowshipName: 'fellowship_id',
  cellName: 'cell_id',
  prayerGroupId: 'prayer_group_id',
  dateAdded: 'date_added',
  nameUpdatedAt: 'updated_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

const columnOptions = ref([...baseColumns])
const selectedColumns = ref(baseColumns.slice(0, 6))

const tableRows = computed(() => {
  if (loading.value) {
    return Array.from({ length: rows.value }, (_, index) => ({
      id: `loading-${index}`,
      __loading: true,
    }))
  }

  return members.value
})

const totalRecords = computed(() => meta.value?.total || 0)
const hasFilters = computed(() => Object.values(filters).some((value) => value !== '' && value !== null))
const entities = computed(() => authStore.entities || {})
const dashboardTotals = computed(() => dashboard.value?.totals || {})
const memberAgeDistribution = computed(() => dashboard.value?.memberAgeDistribution || [])
const downloadQuery = computed(() => {
  const query = buildQuery(1)
  delete query.page
  delete query.per_page
  return query
})

const churchOptions = computed(() => {
  return Array.isArray(entities.value.churches) ? entities.value.churches : []
})

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
const memberStatCards = computed(() => [
  { label: 'Members', value: dashboardTotals.value.members || totalRecords.value || 0, detail: 'Within current scope' },
  { label: 'Added records', value: dashboardTotals.value.membersAddedInPeriod || 0, detail: 'Current dashboard scope' },
  { label: 'Children', value: dashboardTotals.value.children || 0, detail: 'Marked as child' },
  { label: 'Adults', value: dashboardTotals.value.adultMembers || 0, detail: 'Member records' },
])
const memberAgeChartData = computed(() => ({
  labels: memberAgeDistribution.value.map((item) => item.label),
  datasets: [{
    label: 'Members',
    data: memberAgeDistribution.value.map((item) => item.count),
    backgroundColor: memberAgeDistribution.value.map((_, index) => chartPalette[index % chartPalette.length]),
    borderRadius: 8,
  }],
}))
const childAdultChartData = computed(() => ({
  labels: ['Children', 'Adults'],
  datasets: [{
    data: [
      dashboardTotals.value.children || 0,
      dashboardTotals.value.adultMembers || 0,
    ],
    backgroundColor: ['#a83632', '#2563eb'],
  }],
}))

function labelFromKey(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeColumns(items) {
  const seen = new Set(baseColumns.map((column) => column.field))
  const responseColumns = []
  const hiddenFields = new Set([
    'id',
    'workerId',
    'worker_id',
    'churchId',
    'fellowshipId',
    'cellId',
    'church_id',
    'fellowship_id',
    'cell_id',
  ])

  for (const item of items) {
    for (const key of Object.keys(item || {})) {
      if (!seen.has(key) && !hiddenFields.has(key)) {
        seen.add(key)
        responseColumns.push({
          field: key,
          header: labelFromKey(key),
        })
      }
    }
  }

  columnOptions.value = [...baseColumns, ...responseColumns]
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return value
}

function querySortField() {
  return sortFieldMap[sortField.value] || sortField.value || 'created_at'
}

function buildQuery(page) {
  const query = {
    page,
    per_page: rows.value,
    sort_by: querySortField(),
    direction: sortOrder.value === 1 ? 'asc' : 'desc',
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== null) {
      query[key] = value
    }
  }

  return query
}

async function fetchMembers(page = 1) {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await request('/members', {
      method: 'GET',
      query: buildQuery(page),
    })

    members.value = Array.isArray(response?.data) ? response.data : []
    meta.value = {
      ...meta.value,
      ...(response?.meta || {}),
    }
    rows.value = Number(meta.value.per_page || rows.value)
    first.value = ((Number(meta.value.current_page) || page) - 1) * rows.value
    normalizeColumns(members.value)
  } catch (error) {
    members.value = []
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load members.'
  } finally {
    loading.value = false
  }
}

async function fetchDashboard() {
  dashboardLoading.value = true

  try {
    const query = {}
    for (const key of ['church_id', 'fellowship_id', 'cell_id', 'country', 'state', 'area']) {
      if (filters[key]) query[key] = filters[key]
    }

    const response = await request('/people-dashboard', {
      method: 'GET',
      query,
    })
    dashboard.value = response?.data || null
  } catch {
    dashboard.value = null
  } finally {
    dashboardLoading.value = false
  }
}

function openDeleteDialog(member) {
  memberToDelete.value = member
  deleteError.value = ''
  deleteDialogOpen.value = true
}

function closeDeleteDialog() {
  if (deleting.value) {
    return
  }

  deleteDialogOpen.value = false
  memberToDelete.value = null
  deleteError.value = ''
}

async function deleteMember() {
  if (!memberToDelete.value?.id) {
    return
  }

  deleting.value = true
  deleteError.value = ''

  try {
    await request(`/members/${memberToDelete.value.id}`, {
      method: 'DELETE',
    })

    deleteDialogOpen.value = false
    memberToDelete.value = null

    const currentPage = Math.max(1, Math.floor(first.value / rows.value) + 1)
    await fetchMembers(currentPage)
  } catch (error) {
    deleteError.value = error?.data?.message || error?.message || 'Unable to delete member.'
  } finally {
    deleting.value = false
  }
}

function onPage(event) {
  rows.value = event.rows
  first.value = event.first
  fetchMembers(event.page + 1)
}

function onSort(event) {
  sortField.value = event.sortField || 'created_at'
  sortOrder.value = event.sortOrder || -1
  first.value = 0
  fetchMembers(1)
}

function applyFilters() {
  first.value = 0
  fetchMembers(1)
  fetchDashboard()
}

function clearFilters() {
  for (const key of Object.keys(filters)) {
    filters[key] = key.endsWith('_id') ? null : ''
  }

  applyFilters()
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
  fetchMembers()
  fetchDashboard()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">
          Directory
        </p>
        <h1 class="m-0 text-3xl font-semibold tracking-tight text-gray-950">
          My Members
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          View scoped members based on your assigned church, fellowship, or cell access.
        </p>
      </div>

      <div class="flex flex-col gap-3 sm:items-end">
        <div class="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span class="font-semibold text-gray-950">{{ totalRecords }}</span>
          <span class="ml-1 text-gray-500">members found</span>
        </div>
        <Button
          label="Download"
          icon="pi pi-cloud-download"
          class="!border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c] hover:!text-white"
          @click="downloadDialogOpen = true"
        />
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
            <h2 class="m-0 text-sm font-semibold text-gray-950">Member filters</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">Refine the member list by search, date of birth, location, and assigned hierarchy.</p>
          </div>
          <i
            class="pi text-sm text-gray-500 transition-transform"
            :class="filtersOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
          />
        </button>

        <div v-if="filtersOpen" class="mt-5 space-y-5 border-t border-gray-100 pt-5">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <span class="p-input-icon-left">
              <i class="pi pi-user" />
              <InputText
                v-model="filters.search"
                class="w-full"
                placeholder="Name, phone, or email"
                @keyup.enter="applyFilters"
              />
            </span>
            <InputText
              v-model="filters.slug"
              class="w-full"
              placeholder="Slug"
              @keyup.enter="applyFilters"
            />
            <Select
              v-model="filters.gender"
              :options="['male', 'female']"
              placeholder="Gender"
              show-clear
              class="member-filter-select w-full"
            />
            <InputText
              v-model="filters.date_of_birth_from"
              type="date"
              class="h-11 w-full"
              placeholder="Date of birth from"
              @keyup.enter="applyFilters"
            />
            <InputText
              v-model="filters.date_of_birth_to"
              type="date"
              class="h-11 w-full"
              placeholder="Date of birth to"
              @keyup.enter="applyFilters"
            />
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
            <InputText
              v-model="filters.prayer_group_id"
              class="w-full"
              placeholder="Prayer group ID"
              @keyup.enter="applyFilters"
            />
          </div>

          <div class="flex flex-col gap-3 border-t border-gray-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <MultiSelect
              v-model="selectedColumns"
              :options="columnOptions"
              option-label="header"
              display="chip"
              placeholder="Choose table columns"
              class="w-full lg:max-w-xl"
            />

            <div class="flex flex-col gap-2 sm:flex-row">
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
          </div>
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 text-left"
          @click="analyticsOpen = !analyticsOpen"
        >
          <div>
            <h2 class="m-0 text-sm font-semibold text-gray-950">Member analytics</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">Summary stats, age distribution, and children/adult mix for the filtered member scope.</p>
          </div>
          <i
            class="pi text-sm text-gray-500 transition-transform"
            :class="analyticsOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
          />
        </button>

        <div v-if="analyticsOpen" class="mt-5 space-y-4 border-t border-gray-100 pt-5">
          <div class="grid gap-4 md:grid-cols-4">
            <Card v-for="card in memberStatCards" :key="card.label" class="border border-gray-200 bg-white shadow-sm">
              <template #content>
                <Skeleton v-if="dashboardLoading" height="4.5rem" border-radius="12px" />
                <div v-else>
                  <p class="m-0 text-sm text-gray-500">{{ card.label }}</p>
                  <h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ card.value }}</h2>
                  <p class="m-0 mt-1 text-xs text-gray-500">{{ card.detail }}</p>
                </div>
              </template>
            </Card>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <Card class="border border-gray-200 bg-white shadow-sm">
              <template #content>
                <p class="m-0 text-sm font-semibold text-gray-950">Member age distribution</p>
                <div class="mt-4 h-72">
                  <Skeleton v-if="dashboardLoading" height="100%" border-radius="12px" />
                  <Bar v-else :data="memberAgeChartData" :options="barOptions" />
                </div>
              </template>
            </Card>
            <Card class="border border-gray-200 bg-white shadow-sm">
              <template #content>
                <p class="m-0 text-sm font-semibold text-gray-950">Children and adults</p>
                <div class="mt-4 h-72">
                  <Skeleton v-if="dashboardLoading" height="100%" border-radius="12px" />
                  <Doughnut v-else :data="childAdultChartData" :options="chartOptions" />
                </div>
              </template>
            </Card>
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
          removable-sort
          :first="first"
          :rows="rows"
          :sort-field="sortField"
          :sort-order="sortOrder"
          :total-records="totalRecords"
          :rows-per-page-options="[5, 10, 25, 50]"
          data-key="id"
          striped-rows
          scrollable
          scroll-height="560px"
          table-style="min-width: 980px"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
          current-page-report-template="{first} to {last} of {totalRecords}"
          class="members-table text-sm"
          @page="onPage"
          @sort="onSort"
        >
          <template #empty>
            <div class="py-12 text-center">
              <span class="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gray-100 text-gray-500">
                <i class="pi pi-search text-lg" />
              </span>
              <h2 class="mb-1 mt-4 text-base font-semibold text-gray-950">
                No members found
              </h2>
              <p class="m-0 text-sm text-gray-500">
                Adjust the filters and try again.
              </p>
            </div>
          </template>

          <Column
            v-for="column in selectedColumns"
            :key="column.field"
            :field="column.field"
            :header="column.header"
            :sortable="column.sortable"
            style="min-width: 150px"
          >
            <template #body="{ data }">
              <Skeleton
                v-if="data.__loading"
                height="1.25rem"
                border-radius="8px"
              />
              <span
                v-else
                class="block max-w-64 truncate"
                :title="displayValue(data[column.field])"
              >
                {{ displayValue(data[column.field]) }}
              </span>
            </template>
          </Column>
          <Column
            header="Actions"
            frozen
            align-frozen="right"
            style="min-width: 120px"
          >
            <template #body="{ data }">
              <Skeleton
                v-if="data.__loading"
                height="2rem"
                border-radius="8px"
              />
              <Button
                v-else
                icon="pi pi-trash"
                label="Delete"
                severity="danger"
                outlined
                size="small"
                class="!px-3 !py-2"
                @click="openDeleteDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog
      v-model:visible="deleteDialogOpen"
      modal
      header="Delete member"
      :style="{ width: 'min(92vw, 420px)' }"
      :closable="!deleting"
    >
      <div class="space-y-4">
        <p class="m-0 text-sm leading-6 text-gray-600">
          This will soft delete
          <span class="font-semibold text-gray-950">{{ memberToDelete?.fullName || 'this member' }}</span>.
          The record will be hidden from active member lists but retained in the database.
        </p>

        <Message
          v-if="deleteError"
          severity="error"
          :closable="false"
        >
          {{ deleteError }}
        </Message>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            severity="secondary"
            outlined
            :disabled="deleting"
            @click="closeDeleteDialog"
          />
          <Button
            label="Delete"
            icon="pi pi-trash"
            severity="danger"
            :loading="deleting"
            @click="deleteMember"
          />
        </div>
      </template>
    </Dialog>

    <TableDownloadDialog
      v-model:visible="downloadDialogOpen"
      table-name="members"
      default-title="Members export"
      :query="downloadQuery"
    />
  </section>
</template>

<style scoped>
:deep(.members-table .p-datatable-header-cell) {
  background: #f9fafb;
  color: #111827;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

:deep(.members-table .p-datatable-tbody > tr:hover > td) {
  background: #f9fafb;
  color: #111827;
}

:deep(.members-table .p-datatable-tbody > tr > td) {
  color: #111827;
}

:deep(.members-table .p-datatable-tbody > tr > td span) {
  color: #111827;
}

:deep(.members-table .p-datatable-tbody > tr:hover > td span) {
  color: #111827;
}

:deep(.members-table .p-paginator-page.p-paginator-page-selected) {
  background: #a83632;
  border-color: #a83632;
  color: #ffffff;
}

:global(.dark) :deep(.members-table .p-datatable-tbody > tr > td),
:global(.dark) :deep(.members-table .p-datatable-tbody > tr > td span),
:global(.dark) :deep(.members-table .p-datatable-tbody > tr > td p),
:global(.dark) :deep(.members-table .p-datatable-tbody > tr > td div),
:global(.dark) :deep(.members-table .p-datatable-tbody > tr > td strong) {
  color: #f9fafb !important;
}

:global(.dark) :deep(.members-table .p-datatable-tbody > tr:hover > td),
:global(.dark) :deep(.members-table .p-datatable-tbody > tr:hover > td span),
:global(.dark) :deep(.members-table .p-datatable-tbody > tr:hover > td p),
:global(.dark) :deep(.members-table .p-datatable-tbody > tr:hover > td div),
:global(.dark) :deep(.members-table .p-datatable-tbody > tr:hover > td strong) {
  background: #111827;
  color: #f9fafb !important;
}

:deep(.member-filter-control) {
  min-height: 2.75rem;
}

:deep(.member-filter-control .p-select-label),
:deep(.member-filter-control .p-inputnumber-input) {
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
}

:deep(.member-filter-select.p-select) {
  height: 2.75rem;
  min-height: 2.75rem;
  align-items: center;
}

:deep(.member-filter-select .p-select-label) {
  display: flex;
  align-items: center;
  height: 2.75rem;
  padding-top: 0;
  padding-bottom: 0;
}

:deep(.member-filter-select .p-select-dropdown) {
  width: 2.75rem;
}
</style>
