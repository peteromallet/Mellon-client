import React, { useState, useRef, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, IconButton, Slider, TextField } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useNodeState } from '../stores/nodeStore';

const MusicKeyboardTracker = ({ nodeId }) => {
  const [audioFile, setAudioFile] = useState(null);
  const [audioFileName, setAudioFileName] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timestamps, setTimestamps] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  const [lastHitTimestamp, setLastHitTimestamp] = useState(null);
  const [lastHitColor, setLastHitColor] = useState(null);
  const audioRef = useRef(null);
  const timelineRef = useRef(null);
  const dragRef = useRef(null);
  const isDraggingTimelineRef = useRef(false);
  const isInteractingWithTimestampRef = useRef(false);
  const lastCheckedTimeRef = useRef(0);
  const initialMousePos = useRef({ x: 0, y: 0 });
  const setParamValue = useNodeState((state) => state.setParamValue);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioFile(url);
      setAudioFileName(file.name);
      setTimestamps([]);
      setViewportStart(0);
      setZoom(1);
    }
  };

  const handleTimestampImport = (text) => {
    try {
      // Remove whitespace and validate basic format
      const trimmed = text.trim();
      if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
        throw new Error('Invalid format. Must be wrapped in square brackets []');
      }

      // Parse the content between brackets
      const content = trimmed.slice(1, -1);
      const numbers = content.split(',').map(str => {
        const num = parseFloat(str.trim());
        if (isNaN(num)) throw new Error('Invalid number found');
        return { time: num.toFixed(4) };
      });

      // Sort and set the timestamps
      setTimestamps(numbers.sort((a, b) => parseFloat(a.time) - parseFloat(b.time)));
    } catch (error) {
      alert('Error importing timestamps: ' + error.message);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (audioRef.current) {
          if (isPlaying) {
            audioRef.current.pause();
          } else {
            audioRef.current.play();
          }
          setIsPlaying(!isPlaying);
        }
      } else if (event.key === 'k' || event.key === 'l') {
        // Only use the audio element's current time
        if (audioRef.current) {
          const time = audioRef.current.currentTime;
          const timeStr = time.toFixed(4);
          
          console.log('Key pressed:', event.key);
          console.log('Audio current time:', time);
          console.log('Creating timestamp at:', timeStr);
          
          setTimestamps(prev => {
            const isDuplicate = prev.some(t => t.time === timeStr);
            if (!isDuplicate) {
              console.log('Adding new timestamp');
              return [...prev, { time: timeStr }].sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
            }
            console.log('Duplicate timestamp, skipping');
            return prev;
          });
        }
      } else if (event.key === 'Tab' && !event.shiftKey) {
        // Prevent default tab behavior
        event.preventDefault();
        
        if (audioRef.current) {
          const newTime = Math.max(0, audioRef.current.currentTime - 0.33);
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          setLastHitColor(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying]);

  useEffect(() => {
    const handleDelete = (event) => {
      if (event.key === 'd' && selectedTimestamp !== null) {
        setTimestamps(prev => prev.filter((_, index) => index !== selectedTimestamp));
        setSelectedTimestamp(null);
      }
    };

    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [selectedTimestamp]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleTimeUpdate = () => {
        const currentTimeFloat = audio.currentTime;
        setCurrentTime(currentTimeFloat);
        
        // Find any timestamps we're crossing
        for (let i = 0; i < timestamps.length; i++) {
          const stampTime = parseFloat(timestamps[i].time);
          
          // Check if we've crossed this timestamp
          if (lastCheckedTimeRef.current <= stampTime && currentTimeFloat >= stampTime) {
            setLastHitTimestamp(Date.now());
            setLastHitColor([
              '#FFB3B3', // pastel red
              '#B3FFB3', // pastel green
              '#B3B3FF', // pastel blue
              '#FFE6B3', // pastel orange
              '#FFB3FF', // pastel pink
              '#B3FFFF'  // pastel cyan
            ][i % 6]);
            break;
          }
        }
        
        lastCheckedTimeRef.current = currentTimeFloat;
      };

      const handleSeeking = () => {
        setLastHitColor(null);
        lastCheckedTimeRef.current = audio.currentTime;
      };
      
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('play', () => {
        lastCheckedTimeRef.current = audio.currentTime;
      });
      audio.addEventListener('seeking', handleSeeking);
      audio.addEventListener('seeked', handleSeeking);
      
      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('seeking', handleSeeking);
        audio.removeEventListener('seeked', handleSeeking);
      };
    }
  }, [audioFile, timestamps]);

  useEffect(() => {
    if (timelineRef.current && timelineRef.current.parentElement) {
      const container = timelineRef.current.parentElement;
      const duration = audioRef.current?.duration || 1;
      const containerWidth = container.clientWidth;
      
      // Calculate the current playhead position in pixels
      const playheadPercent = currentTime / duration;
      const totalWidth = containerWidth * zoom;
      const playheadPosition = totalWidth * playheadPercent;
      
      // When playing or zoomed in, keep the playhead centered
      if (isPlaying || zoom > 1) {
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
          const newScrollLeft = Math.max(0, playheadPosition - (containerWidth / 2));
          
          // Add smooth scrolling behavior
          container.style.scrollBehavior = 'smooth';
          container.scrollLeft = newScrollLeft;
          setViewportStart(newScrollLeft);
          
          // Reset scroll behavior after animation
          setTimeout(() => {
            container.style.scrollBehavior = 'auto';
          }, 100);
        });
      }
    }
  }, [currentTime, isPlaying, zoom]);

  const handleScroll = (e) => {
    if (!isPlaying) {
      setViewportStart(e.target.scrollLeft);
    }
  };

  const handleDragStart = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    isInteractingWithTimestampRef.current = true;
    dragRef.current = {
      index,
      startX: e.clientX,
      originalTime: parseFloat(timestamps[index].time)
    };
    
    setSelectedTimestamp(index);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e) => {
    if (dragRef.current && timelineRef.current && audioRef.current) {
      const timeline = timelineRef.current;
      const duration = audioRef.current.duration || 1;
      const rect = timeline.getBoundingClientRect();
      const timelineWidth = rect.width;
      
      // Calculate the change in position
      const deltaX = e.clientX - rect.left;
      const percentX = Math.max(0, Math.min(1, deltaX / timelineWidth));
      const newTime = (percentX * duration).toFixed(4);

      // Update the timestamp
      const updatedTimestamps = [...timestamps];
      updatedTimestamps[dragRef.current.index] = { time: newTime };
      
      // Sort and update timestamps
      setTimestamps(updatedTimestamps.sort((a, b) => parseFloat(a.time) - parseFloat(b.time)));
    }
  };

  const handleDragEnd = () => {
    dragRef.current = null;
    isInteractingWithTimestampRef.current = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  const handleZoom = (direction) => {
    if (timelineRef.current && timelineRef.current.parentElement && audioRef.current) {
      const container = timelineRef.current.parentElement;
      const duration = audioRef.current.duration || 1;
      const containerWidth = container.clientWidth;
      
      // Calculate new zoom level with better bounds
      const oldZoom = zoom;
      const newZoom = Math.min(
        Math.max(
          direction === 'in' ? oldZoom * 1.5 : oldZoom / 1.5,
          1
        ),
        50  // Add maximum zoom limit
      );

      // Calculate the current playhead position as a percentage
      const playheadPercent = currentTime / duration;
      
      // Set the new zoom level
      setZoom(newZoom);

      // Calculate the new scroll position to center on playhead
      requestAnimationFrame(() => {
        const newTotalWidth = containerWidth * newZoom;
        const newPlayheadPixels = newTotalWidth * playheadPercent;
        const newScrollLeft = Math.max(0, newPlayheadPixels - (containerWidth / 2));
        
        container.scrollLeft = newScrollLeft;
        setViewportStart(newScrollLeft);
      });
    }
  };

  const handleTimelineMouseDown = (e) => {
    // Don't handle timeline clicks if we're interacting with a timestamp
    if (isInteractingWithTimestampRef.current) {
      return;
    }

    if (timelineRef.current && audioRef.current) {
      const timeline = timelineRef.current;
      const duration = audioRef.current.duration;
      const rect = timeline.getBoundingClientRect();
      
      // Calculate click position relative to the timeline element
      const clickX = e.clientX - rect.left;
      
      // Convert to percentage of timeline width
      const clickPercent = clickX / rect.width;
      
      // Convert percentage to time
      const newTime = clickPercent * duration;
      
      if (newTime >= 0 && newTime <= duration) {
        setLastHitColor(null);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    }
  };

  const handleTimelineDragStart = (e) => {
    if (zoom <= 1) {
      // If not zoomed in, treat as a click
      handleTimelineMouseDown(e);
      return;
    }
    
    initialMousePos.current = { x: e.clientX, y: e.clientY };
    isDraggingTimelineRef.current = false;
    
    document.addEventListener('mousemove', handleTimelineDragMove);
    document.addEventListener('mouseup', handleTimelineDragEnd);
  };

  const handleTimelineDragMove = (e) => {
    if (!isDraggingTimelineRef.current && Math.abs(e.clientX - initialMousePos.current.x) > 5) {
      isDraggingTimelineRef.current = true;
      e.preventDefault();
    }

    if (isDraggingTimelineRef.current && timelineRef.current?.parentElement) {
      const container = timelineRef.current.parentElement;
      container.scrollLeft -= (e.clientX - initialMousePos.current.x);
      initialMousePos.current.x = e.clientX;
    }
  };

  const handleTimelineDragEnd = () => {
    if (!isDraggingTimelineRef.current && timelineRef.current && audioRef.current) {
      // Handle as a click instead of a drag
      const container = timelineRef.current.parentElement;
      const duration = audioRef.current.duration;
      const containerWidth = container.clientWidth;
      const clickX = initialMousePos.current.x - container.getBoundingClientRect().left;
      const clickPercent = clickX / containerWidth;
      const newTime = clickPercent * duration;

      if (newTime >= 0 && newTime <= duration) {
        setLastHitColor(null);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    }
    
    isDraggingTimelineRef.current = false;
    document.removeEventListener('mousemove', handleTimelineDragMove);
    document.removeEventListener('mouseup', handleTimelineDragEnd);
  };

  const handleSendTimestamps = () => {
    console.log('Attempting to send timestamps:', timestamps);
    console.log('Using nodeId:', nodeId);
    if (nodeId) {
      // Ensure timestamps are in the correct format
      const formattedTimestamps = timestamps.map(t => ({
        time: typeof t === 'object' ? t.time : t
      }));
      console.log('Sending formatted timestamps:', formattedTimestamps);
      setParamValue(nodeId, 'timestamps', formattedTimestamps);
    } else {
      console.error('No nodeId available!');
    }
  };

  const handleTimestampGeneration = (timestamp) => {
    const currentTimestamps = useNodeState.getState().getParam(nodeId, 'timestamps') || [];
    const newTimestamps = [...currentTimestamps, timestamp];
    
    setParamValue(nodeId, 'timestamps', newTimestamps);
    console.log('Updated timestamps:', newTimestamps);
  };

  const calculatePlayheadPosition = () => {
    if (!timelineRef.current?.parentElement || !audioRef.current) return '0%';
    
    // Only center when zoomed in
    if (zoom > 1) {
      return '50%';
    }
    
    // When not zoomed, calculate relative position
    const container = timelineRef.current.parentElement;
    const duration = audioRef.current.duration || 1;
    const containerWidth = container.clientWidth;
    const totalWidth = containerWidth * zoom;
    const scrollOffset = container.scrollLeft;
    
    const playheadPercent = currentTime / duration;
    const playheadPixels = totalWidth * playheadPercent;
    const relativePosition = ((playheadPixels - scrollOffset) / containerWidth) * 100;
    return `${relativePosition}%`;
  };

  return (
    <Card sx={{ 
      width: '100%', 
      maxWidth: '800px',
      bgcolor: '#1E1E1E',
      color: '#FFFFFF'
    }}>
      <CardContent>

        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="audio-file-input"
            />
            <label htmlFor="audio-file-input">
              <Button
                variant="contained"
                component="span"
                sx={{ 
                  bgcolor: '#2A2A2A',
                  color: '#FFFFFF',
                  '&:hover': {
                    bgcolor: '#3A3A3A'
                  }
                }}
              >
                {audioFile ? 'CHANGE FILE' : 'CHOOSE FILE'}
              </Button>
            </label>
            {audioFileName && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#999999',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '300px'
                }}
              >
                {audioFileName}
              </Typography>
            )}
          </Box>
          
          {audioFile && (
            <>
              <audio
                ref={audioRef}
                src={audioFile}
                onEnded={() => setIsPlaying(false)}
              />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton 
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        setCurrentTime(0);
                      }
                    }}
                    sx={{ 
                      p: 1, 
                      bgcolor: '#333333',
                      color: '#FFA500',
                      '&:hover': {
                        bgcolor: '#444444'
                      }
                    }}
                  >
                    <SkipPreviousIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                  
                  <Button 
                    variant="contained"
                    onClick={togglePlayPause}
                    startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                    sx={{ 
                      px: 3, 
                      py: 1, 
                      bgcolor: '#FFA500',
                      '&:hover': {
                        bgcolor: '#FF8C00'
                      }
                    }}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '200px' }}>
                    <Slider
                      value={playbackRate}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                      sx={{ 
                        width: '140px',
                        color: '#FFA500',
                        '& .MuiSlider-thumb': {
                          '&:hover, &.Mui-focusVisible': {
                            boxShadow: '0 0 0 8px rgba(255, 165, 0, 0.16)'
                          }
                        },
                        '& .MuiSlider-rail': {
                          opacity: 0.28
                        }
                      }}
                    />
                    <Typography variant="body2" sx={{ 
                      width: '52px', 
                      color: '#FFA500',
                      ml: 1
                    }}>
                      {playbackRate.toFixed(2)}x
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton 
                      onClick={() => handleZoom('out')}
                      sx={{ 
                        p: 1, 
                        bgcolor: '#333333',
                        color: '#FFA500',
                        '&:hover': {
                          bgcolor: '#444444'
                        }
                      }}
                    >
                      <ZoomOutIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleZoom('in')}
                      sx={{ 
                        p: 1, 
                        bgcolor: '#333333',
                        color: '#FFA500',
                        '&:hover': {
                          bgcolor: '#444444'
                        }
                      }}
                    >
                      <ZoomInIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ position: 'relative' }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      position: 'absolute',
                      right: 0,
                      top: '-24px',
                      color: 'text.secondary',
                      fontStyle: 'italic'
                    }}
                  >
                    Press 'k' or 'l' to mark timestamps
                  </Typography>
                  <Box 
                    sx={{
                      overflowX: 'auto',
                      borderRadius: 1,
                      '&::-webkit-scrollbar': {
                        height: '8px',
                      },
                      '&::-webkit-scrollbar-track': {
                        backgroundColor: 'rgba(0,0,0,0.1)',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderRadius: '4px',
                      },
                      scrollBehavior: 'smooth',
                    }}
                    onScroll={handleScroll}
                  >
                    <Box 
                      ref={timelineRef}
                      sx={{
                        position: 'relative',
                        height: '128px',
                        bgcolor: 'grey.100',
                        width: `${zoom * 100}%`,
                        minWidth: '100%',
                        cursor: isDraggingTimelineRef.current ? 'grabbing' : (zoom > 1 ? 'grab' : 'pointer'),
                        userSelect: 'none',
                      }}
                      onClick={handleTimelineMouseDown}
                      onMouseDown={handleTimelineDragStart}
                    >
                      <Box 
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '8px',
                          zIndex: 10,
                          bgcolor: lastHitColor || 'transparent',
                          transition: 'background-color 0.1s'
                        }}
                      />

                      {timestamps.map((stamp, index) => {
                        const duration = audioRef.current?.duration || 1;
                        const timePercent = parseFloat(stamp.time) / duration;
                        const leftPercent = timePercent * 100;

                        return (
                          <Box
                            key={index}
                            sx={{
                              position: 'absolute',
                              height: '100%',
                              width: '20px',
                              cursor: 'move',
                              left: `${leftPercent}%`,
                              transform: 'translateX(-50%)',
                              display: 'flex',
                              justifyContent: 'center',
                              '&:hover': {
                                '& .timestamp-line': {
                                  opacity: 1,
                                  bgcolor: 'primary.main',
                                }
                              }
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedTimestamp(index);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.button === 0) {
                                handleDragStart(index, e);
                              }
                            }}
                          >
                            <Box
                              className="timestamp-line"
                              sx={{
                                width: '4px',
                                height: '100%',
                                bgcolor: selectedTimestamp === index ? 'primary.main' : 'primary.light',
                                opacity: selectedTimestamp === index ? 1 : 0.7,
                              }}
                            />
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                transform: 'translateX(-50%)',
                                bgcolor: 'background.paper',
                                px: 0.5,
                                borderRadius: 0.5,
                                fontSize: '12px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {parseFloat(stamp.time).toFixed(2)}s
                            </Box>
                          </Box>
                        );
                      })}

                      <Box
                        sx={{
                          position: 'absolute',
                          height: '100%',
                          width: '4px',
                          bgcolor: 'error.main',
                          left: `${(currentTime / (audioRef.current?.duration || 1)) * 100}%`,
                          transform: 'translateX(-50%)'
                        }}
                      />
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center'
                }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {timestamps.length} timestamp{timestamps.length !== 1 ? 's' : ''}
                  </Typography>
                  {timestamps.length > 0 && (
                    <Button
                      onClick={() => {
                        setTimestamps([]);
                        setSelectedTimestamp(null);
                      }}
                      sx={{
                        color: 'error.main',
                        '&:hover': {
                          color: 'error.dark',
                          background: 'transparent'
                        },
                        minWidth: 0,
                        p: 0,
                        fontSize: '12px'
                      }}
                    >
                      Clear all timestamps
                    </Button>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder="Paste timestamps [1.23, 4.56, ...]"
                    sx={{ 
                      flex: 1,
                      '& .MuiInputBase-input': {
                        fontSize: '14px',
                        py: 1,
                        color: '#FFFFFF'
                      },
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2A2A2A',
                        '& fieldset': {
                          borderColor: '#404040'
                        },
                        '&:hover fieldset': {
                          borderColor: '#505050'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#FFA500'
                        }
                      },
                      '& .MuiInputBase-input::placeholder': {
                        color: '#808080',
                        opacity: 1
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTimestampImport(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(e) => {
                      const input = e.target.previousSibling.querySelector('input');
                      handleTimestampImport(input.value);
                      input.value = '';
                    }}
                    sx={{ 
                      fontSize: '14px',
                      bgcolor: '#FFA500',
                      '&:hover': {
                        bgcolor: '#FF8C00'
                      }
                    }}
                  >
                    Import
                  </Button>
                </Box>

                {selectedTimestamp !== null && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography>Fine-tune selected timestamp:</Typography>
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ 
                        step: "0.01",
                        sx: { width: '100px' }
                      }}
                      value={timestamps[selectedTimestamp]?.time}
                      onChange={(e) => {
                        const updatedTimestamps = [...timestamps];
                        updatedTimestamps[selectedTimestamp] = { time: e.target.value };
                        setTimestamps(updatedTimestamps.sort((a, b) => parseFloat(a.time) - parseFloat(b.time)));
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setSelectedTimestamp(null)}
                      sx={{ 
                        fontSize: '14px',
                        bgcolor: '#333333',
                        '&:hover': {
                          bgcolor: '#444444'
                        }
                      }}
                    >
                      Done
                    </Button>
                  </Box>
                )}

                {timestamps.length > 0 && (
                  <Box sx={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mt: 2
                  }}>
                    <Button
                      variant="contained"
                      onClick={handleSendTimestamps}
                      sx={{ 
                        fontSize: '14px',
                        bgcolor: '#FFA500',
                        '&:hover': {
                          bgcolor: '#FF8C00'
                        }
                      }}
                    >
                      Send Timestamps to Connected Node
                    </Button>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default MusicKeyboardTracker; 