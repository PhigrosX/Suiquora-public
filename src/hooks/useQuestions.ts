import { useState, useEffect, useCallback, useMemo } from 'react';
import { QuestionData, useChainOperations } from '../services/contractService';

export type QuestionSortOption = 'newest' | 'oldest' | 'mostBounty' | 'highestBounty' | 'endingSoon' | 'bounty' | 'popular' | 'expiringSoon' | 'expiryTime';

// 帮助函数，确保获取一致的时间戳
export const getValidTimestamp = (timestamp: any): number => {
  // 如果时间戳不存在或无效
  if (!timestamp) return 0;
  
  // 如果已经是数字，直接处理
  if (typeof timestamp === 'number') {
    // 如果是秒级时间戳，转换为毫秒级
    return timestamp < 9999999999 ? timestamp * 1000 : timestamp;
  }
  
  // 如果是字符串，尝试解析
  if (typeof timestamp === 'string') {
    // 尝试将字符串转为数字
    const numTimestamp = Number(timestamp);
    
    // 如果是有效数字
    if (!isNaN(numTimestamp)) {
      // 如果是秒级时间戳，转换为毫秒级
      return numTimestamp < 9999999999 ? numTimestamp * 1000 : numTimestamp;
    }
    
    // 尝试作为日期字符串解析
    try {
      const dateTimestamp = new Date(timestamp).getTime();
      if (!isNaN(dateTimestamp)) {
        return dateTimestamp;
      }
    } catch (e) {
      console.warn(`Failed to parse timestamp string: ${timestamp}`);
    }
  }
  
  // 默认返回0
  console.warn(`Invalid timestamp format: ${timestamp}, type: ${typeof timestamp}`);
  return 0;
};

export function useQuestions(sortOption: QuestionSortOption = 'newest') {
  console.log('[useQuestions] Hook rendering with sortOption:', sortOption);

  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const { getAllQuestionsFromChain } = useChainOperations();

  // Memoize the function to prevent it from changing on every render
  const memoizedGetAllQuestions = useCallback(async () => {
    console.log('[useQuestions] Calling memoizedGetAllQuestions');
    return getAllQuestionsFromChain();
  }, [getAllQuestionsFromChain]);

  // 刷新函数添加节流逻辑，避免短时间内多次刷新
  const refreshQuestions = useCallback(() => {
    const now = Date.now();
    // 如果距离上次刷新不足 10 秒，则不执行刷新
    if (now - lastRefreshTime < 10000) {
      console.log('Refresh throttled - too many requests in short time period');
      return;
    }

    console.log('Manually refreshing questions - fetching from blockchain');
    setLastRefreshTime(now);
    setRefreshFlag(prev => prev + 1);
  }, [lastRefreshTime]);

  // Fetch questions on mount or when refreshFlag changes
  useEffect(() => {
    console.log('[useQuestions] Running fetch effect with refreshFlag:', refreshFlag);

    let isMounted = true;
    let retryTimeout: number | null = null;

    const fetchQuestions = async (retryCount = 0) => {
      if (!isMounted) return;

      // 最大重试次数
      const maxRetries = 3;

      try {
        setLoading(true);
        setError(null);
        console.log(`Fetching questions from blockchain (attempt ${retryCount + 1})`);

        const fetchedQuestions = await memoizedGetAllQuestions();

        // 验证问题数据
        const validQuestions = fetchedQuestions.filter(q => {
          // 确保必须的字段存在
          if (!q.id || !q.content || !q.asker) {
            console.warn('Filtered out invalid question:', q);
            return false;
          }
          return true;
        });

        console.log(`Successfully fetched ${validQuestions.length} valid questions`);

        if (isMounted) {
          setQuestions(validQuestions);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching questions:', err);

        if (isMounted) {
          // 如果是速率限制错误(429)或网络错误，尝试重试
          if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000; // 指数退避 + 随机抖动
            console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);

            if (retryTimeout) clearTimeout(retryTimeout);

            retryTimeout = window.setTimeout(() => {
              fetchQuestions(retryCount + 1);
            }, delay);
          } else {
            console.error('Max retries reached, giving up');
            setError('Failed to load questions after multiple attempts. Please try again later.');
            setLoading(false);
          }
        }
      }
    };

    fetchQuestions();

    // 清理函数
    return () => {
      console.log('[useQuestions] Cleaning up fetch effect');
      isMounted = false;
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [refreshFlag, memoizedGetAllQuestions]); // Keep dependencies minimal

  // 对获取的问题进行排序 - apply sorting in a separate effect to avoid fetching on sort change
  const sortedQuestions = useMemo(() => {
    console.log('[useQuestions] Running sort memo with sortOption:', sortOption);

    if (!questions || questions.length === 0) return [];

    const sortedQuestions = [...questions];

    // 记录第一个和最后一个问题的时间戳，用于调试
    if (sortedQuestions.length > 0) {
      const first = sortedQuestions[0];
      const last = sortedQuestions[sortedQuestions.length - 1];
      console.log('First question createTime:', first.createTime, '- Parsed:', new Date(getValidTimestamp(first.createTime)).toISOString());
      console.log('Last question createTime:', last.createTime, '- Parsed:', new Date(getValidTimestamp(last.createTime)).toISOString());
    }

    switch (sortOption) {
      case 'newest':
        console.log('Sorting by newest');
        sortedQuestions.sort((a, b) => {
          const timeB = getValidTimestamp(b.createTime);
          const timeA = getValidTimestamp(a.createTime);
          return timeB - timeA; // 较新的排在前面
        });
        break;
      case 'oldest':
        console.log('Sorting by oldest');
        sortedQuestions.sort((a, b) => {
          const timeA = getValidTimestamp(a.createTime);
          const timeB = getValidTimestamp(b.createTime);
          return timeA - timeB; // 较旧的排在前面
        });
        break;
      case 'bounty':
      case 'mostBounty':
      case 'highestBounty':
        sortedQuestions.sort((a, b) => Number(b.bountyAmount) - Number(a.bountyAmount));
        break;
      case 'popular':
        // 按回答数排序
        sortedQuestions.sort((a, b) => (b.answers?.length || 0) - (a.answers?.length || 0));
        break;
      case 'expiringSoon':
      case 'endingSoon':
      case 'expiryTime':
        sortedQuestions.sort((a, b) => {
          const timeA = getValidTimestamp(a.endTime);
          const timeB = getValidTimestamp(b.endTime);
          
          if (timeA === 0) return 1;
          if (timeB === 0) return -1;
          
          return timeA - timeB; // 即将到期的排在前面
        });
        break;
      default:
        console.warn(`Unimplemented or unknown sort option: ${sortOption}, falling back to 'newest'`);
        // 默认使用newest排序
        sortedQuestions.sort((a, b) => {
          const timeB = getValidTimestamp(b.createTime);
          const timeA = getValidTimestamp(a.createTime);
          return timeB - timeA;
        });
        break;
    }

    // 记录排序后的结果，用于调试
    if (sortedQuestions.length > 0) {
      console.log('After sorting, first question createTime:', 
        sortedQuestions[0].createTime, 
        '- Parsed:', new Date(getValidTimestamp(sortedQuestions[0].createTime)).toISOString());
      
      if (sortedQuestions.length > 1) {
        console.log('After sorting, second question createTime:', 
          sortedQuestions[1].createTime, 
          '- Parsed:', new Date(getValidTimestamp(sortedQuestions[1].createTime)).toISOString());
      }
    }

    return sortedQuestions;
  }, [questions, sortOption]);

  return {
    questions: sortedQuestions,
    loading,
    error,
    refreshQuestions
  };
}

export function useFilteredQuestions(
    sortOption: QuestionSortOption = 'newest',
    filters: {
      tags?: string[];
      status?: 'active' | 'resolved' | 'expired' | 'all';
      minBounty?: number;
      searchQuery?: string;
    } = {}
) {
  console.log('[useFilteredQuestions] Hook rendering with sortOption:', sortOption);

  const { questions: allQuestions, loading, error, refreshQuestions } = useQuestions(sortOption);
  const [filteredQuestions, setFilteredQuestions] = useState<QuestionData[]>([]);

  // Extract filter fields to avoid unnecessary re-renders
  const { tags, status, minBounty, searchQuery } = filters;

  // Cache the filter function to prevent unnecessary recalculations
  const filterQuestions = useCallback(() => {
    console.log(`[useFilteredQuestions] Filtering questions - total questions: ${allQuestions.length}`);

    // 首先验证所有问题
    const validQuestions = allQuestions.filter(q => {
      if (!q) return false;
      if (!q.id || !q.content || !q.asker) return false;
      if (typeof q.bountyAmount !== 'number') return false;
      
      // 放宽对时间字段的验证，只要能获取有效时间戳即可
      const createTimeValid = q.createTime !== undefined && getValidTimestamp(q.createTime) > 0;
      const endTimeValid = q.endTime !== undefined && getValidTimestamp(q.endTime) > 0;
      
      return createTimeValid && endTimeValid;
    });

    if (validQuestions.length < allQuestions.length) {
      console.warn(`Filtered out ${allQuestions.length - validQuestions.length} invalid questions before applying filters`);
    }

    let result = [...validQuestions];

    // 根据标签筛选
    if (tags && tags.length > 0) {
      console.log(`Filtering by tags: ${tags.join(', ')}`);
      // 如果使用 images 作为标签
      if (result.length > 0 && result[0].images) {
        result = result.filter(q => {
          // 检查问题是否有与过滤标签匹配的 images/tags
          if (!q.images) return false;
          return tags.some(tag => q.images?.includes(tag));
        });
      }
    }

    // 根据状态筛选
    if (status && status !== 'all') {
      console.log(`Filtering by status: ${status}`);
      const now = Date.now();

      if (status === 'active') {
        result = result.filter(q => !q.answered && q.endTime > now);
      } else if (status === 'resolved') {
        result = result.filter(q => q.answered);
      } else if (status === 'expired') {
        result = result.filter(q => !q.answered && q.endTime <= now);
      }
    }

    // 根据最小赏金筛选
    if (typeof minBounty === 'number' && minBounty > 0) {
      console.log(`Filtering by minimum bounty: ${minBounty}`);
      result = result.filter(q => q.bountyAmount >= minBounty);
    }

    // 根据搜索查询筛选
    if (searchQuery && searchQuery.trim() !== '') {
      console.log(`Filtering by search query: ${searchQuery}`);
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(q =>
          q.content.toLowerCase().includes(query)
      );
    }

    console.log(`Filtering complete - ${result.length} questions after filtering`);
    return result;
  }, [allQuestions, tags, status, minBounty, searchQuery]);

  // 每当过滤条件或问题列表变化时，重新应用过滤器
  useEffect(() => {
    console.log('[useFilteredQuestions] Running filter effect');
    const newFilteredQuestions = filterQuestions();
    setFilteredQuestions(newFilteredQuestions);

    return () => {
      console.log('[useFilteredQuestions] Cleaning up filter effect');
    };
  }, [filterQuestions]);

  return {
    questions: filteredQuestions,
    loading,
    error,
    refreshQuestions,
    // 添加原始问题数量以便进行调试和验证
    totalQuestionsBeforeFiltering: allQuestions.length
  };
} 