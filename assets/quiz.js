// 共享测验组件：把 .quiz 容器里的按钮变成即时反馈选择题
// 用法：
//   <div class="quiz" data-explain="...">
//     <p class="quiz-q">问题？</p>
//     <button class="quiz-option" data-correct="true">A</button>
//     <button class="quiz-option">B</button>
//   </div>
// 点选后立即判定对错、锁定本题、展示 data-explain 解析。
document.querySelectorAll('.quiz').forEach((quiz) => {
  const options = quiz.querySelectorAll('.quiz-option');
  options.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (quiz.classList.contains('done')) return;
      const isCorrect = btn.dataset.correct === 'true';
      options.forEach((o) => {
        o.disabled = true;
        if (o.dataset.correct === 'true') o.classList.add('correct');
      });
      if (!isCorrect) btn.classList.add('wrong');
      quiz.classList.add('done');
      const explain = quiz.querySelector('.quiz-explain');
      if (explain) {
        explain.textContent = (isCorrect ? '✓ 正确。' : '✗ 不对。') + explain.textContent;
      }
    });
  });
});
