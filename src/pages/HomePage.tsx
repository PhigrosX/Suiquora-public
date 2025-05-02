import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
  Stack,
  Paper,
  useTheme,
  CircularProgress,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { formatAddress, addressToColor } from "../utils";
import { useColorMode } from "../context/ThemeContext";
import {
  useFilteredQuestions,
  QuestionSortOption,
} from "../hooks/useQuestions";
import { processQuestionContent } from "../utils/contentUtils";
import { formatTimeLeft } from "../utils/dateUtils";

// 定义常量样式对象，避免每次渲染创建新对象
// 使用 React.memo 创建优化的组件
const SearchField = React.memo(
  ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
  }) => {
    const theme = useTheme();

    return (
      <TextField
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        variant="outlined"
        fullWidth
        InputProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
          },
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "off",
          spellCheck: "false",
        }}
      />
    );
  },
);

const FilterChips = React.memo(
  ({
    statusFilter,
    setStatusFilter,
  }: {
    statusFilter: string;
    setStatusFilter: (
      status: "all" | "active" | "resolved" | "expired",
    ) => void;
  }) => {
    return (
      <Stack direction="row" spacing={1} sx={{ my: 2 }}>
        <Chip
          label="All"
          color={statusFilter === "all" ? "primary" : "default"}
          onClick={() => setStatusFilter("all")}
          variant={statusFilter === "all" ? "filled" : "outlined"}
        />
        <Chip
          label="Active"
          color={statusFilter === "active" ? "primary" : "default"}
          onClick={() => setStatusFilter("active")}
          variant={statusFilter === "active" ? "filled" : "outlined"}
        />
        <Chip
          label="Resolved"
          color={statusFilter === "resolved" ? "primary" : "default"}
          onClick={() => setStatusFilter("resolved")}
          variant={statusFilter === "resolved" ? "filled" : "outlined"}
        />
        <Chip
          label="Expired"
          color={statusFilter === "expired" ? "primary" : "default"}
          onClick={() => setStatusFilter("expired")}
          variant={statusFilter === "expired" ? "filled" : "outlined"}
        />
      </Stack>
    );
  },
);

const SortOptions = React.memo(
  ({
    sortOption,
    setSortOption,
  }: {
    sortOption: QuestionSortOption;
    setSortOption: (option: QuestionSortOption) => void;
  }) => {
    return (
      <FormControl variant="outlined" sx={{ minWidth: 200 }}>
        <InputLabel>Sort by</InputLabel>
        <Select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as QuestionSortOption)}
          label="Sort by"
          MenuProps={{
            PaperProps: {
              style: {
                maxHeight: 300,
                width: 250,
              },
            },
            anchorOrigin: {
              vertical: "bottom",
              horizontal: "center",
            },
            transformOrigin: {
              vertical: "top",
              horizontal: "center",
            },
          }}
        >
          <MenuItem value="newest">Newest</MenuItem>
          <MenuItem value="oldest">Oldest</MenuItem>
          <MenuItem value="mostBounty">Highest Bounty</MenuItem>
          <MenuItem value="expiryTime">Expiry Time</MenuItem>
        </Select>
      </FormControl>
    );
  },
);

const HomePage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const { mode } = useColorMode();
  const isDarkMode = mode === "dark";

  // State for sorting and filtering
  const [sortOption, setSortOption] = useState<QuestionSortOption>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  // 使用 useRef 来跟踪上一次的搜索查询值，以帮助调试
  useRef(searchQuery);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "resolved" | "expired"
  >("all");

  // 使用 useMemo 缓存样式对象，避免在每次渲染时重新创建
  const styles = useMemo(
    () => ({
      heroBackground: {
        background: isDarkMode
          ? "linear-gradient(135deg, rgba(156, 39, 176, 0.2) 0%, rgba(3, 218, 198, 0.2) 100%)"
          : "#e0e7ff",
      },
      radialGradient: {
        background: isDarkMode
          ? "radial-gradient(circle at center, rgba(156, 39, 176, 0.5) 0%, transparent 70%)"
          : "radial-gradient(circle at center, rgba(78, 70, 229, 0.2) 0%, transparent 70%)",
      },
      chipPrimary: {
        background: isDarkMode
          ? "linear-gradient(45deg, #9c27b0 30%, #d53f8c 90%)"
          : "#4e46e5",
      },
      chipSecondary: {
        bgcolor: isDarkMode
          ? "rgba(3, 218, 198, 0.15)"
          : "rgba(78, 70, 229, 0.15)",
      },
    }),
    [isDarkMode, theme],
  );

  // 使用防抖处理搜索查询，避免频繁触发状态更新
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create search and filter objects using useMemo to avoid re-renders
  const filters = useMemo(
    () => ({
      status: statusFilter,
      searchQuery: debouncedSearchQuery,
    }),
    [statusFilter, debouncedSearchQuery],
  );

  // Get questions with filters - using the debounced search query
  const { questions, loading, error } = useFilteredQuestions(
    sortOption,
    filters,
  );

  // Optimize input change handler with useCallback
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      // 只有当新值与当前值不同时才更新状态，避免不必要的渲染
      if (newValue !== searchQuery) {
        setSearchQuery(newValue);
      }
    },
    [searchQuery],
  );

  // Handle sort change with fixed functionality
  // Handle status filter change
  // Handle navigating to create question page with refresh function
  const handleNavigateToCreate = () => {
    navigate("/create-question");
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
          mt: 2,
        }}
      >
        <Box>
          <Typography
            variant="h3"
            gutterBottom
            className={isDarkMode ? "gradient-text" : ""}
            sx={{
              fontWeight: "bold",
              color: isDarkMode ? undefined : theme.palette.primary.main,
            }}
          >
            SuiQuora
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: isDarkMode
                ? "rgba(255, 255, 255, 0.7)"
                : "rgba(46, 53, 89, 0.8)",
              mb: 2,
            }}
          >
            Ask questions, provide answers, earn rewards on Sui blockchain
          </Typography>
        </Box>

        {currentAccount && (
          <Button
            onClick={handleNavigateToCreate}
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutlineIcon />}
            sx={{
              borderRadius: 28,
              height: 48,
              px: 3,
            }}
          >
            Ask Question
          </Button>
        )}
      </Box>

      <Paper
        className="glass"
        sx={{
          borderRadius: 4,
          mb: 5,
          overflow: "hidden",
          background: styles.heroBackground,
        }}
      >
        <Box
          sx={{
            p: 3,
            pb: 5,
            textAlign: "center",
            position: "relative",
          }}
        >
          <Typography
            variant="h4"
            gutterBottom
            className={isDarkMode ? "neon-text" : ""}
            sx={{
              mt: 2,
              color: isDarkMode ? undefined : theme.palette.primary.main,
            }}
          >
            Decentralized Knowledge Sharing
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              maxWidth: 750,
              mx: "auto",
              mb: 3,
              color: isDarkMode
                ? "rgba(255, 255, 255, 0.8)"
                : theme.palette.text.primary,
            }}
          >
            Earn SUI tokens by answering questions or get quality answers by
            offering bounties. All answers and rewards are managed through
            secure smart contracts on Sui blockchain.
          </Typography>

          {!currentAccount ? (
            <Box
              sx={{
                mt: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  color: theme.palette.primary.light,
                }}
              >
                Connect your wallet to start asking questions or earning rewards
              </Typography>
            </Box>
          ) : (
            <Button
              onClick={handleNavigateToCreate}
              variant="contained"
              color="secondary"
              size="large"
              sx={{ mt: 2 }}
            >
              Start Your First Question
            </Button>
          )}

          {/* Animated radial gradient background */}
          <Box
            sx={{
              position: "absolute",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
              zIndex: -1,
              opacity: 0.3,
              ...styles.radialGradient,
              animation: "pulse 3s infinite ease-in-out",
            }}
          />
        </Box>
      </Paper>

      {/* Filter Section */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ width: "100%" }}>
            {/* Search field */}
            <Box sx={{ mb: 2 }}>
              <SearchField
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search questions..."
              />
            </Box>
            {/* Optimized filter chips */}
            <FilterChips
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
            />
          </Box>
          <Box
            sx={{
              width: { xs: "100%", md: "auto" },
              display: "flex",
              justifyContent: "flex-start",
            }}
          >
            {/* Optimized sort options */}
            <SortOptions
              sortOption={sortOption}
              setSortOption={setSortOption}
            />
          </Box>
        </Box>
      </Box>

      {/* Questions section */}
      <Box>
        {/* Loading state */}
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error state */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* No results */}
        {!loading && !error && questions.length === 0 && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No questions found
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Try changing your search or filter criteria
            </Typography>
          </Box>
        )}

        {/* Questions list */}
        {!loading && !error && questions.length > 0 && (
          <Stack spacing={2} sx={{ mb: 6 }}>
            {questions.map((question) => (
              <Card
                key={question.id}
                component={RouterLink}
                to={`/questions/${question.id}`}
                sx={{
                  textDecoration: "none",
                  display: "block",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: isDarkMode
                      ? "0 8px 32px rgba(0, 0, 0, 0.3)"
                      : "0 8px 32px rgba(109, 93, 172, 0.15)",
                  },
                }}
                className="glass-card"
              >
                <CardContent sx={{ p: 3 }}>
                  {(() => {
                    // 处理内容，提取标题、标签和类别
                    const { cleanContent, tags, category } = processQuestionContent(question.content || '');
                    
                    // 提取标题（第一行）
                    const title = cleanContent && cleanContent.includes('\n')
                      ? cleanContent.split('\n')[0]
                      : cleanContent || 'No Title';
                      
                    return (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            mb: 2,
                          }}
                        >
                          <Box>
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 600,
                                color: isDarkMode
                                  ? "white"
                                  : theme.palette.text.primary,
                                mb: 1,
                              }}
                            >
                              {title}
                            </Typography>
                            
                            {/* 显示类别和标签 */}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                              {category && (
                                <Chip
                                  label={category}
                                  size="small"
                                  color="secondary"
                                  sx={{
                                    background: isDarkMode
                                      ? 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)'
                                      : 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
                                    color: 'white',
                                    height: 20,
                                    '& .MuiChip-label': { px: 1, py: 0, fontSize: '0.625rem' }
                                  }}
                                />
                              )}
                              
                              {tags && tags.length > 0 && tags.slice(0, 3).map((tag, index) => (
                                <Chip
                                  key={index}
                                  label={tag}
                                  size="small"
                                  sx={{
                                    bgcolor: isDarkMode
                                      ? 'rgba(156, 39, 176, 0.15)'
                                      : 'rgba(109, 93, 172, 0.15)',
                                    height: 20,
                                    '& .MuiChip-label': { px: 1, py: 0, fontSize: '0.625rem' }
                                  }}
                                />
                              ))}
                              
                              {tags && tags.length > 3 && (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  +{tags.length - 3} more
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                            }}
                          >
                            <Chip
                              label={`${question.bountyAmount} SUI`}
                              color="primary"
                              size="small"
                              sx={styles.chipPrimary}
                            />
                          </Box>
                        </Box>
                      </>
                    )
                  })()}

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          bgcolor: addressToColor(question.asker),
                          mr: 1,
                          fontSize: "0.75rem",
                        }}
                      >
                        {question.asker.substring(0, 1).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" color="text.secondary">
                        {formatAddress(question.asker)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip
                        size="small"
                        label={`${question.answers.length + (question.bestAnswer && !question.answers.some((a) => a.id === question.bestAnswer?.id) ? 1 : 0)} answers`}
                        sx={styles.chipSecondary}
                      />

                      <Chip
                        size="small"
                        icon={<AccessTimeIcon fontSize="small" />}
                        label={
                          question.answered
                            ? "Resolved"
                            : new Date(question.endTime) > new Date()
                              ? formatTimeLeft(question.endTime)
                              : "Expired"
                        }
                        color={
                          question.answered
                            ? "success"
                            : new Date(question.endTime) > new Date()
                              ? "primary"
                              : "warning"
                        }
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </Container>
  );
};

export default HomePage;
