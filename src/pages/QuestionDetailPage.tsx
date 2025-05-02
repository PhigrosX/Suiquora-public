import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Button,
  Chip,
  Avatar,
  TextField,
  Card,
  CardContent,
  Stack,
  IconButton,
  Alert,
  AlertTitle,
  Link,
  CircularProgress,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Collapse,
  ImageList,
  ImageListItem,
  Modal,
  Backdrop,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ReplyIcon from '@mui/icons-material/Reply';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LaunchIcon from '@mui/icons-material/Launch';
import EditIcon from '@mui/icons-material/Edit';
import CommentIcon from '@mui/icons-material/Comment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatAddress, addressToColor, processQuestionContent } from '../utils';
import { formatTimestamp, formatRelativeTime } from '../utils/dateUtils';
import { useColorMode } from '../context/ThemeContext';
import ReactMarkdown from 'react-markdown';
import { styled } from '@mui/material/styles';
import { SuiClient } from '@mysten/sui/client';
import {
  QuestionData,
  AnswerData,
  useAnswerQuestion,
  useChooseBestAnswer,
  useChainOperations,
  getAnswersForQuestion,
  useUpdateAnswer,
  useAddComment,
  useEditComment,
  useHandleExpiredQuestion
} from '../services/contractService';


// Import getPublicUrl function for accessing image links
import { getPublicUrl } from '../services/SupabaseService';

// Remove all mock data
// Delete mockQuestion and mockAnswers here

// Styled component for markdown content
const MarkdownContent = styled('div')(({ theme }) => ({
  '& p': {
    marginBottom: theme.spacing(2),
  },
  '& code': {
    fontFamily: 'monospace',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.05)',
    padding: '2px 4px',
    borderRadius: 4,
  },
  '& pre': {
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(37, 38, 75, 0.7)'
      : 'rgba(255, 255, 255, 0.7)',
    padding: theme.spacing(2),
    borderRadius: 8,
    overflow: 'auto',
    marginBottom: theme.spacing(2),
    border: theme.palette.mode === 'dark'
      ? '1px solid rgba(255, 255, 255, 0.1)'
      : '1px solid rgba(0, 0, 0, 0.1)',
    maxWidth: '100%',
  },
  '& pre code': {
    backgroundColor: 'transparent',
    padding: 0,
  },
  '& ul, & ol': {
    marginBottom: theme.spacing(2),
    paddingLeft: theme.spacing(3),
  },
  '& li': {
    marginBottom: theme.spacing(1),
  },
  '& strong': {
    fontWeight: 600,
  },
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontWeight: 600,
  },
}));

const QuestionDetailPage: React.FC = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const currentAccount = useCurrentAccount();
  const theme = useTheme();
  const { mode } = useColorMode();
  const isDarkMode = mode === 'dark';

  // Blockchain interaction hooks
  const { answerQuestion, isPending: isAnswerPending, error: answerError, transactionId: answerTxId } = useAnswerQuestion();
  const {
    chooseBestAnswer,
    isPending: isChoosingBest,
    transactionId: chooseBestTxId,
  } = useChooseBestAnswer();
  const { getQuestionByIdFromChain } = useChainOperations();
  const { updateAnswer, isPending: isUpdating, error: updateError } = useUpdateAnswer();
  const { addComment, isPending: isCommentPending, error: commentError } = useAddComment();
  const { editComment, error: editCommentError } = useEditComment();
  const { handleExpiredQuestion, isPending: isHandlingExpired, error: handleExpiredError } = useHandleExpiredQuestion();

  // State management
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerData[]>([]);
  const [fetchingAnswers, setFetchingAnswers] = useState(false);

  // Form states
  const [answerContent, setAnswerContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [selectingBestSuccess, setSelectingBestSuccess] = useState(false);
  const [handlingExpiredSuccess, setHandlingExpiredSuccess] = useState(false);

  // Answer edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editAnswerContent, setEditAnswerContent] = useState('');
  const [editAnswerId, setEditAnswerId] = useState<string | null>(null);

  // Comment states
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentAnswererId, setCommentAnswererId] = useState<string | null>(null);
  const [expandedCommentAnswerId, setExpandedCommentAnswerId] = useState<string | null>(null);
  const [isEditingCommentMode, setIsEditingCommentMode] = useState(false);

  // Memoized values
  useMemo(() => Date.now(), []);
  const isExpired = useMemo(() => {
    if (!question || !question.endTime) return false;
    const endTimestamp = question.endTime;
    // Only check if current time is past the end time
    return Date.now() > endTimestamp;
  }, [question]);
  const isActive = useMemo(() => {
    if (!question || !question.endTime) return false;
    const endTimestamp = question.endTime;
    // A question is active when time hasn't expired and not yet answered
    return Date.now() < endTimestamp && !question.answered;
  }, [question]);
  useMemo(() =>
    answers.find(answer => currentAccount && answer.answerer === currentAccount.address),
    [answers, currentAccount]
  );
  // Add new state variables for images
  const [answerImages, setAnswerImages] = useState<File[]>([]);
  const [editAnswerImages, setEditAnswerImages] = useState<File[]>([]);
  const [commentImages, setCommentImages] = useState<File[]>([]);

  // Add state for image viewer
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  // Optimize image validation to ensure correct display of images stored on blockchain
  const isValidImage = (image: any): boolean => {
    // If the value is empty or not a string, return false
    if (!image || typeof image !== 'string') {
      return false;
    }

    // Remove whitespace
    const trimmedImage = image.trim();
    if (trimmedImage === '') {
      return false;
    }

    // Check if it is a URL of common image formats
    if (
      trimmedImage.startsWith('data:image/') || // Base64 encoded image
      trimmedImage.startsWith('http://') ||     // HTTP link
      trimmedImage.startsWith('https://') ||    // HTTPS link
      trimmedImage.startsWith('ipfs://')        // IPFS link
    ) {
      return true;
    }

    // Handle possible Supabase public URL without protocol prefix
    if (
      trimmedImage.includes('supabase') ||
      trimmedImage.includes('storage.googleapis.com') ||
      trimmedImage.includes('amazonaws.com')
    ) {
      // Try to add https prefix and return
      return true;
    }

    return false;
  };

  // Process image URL to ensure correct protocol prefix and handle Supabase storage path
  const processImageUrl = (image: string | File): string => {
    // 如果是 File 对象，创建一个临时的 URL
    if (image instanceof File) {
      return URL.createObjectURL(image);
    }

    if (!image) return '';

    // 如果是字符串路径，直接使用 getPublicUrl 获取公共 URL
    if (typeof image === 'string') {
      try {
        // 如果是 Supabase 存储路径（以 images/ 开头）
        if (image.startsWith('images/')) {
          return getPublicUrl(image);
        }

        // 如果已经是完整 URL，直接返回
        if (
          image.startsWith('http://') ||
          image.startsWith('https://') ||
          image.startsWith('data:image/')
        ) {
          return image;
        }

        // 其他情况，尝试添加 https:// 前缀
        return `https://${image}`;
      } catch (error) {
        console.error('Error processing image URL:', error, image);
        return image; // 出错时返回原始路径
      }
    }

    return '';
  };

  // Load question data
  useEffect(() => {
    if (!questionId) return;

    const fetchQuestionDetails = async () => {
      setLoading(true);
      try {
        const questionData = await getQuestionByIdFromChain(questionId);

        if (!questionData) {
          setError("Question not found");
          return;
        }

        setQuestion(questionData);
        document.title = `${questionData.content.split('\n')[0].substring(0, 30)}... | SuiQuora`;
      } catch (err) {
        console.error("Error fetching question:", err);
        setError("Failed to load question details");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionDetails();
  }, [questionId, getQuestionByIdFromChain]);

  // Fetch complete answers
  useEffect(() => {
    if (!question?.id) return;

    const fetchAnswersForQuestion = async () => {
      try {
        setFetchingAnswers(true);

        const rpcUrl = import.meta.env.VITE_SUI_RPC_URL || "https://fullnode.testnet.sui.io:443";
        const suiClient = new SuiClient({ url: rpcUrl });
        const fetchedAnswers = await getAnswersForQuestion(question.id, suiClient);

        if (fetchedAnswers && fetchedAnswers.length > 0) {
          setAnswers(fetchedAnswers);
        } else {
          // Fallback to answers from question
          setAnswers(question.answers || []);
        }
      } catch (error) {
        console.error("Error fetching answers:", error);
        setAnswers(question.answers || []);
      } finally {
        setFetchingAnswers(false);
      }
    };

    fetchAnswersForQuestion();
  }, [question]);

  // User permission check functions
  const canComment = useCallback((answer: AnswerData) => {
    if (!currentAccount || !isActive || !question || question.answered) return false;

    // Can't comment if already answered
    if (question.answerers?.includes(currentAccount.address)) return false;

    // Can't comment if already commented
    const userComment = answer.extraContent?.find(
      comment => comment.answerer === currentAccount.address
    );

    return !userComment;
  }, [currentAccount, isActive, question]);
  useCallback((answer: AnswerData) => {
    if (!currentAccount || !isActive || !question || question.answered) return false;

    const userComment = answer.extraContent?.find(
      comment => comment.answerer === currentAccount.address
    );
    return !!userComment;
  }, [currentAccount, isActive, question]);
  const getUserComment = useCallback((answer: AnswerData) => {
    if (!currentAccount) return null;
    return answer.extraContent?.find(
      comment => comment.answerer === currentAccount.address
    );
  }, [currentAccount]);

  const canAnswer = useCallback(() => {
    if (!currentAccount || !isActive || !question || question.answered) return false;

    // Can't answer own question or if already answered
    if (question.asker === currentAccount.address ||
      question.answerers?.includes(currentAccount.address)) {
      return false;
    }

    // Can't answer if already commented on any answer
    return !answers.some(answer =>
      answer.extraContent?.some(comment => comment.answerer === currentAccount.address)
    );
  }, [currentAccount, isActive, question, answers]);

  // Calculate time status
  const getTimeStatus = useCallback(() => {
    if (!question || !question.endTime) return { label: 'Unknown', color: 'default' };

    const now = Date.now();
    const endTimestamp = question.endTime;

    // Check if the question has expired
    if (now > endTimestamp) {
      return { label: 'Expired', color: 'error' };
    }

    // Calculate time remaining
    const timeRemaining = endTimestamp - now;
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));

    if (hoursRemaining < 12) {
      return { label: `${hoursRemaining}h left`, color: 'warning' };
    } else if (hoursRemaining < 24) {
      return { label: `${hoursRemaining}h left`, color: 'primary' };
    } else {
      const daysRemaining = Math.floor(hoursRemaining / 24);
      return { label: `${daysRemaining}d left`, color: 'success' };
    }
  }, [question]);

  // Memoize the time status
  const timeStatus = useMemo(() => getTimeStatus(), [getTimeStatus]);

  // Helper function to safely check if question is defined
  // Dialog handling
  const handleOpenCommentDialog = useCallback((answer: AnswerData) => {
    const userComment = getUserComment(answer);
    if (userComment) {
      // Edit existing comment
      setCommentContent(userComment.answerContent);
      setCommentAnswererId(answer.answerer);
      setIsCommentDialogOpen(true);
      setIsEditingCommentMode(true);
    } else if (canComment(answer)) {
      // Add new comment
      setCommentContent('');
      setCommentAnswererId(answer.answerer);
      setIsCommentDialogOpen(true);
      setIsEditingCommentMode(false);
    }
  }, [getUserComment, canComment]);

  const handleCloseCommentDialog = useCallback(() => {
    setIsCommentDialogOpen(false);
    setCommentAnswererId(null);
    setCommentContent('');
    setCommentImages([]);
  }, []);

  const handleOpenEditDialog = useCallback((answer: AnswerData) => {
    setEditAnswerId(answer.id);
    setEditAnswerContent(answer.answerContent);
    setIsEditDialogOpen(true);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditAnswerId(null);
    setEditAnswerContent('');
    setEditAnswerImages([]);
  }, []);

  const toggleComments = useCallback((answerId: string) => {
    setExpandedCommentAnswerId(prev => prev === answerId ? null : answerId);
  }, []);

  // Render comment button
  const renderCommentButton = useCallback((answer: AnswerData) => {
    if (!currentAccount || !isActive || !question || question.answered) return null;

    const userComment = getUserComment(answer);

    if (!userComment && canComment(answer)) {
      return (
        <Button
          size="small"
          variant="outlined"
          color="info"
          startIcon={<CommentIcon />}
          onClick={() => handleOpenCommentDialog(answer)}
          disabled={isCommentPending}
          sx={{ mr: 1 }}
        >
          Comment
        </Button>
      );
    }

    return null;
  }, [currentAccount, isActive, question, getUserComment, canComment, handleOpenCommentDialog, isCommentPending]);

  // Image preview handlers
  const handleOpenImagePreview = (image: string) => {
    setPreviewImage(image);
    setImageViewerOpen(true);
  };

  const handleCloseImagePreview = () => {
    setImageViewerOpen(false);
    setPreviewImage(null);
  };

  // Handle image upload for answers
  const handleAnswerImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || !files.length) return;

    // Maximum 5 images
    if (answerImages.length + files.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    // Process each file
    Array.from(files).forEach(file => {
      setAnswerImages(prev => [...prev, file]);
    });
  }, [answerImages]);

  // Handle image removal for answers
  const handleAnswerImageRemove = useCallback((index: number) => {
    setAnswerImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle image upload for edit answer
  const handleEditAnswerImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || !files.length) return;

    // Maximum 5 images
    if (editAnswerImages.length + files.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    // Process each file
    Array.from(files).forEach(file => {
      setEditAnswerImages(prev => [...prev, file]);
    });
  }, [editAnswerImages]);

  // Handle image removal for edit answer
  const handleEditAnswerImageRemove = useCallback((index: number) => {
    setEditAnswerImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle image upload for comments
  const handleCommentImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || !files.length) return;

    // Maximum 3 images for comments
    if (commentImages.length + files.length > 3) {
      alert('Maximum 3 images allowed for comments');
      return;
    }

    // Process each file
    Array.from(files).forEach(file => {
      setCommentImages(prev => [...prev, file]);
    });
  }, [commentImages]);

  // Handle image removal for comments
  const handleCommentImageRemove = useCallback((index: number) => {
    setCommentImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Action handlers
  const handleSubmitAnswer = useCallback(async () => {
    if (!answerContent.trim() || !questionId || !currentAccount) return;

    // Check if question has expired first
    if (isExpired) {
      setSubmitError('This question has expired. You can no longer submit answers.');
      return;
    }

    // Validate user can answer
    if (question?.asker === currentAccount.address) {
      setSubmitError('You cannot answer your own question');
      return;
    }

    if (question?.answerers?.includes(currentAccount.address)) {
      setSubmitError('You have already answered this question. Each wallet address can only submit one answer per question.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      // Pass the answerImages array to the answerQuestion function
      await answerQuestion(questionId, answerContent, answerImages.length > 0 ? answerImages : undefined);

      setSubmitSuccess(true);
      setAnswerContent('');
      setAnswerImages([]); // Clear the images array after successful submission

      // Refresh question data
      const updatedQuestion = await getQuestionByIdFromChain(questionId);
      if (updatedQuestion) {
        setQuestion(updatedQuestion);
      }

      // Auto-hide success message
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error('Error submitting answer:', err);
      setSubmitError(answerError?.message || 'Failed to submit answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    answerContent, answerImages, questionId, currentAccount, question, isExpired,
    answerQuestion, getQuestionByIdFromChain, answerError
  ]);

  const handleSelectBestAnswer = useCallback(async (answererId: string) => {
    if (!questionId) return;

    try {
      await chooseBestAnswer(questionId, answererId);

      setSelectingBestSuccess(true);

      // Refresh question data
      const updatedQuestion = await getQuestionByIdFromChain(questionId);
      if (updatedQuestion) {
        setQuestion(updatedQuestion);
      }

      // Auto-hide success message
      setTimeout(() => setSelectingBestSuccess(false), 3000);
    } catch (err) {
      console.error('Error selecting best answer:', err);
    }
  }, [questionId, chooseBestAnswer, getQuestionByIdFromChain]);

  const handleUpdateAnswer = useCallback(async () => {
    if (!questionId || !editAnswerContent.trim() || !currentAccount) return;

    // Check if question has expired first
    if (isExpired) {
      setSubmitError('This question has expired. You can no longer edit answers.');
      return;
    }

    // Check if question is already answered
    if (question?.answered) {
      setSubmitError('This question has already been answered. You can no longer edit your answer.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Update answer with images
      await updateAnswer(questionId, editAnswerContent, editAnswerImages.length > 0 ? editAnswerImages : undefined);

      // Close dialog and refresh data
      setIsEditDialogOpen(false);

      const updatedQuestion = await getQuestionByIdFromChain(questionId);
      if (updatedQuestion) {
        setQuestion(updatedQuestion);

        // Update answers array
        setAnswers(updatedQuestion.answers);
      }

      // Show success message
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating answer:', err);
      setSubmitError(updateError?.message || 'Failed to update answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    questionId, editAnswerContent, editAnswerImages, editAnswerId, currentAccount,
    isExpired, question, updateAnswer, getQuestionByIdFromChain, updateError
  ]);

  const handleSubmitComment = useCallback(async () => {
    if (!questionId || !commentContent.trim() || !currentAccount || !commentAnswererId) return;

    // Check if question has expired first
    if (isExpired) {
      setSubmitError('This question has expired. You can no longer comment on answers.');
      return;
    }

    // Check if question is already answered
    if (question?.answered) {
      setSubmitError('This question has already been answered. You can no longer comment.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Add or edit comment with images
      if (isEditingCommentMode) {
        await editComment(questionId, commentAnswererId, commentContent,
          commentImages.length > 0 ? commentImages : undefined);
      } else {
        await addComment(questionId, commentAnswererId, commentContent,
          commentImages.length > 0 ? commentImages : undefined);
      }

      // Close dialog and reset state
      setIsCommentDialogOpen(false);
      setCommentImages([]);

      // Refresh the question and answers data
      const updatedQuestion = await getQuestionByIdFromChain(questionId);
      if (updatedQuestion) {
        setQuestion(updatedQuestion);
        setAnswers(updatedQuestion.answers || []);
      }

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error('Error submitting comment:', err);
      setSubmitError(isEditingCommentMode
        ? (editCommentError?.message || 'Failed to edit comment.')
        : (commentError?.message || 'Failed to submit comment.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    questionId, commentContent, commentImages, commentAnswererId, currentAccount, isEditingCommentMode,
    question, isExpired, editComment, addComment, getQuestionByIdFromChain,
    editCommentError, commentError
  ]);

  const handleExpiredQuestionAction = useCallback(async () => {
    if (!questionId) return;

    try {
      setIsSubmitting(true);

      await handleExpiredQuestion(questionId);

      setHandlingExpiredSuccess(true);

      // Refresh question data
      const updatedQuestion = await getQuestionByIdFromChain(questionId);
      if (updatedQuestion) {
        setQuestion(updatedQuestion);
      }

      setTimeout(() => setHandlingExpiredSuccess(false), 3000);
    } catch (err) {
      console.error('Error handling expired question:', err);
      setSubmitError(handleExpiredError?.message || 'Failed to handle expired question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [questionId, handleExpiredQuestion, getQuestionByIdFromChain, handleExpiredError]);

  // Extracted card components for reusability
  const QuestionCard = useMemo(() => {
    if (!question) return null;

    // 先处理内容，提取标签和类别
    const { cleanContent, tags, category } = processQuestionContent(question.content || '');

    // 从清理后的内容中提取标题
    const titleContent = cleanContent && cleanContent.includes('\n')
      ? cleanContent.split('\n')[0]
      : cleanContent || 'No Title';

    // 从清理后的内容中提取具体内容（去掉标题）
    const displayContent = cleanContent && cleanContent.includes('\n')
      ? cleanContent.split('\n').slice(1).join('\n')
      : '';

    // Process image paths directly, ensuring empty arrays are handled properly
    const validImages = question.images && Array.isArray(question.images) && question.images.length > 0
      ? question.images.map(img => processImageUrl(img))
      : [];

    return (
      <Card className="glass" sx={{ mb: 4, overflow: 'hidden' }}>
        {/* Question header */}
        <Box sx={{
          px: 3, pt: 3, pb: 2,
          borderBottom: isDarkMode
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(0, 0, 0, 0.1)',
        }}>
          <Typography
            variant="h4"
            gutterBottom
            sx={{ fontWeight: 600, color: isDarkMode ? 'white' : theme.palette.text.primary }}
          >
            {titleContent}
          </Typography>

          {/* 显示问题类别 */}
          {category && (
            <Box sx={{ mb: 2 }}>
              <Chip
                label={category}
                color="secondary"
                size="small"
                sx={{
                  fontWeight: 'bold',
                  background: isDarkMode
                    ? 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)'
                    : 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
                  color: 'white',
                  px: 1,
                  mr: 1
                }}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: addressToColor(question.asker), mr: 1 }}>
                {question.asker.substring(0, 1).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Asked by {formatAddress(question.asker)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(question.createTime)}
                </Typography>
              </Box>
            </Box>

            <Chip
              label={`${question.bountyAmount} SUI Bounty`}
              color="primary"
              sx={{
                fontWeight: 'bold',
                background: isDarkMode
                  ? 'linear-gradient(45deg, #9c27b0 30%, #d53f8c 90%)'
                  : 'linear-gradient(45deg, #6d5dac 30%, #8f7acf 90%)',
                px: 1
              }}
            />
          </Box>
        </Box>

        {/* Question content */}
        <CardContent sx={{ pt: 3, pb: 3 }}>
          <MarkdownContent>
            <ReactMarkdown>{displayContent}</ReactMarkdown>
          </MarkdownContent>

          {/* 添加标签显示 */}
          {tags && tags.length > 0 && (
            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Tags:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    color="primary"
                    size="small"
                    sx={{
                      bgcolor: isDarkMode
                        ? 'rgba(156, 39, 176, 0.15)'
                        : 'rgba(109, 93, 172, 0.15)',
                      border: isDarkMode
                        ? '1px solid rgba(156, 39, 176, 0.3)'
                        : '1px solid rgba(109, 93, 172, 0.3)',
                      '&:hover': {
                        bgcolor: isDarkMode
                          ? 'rgba(156, 39, 176, 0.25)'
                          : 'rgba(109, 93, 172, 0.25)',
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* 只在有有效图片时显示图片区域 */}
          {validImages.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                <ImageIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                Attachments:
              </Typography>
              <ImageList cols={Math.min(validImages.length, 3)} gap={8} sx={{ maxHeight: 200 }}>
                {validImages.map((image, index) => (
                  <ImageListItem key={index} sx={{ position: 'relative' }}>
                    <img
                      src={image}
                      alt={`Image ${index + 1}`}
                      loading="lazy"
                      style={{ borderRadius: '4px', objectFit: 'cover', height: '100%', cursor: 'zoom-in' }}
                      onClick={() => handleOpenImagePreview(image)}
                      onError={(e) => {
                        console.error("Image loading failed:", image);
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Load+Error';
                      }}
                    />
                    <IconButton
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                      }}
                      onClick={() => handleOpenImagePreview(image)}
                    >
                      <ZoomInIcon fontSize="small" />
                    </IconButton>
                  </ImageListItem>
                ))}
              </ImageList>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }, [question, isDarkMode, theme.palette.text.primary, handleOpenImagePreview]);

  // Best answer component
  const BestAnswerCard = useMemo(() => {
    if (!question?.answered || !question?.bestAnswer) return null;

    const answerContent = (() => {
      if (typeof question.bestAnswer.answerContent === 'string' && question.bestAnswer.answerContent.trim()) {
        return question.bestAnswer.answerContent;
      }

      if (Array.isArray(question.bestAnswer.answerContent)) {
        try {
          return new TextDecoder().decode(new Uint8Array(question.bestAnswer.answerContent));
        } catch (err) {
          return 'Error decoding content';
        }
      }

      return 'No content provided or invalid content format';
    })();

    // Process valid images
    const validImages = question.bestAnswer.images && Array.isArray(question.bestAnswer.images) && question.bestAnswer.images.length > 0
      ? question.bestAnswer.images.map(img => processImageUrl(img))
      : [];

    // Check if the best answer has comments - adding null check for extraContent
    const hasComments = question.bestAnswer?.extraContent && Array.isArray(question.bestAnswer.extraContent) && question.bestAnswer.extraContent.length > 0;
    const isCommentsExpanded = expandedCommentAnswerId === question.bestAnswer.id;

    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          color: isDarkMode ? 'rgba(3, 218, 198, 0.9)' : 'rgba(108, 172, 219, 0.9)',
          fontWeight: 'bold'
        }}>
          <CheckCircleIcon sx={{ mr: 1 }} />
          Best Answer
        </Typography>

        <Card sx={{
          border: isDarkMode ? '2px solid rgba(3, 218, 198, 0.5)' : '2px solid rgba(108, 172, 219, 0.5)',
          mb: 3,
          boxShadow: '0 0 15px rgba(3, 218, 198, 0.2)'
        }}>
          <CardContent sx={{ p: 3 }}>
            <MarkdownContent>
              <ReactMarkdown>{answerContent}</ReactMarkdown>
            </MarkdownContent>

            {/* Only show images if there are valid images */}
            {validImages.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <ImageIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  Attachments:
                </Typography>
                <ImageList cols={Math.min(validImages.length, 3)} gap={8} sx={{ maxHeight: 150 }}>
                  {validImages.map((image, index) => (
                    <ImageListItem key={index} sx={{ position: 'relative' }}>
                      <img
                        src={image}
                        alt={`Image ${index + 1}`}
                        loading="lazy"
                        style={{ borderRadius: '4px', objectFit: 'cover', height: '100%', cursor: 'zoom-in' }}
                        onClick={() => handleOpenImagePreview(image)}
                      />
                      <IconButton
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 5,
                          right: 5,
                          bgcolor: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                        }}
                        onClick={() => handleOpenImagePreview(image)}
                      >
                        <ZoomInIcon fontSize="small" />
                      </IconButton>
                    </ImageListItem>
                  ))}
                </ImageList>
              </Box>
            )}

            {/* Comments section for best answer */}
            {hasComments && (
              <Box mt={2}>
                <Button
                  size="small"
                  startIcon={isCommentsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => toggleComments(question.bestAnswer!.id)}
                  sx={{ mb: 1 }}
                >
                  {isCommentsExpanded ? "Hide" : "Show"} {question.bestAnswer!.extraContent!.length} {question.bestAnswer!.extraContent!.length === 1 ? "comment" : "comments"}
                </Button>

                <Collapse in={isCommentsExpanded}>
                  <List sx={{
                    bgcolor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
                    borderRadius: 1,
                    mt: 1,
                    mb: 2
                  }}>
                    {question.bestAnswer!.extraContent!.map((comment, index) => {
                      // Process valid comment images
                      const validCommentImages = comment.images && Array.isArray(comment.images) && comment.images.length > 0
                        ? comment.images.map(img => processImageUrl(img))
                        : [];

                      return (
                        <ListItem
                          key={index}
                          alignItems="flex-start"
                          sx={{ py: 1 }}
                        >
                          <ListItemAvatar sx={{ minWidth: 40 }}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                bgcolor: addressToColor(comment.answerer),
                                fontSize: '0.8rem'
                              }}
                            >
                              {comment.answerer.substring(0, 1).toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>
                                {formatAddress(comment.answerer)}
                              </Typography>
                            }
                            secondary={
                              <Typography component="div" variant="body2">
                                <Box sx={{ mt: 0.5 }}>
                                  <MarkdownContent sx={{ fontSize: '0.9rem' }}>
                                    <ReactMarkdown>
                                      {comment.answerContent}
                                    </ReactMarkdown>
                                  </MarkdownContent>
                                </Box>

                                {/* Only show images if there are valid images */}
                                {validCommentImages.length > 0 && (
                                  <Box sx={{ mt: 1, mb: 1 }}>
                                    <ImageList cols={Math.min(validCommentImages.length, 2)} gap={4} sx={{ maxHeight: 100 }}>
                                      {validCommentImages.map((image, imgIndex) => (
                                        <ImageListItem key={imgIndex} sx={{ position: 'relative' }}>
                                          <img
                                            src={image}
                                            alt={`Comment Image ${imgIndex + 1}`}
                                            loading="lazy"
                                            style={{ borderRadius: '4px', objectFit: 'cover', height: '100%', cursor: 'zoom-in' }}
                                            onClick={() => handleOpenImagePreview(image)}
                                            onError={(e) => {
                                              console.error("Comment image loading failed:", image);
                                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150?text=Image+Load+Error';
                                            }}
                                          />
                                          <IconButton
                                            size="small"
                                            sx={{
                                              position: 'absolute',
                                              top: 5,
                                              right: 5,
                                              bgcolor: 'rgba(0,0,0,0.5)',
                                              color: 'white',
                                              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                                            }}
                                            onClick={() => handleOpenImagePreview(image)}
                                          >
                                            <ZoomInIcon fontSize="small" />
                                          </IconButton>
                                        </ImageListItem>
                                      ))}
                                    </ImageList>
                                  </Box>
                                )}

                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                  {formatRelativeTime(comment.createTime)}
                                </Typography>
                              </Typography>
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            )}

            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 3,
              pt: 2,
              borderTop: isDarkMode
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.05)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{
                  width: 28,
                  height: 28,
                  bgcolor: question.bestAnswer.answerer ? addressToColor(question.bestAnswer.answerer) : '#cccccc',
                  mr: 1
                }}>
                  {question.bestAnswer.answerer ? question.bestAnswer.answerer.substring(0, 1).toUpperCase() : '?'}
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Answered by {question.bestAnswer.answerer ? formatAddress(question.bestAnswer.answerer) : 'Unknown User'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatRelativeTime(question.bestAnswer.createTime)}
                  </Typography>
                </Box>
              </Box>

              <Chip
                label="Bounty Awarded"
                color="success"
                icon={<AttachMoneyIcon />}
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }, [question, isDarkMode, handleOpenImagePreview, expandedCommentAnswerId, toggleComments]);

  // Answer list component with filtering logic
  const AnswersList = useMemo(() => {
    if (fetchingAnswers) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    // Filter answers to exclude best answer if question is answered
    const filteredAnswers = answers.filter(answer => {
      if (!answer) return false;
      return !(question?.answered && question?.bestAnswer && question.bestAnswer.id === answer.id);

    });

    if (filteredAnswers.length > 0) {
      return filteredAnswers.map(answer => {
        if (!answer) return null;

        const isBestAnswer = question?.bestAnswer && question.bestAnswer.id === answer.id;
        const isUserAnswer = currentAccount && answer.answerer === currentAccount.address;
        const hasComments = answer.extraContent && answer.extraContent.length > 0;
        const isCommentsExpanded = expandedCommentAnswerId === answer.id;

        // Process the images
        const validImages = answer.images && Array.isArray(answer.images) && answer.images.length > 0
          ? answer.images.map(img => processImageUrl(img))
          : [];

        return (
          <Card
            key={answer.id}
            className="glass-card"
            sx={{
              position: 'relative',
              border: isBestAnswer
                ? isDarkMode
                  ? '1px solid rgba(3, 218, 198, 0.5)'
                  : '1px solid rgba(108, 172, 219, 0.5)'
                : isUserAnswer
                  ? isDarkMode
                    ? '1px solid rgba(255, 193, 7, 0.5)'
                    : '1px solid rgba(255, 193, 7, 0.5)'
                  : undefined
            }}
          >
            {/* Answer status badges */}
            {isBestAnswer && (
              <Box sx={{
                position: 'absolute',
                top: -10,
                right: 20,
                bgcolor: isDarkMode ? 'rgba(3, 218, 198, 0.9)' : 'rgba(108, 172, 219, 0.9)',
                color: 'white',
                borderRadius: '12px',
                px: 2,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                zIndex: 1
              }}>
                <CheckCircleIcon fontSize="small" />
                <Typography variant="body2" fontWeight="bold">
                  Best Answer
                </Typography>
              </Box>
            )}

            {isUserAnswer && !isBestAnswer && (
              <Box sx={{
                position: 'absolute',
                top: -10,
                right: 20,
                bgcolor: 'rgba(255, 193, 7, 0.9)',
                color: 'white',
                borderRadius: '12px',
                px: 2,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                zIndex: 1
              }}>
                <Typography variant="body2" fontWeight="bold">
                  Your Answer
                </Typography>
              </Box>
            )}

            <CardContent sx={{ p: 3 }}>
              {/* Answer content */}
              <MarkdownContent>
                <ReactMarkdown>
                  {answer.answerContent.trim()
                    ? answer.answerContent
                    : Array.isArray(answer.answerContent)
                      ? new TextDecoder().decode(new Uint8Array(answer.answerContent))
                      : 'No content provided or invalid content format'}
                </ReactMarkdown>
              </MarkdownContent>

              {/* Only show images if there are valid images */}
              {validImages.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <ImageIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                    Attachments:
                  </Typography>
                  <ImageList cols={Math.min(validImages.length, 3)} gap={8} sx={{ maxHeight: 150 }}>
                    {validImages.map((image, index) => (
                      <ImageListItem key={index} sx={{ position: 'relative' }}>
                        <img
                          src={image}
                          alt={`Image ${index + 1}`}
                          loading="lazy"
                          style={{ borderRadius: '4px', objectFit: 'cover', height: '100%', cursor: 'zoom-in' }}
                          onClick={() => handleOpenImagePreview(image)}
                          onError={(e) => {
                            console.error("Answer image loading failed:", image);
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Load+Error';
                          }}
                        />
                        <IconButton
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 5,
                            right: 5,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                          }}
                          onClick={() => handleOpenImagePreview(image)}
                        >
                          <ZoomInIcon fontSize="small" />
                        </IconButton>
                      </ImageListItem>
                    ))}
                  </ImageList>
                </Box>
              )}

              {/* 添加操作按钮区域 */}
              <Box sx={{
                display: 'flex',
                mt: 2,
                pt: 2,
                borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)'
              }}>
                {/* 添加评论按钮 */}
                {renderCommentButton(answer)}

                {/* 编辑答案按钮 - 只对当前用户的答案显示 */}
                {currentAccount && answer.answerer === currentAccount.address && isActive && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenEditDialog(answer)}
                    sx={{ mr: 1 }}
                  >
                    Edit
                  </Button>
                )}

                {/* 选择最佳答案按钮 - 只对问题提问者显示 */}
                {currentAccount && question && question.asker === currentAccount.address && isActive && (
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => handleSelectBestAnswer(answer.answerer)}
                    disabled={isChoosingBest}
                    sx={{ mr: 1 }}
                  >
                    {isChoosingBest ? <CircularProgress size={24} /> : 'Choose as Best'}
                  </Button>
                )}
              </Box>

              {/* Comments section */}
              {hasComments && (
                <Box mt={2}>
                  <Button
                    size="small"
                    startIcon={isCommentsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => toggleComments(answer.id)}
                    sx={{ mb: 1 }}
                  >
                    {isCommentsExpanded ? "Hide" : "Show"} {answer.extraContent.length} {answer.extraContent.length === 1 ? "comment" : "comments"}
                  </Button>

                  <Collapse in={isCommentsExpanded}>
                    <List sx={{
                      bgcolor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: 1,
                      mt: 1,
                      mb: 2
                    }}>
                      {answer.extraContent.map((comment, index) => {
                        // Process valid comment images
                        const validCommentImages = comment.images && Array.isArray(comment.images) && comment.images.length > 0
                          ? comment.images.map(img => processImageUrl(img))
                          : [];

                        return (
                          <ListItem
                            key={index}
                            alignItems="flex-start"
                            sx={{ py: 1 }}
                            secondaryAction={
                              currentAccount &&
                              comment.answerer === currentAccount.address &&
                              isActive &&
                              question && !question.answered && (
                                <Button
                                  size="small"
                                  color="info"
                                  startIcon={<EditIcon fontSize="small" />}
                                  onClick={() => {
                                    setCommentContent(comment.answerContent);
                                    setCommentAnswererId(answer.answerer);
                                    // Set comment images if any
                                    setCommentImages([]);
                                    setIsCommentDialogOpen(true);
                                    setIsEditingCommentMode(true);
                                  }}
                                  sx={{
                                    minWidth: 'auto',
                                    px: 1,
                                    fontSize: '0.75rem',
                                    mt: -0.5,
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    zIndex: 2
                                  }}
                                >
                                  Edit
                                </Button>
                              )
                            }
                          >
                            <ListItemAvatar sx={{ minWidth: 40 }}>
                              <Avatar
                                sx={{
                                  width: 28,
                                  height: 28,
                                  bgcolor: addressToColor(comment.answerer),
                                  fontSize: '0.8rem'
                                }}
                              >
                                {comment.answerer.substring(0, 1).toUpperCase()}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>
                                  {formatAddress(comment.answerer)}
                                </Typography>
                              }
                              secondary={
                                <Typography component="div" variant="body2">
                                  <Box sx={{ mt: 0.5 }}>
                                    <MarkdownContent sx={{ fontSize: '0.9rem' }}>
                                      <ReactMarkdown>
                                        {comment.answerContent}
                                      </ReactMarkdown>
                                    </MarkdownContent>
                                  </Box>

                                  {/* Only show images if there are valid images */}
                                  {validCommentImages.length > 0 && (
                                    <Box sx={{ mt: 1, mb: 1, mr: 5 }}> {/* 添加右边距，为编辑按钮留出空间 */}
                                      <ImageList cols={Math.min(validCommentImages.length, 2)} gap={4} sx={{ maxHeight: 100 }}>
                                        {validCommentImages.map((image, imgIndex) => (
                                          <ImageListItem key={imgIndex} sx={{ position: 'relative' }}>
                                            <img
                                              src={image}
                                              alt={`Comment Image ${imgIndex + 1}`}
                                              loading="lazy"
                                              style={{ borderRadius: '4px', objectFit: 'cover', height: '100%', cursor: 'zoom-in' }}
                                              onClick={() => handleOpenImagePreview(image)}
                                              onError={(e) => {
                                                console.error("Comment image loading failed:", image);
                                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150?text=Image+Load+Error';
                                              }}
                                            />
                                            <IconButton
                                              size="small"
                                              sx={{
                                                position: 'absolute',
                                                top: 5,
                                                right: 5,
                                                bgcolor: 'rgba(0,0,0,0.5)',
                                                color: 'white',
                                                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                                              }}
                                              onClick={() => handleOpenImagePreview(image)}
                                            >
                                              <ZoomInIcon fontSize="small" />
                                            </IconButton>
                                          </ImageListItem>
                                        ))}
                                      </ImageList>
                                    </Box>
                                  )}

                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                    {formatRelativeTime(comment.createTime)}
                                  </Typography>
                                </Typography>
                              }
                              sx={{
                                // 如果有编辑按钮，则添加右边距
                                pr: currentAccount &&
                                  comment.answerer === currentAccount.address &&
                                  isActive &&
                                  question && !question.answered ? 6 : 0
                              }}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                </Box>
              )}

              {/* 其余代码保持不变 */}
            </CardContent>
          </Card>
        );
      });
    } else if (question?.answered && question?.bestAnswer) {
      return (
        <Box textAlign="center" py={2}>
          <Typography variant="body1" color="text.secondary">
            No other answers. The best answer is shown above.
          </Typography>
        </Box>
      );
    } else {
      return (
        <Box textAlign="center" py={4}>
          <Typography variant="subtitle1" color="text.secondary">
            No answers yet. Be the first to answer and earn rewards!
          </Typography>
        </Box>
      );
    }
  }, [
    answers, question, currentAccount, fetchingAnswers, isDarkMode,
    expandedCommentAnswerId, isActive, isChoosingBest,
    renderCommentButton, toggleComments, handleOpenEditDialog, handleSelectBestAnswer,
    handleOpenImagePreview, isValidImage, processImageUrl // 添加processImageUrl依赖
  ]);

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !question) {
    return (
      <Container maxWidth="lg">
        <Box my={4}>
          <Typography variant="h4" gutterBottom>
            Question Not Found
          </Typography>
          <Alert severity="error" sx={{ mt: 2, mb: 4 }}>
            {error || 'The requested question does not exist or could not be loaded.'}
          </Alert>
          <Button
            component={RouterLink}
            to="/"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            sx={{ mt: 2 }}
          >
            Back to Home
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={5}>
        {/* Back button and question stats */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 3 }}>
          <Button
            component={RouterLink}
            to="/"
            startIcon={<ArrowBackIcon />}
            variant="text"
            color="primary"
          >
            Back to Questions
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<AccessTimeIcon fontSize="small" />}
              label={timeStatus.label}
              color={timeStatus.color as "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"}
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Success notifications */}
        {(submitSuccess || selectingBestSuccess || handlingExpiredSuccess) && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <AlertTitle>Success!</AlertTitle>
            {submitSuccess ? (
              <Box>
                Your answer has been submitted successfully to the blockchain.
                {answerTxId && (
                  <Link
                    href={`https://explorer.sui.io/txblock/${answerTxId}?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}
                  >
                    View transaction <LaunchIcon fontSize="small" />
                  </Link>
                )}
              </Box>
            ) : selectingBestSuccess ? (
              <Box>
                Best answer selected successfully!
                {chooseBestTxId && (
                  <Link
                    href={`https://explorer.sui.io/txblock/${chooseBestTxId}?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}
                  >
                    View transaction <LaunchIcon fontSize="small" />
                  </Link>
                )}
              </Box>
            ) : (
              <Box>Expired question handled successfully!</Box>
            )}
          </Alert>
        )}

        {/* Question */}
        {QuestionCard}

        {/* Answers section - reorganized for better UI */}
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h5" className="neon-text-blue" sx={{ mb: 3, fontWeight: 600 }}>
            {fetchingAnswers
              ? "Loading answers..."
              : `Answers (${answers.length})`
            }
          </Typography>

          {/* Answer stats */}
          {!fetchingAnswers && Array.isArray(question?.answerers) && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {`${question.answerers.length} user${question.answerers.length !== 1 ? 's' : ''} have answered this question.`}
            </Typography>
          )}

          {/* Best Answer (if exists) */}
          {BestAnswerCard}

          {/* Other Answers */}
          {answers.length > 0 && answers.filter(answer =>
            !(question?.answered && question?.bestAnswer && question.bestAnswer.id === answer.id)
          ).length > 0 && !fetchingAnswers && (
              <Stack spacing={3}>
                {AnswersList}
              </Stack>
            )}
        </Box>

        {/* Answer submission form - only show if question is active */}
        {isActive && canAnswer() && (
          <Card className="glass" sx={{ mb: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReplyIcon />
                Your Answer
              </Typography>

              {currentAccount ? (
                <>
                  {submitError && (
                    <Alert severity="error" sx={{ mb: 3 }}>{submitError}</Alert>
                  )}

                  {/* Warning messages */}
                  {question && currentAccount && question.asker === currentAccount.address ? (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                      You cannot answer your own question. Please wait for other users to provide answers.
                    </Alert>
                  ) : question && question.answerers && question.answerers.includes(currentAccount.address) ? (
                    <Alert severity="info" sx={{ mb: 3 }}>
                      You have already answered this question. Each address can only answer once.
                    </Alert>
                  ) : (
                    <>
                      <TextField
                        fullWidth
                        multiline
                        rows={8}
                        variant="outlined"
                        placeholder="Write your answer here... You can use markdown formatting."
                        value={answerContent}
                        onChange={(e) => setAnswerContent(e.target.value)}
                        disabled={isSubmitting || isAnswerPending || (question && question.asker === currentAccount.address)}
                        sx={{
                          mb: 3,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          }
                        }}
                      />

                      {/* Image upload section */}
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Images (optional, max 5)
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Button
                            component="label"
                            variant="outlined"
                            startIcon={<UploadFileIcon />}
                            disabled={isSubmitting || isAnswerPending || answerImages.length >= 5}
                            sx={{ mr: 2 }}
                          >
                            Upload Images
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              hidden
                              onChange={handleAnswerImageUpload}
                            />
                          </Button>
                          <Typography variant="caption" color="text.secondary">
                            {answerImages.length} of 5 images uploaded
                          </Typography>
                        </Box>

                        {answerImages.length > 0 && (
                          <ImageList cols={Math.min(answerImages.length, 3)} rowHeight={100} gap={8}>
                            {answerImages.map((image, index) => (
                              <ImageListItem key={index}>
                                <img
                                  src={URL.createObjectURL(image)}
                                  alt={`Upload ${index}`}
                                  style={{ height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleAnswerImageRemove(index)}
                                  sx={{
                                    position: 'absolute',
                                    top: 5,
                                    right: 5,
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    color: 'white',
                                    '&:hover': { bgcolor: 'rgba(255,0,0,0.7)' }
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </ImageListItem>
                            ))}
                          </ImageList>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          Markdown formatting supported
                        </Typography>

                        <Button
                          variant="contained"
                          color="primary"
                          disabled={!answerContent.trim() || isSubmitting || isAnswerPending || (question && question.asker === currentAccount.address)}
                          onClick={handleSubmitAnswer}
                          sx={{ minWidth: 150 }}
                        >
                          {isSubmitting || isAnswerPending ? (
                            <CircularProgress size={24} color="inherit" />
                          ) : 'Submit Answer'}
                        </Button>
                      </Box>
                    </>
                  )}
                </>
              ) : (
                <Alert severity="info">
                  Please connect your wallet to answer this question
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Expired or resolved message */}
        {!isActive && question && (
          <Alert severity={question.answered ? "success" : "warning"} sx={{ mb: 4 }}>
            <AlertTitle>
              {question.answered ? "This question has been resolved" : "This question has expired"}
            </AlertTitle>
            {question.answered
              ? "The question author has selected the best answer and the bounty has been awarded."
              : "The time limit for this question has expired. No more answers can be submitted."}

            {/* Handle expired question button */}
            {isExpired && !question.answered && currentAccount && (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={isHandlingExpired ? <CircularProgress size={16} /> : <TimerOffIcon />}
                  onClick={handleExpiredQuestionAction}
                  disabled={isHandlingExpired || isSubmitting}
                  size="medium"
                  sx={{ fontWeight: 'medium' }}
                >
                  {isHandlingExpired ? 'Processing...' : 'Handle Expired Question'}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {currentAccount.address === question.asker
                    ? "As the question asker, you can claim back your bounty since this question has expired without being resolved."
                    : question.answerers && question.answerers.includes(currentAccount.address)
                      ? "As an answerer, handling this expired question will distribute the bounty among all answerers."
                      : "Handling this expired question will distribute bounty among answerers, with 10% reward to you for initiating."}
                </Typography>
              </Box>
            )}
          </Alert>
        )}
      </Box>

      {/* Comment dialog - Updated with image upload */}
      <Dialog
        open={isCommentDialogOpen}
        onClose={handleCloseCommentDialog}
        fullWidth
        maxWidth="sm"
        aria-labelledby="comment-dialog-title"
        disablePortal={false}
        keepMounted={false}
        disableEnforceFocus={false}
      >
        <DialogTitle id="comment-dialog-title">{isEditingCommentMode ? 'Edit Comment' : 'Add Comment'}</DialogTitle>
        <DialogContent>
          {submitError && (
            <Alert severity="error" sx={{ mb: 3, mt: 1 }}>
              {submitError}
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="Write your comment... You can use markdown formatting."
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            disabled={isSubmitting || isCommentPending}
            sx={{ mt: 2, mb: 2 }}
            autoFocus
          />

          {/* Comment image upload */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Images (optional, max 3)
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                disabled={isSubmitting || isCommentPending || commentImages.length >= 3}
                size="small"
                sx={{ mr: 2 }}
              >
                Upload Images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handleCommentImageUpload}
                />
              </Button>
              <Typography variant="caption" color="text.secondary">
                {commentImages.length} of 3 images uploaded
              </Typography>
            </Box>

            {commentImages.length > 0 && (
              <ImageList cols={Math.min(commentImages.length, 3)} rowHeight={80} gap={8}>
                {commentImages.map((image, index) => (
                  <ImageListItem key={index}>
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Comment upload ${index}`}
                      style={{ height: '80px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleCommentImageRemove(index)}
                      sx={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,0,0,0.7)' }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ImageListItem>
                ))}
              </ImageList>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Markdown formatting supported
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCommentDialog} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmitComment}
            color="primary"
            variant="contained"
            disabled={isSubmitting || isCommentPending || !commentContent.trim()}
          >
            {isSubmitting || isCommentPending ? (
              <CircularProgress size={24} color="inherit" />
            ) : 'Submit Comment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit answer dialog - Updated with better accessibility */}
      <Dialog
        open={isEditDialogOpen}
        onClose={handleCloseEditDialog}
        fullWidth
        maxWidth="md"
        aria-labelledby="edit-answer-dialog-title"
        disablePortal={false}
        keepMounted={false}
        disableEnforceFocus={false}
      >
        <DialogTitle id="edit-answer-dialog-title">Edit Your Answer</DialogTitle>
        <DialogContent>
          {updateError && (
            <Alert severity="error" sx={{ mb: 3, mt: 1 }}>
              {updateError.message}
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={10}
            variant="outlined"
            value={editAnswerContent}
            onChange={(e) => setEditAnswerContent(e.target.value)}
            disabled={isUpdating}
            sx={{ mt: 2, mb: 2 }}
          />

          {/* Edit answer image upload */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Images (optional, max 5)
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                disabled={isUpdating || editAnswerImages.length >= 5}
                sx={{ mr: 2 }}
              >
                Upload Images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handleEditAnswerImageUpload}
                />
              </Button>
              <Typography variant="caption" color="text.secondary">
                {editAnswerImages.length} of 5 images uploaded
              </Typography>
            </Box>

            {editAnswerImages.length > 0 && (
              <ImageList cols={Math.min(editAnswerImages.length, 3)} rowHeight={100} gap={8}>
                {editAnswerImages.map((image, index) => (
                  <ImageListItem key={index}>
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Edit upload ${index}`}
                      style={{ height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleEditAnswerImageRemove(index)}
                      sx={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,0,0,0.7)' }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ImageListItem>
                ))}
              </ImageList>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Markdown formatting supported
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleUpdateAnswer}
            color="primary"
            variant="contained"
            disabled={isUpdating || !editAnswerContent.trim()}
          >
            {isUpdating ? (
              <CircularProgress size={24} color="inherit" />
            ) : 'Update Answer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fix the Image Viewer Modal implementation */}
      <Modal
        open={imageViewerOpen}
        onClose={handleCloseImagePreview}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        disablePortal={false}
        keepMounted={false}
        disableEnforceFocus={false}
        aria-labelledby="image-preview-title"
      >
        <Box sx={{
          position: 'relative',
          width: '90%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 24,
          overflow: 'hidden',
          outline: 'none',
        }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-preview-title"
          onClick={handleCloseImagePreview}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: '100%',
              height: '100%',
              position: 'relative'
            }}
          >
            <Box sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 10,
              bgcolor: 'rgba(0,0,0,0.5)',
              borderRadius: '50%',
              display: 'flex'
            }}>
              <IconButton
                onClick={handleCloseImagePreview}
                sx={{ color: 'white' }}
                autoFocus
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Typography id="image-preview-title" sx={{ position: 'absolute', top: -9999, left: -9999 }}>
              Image Preview
            </Typography>
            {previewImage && (
              <Box
                component="img"
                src={previewImage}
                alt="Preview"
                sx={{
                  width: '100%',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            )}
          </Box>
        </Box>
      </Modal>
    </Container>
  );
};

export default QuestionDetailPage;