import { completes } from '@geekgeekrun/utils/gpt-request.mjs'
import { formatResumeJsonToMarkdown, checkIsResumeContentValid } from '@geekgeekrun/utils/resume.mjs'
import { readConfigFile, readStorageFile, writeStorageFile } from './runtime-file-utils.mjs'

const RESUME_PLACEHOLDER = `__REPLACE_REAL_RESUME_HERE__`
const JOB_INFO_PLACEHOLDER = `__REPLACE_JOB_INFO_HERE__`
const SINGLE_ITEM_DEFAULT_SERVE_WEIGHT = 1
const MAX_RETRIES = 2

let cachedResumeMarkdown = null
let cachedResumeKey = null

const defaultTemplateContent = `你是资深猎头。根据候选人简历和职位信息评估匹配度。

## 简历
__REPLACE_REAL_RESUME_HERE__

## 职位
__REPLACE_JOB_INFO_HERE__

## 评分标准（总分 100 分）

按以下 5 个维度逐项打分，每维度 0-20 分，汇总为总分：

1. 技能匹配（skillScore）：核心技能完全匹配 16-20，部分匹配 8-15，少量相关 1-7，完全不匹配 0
2. 经验匹配（experienceScore）：年限达标且行业对口 16-20，年限达标但行业偏 8-15，年限不足 1-7，严重不符 0
3. 项目匹配（projectScore）：有直接相关项目 16-20，有可迁移项目 8-15，弱相关 1-7，无相关 0
4. 薪资匹配（salaryScore）：职位薪资区间上限≥13K 视为匹配 16-20（区间覆盖13K即匹配，如10-15K、12-20K）；上限 10-13K 部分匹配 8-15；上限<10K 明显偏离 1-7；无法判断时给 10
5. 发展匹配（developmentScore）：职业方向一致 16-20，可转型 8-15，偏离 1-7，完全不一致 0

## 硬性条件（一票否决）

以下任一情况，总分不超过 30 分，无论其他维度如何：
- 学历要求不符（如要求硕士但候选人为本科及以下）
- 工作年限差距超过 2 年（如要求 5 年但候选人仅 3 年）
- 行业背景完全无关（如候选人背景为互联网软件，职位为化工/食品/机械制造）
- 职位类型完全不同（如候选人为产品经理，职位为司机/普工/质量检验员）

## 注意事项

1. 薪资维度：按职位薪资区间与13K基准比较打分（区间上限≥13K匹配、10-13K部分匹配、<10K偏离），无需参考候选人期望薪资；候选人简历未填写期望薪资不影响薪资打分，仅在报告中注明"简历未填写期望薪资"；仅当职位薪资无法解析（如薪资面议且无区间）时给 10 中性分
2. 报告开头不要固定使用"候选人"，根据分析重点自然开头
3. 若触发硬性条件一票否决，报告中需明确说明触发条件
4. report 字段中需包含明确的最终建议：推荐面试 / 备选考虑 / 不推荐

## 输出格式

严格以 JSON 格式响应，不要包含其他内容：
{"score": 0到100的整数, "skillScore": 0到20的整数, "experienceScore": 0到20的整数, "projectScore": 0到20的整数, "salaryScore": 0到20的整数, "developmentScore": 0到20的整数, "report": "300字以内的中文分析，需说明各维度得分理由和最终建议"}`

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

const clampScore = (score, min, max) => {
  if (isNaN(score)) return null
  return Math.max(min, Math.min(max, Math.round(score)))
}

const parseScoreField = (parsed, field, min, max) => {
  const val = Number(parsed[field])
  if (isNaN(val)) return null
  return clampScore(val, min, max)
}

const calibrateScore = (score, subScores, report) => {
  if (score === null) return null
  let calibrated = score

  const subScoreSum = [
    subScores.skillScore,
    subScores.experienceScore,
    subScores.projectScore,
    subScores.salaryScore,
    subScores.developmentScore
  ].filter((s) => s !== null).reduce((a, b) => a + b, 0)

  if (subScoreSum > 0 && Math.abs(subScoreSum - score) > 10) {
    calibrated = subScoreSum
    console.log(`AI match: score calibrated from ${score} to ${calibrated} (sub-score sum=${subScoreSum})`)
  }

  if (report) {
    // 先排除"未触发/不触发"的否定表述，避免误判
    const negatedHardViolation = report.match(/未触发|不触发|无触发|未满足.*否决|未达.*否决/)
    const hardViolation = report.match(/触发.*一票否决|一票否决|学历.*不符|年限.*差距.*2年|行业.*完全无关|职位类型.*完全不同/)
    if (hardViolation && !negatedHardViolation && calibrated > 30) {
      calibrated = 30
      console.log(`AI match: score capped to 30 due to hard requirement violation`)
    }
  }

  return calibrated
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
  let attemptCount = 0

  while (attemptCount < MAX_RETRIES) {
    llmConfig = pickLlmConfigFromList(llmConfigList, blockModelSet)
    if (!llmConfig) {
      console.log('AI match: all models exhausted, returning null')
      return null
    }
    console.log(`AI match: using model ${llmConfig.model} at ${llmConfig.providerCompleteApiUrl} (attempt ${attemptCount + 1}/${MAX_RETRIES})`)
    const callStartTime = Date.now()
    try {
      const completion = await completes(
        {
          baseURL: llmConfig.providerCompleteApiUrl,
          apiKey: llmConfig.providerApiSecret,
          model: llmConfig.model
        },
        messages,
        { max_tokens: 2000, temperature: 0, response_format: { type: "json_object" } }
      )
      res = completion?.choices?.[0] ?? null
      console.log(`AI match: model ${llmConfig.model} responded in ${Date.now() - callStartTime}ms`)
      if (res) break
    } catch (err) {
      console.log(`AI match: model ${llmConfig.model} failed after ${Date.now() - callStartTime}ms`, err?.message ?? err)
      blockModelSet.add(llmConfig.id)
    }
    attemptCount++
  }

  if (!res) {
    console.log('AI match: all attempts exhausted, returning null')
    return null
  }

  const rawContent = res?.message?.content ?? ''
  let parsed
  try {
    let cleaned = rawContent
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/```\s*$/m, '')
      .trim()

    // 尝试标准 JSON.parse
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // 如果标准解析失败，尝试从文本中提取第一个完整的 JSON 对象
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON object found in response')
      }
    }
  } catch (err) {
    console.log('AI match: failed to parse LLM response as JSON', rawContent.slice(0, 200))
    return null
  }

  const subScores = {
    skillScore: parseScoreField(parsed, 'skillScore', 0, 20),
    experienceScore: parseScoreField(parsed, 'experienceScore', 0, 20),
    projectScore: parseScoreField(parsed, 'projectScore', 0, 20),
    salaryScore: parseScoreField(parsed, 'salaryScore', 0, 20),
    developmentScore: parseScoreField(parsed, 'developmentScore', 0, 20),
  }

  const report = parsed.report ?? ''
  let score = parseScoreField(parsed, 'score', 0, 100)

  if (score === null) {
    console.log('AI match: score is invalid', parsed.score)
    return null
  }

  score = calibrateScore(score, subScores, report)

  return {
    score,
    skillScore: subScores.skillScore,
    experienceScore: subScores.experienceScore,
    projectScore: subScores.projectScore,
    salaryScore: subScores.salaryScore,
    developmentScore: subScores.developmentScore,
    report
  }
}
