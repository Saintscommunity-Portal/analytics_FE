<script setup>
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'

ChartJS.register(BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip)

definePageMeta({ middleware: 'auth', layout: 'admin' })

const route = useRoute()
const { request } = useAdminApi()

const loading = ref(true)
const savingNote = ref(false)
const errorMessage = ref('')
const profile = ref(null)
const noteForm = reactive({ title: '', body: '' })
const membersPage = ref(1)
const filters = reactive({
  from_date: '',
  to_date: '',
})

const worker = computed(() => profile.value?.worker || {})
const stats = computed(() => profile.value?.stats || {})
const members = computed(() => profile.value?.members || [])
const membersMeta = computed(() => profile.value?.membersMeta || { current_page: 1, last_page: 1, total: 0, per_page: 10 })
const notes = computed(() => profile.value?.notes || [])
const initials = computed(() => `${worker.value.firstName?.[0] || ''}${worker.value.lastName?.[0] || ''}`.toUpperCase() || 'W')
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
}
const activityChartData = computed(() => ({
  labels: ['Members', 'Prayer present', 'Prayer absent', 'Study group', 'Meetings', 'Outreaches', 'Follow ups'],
  datasets: [{
    label: 'Activities',
    data: [
      Number(stats.value.membersAdded || 0),
      Number(stats.value.prayerGroupPresent || 0),
      Number(stats.value.prayerGroupAbsent || 0),
      Number(stats.value.studyGroupSubmitted || 0),
      Number(stats.value.churchMeetingsReported || 0),
      Number(stats.value.outreaches || 0),
      Number(stats.value.followUps || 0),
    ],
    backgroundColor: ['#a83632', '#15803d', '#d1d5db', '#2563eb', '#f59e0b', '#9333ea', '#0f766e'],
  }],
}))
const monthlyChartData = computed(() => {
  const series = profile.value?.series || {}
  const months = Array.from(new Set(Object.values(series).flatMap((rows) => (rows || []).map((row) => row.month)))).sort()
  const dataset = (key, label, color) => ({
    label,
    data: months.map((month) => Number((series[key] || []).find((row) => row.month === month)?.count || 0)),
    borderColor: color,
    backgroundColor: color,
  })

  return {
    labels: months,
    datasets: [
      dataset('membersAdded', 'Members', '#a83632'),
      dataset('prayerGroup', 'Prayer', '#15803d'),
      dataset('studyGroup', 'Study', '#2563eb'),
      dataset('churchMeetings', 'Meetings', '#f59e0b'),
      dataset('outreaches', 'Outreach', '#9333ea'),
      dataset('followUps', 'Follow ups', '#0f766e'),
    ],
  }
})

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value).replace(/_/g, ' ')
}

function displayDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

async function fetchProfile(page = membersPage.value) {
  loading.value = true
  errorMessage.value = ''
  try {
    const query = { members_page: page, members_per_page: membersMeta.value.per_page || 10 }
    if (filters.from_date) query.from_date = filters.from_date
    if (filters.to_date) query.to_date = filters.to_date
    const response = await request(`/workers/${route.params.id}/profile`, { method: 'GET', query })
    profile.value = response?.data || null
    membersPage.value = Number(profile.value?.membersMeta?.current_page || page)
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load worker profile.'
  } finally {
    loading.value = false
  }
}

async function saveNote() {
  savingNote.value = true
  try {
    await request(`/workers/${route.params.id}/notes`, { method: 'POST', body: { ...noteForm } })
    noteForm.title = ''
    noteForm.body = ''
    await fetchProfile(membersPage.value)
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to save note.'
  } finally {
    savingNote.value = false
  }
}

async function deleteNote(note) {
  savingNote.value = true
  try {
    await request(`/worker-notes/${note.id}`, { method: 'DELETE' })
    await fetchProfile(membersPage.value)
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to delete note.'
  } finally {
    savingNote.value = false
  }
}

onMounted(fetchProfile)
</script>

<template>
  <section class="space-y-5">
    <NuxtLink to="/workers" class="inline-flex items-center gap-2 text-sm font-medium text-[#a83632] no-underline">
      <i class="pi pi-arrow-left text-xs" />
      Back to workers
    </NuxtLink>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center gap-4">
            <div class="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl bg-[#a83632] text-3xl font-semibold text-white shadow-sm">
              <img v-if="worker.profileImage" :src="worker.profileImage" alt="" class="h-full w-full object-cover" />
              <span v-else>{{ initials }}</span>
            </div>
            <div>
              <p class="m-0 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Worker profile</p>
              <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">{{ displayValue(`${worker.firstName || ''} ${worker.lastName || ''}`.trim()) }}</h1>
              <p class="m-0 mt-2 text-sm text-gray-500">{{ displayValue(worker.status) }} / {{ displayValue(worker.slug) }}</p>
            </div>
          </div>
          <div class="grid gap-3 text-sm sm:grid-cols-2 lg:min-w-[420px]">
            <div><span class="block text-gray-500">Church</span><b class="text-gray-950">{{ displayValue(worker.churchName) }}</b></div>
            <div><span class="block text-gray-500">Fellowship</span><b class="text-gray-950">{{ displayValue(worker.fellowshipName) }}</b></div>
            <div><span class="block text-gray-500">Phone</span><b class="text-gray-950">{{ displayValue(worker.phoneNumber) }}</b></div>
            <div><span class="block text-gray-500">Email</span><b class="text-gray-950">{{ displayValue(worker.email) }}</b></div>
          </div>
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="m-0 text-base font-semibold text-gray-950">Activity window</h2>
            <p class="m-0 mt-1 text-sm text-gray-500">Defaults to the last three months.</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-[180px_180px_auto]">
            <InputText v-model="filters.from_date" type="date" />
            <InputText v-model="filters.to_date" type="date" />
            <Button label="Apply" class="!border-[#a83632] !bg-[#a83632] !text-white" :loading="loading" @click="fetchProfile(1)" />
          </div>
        </div>
      </template>
    </Card>

    <div class="grid gap-4 md:grid-cols-4">
      <Card v-for="item in [
        ['Total members', stats.totalMembers],
        ['Members added', stats.membersAdded],
        ['Prayer present', stats.prayerGroupPresent],
        ['Outreaches', stats.outreaches],
      ]" :key="item[0]" class="border border-gray-200 bg-white shadow-sm">
        <template #content><p class="m-0 text-sm text-gray-500">{{ item[0] }}</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ item[1] || 0 }}</h2></template>
      </Card>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content><p class="m-0 text-sm font-semibold text-gray-950">Activity summary</p><div class="mt-4 h-72"><Bar :data="activityChartData" :options="chartOptions" /></div></template>
      </Card>
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content><p class="m-0 text-sm font-semibold text-gray-950">Monthly activity</p><div class="mt-4 h-72"><Line :data="monthlyChartData" :options="chartOptions" /></div></template>
      </Card>
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <div class="mb-4 flex items-center justify-between">
            <div><h2 class="m-0 text-base font-semibold text-gray-950">Assigned members</h2><p class="m-0 mt-1 text-sm text-gray-500">{{ membersMeta.total || 0 }} members belong to this worker.</p></div>
          </div>
          <DataTable :value="members" :loading="loading" paginator lazy :rows="membersMeta.per_page || 10" :total-records="membersMeta.total || 0" row-hover @page="fetchProfile($event.page + 1)">
            <Column field="fullName" header="Name" />
            <Column field="slug" header="Slug" />
            <Column field="phone1" header="Phone" />
            <Column field="email" header="Email" />
            <Column field="dateAdded" header="Date added"><template #body="{ data }">{{ displayDate(data.dateAdded) }}</template></Column>
          </DataTable>
        </template>
      </Card>

      <Card class="border border-gray-200 bg-white shadow-sm">
        <template #content>
          <h2 class="m-0 text-base font-semibold text-gray-950">Admin notes</h2>
          <div class="mt-4 space-y-3">
            <InputText v-model="noteForm.title" class="w-full" placeholder="Note title" />
            <Textarea v-model="noteForm.body" rows="4" class="w-full" placeholder="Write a private admin note" />
            <Button label="Add note" icon="pi pi-plus" class="!border-[#a83632] !bg-[#a83632] !text-white" :loading="savingNote" :disabled="!noteForm.body" @click="saveNote" />
          </div>
          <div class="mt-5 space-y-3">
            <div v-if="notes.length === 0" class="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">No admin notes yet.</div>
            <div v-for="note in notes" :key="note.id" class="rounded-xl border border-gray-200 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="m-0 text-sm font-semibold text-gray-950">{{ displayValue(note.title || 'Untitled note') }}</p>
                  <p class="m-0 mt-1 text-xs text-gray-500">{{ displayValue(note.adminName) }} / {{ displayDate(note.createdAt) }}</p>
                </div>
                <Button icon="pi pi-trash" size="small" severity="danger" text rounded @click="deleteNote(note)" />
              </div>
              <p class="m-0 mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{{ note.body }}</p>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </section>
</template>
