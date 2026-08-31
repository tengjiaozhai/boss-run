import { completes } from '@geekgeekrun/utils/gpt-request.mjs'
import { formatResumeJsonToMarkdown, checkIsResumeContentValid } from '@geekgeekrun/utils/resume.mjs'
import { readConfigFile, readStorageFile, writeStorageFile } from './runtime-file-utils.mjs'

const RESUME_PLACEHOLDER = `__REPLACE_REAL_RESUME_HERE__`
const JOB_INFO_PLACEHOLDER = `__REPLACE_JOB_INFO_HERE__`
const SINGLE_ITEM_DEFAULT_SERVE_WEIGHT = 1

let cachedResumeMarkdown = null
let cachedResumeKey = null

const defaultTemplateContent = `你是一位求职顾问。请根据候选人的简历和目标职位，生成一句简短、真诚、有针对性的打招呼语。

## 候选人简历
__REPLACE_REAL_RESUME_HERE__

## 目标职位
__REPLACE_JOB_INFO_HERE__

## 要求
1. 50字以内，简洁自然，不要套话
2. 提及1个与该职位最相关的个人技能或项目亮点
3. 表达对该岗位的具体兴趣（可提及职位方向）
4. 语气谦逊礼貌，避免感叹号
5. 不要复制简历原文，要提炼总结

## 输出格式
严格以 JSON 格式响应，不要包含其他内容：
{"response": "这里是打招呼语内容"}`

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

  return sections.join('\n\n')
}

const getValidTemplate = async () => {
  let template = await readStorageFile('greeting-message-template.md', { isJson: false })
  if (!template) {
    await writeStorageFile('greeting-message-template.md', defaultTemplateContent, { isJson: false })
    template = defaultTemplateContent
  }
  if (!template.includes(RESUME_PLACEHOLDER) || !template.includes(JOB_INFO_PLACEHOLDER)) {
    throw new Error(`greeting-message-template.md 缺少占位符。需要 ${RESUME_PLACEHOLDER} 和 ${JOB_INFO_PLACEHOLDER}`)
  }
  return template
}

export const generateGreetingMessage = async (targetJobData) => {
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
      console.log('Greeting: all models exhausted, returning null')
      return null
    }
    console.log(`Greeting: using model ${llmConfig.model} at ${llmConfig.providerCompleteApiUrl}`)
    const callStartTime = Date.now()
    try {
      const completion = await completes(
        {
          baseURL: llmConfig.providerCompleteApiUrl,
          apiKey: llmConfig.providerApiSecret,
          model: llmConfig.model
        },
        messages,
        { max_tokens: 800, temperature: 0, response_format: { type: "json_object" } }
      )
      res = completion?.choices?.[0] ?? null
      console.log(`Greeting: model ${llmConfig.model} responded in ${Date.now() - callStartTime}ms`)
    } catch (err) {
      console.log(`Greeting: model ${llmConfig.model} failed after ${Date.now() - callStartTime}ms`, err?.message ?? err)
      blockModelSet.add(llmConfig.id)
    }
  }

  const rawContent = res?.message?.content ?? ''
  let textToSend
  try {
    const cleaned = rawContent
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/```\s*$/m, '')
      .trim()
    try {
      textToSend = JSON.parse(cleaned)?.response
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        textToSend = JSON.parse(jsonMatch[0])?.response
      } else {
        throw new Error('No JSON object found in response')
      }
    }
  } catch (err) {
    console.log('Greeting: failed to parse LLM response as JSON', rawContent.slice(0, 200))
    return null
  }

  if (!textToSend) {
    console.log('Greeting: response text is empty')
    return null
  }

  textToSend = textToSend.replace(/。$/, '').trim()
  return textToSend
}
