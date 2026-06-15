<script setup>
definePageMeta({ middleware: 'auth', layout: 'admin' })

const route = useRoute()
const { request } = useAdminApi()
const auth = useAuth()

const loading = ref(true)
const attendanceLoading = ref(false)
const workerAttendanceLoading = ref(false)
const savingAttendance = ref(false)
const savingReport = ref(false)
const errorMessage = ref('')
const reportError = ref('')
const attendanceError = ref('')
const attendanceDialogOpen = ref(false)
const meeting = ref(null)
const report = ref(null)
const offerings = ref([])
const attendanceRows = ref([])
const workerAttendanceRows = ref([])
const existingWorkerAttendance = ref(new Map())
const attendanceSummary = ref({ worker_present: 0, worker_absent: 0, member_present: 0, member_absent: 0 })
const attendanceMeta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 50 })
const workerAttendanceMeta = ref({ current_page: 0, last_page: 1, total: 0, per_page: 50 })
const reportForm = reactive({ ushers_count: 0, first_timers_count: 0, childrens_count: 0 })
const offeringForm = reactive({ amount: 0, currency: 'NGN', notes: '' })
const reportFormOpen = ref(false)
const hasMoreWorkerAttendance = computed(() => Number(workerAttendanceMeta.value.current_page || 0) < Number(workerAttendanceMeta.value.last_page || 1))
const ownedFellowshipIds = computed(() => (auth.entities.value?.fellowships || []).map((fellowship) => fellowship.id).filter(Boolean))
const ownedCellIds = computed(() => (auth.entities.value?.cells || []).map((cell) => cell.id).filter(Boolean))
const canSubmitReport = computed(() => {
  const role = auth.admin.value?.role

  if (!role || !meeting.value) return false

  if (meeting.value.cellId) {
    return ['pastor', 'admin', 'church_pastor', 'fellowship_pastor', 'fellowship_leader', 'cell_leader'].includes(role)
  }

  if (meeting.value.fellowshipId) {
    return ['pastor', 'admin', 'church_pastor', 'fellowship_pastor', 'fellowship_leader'].includes(role)
  }

  return ['pastor', 'admin', 'church_pastor'].includes(role)
})

const totals = computed(() => {
  const meetingReport = report.value || meeting.value?.report || {}
  const offeringTotal = offerings.value.reduce((sum, offering) => sum + Number(offering.amount || 0), 0)
  const attendanceTotal = Number(attendanceSummary.value.worker_present || 0) + Number(attendanceSummary.value.member_present || 0)

  return {
    totalAttendance: attendanceTotal,
    reportTotal: Number(meetingReport.ushersCount || 0) + Number(meetingReport.firstTimersCount || 0) + Number(meetingReport.childrensCount || 0),
    ushers: Number(meetingReport.ushersCount || 0),
    firstTimers: Number(meetingReport.firstTimersCount || 0),
    children: Number(meetingReport.childrensCount || 0),
    offerings: offeringTotal,
    workersPresent: Number(attendanceSummary.value.worker_present || 0),
    workersAbsent: Number(attendanceSummary.value.worker_absent || 0),
    membersPresent: Number(attendanceSummary.value.member_present || 0),
    membersAbsent: Number(attendanceSummary.value.member_absent || 0),
  }
})

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value).replace(/_/g, ' ')
}

function displayDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatMoney(value, currency = 'NGN') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function syncReportForm(value = null) {
  reportForm.ushers_count = value?.ushersCount || 0
  reportForm.first_timers_count = value?.firstTimersCount || 0
  reportForm.childrens_count = value?.childrensCount || 0
}

function workerAttendanceFilters() {
  const filters = {
    church_id: meeting.value.churchId,
  }

  if (meeting.value.fellowshipId) {
    filters.fellowship_id = meeting.value.fellowshipId
  } else if (['fellowship_pastor', 'fellowship_leader'].includes(auth.admin.value?.role) && ownedFellowshipIds.value.length > 0) {
    filters.fellowship_ids = ownedFellowshipIds.value.join(',')
  }

  if (meeting.value.cellId) {
    filters.cell_id = meeting.value.cellId
  } else if (auth.admin.value?.role === 'cell_leader' && ownedCellIds.value.length > 0) {
    filters.cell_ids = ownedCellIds.value.join(',')
  }

  return filters
}

async function fetchAttendance(page = 1) {
  attendanceLoading.value = true
  try {
    const response = await request(`/church-meetings/${route.params.id}/attendance`, {
      method: 'GET',
      query: {
        page,
        per_page: attendanceMeta.value.per_page || 50,
      },
    })
    attendanceRows.value = response?.data || []
    attendanceSummary.value = response?.summary || { worker_present: 0, worker_absent: 0, member_present: 0, member_absent: 0 }
    attendanceMeta.value = { ...attendanceMeta.value, ...(response?.meta || {}) }
  } finally {
    attendanceLoading.value = false
  }
}

async function fetchExistingWorkerAttendance() {
  if (!meeting.value?.churchId) return

  attendanceError.value = ''

  try {
    const attendanceResponse = await request(`/church-meetings/${route.params.id}/attendance`, {
      method: 'GET',
      query: {
        per_page: 1000,
      },
    })

    existingWorkerAttendance.value = new Map(
      (attendanceResponse?.data || [])
        .filter((row) => row.personType === 'worker' && row.workerId)
        .map((row) => [Number(row.workerId), row.attendanceStatus]),
    )
  } catch (error) {
    attendanceError.value = error?.data?.message || error?.message || 'Unable to load existing attendance.'
  }
}

async function fetchWorkerAttendancePage(page = 1) {
  if (!meeting.value?.churchId || workerAttendanceLoading.value) return
  if (page > 1 && !hasMoreWorkerAttendance.value) return

  workerAttendanceLoading.value = true
  attendanceError.value = ''

  try {
    const workersResponse = await request('/workers', {
      method: 'GET',
      query: {
        ...workerAttendanceFilters(),
        page,
        per_page: workerAttendanceMeta.value.per_page || 50,
      },
    })

    const nextRows = (workersResponse?.data || []).map((worker) => ({
      worker_id: worker.id,
      name: [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.name || `Worker ${worker.id}`,
      churchName: worker.churchName,
      fellowshipName: worker.fellowshipName,
      status: existingWorkerAttendance.value.get(Number(worker.id)) || 'absent',
    }))

    const loaded = new Map(workerAttendanceRows.value.map((row) => [Number(row.worker_id), row]))
    nextRows.forEach((row) => loaded.set(Number(row.worker_id), row))
    workerAttendanceRows.value = Array.from(loaded.values())
    workerAttendanceMeta.value = { ...workerAttendanceMeta.value, ...(workersResponse?.meta || {}) }
  } catch (error) {
    attendanceError.value = error?.data?.message || error?.message || 'Unable to load workers for attendance.'
  } finally {
    workerAttendanceLoading.value = false
  }
}

async function openWorkerAttendanceModal() {
  attendanceDialogOpen.value = true
  attendanceError.value = ''
  workerAttendanceRows.value = []
  workerAttendanceMeta.value = { current_page: 0, last_page: 1, total: 0, per_page: 50 }
  await fetchExistingWorkerAttendance()
  await fetchWorkerAttendancePage(1)
}

function handleWorkerAttendanceScroll(event) {
  const target = event.target
  const bottomOffset = target.scrollHeight - target.scrollTop - target.clientHeight

  if (bottomOffset < 120) {
    fetchWorkerAttendancePage(Number(workerAttendanceMeta.value.current_page || 0) + 1)
  }
}

async function fetchMeetingDetails() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [meetingResponse, reportResponse, offeringsResponse] = await Promise.all([
      request(`/church-meetings/${route.params.id}`, { method: 'GET' }),
      request(`/church-meetings/${route.params.id}/report`, { method: 'GET' }),
      request(`/church-meetings/${route.params.id}/offerings`, { method: 'GET' }),
    ])

    meeting.value = meetingResponse?.data || null
    report.value = reportResponse?.data || null
    syncReportForm(report.value)
    offerings.value = offeringsResponse?.data || []
    await fetchAttendance()
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load meeting participants.'
  } finally {
    loading.value = false
  }
}

async function saveWorkerAttendance() {
  savingAttendance.value = true
  attendanceError.value = ''

  try {
    await request(`/church-meetings/${route.params.id}/attendance`, {
      method: 'PATCH',
      body: {
        attendance: workerAttendanceRows.value.map((row) => ({
          person_type: 'worker',
          worker_id: row.worker_id,
          attendance_status: row.status,
        })),
      },
    })

    await fetchAttendance()
    await fetchExistingWorkerAttendance()
    workerAttendanceRows.value = workerAttendanceRows.value.map((row) => ({
      ...row,
      status: existingWorkerAttendance.value.get(Number(row.worker_id)) || row.status,
    }))
  } catch (error) {
    attendanceError.value = error?.data?.message || error?.message || 'Unable to update worker attendance.'
  } finally {
    savingAttendance.value = false
  }
}

async function submitReport() {
  savingReport.value = true
  reportError.value = ''

  try {
    const reportResponse = await request(`/church-meetings/${route.params.id}/report`, {
      method: 'PATCH',
      body: { ...reportForm },
    })

    if (Number(offeringForm.amount || 0) > 0) {
      await request(`/church-meetings/${route.params.id}/offerings`, {
        method: 'POST',
        body: { ...offeringForm },
      })
      offeringForm.amount = 0
      offeringForm.currency = 'NGN'
      offeringForm.notes = ''
    }

    report.value = reportResponse?.data || null
    syncReportForm(report.value)

    const offeringsResponse = await request(`/church-meetings/${route.params.id}/offerings`, { method: 'GET' })
    offerings.value = offeringsResponse?.data || []
  } catch (error) {
    reportError.value = error?.data?.message || error?.message || 'Unable to submit meeting report.'
  } finally {
    savingReport.value = false
  }
}

onMounted(fetchMeetingDetails)
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <NuxtLink to="/church-meetings" class="inline-flex items-center gap-2 text-sm font-medium text-[#a83632] no-underline">
          <i class="pi pi-arrow-left text-xs" />
          Back to meetings
        </NuxtLink>
        <p class="m-0 mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Meeting participants</p>
        <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          {{ meeting?.meetingName || 'Meeting details' }}
        </h1>
        <p class="m-0 mt-2 text-sm text-gray-500">
          {{ displayValue(meeting?.type) }} / {{ displayDate(meeting?.meetingDate) }}
        </p>
      </div>
      <Tag
        v-if="meeting?.status"
        :value="displayValue(meeting.status)"
        :severity="meeting.status === 'completed' ? 'success' : 'warn'"
        class="capitalize"
      />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <div v-if="loading" class="grid gap-4 md:grid-cols-4">
      <Skeleton v-for="item in 8" :key="item" height="7rem" class="rounded-2xl" />
    </div>

    <template v-else>
      <Card v-if="canSubmitReport" class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <div class="grid gap-4 md:grid-cols-4">
            <div>
              <p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Church</p>
              <p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(meeting?.churchName) }}</p>
            </div>
            <div>
              <p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Fellowship</p>
              <p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(meeting?.fellowshipName) }}</p>
            </div>
            <div>
              <p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Cell</p>
              <p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(meeting?.cellName) }}</p>
            </div>
            <div>
              <p class="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Created by</p>
              <p class="m-0 mt-1 text-sm font-semibold text-gray-950">{{ displayValue(meeting?.createdByName) }}</p>
            </div>
          </div>
        </template>
      </Card>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card class="border border-gray-200 shadow-sm">
          <template #content>
            <p class="m-0 text-sm text-gray-500">Total attendance</p>
            <h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.totalAttendance }}</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">Present workers and members marked for this meeting</p>
          </template>
        </Card>
        <Card class="border border-gray-200 shadow-sm">
          <template #content>
            <p class="m-0 text-sm text-gray-500">Reported count</p>
            <h2 class="m-0 mt-2 text-2xl font-semibold text-[#a83632]">{{ totals.reportTotal }}</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">{{ totals.ushers }} adults / {{ totals.children }} children</p>
          </template>
        </Card>
        <Card class="border border-gray-200 shadow-sm">
          <template #content>
            <p class="m-0 text-sm text-gray-500">Offerings</p>
            <h2 class="m-0 mt-2 text-2xl font-semibold text-green-700">{{ formatMoney(totals.offerings, offerings[0]?.currency || 'NGN') }}</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">{{ offerings.length }} offering record{{ offerings.length === 1 ? '' : 's' }}</p>
          </template>
        </Card>
        <Card class="border border-gray-200 shadow-sm">
          <template #content>
            <p class="m-0 text-sm text-gray-500">First timers</p>
            <h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.firstTimers }}</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">Submitted by admin report</p>
          </template>
        </Card>
      </div>

      <div class="grid gap-4 md:grid-cols-4">
        <Card class="border border-gray-200 shadow-sm">
          <template #content><p class="m-0 text-sm text-gray-500">Workers present</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.workersPresent }}</h2></template>
        </Card>
        <Card class="border border-gray-200 shadow-sm">
          <template #content><p class="m-0 text-sm text-gray-500">Workers absent</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.workersAbsent }}</h2></template>
        </Card>
        <Card class="border border-gray-200 shadow-sm">
          <template #content><p class="m-0 text-sm text-gray-500">Members present</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.membersPresent }}</h2></template>
        </Card>
        <Card class="border border-gray-200 shadow-sm">
          <template #content><p class="m-0 text-sm text-gray-500">Members absent</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ totals.membersAbsent }}</h2></template>
        </Card>
      </div>

      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 class="m-0 text-lg font-semibold text-gray-950">Submit meeting report</h2>
              <p class="m-0 mt-1 text-sm text-gray-500">Enter the admin report counts and record offering for this meeting.</p>
            </div>
            <div class="flex items-center gap-2">
              <Tag :value="report ? 'Report submitted' : 'No report yet'" :severity="report ? 'success' : 'warn'" />
              <Button
                :icon="reportFormOpen ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                text
                rounded
                aria-label="Toggle report form"
                class="!text-[#a83632]"
                @click="reportFormOpen = !reportFormOpen"
              />
            </div>
          </div>

          <div v-if="reportFormOpen" class="mt-4">
            <Message v-if="reportError" severity="error" :closable="false" class="mb-4">{{ reportError }}</Message>

            <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 class="m-0 text-sm font-semibold text-gray-950">Reported count</h3>
                <p class="m-0 mt-1 text-xs text-gray-500">These are the counts submitted by the admin for this meeting.</p>

                <div class="mt-4 grid gap-4 sm:grid-cols-3">
                  <label class="block">
                    <span class="mb-1.5 block text-sm font-medium text-gray-700">Adult count</span>
                    <InputNumber v-model="reportForm.ushers_count" input-class="w-full" class="w-full" :min="0" />
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-sm font-medium text-gray-700">First timers</span>
                    <InputNumber v-model="reportForm.first_timers_count" input-class="w-full" class="w-full" :min="0" />
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-sm font-medium text-gray-700">Children count</span>
                    <InputNumber v-model="reportForm.childrens_count" input-class="w-full" class="w-full" :min="0" />
                  </label>
                </div>
              </div>

              <div class="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 class="m-0 text-sm font-semibold text-gray-950">Offering</h3>
                <p class="m-0 mt-1 text-xs text-gray-500">Leave amount as 0 if there is no offering to record now.</p>

                <div class="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <label class="block">
                    <span class="mb-1.5 block text-sm font-medium text-gray-700">Offering amount</span>
                    <InputNumber v-model="offeringForm.amount" input-class="w-full" class="w-full" :min="0" />
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-sm font-medium text-gray-700">Currency</span>
                    <InputText v-model="offeringForm.currency" class="w-full" />
                  </label>
                  <label class="block sm:col-span-2">
                    <span class="mb-1.5 block text-sm font-medium text-gray-700">Offering notes</span>
                    <Textarea v-model="offeringForm.notes" rows="3" class="w-full" />
                  </label>
                </div>
              </div>

              <div class="flex justify-end xl:col-span-2">
                <Button
                  label="Submit report"
                  icon="pi pi-check"
                  :loading="savingReport"
                  class="!border-[#a83632] !bg-[#a83632] !text-white"
                  @click="submitReport"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="m-0 text-lg font-semibold text-gray-950">Attendance details</h2>
              <p class="m-0 mt-1 text-sm text-gray-500">Workers and members generated for this meeting.</p>
            </div>
            <div class="flex items-center gap-2">
              <p class="m-0 text-sm text-gray-500">{{ attendanceMeta.total || 0 }} total rows</p>
              <Button
                label="Update worker attendance"
                icon="pi pi-users"
                class="!border-[#a83632] !bg-[#a83632] !text-white"
                @click="openWorkerAttendanceModal"
              />
            </div>
          </div>

          <DataTable
            :value="attendanceRows"
            :loading="attendanceLoading"
            paginator
            lazy
            :rows="attendanceMeta.per_page || 50"
            :total-records="attendanceMeta.total || 0"
            row-hover
            striped-rows
            @page="fetchAttendance($event.page + 1)"
          >
            <Column field="personName" header="Name" />
            <Column field="personType" header="Type">
              <template #body="{ data }">
                <Tag :value="displayValue(data.personType)" severity="secondary" class="capitalize" />
              </template>
            </Column>
            <Column field="attendanceStatus" header="Attendance">
              <template #body="{ data }">
                <Tag
                  :value="displayValue(data.attendanceStatus)"
                  :severity="data.attendanceStatus === 'present' ? 'success' : 'danger'"
                  class="capitalize"
                />
              </template>
            </Column>
            <Column field="fellowshipName" header="Fellowship">
              <template #body="{ data }">{{ displayValue(data.fellowshipName || data.fellowshipId) }}</template>
            </Column>
            <Column field="cellName" header="Cell">
              <template #body="{ data }">{{ displayValue(data.cellName || data.cellId) }}</template>
            </Column>
            <Column field="reportedAt" header="Reported">
              <template #body="{ data }">{{ displayDate(data.reportedAt) }}</template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <Dialog v-model:visible="attendanceDialogOpen" modal header="Update worker attendance" class="w-[94vw] max-w-3xl">
        <div class="space-y-4">
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p class="m-0 text-sm font-semibold text-gray-950">{{ meeting?.meetingName }}</p>
            <p class="m-0 mt-1 text-xs text-gray-500">
              {{ displayValue(meeting?.churchName) }} / {{ displayDate(meeting?.meetingDate) }}
            </p>
          </div>

          <Message v-if="attendanceError" severity="error" :closable="false">{{ attendanceError }}</Message>

          <div
            class="max-h-[65vh] overflow-y-auto pr-1"
            @scroll="handleWorkerAttendanceScroll"
          >
            <div v-if="workerAttendanceRows.length === 0 && workerAttendanceLoading" class="space-y-2">
              <Skeleton v-for="item in 7" :key="item" height="3.75rem" class="rounded-xl" />
            </div>

            <div v-else-if="workerAttendanceRows.length === 0" class="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
              No workers found for this meeting scope.
            </div>

            <div v-else class="grid gap-2">
              <div
                v-for="row in workerAttendanceRows"
                :key="row.worker_id"
                class="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center"
              >
                <div class="min-w-0">
                  <p class="m-0 truncate text-sm font-semibold text-gray-950">{{ row.name }}</p>
                  <p class="m-0 mt-1 truncate text-xs text-gray-500">{{ displayValue(row.fellowshipName) }} / {{ displayValue(row.churchName) }}</p>
                </div>
                <SelectButton
                  v-model="row.status"
                  :options="[
                    { label: 'Present', value: 'present' },
                    { label: 'Absent', value: 'absent' },
                  ]"
                  option-label="label"
                  option-value="value"
                  class="attendance-toggle"
                />
              </div>

              <div v-if="workerAttendanceLoading" class="space-y-2 pt-2">
                <Skeleton v-for="item in 3" :key="item" height="3.75rem" class="rounded-xl" />
              </div>

              <p v-else-if="hasMoreWorkerAttendance" class="m-0 py-3 text-center text-xs text-gray-500">
                Scroll to load more workers
              </p>
              <p v-else class="m-0 py-3 text-center text-xs text-gray-500">
                All loaded workers are shown
              </p>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="m-0 text-xs text-gray-500">
              Loaded {{ workerAttendanceRows.length }} of {{ workerAttendanceMeta.total || workerAttendanceRows.length }} workers
            </p>
            <div class="flex gap-2">
              <Button label="Cancel" severity="secondary" outlined :disabled="savingAttendance" @click="attendanceDialogOpen = false" />
              <Button label="Save loaded workers" :loading="savingAttendance" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="saveWorkerAttendance" />
            </div>
          </div>
        </template>
      </Dialog>
    </template>
  </section>
</template>

<style scoped>
:deep(.attendance-toggle .p-togglebutton-checked),
:deep(.attendance-toggle .p-togglebutton.p-highlight) {
  border-color: #a83632 !important;
  background: #a83632 !important;
  color: #ffffff !important;
}
</style>
