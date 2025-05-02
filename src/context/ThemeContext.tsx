import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useMemo,
} from "react";
import { PaletteMode } from "@mui/material/styles";

type ThemeContextType = {
  toggleColorMode: () => void;
  mode: PaletteMode;
};

// 创建上下文
const ThemeContext = createContext<ThemeContextType>({
  toggleColorMode: () => {},
  mode: "dark",
});

// 主题提供者组件
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // 从本地存储获取主题偏好，默认为暗色模式
  const [mode, setMode] = useState<PaletteMode>(() => {
    const savedMode = localStorage.getItem("colorMode");
    return (savedMode as PaletteMode) || "dark";
  });

  // 切换主题
  const toggleColorMode = React.useCallback(() => {
    setMode((prevMode) => {
      const newMode = prevMode === "light" ? "dark" : "light";
      localStorage.setItem("colorMode", newMode);
      return newMode;
    });
  }, []);

  // 使用 useMemo 缓存主题上下文值，避免每次渲染创建新对象
  const contextValue = useMemo(
    () => ({
      mode,
      toggleColorMode,
    }),
    [mode, toggleColorMode],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// 自定义钩子，用于在组件中使用主题上下文
export const useColorMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useColorMode must be used within a ThemeProvider");
  }
  return context;
};

