/**
 * 将长地址格式化为缩短的显示格式
 * @param address 完整地址
 * @param prefixLength 前缀长度，默认为6
 * @param suffixLength 后缀长度，默认为4
 * @returns 格式化后的地址
 */
export const formatAddress = (
    address: string,
    prefixLength: number = 6,
    suffixLength: number = 4
): string => {
  if (!address) {
    return 'Unknown Address';
  }

  if (address.length < prefixLength + suffixLength) {
    return address;
  }

  return `${address.substring(0, prefixLength)}...${address.substring(
      address.length - suffixLength
  )}`;
};

/**
 * 从地址创建一个确定性的颜色值
 * @param address 地址
 * @returns 颜色十六进制值
 */
export const addressToColor = (address: string): string => {
  // Return a default color if address is undefined or null
  if (!address) {
    return '#cccccc';
  }

  let hash = 0;

  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = '#';

  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ('00' + value.toString(16)).substr(-2);
  }

  return color;
};
