import React, { useState, useEffect, useRef } from 'react';
import { Stack, TextField, IconButton, Button, Paper, Box, Typography, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HeightIcon from '@mui/icons-material/Height';
import { Handle, Position } from '@xyflow/react';
import { useNodeState } from '../stores/nodeStore';

const PromptList = ({ nodeId, nodeData }) => {
  const [prompts, setPrompts] = useState(nodeData?.params?.prompts?.value || ['']);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hiddenPrompts, setHiddenPrompts] = useState([]);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [heightMode, setHeightMode] = useState('flexible'); // 'flexible' or 'fixed'
  const [editingIndex, setEditingIndex] = useState(null);
  const inputRefs = useRef([]);
  const lastUpdateRef = useRef(null);
  const setParamValue = useNodeState((state) => state.setParamValue);
  const [expandedHiddenIndex, setExpandedHiddenIndex] = useState(null);
  const updateTimeoutRef = useRef(null);

  const handlePromptChange = (index, value) => {
    const newPrompts = [...prompts];
    newPrompts[index] = value;
    setPrompts(newPrompts);
    updateDownstreamPrompts(newPrompts, hiddenPrompts);
  };

  const updateDownstreamPrompts = (promptsList, hidden) => {
    const visiblePrompts = promptsList
      .filter((_, index) => !hidden.includes(index))
      .filter(p => p.trim())
      .map(p => p.trim());
    
    // Ensure we always have a non-empty array to trigger updates
    const updatedPrompts = visiblePrompts.length > 0 ? visiblePrompts : [''];
    
    // Update our ref to prevent loops
    lastUpdateRef.current = JSON.stringify(updatedPrompts);
    
    // Force a new array reference to ensure React detects the change
    setParamValue(nodeId, 'prompts', [...updatedPrompts]);
  };

  const addPrompt = () => {
    const newPrompts = [...prompts, ''];
    setPrompts(newPrompts);
  };

  const removePrompt = (index) => {
    const newPrompts = prompts.filter((_, i) => i !== index);
    setPrompts(newPrompts);
    const newHiddenPrompts = hiddenPrompts
      .filter(i => i !== index)
      .map(i => (i > index ? i - 1 : i));
    setHiddenPrompts(newHiddenPrompts);
    updateDownstreamPrompts(newPrompts, newHiddenPrompts);
  };

  const togglePromptVisibility = (index) => {
    const newHiddenPrompts = hiddenPrompts.includes(index)
      ? hiddenPrompts.filter(i => i !== index)
      : [...hiddenPrompts, index];
    setHiddenPrompts(newHiddenPrompts);
    updateDownstreamPrompts(prompts, newHiddenPrompts);
  };

  const showAllPrompts = () => {
    setHiddenPrompts([]);
    updateDownstreamPrompts(prompts, []);
  };

  const duplicatePrompt = (index) => {
    const newPrompts = [...prompts];
    newPrompts.splice(index + 1, 0, prompts[index]);
    setPrompts(newPrompts);
    const newHiddenPrompts = hiddenPrompts
      .map(i => (i > index ? i + 1 : i));
    setHiddenPrompts(newHiddenPrompts);
    updateDownstreamPrompts(newPrompts, newHiddenPrompts);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextIndex = e.shiftKey ? index - 1 : index + 1;
      if (nextIndex >= 0 && nextIndex < prompts.length) {
        inputRefs.current[nextIndex]?.focus();
        setFocusedIndex(nextIndex);
        if (hiddenPrompts.includes(nextIndex)) {
          setExpandedHiddenIndex(nextIndex);
        }
      }
    } else if ((e.key === 'w' || e.key === 'Enter') && !e.metaKey && !e.ctrlKey && !e.altKey && editingIndex !== index) {
      e.preventDefault();
      setEditingIndex(index);
    } else if (e.key === 'Escape' && editingIndex === index) {
      setEditingIndex(null);
      inputRefs.current[index]?.blur();
    } else if (editingIndex === index) {
      return;
    } else if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      duplicatePrompt(index);
      setTimeout(() => {
        inputRefs.current[index + 1]?.focus();
        setFocusedIndex(index + 1);
      }, 0);
    } else if (e.key === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (prompts.length > 1) {
        const nextFocusIndex = index === prompts.length - 1 ? index - 1 : index;
        removePrompt(index);
        setTimeout(() => {
          inputRefs.current[nextFocusIndex]?.focus();
          setFocusedIndex(nextFocusIndex);
          if (hiddenPrompts.includes(nextFocusIndex)) {
            setExpandedHiddenIndex(nextFocusIndex);
          }
        }, 0);
      }
    } else if (e.key === 'h' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      togglePromptVisibility(index);
    } else if (e.key === 'a' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      addPrompt();
      setTimeout(() => {
        const newIndex = prompts.length;
        inputRefs.current[newIndex]?.focus();
        setFocusedIndex(newIndex);
      }, 0);
    }
  };

  const handleBlur = (index) => {
    setFocusedIndex(null);
    setEditingIndex(null);
    setExpandedHiddenIndex(null);
  };

  const handleFocus = (index) => {
    setFocusedIndex(index);
    if (hiddenPrompts.includes(index)) {
      setExpandedHiddenIndex(index);
    }
  };

  useEffect(() => {
    // Update prompts when nodeData changes
    const newPrompts = nodeData?.params?.prompts?.value;
    if (Array.isArray(newPrompts)) {
      const newPromptsStr = JSON.stringify(newPrompts);
      const currentPromptsStr = JSON.stringify(prompts);
      
      // Only update if prompts have changed and it's not from our own update
      if (newPromptsStr !== currentPromptsStr && newPromptsStr !== lastUpdateRef.current) {
        lastUpdateRef.current = newPromptsStr;
        setPrompts(newPrompts);
        setHiddenPrompts([]); // Reset hidden prompts when receiving new prompts
        // Ensure changes propagate downstream
        updateDownstreamPrompts(newPrompts, []);
      }
    }
  }, [nodeData?.params?.prompts?.value, nodeId]);

  useEffect(() => {
    // Update refs array when prompts change
    inputRefs.current = inputRefs.current.slice(0, prompts.length);
  }, [prompts]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Stack spacing={1} sx={{ p: '8px 16px', position: 'relative', minWidth: 450 }}>
      <Handle
        type="target"
        position={Position.Bottom}
        style={{ bottom: -8, left: 8 }}
        id="prompts"
      />
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 1.5,
        mt: 0.5
      }}>
        <ToggleButtonGroup
          value={heightMode}
          exclusive
          onChange={(e, newMode) => newMode && setHeightMode(newMode)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 2,
              py: 0.5,
              textTransform: 'none',
              fontSize: '0.875rem'
            }
          }}
        >
          <ToggleButton value="flexible" aria-label="flexible height">
            <HeightIcon sx={{ mr: 1, transform: 'rotate(90deg)' }} fontSize="small" />
            Flexible
          </ToggleButton>
          <ToggleButton value="fixed" aria-label="fixed height">
            <HeightIcon sx={{ mr: 1 }} fontSize="small" />
            Fixed
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip 
          title={
            <Box sx={{ p: 1, fontSize: '0.875rem' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Keyboard Shortcuts
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <li>Tab - Move between fields</li>
                <li>W or Enter - Start editing</li>
                <li>Esc - Stop editing</li>
                <li>C - Duplicate field</li>
                <li>D - Delete field</li>
                <li>H - Hide/show field</li>
                <li>A - Add new prompt</li>
              </Box>
            </Box>
          }
          arrow
          placement="right"
        >
          <IconButton
            sx={{ 
              color: '#999999',
              '&:hover': {
                color: '#FFA500'
              }
            }}
          >
            <InfoOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {prompts.map((prompt, index) => (
        <Paper 
          key={index} 
          elevation={1} 
          sx={{ 
            p: 1, 
            position: 'relative',
            opacity: hiddenPrompts.includes(index) ? 0.5 : 1,
            transition: 'all 0.2s ease-in-out',
            cursor: editingIndex === index ? 'text' : 'default',
            ...(hiddenPrompts.includes(index) && {
              height: hoveredIndex === index || expandedHiddenIndex === index ? 'auto' : '24px',
              maxHeight: hoveredIndex === index || expandedHiddenIndex === index ? 'none' : '24px',
              overflow: 'hidden',
              '& .MuiTextField-root': {
                transition: 'all 0.2s ease-in-out',
                opacity: hoveredIndex === index || expandedHiddenIndex === index ? 0.8 : 0,
                height: hoveredIndex === index || expandedHiddenIndex === index ? 'auto' : '12px',
                '& .MuiOutlinedInput-root': {
                  height: hoveredIndex === index || expandedHiddenIndex === index ? 'auto' : '12px',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                    borderWidth: '1px',
                  }
                }
              }
            }),
            ...(focusedIndex === index && {
              outline: editingIndex === index ? '2px solid rgba(76, 175, 80, 0.5)' : '2px solid rgba(25, 118, 210, 0.5)',
              outlineOffset: '2px',
            }),
          }}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <TextField
            inputRef={el => inputRefs.current[index] = el}
            size="small"
            placeholder={editingIndex === index ? "Enter a text prompt" : "Press 'w' to edit or double-click"}
            value={prompt}
            onChange={(e) => editingIndex === index && handlePromptChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onFocus={() => handleFocus(index)}
            onBlur={() => handleBlur(index)}
            onDoubleClick={() => setEditingIndex(index)}
            fullWidth
            multiline
            rows={editingIndex === index ? undefined : (heightMode === 'fixed' ? 3 : undefined)}
            maxRows={editingIndex === index ? Infinity : (heightMode === 'flexible' ? Infinity : undefined)}
            minRows={editingIndex === index ? 1 : (heightMode === 'flexible' ? 1 : undefined)}
            InputProps={{
              readOnly: editingIndex !== index,
              sx: {
                transition: 'all 0.2s ease-in-out',
                ...(heightMode === 'fixed' && editingIndex !== index && {
                  height: '85px',
                  '& textarea': {
                    overflow: 'auto'
                  }
                }),
                ...(heightMode === 'flexible' && editingIndex !== index && {
                  height: 'auto',
                  '& textarea': {
                    overflow: 'hidden'
                  }
                }),
                ...(editingIndex === index && {
                  height: 'auto',
                  '& textarea': {
                    overflow: 'hidden'
                  }
                })
              }
            }}
            sx={{
              transition: 'all 0.2s ease-in-out',
              '& .MuiInputBase-input': {
                cursor: editingIndex === index ? 'text' : 'default',
              }
            }}
          />
          {hoveredIndex === index && (
            <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
              <IconButton
                onClick={() => duplicatePrompt(index)}
                color="primary"
                size="small"
                sx={{
                  opacity: 0.7,
                  '&:hover': { opacity: 1 }
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={() => togglePromptVisibility(index)}
                color="primary"
                size="small"
                sx={{
                  opacity: 0.7,
                  '&:hover': { opacity: 1 }
                }}
              >
                {hiddenPrompts.includes(index) ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <VisibilityOffIcon fontSize="small" />
                )}
              </IconButton>
              {prompts.length > 1 && (
                <IconButton 
                  onClick={() => removePrompt(index)}
                  color="error"
                  size="small"
                  sx={{
                    opacity: 0.7,
                    '&:hover': { opacity: 1 }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          )}
        </Paper>
      ))}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {prompts.length - hiddenPrompts.length} visible prompt{prompts.length - hiddenPrompts.length !== 1 ? 's' : ''}
        </Typography>
        <Button
          startIcon={<AddIcon />}
          onClick={addPrompt}
          variant="outlined"
        >
          Add Prompt
        </Button>
      </Box>
    </Stack>
  );
};

export default PromptList; 