import { completes } from '@geekgeekrun/utils/gpt-request.mjs'
import { formatResumeJsonToMarkdown, checkIsResumeContentValid } from '@geekgeekrun/utils/resume.mjs'
import { readConfigFile, readStorageFile, writeStorageFile } from './runtime-file-utils.mjs'

const RESUME_PLACEHOLDER = `__REPLACE_REAL_RESUME_HERE__`
const JOB_INFO_PLACEHOLDER = `__REPLACE_JOB_INFO_HERE__`
const SINGLE_ITEM_DEFAULT_SERVE_WEIGHT = 1

let cachedResumeMarkdown = null
let cachedResumeKey = null

const defaultTemplateContent = `你是资深猎头。根据候选人简历和职位信息评估匹配度。

## 简历
__REPLACE_REAL_RESUME_HERE__

## 职位
__REPLACE_JOB_INFO_HERE__

从技能、经验、项目、薪资、方向五个维度分析，输出JSON：
{"score":0-100整数,"report":"200字内中文分析"}`

const pickLlmConfigFromList = (llmConfigList, blockModelSet) => {
  if (llmConfigList.length === 1) {
    llmConfigList[0].enabled = true
    llmConfigList[0].serveWeight = SINGLE_ITEM_DEFAULT_SERVE_WEIGHT
  }
  llmConfigList = llmConfigList.filter((it) => it.enabled && !blockModelSet.has(it.id))
  if (!llmConfigList.length) {
    return null
  }
  llmConfigList.forEach((conf) => {
    if (!Number(conf.serveWeight) || conf.serveWeight < 1) {
      conf.serveWeight = 1
    }
    if (conf.serveWeight > 100) {
      conf.serveWeight = 100
    }
  })
  const pool = []
  for (let i = 0; i < llmConfigList.length; i++) {
    for (let j = 0; j < Math.floor(llmConfigList[i].serveWeight); j++) {
      pool.push(llmConfigList[i].id)
    }
  }
  if (!pool.length) {
    return null
  }
  const index = Math.floor(pool.length * Math.random())
  return llmConfigList.find((it) => it.id === pool[index]) ?? null
}

const NOISE_SECTION_PATTERNS = [
  /^[一二三四五六七八九十][、.]\s*(公司介绍|公司简介|企业介绍|关于我们|公司概况)/,
  /^[一二三四五六七八九十][、.]\s*(企业文化|价值观|使命|愿景)/,
  /^[一二三四五六七八九十][、.]\s*(福利待遇|福利|待遇|薪酬福利)/,
  /^[一二三四五六七八九十][、.]\s*(加分项|优先项|优先条件)/,
  /^(公司介绍|企业介绍|关于我们|公司简介)/,
  /^(企业文化|我们的使命|我们的愿景|我们的价值观)/,
  /^(福利待遇|福利|待遇)/,
  /^(加分项|优先项)/,
]

const NOISE_LINE_PATTERNS = [
  /五险一金/,
  /年终奖|年底双薪|十三薪|十四薪/,
  /带薪年假|带薪休假|年假/,
  /周末双休|大小周|弹性工作|弹性打卡|不打卡/,
  /免费.{0,4}(午餐|晚餐|班车|体检|零食|下午茶)/,
  /节日.{0,4}(福利|礼物|礼品)/,
  /团建|下午茶|生日会|员工旅游|年度旅游/,
  /期权|股票|股权激励/,
  /晋升|调薪|涨薪|年度调薪/,
  /加班.{0,4}(补贴|补助|费)/,
  /补充医疗|商业保险|意外险/,
  /餐补|交通补贴|住房补贴|通讯补贴|租房补贴/,
  /扁平管理|导师带|大牛|技术氛围/,
  /六险一金|公积金/,
  /超长|春节假|带薪病假|婚假|产假|陪产假|育儿假/,
]

function cleanPostDescription(raw) {
  if (!raw) return ''
  const lines = raw.replace(/\r/g, '').split('\n')
  const kept = []
  let skipping = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (skipping) continue
      kept.push('')
      continue
    }
    if (NOISE_SECTION_PATTERNS.some((p) => p.test(trimmed))) {
      skipping = true
      continue
    }
    if (NOISE_LINE_PATTERNS.some((p) => p.test(trimmed))) {
      continue
    }
    skipping = false
    kept.push(line)
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const formatJobInfoToMarkdown = (targetJobData) => {
  const { jobInfo, bossInfo, brandComInfo } = targetJobData
  const sections = []

  sections.push([
    '# 职位基本信息',
    `职位名称: ${jobInfo.jobName}`,
    `职位分类: ${jobInfo.positionName}`,
    `薪资: ${jobInfo.salaryDesc}`,
    `经验要求: ${jobInfo.experienceName}`,
    `学历要求: ${jobInfo.degreeName ?? '不限'}`,
    `工作地点: ${jobInfo.address ?? '未填写'}`,
    `职位描述:\n${cleanPostDescription(jobInfo.postDescription)}`,
    jobInfo.showSkills?.length ? `技能标签: ${jobInfo.showSkills.join('、')}` : null
  ].filter(Boolean).join('\n'))

  sections.push([
    '# 公司信息',
    `公司名称: ${brandComInfo.brandName}`,
    `所属行业: ${brandComInfo.industryName ?? '未知'}`,
    `融资阶段: ${brandComInfo.stageName ?? '未知'}`,
    `公司规模: ${brandComInfo.scaleName ?? '未知'}`
  ].join('\n'))

  sections.push([
    '# 招聘者信息',
    `招聘者: ${bossInfo.name}`,
    `身份: ${bossInfo.title ?? '未知'}`,
    `活跃度: ${bossInfo.activeTimeDesc || '未知'}`
  ].join('\n'))

  return sections.join('\n\n')
}

const getValidTemplate = async () => {
  let template = await readStorageFile('match-report-template.md', { isJson: false })
  if (!template) {
    await writeStorageFile('match-report-template.md', defaultTemplateContent, { isJson: false })
    template = defaultTemplateContent
  }
  if (!template.includes(RESUME_PLACEHOLDER) || !template.includes(JOB_INFO_PLACEHOLDER)) {
    throw new Error(`match-report-template.md 缺少占位符。需要 ${RESUME_PLACEHOLDER} 和 ${JOB_INFO_PLACEHOLDER}`)
  }
  return template
}

export const evaluateJobMatch = async (targetJobData) => {
  const resumeObject = (await readConfigFile('resumes.json'))?.[0]
  if (!resumeObject || !checkIsResumeContentValid(resumeObject)) {
    throw new Error('RESUME_NOT_CONFIGURED')
  }
  const resumeCacheKey = JSON.stringify(resumeObject)
  if (resumeCacheKey !== cachedResumeKey) {
    cachedResumeMarkdown = formatResumeJsonToMarkdown(resumeObject)
    cachedResumeKey = resumeCacheKey
  }
  const resumeMarkdown = cachedResumeMarkdown

  const llmConfigList = await readConfigFile('llm.json')
  if (!Array.isArray(llmConfigList) || !llmConfigList.length) {
    throw new Error('LLM_CONFIG_NOT_FOUND')
  }

  const template = await getValidTemplate()
  const jobMarkdown = formatJobInfoToMarkdown(targetJobData)

  const messages = [
    {
      role: 'system',
      content: template
        .replace(RESUME_PLACEHOLDER, resumeMarkdown)
        .replace(JOB_INFO_PLACEHOLDER, jobMarkdown)
    }
  ]

  const blockModelSet = new Set()
  let res = null
  let llmConfig = null

  while (!res) {
    llmConfig = pickLlmConfigFromList(llmConfigList, blockModelSet)
    if (!llmConfig) {
      console.log('AI match: all models exhausted, returning null')
      return null
    }
    console.log(`AI match: using model ${llmConfig.model} at ${llmConfig.providerCompleteApiUrl}`)
    const callStartTime = Date.now()
    try {
      const completion = await completes(
        {
          baseURL: llmConfig.providerCompleteApiUrl,
          apiKey: llmConfig.providerApiSecret,
          model: llmConfig.model
        },
        messages,
        { max_tokens: 1200, temperature: 0, response_format: { type: "json_object" } }
      )
      res = completion?.choices?.[0] ?? null
      console.log(`AI match: model ${llmConfig.model} responded in ${Date.now() - callStartTime}ms`)
    } catch (err) {
      console.log(`AI match: model ${llmConfig.model} failed after ${Date.now() - callStartTime}ms`, err?.message ?? err)
      blockModelSet.add(llmConfig.id)
    }
  }

  const rawContent = res?.message?.content ?? ''
  let parsed
  try {
    const cleaned = rawContent
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/```\s*$/m, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.log('AI match: failed to parse LLM response as JSON', rawContent)
    return null
  }

  const score = Number(parsed.score)
  const report = parsed.report ?? ''
  if (isNaN(score) || score < 0 || score > 100) {
    console.log('AI match: score is invalid', parsed.score)
    return null
  }

  return { score: Math.round(score), report }
}
