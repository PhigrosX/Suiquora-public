import React, { useEffect } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Avatar,
  Fade,
  useTheme,
} from "@mui/material";
import { useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import { formatAddress, addressToColor } from "../utils";
import { useColorMode } from "../context/ThemeContext";

const WalletConnection: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const disconnectWallet = useDisconnectWallet();
  const navigate = useNavigate(); // 导入 useNavigate 钩子
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [copySuccess, setCopySuccess] = React.useState(false);
  const open = Boolean(anchorEl);
  const theme = useTheme();
  const { mode } = useColorMode();
  const isDarkMode = mode === "dark";

  // 监控钱包连接状态，一旦断开立即跳转
  useEffect(() => {
    if (disconnectWallet.isSuccess) {
      // 钱包断开连接后跳转到首页
      navigate("/");
    }
  }, [disconnectWallet.isSuccess, navigate]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCopyAddress = () => {
    if (currentAccount?.address) {
      navigator.clipboard
        .writeText(currentAccount.address)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch((err) => {
          console.error("Copy failed: ", err);
        });
    }
    handleClose();
  };

  const handleDisconnect = () => {
    disconnectWallet.mutate();
    handleClose();
    // 直接触发导航 - 不必等待 useEffect
    navigate("/");
  };

  if (!currentAccount) {
    return null; // ConnectButton will be handled by Layout component
  }

  return (
    <Box>
      <Chip
        avatar={
          <Avatar
            sx={{
              bgcolor: addressToColor(currentAccount.address),
              fontWeight: "bold",
              color: "#fff",
            }}
          >
            {currentAccount.address.substring(0, 1).toUpperCase()}
          </Avatar>
        }
        label={formatAddress(currentAccount.address)}
        onClick={handleClick}
        sx={{
          borderRadius: "20px",
          py: 0.7,
          px: 0.5,
          background: isDarkMode
            ? "rgba(37, 38, 75, 0.5)"
            : "rgba(255, 255, 255, 0.6)",
          backdropFilter: "blur(5px)",
          border: isDarkMode
            ? "1px solid rgba(255, 255, 255, 0.15)"
            : "1px solid rgba(255, 255, 255, 0.7)",
          boxShadow: isDarkMode
            ? "0 4px 20px rgba(0, 0, 0, 0.2)"
            : "0 4px 20px rgba(109, 93, 172, 0.1)",
          cursor: "pointer",
          transition: "all 0.3s ease",
          fontWeight: 500,
          color: isDarkMode ? "white" : theme.palette.text.primary,
          "&:hover": {
            boxShadow: isDarkMode
              ? "0 6px 25px rgba(156, 39, 176, 0.25)"
              : "0 6px 25px rgba(109, 93, 172, 0.2)",
            borderColor: isDarkMode
              ? "rgba(156, 39, 176, 0.3)"
              : "rgba(109, 93, 172, 0.3)",
            transform: "translateY(-2px)",
          },
        }}
      />

      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: "visible",
            backdropFilter: "blur(10px)",
            background: isDarkMode
              ? "rgba(37, 38, 75, 0.8)"
              : "rgba(255, 255, 255, 0.8)",
            border: isDarkMode
              ? "1px solid rgba(255, 255, 255, 0.1)"
              : "1px solid rgba(255, 255, 255, 0.7)",
            borderRadius: 2,
            minWidth: 200,
            mt: 1.5,
            "& .MuiMenuItem-root": {
              px: 1.5,
              py: 1.2,
              borderRadius: 1,
              my: 0.5,
              color: isDarkMode ? "white" : theme.palette.text.primary,
              "&:hover": {
                background: isDarkMode
                  ? "rgba(156, 39, 176, 0.15)"
                  : "rgba(109, 93, 172, 0.15)",
              },
            },
          },
        }}
        TransitionComponent={Fade}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <Box sx={{ px: 2, py: 1, textAlign: "center" }}>
          <Typography
            variant="subtitle2"
            sx={{
              opacity: 0.7,
              color: isDarkMode ? "white" : theme.palette.text.primary,
            }}
          >
            Connected Wallet
          </Typography>
        </Box>

        <MenuItem onClick={handleCopyAddress}>
          <ListItemIcon>
            <ContentCopyIcon
              fontSize="small"
              sx={{
                color: isDarkMode
                  ? "rgba(255, 255, 255, 0.7)"
                  : "rgba(46, 53, 89, 0.7)",
              }}
            />
          </ListItemIcon>
          <ListItemText>
            {copySuccess ? "Copied!" : "Copy Address"}
          </ListItemText>
        </MenuItem>

        <MenuItem
          component={RouterLink}
          to={`/profile/${currentAccount.address}`}
        >
          <ListItemIcon>
            <PersonIcon
              fontSize="small"
              sx={{
                color: isDarkMode
                  ? "rgba(255, 255, 255, 0.7)"
                  : "rgba(46, 53, 89, 0.7)",
              }}
            />
          </ListItemIcon>
          <ListItemText>My Profile</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleDisconnect}>
          <ListItemIcon>
            <LogoutIcon
              fontSize="small"
              sx={{
                color: isDarkMode
                  ? "rgba(255, 255, 255, 0.7)"
                  : "rgba(46, 53, 89, 0.7)",
              }}
            />
          </ListItemIcon>
          <ListItemText>Disconnect</ListItemText>
        </MenuItem>
      </Menu>

      {copySuccess && (
        <Tooltip
          open={true}
          title="Address copied to clipboard!"
          placement="bottom"
          arrow
        >
          <span></span>
        </Tooltip>
      )}
    </Box>
  );
};

export default WalletConnection;
