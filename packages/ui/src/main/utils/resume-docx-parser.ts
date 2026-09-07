import mammoth from 'mammoth'
import type { ResumeContent } from '../../common/utils/resume'

/**
 * 将求职简历 docx 解析为 ResumeContent 草稿（不落库，由调用方打开编辑器让用户校对）。
 *
 * 解析基于「标准简历版式」的启发式规则：
 * - 分区标题行（核心优势/工作经历/项目经历/专业技能/教育背景 等）切分区块
 * - 公司头行 = 「公司 | 职务」 + 行内时间区间（如 2024.08–2026.06），后续 ●/○/编号行归并为其工作描述
 * - 项目头行 = 名称 + 行内时间区间；「项目背景/工作职责」归 projectDescription，「项目成果」归 performance
 * - 专业技能、教育背景无法映射到现有字段，追加到个人优势(userDescription)末尾，保证 LLM 可见学历信息
 * - docx 中通常不含期望薪资/工作年限，草稿留空/启发推算，由用户在校对时确认
 */

export interface ParsedResumeDraft {
  expectJob: string
  content: ResumeContent
}

const SECTION_TITLE_SET = new Set([
  '核心优势',
  '个人优势',
  '自我评价',
  '工作经历',
  '项目经历',
  '专业技能',
  '技能特长',
  '教育背景',
  '教育经历'
])

const USER_DESC_SECTION = 'userDesc'
const WORK_SECTION = 'work'
const PROJ_SECTION = 'proj'
const SKILLS_SECTION = 'skills'
const EDU_SECTION = 'edu'

const BULLET_PREFIX_RE = /^[●○▪■◆★·•◦※\-–—~]+[\s　]*/
const NUMBERED_PREFIX_RE = /^\(?\d{1,2}\)?[、.．]?\s*/

// 时间区间：2024.08–2026.06 / 2023.4-2024.05 / 2025年1月 ~ 至今 等
const TIME_RANGE_RE =
  /(20\d{2})\s*[.\-\/年]\s*(\d{1,2})\s*[月]?\s*[~\-–—至]\s*((?:20\d{2})\s*[.\-\/年]\s*\d{1,2}\s*[月]?|至今|now|现在)/i

const LEADER_LABEL_RE = /^[一二三四五六七八九十]+\s*[、.．]\s*/

const splitByPipe = (line: string) => line.split(/[｜|]/).map((s) => s.trim())

const normLine = (line: string) =>
  line
    .replace(/\t+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()

const stripBulletPrefix = (line: string) => {
  let result = line.replace(NUMBERED_PREFIX_RE, '')
  result = result.replace(BULLET_PREFIX_RE, '')
  return result.trim()
}

const toYearMon = (year: string, month: string) => `${year}-${month.padStart(2, '0')}`

const parseTimeRange = (line: string): { startYearMon: string; endYearMon: string | null } | null => {
  const m = line.match(TIME_RANGE_RE)
  if (!m) return null
  const endPart = m[3]
  const endIsNow = /^(至今|now|现在)$/i.test(endPart)
  let endYearMon: string | null
  if (endIsNow) {
    endYearMon = null
  } else {
    const em = endPart.match(/(20\d{2})\s*[.\-\/年]\s*(\d{1,2})/)
    endYearMon = em ? toYearMon(em[1], em[2]) : null
  }
  return { startYearMon: toYearMon(m[1], m[2]), endYearMon }
}

const removeTimeFromLine = (line: string, matched?: RegExpMatchArray | null) => {
  if (!matched) {
    const m = line.match(TIME_RANGE_RE)
    if (!m) return line
    return normLine(line.replace(m[0], ''))
  }
  return normLine(line.replace(matched[0], ''))
}

const looksLikeSectionTitle = (line: string): string | null => {
  let l = line.replace(LEADER_LABEL_RE, '').trim()
  if (SECTION_TITLE_SET.has(l)) return l
  return null
}

interface WorkDraft {
  company: string
  positionName: string
  startYearMon: string | null
  endYearMon: string | null
  workDescriptionLines: string[]
}

interface ProjDraft {
  name: string
  startYearMon: string | null
  endYearMon: string | null
  descLines: string[]
  perfLines: string[]
}

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.5

const calcWorkYearDesc = (workList: WorkDraft[]): string => {
  const spans = workList
    .map((it) => {
      if (!it.startYearMon) return null
      const start = new Date(it.startYearMon + '-01').getTime()
      let end: number
      if (it.endYearMon) {
        end = new Date(it.endYearMon + '-01').getTime()
      } else {
        end = Date.now()
      }
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null
      return { start, end }
    })
    .filter((it) => it !== null) as Array<{ start: number; end: number }>
  if (!spans.length) return ''
  const start = Math.min(...spans.map((s) => s.start))
  const end = Math.max(...spans.map((s) => s.end))
  const years = Math.floor((end - start) / MONTH_MS / 12)
  return years >= 1 ? `${years}年` : '1年以内'
}

export const parseResumeDocx = async (filePath: string): Promise<ParsedResumeDraft> => {
  const { value: rawText } = await mammoth.extractRawText({ path: filePath })
  const rawLines = rawText.split(/\r?\n/)

  let section: string | null = null
  let name = ''
  let expectJob = ''
  const userDescLines: string[] = []
  const skillsLines: string[] = []
  const eduLines: string[] = []
  const workList: WorkDraft[] = []
  const projList: ProjDraft[] = []
  // 项目内的行目标：'desc' | 'perf'（受「项目成果：」标签控制）
  let projLineTarget: 'desc' | 'perf' = 'desc'

  const pushUserDescLine = (line: string) => {
    const cleaned = stripBulletPrefix(line)
    if (cleaned) userDescLines.push(cleaned)
  }

  for (const rawLine of rawLines) {
    const line = normLine(rawLine)
    if (!line) continue

    const titleHit = looksLikeSectionTitle(line)
    if (titleHit) {
      if (titleHit === '核心优势' || titleHit === '个人优势' || titleHit === '自我评价') {
        section = USER_DESC_SECTION
      } else if (titleHit === '工作经历') {
        section = WORK_SECTION
      } else if (titleHit === '项目经历') {
        section = PROJ_SECTION
      } else if (titleHit === '专业技能' || titleHit === '技能特长') {
        section = SKILLS_SECTION
      } else {
        section = EDU_SECTION
      }
      continue
    }

    if (section === null) {
      // 头部：姓名 / 定位(期望职位) / 联系方式
      const isContactLine = /@/.test(line) || /1[3-9]\d{9}/.test(line)
      if (isContactLine) continue
      if (/[｜|]/.test(line)) {
        const parts = splitByPipe(line)
        if (!expectJob && parts[0] && parts[0].length <= 30) {
          const left = parts[0].replace(/\d+[kK]?[-~]\d+[kK]/g, '').trim()
          if (left) expectJob = left
        }
      } else if (!name && line.length <= 10 && !/\d/.test(line)) {
        name = line
      }
      continue
    }

    if (section === USER_DESC_SECTION) {
      pushUserDescLine(line)
      continue
    }
    if (section === SKILLS_SECTION) {
      const cleaned = stripBulletPrefix(line)
      if (cleaned) skillsLines.push(cleaned)
      continue
    }
    if (section === EDU_SECTION) {
      eduLines.push(line)
      continue
    }

    if (section === WORK_SECTION) {
      const timeMatch = line.match(TIME_RANGE_RE)
      if (timeMatch && /[｜|]/.test(line)) {
        const parts = splitByPipe(removeTimeFromLine(line, timeMatch))
        workList.push({
          company: parts[0] || '',
          positionName: parts[1] || '',
          startYearMon: timeMatch ? toYearMon(timeMatch[1], timeMatch[2]) : null,
          endYearMon: parseTimeRange(line)?.endYearMon ?? null,
          workDescriptionLines: []
        })
        continue
      }
      if (workList.length) {
        const cleaned = stripBulletPrefix(line)
        if (cleaned) workList[workList.length - 1].workDescriptionLines.push(cleaned)
      }
      continue
    }

    if (section === PROJ_SECTION) {
      const timeMatch = line.match(TIME_RANGE_RE)
      if (timeMatch) {
        const namePart = removeTimeFromLine(line, timeMatch)
        if (namePart && namePart.length > 1) {
          projList.push({
            name: namePart,
            startYearMon: toYearMon(timeMatch[1], timeMatch[2]),
            endYearMon: parseTimeRange(line)?.endYearMon ?? null,
            descLines: [],
            perfLines: []
          })
          projLineTarget = 'desc'
          continue
        }
      }
      if (projList.length) {
        const current = projList[projList.length - 1]
        const labelMatch = line.match(/^(项目背景|工作职责|项目成果|项目描述)\s*[:：]?/)
        if (labelMatch) {
          const label = labelMatch[1]
          if (label === '项目成果') {
            projLineTarget = 'perf'
          } else {
            projLineTarget = 'desc'
          }
          // 保留标签行作为结构标记（与手工维护的简历风格一致，便于 LLM 区分段落）
          const rest = line.slice(labelMatch[0].length).trim()
          const labeledLine = rest ? `${label}：${stripBulletPrefix(rest)}` : `${label}：`
          ;(projLineTarget === 'perf' ? current.perfLines : current.descLines).push(labeledLine)
          continue
        }
        const cleaned = stripBulletPrefix(line)
        if (cleaned) {
          ;(projLineTarget === 'perf' ? current.perfLines : current.descLines).push(cleaned)
        }
      }
      continue
    }
  }

  // 组装
  const extraLines: string[] = []
  if (skillsLines.length) {
    extraLines.push('专业技能：', ...skillsLines)
  }
  if (eduLines.length) {
    const eduParts = eduLines.map((l) => l.replace(/[｜|]/g, ' ')).join(' ')
    extraLines.push('教育背景：' + eduParts)
  }
  const userDescription = [...userDescLines, ...extraLines].join('\n')

  const geekWorkExpList = workList.map((it) => ({
    company: it.company,
    positionName: it.positionName,
    startYearMon: it.startYearMon,
    endYearMon: it.endYearMon,
    workDescription: it.workDescriptionLines.join('\n'),
    performance: ''
  }))

  const geekProjExpList = projList.map((it) => ({
    name: it.name,
    roleName: '',
    startYearMon: it.startYearMon ?? '',
    endYearMon: it.endYearMon ?? '',
    projectDescription: it.descLines.join('\n'),
    performance: it.perfLines.join('\n')
  }))

  return {
    expectJob,
    content: {
      name,
      workYearDesc: calcWorkYearDesc(workList),
      expectJob,
      userDescription,
      expectSalary: ['', ''],
      geekWorkExpList,
      geekProjExpList
    }
  }
}
