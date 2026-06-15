export function getAnonNickname(index: number, suffix: string = '봉군'): string {
  const stems = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  if (index < 0) return suffix;
  
  let res = '';
  let num = index;
  
  while (num >= 0) {
    res = stems[num % 10] + res;
    num = Math.floor(num / 10) - 1;
  }
  
  return res + suffix;
}
