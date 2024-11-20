import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid2'
import Button from '@mui/material/Button'
//import IconButton from '@mui/material/IconButton'
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
//import WifiIcon from '@mui/icons-material/Wifi';
import { shallow } from 'zustand/shallow'
import { NodeState, useNodeState } from '../stores/nodeStore'
import { WebsocketState, useWebsocketState } from '../stores/websocketStore'
import config from '../../config';

export default function AppToolbar() {
  const theme = useTheme()
  const { exportGraph } = useNodeState((state: NodeState) => ({ exportGraph: state.exportGraph }), shallow);
  const { sid, isConnected } = useWebsocketState((state: WebsocketState) => ({ sid: state.sid, isConnected: state.isConnected }), shallow);
  const onRun = async () => {
    if (!isConnected) {
      console.error('Not connected to WebSocket server');
      return;
    }

    const graphData = exportGraph(sid ?? '');
    
    console.log(graphData);
    
    try {
      await fetch('http://' + config.serverAddress + '/graph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphData),
      });
    } catch (error) {
      console.error('Error connecting to API server:', error);
    }
  }

  console.log('serverAddress', config.serverAddress);

  return (
    <Box sx={{
      backgroundColor: theme.palette.background.paper,
      padding: 1,
      borderBottom: `1px solid ${theme.palette.divider}`,
    }}>
      <Grid
        container
        justifyContent="space-between"
        alignItems="center"
        flexDirection={{ xs: 'column', sm: 'row' }}
      >
        <Grid sx={{ order: { xs: 2, sm: 1 } }}>
          <Typography variant="h6">
            Mellon
          </Typography>
        </Grid>
        <Grid container columnSpacing={1} sx={{ order: { xs: 1, sm: 2 } }}>
          <Grid>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={onRun}
              disabled={!isConnected}
            >
              Run
            </Button>
          </Grid>
          <Grid>
            {/*
            <IconButton sx={{ color: theme.palette.success.main }} aria-label="connection">
              <WifiIcon fontSize="small" />
            </IconButton>
            */}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  )
}
