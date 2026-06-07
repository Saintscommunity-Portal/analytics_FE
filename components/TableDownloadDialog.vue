<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  tableName: {
    type: String,
    required: true,
  },
  query: {
    type: Object,
    default: () => ({}),
  },
  defaultTitle: {
    type: String,
    default: 'Table export',
  },
})

const emit = defineEmits(['update:visible', 'submitted'])

const { request } = useAdminApi()

const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const form = reactive({
  title: props.defaultTitle,
  name: '',
  emails: '',
  format: 'csv',
})

const formatOptions = [
  { label: 'CSV', value: 'csv' },
  { label: 'XLS', value: 'xls' },
  { label: 'PDF', value: 'pdf' },
]

const open = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

watch(() => props.visible, (visible) => {
  if (visible) {
    form.title = props.defaultTitle
    errorMessage.value = ''
    successMessage.value = ''
  }
})

function parseEmails(value) {
  return String(value || '')
    .split(/[,\n;]/)
    .map((email) => email.trim())
    .filter(Boolean)
}

async function submitDownload() {
  const emails = parseEmails(form.emails)

  if (!form.title.trim() || !form.name.trim() || emails.length === 0) {
    errorMessage.value = 'Enter a title, name, and at least one email address.'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await request('/downloads', {
      method: 'POST',
      body: {
        table_name: props.tableName,
        title: form.title.trim(),
        name: form.name.trim(),
        emails,
        format: form.format,
        query: props.query,
      },
    })

    successMessage.value = response?.message || 'Download request queued. Recipients will receive the link by email.'
    emit('submitted', response?.data)
  } catch (error) {
    errorMessage.value = error?.data?.message || error?.message || 'Unable to queue this download.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="open"
    modal
    header="Download table"
    :style="{ width: 'min(92vw, 520px)' }"
    :closable="!submitting"
  >
    <div class="space-y-4">
      <Message
        v-if="errorMessage"
        severity="error"
        :closable="false"
      >
        {{ errorMessage }}
      </Message>
      <Message
        v-if="successMessage"
        severity="success"
        :closable="false"
      >
        {{ successMessage }}
      </Message>

      <div class="space-y-2">
        <label class="text-sm font-semibold text-gray-900">Download title</label>
        <InputText
          v-model="form.title"
          class="w-full"
          placeholder="June members export"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-semibold text-gray-900">Requester name</label>
        <InputText
          v-model="form.name"
          class="w-full"
          placeholder="Name to show in the email"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-semibold text-gray-900">Recipient emails</label>
        <Textarea
          v-model="form.emails"
          rows="4"
          class="w-full"
          placeholder="one@example.com, two@example.com"
        />
        <p class="m-0 text-xs text-gray-500">
          Separate multiple emails with commas, semicolons, or new lines.
        </p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-semibold text-gray-900">File type</label>
        <SelectButton
          v-model="form.format"
          :options="formatOptions"
          option-label="label"
          option-value="value"
          class="download-format"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          label="Close"
          severity="secondary"
          outlined
          :disabled="submitting"
          @click="open = false"
        />
        <Button
          label="Queue download"
          icon="pi pi-cloud-download"
          class="!border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c] hover:!text-white"
          :loading="submitting"
          @click="submitDownload"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
:deep(.download-format .p-togglebutton-checked) {
  background: #a83632;
  border-color: #a83632;
  color: #ffffff;
}
</style>
