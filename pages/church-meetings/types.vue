<script setup>
definePageMeta({ middleware: 'auth', layout: 'admin' })

const authStore = useAuthStore()
const { request } = useAdminApi()

const loading = ref(false)
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')
const meetingTypes = ref([])
const form = reactive({ name: '', value: '', role: 'church_pastor' })
const editOpen = ref(false)
const editForm = reactive({ id: null, name: '', value: '', role: 'church_pastor', active: true })
const roleOptions = [
  { label: 'Church pastor', value: 'church_pastor' },
  { label: 'Fellowship leader', value: 'fellowship_leader' },
  { label: 'Cell leader', value: 'cell_leader' },
]

const isAdmin = computed(() => authStore.admin?.role === 'admin')

function slugValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function fetchMeetingTypes() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await request('/church-meeting-types', {
      method: 'GET',
      query: { active_only: false },
    })
    meetingTypes.value = Array.isArray(response?.data) ? response.data : []
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to load meeting types.'
  } finally {
    loading.value = false
  }
}

async function createMeetingType() {
  saving.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    const response = await request('/church-meeting-types', {
      method: 'POST',
      body: {
        name: form.name,
        value: form.value || slugValue(form.name),
        role: form.role,
        active: true,
      },
    })

    meetingTypes.value = [response.data, ...meetingTypes.value]
    form.name = ''
    form.value = ''
    form.role = 'church_pastor'
    message.value = response?.message || 'Meeting type created.'
  } catch (error) {
    const errors = error?.data?.errors
    errorMessage.value = errors
      ? Object.values(errors).flat().join(' ')
      : error?.data?.message || error?.message || 'Unable to create meeting type.'
  } finally {
    saving.value = false
  }
}

function openEditMeetingType(type) {
  editForm.id = type.id
  editForm.name = type.name || ''
  editForm.value = type.value || ''
  editForm.role = type.role || 'church_pastor'
  editForm.active = Boolean(type.active)
  message.value = ''
  errorMessage.value = ''
  editOpen.value = true
}

async function updateMeetingType() {
  saving.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    const response = await request(`/church-meeting-types/${editForm.id}`, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        value: editForm.value || slugValue(editForm.name),
        role: editForm.role,
        active: editForm.active,
      },
    })

    meetingTypes.value = meetingTypes.value.map((type) => (
      Number(type.id) === Number(editForm.id) ? response.data : type
    ))
    editOpen.value = false
    message.value = response?.message || 'Meeting type updated.'
  } catch (error) {
    const errors = error?.data?.errors
    errorMessage.value = errors
      ? Object.values(errors).flat().join(' ')
      : error?.data?.message || error?.message || 'Unable to update meeting type.'
  } finally {
    saving.value = false
  }
}

watch(() => form.name, (value) => {
  if (!form.value) form.value = slugValue(value)
})

onMounted(fetchMeetingTypes)
</script>

<template>
  <section class="space-y-6">
    <div>
      <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">Church Meetings</p>
      <h1 class="m-0 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">Meeting Types</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
        Create meeting types that populate the church meeting dropdown.
      </p>
    </div>

    <Message v-if="!isAdmin" severity="error" :closable="false">
      Only admin users can create meeting types.
    </Message>

    <template v-else>
      <Message v-if="message" severity="success" :closable="false">{{ message }}</Message>
      <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

      <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <template #content>
          <form class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" @submit.prevent="createMeetingType">
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Name</label>
              <InputText v-model="form.name" class="w-full" placeholder="Sunday Service" required />
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Value</label>
              <InputText v-model="form.value" class="w-full" placeholder="sunday_service" required />
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Role</label>
              <Select v-model="form.role" :options="roleOptions" option-label="label" option-value="value" class="w-full" required />
            </div>
            <div class="flex items-end">
              <Button
                type="submit"
                label="Create"
                icon="pi pi-plus"
                class="w-full !border-[#a83632] !bg-[#a83632] !text-white md:w-auto"
                :loading="saving"
              />
            </div>
          </form>
        </template>
      </Card>

      <Card class="border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <template #content>
          <DataTable :value="meetingTypes" :loading="loading" striped-rows responsive-layout="scroll">
            <Column field="name" header="Name" />
            <Column field="value" header="Value" />
            <Column field="role" header="Role">
              <template #body="{ data }">{{ String(data.role || '').replace(/_/g, ' ') }}</template>
            </Column>
            <Column field="active" header="Active">
              <template #body="{ data }">
                <Tag :value="data.active ? 'Active' : 'Inactive'" :severity="data.active ? 'success' : 'secondary'" />
              </template>
            </Column>
            <Column header="Action">
              <template #body="{ data }">
                <Button
                  label="Edit"
                  icon="pi pi-pencil"
                  size="small"
                  outlined
                  class="!border-[#a83632] !text-[#a83632]"
                  @click="openEditMeetingType(data)"
                />
              </template>
            </Column>
            <template #empty>
              <div class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No meeting types found.</div>
            </template>
          </DataTable>
        </template>
      </Card>

      <Dialog v-model:visible="editOpen" modal header="Edit meeting type" class="w-[92vw] max-w-xl">
        <div class="grid gap-4">
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Name</label>
            <InputText v-model="editForm.name" class="w-full" required />
          </div>
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Value</label>
            <InputText v-model="editForm.value" class="w-full" required />
          </div>
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Role</label>
            <Select v-model="editForm.role" :options="roleOptions" option-label="label" option-value="value" class="w-full" required />
          </div>
          <label class="flex items-center gap-3 text-sm font-semibold text-gray-900 dark:text-white">
            <Checkbox v-model="editForm.active" binary class="accent-[#a83632]" />
            Active
          </label>
        </div>
        <template #footer>
          <Button label="Cancel" severity="secondary" outlined @click="editOpen = false" />
          <Button label="Save changes" :loading="saving" class="!border-[#a83632] !bg-[#a83632] !text-white" @click="updateMeetingType" />
        </template>
      </Dialog>
    </template>
  </section>
</template>
