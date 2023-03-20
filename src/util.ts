/**
 * url 转 pascal字符, 且 去除重复的单词
 */
export function toPascal(str: string) {
  const pascal = str
    .replace(/[{}()-]/g, '')
    .replace(/^(\w)/, (m, $1) => $1.toUpperCase())
    .replace(/(_\w)/g, (m, $1) => $1.toUpperCase())
    .replace(/_/g, '');

  return doDuplicateWord(pascal);
}

/**
 * 去除重复的单词
 */
export function doDuplicateWord(str: string): string {
  const origins: string[] = str.split(/(?=[A-Z])/);
  const result: string[] = [];

  origins.reverse().forEach((o) => {
    if (!result.includes(o)) {
      result.push(o);
    }
  });

  return result.reverse().join('');
}
