import { evaluateJobMatch } from './packages/geek-auto-start-chat-with-boss/llm-match-evaluator.mjs'

// 构造一个模拟的职位数据（高度匹配场景）
const mockJobDataHigh = {
  jobInfo: {
    jobName: '数字化运营专员',
    positionName: '运营',
    salaryDesc: '10-15K',
    experienceName: '1-3年',
    degreeName: '本科',
    address: '南京·建邺区',
    postDescription: '负责公司业务数据分析和运营支持，搭建数据看板，优化运营流程。要求熟悉SQL、Excel，有数据分析经验优先。',
    showSkills: ['数据分析', 'SQL', 'Excel', '运营']
  },
  bossInfo: {
    name: '张经理',
    title: 'HR经理',
    activeTimeDesc: '刚刚活跃'
  },
  brandComInfo: {
    brandName: '南京某科技公司',
    industryName: '互联网',
    stageName: 'B轮',
    scaleName: '100-499人'
  }
}

// 构造一个模拟的职位数据（硬性条件不匹配场景）
const mockJobDataLow = {
  jobInfo: {
    jobName: '化工产品经理',
    positionName: '产品经理',
    salaryDesc: '9-10K',
    experienceName: '1年以内',
    degreeName: '硕士',
    address: '南京·六合区',
    postDescription: '负责化工产品线规划，要求化学、生物、材料相关专业硕士学历，熟悉化工贸易、供应链管理、食品合规等。',
    showSkills: ['化学', '供应链', '质量管理']
  },
  bossInfo: {
    name: '李经理',
    title: '招聘主管',
    activeTimeDesc: '今日活跃'
  },
  brandComInfo: {
    brandName: '某化工贸易公司',
    industryName: '化工',
    stageName: '不需要融资',
    scaleName: '50-100人'
  }
}

console.log('=== 开始测试 AI 匹配评估（高分场景）===\n')

try {
  const result = await evaluateJobMatch(mockJobDataHigh)

  if (result) {
    console.log('✅ AI 评估成功触发并返回结果：')
    console.log(`   匹配分数: ${result.score}`)
    console.log(`   技能: ${result.skillScore}/20  经验: ${result.experienceScore}/20  项目: ${result.projectScore}/20  薪资: ${result.salaryScore}/20  发展: ${result.developmentScore}/20`)
    console.log(`   评估报告: ${result.report}`)
  } else {
    console.log('❌ AI 评估返回 null（可能是 LLM 调用失败或解析失败）')
  }
} catch (err) {
  console.log('❌ AI 评估抛出异常：')
  console.log(`   ${err.message}`)
  console.log(`   ${err.stack}`)
}

console.log('\n=== 开始测试 AI 匹配评估（低分场景-硬性条件不匹配）===\n')

try {
  const result = await evaluateJobMatch(mockJobDataLow)

  if (result) {
    console.log('✅ AI 评估成功触发并返回结果：')
    console.log(`   匹配分数: ${result.score}`)
    console.log(`   技能: ${result.skillScore}/20  经验: ${result.experienceScore}/20  项目: ${result.projectScore}/20  薪资: ${result.salaryScore}/20  发展: ${result.developmentScore}/20`)
    console.log(`   评估报告: ${result.report}`)
  } else {
    console.log('❌ AI 评估返回 null（可能是 LLM 调用失败或解析失败）')
  }
} catch (err) {
  console.log('❌ AI 评估抛出异常：')
  console.log(`   ${err.message}`)
  console.log(`   ${err.stack}`)
}

console.log('\n=== 测试结束 ===')
