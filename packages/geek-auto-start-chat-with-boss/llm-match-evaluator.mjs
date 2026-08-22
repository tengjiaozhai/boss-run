import { completes } from '@geekgeekrun/utils/gpt-request.mjs'
import { formatResumeJsonToMarkdown, checkIsResumeContentValid } from '@geekgeekrun/utils/resume.mjs'
import { readConfigFile, readStorageFile, writeStorageFile } from './runtime-file-utils.mjs'

const RESUME_PLACEHOLDER = `__REPLACE_REAL_RESUME_HERE__`
const JOB_INFO_PLACEHOLDER = `__REPLACE_JOB_INFO_HERE__`
const SINGLE_ITEM_DEFAULT_SERVE_WEIGHT = 1

const defaultTemplateContent = `你是一位资深猎头顾问。请根据候选人的简历和职位信息，评估匹配度。

## 候选人简历

__REPLACE_REAL_RESUME_HERE__

## 职位信息

__REPLACE_JOB_INFO_HERE__

## 评估维度

请从以下维度逐项分析：
1. 技能匹配度：职位要求 vs 简历技能栈
2. 经验匹配度：工作年限、行业背景
3. 项目匹配度：相关项目经验
4. 薪资匹配度：期望薪资 vs 职位薪资
5. 发展匹配度：职业方向一致性

## 输出格式

严格以 JSON 格式响应，不要包含其他内容：
{"score": 0到100的整数, "report": "200字以内的中文分析"}
`

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
    `职位描述:\n${jobInfo.postDescription}`,
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
  const resumeMarkdown = formatResumeJsonToMarkdown(resumeObject)

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
    try {
      const completion = await completes(
        {
          baseURL: llmConfig.providerCompleteApiUrl,
          apiKey: llmConfig.providerApiSecret,
          model: llmConfig.model
        },
        messages,
        { max_tokens: 1200, temperature: 0.3 }
      )
      res = completion?.choices?.[0] ?? null
    } catch (err) {
      console.log(`AI match: model ${llmConfig.model} failed`, err?.message ?? err)
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
