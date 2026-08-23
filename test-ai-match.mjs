import { evaluateJobMatch } from './packages/geek-auto-start-chat-with-boss/llm-match-evaluator.mjs'

// 构造一个模拟的职位数据
const mockJobData = {
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

console.log('=== 开始测试 AI 匹配评估 ===\n')

try {
  const result = await evaluateJobMatch(mockJobData)
  
  if (result) {
    console.log('✅ AI 评估成功触发并返回结果：')
    console.log(`   匹配分数: ${result.score}`)
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
