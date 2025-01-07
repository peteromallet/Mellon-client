import React, { useState, useEffect } from 'react';
import { Stack, TextField } from '@mui/material';
import { Handle, Position } from '@xyflow/react';
import { useNodeState } from '../stores/nodeStore';

const PromptsInput = ({ nodeId, nodeData }) => {
  const [prompt, setPrompt] = useState(nodeData?.params?.prompt?.value || '');
  const setParamValue = useNodeState((state) => state.setParamValue);

  const handlePromptChange = (e) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    setParamValue(nodeId, 'prompt', newPrompt);
  };

  return (
    <Stack spacing={2} sx={{ p: 2, position: 'relative' }}>
      <Handle 
        type="source" 
        position={Position.Top} 
        style={{ left: 8, top: 8 }}
        id="prompt-out"
      />
      <TextField
        size="small"
        placeholder="Enter prompt"
        value={prompt}
        onChange={handlePromptChange}
        label="Prompt"
        fullWidth
        multiline
        rows={3}
      />
    </Stack>
  );
};

export default PromptsInput; 