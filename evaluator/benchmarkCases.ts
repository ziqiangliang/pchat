export interface BenchmarkCase {
  id: string;
  domain: string;
  question: string;
  /** 开放题：不预设领域/步数，更贴近真实用户提问 */
  open?: boolean;
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  { id: 'tcp', domain: 'network', question: 'TCP 三次握手是怎么工作的？' },
  { id: 'bubble-sort', domain: 'algorithm', question: '冒泡排序的原理是什么？' },
  { id: 'pythagoras', domain: 'math', question: '勾股定理是什么？怎么理解？' },
  { id: 'photosynthesis', domain: 'biology', question: '光合作用是怎么进行的？' },
  { id: 'binary-search', domain: 'algorithm', question: '二分查找是怎么实现的？' },
  { id: 'react-state', domain: 'software', question: 'React 的 state 是怎么更新的？' },
  { id: 'newton-2', domain: 'physics', question: '牛顿第二定律 F=ma 是什么意思？' },
  { id: 'linked-list', domain: 'data-structure', question: '怎么在链表中插入一个节点？' },
  { id: 'http', domain: 'network', question: 'HTTP 请求和响应的流程是怎样的？' },
  { id: 'euler-path', domain: 'graph', question: '什么是欧拉图？怎么判断一个图是不是欧拉图？' },
  // 开放题
  { id: 'blockchain', domain: 'open', question: '区块链是如何保证交易不可篡改的？', open: true },
  { id: 'transformer', domain: 'open', question: '变压器是怎么改变电压的？', open: true },
  { id: 'recursion', domain: 'open', question: '递归函数是怎么工作的？能举个例子吗？', open: true },
];

export const QUICK_BENCHMARK_IDS = [
  'tcp',
  'bubble-sort',
  'pythagoras',
  'euler-path',
  'blockchain',
];

export const OPEN_BENCHMARK_CASES = BENCHMARK_CASES.filter((c) => c.open);
