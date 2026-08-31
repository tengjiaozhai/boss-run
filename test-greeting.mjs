import { generateGreetingMessage } from './packages/geek-auto-start-chat-with-boss/llm-greeting-generator.mjs';

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
  bossInfo: { name: '张经理', title: 'HR经理', activeTimeDesc: '刚刚活跃' },
  brandComInfo: { brandName: '南京某科技公司', industryName: '互联网', stageName: 'B轮', scaleName: '100-499人' }
};

console.log('=== 测试 AI 打招呼语生成 ===');

try {
  const result = await generateGreetingMessage(mockJobData);
  console.log('生成结果:', result);
} catch(err) {
  console.log('错误:', err.message);
  console.log(err.stack);
}

console.log('=== 测试结束 ===');
