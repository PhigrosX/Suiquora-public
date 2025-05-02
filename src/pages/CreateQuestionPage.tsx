import React, { useState, useRef } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Chip,
  InputAdornment,
  Slider,
  Divider,
  Alert,
  AlertTitle,
  CircularProgress,
  Link,
  IconButton,
  ImageList,
  ImageListItem,
  styled
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AddIcon from '@mui/icons-material/Add';
import LaunchIcon from '@mui/icons-material/Launch';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useColorMode } from '../context/ThemeContext';
import { useAskQuestion } from '../services/contractService';

// Popular tags for questions
const POPULAR_TAGS = [
  'smart-contracts',
  'sui-move',
  'gas-optimization',
  'tokens',
  'nft',
  'defi',
  'security',
  'wallet',
  'transactions',
  'storage',
  'objects',
  'tutorials',
  'debugging',
  'sui-sdk',
  'programming'
];

// 问题类别选项
const QUESTION_CATEGORIES = [
  'Development',
  'Project Discussion',
  'Ecosystem Apps',
  'Security Issues',
  'Tools Usage',
  'Others'
];

// Styled components for the image upload area
const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const ImageUploadArea = styled(Box)(({ theme }) => ({
  border: `2px dashed ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)'}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    borderColor: theme.palette.primary.main,
  },
}));

const CreateQuestionPage: React.FC = () => {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const { mode } = useColorMode();
  const isDarkMode = mode === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use blockchain interaction hooks
  const { askQuestion, isPending, error: contractError, transactionId } = useAskQuestion();

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bounty, setBounty] = useState(2); // Default 2 SUI, but here just for saving test coin
  const [expiryDays, setExpiryDays] = useState(14); // Default 14 days
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  
  // 添加类别选择状态
  const [selectedCategory, setSelectedCategory] = useState<string>('Development');
  
  // Image upload state
  const [images, setImages] = useState<File[]>([]);
  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Form validation
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');
  const [bountyError, setBountyError] = useState('');
  const [tagError, setTagError] = useState('');

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Handle title change with validation
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTitle(value);

    if (value.trim().length < 10) {
      setTitleError('Title must be at least 10 characters');
    } else if (value.trim().length > 150) {
      setTitleError('Title cannot exceed 150 characters');
    } else {
      setTitleError('');
    }
  };

  // Handle content change with validation
  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setContent(value);

    if (value.trim().length < 20) {
      setContentError('Question details must be at least 20 characters');
    } else {
      setContentError('');
    }
  };

  // Handle bounty change with validation
  const handleBountyChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    setBounty(value);

    if (value < 0.1) {
      setBountyError("Minimum bounty is 0.1 SUI");
    } else {
      setBountyError("");
    }
  };

  // Handle expiry slider change
  const handleExpiryChange = (_event: Event, newValue: number | number[]) => {
    setExpiryDays(newValue as number);
  };

  // Handle tag selection
  const handleTagSelect = (tag: string) => {
    if (selectedTags.includes(tag)) {
      // Remove tag if already selected
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      // Add tag if not already selected and limit to 5 tags
      if (selectedTags.length < 5) {
        setSelectedTags([...selectedTags, tag]);
        setTagError('');
      } else {
        setTagError('Maximum 5 tags allowed');
      }
    }
  };

  // Handle custom tag addition
  const handleAddCustomTag = () => {
    if (customTag.trim() === '') return;

    // Normalize tag (lowercase, no spaces)
    const normalizedTag = customTag.trim().toLowerCase().replace(/\s+/g, '-');

    if (normalizedTag.length < 2) {
      setTagError('Tag must be at least 2 characters');
      return;
    }

    if (normalizedTag.length > 20) {
      setTagError('Tag cannot exceed 20 characters');
      return;
    }

    if (selectedTags.includes(normalizedTag)) {
      setTagError('Tag already added');
      return;
    }

    if (selectedTags.length >= 5) {
      setTagError('Maximum 5 tags allowed');
      return;
    }

    setSelectedTags([...selectedTags, normalizedTag]);
    setCustomTag('');
    setTagError('');
  };

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Check max images limit (max 5 images)
    if (images.length + files.length > 5) {
      setImageErrors([...imageErrors, 'Maximum 5 images allowed']);
      return;
    }

    // Process each selected file
    const newImages: File[] = [];
    const newErrors: string[] = [];
    const newPreviews: string[] = [];

    Array.from(files).forEach(file => {
      // Validate file type
      if (!file.type.match('image/(jpeg|jpg|png|gif|webp)')) {
        newErrors.push(`File "${file.name}" is not a supported image format. Use JPG, PNG, GIF, or WebP.`);
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        newErrors.push(`File "${file.name}" exceeds the 5MB size limit.`);
        return;
      }

      // Create image preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newPreviews.push(e.target.result as string);
          setImagePreviews(current => [...current, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);

      // Add to new images array
      newImages.push(file);
    });

    // Update state
    setImages(current => [...current, ...newImages]);
    if (newErrors.length > 0) {
      setImageErrors(current => [...current, ...newErrors]);
    }

    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  // Remove an image
  const handleRemoveImage = (index: number) => {
    const newImages = [...images];
    const newPreviews = [...imagePreviews];
    
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);
    
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  // Trigger file input click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    let hasError = false;

    if (!title.trim()) {
      setTitleError('Title is required');
      hasError = true;
    } else if (title.trim().length < 10) {
      setTitleError('Title must be at least 10 characters');
      hasError = true;
    } else {
      setTitleError('');
    }

    if (!content.trim()) {
      setContentError('Content is required');
      hasError = true;
    } else if (content.trim().length < 20) {
      setContentError('Question details must be at least 20 characters');
      hasError = true;
    } else {
      setContentError('');
    }

    if (bounty < 0.1) {
      setBountyError("Minimum bounty is 0.1 SUI");
      hasError = true;
    } else {
      setBountyError("");
    }

    if (hasError) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // 将标签添加到内容中
      let processedContent = content;
      if (selectedTags.length > 0) {
        // 使用TAGS:格式添加标签，以便extractTagsFromContent函数可以识别
        processedContent = `${content}\n\nTAGS:${selectedTags.join(',')}`;
      }
      
      // 添加类别信息
      if (selectedCategory) {
        processedContent = `${processedContent}\n\nCATEGORY:${selectedCategory}`;
      }
      
      // Combine title and content into a single string, as the smart contract accepts a single content field
      const combinedContent = `${title}\n\n${processedContent}`;
      
      // Convert bounty to an integer value since the contract can't handle decimals
      // The blockchain requires an integer value
      const bountyInteger = Math.round(bounty);
      
      // Call contract to create question with images and custom expiry time
      await askQuestion(combinedContent, bountyInteger, images, expiryDays);
      setSubmitSuccess(true);

      // Navigate back to home page after successful submission
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error submitting question:', error);
      setSubmitError(contractError?.message || 'Failed to submit question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentAccount) {
    return (
        <Container maxWidth="lg">
          <Box my={4}>
            <Typography variant="h4" gutterBottom>
              Ask a Question
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <AlertTitle>Wallet Connection Required</AlertTitle>
              Please connect your wallet to ask a question and set a bounty.
            </Alert>
            <Button
                component={RouterLink}
                to="/"
                startIcon={<ArrowBackIcon />}
                variant="outlined"
                sx={{ mt: 3 }}
            >
              Back to Home
            </Button>
          </Box>
        </Container>
    );
  }

  return (
      <Container maxWidth="lg">
        <Box my={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Button
                component={RouterLink}
                to="/"
                startIcon={<ArrowBackIcon />}
                variant="text"
                color="primary"
                sx={{ mr: 2 }}
            >
              Back
            </Button>
            <Typography variant="h4" component="h1">
              Ask a Question
            </Typography>
          </Box>

          {submitSuccess ? (
              <Alert severity="success" sx={{ my: 2 }}>
                <AlertTitle>Success!</AlertTitle>
                Your question has been submitted successfully to the blockchain.
                {transactionId && (
                    <Box mt={1}>
                      <Link
                          href={`https://explorer.sui.io/txblock/${transactionId}?network=testnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        View transaction <LaunchIcon fontSize="small" />
                      </Link>
                    </Box>
                )}
                <Box mt={1}>You will be redirected to the homepage shortly.</Box>
              </Alert>
          ) : (
              <Card className="glass">
                <CardContent sx={{ p: 3 }}>
                  {submitError && (
                      <Alert severity="error" sx={{ mb: 3 }}>
                        {submitError}
                      </Alert>
                  )}

                  <form onSubmit={handleSubmit}>
                    <Box mb={4}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        Question Title
                      </Typography>
                      <TextField
                          fullWidth
                          variant="outlined"
                          placeholder="e.g., How to implement a fungible token on Sui?"
                          value={title}
                          onChange={handleTitleChange}
                          error={!!titleError}
                          helperText={titleError || "Be specific and imagine you're asking a question to another person"}
                          disabled={isSubmitting || isPending}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }
                          }}
                      />
                    </Box>

                    <Box mb={4}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        Question Details
                      </Typography>
                      <TextField
                          fullWidth
                          multiline
                          rows={12}
                          variant="outlined"
                          placeholder="Describe your problem in detail, include code samples and what you've tried so far..."
                          value={content}
                          onChange={handleContentChange}
                          error={!!contentError}
                          helperText={contentError || 'Markdown formatting supported. Include all the information someone would need to answer your question.'}
                          disabled={isSubmitting || isPending}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }
                          }}
                      />
                    </Box>

                    {/* 添加问题类别选择区域 */}
                    <Box mb={4}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        Question Category
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Select the most appropriate category for your question
                      </Typography>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {QUESTION_CATEGORIES.map(category => (
                          <Chip
                            key={category}
                            label={category}
                            onClick={() => setSelectedCategory(category)}
                            variant={selectedCategory === category ? "filled" : "outlined"}
                            color="primary"
                            disabled={isSubmitting || isPending}
                            sx={{
                              bgcolor: selectedCategory === category
                                ? (isDarkMode
                                  ? 'rgba(156, 39, 176, 0.2)'
                                  : 'rgba(109, 93, 172, 0.2)')
                                : 'transparent',
                              border: selectedCategory === category
                                ? (isDarkMode
                                  ? '1px solid rgba(156, 39, 176, 0.5)'
                                  : '1px solid rgba(109, 93, 172, 0.5)')
                                : undefined,
                              '&:hover': {
                                bgcolor: isDarkMode
                                  ? 'rgba(156, 39, 176, 0.3)'
                                  : 'rgba(109, 93, 172, 0.3)',
                              }
                            }}
                          />
                        ))}
                      </Box>
                    </Box>

                    <Box mb={4}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        Tags
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Add up to 5 tags to describe what your question is about
                      </Typography>

                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                          {selectedTags.map(tag => (
                              <Chip
                                  key={tag}
                                  label={tag}
                                  onDelete={() => handleTagSelect(tag)}
                                  color="primary"
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

                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField
                              size="small"
                              placeholder="Add custom tag"
                              value={customTag}
                              onChange={e => setCustomTag(e.target.value)}
                              disabled={selectedTags.length >= 5 || isSubmitting || isPending}
                              onKeyPress={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomTag();
                                }
                              }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                }
                              }}
                          />
                          <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={handleAddCustomTag}
                              disabled={selectedTags.length >= 5 || !customTag.trim() || isSubmitting || isPending}
                          >
                            Add
                          </Button>
                        </Box>

                        {tagError && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                              {tagError}
                            </Typography>
                        )}
                      </Box>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Popular Tags:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {POPULAR_TAGS.map(tag => (
                            <Chip
                                key={tag}
                                label={tag}
                                onClick={() => handleTagSelect(tag)}
                                variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                                color="primary"
                                disabled={isSubmitting || isPending || (selectedTags.length >= 5 && !selectedTags.includes(tag))}
                                sx={{
                                  bgcolor: selectedTags.includes(tag)
                                      ? (isDarkMode
                                          ? 'rgba(156, 39, 176, 0.15)'
                                          : 'rgba(109, 93, 172, 0.15)')
                                      : 'transparent',
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

                    <Box mb={4}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        Add Images
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Add up to 5 images to illustrate your question (optional)
                      </Typography>
                      
                      {/* Hidden file input */}
                      <VisuallyHiddenInput
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                      />
                      
                      {/* Upload area */}
                      {images.length < 5 && (
                        <ImageUploadArea onClick={handleUploadClick} sx={{ mb: 2 }}>
                          <AddPhotoAlternateIcon sx={{ fontSize: 40, mb: 1, color: 'primary.main' }} />
                          <Typography variant="body1" gutterBottom>
                            Click to upload images
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            JPG, PNG, GIF, or WebP. Max 5MB per image.
                          </Typography>
                        </ImageUploadArea>
                      )}
                      
                      {/* Error messages */}
                      {imageErrors.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          {imageErrors.map((error, index) => (
                            <Typography key={index} variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                              {error}
                            </Typography>
                          ))}
                          <Button 
                            size="small" 
                            sx={{ mt: 1 }}
                            onClick={() => setImageErrors([])}
                          >
                            Clear Errors
                          </Button>
                        </Box>
                      )}
                      
                      {/* Image preview */}
                      {imagePreviews.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Uploaded Images ({imagePreviews.length}/5)
                          </Typography>
                          <ImageList cols={3} rowHeight={164} gap={8} sx={{ overflow: 'hidden' }}>
                            {imagePreviews.map((preview, index) => (
                              <ImageListItem key={index} sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden' }}>
                                <img
                                  src={preview}
                                  alt={`Preview ${index + 1}`}
                                  loading="lazy"
                                  style={{ objectFit: 'cover', height: '100%' }}
                                />
                                <IconButton
                                  aria-label="delete"
                                  size="small"
                                  onClick={() => handleRemoveImage(index)}
                                  sx={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                                    color: 'white',
                                    '&:hover': {
                                      bgcolor: 'rgba(0, 0, 0, 0.7)',
                                    }
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </ImageListItem>
                            ))}
                          </ImageList>
                        </Box>
                      )}
                    </Box>

                    <Divider sx={{ my: 4 }} />

                    <Box mb={4}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        Bounty Amount
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Set a bounty for the best answer to your question (minimum 0.1 SUI)
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <TextField
                            type="number"
                            variant="outlined"
                            value={bounty}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              setBounty(isNaN(value) ? 0 : value);

                              if (value < 0.1) {
                                setBountyError('Minimum bounty is 0.1 SUI');
                              } else {
                                setBountyError('');
                              }
                            }}
                            InputProps={{
                              startAdornment: (
                                  <InputAdornment position="start">
                                    <AttachMoneyIcon />
                                  </InputAdornment>
                              ),
                              endAdornment: (
                                  <InputAdornment position="end">
                                    SUI
                                  </InputAdornment>
                              ),
                            }}
                            disabled={isSubmitting || isPending}
                            error={!!bountyError}
                            sx={{ width: 200 }}
                        />

                        <Typography variant="body1" fontWeight="medium">
                          ≈ ${(bounty * 0.82).toFixed(2)} USD
                        </Typography>
                      </Box>

                      {bountyError && (
                          <Typography variant="caption" color="error">
                            {bountyError}
                          </Typography>
                      )}

                      <Box sx={{ px: 1, mt: 2 }}>
                        <Slider
                            value={bounty}
                            onChange={handleBountyChange}
                            min={0.1}
                            max={10}
                            step={0.1}
                            marks={[
                              { value: 0.1, label: '0.1' },
                              { value: 2, label: '2' },
                              { value: 5, label: '5' },
                              { value: 10, label: '10' },
                            ]}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${value} SUI`}
                            disabled={isSubmitting || isPending}
                        />
                      </Box>
                    </Box>

                    <Box mb={4}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        Bounty Expiry
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Set how long your question will remain open for answers (1-30 days)
                      </Typography>

                      <div className="space-y-1">
                        <div className="text-xs text-green-600 mb-2">
                          You can now set a custom expiry time between 1 and 30 days
                        </div>
                        <Slider
                            value={expiryDays}
                            onChange={handleExpiryChange}
                            min={1}
                            max={30}
                            step={1}
                            aria-label="Bounty Expiry"
                            disabled={isSubmitting || isPending}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value: number) => `${value} day${value !== 1 ? 's' : ''}`}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>1 day</span>
                          <span className="text-center">15 days (default)</span>
                          <span>30 days</span>
                        </div>
                      </div>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4 }}>
                      <Button
                          variant="outlined"
                          component={RouterLink}
                          to="/"
                          disabled={isSubmitting || isPending}
                      >
                        Cancel
                      </Button>

                      <Button
                          type="submit"
                          variant="contained"
                          color="primary"
                          size="large"
                          disabled={isSubmitting || isPending}
                          sx={{ minWidth: 150 }}
                      >
                        {(isSubmitting || isPending) ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            'Submit Question'
                        )}
                      </Button>
                    </Box>
                  </form>
                </CardContent>
              </Card>
          )}
        </Box>
      </Container>
  );
};

export default CreateQuestionPage;