<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const auth = useAuthStore()
const { request } = useAdminApi()

const loading = ref(false)
const savingKey = ref('')
const message = ref('')
const errorMessage = ref('')
const schedules = ref([])
const draftById = reactive({})

const isAdmin = computed(() => auth.admin?.role === 'admin')
const frequencyOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
]
const dayOptions = [
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 7 },
]

const enabledCount = computed(() => schedules.value.filter((schedule) => draftById[schedule.id]?.enabled).length)

function scheduleDraft(schedule) {
  return draftById[schedule.id] || {}
}

function hydrateDrafts(items) {
  items.forEach((schedule) => {
    draftById[schedule.id] = {
      enabled: Boolean(schedule.enabled),
      frequency: schedule.frequency || 'daily',
      time: String(schedule.time || '02:00').slice(0, 5),
      day_of_week: schedule.day_of_week || 1,
    }
  })
}

function readableRun(schedule) {
  const draft = scheduleDraft(schedule)
  if (!draft.time) return 'Not configured'

  if (draft.frequency === 'weekly') {
    const day = dayOptions.find((option) => option.value === Number(draft.day_of_week))?.label || 'Monday'
    return `${day} at ${draft.time}`
  }

  return `Daily at ${draft.time}`
}

function formatDate(value) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function fetchSchedules() {
  if (!isAdmin.value) return

  loading.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    const response = await request('/developer/job-schedules')
    schedules.value = Array.isArray(response?.data) ? response.data : []
    hydrateDrafts(schedules.value)
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load job schedules.'
  } finally {
    loading.value = false
  }
}

async function saveSchedule(schedule) {
  const draft = scheduleDraft(schedule)
  savingKey.value = schedule.key
  message.value = ''
  errorMessage.value = ''

  try {
    const payload = {
      enabled: draft.enabled,
      frequency: draft.frequency,
      time: draft.time,
      day_of_week: draft.frequency === 'weekly' ? draft.day_of_week : null,
    }
    const response = await request(`/developer/job-schedules/${schedule.id}`, {
      method: 'PATCH',
      body: payload,
    })
    const updated = response?.data
    schedules.value = schedules.value.map((item) => (item.id === schedule.id ? updated : item))
    hydrateDrafts([updated])
    message.value = response?.message || 'Job schedule updated.'
  } catch (error) {
    const errors = error?.data?.errors
    errorMessage.value = errors
      ? Object.values(errors).flat().join(' ')
      : error?.data?.message || error?.message || 'Unable to update job schedule.'
  } finally {
    savingKey.value = ''
  }
}

onMounted(fetchSchedules)
</script>

<template>
  <section class="space-y-6">
    <div>
      <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Developer</p>
      <h1 class="m-0 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">Job Schedules</h1>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
        Configure when heavy background jobs are pushed to the Horizon queue. The scheduler checks these settings every minute.
      </p>
    </div>

    <Message v-if="!isAdmin" severity="error" :closable="false">
      This developer tool is only available to admin users.
    </Message>

    <template v-else>
      <Message v-if="message" severity="success" :closable="false">{{ message }}</Message>
      <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

      <div class="grid gap-4 md:grid-cols-3">
        <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <template #content>
            <p class="m-0 text-sm text-gray-500 dark:text-gray-400">Configured jobs</p>
            <p class="m-0 mt-2 text-3xl font-semibold text-gray-950 dark:text-white">{{ schedules.length }}</p>
          </template>
        </Card>
        <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <template #content>
            <p class="m-0 text-sm text-gray-500 dark:text-gray-400">Enabled</p>
            <p class="m-0 mt-2 text-3xl font-semibold text-[#a83632]">{{ enabledCount }}</p>
          </template>
        </Card>
        <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <template #content>
            <p class="m-0 text-sm text-gray-500 dark:text-gray-400">Queue</p>
            <p class="m-0 mt-2 text-3xl font-semibold text-gray-950 dark:text-white">horizon</p>
          </template>
        </Card>
      </div>

      <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <template #content>
          <DataTable
            :value="schedules"
            :loading="loading"
            striped-rows
            responsive-layout="scroll"
            class="text-sm"
          >
            <Column header="Job" style="min-width: 260px">
              <template #body="{ data }">
                <div>
                  <p class="m-0 font-semibold text-gray-950 dark:text-white">{{ data.name }}</p>
                  <p class="m-0 mt-1 max-w-xl text-xs leading-5 text-gray-500 dark:text-gray-400">{{ data.description }}</p>
                </div>
              </template>
            </Column>

            <Column header="Enabled" style="min-width: 110px">
              <template #body="{ data }">
                <ToggleSwitch v-model="draftById[data.id].enabled" />
              </template>
            </Column>

            <Column header="Frequency" style="min-width: 150px">
              <template #body="{ data }">
                <Select
                  v-model="draftById[data.id].frequency"
                  :options="frequencyOptions"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                />
              </template>
            </Column>

            <Column header="Day" style="min-width: 170px">
              <template #body="{ data }">
                <Select
                  v-model="draftById[data.id].day_of_week"
                  :options="dayOptions"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                  :disabled="draftById[data.id].frequency !== 'weekly'"
                />
              </template>
            </Column>

            <Column header="Time" style="min-width: 130px">
              <template #body="{ data }">
                <InputText
                  v-model="draftById[data.id].time"
                  type="time"
                  class="w-full"
                />
              </template>
            </Column>

            <Column header="Next Rule" style="min-width: 190px">
              <template #body="{ data }">
                <span class="text-gray-700 dark:text-gray-200">{{ readableRun(data) }}</span>
              </template>
            </Column>

            <Column header="Last Queued" style="min-width: 180px">
              <template #body="{ data }">
                <span class="text-gray-500 dark:text-gray-400">{{ formatDate(data.last_dispatched_at) }}</span>
              </template>
            </Column>

            <Column header="" style="min-width: 130px">
              <template #body="{ data }">
                <Button
                  label="Save"
                  icon="pi pi-save"
                  class="!border-[#a83632] !bg-[#a83632] !text-white"
                  :loading="savingKey === data.key"
                  @click="saveSchedule(data)"
                />
              </template>
            </Column>

            <template #empty>
              <div class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No job schedules found.
              </div>
            </template>
          </DataTable>
        </template>
      </Card>
    </template>
  </section>
</template>
