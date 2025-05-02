import React from 'react';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import {
    AppBar,
    Box,
    Toolbar,
    Typography,
    Container,
    useTheme,
    useMediaQuery,
    Link,
    Stack
} from '@mui/material';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import WalletConnection from './WalletConnection';
import ThemeToggleButton from './ThemeToggleButton';
import PublicIcon from '@mui/icons-material/Public';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useColorMode } from '../context/ThemeContext';
import image_light from "../images/saturated_logo.png";
import image_dark from "../images/saturated_logo_light_for_dark_bg.png";

const BackgroundDots = () => {
    useTheme();
    const { mode } = useColorMode();
    const isDarkMode = mode === 'dark';

    const createDots = () => {
        const dots = [];
        for (let i = 0; i < 10; i++) {
            const size = Math.random() * 100 + 50;
            const top = Math.random() * 100;
            const left = Math.random() * 100;
            const bg = isDarkMode
                ? (Math.random() > 0.5
                    ? 'rgba(156, 39, 176, 0.2)'
                    : 'rgba(3, 218, 198, 0.2)')
                : (Math.random() > 0.5
                    ? 'rgba(109, 93, 172, 0.15)'
                    : 'rgba(108, 172, 219, 0.15)');

            dots.push(
                <div
                    key={i}
                    className="glow-dot"
                    style={{
                        width: size,
                        height: size,
                        top: `${top}vh`,
                        left: `${left}vw`,
                        backgroundColor: bg,
                        animationDelay: `${i * 0.5}s`
                    }}
                />
            );
        }
        return dots;
    };

    return <>{createDots()}</>;
};

const Layout: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const currentAccount = useCurrentAccount();
    const { mode } = useColorMode();
    const isDarkMode = mode === 'dark';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
            <BackgroundDots />

            <AppBar position="sticky" elevation={0} className="glass">
                <Toolbar sx={{ justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box ml={-2} mr={3}>
                            <Link component={RouterLink} to={"/"}>
                                {isDarkMode ?
                                    <img src={image_dark} width={75} height={75} /> :
                                    <img src={image_light} width={80} height={75} />}
                            </Link>
                        </Box>
                        {!isMobile && (
                            <Stack direction="row" spacing={3}>
                                <Link
                                    component={RouterLink}
                                    to="/"
                                    sx={{
                                        color: isDarkMode ? 'white' : theme.palette.text.primary,
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        '&:hover': {
                                            color: theme.palette.primary.light
                                        }
                                    }}
                                >
                                    <PublicIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
                                    Explore
                                </Link>

                                <Link
                                    component={RouterLink}
                                    to="/create-question"
                                    sx={{
                                        color: isDarkMode ? 'white' : theme.palette.text.primary,
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        '&:hover': {
                                            color: theme.palette.secondary.light
                                        }
                                    }}
                                >
                                    <AddCircleOutlineIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
                                    Ask Question
                                </Link>

                                {currentAccount && (
                                    <Link
                                        component={RouterLink}
                                        to={`/profile/${currentAccount.address}`}
                                        sx={{
                                            color: isDarkMode ? 'white' : theme.palette.text.primary,
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            '&:hover': {
                                                color: theme.palette.info.light
                                            }
                                        }}
                                    >
                                        <AccountCircleIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
                                        My Profile
                                    </Link>
                                )}
                            </Stack>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ThemeToggleButton />
                        {currentAccount ? <WalletConnection /> : <ConnectButton />}
                    </Box>
                </Toolbar>
            </AppBar>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    py: 4,
                    minHeight: 'calc(100vh - 64px - 80px)',
                    position: 'relative',
                    zIndex: 1
                }}
            >
                <Outlet />
            </Box>

            <Box
                component="footer"
                sx={{
                    py: 3,
                    backdropFilter: 'blur(10px)',
                    background: isDarkMode
                        ? 'rgba(18, 18, 37, 0.7)'
                        : 'rgba(237, 240, 245, 0.7)',
                    borderTop: isDarkMode
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(255, 255, 255, 0.5)',
                    position: 'relative',
                    zIndex: 1
                }}
            >
                <Container maxWidth="lg">
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        align="center"
                        className={isDarkMode ? "neon-text-blue" : ""}
                    >
                        SuiQuora - Decentralized Q&A Platform on Sui blockchain
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
};

export default Layout; 