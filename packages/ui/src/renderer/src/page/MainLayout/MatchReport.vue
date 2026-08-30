<template>
  <div class="page-wrap flex flex-col of-hidden">
    <div v-loading="isTableLoading" class="flex-1 of-hidden">
      <div ref="tableContainerEl" class="h-100% of-hidden">
        <ElTable
          ref="tableRef"
          :max-height="tableMaxHeight"
          :data="tableData"
          row-key="id"
          size="small"
          table-layout="auto"
          highlight-current-row
        >
          <ElTableColumn label="岗位信息" min-width="200">
            <template #default="{ row }">
              <div class="job-info">
                <div class="job-name">{{ row.jobName || '未知职位' }}</div>
                <div class="job-salary">
                  {{ row.salaryLow && row.salaryHigh ? `${row.salaryLow}-${row.salaryHigh}K${row.salaryMonth ? `·${row.salaryMonth}薪` : ''}` : '薪资面议' }}
                </div>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="匹配分数" :width="120">
            <template #default="{ row }">
              <ElTag
                v-if="row.score !== null && row.score !== undefined"
                :type="getScoreTagType(row.score)"
                size="small"
              >
                {{ row.score }}
              </ElTag>
              <span v-else class="text-gray">评估失败</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="评估时间" :width="180">
            <template #default="{ row }">
              {{ formatDate(row.date) }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" fixed="right" :width="200">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                size="small"
                @click="handleViewReportButtonClick(row)"
                >查看报告</ElButton
              >
              <ElButton
                link
                type="primary"
                size="small"
                @click="handleViewJobOnlineButtonClick(row.encryptJobId)"
                >岗位链接</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </div>
    <div class="flex flex-0 flex-justify-between pt10px pb10px">
      <div class="w100px">
        <el-button
          :loading="isTableLoading"
          size="small"
          @click="getMatchReport"
          >刷新</el-button
        >
      </div>
      <ElPagination
        v-model:current-page="pagination.pageNo"
        v-model:page-size="pagination.pageSize"
        :page-sizes="pageSizeList"
        small
        :disabled="isTableLoading"
        layout="total, sizes, prev, pager, next, jumper"
        :total="pagination.totalItemCount"
        @size-change="getMatchReport"
        @current-change="getMatchReport"
      />
      <div class="w100px" />
    </div>
    <ElDrawer v-model="drawerVisible" size="500px">
      <div v-if="selectedReport" class="report-detail">
        <div class="report-score">
          <ElTag
            v-if="selectedReport.score !== null && selectedReport.score !== undefined"
            :type="getScoreTagType(selectedReport.score)"
            size="large"
          >
            匹配分数: {{ selectedReport.score }}
          </ElTag>
          <span v-else class="text-gray">评估失败</span>
        </div>
        <div v-if="hasSubScores" class="sub-scores">
          <div class="sub-score-item">
            <span class="sub-score-label">技能</span>
            <ElTag :type="getSubScoreTagType(selectedReport.skillScore)" size="small">{{ selectedReport.skillScore ?? '-' }}/20</ElTag>
          </div>
          <div class="sub-score-item">
            <span class="sub-score-label">经验</span>
            <ElTag :type="getSubScoreTagType(selectedReport.experienceScore)" size="small">{{ selectedReport.experienceScore ?? '-' }}/20</ElTag>
          </div>
          <div class="sub-score-item">
            <span class="sub-score-label">项目</span>
            <ElTag :type="getSubScoreTagType(selectedReport.projectScore)" size="small">{{ selectedReport.projectScore ?? '-' }}/20</ElTag>
          </div>
          <div class="sub-score-item">
            <span class="sub-score-label">薪资</span>
            <ElTag :type="getSubScoreTagType(selectedReport.salaryScore)" size="small">{{ selectedReport.salaryScore ?? '-' }}/20</ElTag>
          </div>
          <div class="sub-score-item">
            <span class="sub-score-label">发展</span>
            <ElTag :type="getSubScoreTagType(selectedReport.developmentScore)" size="small">{{ selectedReport.developmentScore ?? '-' }}/20</ElTag>
          </div>
        </div>
        <div class="report-text">
          <pre>{{ selectedReport.report || '无报告内容' }}</pre>
        </div>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElPagination, ElDrawer, ElTag } from 'element-plus'
import { PageReq, PagedRes } from '../../../../common/types/pagination'

interface MatchReportRow {
  id: number
  encryptJobId: string
  encryptCurrentUserId: string
  date: string
  score: number | null
  report: string | null
  jobSource: number | null
  autoStartupChatRecordId: number | null
  skillScore?: number | null
  experienceScore?: number | null
  projectScore?: number | null
  salaryScore?: number | null
  developmentScore?: number | null
  jobName?: string
  salaryLow?: number
  salaryHigh?: number
  salaryMonth?: number
}

const tableData = ref<MatchReportRow[]>([])
const pageSizeList = ref<number[]>([10, 20, 50, 100])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})
const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)

async function getMatchReport() {
  try {
    isTableLoading.value = true
    const { data: res } = (await electron.ipcRenderer.invoke('get-match-report', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })) as { data: PagedRes<MatchReportRow> }
    tableData.value = res.data
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
  } catch (err) {
    console.log(err)
    tableData.value = []
  } finally {
    tableRef.value?.setScrollTop(0)
    isTableLoading.value = false
  }
}

getMatchReport()

const tableMaxHeight = ref<number | undefined>(undefined)
const tableContainerEl = ref<HTMLElement>()
const setTableMaxHeight = () =>
  (tableMaxHeight.value = tableContainerEl.value?.clientHeight ?? undefined)
onMounted(() => {
  setTableMaxHeight()
  const ro = new ResizeObserver(() => setTableMaxHeight())
  ro.observe(tableContainerEl.value!)
  onBeforeUnmount(() => {
    ro.disconnect()
  })
})

const drawerVisible = ref(false)
const selectedReport = ref<MatchReportRow | null>(null)

function handleViewReportButtonClick(row: MatchReportRow) {
  selectedReport.value = row
  drawerVisible.value = true
}

async function handleViewJobOnlineButtonClick(encryptJobId: string) {
  return await electron.ipcRenderer.invoke('open-site-with-boss-cookie', {
    url: `https://www.zhipin.com/job_detail/${encryptJobId}.html`
  })
}

function getScoreTagType(score: number) {
  if (score >= 85) return 'success'
  if (score >= 60) return 'warning'
  return 'danger'
}

function getSubScoreTagType(score: number | null | undefined) {
  if (score === null || score === undefined) return 'info'
  if (score >= 16) return 'success'
  if (score >= 8) return 'warning'
  return 'danger'
}

const hasSubScores = computed(() => {
  if (!selectedReport.value) return false
  const r = selectedReport.value
  return r.skillScore !== null && r.skillScore !== undefined
    || r.experienceScore !== null && r.experienceScore !== undefined
    || r.projectScore !== null && r.projectScore !== undefined
    || r.salaryScore !== null && r.salaryScore !== undefined
    || r.developmentScore !== null && r.developmentScore !== undefined
})

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.page-wrap {
  margin: 0 auto;
  max-width: 1000px;
  max-height: 100vh;
  overflow: hidden;
  padding-left: 20px;
  padding-top: 20px;
  :deep(.el-drawer) {
    .el-drawer__header {
      padding: 16px 20px;
      margin-bottom: 0;
    }
    .el-drawer__body {
      padding: 0;
      margin: 0 0 20px 20px;
      padding-right: 20px;
    }
  }
}
.report-detail {
  .report-score {
    margin-bottom: 16px;
  }
  .sub-scores {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    .sub-score-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      .sub-score-label {
        font-size: 12px;
        color: #909399;
      }
    }
  }
  .report-text {
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 14px;
      line-height: 1.6;
    }
  }
}
.job-info {
  .job-name {
    font-weight: 500;
    color: #303133;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .job-salary {
    font-size: 12px;
    color: #909399;
  }
}
</style>
