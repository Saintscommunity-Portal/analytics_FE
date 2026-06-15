<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const auth = useAuthStore()
const { request } = useAdminApi()

const loading = ref(false)
const message = ref('')
const errorMessage = ref('')
const form = reactive({
  email: '',
  role: 'church_pastor',
  from: '',
  to: '',
  church_id: null,
  fellowship_id: null,
  cell_id: null,
})

const roleOptions = [
  { label: 'Admin', value: 'admin' },
  { label: 'Pastor', value: 'pastor' },
  { label: 'Church Pastor', value: 'church_pastor' },
  { label: 'Fellowship Pastor', value: 'fellowship_pastor' },
  { label: 'Fellowship Leader', value: 'fellowship_leader' },
  { label: 'Cell Leader', value: 'cell_leader' },
]

const isAdmin = computed(() => auth.admin?.role === 'admin')
const entities = computed(() => auth.entities || {})
const churchOptions = computed(() => (entities.value.churches || []).map((church) => ({
  label: church.name,
  value: church.id,
  fellowships: church.fellowships || [],
})))
const fellowshipOptions = computed(() => {
  const selectedChurch = churchOptions.value.find((church) => Number(church.value) === Number(form.church_id))
  const source = selectedChurch ? [selectedChurch] : churchOptions.value

  return source.flatMap((church) => (church.fellowships || []).map((fellowship) => ({
    label: `${fellowship.name}${selectedChurch ? '' : ` / ${church.label}`}`,
    value: fellowship.id,
    cells: fellowship.cells || [],
  })))
})
const cellOptions = computed(() => {
  const selectedFellowship = fellowshipOptions.value.find((fellowship) => Number(fellowship.value) === Number(form.fellowship_id))
  const source = selectedFellowship ? [selectedFellowship] : fellowshipOptions.value

  return source.flatMap((fellowship) => (fellowship.cells || []).map((cell) => ({
    label: `${cell.name}${selectedFellowship ? '' : ` / ${fellowship.label}`}`,
    value: cell.id,
  })))
})
const needsChurch = computed(() => form.role === 'church_pastor')
const needsFellowship = computed(() => ['fellowship_pastor', 'fellowship_leader'].includes(form.role))
const needsCell = computed(() => form.role === 'cell_leader')

function clearScopeForRole() {
  if (['admin', 'pastor'].includes(form.role)) {
    form.church_id = null
    form.fellowship_id = null
    form.cell_id = null
  }

  if (form.role === 'church_pastor') {
    form.fellowship_id = null
    form.cell_id = null
  }

  if (needsFellowship.value) {
    form.cell_id = null
  }
}

async function sendTestDigest() {
  loading.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    const payload = {
      email: form.email,
      role: form.role,
      from: form.from || undefined,
      to: form.to || undefined,
      church_id: form.church_id || undefined,
      fellowship_id: form.fellowship_id || undefined,
      cell_id: form.cell_id || undefined,
    }

    const response = await request('/developer/test-weekly-digest', {
      method: 'POST',
      body: payload,
    })

    message.value = response?.message || 'Test weekly digest emails have been queued.'
  } catch (error) {
    const errors = error?.data?.errors
    errorMessage.value = errors
      ? Object.values(errors).flat().join(' ')
      : error?.data?.message || error?.message || 'Unable to queue test digest.'
  } finally {
    loading.value = false
  }
}

watch(() => form.role, clearScopeForRole)

watch(() => form.church_id, () => {
  form.fellowship_id = null
  form.cell_id = null
})

watch(() => form.fellowship_id, () => {
  form.cell_id = null
})
</script>

<template>
  <section class="space-y-6">
    <div>
      <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Developer</p>
      <h1 class="m-0 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">Digest Email Tester</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
        Send mock weekly activity and exceptions digest emails to a chosen address.
      </p>
    </div>

    <Message v-if="!isAdmin" severity="error" :closable="false">
      This developer tool is only available to admin users.
    </Message>

    <template v-else>
      <Message v-if="message" severity="success" :closable="false">{{ message }}</Message>
      <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

      <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <template #content>
          <form class="space-y-5" @submit.prevent="sendTestDigest">
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Recipient email</label>
                <InputText v-model="form.email" type="email" class="w-full" placeholder="test@example.com" required />
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Mock role</label>
                <Select v-model="form.role" :options="roleOptions" option-label="label" option-value="value" class="w-full" />
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">From</label>
                <InputText v-model="form.from" type="date" class="w-full" />
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">To</label>
                <InputText v-model="form.to" type="date" class="w-full" />
              </div>
            </div>

            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <div class="mb-4">
                <h2 class="m-0 text-base font-semibold text-gray-950 dark:text-white">Mock scope</h2>
                <p class="m-0 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Admin and pastor mocks use all churches. Other roles require the matching scope.
                </p>
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
                    Church <span v-if="needsChurch" class="text-[#a83632]">*</span>
                  </label>
                  <Select
                    v-model="form.church_id"
                    :options="churchOptions"
                    option-label="label"
                    option-value="value"
                    show-clear
                    class="w-full"
                    :disabled="['admin', 'pastor'].includes(form.role)"
                    placeholder="Select church"
                  />
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
                    Fellowship <span v-if="needsFellowship" class="text-[#a83632]">*</span>
                  </label>
                  <Select
                    v-model="form.fellowship_id"
                    :options="fellowshipOptions"
                    option-label="label"
                    option-value="value"
                    show-clear
                    class="w-full"
                    :disabled="['admin', 'pastor', 'church_pastor'].includes(form.role)"
                    placeholder="Select fellowship"
                  />
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
                    Cell <span v-if="needsCell" class="text-[#a83632]">*</span>
                  </label>
                  <Select
                    v-model="form.cell_id"
                    :options="cellOptions"
                    option-label="label"
                    option-value="value"
                    show-clear
                    class="w-full"
                    :disabled="form.role !== 'cell_leader'"
                    placeholder="Select cell"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end">
              <Button
                type="submit"
                label="Queue test digest"
                icon="pi pi-envelope"
                class="!border-[#a83632] !bg-[#a83632] !text-white"
                :loading="loading"
              />
            </div>
          </form>
        </template>
      </Card>
    </template>
  </section>
</template>
