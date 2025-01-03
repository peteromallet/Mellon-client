import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { shallow } from 'zustand/shallow'
import { useNodeState } from '../stores/nodeStore'

// Icons
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';

export default function AppToolbar() {
  const { setNodes, setEdges, toObject, setViewport } = useReactFlow();
  const { initializeNodes } = useNodeState(state => ({ initializeNodes: state.initializeNodes }), shallow);
  const theme = useTheme();

  const onExport = useCallback(() => {
    const flow = toObject();
    const jsonString = JSON.stringify(flow, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workflow.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [toObject]);

  const onAddNode = useCallback(() => {
    console.log('Adding new node');
    initializeNodes();
  }, [initializeNodes]);

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      p: 1,
      borderBottom: 1,
      borderColor: 'divider',
      backgroundColor: theme.palette.background.paper,
    }}>
      <Button
        variant="contained"
        onClick={onAddNode}
        startIcon={<AddIcon />}
      >
        Add Node
      </Button>
      <Button
        variant="contained"
        onClick={onExport}
        startIcon={<SaveIcon />}
      >
        Export
      </Button>
    </Box>
  );
}
