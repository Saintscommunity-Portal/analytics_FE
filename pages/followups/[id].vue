<script setup>
definePageMeta({ middleware: 'auth', layout: 'admin' })

const route = useRoute()
const { request } = useAdminApi()

const loading = ref(true)
const errorMessage = ref('')
const followup = ref(null)
const reports = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 20 })

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value).replace(/_/g, ' ')
}

function displayDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function fetchDetails(page = 1) {
  loading.value = true
  errorMessage.value = ''
  try {
    const [followupResponse, reportsResponse] = await Promise.all([
      request(`/followups/${route.params.id}`, { method: 'GET' }),
      request(`/followups/${route.params.id}/reports`, { method: 'GET', query: { page, per_page: meta.value.per_page || 20 } }),
    ])
    followup.value = followupResponse?.data || null
    reports.value = reportsResponse?.data || []
    meta.value = { ...meta.value, ...(reportsResponse?.meta || {}) }
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load follow up.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchDetails)
</script>

<template>
  <section class="space-y-5">
    <div>
      <NuxtLink to="/followups" class="inline-flex items-center gap-2 text-sm font-medium text-[#a83632] no-underline">
        <i class="pi pi-arrow-left text-xs" />
        Back to follow ups
      </NuxtLink>
      <p class="m-0 mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Follow up reports</p>
      <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">{{ followup?.workerName || 'Follow up' }}</h1>
      <p class="m-0 mt-2 text-sm text-gray-500">{{ displayDate(followup?.timeFrom) }} / {{ followup?.reportCount || 0 }} report(s)</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <Card v-if="followup" class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="grid gap-4 md:grid-cols-4">
          <div><p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Worker</p><p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(followup.workerName) }}</p></div>
          <div><p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Church</p><p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(followup.churchName) }}</p></div>
          <div><p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Fellowship</p><p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(followup.fellowshipName) }}</p></div>
          <div><p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Cell</p><p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(followup.cellName) }}</p></div>
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <DataTable :value="reports" :loading="loading" paginator lazy :rows="meta.per_page || 20" :total-records="meta.total || 0" row-hover @page="fetchDetails($event.page + 1)">
          <Column field="targetName" header="Target" />
          <Column field="targetType" header="Type"><template #body="{ data }">{{ displayValue(data.targetType) }}</template></Column>
          <Column field="activityType" header="Activity"><template #body="{ data }">{{ displayValue(data.activityType) }}</template></Column>
          <Column field="timeSpent" header="Time"><template #body="{ data }">{{ data.timeSpent || 0 }} mins</template></Column>
          <Column field="targetPhone" header="Phone"><template #body="{ data }">{{ displayValue(data.targetPhone) }}</template></Column>
          <Column field="materialUsed" header="Material"><template #body="{ data }">{{ displayValue(data.materialUsed) }}</template></Column>
          <Column field="teachingNote" header="Teaching note"><template #body="{ data }">{{ displayValue(data.teachingNote) }}</template></Column>
          <Column field="responseOrQuestions" header="Response/questions"><template #body="{ data }">{{ displayValue(data.responseOrQuestions) }}</template></Column>
          <Column field="createdAt" header="Created"><template #body="{ data }">{{ displayDate(data.createdAt) }}</template></Column>
        </DataTable>
      </template>
    </Card>
  </section>
</template>
