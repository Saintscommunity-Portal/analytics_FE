<script setup>
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "vue-chartjs";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

definePageMeta({
  middleware: "auth",
  layout: "admin",
});

const { request } = useAdminApi();
const authStore = useAuthStore();

const loading = ref(true);
const dashboardLoading = ref(true);
const saving = ref(false);
const errorMessage = ref("");
const dashboardError = ref("");
const formError = ref("");
const createOpen = ref(false);
const participantSummaryOpen = ref(false);
const editingStudyGroup = ref(null);
const chartsOpen = ref(true);
const studyGroups = ref([]);
const dashboard = ref(null);
const participantSummaryRows = ref([]);
const participantSummaryLoading = ref(false);
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 10 });
const participantSummaryMeta = ref({
  current_page: 1,
  from: 0,
  last_page: 1,
  per_page: 10,
  to: 0,
  total: 0,
});
const participantSummaryInfo = ref({
  heldStudyGroups: 0,
  dateFrom: "",
  dateTo: "",
});
const participantSummaryFirst = ref(0);
const participantSummaryRowsPerPage = ref(10);

const filters = reactive({
  search: "",
  church_id: "",
  fellowship_id: "",
  cell_id: "",
  date_from: "",
  date_to: "",
  material_type: "",
});

const participantSummaryFilters = reactive({
  date_from: "",
  date_to: "",
  church_id: "",
  fellowship_id: "",
  cell_id: "",
  material_type: "",
  person_type: "",
  participation_min: null,
  participation_max: null,
});

const form = reactive({
  church_id: null,
  title: "",
  material_type: "audio_teaching",
  questions: "",
  from_date: "",
  to_date: "",
});

const materialOptions = [
  { label: "Audio teaching", value: "audio_teaching" },
  { label: "Book", value: "book" },
];

const isChurchPastor = computed(
  () => authStore.admin?.role === "church_pastor",
);
const churchOptions = computed(() =>
  (authStore.entities?.churches || []).map((church) => ({
    label: church.name,
    value: church.id,
  })),
);
const fellowshipOptions = computed(() => {
  const churches = authStore.entities?.churches || [];
  const selectedChurchId = Number(filters.church_id || 0);

  return churches
    .filter(
      (church) => !selectedChurchId || Number(church.id) === selectedChurchId,
    )
    .flatMap((church) =>
      (church.fellowships || []).map((fellowship) => ({
        label: fellowship.name,
        value: fellowship.id,
        churchId: church.id,
      })),
    );
});
const cellOptions = computed(() => {
  const selectedFellowshipId = Number(filters.fellowship_id || 0);

  return fellowshipOptions.value
    .filter(
      (fellowship) =>
        !selectedFellowshipId ||
        Number(fellowship.value) === selectedFellowshipId,
    )
    .flatMap((fellowship) => {
      const source = (authStore.entities?.churches || [])
        .flatMap((church) => church.fellowships || [])
        .find((item) => Number(item.id) === Number(fellowship.value));

      return (source?.cells || []).map((cell) => ({
        label: cell.name,
        value: cell.id,
        fellowshipId: fellowship.value,
      }));
    });
});
const totalNeedsAttention = computed(() =>
  studyGroups.value.reduce(
    (sum, item) => sum + Number(item.needsAttentionCount || 0),
    0,
  ),
);
const totalDefaulted = computed(() =>
  studyGroups.value.reduce(
    (sum, item) => sum + Number(item.defaultedCount || 0),
    0,
  ),
);
const totalSubmitted = computed(() =>
  studyGroups.value.reduce(
    (sum, item) => sum + Number(item.submittedCount || 0),
    0,
  ),
);
const totalParticipantSummaryRecords = computed(
  () => participantSummaryMeta.value?.total || 0,
);
const dashboardTotals = computed(() => dashboard.value?.totals || {});
const dailyStats = computed(() => normalizeList(dashboard.value?.daily));
const materialTypeStats = computed(() =>
  normalizeList(dashboard.value?.materialTypes),
);
const statusTotal = computed(
  () =>
    Number(dashboardTotals.value.totalSubmitted || 0) +
    Number(dashboardTotals.value.totalDefaulted || 0) +
    Number(dashboardTotals.value.totalApproved || 0) +
    Number(dashboardTotals.value.totalRejected || 0),
);
const submissionRate = computed(() =>
  percentage(
    dashboardTotals.value.totalSubmitted,
    Number(dashboardTotals.value.totalSubmitted || 0) +
      Number(dashboardTotals.value.totalDefaulted || 0),
  ),
);
const approvalRate = computed(() =>
  percentage(dashboardTotals.value.totalApproved, statusTotal.value),
);
const lateRate = computed(() =>
  percentage(
    dashboardTotals.value.lateCount,
    Number(dashboardTotals.value.earlyCount || 0) +
      Number(dashboardTotals.value.lateCount || 0),
  ),
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 10,
        color: "#374151",
        font: {
          size: 11,
        },
      },
    },
  },
};

const barOptions = {
  ...chartOptions,
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: "#4b5563",
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0,
        color: "#4b5563",
      },
      grid: {
        color: "#f3f4f6",
      },
    },
  },
};

const submissionStatusChartData = computed(() => ({
  labels: ["Submitted", "Defaulted", "Approved", "Rejected"],
  datasets: [
    {
      data: [
        dashboardTotals.value.totalSubmitted || 0,
        dashboardTotals.value.totalDefaulted || 0,
        dashboardTotals.value.totalApproved || 0,
        dashboardTotals.value.totalRejected || 0,
      ],
      backgroundColor: ["#a83632", "#6b7280", "#16a34a", "#dc2626"],
      borderColor: "#ffffff",
      borderWidth: 3,
    },
  ],
}));

const personTypeChartData = computed(() => ({
  labels: ["Workers", "Members"],
  datasets: [
    {
      data: [
        dashboardTotals.value.workerSubmitted || 0,
        dashboardTotals.value.memberSubmitted || 0,
      ],
      backgroundColor: ["#a83632", "#2563eb"],
      borderColor: "#ffffff",
      borderWidth: 3,
    },
  ],
}));

const timingChartData = computed(() => ({
  labels: ["Early", "Late"],
  datasets: [
    {
      data: [
        dashboardTotals.value.earlyCount || 0,
        dashboardTotals.value.lateCount || 0,
      ],
      backgroundColor: ["#16a34a", "#f59e0b"],
      borderColor: "#ffffff",
      borderWidth: 3,
    },
  ],
}));

const materialTypeChartData = computed(() => ({
  labels: materialTypeStats.value.map((item) =>
    displayValue(item.material_type || item.materialType),
  ),
  datasets: [
    {
      label: "Submitted",
      data: materialTypeStats.value.map((item) =>
        Number(item.total_submitted || item.totalSubmitted || 0),
      ),
      backgroundColor: "#a83632",
      borderRadius: 8,
    },
  ],
}));

const dailyChartData = computed(() => ({
  labels: dailyStats.value.map((item) => displayDate(item.date)),
  datasets: [
    {
      label: "Submitted",
      data: dailyStats.value.map((item) =>
        Number(item.total_submitted || item.totalSubmitted || 0),
      ),
      borderColor: "#a83632",
      backgroundColor: "#a83632",
      tension: 0.35,
    },
    {
      label: "Average grade",
      data: dailyStats.value.map((item) =>
        Number(item.grade_average || item.gradeAverage || 0),
      ),
      borderColor: "#2563eb",
      backgroundColor: "#2563eb",
      tension: 0.35,
    },
  ],
}));

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/_/g, " ");
}

function displayDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function percentage(value, total) {
  const numericTotal = Number(total || 0);
  if (!numericTotal) return 0;

  return Math.round((Number(value || 0) / numericTotal) * 100);
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).map(([key, item]) => {
    if (item && typeof item === "object") {
      return {
        label: item.label || item.material_type || item.materialType || key,
        ...item,
      };
    }

    return {
      label: key,
      count: item,
      total_submitted: item,
    };
  });
}

function buildQuery(page = 1) {
  const query = { page, per_page: meta.value.per_page || 10 };
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null) query[key] = value;
  }
  return query;
}

function buildDashboardQuery() {
  const query = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null) query[key] = value;
  }
  return query;
}

function buildParticipantSummaryQuery(page = 1) {
  const query = {
    page,
    per_page: participantSummaryRowsPerPage.value,
  };

  for (const [key, value] of Object.entries(participantSummaryFilters)) {
    if (value !== "" && value !== null && value !== undefined) query[key] = value;
  }

  return query;
}

async function fetchStudyGroups(page = 1) {
  loading.value = true;
  errorMessage.value = "";
  try {
    const response = await request("/study-groups", {
      method: "GET",
      query: buildQuery(page),
    });
    studyGroups.value = response?.data || [];
    meta.value = { ...meta.value, ...(response?.meta || {}) };
  } catch (error) {
    errorMessage.value =
      error?.data?.message || error?.message || "Unable to load study groups.";
  } finally {
    loading.value = false;
  }
}

async function fetchDashboard() {
  dashboardLoading.value = true;
  dashboardError.value = "";
  try {
    const response = await request("/study-group-dashboard", {
      method: "GET",
      query: buildDashboardQuery(),
    });
    dashboard.value = response?.data || null;
  } catch (error) {
    dashboardError.value =
      error?.data?.message ||
      error?.message ||
      "Unable to load study group stats.";
  } finally {
    dashboardLoading.value = false;
  }
}

async function fetchParticipantSummary(page = 1) {
  participantSummaryLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await request("/study-group-participants/summary", {
      method: "GET",
      query: buildParticipantSummaryQuery(page),
    });

    participantSummaryRows.value = Array.isArray(response?.data)
      ? response.data
      : [];
    participantSummaryMeta.value = {
      ...participantSummaryMeta.value,
      ...(response?.meta || {}),
    };
    participantSummaryInfo.value = {
      ...participantSummaryInfo.value,
      ...(response?.summary || {}),
    };
    participantSummaryRowsPerPage.value = Number(
      participantSummaryMeta.value.per_page || participantSummaryRowsPerPage.value,
    );
    participantSummaryFirst.value =
      ((Number(participantSummaryMeta.value.current_page) || page) - 1) *
      participantSummaryRowsPerPage.value;
  } catch (error) {
    participantSummaryRows.value = [];
    errorMessage.value =
      error?.data?.message ||
      error?.message ||
      "Unable to load study group participant summary.";
  } finally {
    participantSummaryLoading.value = false;
  }
}

function openParticipantSummary() {
  participantSummaryFilters.date_from = filters.date_from;
  participantSummaryFilters.date_to = filters.date_to;
  participantSummaryFilters.church_id = filters.church_id;
  participantSummaryFilters.fellowship_id = filters.fellowship_id;
  participantSummaryFilters.cell_id = filters.cell_id;
  participantSummaryFilters.material_type = filters.material_type;
  participantSummaryFilters.person_type = "";
  participantSummaryFilters.participation_min = null;
  participantSummaryFilters.participation_max = null;
  participantSummaryFirst.value = 0;
  participantSummaryOpen.value = true;
  fetchParticipantSummary(1);
}

function applyParticipantSummaryFilters() {
  participantSummaryFirst.value = 0;
  fetchParticipantSummary(1);
}

function clearParticipantSummaryFilters() {
  participantSummaryFilters.date_from = filters.date_from;
  participantSummaryFilters.date_to = filters.date_to;
  participantSummaryFilters.church_id = "";
  participantSummaryFilters.fellowship_id = "";
  participantSummaryFilters.cell_id = "";
  participantSummaryFilters.material_type = "";
  participantSummaryFilters.person_type = "";
  participantSummaryFilters.participation_min = null;
  participantSummaryFilters.participation_max = null;
  participantSummaryFirst.value = 0;
  fetchParticipantSummary(1);
}

function onParticipantSummaryPage(event) {
  participantSummaryRowsPerPage.value = event.rows;
  participantSummaryFirst.value = event.first;
  fetchParticipantSummary(event.page + 1);
}

async function refreshStudyGroupPage(page = 1) {
  await Promise.all([fetchStudyGroups(page), fetchDashboard()]);
}

function resetForm() {
  form.church_id =
    churchOptions.value[0]?.value || authStore.admin?.church_id || null;
  form.title = "";
  form.material_type = "audio_teaching";
  form.questions = "";
  form.from_date = "";
  form.to_date = "";
  formError.value = "";
  editingStudyGroup.value = null;
}

function openCreateDialog() {
  resetForm();
  createOpen.value = true;
}

function openEditDialog(studyGroup) {
  editingStudyGroup.value = studyGroup;
  form.church_id = studyGroup.churchId;
  form.title = studyGroup.title || "";
  form.material_type = studyGroup.materialType || "audio_teaching";
  form.questions = studyGroup.questions || "";
  form.from_date = studyGroup.fromDate || "";
  form.to_date = studyGroup.toDate || "";
  formError.value = "";
  createOpen.value = true;
}

function onChurchFilterChange() {
  filters.fellowship_id = "";
  filters.cell_id = "";
}

function onFellowshipFilterChange() {
  filters.cell_id = "";
}

async function createStudyGroup() {
  saving.value = true;
  formError.value = "";
  try {
    const path = editingStudyGroup.value
      ? `/study-groups/${editingStudyGroup.value.id}`
      : "/study-groups";
    const method = editingStudyGroup.value ? "PATCH" : "POST";

    await request(path, { method, body: { ...form } });
    createOpen.value = false;
    resetForm();
    await refreshStudyGroupPage();
  } catch (error) {
    formError.value =
      error?.data?.message || error?.message || "Unable to create study group.";
  } finally {
    saving.value = false;
  }
}

async function deleteStudyGroup(studyGroup) {
  const confirmed = window.confirm(
    `Delete "${studyGroup.title}"? Its submissions will also be deleted.`,
  );
  if (!confirmed) return;

  loading.value = true;
  errorMessage.value = "";
  try {
    await request(`/study-groups/${studyGroup.id}`, { method: "DELETE" });
    await refreshStudyGroupPage(meta.value.current_page || 1);
  } catch (error) {
    errorMessage.value =
      error?.data?.message || error?.message || "Unable to delete study group.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  resetForm();
  refreshStudyGroupPage();
});
</script>

<template>
  <section class="space-y-5">
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p
          class="m-0 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]"
        >
          Study Group
        </p>
        <h1
          class="m-0 mt-2 text-3xl font-semibold tracking-tight text-gray-950"
        >
          Study groups
        </h1>
        <p class="m-0 mt-2 text-sm text-gray-500">
          Assignments created for churches. Open an assignment to review
          submissions.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          label="Participant summary"
          icon="pi pi-table"
          outlined
          class="!border-[#a83632] !text-[#a83632]"
          @click="openParticipantSummary"
        />
        <Button
          v-if="isChurchPastor"
          label="New study group"
          icon="pi pi-plus"
          class="!border-[#a83632] !bg-[#a83632] !text-white hover:!border-[#922f2c] hover:!bg-[#922f2c]"
          @click="openCreateDialog"
        />
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{
      errorMessage
    }}</Message>

    <div class="grid gap-4 md:grid-cols-3">
      <Card class="border border-gray-200 shadow-sm"
        ><template #content
          ><p class="m-0 text-sm text-white">Submitted</p>
          <h2 class="m-0 mt-2 text-2xl font-semibold text-gray-100">
            {{ totalSubmitted }}
          </h2></template
        ></Card
      >
      <Card class="border border-gray-200 shadow-sm"
        ><template #content
          ><p class="m-0 text-sm text-gray-500">Needs attention</p>
          <h2 class="m-0 mt-2 text-2xl font-semibold text-[#a83632]">
            {{ totalNeedsAttention }}
          </h2></template
        ></Card
      >
      <Card class="border border-gray-200 shadow-sm"
        ><template #content
          ><p class="m-0 text-sm text-white">Defaulted</p>
          <h2 class="m-0 mt-2 text-2xl font-semibold text-gray-100">
            {{ totalDefaulted }}
          </h2></template
        ></Card
      >
    </div>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <InputText v-model="filters.search" placeholder="Search title" />
          <Select
            v-model="filters.church_id"
            :options="churchOptions"
            option-label="label"
            option-value="value"
            placeholder="Church"
            show-clear
            @update:model-value="onChurchFilterChange"
          />
          <Select
            v-model="filters.fellowship_id"
            :options="fellowshipOptions"
            option-label="label"
            option-value="value"
            placeholder="Fellowship"
            show-clear
            :disabled="!fellowshipOptions.length"
            @update:model-value="onFellowshipFilterChange"
          />
          <Select
            v-model="filters.cell_id"
            :options="cellOptions"
            option-label="label"
            option-value="value"
            placeholder="Cell"
            show-clear
            :disabled="!cellOptions.length"
          />
          <InputText v-model="filters.date_from" type="date" />
          <InputText v-model="filters.date_to" type="date" />
          <Select
            v-model="filters.material_type"
            :options="materialOptions"
            option-label="label"
            option-value="value"
            placeholder="Material"
            show-clear
          />
          <Button
            label="Apply"
            class="!border-[#a83632] !bg-[#a83632] !text-white"
            @click="refreshStudyGroupPage()"
          />
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 bg-white shadow-sm">
      <template #content>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 text-left"
          @click="chartsOpen = !chartsOpen"
        >
          <div>
            <h2 class="m-0 text-sm font-semibold text-gray-950">
              Study group stats
            </h2>
            <p class="m-0 mt-1 text-xs text-white">
              Submitted/defaulted, approval, timing, material type, and grade
              trends for the current filters.
            </p>
          </div>
          <i
            class="pi text-gray-500"
            :class="chartsOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
          />
        </button>

        <div v-if="chartsOpen" class="mt-5 border-t border-gray-100 pt-5">
          <Message v-if="dashboardError" severity="error" :closable="false">{{
            dashboardError
          }}</Message>

          <div class="grid gap-4 md:grid-cols-4">
            <Card class="border border-gray-200 shadow-sm">
              <template #content>
                <p class="m-0 text-sm text-gray-500">Study groups held</p>
                <h3 class="m-0 mt-2 text-2xl font-semibold text-gray-950">
                  {{ dashboardTotals.studyGroupsHeld || 0 }}
                </h3>
              </template>
            </Card>
            <Card class="border border-gray-200 shadow-sm">
              <template #content>
                <p class="m-0 text-sm text-gray-500">Submission rate</p>
                <h3 class="m-0 mt-2 text-2xl font-semibold text-[#a83632]">
                  {{ submissionRate }}%
                </h3>
              </template>
            </Card>
            <Card class="border border-gray-200 shadow-sm">
              <template #content>
                <p class="m-0 text-sm text-gray-500">Approval rate</p>
                <h3 class="m-0 mt-2 text-2xl font-semibold text-green-700">
                  {{ approvalRate }}%
                </h3>
              </template>
            </Card>
            <Card class="border border-gray-200 shadow-sm">
              <template #content>
                <p class="m-0 text-sm text-gray-500">Late submissions</p>
                <h3 class="m-0 mt-2 text-2xl font-semibold text-amber-600">
                  {{ lateRate }}%
                </h3>
              </template>
            </Card>
          </div>

          <div class="mt-4 grid gap-4 xl:grid-cols-3">
            <div
              class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h3 class="m-0 text-sm font-semibold text-gray-950">
                Submission status
              </h3>
              <div class="mt-4 h-64">
                <Skeleton v-if="dashboardLoading" height="100%" />
                <Doughnut
                  v-else
                  :data="submissionStatusChartData"
                  :options="chartOptions"
                />
              </div>
            </div>
            <div
              class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h3 class="m-0 text-sm font-semibold text-gray-950">
                Workers vs members
              </h3>
              <div class="mt-4 h-64">
                <Skeleton v-if="dashboardLoading" height="100%" />
                <Doughnut
                  v-else
                  :data="personTypeChartData"
                  :options="chartOptions"
                />
              </div>
            </div>
            <div
              class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h3 class="m-0 text-sm font-semibold text-gray-950">
                Early vs late
              </h3>
              <div class="mt-4 h-64">
                <Skeleton v-if="dashboardLoading" height="100%" />
                <Doughnut
                  v-else
                  :data="timingChartData"
                  :options="chartOptions"
                />
              </div>
            </div>
          </div>

          <div class="mt-4 grid gap-4 xl:grid-cols-2">
            <div
              class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h3 class="m-0 text-sm font-semibold text-gray-950">
                Material type submissions
              </h3>
              <div class="mt-4 h-72">
                <Skeleton v-if="dashboardLoading" height="100%" />
                <Bar
                  v-else
                  :data="materialTypeChartData"
                  :options="barOptions"
                />
              </div>
            </div>
            <div
              class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h3 class="m-0 text-sm font-semibold text-gray-950">
                Daily submissions and grade trend
              </h3>
              <div class="mt-4 h-72">
                <Skeleton v-if="dashboardLoading" height="100%" />
                <Line v-else :data="dailyChartData" :options="barOptions" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card class="border border-gray-200 shadow-sm">
      <template #content>
        <DataTable
          :value="studyGroups"
          :loading="loading"
          striped-rows
          paginator
          :rows="meta.per_page || 10"
          :total-records="meta.total || 0"
          lazy
          @page="fetchStudyGroups($event.page + 1)"
        >
          <Column field="title" header="Study group">
            <template #body="{ data }">
              <NuxtLink
                :to="`/study-group/${data.id}`"
                class="font-semibold text-[#a83632] no-underline"
              >
                {{ data.title }}
              </NuxtLink>
            </template>
          </Column>
          <Column field="materialType" header="Material"
            ><template #body="{ data }">{{
              displayValue(data.materialType)
            }}</template></Column
          >
          <Column field="churchName" header="Church" />
          <Column field="questions" header="Questions">
            <template #body="{ data }">
              <span class="line-clamp-2 text-sm text-gray-700">{{
                data.questions || "-"
              }}</span>
            </template>
          </Column>
          <Column field="fromDate" header="From"
            ><template #body="{ data }">{{
              displayDate(data.fromDate)
            }}</template></Column
          >
          <Column field="toDate" header="Due"
            ><template #body="{ data }">{{
              displayDate(data.toDate)
            }}</template></Column
          >
          <Column field="submittedCount" header="Submitted" />
          <Column field="needsAttentionCount" header="Needs attention" />
          <Column field="defaultedCount" header="Defaulted" />
          <Column header="Open">
            <template #body="{ data }">
              <NuxtLink
                :to="`/study-group/${data.id}`"
                class="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-[#a83632] no-underline hover:bg-[#a83632]/10"
              >
                View
              </NuxtLink>
              <Button
                v-if="isChurchPastor"
                icon="pi pi-pencil"
                text
                rounded
                class="!text-[#a83632]"
                aria-label="Edit study group"
                @click="openEditDialog(data)"
              />
              <Button
                v-if="isChurchPastor"
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                aria-label="Delete study group"
                @click="deleteStudyGroup(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog
      v-model:visible="participantSummaryOpen"
      modal
      header="Study group participant summary"
      :style="{ width: 'min(96vw, 1120px)' }"
    >
      <div class="space-y-4">
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div class="grid gap-3 md:grid-cols-4">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">From</label>
              <InputText v-model="participantSummaryFilters.date_from" type="date" class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">To</label>
              <InputText v-model="participantSummaryFilters.date_to" type="date" class="w-full" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Type</label>
              <Select
                v-model="participantSummaryFilters.person_type"
                :options="[
                  { label: 'Workers and members', value: '' },
                  { label: 'Workers', value: 'worker' },
                  { label: 'Members', value: 'member' },
                ]"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Study groups held</label>
              <div class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-950">
                {{ participantSummaryInfo.heldStudyGroups || 0 }}
              </div>
            </div>
          </div>

          <div class="mt-3 grid gap-3 md:grid-cols-4">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Church</label>
              <Select
                v-model="participantSummaryFilters.church_id"
                :options="churchOptions"
                option-label="label"
                option-value="value"
                placeholder="Church"
                show-clear
                class="w-full"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Fellowship</label>
              <Select
                v-model="participantSummaryFilters.fellowship_id"
                :options="fellowshipOptions"
                option-label="label"
                option-value="value"
                placeholder="Fellowship"
                show-clear
                class="w-full"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Cell</label>
              <Select
                v-model="participantSummaryFilters.cell_id"
                :options="cellOptions"
                option-label="label"
                option-value="value"
                placeholder="Cell"
                show-clear
                class="w-full"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Material</label>
              <Select
                v-model="participantSummaryFilters.material_type"
                :options="materialOptions"
                option-label="label"
                option-value="value"
                placeholder="Material"
                show-clear
                class="w-full"
              />
            </div>
          </div>

          <div class="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Participation min</label>
              <InputNumber
                v-model="participantSummaryFilters.participation_min"
                :min="0"
                :max="participantSummaryInfo.heldStudyGroups || undefined"
                show-buttons
                class="w-full"
                input-class="w-full"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-semibold text-gray-900">Participation max</label>
              <InputNumber
                v-model="participantSummaryFilters.participation_max"
                :min="0"
                :max="participantSummaryInfo.heldStudyGroups || undefined"
                show-buttons
                class="w-full"
                input-class="w-full"
              />
            </div>
            <Button
              label="Reset"
              severity="secondary"
              outlined
              @click="clearParticipantSummaryFilters"
            />
            <Button
              label="Apply"
              icon="pi pi-filter"
              class="!border-[#a83632] !bg-[#a83632] !text-white"
              :loading="participantSummaryLoading"
              @click="applyParticipantSummaryFilters"
            />
          </div>
        </div>

        <div class="rounded-xl border border-[#a83632]/20 bg-[#a83632]/5 px-4 py-3 text-sm text-gray-700">
          Participation count is based on non-defaulted submissions in the selected range.
          Example: <strong>2/4</strong> means a person submitted 2 out of 4 study groups held.
        </div>

        <DataTable
          :value="participantSummaryRows"
          lazy
          paginator
          :first="participantSummaryFirst"
          :rows="participantSummaryRowsPerPage"
          :total-records="totalParticipantSummaryRecords"
          :rows-per-page-options="[10, 25, 50, 100]"
          scrollable
          scroll-height="520px"
          table-style="min-width: 1080px"
          class="text-sm"
          :loading="participantSummaryLoading"
          @page="onParticipantSummaryPage"
        >
          <Column field="name" header="Name" style="min-width: 220px" />
          <Column field="participationLabel" header="Participation" style="min-width: 140px">
            <template #body="{ data }">
              <span class="rounded-full bg-[#a83632]/10 px-3 py-1 text-sm font-semibold text-[#a83632]">
                {{ data.participationLabel }}
              </span>
            </template>
          </Column>
          <Column field="personType" header="Type" style="min-width: 110px">
            <template #body="{ data }">{{ displayValue(data.personType) }}</template>
          </Column>
          <Column field="defaultedCount" header="Defaulted" style="min-width: 110px" />
          <Column field="pendingCount" header="Pending" style="min-width: 100px" />
          <Column field="approvedCount" header="Approved" style="min-width: 100px" />
          <Column field="rejectedCount" header="Rejected" style="min-width: 100px" />
          <Column field="churchName" header="Church" style="min-width: 170px">
            <template #body="{ data }">{{ data.churchName || "-" }}</template>
          </Column>
          <Column field="fellowshipName" header="Fellowship" style="min-width: 180px">
            <template #body="{ data }">{{ data.fellowshipName || "-" }}</template>
          </Column>
          <Column field="cellName" header="Cell" style="min-width: 170px">
            <template #body="{ data }">{{ data.cellName || "-" }}</template>
          </Column>
        </DataTable>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="createOpen"
      modal
      :header="editingStudyGroup ? 'Edit study group' : 'New study group'"
      class="w-[92vw] max-w-xl"
    >
      <Message v-if="formError" severity="error" :closable="false">{{
        formError
      }}</Message>
      <div class="grid gap-4">
        <Select
          v-model="form.church_id"
          :options="churchOptions"
          option-label="label"
          option-value="value"
          placeholder="Select church"
          :disabled="churchOptions.length <= 1"
        />
        <InputText v-model="form.title" placeholder="Title" />
        <Select
          v-model="form.material_type"
          :options="materialOptions"
          option-label="label"
          option-value="value"
          placeholder="Material type"
        />
        <Textarea
          v-model="form.questions"
          rows="6"
          auto-resize
          placeholder="Assignment questions"
        />
        <InputText v-model="form.from_date" type="date" />
        <InputText v-model="form.to_date" type="date" />
      </div>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          outlined
          @click="createOpen = false"
        />
        <Button
          :label="editingStudyGroup ? 'Update' : 'Create'"
          :loading="saving"
          class="!border-[#a83632] !bg-[#a83632] !text-white"
          @click="createStudyGroup"
        />
      </template>
    </Dialog>
  </section>
</template>
