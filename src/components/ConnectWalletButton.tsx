import { Box, styled } from '@mui/material';

styled(Box)(({}) => ({
    position: "relative",
    display: "inline-block",
    "& .sui-connect-button": {
        opacity: 0,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        cursor: "pointer",
        zIndex: 2,
        "& button": {
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
        },
    },
}));
