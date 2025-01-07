import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {ReactFlowProvider } from '@xyflow/react'

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";

import { WebSocketProvider } from './components/WebsocketContext';
import { useState } from 'react';

// Workflow theme (darker)
const workflowTheme = createTheme({
  components: {
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffa726',
      light: '#ffb851',
      dark: '#f57c00',
    },
    secondary: {
      main: '#00838f',
      light: '#4fb3bf',
      dark: '#005662',
    },
    background: {
      default: '#121212',
      paper: '#1a1a1a',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  typography: {
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
  },
});

// Tool theme (lighter)
const toolTheme = createTheme({
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Target all possible edge-related elements
        '.react-flow__edge *, .react-flow__connection *': {
          stroke: '#ffa726 !important',
          strokeWidth: '2 !important',
        },
        '.react-flow__edge': {
          '& .react-flow__edge-path': {
            stroke: '#ffa726 !important',
            strokeWidth: '2 !important',
          },
          '& .react-flow__edge-background, & .react-flow__edge-outline': {
            stroke: 'none !important',
          },
          '&.selected': {
            '& .react-flow__edge-path': {
              stroke: '#f57c00 !important',
            }
          },
          '&:hover': {
            '& .react-flow__edge-path': {
              stroke: '#f57c00 !important',
            }
          }
        },
        // Remove any interaction outlines
        '.react-flow__edge-interaction, .react-flow__connection-interaction': {
          stroke: 'none !important',
          fill: 'none !important'
        },
        // Style the connection lines
        '.react-flow__connection': {
          '& .react-flow__connection-path': {
            stroke: '#ffa726 !important',
            strokeWidth: '2 !important',
          }
        },
        // Remove any additional strokes or outlines
        '.react-flow__edge-background, .react-flow__connection-background': {
          stroke: 'none !important',
          fill: 'none !important'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          color: '#2d3748'
        }
      }
    }
  },
  palette: {
    mode: 'light',
    background: {
      default: '#e6e9f0',
      paper: '#f0f4fa'
    },
    primary: {
      main: '#ffa726',
      light: '#ffb851',
      dark: '#f57c00'
    },
    secondary: {
      main: '#8794c7',
      light: '#a6b1e1',
      dark: '#6b7ab0'
    },
    text: {
      primary: '#2d3748',
      secondary: '#4a5568'
    },
    divider: 'rgba(0, 0, 0, 0.06)',
    action: {
      hover: 'rgba(0, 0, 0, 0.04)',
      selected: 'rgba(0, 0, 0, 0.08)',
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)'
    }
  },
  typography: {
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
  },
});

import App from './App.tsx'
import Box from '@mui/material/Box';
import ToolBar from './components/ToolBar.tsx';
import ActionBar from './components/ActionBar.tsx';

// Create a context for the view mode
import { createContext } from 'react';
export const ViewModeContext = createContext({ 
  viewMode: 'workflow',
  setViewMode: (mode: string) => {},
});

function Root() {
  const [viewMode, setViewMode] = useState('workflow');
  const theme = viewMode === 'workflow' ? workflowTheme : toolTheme;

  return (
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
          <ReactFlowProvider>
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
              width: '100vw',
              overflow: 'hidden',
            }}>
              <ActionBar />
              <Box sx={{
                display: 'flex',
                flex: 1,
                minHeight: 0,
                height: '100%',
              }}>
                <ToolBar />
                <Box sx={{ flex: 1, height: '100%' }}>
                  <App />          
                </Box>
              </Box>
            </Box>
          </ReactFlowProvider>
        </ViewModeContext.Provider>
      </ThemeProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
