<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const route = useRoute()
const { request } = useAdminApi()
const authStore = useAuthStore()

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const formError = ref('')
const detailOpen = ref(false)
const studyGroup = ref(null)
const submissions = ref([])
const selectedSubmission = ref(null)
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 10 })

const filters = reactive({
  person_type: '',
  submission_status: '',
  submission_timing: '',
  resubmitted: false,
  needs_attention: false,
})

const reviewForm = reactive({
  grade: null,
  rejection_reason: '',
  notes: '',
})

const personTypeOptions = [
  { label: 'Worker', value: 'worker' },
  { label: 'Member', value: 'member' },
]
const statusOptions = [
  { label: 'Defaulted', value: 'defaulted' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]
const timingOptions = [
  { label: 'Early', value: 'early' },
  { label: 'Late', value: 'late' },
]

const canReview = computed(() => ['admin', 'pastor', 'church_pastor', 'fellowship_leader'].includes(authStore.admin?.role))
const needsAttentionCount = computed(() => studyGroup.value?.needsAttentionCount || submissions.value.filter((item) => item.submissionStatus === 'submitted').length)

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value).replace(/_/g, ' ')
}

function displayDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function displayDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function query(page = 1) {
  const output = {
    page,
    per_page: meta.value.per_page || 10,
    study_group_id: route.params.id,
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== false && value !== null) output[key] = value
  }

  return output
}

async function fetchStudyGroup() {
  const response = await request(`/study-groups/${route.params.id}`, { method: 'GET' })
  studyGroup.value = response?.data || null
}

async function fetchSubmissions(page = 1) {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await request('/study-group-submissions', { method: 'GET', query: query(page) })
    submissions.value = response?.data || []
    meta.value = { ...meta.value, ...(response?.meta || {}) }
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load submissions.'
  } finally {
    loading.value = false
  }
}

async function refresh(page = 1) {
  await Promise.all([fetchStudyGroup(), fetchSubmissions(page)])
}

function openSubmission(submission) {
  selectedSubmission.value = submission
  reviewForm.grade = submission.grade
  reviewForm.rejection_reason = submission.rejectionReason || ''
  reviewForm.notes = submission.notes || ''
  formError.value = ''
  detailOpen.value = true
}

async function reviewSubmission(action) {
  if (!selectedSubmission.value) return
  saving.value = true
  formError.value = ''
  try {
    const body = action === 'grade'
      ? { grade: reviewForm.grade, notes: reviewForm.notes }
      : action === 'reject'
        ? { rejection_reason: reviewForm.rejection_reason, notes: reviewForm.notes }
        : { notes: reviewForm.notes }

    await request(`/study-group-submissions/${selectedSubmission.value.id}/${action}`, { method: 'PATCH', body })
    detailOpen.value = false
    await refresh(meta.value.current_page || 1)
  } catch (error) {
    formError.value = error?.data?.message || error?.message || 'Unable to review submission.'
  } finally {
    saving.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <NuxtLink to="/study-group" class="text-sm font-medium text-[#a83632] no-underline">Back to Study Groups</NuxtLink>
        <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950">{{ studyGroup?.title || 'Study group' }}</h1>
        <p class="m-0 mt-2 text-sm text-gray-500">
          {{ displayValue(studyGroup?.materialType) }} / {{ displayDate(studyGroup?.fromDate) }} to {{ displayDate(studyGroup?.toDate) }}
        </p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p class="m-0 text-xs text-gray-500">Submitted assignments yet to be attended to</p>
        <p class="m-0 mt-1 text-2xl font-semibold text-[#a83632]">{{ needsAttentionCount }}</p>
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <Card v-if="studyGroup?.questions" class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <p class="m-0 text-sm font-semibold text-gray-950">Questions</p>
        <p class="m-0 mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">{{ studyGroup.questions }}</p>
      </template>
    </Card>

    <div class="grid gap-4 md:grid-cols-4">
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Submitted</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ studyGroup?.submittedCount || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Needs attention</p><h2 class="m-0 mt-2 text-2xl font-semibold text-[#a83632]">{{ studyGroup?.needsAttentionCount || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Defaulted</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ studyGroup?.defaultedCount || 0 }}</h2></template></Card>
      <Card class="border border-gray-200 shadow-sm"><template #content><p class="m-0 text-sm text-gray-500">Resubmitted</p><h2 class="m-0 mt-2 text-2xl font-semibold text-gray-950">{{ studyGroup?.resubmittedCount || 0 }}</h2></template></Card>
    </div>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="grid gap-3 md:grid-cols-6">
          <Select v-model="filters.person_type" :options="personTypeOptions" option-label="label" option-value="value" placeholder="Person" show-clear />
          <Select v-model="filters.submission_status" :options="statusOptions" option-label="label" option-value="value" placeholder="Status" show-clear />
          <Select v-model="filters.submission_timing" :options="timingOptions" option-label="label" option-value="value" placeholder="Timing" show-clear />
          <label class="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
            <Checkbox v-model="filters.resubmitted" binary />
            Resubmitted
          </label>
          <label class="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
            <Checkbox v-model="filters.needs_attention" binary />
            Needs attention
          </label>
          <Button label="Apply" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="fetchSubmissions()" />
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 shadow-sm">
      <template #content>
        <DataTable
          :value="submissions"
          :loading="loading"
          striped-rows
          paginator
          :rows="meta.per_page || 10"
          :total-records="meta.total || 0"
          lazy
          @page="fetchSubmissions($event.page + 1)"
          @row-click="openSubmission($event.data)"
        >
          <Column field="personName" header="Person" />
          <Column field="personType" header="Type"><template #body="{ data }">{{ displayValue(data.personType) }}</template></Column>
          <Column field="submissionType" header="Submission"><template #body="{ data }"><a v-if="data.submissionType === 'link'" :href="data.submissionLink" target="_blank" class="text-[#a83632]" @click.stop>Open link</a><span v-else>{{ displayValue(data.submissionType) }}</span></template></Column>
          <Column field="submissionTiming" header="Timing"><template #body="{ data }">{{ displayValue(data.submissionTiming) }}</template></Column>
          <Column field="submissionStatus" header="Status"><template #body="{ data }">{{ displayValue(data.submissionStatus) }}</template></Column>
          <Column field="resubmissionCount" header="Resubmits" />
          <Column field="grade" header="Grade" />
          <Column field="submittedAt" header="Submitted"><template #body="{ data }">{{ displayDateTime(data.submittedAt) }}</template></Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="detailOpen" modal header="Submission details" class="w-[92vw] max-w-2xl">
      <div v-if="selectedSubmission" class="space-y-4">
        <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <h2 class="m-0 text-lg font-semibold text-gray-950">{{ selectedSubmission.personName }}</h2>
          <p class="m-0 mt-1 text-sm capitalize text-gray-500">
            {{ displayValue(selectedSubmission.personType) }} / {{ displayValue(selectedSubmission.submissionStatus) }} / {{ displayValue(selectedSubmission.submissionTiming) }}
          </p>
          <p class="m-0 mt-3 text-sm text-gray-700">Submission: <a v-if="selectedSubmission.submissionType === 'link'" :href="selectedSubmission.submissionLink" target="_blank" class="text-[#a83632]">Open link</a><span v-else>{{ displayValue(selectedSubmission.submissionType) }}</span></p>
          <p class="m-0 mt-2 text-sm text-gray-700">Note: {{ displayValue(selectedSubmission.submissionNote) }}</p>
          <p class="m-0 mt-2 text-sm text-gray-700">Pastor comments: {{ displayValue(selectedSubmission.notes) }}</p>
          <p class="m-0 mt-2 text-sm text-gray-700">Rejection reason: {{ displayValue(selectedSubmission.rejectionReason) }}</p>
        </div>

        <div v-if="canReview" class="grid gap-4">
          <label class="text-sm font-medium text-gray-700">Grade</label>
          <InputNumber v-model="reviewForm.grade" :min="0" :max="100" class="w-full" />
          <label class="text-sm font-medium text-gray-700">Pastor comments</label>
          <Textarea v-model="reviewForm.notes" rows="3" class="w-full" />
          <label class="text-sm font-medium text-gray-700">Rejection reason</label>
          <Textarea v-model="reviewForm.rejection_reason" rows="3" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Close" severity="secondary" outlined @click="detailOpen = false" />
        <Button v-if="canReview" label="Grade" outlined class="!border-[#a83632] !text-[#a83632]" :loading="saving" @click="reviewSubmission('grade')" />
        <Button v-if="canReview" label="Approve" severity="success" :loading="saving" @click="reviewSubmission('approve')" />
        <Button v-if="canReview" label="Reject" severity="danger" :loading="saving" @click="reviewSubmission('reject')" />
      </template>
    </Dialog>
  </section>
</template>
