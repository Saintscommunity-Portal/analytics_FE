<script setup>
definePageMeta({ middleware: 'auth', layout: 'admin' })

const route = useRoute()
const { request } = useAdminApi()

const loading = ref(true)
const errorMessage = ref('')
const outreach = ref(null)
const reports = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 20 })

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value).replace(/_/g, ' ')
}

function displayDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

async function fetchDetails(page = 1) {
  loading.value = true
  errorMessage.value = ''
  try {
    const [outreachResponse, reportsResponse] = await Promise.all([
      request(`/outreaches/${route.params.id}`, { method: 'GET' }),
      request(`/outreaches/${route.params.id}/reports`, { method: 'GET', query: { page, per_page: meta.value.per_page || 20 } }),
    ])
    outreach.value = outreachResponse?.data || null
    reports.value = reportsResponse?.data || []
    meta.value = { ...meta.value, ...(reportsResponse?.meta || {}) }
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load outreach.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchDetails)
</script>

<template>
  <section class="space-y-5">
    <div>
      <NuxtLink to="/outreaches" class="inline-flex items-center gap-2 text-sm font-medium text-[#a83632] no-underline">
        <i class="pi pi-arrow-left text-xs" />
        Back to outreaches
      </NuxtLink>
      <p class="m-0 mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Outreach reports</p>
      <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">{{ outreach?.locationCovered || 'Outreach' }}</h1>
      <p class="m-0 mt-2 text-sm text-gray-500">{{ displayDate(outreach?.date) }} / {{ displayValue(outreach?.timeStarted) }}</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <Card v-if="outreach" class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="grid gap-4 md:grid-cols-4">
          <div><p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Worker</p><p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(outreach.workerName) }}</p></div>
          <div><p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Church</p><p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(outreach.churchName) }}</p></div>
          <div><p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Fellowship</p><p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(outreach.fellowshipName) }}</p></div>
          <div><p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Cell</p><p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(outreach.cellName) }}</p></div>
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <DataTable :value="reports" :loading="loading" paginator lazy :rows="meta.per_page || 20" :total-records="meta.total || 0" row-hover @page="fetchDetails($event.page + 1)">
          <Column field="name" header="Name" />
          <Column field="age" header="Age"><template #body="{ data }">{{ displayValue(data.age) }}</template></Column>
          <Column field="homeAddress" header="Home address" />
          <Column field="workAddress" header="Work"><template #body="{ data }">{{ displayValue(data.workAddress) }}</template></Column>
          <Column field="school" header="School"><template #body="{ data }">{{ displayValue(data.school) }}</template></Column>
          <Column field="phoneNumber" header="Phone"><template #body="{ data }">{{ displayValue(data.phoneNumber) }}</template></Column>
          <Column field="saved" header="Saved"><template #body="{ data }">{{ data.saved ? 'Yes' : 'No' }}</template></Column>
          <Column field="filled" header="Filled"><template #body="{ data }">{{ data.filled ? 'Yes' : 'No' }}</template></Column>
          <Column field="healed" header="Healed"><template #body="{ data }">{{ data.healed ? 'Yes' : 'No' }}</template></Column>
          <Column field="followupCount" header="Follow ups" />
          <Column field="reportedFor" header="Reported for"><template #body="{ data }">{{ displayValue(data.reportedFor) }}</template></Column>
          <Column field="notes" header="Notes"><template #body="{ data }">{{ displayValue(data.notes) }}</template></Column>
          <Column field="createdAt" header="Created"><template #body="{ data }">{{ displayDate(data.createdAt) }}</template></Column>
        </DataTable>
      </template>
    </Card>
  </section>
</template>
