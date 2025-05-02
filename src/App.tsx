import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { createTheme, PaletteMode } from '@mui/material/styles';
import { Layout } from './components';
import { HomePage, QuestionDetailPage, CreateQuestionPage, ProfilePage } from './pages';
import { UserProvider } from './context/UserContext';
import { ThemeProvider, useColorMode } from './context/ThemeContext';
import { SuiServiceProvider } from './context/SuiServiceContext';
import './styles/global.css';
import { useMemo, useEffect } from 'react';


// 创建应用主题
const createAppTheme = (mode: PaletteMode) => {
  // 基础配置
  const baseConfig = {
    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: { fontWeight: 600 },
      h2: { fontWeight: 600 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: {
        fontWeight: 600,
        textTransform: 'none' as const,
      },
    },
    shape: {
      borderRadius: 16, // 更圆润的边角
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 28,
            textTransform: 'none',
            padding: '8px 24px',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
    },
  };

  // 深色模式
  if (mode === 'dark') {
    return createTheme({
      ...baseConfig,
      palette: {
        mode: 'dark',
        primary: {
          main: '#9c27b0', // 紫色
          light: '#bb86fc',
          dark: '#6a0dad',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#03dac6', // 青色
          light: '#66fff8',
          dark: '#00a896',
          contrastText: '#000000',
        },
        error: {
          main: '#ff5c8d', // 粉红色
        },
        background: {
          default: '#121225', // 深蓝紫色背景
          paper: 'rgba(37, 38, 75, 0.9)', // 更不透明的卡片背景
        },
        text: {
          primary: '#ffffff',
          secondary: 'rgba(255, 255, 255, 0.7)',
        },
        info: {
          main: '#84d2ff', // 亮蓝色
        },
        warning: {
          main: '#ffb84d', // 橙色
        },
        success: {
          main: '#04e762', // 绿色
        },
      },
      components: {
        ...baseConfig.components,
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 28,
              textTransform: 'none',
              padding: '8px 24px',
              boxShadow: '0 0 8px rgba(156, 39, 176, 0.3)',
              '&:hover': {
                boxShadow: '0 0 15px rgba(156, 39, 176, 0.5)',
              },
            },
            containedPrimary: {
              background: 'linear-gradient(45deg, #9c27b0 30%, #d53f8c 90%)',
            },
            containedSecondary: {
              background: 'linear-gradient(45deg, #00a896 30%, #03dac6 90%)',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              '&.MuiPaper-elevation1': {
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
              },
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundImage: 'linear-gradient(90deg, rgba(37, 38, 75, 0.7) 0%, rgba(87, 75, 144, 0.7) 100%)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              backdropFilter: 'blur(8px)',
              borderRadius: 16,
              background: 'rgba(37, 38, 75, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: 12,
              backdropFilter: 'blur(8px)',
            },
          },
        },
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundImage: 'radial-gradient(circle at top right, rgba(156, 39, 176, 0.15) 0%, transparent 70%), radial-gradient(circle at bottom left, rgba(3, 218, 198, 0.15) 0%, transparent 70%)',
              backgroundAttachment: 'fixed',
              backgroundSize: 'cover',
              scrollBehavior: 'smooth',
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            root: {
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              '& .MuiTabs-indicator': {
                height: '3px',
                borderRadius: '3px 3px 0 0',
              },
            },
            indicator: {
              backgroundColor: '#bb86fc',
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: 600,
              '&.Mui-selected': {
                color: '#bb86fc',
              },
            },
          },
        },
        MuiDivider: {
          styleOverrides: {
            root: {
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
            },
          },
        },
      }
    });
  }

  // 浅色模式
  return createTheme({
    ...baseConfig,
    palette: {
      mode: 'light',
      primary: {
        main: '#4e46e5', // 鲜亮的蓝紫色
        light: '#7b74ff',
        dark: '#3832b2',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#ff7a00', // 亮橙色
        light: '#ff9a3f',
        dark: '#cc6200',
        contrastText: '#ffffff',
      },
      error: {
        main: '#ff5757', // 鲜红色
      },
      background: {
        default: '#f8fafc', // 白色/浅灰色背景
        paper: '#ffffff', // 纯白色卡片背景
      },
      text: {
        primary: '#0f172a', // 深蓝黑色
        secondary: '#475569', // 灰蓝色
      },
      info: {
        main: '#38bdf8', // 亮蓝色
      },
      warning: {
        main: '#fbbf24', // 亮黄色
      },
      success: {
        main: '#4ade80', // 亮绿色
      },
    },
    components: {
      ...baseConfig.components,
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            textTransform: 'none',
            padding: '8px 24px',
            fontWeight: 600,
            boxShadow: '0 4px 0 rgba(0, 0, 0, 0.2)',
            border: '2px solid rgba(0, 0, 0, 0.8)',
            position: 'relative',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 0 rgba(0, 0, 0, 0.2)',
            },
            '&:active': {
              transform: 'translateY(2px)',
              boxShadow: '0 2px 0 rgba(0, 0, 0, 0.2)',
            },
          },
          containedPrimary: {
            backgroundColor: '#4e46e5',
            '&:hover': {
              backgroundColor: '#5a52ff',
            },
          },
          containedSecondary: {
            backgroundColor: '#ff7a00',
            '&:hover': {
              backgroundColor: '#ff8c1a',
            },
          },
          outlinedPrimary: {
            borderColor: '#4e46e5',
            color: '#4e46e5',
          },
          outlinedSecondary: {
            borderColor: '#ff7a00',
            color: '#ff7a00',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: '0 4px 0 rgba(0, 0, 0, 0.1)',
            border: '2px solid rgba(0, 0, 0, 0.8)',
            background: '#ffffff',
            '&.MuiPaper-elevation1': {
              boxShadow: '0 2px 0 rgba(0, 0, 0, 0.1)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: '0 6px 0 rgba(0, 0, 0, 0.15)',
            border: '2px solid rgba(0, 0, 0, 0.8)',
            background: '#ffffff',
            transition: 'all 0.3s ease',
            overflow: 'hidden',
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: '0 8px 0 rgba(0, 0, 0, 0.15)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: '1px solid rgba(0, 0, 0, 0.8)',
            boxShadow: '0 2px 0 rgba(0, 0, 0, 0.1)',
            fontWeight: 600,
          },
          filled: {
            '&.MuiChip-colorPrimary': {
              backgroundColor: '#e0e7ff',
              color: '#4e46e5',
            },
            '&.MuiChip-colorSecondary': {
              backgroundColor: '#fff7ed',
              color: '#ff7a00',
            },
            '&.MuiChip-colorSuccess': {
              backgroundColor: '#dcfce7',
              color: '#16a34a',
            },
            '&.MuiChip-colorInfo': {
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
            },
            '&.MuiChip-colorWarning': {
              backgroundColor: '#fef3c7',
              color: '#d97706',
            },
            '&.MuiChip-colorError': {
              backgroundColor: '#fee2e2',
              color: '#dc2626',
            },
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'grid\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 40 0 L 0 0 0 40\' fill=\'none\' stroke=\'%23e2e8f0\' stroke-width=\'1\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'white\'/%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'url(%23grid)\'/%3E%3C/svg%3E")',
            backgroundAttachment: 'fixed',
            backgroundSize: 'cover',
            scrollBehavior: 'smooth',
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            borderBottom: '2px solid rgba(0, 0, 0, 0.8)',
            background: '#ffffff',
            '& .MuiTabs-indicator': {
              height: '4px',
              borderRadius: '4px 4px 0 0',
            },
          },
          indicator: {
            backgroundColor: '#4e46e5',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderBottom: '2px solid transparent',
            '&.Mui-selected': {
              color: '#4e46e5',
            },
            '&:hover': {
              backgroundColor: 'rgba(78, 70, 229, 0.05)',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: '#ffffff',
            boxShadow: '0 2px 0 rgba(0, 0, 0, 0.1)',
            borderBottom: '2px solid rgba(0, 0, 0, 0.8)',
            color: '#0f172a',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: 'rgba(0, 0, 0, 0.15)',
            borderWidth: '1px',
          },
        },
      },
    }
  });
};

// 主应用函数
function App() {
  const { mode } = useColorMode();

  // 使用useMemo缓存主题，避免不必要的重新计算
  const theme = useMemo(() =>
    createAppTheme(mode),
    [mode]);

  // 获取与Vite相同的基础路径
  const basePath = import.meta.env.BASE_URL;

  // 监听主题切换，并应用相应的样式
  useEffect(() => {
    document.body.className = mode === 'dark' ? 'dark-mode' : 'light-mode';
    const metaThemeColor = document.querySelector('meta[name=theme-color]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', mode === 'dark' ? '#121225' : '#f5f5f5');
    }

  }, [mode, basePath]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename={basePath}>
        <SuiServiceProvider>
          <UserProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="questions/:questionId" element={<QuestionDetailPage />} />
                <Route path="create-question" element={<CreateQuestionPage />} />
                <Route path="profile/:address" element={<ProfilePage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Routes>
          </UserProvider>
        </SuiServiceProvider>
      </Router>
    </MuiThemeProvider>
  );
}

export default function AppWithProviders() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}