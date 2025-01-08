import React, { useState, useEffect } from 'react';
import { Button, Stack, TextField, CircularProgress, Tooltip } from '@mui/material';
import { getOutgoers, getIncomers } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import CustomNumberInput from '../components/CustomNumberInput';
import { useNodeState } from '../stores/nodeStore';
import dataService from '../services/dataService';

const ImageGenerator = ({ nodeId, nodeData }) => {
  const [prompt, setPrompt] = useState(nodeData?.params?.prompt?.value || '');
  const [workflow, setWorkflow] = useState(nodeData?.params?.workflow?.value || 'Flux General');
  const [isGenerating, setIsGenerating] = useState(false);
  const setParamValue = useNodeState((state) => state.setParamValue);
  const nodes = useNodeState((state) => state.nodes);
  const edges = useNodeState((state) => state.edges);

  const currentNode = nodes.find(node => node.id === nodeId);
  const hasOutputConnection = currentNode ? getOutgoers(currentNode, nodes, edges).length > 0 : false;
  const incomingNodes = currentNode ? getIncomers(currentNode, nodes, edges) : [];
  const hasPromptInput = incomingNodes.length > 0;

  // Get prompts from incoming PromptList node if connected
  useEffect(() => {
    if (hasPromptInput) {
      const promptListNode = incomingNodes.find(node => node.data?.params?.component?.value === 'PromptList');
      if (promptListNode) {
        const prompts = promptListNode.data?.params?.prompts?.value;
        // Only update if the prompt is different from current state
        if (prompt !== '') {
          setPrompt(''); // Clear the text input when we have incoming prompts
          setParamValue(nodeId, 'prompt', '');
        }
      }
    }
  }, [incomingNodes, hasPromptInput, nodeId]); // Add nodeId to dependencies

  const handlePromptChange = (e) => {
    if (hasPromptInput) return; // Don't allow manual input if we have a connection
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    setParamValue(nodeId, 'prompt', newPrompt);
  };

  const handleWorkflowChange = (e) => {
    const newWorkflow = e.target.value;
    setWorkflow(newWorkflow);
    setParamValue(nodeId, 'workflow', newWorkflow);
  };

  const handleNumberChange = (newValue) => {
    const numValue = parseInt(newValue, 10);
    setParamValue(nodeId, 'number', numValue);
  };

  const handleGenerate = async () => {
    if ((!prompt.trim() && !hasPromptInput) || (hasPromptInput && !incomingNodes.length)) return;
    
    setIsGenerating(true);
    try {
      const imagesPerPrompt = parseInt(nodeData?.params?.number?.value || 1, 10);
      
      // Get prompts either from input connection or text field
      let promptLines;
      if (hasPromptInput) {
        const promptListNode = incomingNodes.find(node => node.data?.params?.component?.value === 'PromptList');
        if (!promptListNode) {
          throw new Error('Connected prompt list not found');
        }
        
        // Access the prompts directly from the node's data
        promptLines = promptListNode.data?.params?.prompts?.value;
        if (!Array.isArray(promptLines)) {
          console.warn('Unexpected prompts format:', promptLines);
          promptLines = [];
        }
      } else {
        try {
          promptLines = JSON.parse(prompt);
        } catch {
          promptLines = prompt.split('\n').filter(p => p.trim());
        }
      }
      
      console.log('Raw prompts from input:', promptLines);
      
      // Filter out any empty prompts
      promptLines = promptLines.filter(p => p && p.trim());
      
      if (promptLines.length === 0) {
        throw new Error('No valid prompts to generate images from');
      }

      // Create prompts object with the specified number of images per prompt
      const prompts = {};
      let promptIndex = 1;
      
      // For each prompt, generate the specified number of images
      for (const promptText of promptLines) {
        for (let i = 0; i < imagesPerPrompt; i++) {
          prompts[promptIndex] = promptText;
          promptIndex++;
        }
      }
      
      console.log('Sending prompts:', prompts);

      // Use fetch to get the response stream
      const response = await fetch(`http://${import.meta.env.VITE_SERVER_ADDRESS}/generate-batch-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompts: prompts,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate images: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const successfulResults = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            const result = JSON.parse(data);
            console.log('Received result:', result);

            if (result.done) {
              setIsGenerating(false);
              return;
            }

            if (result.success) {
              successfulResults.push(result.filename);
              
              // Update node data with just this new filename
              const data = {
                params: {
                  component: 'ImageGenerator',
                  prompt: prompt,
                  number: imagesPerPrompt,
                  output: [result.filename], // Send just the new filename
                },
                files: [result.filename],
                cache: true,
                event: 'generation',
                eventId: Date.now()
              };
              await dataService.saveNodeData(nodeId, data);
              
              // Update the param values with all successful results so far
              setParamValue(nodeId, 'output', successfulResults);
              setParamValue(nodeId, 'executed', true);
            } else if (result.error) {
              console.error('Generation failed:', result.error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response
      });
      alert('Failed to generate images: ' + error.message);
      setIsGenerating(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ p: 2, position: 'relative' }}>
      <Handle 
        type="target" 
        position={Position.Top}
        style={{ left: 8, top: 8 }}
        id="prompt-in"
      />
      {!hasPromptInput && (
        <TextField
          size="small"
          placeholder="Enter prompt"
          value={prompt}
          onChange={handlePromptChange}
          label="Prompt"
          fullWidth
          multiline
          rows={3}
          disabled={isGenerating}
        />
      )}

      <TextField
        select
        size="small"
        value={workflow}
        onChange={handleWorkflowChange}
        label="Workflow"
        fullWidth
        disabled={isGenerating}
      >
        <option value="Flux General">Flux General</option>
      </TextField>

      <CustomNumberInput
        dataKey="number"
        value={nodeData?.params?.number?.value || 1}
        onChange={handleNumberChange}
        min={1}
        max={12}
        label={hasPromptInput ? "Images per prompt" : "Number of images"}
        disabled={isGenerating}
        dataType="int"
        slider={true}
      />

      <Tooltip title={!hasOutputConnection ? "Connect the Generated Images output to another node first" : ""}>
        <span style={{ width: '100%' }}>
          <Button 
            variant="contained" 
            onClick={handleGenerate} 
            fullWidth
            disabled={isGenerating || (!hasPromptInput && !prompt.trim()) || !hasOutputConnection}
          >
            {isGenerating ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </Button>
        </span>
      </Tooltip>
    </Stack>
  );
};

export default ImageGenerator; 