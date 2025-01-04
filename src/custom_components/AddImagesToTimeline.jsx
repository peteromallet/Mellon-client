import React, { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Typography, Button, IconButton, Slider } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNodeState } from '../stores/nodeStore';
import { shallow } from 'zustand/shallow';

function SortableItem({ item, index, onRemoveImage, onImageUpload, onTimeChange, prevTime, nextTime }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.timestamp.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    touchAction: 'none'
  };

  const handleTimeChange = (event, newValue) => {
    onTimeChange(item.timestamp, newValue);
  };

  // Calculate min and max times for this slider
  const minTime = prevTime ?? 0;
  const maxTime = nextTime ?? (item.timestamp + 5);

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        minWidth: '200px',
        position: 'relative',
        zIndex: 1,
        mb: 4,
      }}
    >
      <Box {...listeners} sx={{ 
        cursor: 'grab', 
        '&:active': { cursor: 'grabbing' },
        mb: 2
      }}>
        {item.imageUrl ? (
          <Box sx={{ 
            position: 'relative',
            backgroundColor: '#2A2A2A',
            p: 1,
            borderRadius: 1,
            mb: 1,
            mt: 1
          }}>
            <img
              src={item.imageUrl}
              alt={`Timeline ${item.timestamp}`}
              style={{
                width: '180px',
                height: '120px',
                objectFit: 'cover',
                borderRadius: '4px'
              }}
            />
            <IconButton
              onClick={() => onRemoveImage(item.timestamp)}
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                bgcolor: 'rgba(0,0,0,0.7)',
                color: '#FFF',
                padding: '4px',
                width: '24px',
                height: '24px',
                '&:hover': {
                  bgcolor: 'rgba(0,0,0,0.9)'
                },
                transform: 'translate(0, 0)',
                zIndex: 10
              }}
              size="small"
            >
              <DeleteIcon sx={{ fontSize: '16px' }} />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ mb: 1 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onImageUpload(item.timestamp, e)}
              style={{ display: 'none' }}
              id={`image-upload-${index}`}
            />
            <label htmlFor={`image-upload-${index}`}>
              <Button
                variant="outlined"
                component="span"
                startIcon={<AddPhotoAlternateIcon />}
                sx={{
                  color: '#FFA500',
                  borderColor: '#FFA500',
                  '&:hover': {
                    borderColor: '#FF8C00',
                    bgcolor: 'rgba(255, 165, 0, 0.1)'
                  }
                }}
              >
                Add Image
              </Button>
            </label>
          </Box>
        )}
      </Box>
      
      {/* Timeline slider */}
      <Box sx={{ 
        width: '100%', 
        px: 2,
        py: 1,
        backgroundColor: 'rgba(255, 165, 0, 0.1)',
        borderRadius: 1,
        position: 'relative',
        zIndex: 2
      }}>
        <Slider
          value={parseFloat(item.timestamp)}
          onChange={handleTimeChange}
          min={minTime}
          max={maxTime}
          step={0.01}
          sx={{
            color: '#FFA500',
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
              '&:hover, &.Mui-focusVisible': {
                boxShadow: '0 0 0 8px rgba(255, 165, 0, 0.16)',
              },
            },
            '& .MuiSlider-rail': {
              opacity: 0.3,
            },
          }}
        />
        <Typography sx={{ 
          color: '#FFA500',
          fontWeight: 'bold',
          textAlign: 'center',
          mt: 1
        }}>
          {parseFloat(item.timestamp).toFixed(2)}s
        </Typography>
      </Box>
    </Box>
  );
}

function AddFrameButton({ onClick }) {
  return (
    <IconButton
      onClick={onClick}
      sx={{
        color: '#FFA500',
        bgcolor: 'rgba(255, 165, 0, 0.1)',
        '&:hover': {
          bgcolor: 'rgba(255, 165, 0, 0.2)',
        },
        width: 32,
        height: 32,
        opacity: 0,
        transition: 'opacity 0.2s',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <AddIcon />
    </IconButton>
  );
}

function TimelineDivider({ onAddFrame }) {
  return (
    <Box
      sx={{
        width: '20px',
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&:hover > button': {
          opacity: 1,
        },
      }}
    >
      <AddFrameButton onClick={onAddFrame} />
    </Box>
  );
}

export function AddImagesToTimeline({ nodeId }) {
  const [timelineData, setTimelineData] = useState([]);
  const { getParam, setParamValue } = useNodeState(
    (state) => ({
      getParam: state.getParam,
      setParamValue: state.setParamValue
    }),
    shallow
  );

  // Subscribe to the node's data and cache status
  const { nodeData, nodeCache } = useNodeState(
    (state) => {
      const node = state.nodes.find(n => n.id === nodeId);
      return {
        nodeData: node?.data,
        nodeCache: node?.data?.cache
      };
    },
    shallow
  );

  // Define a more appropriate tolerance for timestamp comparisons (0.001 seconds = 1ms)
  const TIMESTAMP_TOLERANCE = 0.001;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const updateTimeline = () => {
      const timestampParam = getParam(nodeId, 'timestamps');
      console.log('Raw timestamp data:', timestampParam);

      let timestamps = [];
      if (timestampParam) {
        // If timestampParam.value is a function, call it to get the actual data
        if (timestampParam.value && typeof timestampParam.value === 'function') {
          try {
            const result = timestampParam.value();
            timestamps = Array.isArray(result) ? result : [];
          } catch (e) {
            console.error('Error calling timestamp value function:', e);
          }
        } else if (Array.isArray(timestampParam.value)) {
          timestamps = timestampParam.value;
        } else if (Array.isArray(timestampParam)) {
          timestamps = timestampParam;
        } else if (typeof timestampParam === 'object') {
          timestamps = [timestampParam];
        }
      }

      // Ensure all timestamps are valid numbers and have the correct shape
      timestamps = timestamps
        .filter(t => t && !isNaN(parseFloat(t.time)))
        .map(t => ({
          time: parseFloat(t.time),
          type: 'timestamp'
        }));

      setTimelineData(prevData => {
        // If we have existing data with images, preserve it and just update timestamps
        if (prevData.some(item => item.imageUrl || item.imageFile)) {
          // If we have new timestamps, merge them with existing data
          if (timestamps.length > 0) {
            const newData = timestamps.map(timestamp => {
              const existingEntry = prevData.find(item => 
                Math.abs(parseFloat(item.timestamp) - parseFloat(timestamp.time)) < TIMESTAMP_TOLERANCE
              );
              return {
                timestamp: parseFloat(timestamp.time),
                imageUrl: existingEntry?.imageUrl || null,
                imageFile: existingEntry?.imageFile || null
              };
            });
            return newData.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp));
          }
          // If no new timestamps but we have images, keep the existing data
          return prevData;
        }

        // If no existing images, create new entries from timestamps
        return timestamps.map(t => ({
          timestamp: parseFloat(t.time),
          imageUrl: null,
          imageFile: null
        })).sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp));
      });
    };

    // Only update if we have nodeId and getParam
    if (nodeId && getParam) {
      updateTimeline();
    }

    // Subscribe to store updates
    const unsubscribe = useNodeState.subscribe(() => {
      if (nodeId && getParam) {
        updateTimeline();
      }
    });
    return () => unsubscribe();
  }, [nodeId, getParam]);

  const handleTimeChange = useCallback((oldTime, newTime) => {
    // Ensure newTime is a valid number
    if (isNaN(newTime)) {
      console.error('Invalid time value:', newTime);
      return;
    }

    // First update the local state to preserve image data
    setTimelineData(prevData => {
      const newData = prevData.map(item =>
        Math.abs(parseFloat(item.timestamp) - parseFloat(oldTime)) < TIMESTAMP_TOLERANCE
          ? { ...item, timestamp: parseFloat(newTime) }
          : item
      );
      return newData.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp));
    });

    // Then get the current timestamps to ensure we have the latest data
    const currentTimestampParam = getParam(nodeId, 'timestamps');
    let currentTimestamps = [];
    
    if (currentTimestampParam?.value && typeof currentTimestampParam.value === 'function') {
      try {
        const result = currentTimestampParam.value();
        currentTimestamps = Array.isArray(result) ? result : [];
      } catch (e) {
        console.error('Error getting current timestamps:', e);
      }
    } else if (Array.isArray(currentTimestampParam?.value)) {
      currentTimestamps = currentTimestampParam.value;
    } else if (Array.isArray(currentTimestampParam)) {
      currentTimestamps = currentTimestampParam;
    }

    // Update the timestamps in the node state
    const updatedTimestamps = currentTimestamps
      .map(item => ({
        time: Math.abs(parseFloat(item.time) - parseFloat(oldTime)) < TIMESTAMP_TOLERANCE 
          ? parseFloat(newTime) 
          : parseFloat(item.time),
        type: 'timestamp'
      }))
      .sort((a, b) => a.time - b.time);

    console.log('Setting timestamps to:', updatedTimestamps);
    setParamValue(nodeId, 'timestamps', updatedTimestamps);
  }, [nodeId, setParamValue, getParam]);

  const handleImageUpload = async (timestamp, event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imageUrl = URL.createObjectURL(file);
      setTimelineData(prevData => 
        prevData.map(item => {
          const isSameTimestamp = Math.abs(parseFloat(item.timestamp) - parseFloat(timestamp)) < TIMESTAMP_TOLERANCE;
          return isSameTimestamp
            ? { ...item, imageUrl, imageFile: file }
            : item;
        })
      );
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  const handleRemoveImage = useCallback((timestamp) => {
    // First update the local state
    setTimelineData(prevData => {
      const newData = prevData.map(item => 
        Math.abs(parseFloat(item.timestamp) - parseFloat(timestamp)) < TIMESTAMP_TOLERANCE
          ? { ...item, imageUrl: null, imageFile: null }
          : item
      );
      return newData;
    });
  }, []);  // Empty dependency array since we use the callback form

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setTimelineData(prevData => {
        const oldIndex = prevData.findIndex(item => item.timestamp.toString() === active.id);
        const newIndex = prevData.findIndex(item => item.timestamp.toString() === over.id);
        
        const newItems = [...prevData];
        const { imageUrl: oldImageUrl, imageFile: oldImageFile } = newItems[oldIndex];
        const { imageUrl: newImageUrl, imageFile: newImageFile } = newItems[newIndex];
        
        newItems[oldIndex] = { 
          ...newItems[oldIndex], 
          imageUrl: newImageUrl, 
          imageFile: newImageFile 
        };
        newItems[newIndex] = { 
          ...newItems[newIndex], 
          imageUrl: oldImageUrl, 
          imageFile: oldImageFile 
        };
        
        return newItems;
      });
    }
  }, []);

  const handleAddFrame = useCallback((leftIndex) => {
    const leftTime = parseFloat(timelineData[leftIndex].timestamp);
    const rightTime = parseFloat(timelineData[leftIndex + 1].timestamp);
    const newTime = (leftTime + rightTime) / 2;

    // Then update the local state first
    setTimelineData(prevData => {
      const newData = [...prevData];
      newData.splice(leftIndex + 1, 0, {
        timestamp: newTime,
        imageUrl: null,
        imageFile: null
      });
      return newData.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp));
    });

    // Update the node state with the new timestamp
    const updatedTimestamps = [
      ...timelineData.map(item => ({
        time: parseFloat(item.timestamp),
        type: 'timestamp'
      })),
      {
        time: newTime,
        type: 'timestamp'
      }
    ].sort((a, b) => a.time - b.time);

    setParamValue(nodeId, 'timestamps', updatedTimestamps);
  }, [timelineData, setParamValue, nodeId]);

  return (
    <Card sx={{ 
      width: '100%',
      maxWidth: '800px',
      bgcolor: '#1E1E1E',
      color: '#FFFFFF',
      height: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <CardContent sx={{
        flex: 1,
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        pb: 2
      }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Timeline Images
        </Typography>

        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: 1,
          minHeight: 0
        }}>
          {timelineData.length === 0 ? (
            <Typography sx={{ color: 'text.secondary' }}>
              No timestamps available. Add timestamps using the Music Keyboard Tracker.
            </Typography>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 0,
                  overflowX: 'auto',
                  pb: 2,
                  position: 'relative',
                  minHeight: '250px',
                  '&::-webkit-scrollbar': {
                    height: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.2)',
                    },
                  },
                }}
              >
                <SortableContext
                  items={timelineData.map(item => item.timestamp.toString())}
                  strategy={horizontalListSortingStrategy}
                >
                  {timelineData.map((item, index) => (
                    <React.Fragment key={item.timestamp.toString()}>
                      <SortableItem
                        item={item}
                        index={index}
                        onRemoveImage={handleRemoveImage}
                        onImageUpload={handleImageUpload}
                        onTimeChange={handleTimeChange}
                        prevTime={index > 0 ? timelineData[index - 1].timestamp : null}
                        nextTime={index < timelineData.length - 1 ? timelineData[index + 1].timestamp : null}
                      />
                      {index < timelineData.length - 1 && (
                        <TimelineDivider onAddFrame={() => handleAddFrame(index)} />
                      )}
                    </React.Fragment>
                  ))}
                </SortableContext>
              </Box>
            </DndContext>
          )}
        </Box>
      </CardContent>
    </Card>
  );
} 