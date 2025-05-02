import React, { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import { UserInfo } from "../components";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { addressToColor, formatAddress } from "../utils";
import { useColorMode } from "../context/ThemeContext";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CommentIcon from "@mui/icons-material/Comment";
import {
  AnswerData,
  QuestionData,
  useChainOperations,
} from "../services/contractService";
import { formatTimestamp, formatDateForDisplay } from '../utils/dateUtils';
import { formatTimeLeft } from '../utils/dateUtils';

// Function to convert blockchain data to UI display format
interface ProfilePageProps { }

const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { address } = useParams<{ address: string }>();
  const currentAccount = useCurrentAccount();
  const navigate = useNavigate();

  // Use ref to track previous account address to avoid state update issues
  const prevAccountAddressRef = React.useRef<string | undefined>();

  // Clearly define user address, only has value when URL has address or wallet is connected
  const userAddress = address || currentAccount?.address;

  const theme = useTheme();
  const { mode } = useColorMode();
  const isDarkMode = mode === "dark";

  // State for tab value
  const [tabValue, setTabValue] = useState(0);

  // State for answers tab sub-filter
  const [answersFilter, setAnswersFilter] = useState<
    "all" | "best" | "regular"
  >("all");

  // State for loading and data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);

  // State for user data
  const [userQuestions, setUserQuestions] = useState<QuestionData[]>([]);
  const [userAnswers, setUserAnswers] = useState<QuestionData[]>([]);
  const [userComments, setUserComments] = useState<QuestionData[]>([]);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [bestAnswers, setBestAnswers] = useState<
    { question: QuestionData; answer: AnswerData }[]
  >([]);

  const { getQuestionsByAsker, getQuestionsByAnswerer, getBestAnswersByUser } =
    useChainOperations();

  // Function to refresh data
  const refreshData = () => {
    setRefreshFlag((prev) => prev + 1);
  };

  // Helper function to clear all user data
  const clearData = useCallback(() => {
    setUserQuestions([]);
    setUserAnswers([]);
    setUserComments([]);
    setCommentsCount(0);
    setBestAnswers([]);
  }, []);

  // Check if wallet is connected or address is provided, if not redirect to home
  useEffect(() => {
    if (!userAddress) {
      navigate("/", { replace: true });
    }
  }, [userAddress, navigate]);

  // Monitor wallet account changes - use useEffect and ref to reliably detect changes
  useEffect(() => {
    // If account address changed, refresh data immediately
    const currentAddr = currentAccount?.address;
    const prevAddr = prevAccountAddressRef.current;

    // If address changed (including connection and disconnection scenarios)
    if (currentAddr !== prevAddr) {

      // Update ref for next comparison
      prevAccountAddressRef.current = currentAddr;

      if (prevAddr && currentAddr) {
        // If switching from one wallet to another (not initial connection)
        // Force reload entire page - hard refresh to clear all caches

        // Use the most thorough way to refresh the page, ensuring no cache is used
        sessionStorage.setItem("wallet_switched", "true");
        window.location.href =
          window.location.origin + window.location.pathname; // Completely reset URL, remove query params and hash
        return; // Prevent executing further code
      } else if (prevAddr && !currentAddr) {
        // If wallet disconnected, redirect to home page
        navigate("/", { replace: true });
        return;
      }

      // If it's first connection (not switching wallets), just clear data and trigger refetch
      clearData();
      setRefreshFlag((prev) => prev + 1);
    }
  }, [currentAccount?.address, clearData, navigate]);

  // Check session storage for wallet switch flag, clear if present
  useEffect(() => {
    const walletSwitched = sessionStorage.getItem("wallet_switched");
    if (walletSwitched) {
      sessionStorage.removeItem("wallet_switched");
      // No need to refresh again, as page has already been refreshed
    }
  }, []);

  // Fetch user data when the address changes or refresh is triggered
  useEffect(() => {
    // Set loading state immediately - but only when user address is available
    if (userAddress) {
      setLoading(true);
      setError(null);

      const fetchUserData = async () => {
        try {
          // Timeout handling: show error if data fetching takes too long
          const timeout = setTimeout(() => {
            if (loading) {
              console.error("[ProfilePage] Data fetching timeout");
              setError("Data loading timeout. Please try refreshing the page.");
              setLoading(false);
            }
          }, 30000); // 30 second timeout

          // Separate answers and comments
          const answers = await getQuestionsByAnswerer(userAddress);

          const verifiedAnswers = answers.filter((question) => {
            // Check for direct answers
            const hasDirectAnswer = question.answers.some(
              (a) => a.answerer === userAddress,
            );
            // Check if it's the best answer
            const isBestAnswer =
              question.bestAnswer &&
              question.bestAnswer.answerer === userAddress;

            return hasDirectAnswer || isBestAnswer;
          });

          // Get comments
          const verifiedComments = answers.filter((question) => {
            return question.answers.some(
              (a) =>
                a.extraContent &&
                a.extraContent.some((ec) => ec.answerer === userAddress),
            );
          });

          // Calculate total comment count
          let totalCommentsCount = 0;
          verifiedComments.forEach((question) => {
            question.answers.forEach((answer) => {
              if (answer.extraContent) {
                totalCommentsCount += answer.extraContent.filter(
                  (ec) => ec.answerer === userAddress,
                ).length;
              }
            });
          });
          setCommentsCount(totalCommentsCount);

          // Get other data (questions and best answers)
          const [questions, bestAns] = await Promise.all([
            getQuestionsByAsker(userAddress),
            getBestAnswersByUser(userAddress),
          ]);

          // Clear timeout
          clearTimeout(timeout);

          // Filter to ensure only questions from current wallet address
          const filteredQuestions = questions.filter(
            (q) => q.asker === userAddress,
          );
          setUserQuestions(filteredQuestions);

          // Set verified answers and comments
          setUserAnswers(verifiedAnswers);
          setUserComments(verifiedComments);

          // Filter to include only best answers from current wallet
          const filteredBestAns = bestAns.filter(
            (item) => item.answer.answerer === userAddress,
          );
          setBestAnswers(filteredBestAns);
        } catch (err) {
          console.error("[ProfilePage] Error fetching user data:", err);
          setError("Failed to load user data. Please try again later.");
          clearData();
        } finally {
          setLoading(false);
        }
      };

      fetchUserData();
    } else {
      // If no user address, clear data and reset loading state
      clearData();
      setLoading(false);
    }
  }, [
    userAddress,
    refreshFlag,
    getQuestionsByAsker,
    getQuestionsByAnswerer,
    getBestAnswersByUser,
    clearData,
  ]);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Handle answers filter change
  const handleAnswersFilterChange = (filter: "all" | "best" | "regular") => {
    setAnswersFilter(filter);
  };

  // Loading state for the whole page
  if (!userAddress) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h5" color="error" gutterBottom>
            <ErrorOutlineIcon sx={{ fontSize: 40, mb: 1 }} />
            <br />
            No Address Available
          </Typography>
          <Typography variant="body1" gutterBottom>
            Please connect your wallet to view your profile or provide a valid
            address.
          </Typography>
          <Button
            component={RouterLink}
            to="/"
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
          >
            Return to Home
          </Button>
        </Box>
      </Container>
    );
  }

  // Calculate stats even if loading or error happened
  // This ensures we still show some data instead of zeros
  const stats = {
    userAddress: userAddress,
    questionsCount: userQuestions.length,
    answersCount: userAnswers.length,
    commentsCount: commentsCount,
    bestAnswersCount: bestAnswers.length,
    totalBountyEarned: bestAnswers.reduce(
      (sum, item) => sum + item.question.bountyAmount,
      0,
    ),
    activeBountyOffered: userQuestions
      .filter((q) => !q.answered && q.endTime > Date.now())
      .reduce((sum, q) => sum + q.bountyAmount, 0),
  };

  const isOwnProfile = currentAccount && currentAccount.address === address;

  // Loading state breakdown - improve user experience
  // Distinguish between initial loading and data refresh
  const isInitialLoading =
    loading && userQuestions.length === 0 && userAnswers.length === 0;
  const isRefreshing =
    loading && (userQuestions.length > 0 || userAnswers.length > 0);

  // Main page loading skeleton - only show during initial loading
  if (isInitialLoading) {
    return (
      <Container maxWidth="lg">
        <Box my={4}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Skeleton width="60%" height={40} />
            <Skeleton width={100} height={36} />
          </Box>

          <Box sx={{ mb: 4 }}>
            <Skeleton variant="rectangular" height={200} />
          </Box>

          <Skeleton variant="rectangular" height={400} />
        </Box>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="lg">
        <Box my={4}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ mb: 0, fontWeight: 600 }}
            >
              {isOwnProfile ? "My Profile" : "User Profile"}
            </Typography>

            <Button
              variant="outlined"
              color="primary"
              onClick={refreshData}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : null}
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </Box>

          <UserInfo stats={stats} isLoading={false} />

          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        </Box>
      </Container>
    );
  }

  // Custom refresh button component - shows refresh state
  const RefreshButton = () => (
    <Button
      variant="outlined"
      color="primary"
      onClick={refreshData}
      disabled={loading}
      startIcon={loading ? <CircularProgress size={16} /> : null}
    >
      {loading ? "Loading..." : "Refresh"}
    </Button>
  );

  // Filter answers based on answersFilter
  const filteredAnswers = userAnswers.filter((question) => {
    // Ensure the question has at least one answer from the current user
    const hasAnyUserAnswer = Boolean(
      // Check regular answers
      (question.answers &&
        question.answers.some((a) => a.answerer === userAddress)) ||
      // Check best answer
      (question.bestAnswer && question.bestAnswer.answerer === userAddress) ||
      // Check extended answers
      (question.answers &&
        question.answers.some(
          (a) =>
            (a.extraAnswerers && a.extraAnswerers.includes(userAddress)) ||
            (a.extraContent &&
              a.extraContent.some((ec) => ec.answerer === userAddress)),
        )),
    );

    if (!hasAnyUserAnswer) {
      return false;
    }

    if (answersFilter === "all") {
      return true;
    }

    if (answersFilter === "best") {
      return (
        question.bestAnswer && question.bestAnswer.answerer === userAddress
      );
    }

    if (answersFilter === "regular") {
      // Regular answers are those not marked as best
      const notUserBestAnswer =
        !question.bestAnswer || question.bestAnswer.answerer !== userAddress;
      const hasUserRegularAnswer = question.answers.some(
        (a) => a.answerer === userAddress,
      );
      return notUserBestAnswer && hasUserRegularAnswer;
    }

    return true;
  });

  // Render comments section after TabPanel
  const renderComments = (comments: QuestionData[]) => {
    if (comments.length === 0) {
      return (
        <Box
          sx={{
            p: 4,
            textAlign: "center",
            bgcolor: isDarkMode
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.02)",
            borderRadius: 2,
            border: "1px dashed",
            borderColor: isDarkMode
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.1)",
          }}
        >
          <CommentIcon
            sx={{ fontSize: 40, color: "text.secondary", mb: 1, opacity: 0.5 }}
          />
          <Typography variant="body1" color="text.secondary">
            No comments yet
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2 }}>
        {comments.map((question) => (
          <Card
            key={question.id}
            sx={{
              mb: 3,
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: (theme) =>
                  `0 8px 24px ${theme.palette.mode === "dark" ? "rgba(156, 39, 176, 0.3)" : "rgba(109, 93, 172, 0.25)"}`,
              },
              textDecoration: "none",
              color: "text.primary",
              border: "1px solid",
              borderColor: isDarkMode
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.08)",
              overflow: "visible",
            }}
            component={RouterLink}
            to={`/questions/${question.id}`}
          >
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: "inherit",
                  mb: 2,
                  pb: 1,
                  borderBottom: "1px solid",
                  borderColor: isDarkMode
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.08)",
                }}
              >
                {question.content}
              </Typography>
              {question.answers.map(
                (answer) =>
                  answer.extraContent &&
                  answer.extraContent.map(
                    (comment, index) =>
                      comment.answerer === userAddress && (
                        <Box
                          key={`${answer.id}-${index}`}
                          sx={{
                            mt: 2,
                            p: 2,
                            pl: 3,
                            borderLeft: "3px solid",
                            borderColor: "primary.main",
                            borderRadius: "4px",
                            bgcolor: isDarkMode
                              ? "rgba(109, 93, 172, 0.15)"
                              : "rgba(109, 93, 172, 0.08)",
                            position: "relative",
                            "&::before": {
                              content: '""',
                              position: "absolute",
                              top: 0,
                              left: -1,
                              width: "3px",
                              height: "100%",
                              bgcolor: "primary.main",
                              borderRadius: "4px",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              mb: 1,
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 24,
                                height: 24,
                                bgcolor: addressToColor(answer.answerer),
                                fontSize: "0.8rem",
                                mr: 1,
                              }}
                            >
                              {answer.answerer.substring(0, 1).toUpperCase()}
                            </Avatar>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              fontWeight="medium"
                            >
                              Comment on {formatAddress(answer.answerer)}'s
                              answer
                            </Typography>
                          </Box>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "inherit",
                              fontWeight: "medium",
                              fontSize: "1rem",
                            }}
                          >
                            {comment.content || comment.answerContent}
                          </Typography>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              mt: 2,
                              alignItems: "center",
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <AccessTimeIcon sx={{ fontSize: 14, mr: 0.5 }} />
                              {comment.createTime
                                ? formatTimestamp(comment.createTime)
                                : "Unknown date"}
                            </Typography>
                            <Chip
                              size="small"
                              label="View question"
                              color="primary"
                              sx={{
                                fontSize: "0.7rem",
                                fontWeight: "bold",
                                "&:hover": {
                                  bgcolor: "primary.dark",
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      ),
                  ),
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box my={4}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ mb: 0, fontWeight: 600 }}
          >
            {isOwnProfile ? "My Profile" : "User Profile"}
          </Typography>

          <RefreshButton />
        </Box>

        <UserInfo stats={stats} isLoading={isRefreshing} />

        {/* Add refresh status indicator */}
        {isRefreshing && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 2,
            }}
          >
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Updating profile data...
            </Typography>
          </Box>
        )}

        {/* Ensure Card is not rendered before loading */}
        {!isInitialLoading && (
          <Card className="glass" sx={{ mb: 4, overflow: "hidden" }}>
            <Box
              sx={{
                borderBottom: 1,
                borderColor: isDarkMode
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            >
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="profile tabs"
                textColor="primary"
                indicatorColor="primary"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  "& .MuiTab-root": {
                    fontWeight: 600,
                    textTransform: "none",
                    fontSize: { xs: "0.875rem", sm: "1rem" },
                    px: { xs: 2, sm: 3 },
                    py: 2,
                  },
                }}
              >
                <Tab
                  label={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography>My Questions</Typography>
                      <Badge
                        badgeContent={stats.questionsCount}
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  }
                />
                <Tab
                  label={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography>My Answers</Typography>
                      <Badge
                        badgeContent={stats.answersCount}
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  }
                />
                <Tab
                  label={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography>Comments</Typography>
                      <Badge
                        badgeContent={stats.commentsCount}
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  }
                />
                <Tab
                  label={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography>Reward History</Typography>
                      <Badge
                        badgeContent={bestAnswers.length}
                        color="warning"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  }
                />
              </Tabs>
            </Box>

            <Box p={3}>
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {tabValue === 0 && (
                    <>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 3,
                          flexDirection: { xs: "column", sm: "row" },
                          gap: { xs: 2, sm: 0 },
                        }}
                      >
                        <Typography variant="h6">
                          {isOwnProfile
                            ? "Your Questions"
                            : `Questions by ${formatAddress(userAddress || "")}`}
                        </Typography>
                      </Box>

                      {loading ? (
                        <Stack spacing={2}>
                          {[1, 2, 3].map((item) => (
                            <Card
                              key={item}
                              className="glass-card"
                              sx={{ p: 2 }}
                            >
                              <Skeleton
                                variant="rectangular"
                                height={30}
                                width="70%"
                                sx={{ mb: 1 }}
                              />
                              <Skeleton
                                variant="rectangular"
                                height={20}
                                width="40%"
                                sx={{ mb: 2 }}
                              />
                              <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                                <Skeleton
                                  variant="rectangular"
                                  height={25}
                                  width={80}
                                />
                                <Skeleton
                                  variant="rectangular"
                                  height={25}
                                  width={80}
                                />
                                <Skeleton
                                  variant="rectangular"
                                  height={25}
                                  width={80}
                                />
                              </Box>
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Box sx={{ display: "flex", gap: 1 }}>
                                  <Skeleton
                                    variant="rectangular"
                                    height={20}
                                    width={60}
                                  />
                                  <Skeleton
                                    variant="rectangular"
                                    height={20}
                                    width={60}
                                  />
                                </Box>
                                <Skeleton
                                  variant="rectangular"
                                  height={20}
                                  width={80}
                                />
                              </Box>
                            </Card>
                          ))}
                        </Stack>
                      ) : userQuestions.length === 0 ? (
                        <Box
                          sx={{
                            textAlign: "center",
                            py: 8,
                            bgcolor: isDarkMode
                              ? "rgba(255, 255, 255, 0.05)"
                              : "rgba(0, 0, 0, 0.02)",
                            borderRadius: 2,
                          }}
                        >
                          <Typography
                            variant="body1"
                            sx={{ color: "text.secondary", mb: 2 }}
                          >
                            {isOwnProfile
                              ? "You haven't asked any questions yet."
                              : `${formatAddress(userAddress || "")} hasn't asked any questions yet.`}
                          </Typography>
                          <Button
                            variant="outlined"
                            component={RouterLink}
                            to="/"
                            startIcon={<AccessTimeIcon />}
                          >
                            Browse Questions
                          </Button>
                        </Box>
                      ) : (
                        <Stack spacing={2}>
                          {userQuestions.map((question) => (
                            <Card
                              key={question.id}
                              component={RouterLink}
                              to={`/questions/${question.id}`}
                              sx={{
                                textDecoration: "none",
                                display: "block",
                                transition: "transform 0.2s ease",
                                "&:hover": {
                                  transform: "translateY(-2px)",
                                },
                              }}
                              className="glass-card"
                            >
                              <CardContent sx={{ p: 3 }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    mb: 2,
                                  }}
                                >
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      fontWeight: 600,
                                      color: theme.palette.text.primary,
                                    }}
                                  >
                                    {question.content &&
                                      question.content.includes("\n")
                                      ? question.content.split("\n")[0]
                                      : question.content}
                                  </Typography>

                                  <Chip
                                    label={`${question.bountyAmount} SUI`}
                                    color="primary"
                                    size="small"
                                    sx={{
                                      background: isDarkMode
                                        ? "linear-gradient(45deg, #9c27b0 30%, #d53f8c 90%)"
                                        : "linear-gradient(45deg, #6d5dac 30%, #8f7acf 90%)",
                                    }}
                                  />
                                </Box>

                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Box>
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      Posted{" "}
                                      {formatDateForDisplay(
                                        question.createTime,
                                      )}
                                      {question.endTime && !question.answered && (
                                        <>
                                          {" · "}
                                          <span style={{ display: "inline-flex", alignItems: "center" }}>
                                            <AccessTimeIcon fontSize="inherit" sx={{ mr: 0.5, fontSize: "0.875rem" }} />
                                            {question.endTime > Date.now() 
                                              ? `Expires in ${formatTimeLeft(question.endTime)}`
                                              : "Expired"}
                                          </span>
                                        </>
                                      )}
                                    </Typography>
                                  </Box>

                                  <Box sx={{ display: "flex", gap: 1 }}>
                                    <Chip
                                      size="small"
                                      label={`${question.answers.length} ${question.answers.length === 1 ? 'answer' : 'answers'}`}
                                      sx={{
                                        bgcolor: isDarkMode
                                          ? "rgba(3, 218, 198, 0.15)"
                                          : "rgba(108, 172, 219, 0.15)",
                                      }}
                                      icon={<CommentIcon fontSize="small" />}
                                    />

                                    <Chip
                                      size="small"
                                      icon={<AccessTimeIcon fontSize="small" />}
                                      label={
                                        question.answered
                                          ? "Resolved"
                                          : question.endTime > Date.now()
                                            ? "Active"
                                            : "Expired"
                                      }
                                      color={
                                        question.answered
                                          ? "success"
                                          : question.endTime > Date.now()
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
                    </>
                  )}

                  {tabValue === 1 && (
                    <>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 3,
                          flexDirection: { xs: "column", sm: "row" },
                          gap: { xs: 2, sm: 0 },
                        }}
                      >
                        <Typography variant="h6">
                          {isOwnProfile
                            ? "Your Answers"
                            : `Answers by ${formatAddress(userAddress || "")}`}
                        </Typography>

                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                            justifyContent: { xs: "center", sm: "flex-start" },
                          }}
                        >
                          <Chip
                            label="All"
                            color={answersFilter === "all" ? "info" : "default"}
                            variant={
                              answersFilter === "all" ? "filled" : "outlined"
                            }
                            onClick={() => handleAnswersFilterChange("all")}
                            sx={{ fontWeight: 500 }}
                          />
                          <Chip
                            label="Best Answers"
                            icon={<CheckCircleIcon fontSize="small" />}
                            color={
                              answersFilter === "best" ? "info" : "default"
                            }
                            variant={
                              answersFilter === "best" ? "filled" : "outlined"
                            }
                            onClick={() => handleAnswersFilterChange("best")}
                            sx={{ fontWeight: 500 }}
                          />
                          <Chip
                            label="Regular Answers"
                            color={
                              answersFilter === "regular" ? "info" : "default"
                            }
                            variant={
                              answersFilter === "regular"
                                ? "filled"
                                : "outlined"
                            }
                            onClick={() => handleAnswersFilterChange("regular")}
                            sx={{ fontWeight: 500 }}
                          />
                        </Box>
                      </Box>

                      {loading ? (
                        <Stack spacing={2}>
                          {[1, 2, 3].map((item) => (
                            <Card
                              key={item}
                              className="glass-card"
                              sx={{ p: 2 }}
                            >
                              <Skeleton
                                variant="rectangular"
                                height={30}
                                width="80%"
                                sx={{ mb: 1 }}
                              />
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  mb: 2,
                                }}
                              >
                                <Skeleton
                                  variant="circular"
                                  height={24}
                                  width={24}
                                  sx={{ mr: 1 }}
                                />
                                <Skeleton
                                  variant="rectangular"
                                  height={18}
                                  width={150}
                                />
                              </Box>
                              <Skeleton
                                variant="rectangular"
                                height={60}
                                sx={{ mb: 2 }}
                              />
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Skeleton
                                  variant="rectangular"
                                  height={20}
                                  width={80}
                                />
                                <Skeleton
                                  variant="rectangular"
                                  height={20}
                                  width={120}
                                />
                              </Box>
                            </Card>
                          ))}
                        </Stack>
                      ) : filteredAnswers.length === 0 ? (
                        <Box
                          sx={{
                            textAlign: "center",
                            py: 8,
                            bgcolor: isDarkMode
                              ? "rgba(255, 255, 255, 0.05)"
                              : "rgba(0, 0, 0, 0.02)",
                            borderRadius: 2,
                          }}
                        >
                          <Typography
                            variant="body1"
                            sx={{ color: "text.secondary", mb: 2 }}
                          >
                            {answersFilter !== "all"
                              ? "No answers found matching the current filter."
                              : isOwnProfile
                                ? "You haven't answered any questions yet."
                                : `${formatAddress(userAddress || "")} hasn't answered any questions yet.`}
                          </Typography>
                          <Button
                            variant="outlined"
                            onClick={() => handleAnswersFilterChange("all")}
                            color="info"
                          >
                            Show All Answers
                          </Button>
                        </Box>
                      ) : (
                        <Stack spacing={2}>
                          {filteredAnswers.map((question) => {
                            // 找到当前用户在这个问题中的回答
                            const userAnswer = question.answers.find(
                              (answer) => answer.answerer === userAddress,
                            );

                            // 检查这个回答是否为最佳回答
                            const isBestAnswer =
                              question.bestAnswer?.answerer === userAddress;

                            return (
                              <Card
                                key={question.id}
                                component={RouterLink}
                                to={`/questions/${question.id}`}
                                sx={{
                                  textDecoration: "none",
                                  display: "block",
                                  transition: "all 0.3s ease",
                                  position: "relative",
                                  "&:hover": {
                                    transform: "translateY(-2px)",
                                    boxShadow: isDarkMode
                                      ? "0 8px 32px rgba(0, 0, 0, 0.3)"
                                      : "0 8px 32px rgba(109, 93, 172, 0.15)",
                                  },
                                  borderLeft: "5px solid",
                                  borderColor: isBestAnswer
                                    ? theme.palette.success.main
                                    : theme.palette.info.main,
                                }}
                                className="glass-card"
                              >
                                {isBestAnswer && (
                                  <Box
                                    sx={{
                                      position: "absolute",
                                      top: -10,
                                      right: 20,
                                      bgcolor: isDarkMode
                                        ? "rgba(3, 218, 198, 0.9)"
                                        : "rgba(108, 172, 219, 0.9)",
                                      color: "white",
                                      borderRadius: "12px",
                                      px: 2,
                                      py: 0.5,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                      zIndex: 1,
                                    }}
                                  >
                                    <CheckCircleIcon fontSize="small" />
                                    <Typography
                                      variant="body2"
                                      fontWeight="bold"
                                    >
                                      Best Answer
                                    </Typography>
                                  </Box>
                                )}

                                <CardContent sx={{ p: 3 }}>
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
                                        }}
                                      >
                                        {question.content &&
                                          question.content.includes("\n")
                                          ? question.content.split("\n")[0]
                                          : question.content}
                                      </Typography>
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          mt: 1,
                                        }}
                                      >
                                        <Avatar
                                          sx={{
                                            width: 24,
                                            height: 24,
                                            bgcolor: addressToColor(
                                              question.asker,
                                            ),
                                            mr: 1,
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          {question.asker
                                            .substring(0, 1)
                                            .toUpperCase()}
                                        </Avatar>
                                        <Typography
                                          variant="body2"
                                          color="text.secondary"
                                        >
                                          Asked by{" "}
                                          {formatAddress(question.asker)}
                                        </Typography>
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
                                        sx={{
                                          fontWeight: "bold",
                                          mb: 1,
                                          background: isDarkMode
                                            ? "linear-gradient(45deg, #9c27b0 30%, #d53f8c 90%)"
                                            : "linear-gradient(45deg, #6d5dac 30%, #8f7acf 90%)",
                                        }}
                                      />
                                    </Box>
                                  </Box>

                                  {userAnswer && (
                                    <Box sx={{ mb: 2 }}>
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {userAnswer.answerContent}
                                      </Typography>
                                    </Box>
                                  )}

                                  <Box
                                    sx={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                      }}
                                    >
                                      <Typography
                                        variant="body2"
                                        fontWeight={500}
                                      >
                                        {question.answers.length} total answers
                                      </Typography>
                                    </Box>

                                    <Chip
                                      size="small"
                                      icon={
                                        !question.answered &&
                                          question.endTime > Date.now() ? (
                                          <HourglassEmptyIcon fontSize="small" />
                                        ) : question.answered ? (
                                          <CheckCircleIcon fontSize="small" />
                                        ) : (
                                          <AccessTimeIcon fontSize="small" />
                                        )
                                      }
                                      label={
                                        !question.answered &&
                                          question.endTime > Date.now()
                                          ? "Active Question"
                                          : question.answered
                                            ? "Resolved Question"
                                            : "Expired Question"
                                      }
                                      color={
                                        !question.answered &&
                                          question.endTime > Date.now()
                                          ? "primary"
                                          : question.answered
                                            ? "success"
                                            : "warning"
                                      }
                                    />
                                  </Box>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </Stack>
                      )}
                    </>
                  )}

                  {tabValue === 2 && (
                    <>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 3,
                          flexDirection: { xs: "column", sm: "row" },
                          gap: { xs: 2, sm: 0 },
                          pb: 2,
                          borderBottom: "2px solid",
                          borderColor: isDarkMode
                            ? "rgba(109, 93, 172, 0.3)"
                            : "rgba(109, 93, 172, 0.2)",
                        }}
                      >
                        <Typography
                          variant="h5"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            fontWeight: 600,
                            color: "primary.main",
                          }}
                        >
                          <CommentIcon sx={{ mr: 1, fontSize: 28 }} />
                          {isOwnProfile
                            ? "Your Comments"
                            : `Comments by ${formatAddress(userAddress || "")}`}
                          <Chip
                            label={stats.commentsCount}
                            color="primary"
                            size="small"
                            sx={{ ml: 2, fontWeight: "bold" }}
                          />
                        </Typography>
                      </Box>
                      {renderComments(userComments)}
                    </>
                  )}

                  {tabValue === 3 && (
                    <>
                      <Typography variant="h6" sx={{ mb: 3 }}>
                        {isOwnProfile
                          ? "Your Reward History"
                          : `Reward History for ${formatAddress(userAddress || "")}`}
                      </Typography>

                      <Box
                        sx={{
                          textAlign: "center",
                          py: 8,
                          bgcolor: isDarkMode
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0, 0, 0, 0.02)",
                          borderRadius: 2,
                        }}
                      >
                        <Typography
                          variant="body1"
                          sx={{ color: "text.secondary", mb: 2 }}
                        >
                          {bestAnswers.length > 0
                            ? `${isOwnProfile ? "You have" : `${formatAddress(userAddress || "")} has`} earned ${stats.totalBountyEarned} SUI from ${bestAnswers.length} best ${bestAnswers.length === 1 ? "answer" : "answers"}.`
                            : `${isOwnProfile ? "You have" : `${formatAddress(userAddress || "")} has`} not earned any rewards yet.`}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", mb: 3 }}
                        >
                          Detailed reward history viewing is coming soon.
                        </Typography>
                        <Button
                          variant="outlined"
                          color="warning"
                          startIcon={<AttachMoneyIcon />}
                          component={RouterLink}
                          to="/"
                        >
                          Browse Open Bounties
                        </Button>
                      </Box>
                    </>
                  )}
                </>
              )}
            </Box>
          </Card>
        )}
      </Box>
    </Container>
  );
};

export default ProfilePage;