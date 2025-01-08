import React, { useState, useEffect, useRef } from 'react';
import { Stack, TextField, Button, Box, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import { Handle, Position } from '@xyflow/react';
import { useNodeState } from '../stores/nodeStore';
import CustomNumberInput from '../components/CustomNumberInput';

const GeneratePrompts = ({ nodeId, nodeData }) => {
  const [topic, setTopic] = useState(nodeData?.params?.topic?.value || 'Add');
  const [examples, setExamples] = useState(() => {
    const initialExamples = nodeData?.params?.examples?.value;
    return Array.isArray(initialExamples) ? initialExamples : [''];
  });
  const [mode, setMode] = useState('add');
  const [numToGenerate, setNumToGenerate] = useState(5);
  const setParamValue = useNodeState((state) => state.setParamValue);
  const prevExamplesRef = useRef();
  const [generatedPrompts, setGeneratedPrompts] = useState(() => {
    // Initialize with examples if they exist
    const initialExamples = nodeData?.params?.examples?.value;
    return Array.isArray(initialExamples) ? initialExamples.filter(e => e && e.trim()) : [];
  });
  
  // Remove the initial prompts effect that was causing issues
  useEffect(() => {
    const hasInitialPrompts = nodeData?.params?.prompts?.value;
    if (!hasInitialPrompts) {
      setGeneratedPrompts([]); // Just update local state, don't propagate
    }
  }, [nodeId]); // Only depend on nodeId

  // Handle example updates without propagating prompts
  useEffect(() => {
    const incomingExamples = nodeData?.params?.['examples-in']?.value;
    const nodeExamples = nodeData?.params?.examples?.value;
    const currentExamples = incomingExamples || nodeExamples;
    
    if (Array.isArray(currentExamples)) {
      const filteredExamples = currentExamples.filter(e => e && e.trim());
      const prevExamples = prevExamplesRef.current;
      
      // Only update if examples have actually changed
      if (JSON.stringify(filteredExamples) !== JSON.stringify(prevExamples)) {
        prevExamplesRef.current = filteredExamples;
        setExamples(filteredExamples.length > 0 ? filteredExamples : ['']);
        setGeneratedPrompts(filteredExamples);
        if (incomingExamples) {
          setParamValue(nodeId, 'examples', filteredExamples);
        }
      }
    }
  }, [nodeData?.params?.['examples-in']?.value, nodeData?.params?.examples?.value, nodeId]);

  const hasOutputConnection = useNodeState(
    (state) => state.nodes.some(n => 
      n.id === nodeId && state.edges.some(e => e.source === nodeId && e.sourceHandle === 'prompts')
    )
  );

  const hasInputConnection = useNodeState(
    (state) => state.nodes.some(n => 
      n.id === nodeId && state.edges.some(e => e.target === nodeId && e.targetHandle === 'examples-in')
    )
  );

  const hasValidInput = hasInputConnection || (
    (topic.trim() !== '') || 
    (examples.length > 0 && examples.some(e => e.trim() !== ''))
  );

  const handleTopicChange = (e) => {
    const newTopic = e.target.value;
    setTopic(newTopic);
    setParamValue(nodeId, 'topic', newTopic);
  };

  const handleExampleChange = (index, value) => {
    const newExamples = [...examples];
    newExamples[index] = value;
    const filteredExamples = newExamples.filter(e => e && e.trim());
    setExamples(filteredExamples.length > 0 ? filteredExamples : ['']);
    setGeneratedPrompts(filteredExamples);
    setParamValue(nodeId, 'examples', filteredExamples);
  };

  const addExample = () => {
    setExamples([...examples, '']);
  };

  const removeExample = (index) => {
    const newExamples = examples.filter((_, i) => i !== index);
    const filteredExamples = newExamples.filter(e => e && e.trim());
    setExamples(filteredExamples.length > 0 ? filteredExamples : ['']);
    setGeneratedPrompts(filteredExamples);
    setParamValue(nodeId, 'examples', filteredExamples);
  };

  const handleModeChange = (_, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  };

  const handleGenerate = async () => {
    try {
      const response = await fetch(`http://${import.meta.env.VITE_SERVER_ADDRESS}/generate-prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic,
          examples: examples.filter(e => e && e.trim()),
          mode: mode,
          numToGenerate: mode === 'edit' ? examples.length : numToGenerate
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Update our local state based on mode
      const updatedPrompts = mode === 'add' 
        ? [...examples.filter(e => e && e.trim()), ...data.prompts]
        : [...data.prompts];
      
      // Set local state first
      setGeneratedPrompts(updatedPrompts);

      // Then update the node parameters in a single batch
      await Promise.all([
        setParamValue(nodeId, 'prompts', updatedPrompts),
        setParamValue(nodeId, 'executed', true)
      ]);
    } catch (error) {
      console.error('Error generating prompts:', error);
    }
  };

  return (
    <Stack spacing={2} sx={{ p: 2, position: 'relative', minWidth: 400 }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ left: 8, top: 8 }}
        id="examples-in"
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8 }}
        id="prompts"
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
        >
          <ToggleButton value="add">Add</ToggleButton>
          <ToggleButton value="edit">Edit</ToggleButton>
          <ToggleButton value="new">New</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === 'new' && (
        <Typography color="warning.main" variant="caption" sx={{ mb: 1 }}>
          Warning: This will overwrite the existing prompts
        </Typography>
      )}

      <TextField
        size="small"
        placeholder="Enter topic"
        value={topic}
        onChange={handleTopicChange}
        label="Request"
        fullWidth
        multiline
        rows={3}
      />

      {(mode === 'add' || mode === 'new') && (
        <CustomNumberInput
          dataKey="numToGenerate"
          label="Number to generate"
          value={numToGenerate}
          onChange={(value) => setNumToGenerate(Number(value))}
          min={4}
          max={64}
          step={1}
          showProgress
          progressColor="primary"
        />
      )}

      {!hasInputConnection && (
        <>
          {examples.map((example, index) => (
            <TextField
              key={index}
              size="small"
              placeholder="Enter example"
              value={example}
              onChange={(e) => handleExampleChange(index, e.target.value)}
              label={`Example ${index + 1}`}
              fullWidth
              multiline
              rows={2}
              InputProps={{
                endAdornment: examples.length > 1 && (
                  <Button
                    onClick={() => removeExample(index)}
                    color="error"
                    size="small"
                    sx={{ minWidth: 'auto', p: '2px' }}
                  >
                    ✕
                  </Button>
                )
              }}
            />
          ))}

          <Button
            variant="outlined"
            onClick={addExample}
            fullWidth
            sx={{ mt: 1 }}
          >
            Add Example
          </Button>
        </>
      )}

      <Button
        variant="contained"
        onClick={handleGenerate}
        fullWidth
        disabled={!hasOutputConnection || !hasValidInput}
        sx={{ mt: 2 }}
      >
        Generate
      </Button>
    </Stack>
  );
};

export default GeneratePrompts; 