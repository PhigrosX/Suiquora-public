import React from 'react';
import {
    Box,
    Typography,
    Avatar,
    Skeleton,
    Stack,
    Card,
    CardContent,
    useTheme,
    LinearProgress
} from '@mui/material';
import { useUser } from '../context/UserContext.tsx';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatAddress, addressToColor } from '../utils';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CommentIcon from '@mui/icons-material/Comment';
import { useColorMode } from '../context/ThemeContext.tsx';

interface UserInfoProps {
    stats?: {
        userAddress?: string;
        questionsCount: number;
        answersCount: number;
        commentsCount: number;
        bestAnswersCount: number;
        totalBountyEarned: number;
    };
    isLoading?: boolean;
}

const UserInfo: React.FC<UserInfoProps> = ({ stats, isLoading = false }) => {
    const { user } = useUser();
    const currentAccount = useCurrentAccount();
    const theme = useTheme();
    const { mode } = useColorMode();
    const isDarkMode = mode === 'dark';

    // Use provided stats or defaults
    const userStats = stats || {
        userAddress: currentAccount?.address,
        questionsCount: 0,
        answersCount: 0,
        commentsCount: 0,
        bestAnswersCount: 0,
        totalBountyEarned: 0
    };

    // Check if wallet address in stats doesn't match current wallet
    const isAddressMismatch = currentAccount && stats?.userAddress &&
        currentAccount.address !== stats.userAddress;

    // Effective loading state = provided loading state OR address mismatch
    const showLoading = isLoading || isAddressMismatch;

    if (!currentAccount) {
        return (
            <Card
                className="glass"
                sx={{ mb: 3, overflow: 'hidden' }}
            >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="subtitle1">
                        Please connect your wallet to see your profile information.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card
            className="glass"
            sx={{
                mb: 3,
                overflow: 'hidden',
                borderRadius: '16px',
                position: 'relative',
            }}
        >
            {/* Gradient header background */}
            <Box
                sx={{
                    height: '100px',
                    background: isDarkMode
                        ? 'linear-gradient(135deg, rgba(156, 39, 176, 0.6) 0%, rgba(3, 218, 198, 0.6) 100%)'
                        : 'linear-gradient(135deg, rgba(109, 93, 172, 0.6) 0%, rgba(108, 172, 219, 0.6) 100%)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Particle decoration */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        background: 'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.2) 0%, transparent 25%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.2) 0%, transparent 25%)',
                        opacity: 0.6
                    }}
                />
            </Box>

            <CardContent sx={{ mt: -5, px: 3, pb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                    <Avatar
                        sx={{
                            width: 90,
                            height: 90,
                            border: isDarkMode
                                ? '4px solid rgba(37, 38, 75, 0.7)'
                                : '4px solid rgba(255, 255, 255, 0.7)',
                            bgcolor: addressToColor(currentAccount.address),
                            fontSize: '2rem',
                            boxShadow: isDarkMode
                                ? '0 4px 20px rgba(0, 0, 0, 0.4)'
                                : '0 4px 20px rgba(109, 93, 172, 0.2)'
                        }}
                    >
                        {currentAccount.address.substring(0, 1).toUpperCase()}
                    </Avatar>

                    <Box sx={{ ml: 2, mb: 1 }}>
                        <Typography
                            variant="h5"
                            className="gradient-text"
                            sx={{ fontWeight: 'bold' }}
                        >
                            {user.isLoadingProfile ? (
                                <Skeleton width={150} />
                            ) : (
                                "Sui User"
                            )}
                        </Typography>

                        <Typography
                            variant="body1"
                            sx={{
                                backdropFilter: 'blur(10px)',
                                background: isDarkMode
                                    ? 'rgba(156, 39, 176, 0.1)'
                                    : 'rgba(109, 93, 172, 0.1)',
                                border: isDarkMode
                                    ? '1px solid rgba(156, 39, 176, 0.3)'
                                    : '1px solid rgba(109, 93, 172, 0.3)',
                                borderRadius: '12px',
                                px: 1.5,
                                py: 0.5,
                                fontFamily: 'monospace',
                                letterSpacing: '0.5px',
                                color: isDarkMode ? 'white' : theme.palette.text.primary
                            }}
                        >
                            {formatAddress(currentAccount.address, 8, 8)}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Wallet Address
                    </Typography>
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: isDarkMode
                                ? 'rgba(37, 38, 75, 0.5)'
                                : 'rgba(255, 255, 255, 0.6)',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            wordBreak: 'break-all',
                            border: isDarkMode
                                ? '1px solid rgba(255, 255, 255, 0.05)'
                                : '1px solid rgba(255, 255, 255, 0.5)',
                            color: isDarkMode ? 'white' : theme.palette.text.primary
                        }}
                    >
                        {currentAccount.address}
                    </Box>
                </Box>

                {showLoading ? (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Loading stats...
                        </Typography>
                        <LinearProgress
                            sx={{
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: isDarkMode
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(109, 93, 172, 0.1)',
                                '.MuiLinearProgress-bar': {
                                    background: isDarkMode
                                        ? 'linear-gradient(90deg, #9c27b0, #03dac6)'
                                        : 'linear-gradient(90deg, #6d5dac, #6cacdb)'
                                }
                            }}
                        />
                    </Box>
                ) : (
                    <Stack direction="row" spacing={2} mt={3}>
                        <Card
                            className="glass-card"
                            sx={{
                                flex: 1,
                                textAlign: 'center',
                                p: 2,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                }
                            }}
                        >
                            <QuestionAnswerIcon
                                sx={{
                                    color: theme.palette.primary.light,
                                    mb: 1,
                                    fontSize: '2rem'
                                }}
                            />
                            <Typography variant="h5" className="neon-text">{userStats.questionsCount}</Typography>
                            <Typography variant="body2" color="text.secondary">Questions</Typography>
                        </Card>

                        <Card
                            className="glass-card"
                            sx={{
                                flex: 1,
                                textAlign: 'center',
                                p: 2,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                }
                            }}
                        >
                            <PeopleAltIcon
                                sx={{
                                    color: theme.palette.info.main,
                                    mb: 1,
                                    fontSize: '2rem'
                                }}
                            />
                            <Typography variant="h5" className="neon-text-blue">{userStats.answersCount}</Typography>
                            <Typography variant="body2" color="text.secondary">Answers</Typography>
                        </Card>

                        <Card
                            className="glass-card"
                            sx={{
                                flex: 1,
                                textAlign: 'center',
                                p: 2,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                }
                            }}
                        >
                            <CommentIcon
                                sx={{
                                    color: theme.palette.warning.main,
                                    mb: 1,
                                    fontSize: '2rem'
                                }}
                            />
                            <Typography variant="h5" className="neon-text-yellow">{userStats.commentsCount}</Typography>
                            <Typography variant="body2" color="text.secondary">Comments</Typography>
                        </Card>

                        <Card
                            className="glass-card"
                            sx={{
                                flex: 1,
                                textAlign: 'center',
                                p: 2,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                }
                            }}
                        >
                            <AttachMoneyIcon
                                sx={{
                                    color: theme.palette.success.main,
                                    mb: 1,
                                    fontSize: '2rem'
                                }}
                            />
                            <Typography variant="h5" className="neon-text-green">{userStats.totalBountyEarned}</Typography>
                            <Typography variant="body2" color="text.secondary">SUI Earned</Typography>
                        </Card>
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
}

export default UserInfo;