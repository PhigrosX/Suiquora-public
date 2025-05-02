import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';

// 定义用户状态类型
type UserState = {
  address: string | null;
  isConnected: boolean;
  isLoadingProfile: boolean;
  error: string | null;
};

// 定义上下文类型
type UserContextType = {
  user: UserState;
  setUserProfile: (profile: Partial<UserState>) => void;
  refreshUserData: () => void;
  clearUserData: () => void;
};

// 创建上下文
const UserContext = createContext<UserContextType | undefined>(undefined);

// 上下文提供者组件
export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const currentAccount = useCurrentAccount();
  const [user, setUser] = useState<UserState>({
    address: null,
    isConnected: false,
    isLoadingProfile: false,
    error: null,
  });

  // 监听钱包连接状态
  useEffect(() => {
    if (currentAccount) {
      setUser(prev => ({
        ...prev,
        address: currentAccount.address,
        isConnected: true,
      }));

      // 在这里可以加载用户的链上数据
      refreshUserData();
    } else {
      // 钱包断开连接
      clearUserData();
    }
  }, [currentAccount]);

  // 更新用户资料
  const setUserProfile = (profile: Partial<UserState>) => {
    setUser(prev => ({ ...prev, ...profile }));
  };

  // 刷新用户数据
  const refreshUserData = () => {
    if (!currentAccount) return;

    setUser(prev => ({ ...prev, isLoadingProfile: true, error: null }));

    // 这里可以添加从区块链读取用户数据的逻辑
    // 例如获取用户的问题、回答、奖励等信息
    try {
      // 模拟异步加载
      setTimeout(() => {
        setUser(prev => ({ ...prev, isLoadingProfile: false }));
      }, 500);
    } catch (error) {
      setUser(prev => ({
        ...prev,
        isLoadingProfile: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  // 清除用户数据
  const clearUserData = () => {
    setUser({
      address: null,
      isConnected: false,
      isLoadingProfile: false,
      error: null,
    });
  };

  const value = {
    user,
    setUserProfile,
    refreshUserData,
    clearUserData,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// 自定义钩子，用于在组件中使用用户上下文
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};