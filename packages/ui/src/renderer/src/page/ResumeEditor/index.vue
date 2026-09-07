<template>
  <div class="resume-editor-page">
    <div class="main-wrapper">
      <main>
        <div class="mt1em mb1em flex flex-items-center flex-justify-between">
          <span>{{ viewMode === 'list' ? '简历管理' : '编辑简历' }}</span>
          <el-button v-if="viewMode === 'edit'" text type="primary" @click="backToList">← 返回列表</el-button>
        </div>
        <template v-if="viewMode === 'list'">
          <el-alert type="info" :closable="false" mb20px line-height-1.25em>
            <ul pl16px m0>
              <li>
                最多可保存 {{ MAX_RESUME_COUNT }} 份简历；AI 职位匹配会对所有有效简历分别评估并取最高分；「当前生效」仍用于生成已读不回提醒消息
              </li>
              <li>期望薪资仅作匹配职位使用，不会用作生成已读不回提醒消息</li>
              <li>
                可从 docx 简历导入：后台自动解析为结构化内容并打开校对，确认无误后保存为一份新简历
              </li>
            </ul>
          </el-alert>
          <div class="resume-toolbar">
            <span font-size-13px class="color-#606266">共 {{ resumeList.length }} / {{ MAX_RESUME_COUNT }} 份</span>
            <div>
              <el-button :disabled="resumeList.length >= MAX_RESUME_COUNT" :loading="isImporting" @click="handleImportDocx">
                从 docx 导入
              </el-button>
              <el-button
                type="primary"
                :disabled="resumeList.length >= MAX_RESUME_COUNT"
                :icon="Plus"
                @click="handleNewResume"
              >
                新建简历
              </el-button>
            </div>
          </div>
          <el-empty v-if="!resumeList.length" description="暂无简历，请新建或从 docx 导入" />
          <div v-else class="resume-card-list">
            <div v-for="item in resumeList" :key="item.id" class="resume-card">
              <div class="resume-card__main">
                <div class="flex flex-items-center" style="gap: 8px">
                  <span class="resume-card__title">{{ item.name || '未命名简历' }}</span>
                  <el-tag v-if="item.active" type="success" size="small">当前生效</el-tag>
                  <el-tag v-else type="info" size="small" effect="plain">未生效</el-tag>
                </div>
                <div class="resume-card__sub">
                  期望职位：{{ item.expectJob || '-' }}
                  <template v-if="item.updateTime">｜ 更新于 {{ formatUpdateTime(item.updateTime) }}</template>
                </div>
              </div>
              <div class="resume-card__ops">
                <el-button
                  v-if="!item.active"
                  size="small"
                  text
                  type="primary"
                  @click="handleSetActive(item)"
                >
                  设为当前生效
                </el-button>
                <el-button size="small" text type="primary" @click="handleEdit(item)">编辑</el-button>
                <el-button
                  size="small"
                  text
                  type="danger"
                  :disabled="resumeList.length <= 1"
                  @click="handleDelete(item)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <el-alert type="info" :closable="false" mb20px line-height-1.25em>
            <ul pl16px m0>
              <li>
                此简历会参与 AI 职位匹配（多份有效简历分别评估，取最高分）；「当前生效」简历还会用于生成已读不回提醒消息。大部分信息非必填，但内容不足时可能匹配不准或生成不符合预期的提醒
              </li>
              <li>期望薪资仅作匹配职位使用，不会用作生成已读不回提醒消息</li>
              <li v-if="!editingId" font-size-12px>
                <span style="color: #e6a23c">
                  {{ isImportDraft ? 'docx 已解析完成：docx 中不包含期望薪资/工作年限（如未识别请补充）；解析误差可在此直接修改' : '当前为新建简历' }}
                </span>
              </li>
            </ul>
          </el-alert>
          <el-form
            ref="formRef"
            :model="formContentForElForm"
            :rules="formRulesForElForm"
            label-position="top"
            class="resume-editor-form"
            :validate-on-rule-change="false"
          >
            <div
              :style="{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px'
              }"
            >
              <el-form-item label="姓名">
                <el-input v-model="formContent.name" font-size-12px></el-input>
              </el-form-item>
              <el-form-item label="工作年限">
                <el-input v-model="formContent.workYearDesc" font-size-12px></el-input>
              </el-form-item>
              <el-form-item label="期望职位">
                <el-input v-model="formContent.expectJob" font-size-12px></el-input>
              </el-form-item>
              <el-form-item label="期望薪资（k）">
                <div
                  :style="{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr'
                  }"
                >
                  <el-input v-model="formContent.expectSalary[0]" placeholder="下限" />
                  <el-input v-model="formContent.expectSalary[1]" placeholder="上限" />
                </div>
              </el-form-item>
            </div>

            <el-form-item label="个人优势">
              <el-input
                v-model="formContent.userDescription"
                type="textarea"
                :autosize="{
                  minRows: 6,
                  maxRows: 8
                }"
                font-size-12px
              ></el-input>
            </el-form-item>
            <el-form-item>
              <div class="el-form-item__label">
                工作经历
                <el-button size="small" :icon="Plus" @click="addWorkExp">新增一条</el-button>
              </div>
              <div v-for="(exp, index) in formContent.geekWorkExpList" :key="index">
                <div
                  :style="{
                    display: 'flex',
                    gap: '12px'
                  }"
                >
                  <div
                    :style="{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      height: 'fit-content',
                      marginTop: '10px'
                    }"
                  >
                    <el-button
                      :disabled="index <= 0"
                      style="margin: 0"
                      circle
                      size="small"
                      :icon="ArrowUp"
                      @click="moveWorkExpUp(index)"
                    />
                    <el-button
                      :disabled="index >= formContent.geekWorkExpList.length - 1"
                      style="margin: 0"
                      circle
                      size="small"
                      :icon="ArrowDown"
                      @click="moveWorkExpDown(index)"
                    />
                    <el-button
                      :disabled="1 >= formContent.geekWorkExpList.length"
                      style="margin: 0"
                      circle
                      size="small"
                      :icon="Delete"
                      @click="removeWorkExp(index)"
                    />
                  </div>
                  <div>
                    <div
                      :style="{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.25fr 1fr',
                        gap: '10px',
                        width: '100%'
                      }"
                    >
                      <el-form-item
                        label="公司名称"
                        style="margin-bottom: 18px"
                        :prop="`geekWorkExpList_${index}_company`"
                      >
                        <el-input v-model="exp.company" />
                      </el-form-item>
                      <el-form-item label="任职时间" style="margin-bottom: 18px">
                        <div
                          :style="{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr'
                          }"
                        >
                          <el-date-picker
                            v-model="exp.startYearMon"
                            :style="{ '--el-date-editor-width': 'auto' }"
                            type="month"
                            placeholder="开始月份"
                          />
                          <el-date-picker
                            v-model="exp.endYearMon"
                            :style="{ '--el-date-editor-width': 'auto' }"
                            type="month"
                            placeholder="结束月份"
                          />
                        </div>
                      </el-form-item>
                      <el-form-item label="职务" style="margin-bottom: 18px">
                        <el-input v-model="exp.positionName" />
                      </el-form-item>
                    </div>
                    <el-form-item label="工作描述" style="margin-bottom: 18px">
                      <el-input
                        v-model="exp.workDescription"
                        type="textarea"
                        :autosize="{
                          minRows: 6,
                          maxRows: 8
                        }"
                        font-size-12px
                      />
                    </el-form-item>
                    <el-form-item label="工作业绩">
                      <el-input
                        v-model="exp.performance"
                        type="textarea"
                        :autosize="{
                          minRows: 6,
                          maxRows: 8
                        }"
                        font-size-12px
                      />
                    </el-form-item>
                    <div
                      v-if="index !== formContent.geekWorkExpList.length - 1"
                      class="mt20px mb20px h1px"
                      style="background-color: #dcdcdc"
                    />
                  </div>
                </div>
              </div>
            </el-form-item>
            <el-form-item>
              <div class="el-form-item__label">
                项目经历
                <el-button size="small" :icon="Plus" @click="addProjExp">新增一条</el-button>
              </div>
              <div v-for="(proj, index) in formContent.geekProjExpList" :key="index">
                <div
                  :style="{
                    display: 'flex',
                    gap: '12px'
                  }"
                >
                  <div
                    :style="{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      height: 'fit-content',
                      marginTop: '10px'
                    }"
                  >
                    <el-button
                      :disabled="index <= 0"
                      style="margin: 0"
                      circle
                      size="small"
                      :icon="ArrowUp"
                      @click="moveProjExpUp(index)"
                    />
                    <el-button
                      :disabled="index >= formContent.geekProjExpList.length - 1"
                      style="margin: 0"
                      circle
                      size="small"
                      :icon="ArrowDown"
                      @click="moveProjExpDown(index)"
                    />
                    <el-button
                      :disabled="1 >= formContent.geekProjExpList.length"
                      style="margin: 0"
                      circle
                      size="small"
                      :icon="Delete"
                      @click="removeProjExp(index)"
                    />
                  </div>
                  <div>
                    <div
                      :style="{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1.25fr',
                        gap: '10px',
                        width: '100%'
                      }"
                    >
                      <el-form-item
                        label="项目名称"
                        style="margin-bottom: 18px"
                        :prop="`geekProjExpList_${index}_name`"
                      >
                        <el-input v-model="proj.name" />
                      </el-form-item>
                      <el-form-item label="项目角色" style="margin-bottom: 18px">
                        <el-input v-model="proj.roleName" />
                      </el-form-item>
                      <el-form-item label="项目时间" style="margin-bottom: 18px">
                        <div
                          :style="{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr'
                          }"
                        >
                          <el-date-picker
                            v-model="proj.startYearMon"
                            :style="{ '--el-date-editor-width': 'auto' }"
                            type="month"
                            placeholder="开始月份"
                          />
                          <el-date-picker
                            v-model="proj.endYearMon"
                            :style="{ '--el-date-editor-width": 'auto' }"
                            type="month"
                            placeholder="结束月份"
                          />
                        </div>
                      </el-form-item>
                    </div>
                    <el-form-item label="项目描述" style="margin-bottom: 18px">
                      <el-input
                        v-model="proj.projectDescription"
                        type="textarea"
                        :autosize="{
                          minRows: 6,
                          maxRows: 8
                        }"
                        font-size-12px
                      />
                    </el-form-item>
                    <el-form-item label="项目业绩">
                      <el-input
                        v-model="proj.performance"
                        type="textarea"
                        :autosize="{
                          minRows: 6,
                          maxRows: 8
                        }"
                        font-size-12px
                      />
                    </el-form-item>
                    <div
                      v-if="index !== formContent.geekProjExpList.length - 1"
                      class="mt20px mb20px h1px"
                      style="background-color: #dcdcdc"
                    />
                  </div>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </template>
      </main>
    </div>
    <footer pt10px pb10px flex flex-justify-center>
      <div w768px flex flex-justify-end>
        <el-button v-if="viewMode === 'list'" @click="handleCloseWindow">关闭</el-button>
        <template v-else>
          <el-button @click="backToList">返回列表</el-button>
          <el-button type="primary" @click="handleSubmit">保存</el-button>
        </template>
      </div>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { ElForm, ElMessage, ElMessageBox } from 'element-plus'
import { ref, onMounted, computed } from 'vue'
import { ArrowUp, ArrowDown, Delete, Plus } from '@element-plus/icons-vue'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { type ResumeContent, resumeContentEnoughDetect } from '../../../../common/utils/resume'

interface ResumeMeta {
  id: string
  name: string
  active: boolean
  updateTime: number | null
  expectJob: string
}

const MAX_RESUME_COUNT = 3

const formRef = ref<InstanceType<typeof ElForm>>()

const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'resume-editor',
    ...params
  })
}

const resumeList = ref<ResumeMeta[]>([])
const viewMode = ref<'list' | 'edit'>('list')
const editingId = ref<string | null>(null)
const isImportDraft = ref(false)
const isImporting = ref(false)

const getEmptyFormContent = () => {
  const o: any = {
    expectJob: '',
    name: '',
    userDescription: '',
    workYearDesc: '',
    expectSalary: ['', ''],
    geekWorkExpList: [],
    geekProjExpList: []
  }
  o.geekProjExpList = [getNewProjExpItem()]
  o.geekWorkExpList = [getNewWorkExpItem()]

  return o as ResumeContent
}
const formContent = ref<ResumeContent>(getEmptyFormContent())

// 统一时间落盘格式 YYYY-MM（el-date-picker 未配 value-format 时可能产出 Date/ISO 串）
const toYearMonStr = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{1,2})/)
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
    return value
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const m = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
    return m
  }
  return String(value)
}
const normalizeYearMonOfContent = (content: ResumeContent) => {
  content.geekWorkExpList?.forEach((it) => {
    it.startYearMon = toYearMonStr(it.startYearMon) || null
    it.endYearMon = toYearMonStr(it.endYearMon) || null
  })
  content.geekProjExpList?.forEach((it) => {
    it.startYearMon = toYearMonStr(it.startYearMon)
    it.endYearMon = toYearMonStr(it.endYearMon)
  })
}

const mergeResumeContent = (savedFileContent: any) => {
  if (!savedFileContent) return
  for (const k of Object.keys(formContent.value)) {
    if (Object.hasOwn(savedFileContent, k)) {
      formContent.value[k] = savedFileContent[k]
    }
  }
  if (!formContent.value.expectSalary) {
    formContent.value.expectSalary = ['', '']
  }
  if (!formContent.value.expectSalary?.[0] || /\D/.test(formContent.value.expectSalary?.[0])) {
    formContent.value.expectSalary[0] = ''
  }
  if (!formContent.value.expectSalary?.[1] || /\D/.test(formContent.value.expectSalary?.[1])) {
    formContent.value.expectSalary[1] = ''
  }
  if (!formContent.value.geekProjExpList?.length) {
    formContent.value.geekProjExpList = [getNewProjExpItem()]
  }
  if (!formContent.value.geekWorkExpList?.length) {
    formContent.value.geekWorkExpList = [getNewWorkExpItem()]
  }
  normalizeYearMonOfContent(formContent.value)
}

const translateResumeError = (err: any) => {
  const msg = err?.message ?? String(err)
  const map = {
    MAX_RESUME_COUNT_EXCEEDED: `最多只能保存 ${MAX_RESUME_COUNT} 份简历，请先删除不再需要的简历`,
    RESUME_NOT_FOUND: '未找到该简历，列表可能已被刷新',
    AT_LEAST_ONE_RESUME: '至少需要保留 1 份简历，不能删除最后一份',
    INVALID_RESUME_CONTENT: '简历内容无效，无法保存',
    NOT_A_DOCX_FILE: '请选择 .docx 格式的简历文件',
    RESUME_NOT_CONFIGURED: '简历未配置'
  }
  for (const [key, text] of Object.entries(map)) {
    if (msg.includes(key)) return text
  }
  return msg
}

const loadResumeList = async () => {
  try {
    resumeList.value = (await electron.ipcRenderer.invoke('list-resumes')) ?? []
  } catch (err) {
    console.log(err)
  }
}

const backToList = () => {
  viewMode.value = 'list'
  editingId.value = null
  isImportDraft.value = false
}

const enterEditView = async (target: { id: string | null; content?: ResumeContent }) => {
  viewMode.value = 'edit'
  editingId.value = target.id
  formContent.value = getEmptyFormContent()
  if (target.id) {
    try {
      const savedFileContent = await electron.ipcRenderer.invoke('fetch-resume-content', {
        id: target.id
      })
      mergeResumeContent(savedFileContent)
    } catch (err) {
      formContent.value = getEmptyFormContent()
      console.log(err)
    }
  } else if (target.content) {
    mergeResumeContent(JSON.parse(JSON.stringify(target.content)))
  }
}

const handleNewResume = () => {
  gtagRenderer('resume_new_clicked')
  isImportDraft.value = false
  enterEditView({ id: null })
}

const handleEdit = async (item: ResumeMeta) => {
  gtagRenderer('resume_edit_clicked')
  isImportDraft.value = false
  await enterEditView({ id: item.id })
}

const handleImportDocx = async () => {
  try {
    const chooseResult = await electron.ipcRenderer.invoke('choose-file', {
      fileChooserConfig: {
        properties: ['openFile'],
        filters: [
          {
            name: 'Word 简历 (.docx)',
            extensions: ['docx']
          }
        ]
      }
    })
    const filePath = chooseResult?.filePaths?.[0]
    if (!filePath) return
    gtagRenderer('resume_docx_import_started')
    isImporting.value = true
    const parsed = await electron.ipcRenderer.invoke('parse-resume-docx', { filePath })
    isImporting.value = false
    if (!parsed?.content) {
      throw new Error('PARSE_EMPTY')
    }
    const hasContent =
      parsed.content.geekWorkExpList?.some((it: any) => it.company?.trim()) ||
      parsed.content.geekProjExpList?.some((it: any) => it.name?.trim()) ||
      parsed.content.userDescription?.trim()
    if (!hasContent) {
      await ElMessageBox.alert(
        `未能从该 docx 中解析出可用的简历结构。\n请确认文件为标准简历版式（含「工作经历/项目经历」等分区标题）。`,
        '解析结果为空',
        { confirmButtonText: '好的' }
      )
      return
    }
    isImportDraft.value = true
    await enterEditView({ id: null, content: parsed.content })
    ElMessage({
      type: 'success',
      message: `docx 解析完成，请核对内容后保存（期望职位：${parsed.expectJob || '未识别，请补充'}）`
    })
    gtagRenderer('resume_docx_import_parsed')
  } catch (err) {
    isImporting.value = false
    console.log(err)
    const message = translateResumeError(err)
    ElMessageBox.alert(`docx 解析失败：${message}`, '导入失败', {
      confirmButtonText: '好的'
    })
    gtagRenderer('resume_docx_import_failed')
  }
}

const handleSetActive = async (item: ResumeMeta) => {
  try {
    const metaList = await electron.ipcRenderer.invoke('set-active-resume', { id: item.id })
    resumeList.value = metaList ?? resumeList.value
    ElMessage({ type: 'success', message: `已切换「${item.name || item.expectJob || '未命名简历'}」为当前生效` })
    gtagRenderer('resume_set_active_done')
  } catch (err) {
    console.log(err)
    ElMessage({ type: 'error', message: translateResumeError(err) })
  }
}

const handleDelete = async (item: ResumeMeta) => {
  if (resumeList.value.length <= 1) return
  try {
    await ElMessageBox.confirm(
      `确认删除「${item.name || item.expectJob || '未命名简历'}」？删除后不可恢复。<br />${
        item.active ? '删除当前生效简历后，将自动切换生效到剩余第一份。' : ''
      }`,
      '删除简历',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: true
      }
    )
  } catch {
    return
  }
  try {
    const metaList = await electron.ipcRenderer.invoke('delete-resume', { id: item.id })
    resumeList.value = metaList ?? resumeList.value.filter((it) => it.id !== item.id)
    ElMessage({ type: 'success', message: '已删除' })
    gtagRenderer('resume_deleted')
  } catch (err) {
    console.log(err)
    ElMessage({ type: 'error', message: translateResumeError(err) })
  }
}

const handleCloseWindow = () => {
  gtagRenderer('close_clicked')
  electron.ipcRenderer.send('close-resume-editor')
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  gtagRenderer('submit_clicked')
  if (
    !resumeContentEnoughDetect({
      content: formContent.value
    })
  ) {
    try {
      gtagRenderer('rc_not_enough_dialog_show')
      await ElMessageBox.confirm(
        `简历内容可能不够充足（各个部分内容长度相加 <800 字）<br />后续大模型根据简历生成的内容将可能不符合预期（例如相同内容重复生成、生成预期之外的内容）<br /><br />要继续保存吗？`,
        {
          cancelButtonText: '不，我再改改',
          confirmButtonText: '是的，继续保存',
          dangerouslyUseHTMLString: true
        }
      )
    } catch {
      return
    }
  }
  const contentToSave = JSON.parse(JSON.stringify(formContent.value))
  normalizeYearMonOfContent(contentToSave)
  try {
    const metaList = await electron.ipcRenderer.invoke('save-resume-content', {
      id: editingId.value ?? undefined,
      content: contentToSave
    })
    resumeList.value = metaList ?? resumeList.value
    ElMessage({ type: 'success', message: editingId.value ? '简历已更新' : '新简历已保存并设为当前生效' })
    backToList()
    gtagRenderer('submit_done')
  } catch (err) {
    console.log(err)
    ElMessage({ type: 'error', message: translateResumeError(err) })
  }
}

const formatUpdateTime = (updateTime: number | null) => {
  if (!updateTime) return '-'
  return new Date(updateTime).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formContentForElForm = computed(() => {
  const valueMap = {}
  formContent.value.geekWorkExpList?.forEach((item, i) => {
    valueMap[`geekWorkExpList_${i}_company`] = item.company
  })
  formContent.value.geekProjExpList?.forEach((item, i) => {
    valueMap[`geekProjExpList_${i}_name`] = item.name
  })
  return valueMap
})
const formRulesForElForm = computed(() => {
  const valueMap = {}
  formContent.value.geekWorkExpList.forEach((_, i) => {
    valueMap[`geekWorkExpList_${i}_company`] = [
      {
        required: true,
        message: '请输入公司名称'
      },
      {
        trigger: 'blur',
        validator(_, value, cb) {
          if (!value.trim()) {
            cb(`请输入公司名称`)
          } else {
            cb()
          }
        }
      }
    ]
  })
  formContent.value.geekProjExpList.forEach((_, i) => {
    valueMap[`geekProjExpList_${i}_name`] = [
      {
        required: true,
        message: '请输入项目名称'
      },
      {
        trigger: 'blur',
        validator(_, value, cb) {
          if (!value.trim()) {
            cb(`请输入项目名称`)
          } else {
            cb()
          }
        }
      }
    ]
  })
  return valueMap
})

onMounted(() => {
  loadResumeList()
  gtagRenderer('resume_editor_mounted')
})

// #region edit work exp list
function getNewWorkExpItem() {
  return {
    company: '',
    endYearMon: '',
    positionName: '',
    startYearMon: '',
    performance: '',
    workDescription: ''
  }
}
function addWorkExp() {
  formContent.value.geekWorkExpList.push(getNewWorkExpItem())
  gtagRenderer('resume_work_exp_added')
}
function moveWorkExpUp(index) {
  ;[formContent.value.geekWorkExpList[index], formContent.value.geekWorkExpList[index - 1]] = [
    formContent.value.geekWorkExpList[index - 1],
    formContent.value.geekWorkExpList[index]
  ]
  gtagRenderer('resume_work_exp_moved_up')
}

function moveWorkExpDown(index) {
  ;[formContent.value.geekWorkExpList[index], formContent.value.geekWorkExpList[index + 1]] = [
    formContent.value.geekWorkExpList[index + 1],
    formContent.value.geekWorkExpList[index]
  ]
  gtagRenderer('resume_work_exp_moved_down')
}

function removeWorkExp(index) {
  formContent.value.geekWorkExpList.splice(index, 1)
  gtagRenderer('resume_work_exp_removed')
}
// #endregion

// #region edit proj list
function getNewProjExpItem() {
  return {
    name: '',
    endYearMon: '',
    roleName: '',
    startYearMon: '',
    performance: '',
    projectDescription: ''
  }
}
function addProjExp() {
  formContent.value.geekProjExpList.push(getNewProjExpItem())
  gtagRenderer('resume_proj_exp_added')
}
function moveProjExpUp(index) {
  ;[formContent.value.geekProjExpList[index], formContent.value.geekProjExpList[index - 1]] = [
    formContent.value.geekProjExpList[index - 1],
    formContent.value.geekProjExpList[index]
  ]
  gtagRenderer('resume_proj_exp_moved_up')
}

function moveProjExpDown(index) {
  ;[formContent.value.geekProjExpList[index], formContent.value.geekProjExpList[index + 1]] = [
    formContent.value.geekProjExpList[index + 1],
    formContent.value.geekProjExpList[index]
  ]
  gtagRenderer('resume_proj_exp_moved_down')
}

function removeProjExp(index) {
  formContent.value.geekProjExpList.splice(index, 1)
  gtagRenderer('resume_proj_exp_removed')
}
// #endregion
</script>

<style lang="scss" scoped>
.resume-editor-page {
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100vh;
  .main-wrapper {
    overflow: auto;
    main {
      margin: 0 auto;
      max-width: 768px;
    }
  }
  footer {
    background-color: #f0f0f0;
  }
  .resume-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 16px 0 12px;
  }
  .resume-card-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    .resume-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid #e4e7ed;
      border-radius: 6px;
      padding: 12px 14px;
      &__main {
        min-width: 0;
      }
      &__title {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
      }
      &__sub {
        margin-top: 6px;
        font-size: 12px;
        color: #909399;
      }
      &__ops {
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }
    }
  }
}
</style>

<style lang="scss">
.resume-editor-form.el-form {
  .el-form-item__error--inline {
    margin-left: 0;
    margin-top: 10px;
  }
}
</style>
