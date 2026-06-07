<script setup>
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

const filters = reactive({ type: '', status: '', church_id: '', fellowship_id: '', cell_id: '', date_from: '', date_to: '' })
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
const reportCountsTotal = computed(() => (
  Number(totals.value.ushers_count || 0)
  + Number(totals.value.first_timers_count || 0)
  + Number(totals.value.childrens_count || 0)
))

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
      <Button label="New meeting" icon="pi pi-plus" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="openCreate" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <div class="grid gap-4 md:grid-cols-4">
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Reported attendance</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.total_reported_attendance || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Report counts</p><h2 class="m-0 mt-2 text-2xl font-semibold text-[#a83632]">{{ reportCountsTotal }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Offerings</p><h2 class="m-0 mt-2 text-2xl font-semibold text-green-700">{{ totals.total_offering_amount || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">First timers</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.first_timers_count || 0 }}</h2></template></Card>
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
        <DataTable :value="meetings" :loading="loading" paginator lazy :rows="meta.per_page || 10" :total-records="meta.total || 0" @page="fetchMeetings($event.page + 1)">
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
