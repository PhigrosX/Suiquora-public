import React from "react";
import { IconButton, Tooltip, useTheme } from "@mui/material";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useColorMode } from "../context/ThemeContext";

const ThemeToggleButton: React.FC = () => {
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const isDarkMode = mode === "dark";

  return (
    <Tooltip
      title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <IconButton
        onClick={toggleColorMode}
        color="inherit"
        sx={{
          ml: 1,
          p: 1,
          borderRadius: "50%",
          backdropFilter: "blur(5px)",
          bgcolor: "rgba(255, 255, 255, 0.1)",
          transition: "all 0.3s ease",
          "&:hover": {
            bgcolor: "rgba(255, 255, 255, 0.2)",
            transform: "scale(1.1)",
          },
        }}
      >
        {isDarkMode ? (
          <Brightness7Icon sx={{ color: theme.palette.warning.light }} />
        ) : (
          <Brightness4Icon sx={{ color: theme.palette.primary.light }} />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggleButton;
