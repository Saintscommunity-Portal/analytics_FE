<script setup>
import TableDownloadDialog from '~/components/TableDownloadDialog.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const { request } = useAdminApi()
const authStore = useAuthStore()
const locationsStore = useLocationsStore()

const loading = ref(true)
const errorMessage = ref('')
const downloadDialogOpen = ref(false)
const filtersOpen = ref(true)
const workers = ref([])
const meta = ref({
  current_page: 1,
  from: 0,
  last_page: 1,
  per_page: 10,
  to: 0,
  total: 0,
})

const filters = reactive({
  first_name: '',
  last_name: '',
  phone_number: '',
  gender: '',
  email: '',
  department: '',
  date_of_birth_from: '',
  date_of_birth_to: '',
  state: '',
  country: '',
  area: '',
  church_id: null,
  fellowship_id: null,
  cell_id: null,
})

const first = ref(0)
const rows = ref(10)

const baseColumns = [
  { field: 'firstName', header: 'First name' },
  { field: 'lastName', header: 'Last name' },
  { field: 'phoneNumber', header: 'Phone number' },
  { field: 'gender', header: 'Gender' },
  { field: 'email', header: 'Email' },
  { field: 'churchName', header: 'Church' },
  { field: 'fellowshipName', header: 'Fellowship' },
  { field: 'cellId', header: 'Cell' },
  { field: 'departmentId', header: 'Department' },
  { field: 'prayerGroupId', header: 'Prayer group' },
  { field: 'dateOfBirth', header: 'Date of birth' },
  { field: 'country', header: 'Country' },
  { field: 'state', header: 'State' },
  { field: 'area', header: 'Area' },
  { field: 'memberSince', header: 'Member since' },
  { field: 'workerSince', header: 'Worker since' },
  { field: 'status', header: 'Status' },
  { field: 'approved', header: 'Approved' },
  { field: 'active', header: 'Active' },
  { field: 'houseAddress', header: 'House address' },
  { field: 'workAddress', header: 'Work address' },
  { field: 'facebookUsername', header: 'Facebook' },
  { field: 'twitterUsername', header: 'Twitter' },
  { field: 'instagramUsername', header: 'Instagram' },
  { field: 'createdAtt', header: 'Created' },
  { field: 'updatedAt', header: 'Updated' },
]

const columnOptions = ref([...baseColumns])
const selectedColumns = ref(baseColumns.slice(0, 6))

const tableRows = computed(() => {
  if (loading.value) {
    return Array.from({ length: rows.value }, (_, index) => ({
      id: `loading-${index}`,
      __loading: true,
    }))
  }

  return workers.value
})

const totalRecords = computed(() => meta.value?.total || 0)
const hasFilters = computed(() => Object.values(filters).some((value) => value))
const entities = computed(() => authStore.entities || {})
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

  const churches = churchOptions.value
  const selectedChurch = churches.find((church) => church.id === filters.church_id)
  const source = selectedChurch ? [selectedChurch] : churches

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

function labelFromKey(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeColumns(items) {
  const seen = new Set(baseColumns.map((column) => column.field))
  const responseColumns = []

  for (const item of items) {
    for (const key of Object.keys(item || {})) {
      if (!seen.has(key) && key !== 'profileImage') {
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

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return value
}

function badgeSeverity(value) {
  const normalized = String(value).toLowerCase()

  if (value === true || normalized === 'active' || normalized === 'approved' || normalized === 'yes') {
    return 'success'
  }

  if (value === false || normalized === 'inactive' || normalized === 'disabled' || normalized === 'no') {
    return 'danger'
  }

  return 'secondary'
}

function buildQuery(page) {
  const query = {
    page,
    per_page: rows.value,
    sort_by: 'first_name',
    direction: 'asc',
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      query[key] = value
    }
  }

  const nameSearch = [filters.first_name, filters.last_name].filter(Boolean).join(' ')

  if (nameSearch) {
    query.search = nameSearch
  }

  return query
}

async function fetchWorkers(page = 1) {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await request('/workers', {
      method: 'GET',
      query: buildQuery(page),
    })

    workers.value = Array.isArray(response?.data) ? response.data : []
    meta.value = {
      ...meta.value,
      ...(response?.meta || {}),
    }
    rows.value = Number(meta.value.per_page || rows.value)
    first.value = ((Number(meta.value.current_page) || page) - 1) * rows.value
    normalizeColumns(workers.value)
  } catch (error) {
    workers.value = []
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load workers.'
  } finally {
    loading.value = false
  }
}

function onPage(event) {
  rows.value = event.rows
  first.value = event.first
  fetchWorkers(event.page + 1)
}

function applyFilters() {
  first.value = 0
  fetchWorkers(1)
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
  fetchWorkers()
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
          Workers
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          View and filter the worker directory from the admin API.
        </p>
      </div>

      <div class="flex flex-col gap-3 sm:items-end">
        <div class="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span class="font-semibold text-gray-950">{{ totalRecords }}</span>
          <span class="ml-1 text-gray-500">workers found</span>
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
            <h2 class="m-0 text-sm font-semibold text-gray-950">Worker filters</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">Refine the worker list by identity, location, and assigned hierarchy.</p>
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
                v-model="filters.first_name"
                class="w-full"
                placeholder="First name"
                @keyup.enter="applyFilters"
              />
            </span>
            <span class="p-input-icon-left">
              <i class="pi pi-user" />
              <InputText
                v-model="filters.last_name"
                class="w-full"
                placeholder="Last name"
                @keyup.enter="applyFilters"
              />
            </span>
            <span class="p-input-icon-left">
              <i class="pi pi-phone" />
              <InputText
                v-model="filters.phone_number"
                class="w-full"
                placeholder="Phone number"
                @keyup.enter="applyFilters"
              />
            </span>
            <span class="p-input-icon-left">
              <i class="pi pi-envelope" />
              <InputText
                v-model="filters.email"
                class="w-full"
                placeholder="Email"
                @keyup.enter="applyFilters"
              />
            </span>
            <InputText
              v-model="filters.gender"
              class="w-full"
              placeholder="Gender"
              @keyup.enter="applyFilters"
            />
            <InputText
              v-model="filters.department"
              class="w-full"
              placeholder="Department"
              @keyup.enter="applyFilters"
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
          class="workers-table text-sm"
          @page="onPage"
        >
          <template #empty>
            <div class="py-12 text-center">
              <span class="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gray-100 text-gray-500">
                <i class="pi pi-search text-lg" />
              </span>
              <h2 class="mb-1 mt-4 text-base font-semibold text-gray-950">
                No workers found
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
            style="min-width: 150px"
          >
            <template #body="{ data }">
              <Skeleton
                v-if="data.__loading"
                height="1.25rem"
                border-radius="8px"
              />
              <Tag
                v-else-if="['status', 'approved', 'active'].includes(column.field)"
                :value="displayValue(data[column.field])"
                :severity="badgeSeverity(data[column.field])"
                rounded
              />
              <span
                v-else
                class="block max-w-64 truncate text-gray-700"
                :title="displayValue(data[column.field])"
              >
                {{ displayValue(data[column.field]) }}
              </span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <TableDownloadDialog
      v-model:visible="downloadDialogOpen"
      table-name="workers"
      default-title="Workers export"
      :query="downloadQuery"
    />
  </section>
</template>

<style scoped>
:deep(.workers-table .p-datatable-header-cell) {
  background: #f9fafb;
  color: #111827;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

:deep(.workers-table .p-datatable-tbody > tr:hover > td) {
  background: #f9fafb;
  color: #111827;
}

:deep(.workers-table .p-datatable-tbody > tr > td) {
  color: #ffffff;
}

:deep(.workers-table .p-datatable-tbody > tr > td span:not(.p-tag-label)) {
  color: #ffffff;
}

:deep(.workers-table .p-datatable-tbody > tr:hover > td span:not(.p-tag-label)) {
  color: #111827;
}

:deep(.workers-table .p-paginator-page.p-paginator-page-selected) {
  background: #a83632;
  border-color: #a83632;
  color: #ffffff;
}
</style>
