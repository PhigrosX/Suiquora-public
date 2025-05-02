/**
 * 从问题内容中提取标签
 * 标签格式: 内容末尾的 TAGS:tag1,tag2,tag3
 */
export function extractTagsFromContent(content: string): string[] {
  if (!content) return [];
  
  // 查找 TAGS: 标记
  const tagsMatch = content.match(/\n\nTAGS:([^]*?)(\n\n|$)/);
  if (!tagsMatch) return [];
  
  const tagsString = tagsMatch[1];
  // 分割标签并移除空白
  return tagsString.split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

/**
 * 从问题内容中移除标签部分，返回纯内容
 */
export function removeTagsFromContent(content: string): string {
  if (!content) return '';
  
  // 移除 TAGS: 部分
  return content.replace(/\n\nTAGS:[^]*?(\n\n|$)/, '$1');
}

/**
 * 从问题内容中提取类别
 * 类别格式: 内容末尾的 CATEGORY:类别名称
 */
export function extractCategoryFromContent(content: string): string | null {
  if (!content) return null;
  
  // 查找 CATEGORY: 标记
  const categoryMatch = content.match(/\n\nCATEGORY:([^]*?)(\n\n|$)/);
  if (!categoryMatch) return null;
  
  return categoryMatch[1].trim();
}

/**
 * 从问题内容中移除类别部分，返回纯内容
 */
export function removeCategoryFromContent(content: string): string {
  if (!content) return '';
  
  // 移除 CATEGORY: 部分
  return content.replace(/\n\nCATEGORY:[^]*?(\n\n|$)/, '$1');
}

/**
 * 处理问题内容，提取标签和类别并返回清理后的内容
 */
export function processQuestionContent(content: string): { 
  cleanContent: string; 
  tags: string[];
  category: string | null;
} {
  const tags = extractTagsFromContent(content);
  const category = extractCategoryFromContent(content);
  
  // 先移除标签
  let cleanContent = removeTagsFromContent(content);
  // 再移除类别
  cleanContent = removeCategoryFromContent(cleanContent);
  
  return {
    cleanContent,
    tags,
    category
  };
}