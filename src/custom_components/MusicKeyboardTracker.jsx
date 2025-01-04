import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, IconButton, Slider, TextField } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useNodeState } from '../stores/nodeStore';
import { dataService } from '../services/dataService';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';

const MusicKeyboardTracker = ({ nodeId, nodeData }) => {
  const [audioFile, setAudioFile] = useState(null);
  const [audioFileName, setAudioFileName] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timestamps, setTimestamps] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  const [lastHitTimestamp, setLastHitTimestamp] = useState(null);
  const [lastHitColor, setLastHitColor] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const audioRef = useRef(null);
  const timelineRef = useRef(null);
  const dragRef = useRef(null);
  const isDraggingTimelineRef = useRef(false);
  const isInteractingWithTimestampRef = useRef(false);
  const lastCheckedTimeRef = useRef(0);
  const initialMousePos = useRef({ x: 0, y: 0 });
  const initialLoadCompleteRef = useRef(false);
  const setParamValue = useNodeState((state) => state.setParamValue);
  const [draggedOver, setDraggedOver] = useState(null);
  const [hoveredTimestamp, setHoveredTimestamp] = useState(null);

  const handleZoom = useCallback((direction) => {
    if (!timelineRef.current?.parentElement || !audioRef.current) return;
    
    setZoom(currentZoom => {
      const newZoom = Math.min(
        Math.max(
          direction === 'in' ? currentZoom * 1.5 : currentZoom / 1.5,
          1
        ),
        50
      );
      return newZoom;
    });
  }, []);

  const getTimelineMetrics = (timelineEl, containerEl, duration, currentTime) => {
    if (!timelineEl || !containerEl || !duration) return null;
    
    const timelineRect = timelineEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    
    return {
      timelineWidth: timelineRect.width,
      containerWidth: containerRect.width,
      playheadPixels: (currentTime / duration) * timelineRect.width,
    };
  };

  useLayoutEffect(() => {
    if (!timelineRef.current?.parentElement || !audioRef.current) return;
    
    const timeline = timelineRef.current;
    const container = timeline.parentElement;
    const duration = audioRef.current.duration || 1;
    const timelineWidth = timeline.offsetWidth;
    const containerWidth = container.offsetWidth;
    
    // Calculate the pixel position of the playhead
    const playheadPosition = (currentTime / duration) * timelineWidth;
    
    if (zoom > 1) {
      // Remove smooth scrolling to prevent jerkiness
      container.style.scrollBehavior = 'auto';
      
      // Always center around playhead when zoomed
      const targetScrollLeft = Math.max(0, playheadPosition - (containerWidth / 2));
      
      // Ensure we don't scroll past the end
      const maxScroll = Math.max(0, timelineWidth - containerWidth);
      const finalScrollLeft = Math.min(Math.max(0, targetScrollLeft), maxScroll);
      
      container.scrollLeft = finalScrollLeft;
      setViewportStart(finalScrollLeft);
    }
  }, [zoom, currentTime]);

  const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  const loadImage = async (imageName) => {
    try {
      const response = await dataService.loadNodeFile(nodeId, imageName);
      if (response) {
        const blob = new Blob([response], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setImageUrls(prev => ({ ...prev, [imageName]: url }));
      }
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  useEffect(() => {
    timestamps.forEach(timestamp => {
      if (timestamp.image && !imageUrls[timestamp.image]) {
        loadImage(timestamp.image);
      }
    });
  }, [timestamps]);

  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const handleImageUpload = async (file, timestampId) => {
    if (file) {
      try {
        const fileBuffer = await file.arrayBuffer();
        const imageName = `${timestampId}_${file.name}`;
        await dataService.saveNodeFile(nodeId, imageName, fileBuffer);
        
        const url = URL.createObjectURL(new Blob([fileBuffer], { type: file.type }));
        setImageUrls(prev => ({ ...prev, [imageName]: url }));
        
        setTimestamps(prev => prev.map(t => 
          t.id === timestampId 
            ? { ...t, image: imageName }
            : t
        ));
      } catch (error) {
        console.error('Error saving image:', error);
        alert('Failed to save image. Please try again.');
      }
    }
  };

  const handleFileInputChange = (event, timestampId) => {
    const file = event.target.files[0];
    if (file) {
      handleImageUpload(file, timestampId);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const serverData = await dataService.loadNodeData(nodeId);
        console.log('Loaded server data:', serverData);
        
        if (serverData?.params?.timestamps) {
          console.log('Setting timestamps:', serverData.params.timestamps);
          const timestampsWithIds = serverData.params.timestamps.map(t => ({
            id: t.id || generateUniqueId(),
            time: t.time,
            image: t.image
          }));
          setTimestamps(timestampsWithIds);
          setParamValue(nodeId, 'timestamps', timestampsWithIds);
        }

        if (serverData?.files?.length > 0) {
          const fileName = serverData.files[0];
          console.log('Loading file:', fileName);
          const response = await dataService.loadNodeFile(nodeId, fileName);
          if (response) {
            console.log('File loaded successfully');
            const blob = new Blob([response], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            setAudioFile(url);
            setAudioFileName(fileName);
            
            const setNodeExecuted = useNodeState.getState().setNodeExecuted;
            setNodeExecuted(nodeId, true, 0, 0);
          }
        }
        initialLoadCompleteRef.current = true;
      } catch (error) {
        console.error('Error loading data:', error);
        initialLoadCompleteRef.current = true;
      }
    };

    loadData();
  }, [nodeId, setParamValue]);

  useEffect(() => {
    const saveData = async () => {
      if (!nodeId || !initialLoadCompleteRef.current) return;

      try {
        const data = {
          params: {
            component: 'MusicKeyboardTracker',
            timestamps: timestamps.map(t => ({
              id: t.id,
              time: t.time,
              image: t.image
            }))
          },
          files: [
            ...(audioFileName ? [audioFileName] : []),
            ...timestamps.filter(t => t.image).map(t => t.image)
          ],
          cache: true
        };
        
        console.log('Saving data:', data);
        await dataService.saveNodeData(nodeId, data);
        setParamValue(nodeId, 'timestamps', timestamps);
        
        const setNodeExecuted = useNodeState.getState().setNodeExecuted;
        setNodeExecuted(nodeId, true, 0, 0);
      } catch (error) {
        console.error('Error saving data:', error);
      }
    };
    
    saveData();
  }, [timestamps, nodeId, audioFileName, setParamValue]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const url = URL.createObjectURL(file);
        const fileBuffer = await file.arrayBuffer();
        await dataService.saveNodeFile(nodeId, file.name, fileBuffer);
        
        setAudioFile(url);
        setAudioFileName(file.name);
        setTimestamps([]);
        setViewportStart(0);
        setZoom(1);
        
        const data = {
          params: {
            component: 'MusicKeyboardTracker',
            timestamps: []
          },
          files: [file.name],
          cache: true
        };
        
        console.log('Saving initial data with file:', data);
        await dataService.saveNodeData(nodeId, data);
        setParamValue(nodeId, 'timestamps', []);
        
        const setNodeExecuted = useNodeState.getState().setNodeExecuted;
        setNodeExecuted(nodeId, true, 0, 0);
      } catch (error) {
        console.error('Error saving file:', error);
        alert('Failed to save file. Please try again.');
      }
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
      } else if (event.key === 'f' || event.key === 'g') {
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
              return [...prev, { 
                id: generateUniqueId(),
                time: timeStr 
              }].sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
            }
            console.log('Duplicate timestamp, skipping');
            return prev;
          });
        }
      } else if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        
        if (audioRef.current) {
          const newTime = Math.max(0, audioRef.current.currentTime - 0.33);
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          setLastHitColor(null);
        }
      } else if (event.key === 'r') {
        handleZoom('in');
      } else if (event.key === 'e') {
        handleZoom('out');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, handleZoom, setTimestamps, setCurrentTime, setLastHitColor]);

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
        
        for (let i = 0; i < timestamps.length; i++) {
          const stampTime = parseFloat(timestamps[i].time);
          
          if (lastCheckedTimeRef.current <= stampTime && currentTimeFloat >= stampTime) {
            setLastHitTimestamp(Date.now());
            setLastHitColor([
              '#FFB3B3',
              '#B3FFB3',
              '#B3B3FF',
              '#FFE6B3',
              '#FFB3FF',
              '#B3FFFF'
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
    
    // Set a high z-index for the dragged timestamp immediately
    const timestampElement = e.currentTarget;
    if (timestampElement) {
      timestampElement.style.zIndex = '100000';
      timestampElement.style.transition = 'none';
    }
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e) => {
    if (dragRef.current && timelineRef.current && audioRef.current) {
      const timeline = timelineRef.current;
      const duration = audioRef.current.duration || 1;
      const rect = timeline.getBoundingClientRect();
      const timelineWidth = rect.width;
      
      const deltaX = e.clientX - rect.left;
      const percentX = Math.max(0, Math.min(1, deltaX / timelineWidth));
      const newTime = (percentX * duration).toFixed(4);

      const updatedTimestamps = [...timestamps];
      const currentTimestamp = updatedTimestamps[dragRef.current.index];
      updatedTimestamps[dragRef.current.index] = { 
        ...currentTimestamp,
        time: newTime 
      };
      
      setTimestamps(updatedTimestamps.sort((a, b) => parseFloat(a.time) - parseFloat(b.time)));
    }
  };

  const handleDragEnd = () => {
    if (dragRef.current !== null) {
      // Reset the z-index with a transition
      const elements = document.querySelectorAll('.timestamp-marker');
      elements.forEach(el => {
        el.style.transition = 'z-index 0.2s';
        el.style.zIndex = '1';
      });
    }
    
    dragRef.current = null;
    isInteractingWithTimestampRef.current = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  const handleTimelineMouseDown = (e) => {
    if (isInteractingWithTimestampRef.current) {
      return;
    }

    if (timelineRef.current && audioRef.current) {
      const timeline = timelineRef.current;
      const duration = audioRef.current.duration;
      const rect = timeline.getBoundingClientRect();
      
      const clickX = e.clientX - rect.left;
      
      const clickPercent = clickX / rect.width;
      
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

  const handleTimestampGeneration = (timestamp) => {
    const currentTimestamps = useNodeState.getState().getParam(nodeId, 'timestamps') || [];
    const newTimestamps = [...currentTimestamps, timestamp];
    
    setParamValue(nodeId, 'timestamps', newTimestamps);
    console.log('Updated timestamps:', newTimestamps);
  };

  const calculatePlayheadPosition = () => {
    if (!timelineRef.current?.parentElement || !audioRef.current) return '0%';
    
    const metrics = getTimelineMetrics(
      timelineRef.current,
      timelineRef.current.parentElement,
      audioRef.current.duration,
      currentTime
    );
    
    if (!metrics) return '0%';
    
    if (zoom > 1) {
      return '50%';
    }
    
    const { timelineWidth, containerWidth, playheadPixels } = metrics;
    const scrollOffset = timelineRef.current.parentElement.scrollLeft;
    const relativePosition = ((playheadPixels - scrollOffset) / containerWidth) * 100;
    
    return `${Math.max(0, Math.min(100, relativePosition))}%`;
  };

  useEffect(() => {
    return () => {
      if (audioFile) {
        URL.revokeObjectURL(audioFile);
      }
    };
  }, [audioFile]);

  useEffect(() => {
    const unsubscribe = useNodeState.subscribe(
      (state) => state.nodes.find(n => n.id === nodeId)?.data?.cache,
      (cache) => {
        if (cache === false) {
          if (audioFile) {
            URL.revokeObjectURL(audioFile);
            setAudioFile(null);
            setAudioFileName(null);
            setTimestamps([]);
          }
        }
      }
    );
    return () => unsubscribe();
  }, [nodeId, audioFile]);

  useEffect(() => {
    const handleDelete = async (event) => {
      if (event.key === 'd' && hoveredTimestamp !== null) {
        const timestampToDelete = timestamps[hoveredTimestamp];
        if (timestampToDelete.image) {
          try {
            await dataService.deleteNodeFile(nodeId, timestampToDelete.image);
            if (imageUrls[timestampToDelete.image]) {
              URL.revokeObjectURL(imageUrls[timestampToDelete.image]);
              setImageUrls(prev => {
                const newUrls = { ...prev };
                delete newUrls[timestampToDelete.image];
                return newUrls;
              });
            }
          } catch (error) {
            console.error('Error deleting image file:', error);
          }
        }
        setTimestamps(prev => prev.filter((_, index) => index !== hoveredTimestamp));
        setHoveredTimestamp(null);
      }
    };

    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [hoveredTimestamp, timestamps, nodeId, imageUrls]);

  return (
    <Card sx={{ 
      width: '100%', 
      maxWidth: '800px',
      minHeight: '140px',
      bgcolor: '#1E1E1E',
      color: '#FFFFFF'
    }}>
      <CardContent>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2,
          width: '100%',
        }}>
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
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  justifyContent: 'space-between',
                  width: '100%'
                }}>
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

                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#999999',
                      fontStyle: 'italic',
                      mt: 3,
                      mr: 1
                    }}
                  >
                    Press 'f' or 'g' to mark timestamps
                  </Typography>
                </Box>

                <Box sx={{ position: 'relative' }}>
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
                        height: '140px',
                        bgcolor: 'grey.100',
                        width: `${(1 + (zoom - 1) * 0.5) * 100}%`,
                        minWidth: zoom <= 1 ? '100%' : Math.max(800, window.innerWidth * (1 + (zoom - 1) * 0.2)),
                        cursor: isDraggingTimelineRef.current ? 'grabbing' : (zoom > 1 ? 'grab' : 'pointer'),
                        userSelect: 'none',
                        '&:hover': {
                          '& .hover-button': {
                            opacity: isInteractingWithTimestampRef.current ? 0 : 1
                          }
                        }
                      }}
                      onClick={handleTimelineMouseDown}
                      onMouseDown={handleTimelineDragStart}
                      onMouseMove={(e) => {
                        if (!isDraggingTimelineRef.current && timelineRef.current) {
                          const rect = timelineRef.current.getBoundingClientRect();
                          const mouseX = e.clientX - rect.left;
                          const percentageAcross = mouseX / rect.width * 100;
                          
                          const hoverButton = document.querySelector('.hover-button');
                          if (hoverButton) {
                            hoverButton.style.left = `${percentageAcross}%`;
                          }
                        }
                      }}
                    >
                      <Button
                        className="hover-button"
                        variant="contained"
                        size="small"
                        sx={{
                          position: 'absolute',
                          transform: 'translateX(-50%)',
                          top: '0px',
                          height: '14px',
                          width: '14px',
                          minWidth: '14px',
                          zIndex: 20,
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          bgcolor: 'rgba(255, 165, 0, 0.4)',
                          color: 'white',
                          padding: 0,
                          minHeight: 0,
                          fontSize: '12px',
                          lineHeight: 1,
                          '&:hover': {
                            bgcolor: 'rgba(255, 165, 0, 0.8)'
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: '-5px',
                            left: '-5px',
                            right: '-5px',
                            bottom: '-5px',
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (audioRef.current && timelineRef.current) {
                            const rect = timelineRef.current.getBoundingClientRect();
                            const mouseX = e.clientX - rect.left;
                            const percentageAcross = mouseX / rect.width;
                            const duration = audioRef.current.duration || 1;
                            const time = percentageAcross * duration;
                            const timeStr = time.toFixed(4);
                            
                            setTimestamps(prev => {
                              const isDuplicate = prev.some(t => t.time === timeStr);
                              if (!isDuplicate) {
                                return [...prev, { 
                                  id: generateUniqueId(),
                                  time: timeStr 
                                }].sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
                              }
                              return prev;
                            });
                          }
                        }}
                      >
                        +
                      </Button>

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
                            key={stamp.id}
                            className="timestamp-marker"
                            sx={{
                              position: 'absolute',
                              height: '100%',
                              width: zoom <= 1 ? '8px' : '12px',
                              cursor: 'move',
                              left: `${leftPercent}%`,
                              transform: 'translateX(-50%)',
                              display: 'flex',
                              justifyContent: 'center',
                              zIndex: (dragRef.current?.index === index) ? 100000 : (hoveredTimestamp === index ? 10 : 1),
                              pointerEvents: 'auto',
                              transition: 'z-index 0.2s',
                              '& > *': {
                                zIndex: 'inherit',
                              },
                              '&:hover': {
                                zIndex: dragRef.current ? 1 : 10,
                                '& > *': {
                                  zIndex: 'inherit'
                                },
                                '& .timestamp-line': {
                                  opacity: 1,
                                  bgcolor: 'primary.main',
                                }
                              }
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onMouseEnter={() => setHoveredTimestamp(index)}
                            onMouseLeave={() => setHoveredTimestamp(null)}
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
                                bgcolor: hoveredTimestamp === index ? 'error.main' : 'primary.light',
                                opacity: hoveredTimestamp === index ? 1 : 0.7,
                                '&:hover': {
                                  opacity: 1,
                                  bgcolor: 'error.main'
                                },
                                transition: 'all 0.2s'
                              }}
                            />
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                bgcolor: 'background.paper',
                                px: 0.5,
                                py: 0.25,
                                borderRadius: 0.5,
                                fontSize: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                zIndex: (dragRef.current?.index === index || hoveredTimestamp === index) ? 100000 : 1,
                                pointerEvents: 'auto',
                                '& > *': {
                                  zIndex: (dragRef.current?.index === index || hoveredTimestamp === index) ? 100000 : 1,
                                },
                                '&:hover': {
                                  zIndex: 100000,
                                  '& > *': {
                                    zIndex: 100000
                                  }
                                },
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  width: '48px',
                                  height: '64px',
                                  zIndex: 0,
                                  ...(draggedOver === stamp.id && {
                                    bgcolor: 'rgba(255, 165, 0, 0.2)',
                                    border: '2px dashed #FFA500',
                                    borderRadius: '4px'
                                  })
                                },
                                '& .image-upload-button': {
                                  display: 'none',
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  marginBottom: '8px',
                                  transition: 'opacity 0.2s',
                                  zIndex: 1
                                },
                                '&:hover .image-upload-button': {
                                  display: 'block',
                                  opacity: 1
                                },
                                '& .delete-button': {
                                  display: 'none',
                                  position: 'absolute',
                                  right: '-1px',
                                  top: '-2px',
                                  transform: 'none',
                                  padding: '2px',
                                  minWidth: 'unset',
                                  width: '14px',
                                  height: '14px',
                                  fontSize: '10px',
                                  lineHeight: 1,
                                  color: '#FFA500',
                                  bgcolor: 'transparent',
                                  '&:hover': {
                                    bgcolor: 'rgba(255, 68, 68, 0.1)'
                                  }
                                },
                                '&:hover .delete-button': {
                                  display: 'flex'
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.dataTransfer.types.includes('Files')) {
                                  setDraggedOver(stamp.id);
                                }
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDraggedOver(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDraggedOver(null);
                                const file = e.dataTransfer.files[0];
                                if (file && file.type.startsWith('image/')) {
                                  handleImageUpload(file, stamp.id);
                                }
                              }}
                            >
                              {stamp.image && imageUrls[stamp.image] && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: 48,
                                    height: 48,
                                    marginBottom: '8px',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                      transform: 'translateX(-50%) scale(1.5)',
                                      zIndex: 30,
                                      border: '1px solid rgba(255, 255, 255, 0.4)',
                                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                                    }
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={imageUrls[stamp.image]}
                                    alt={`Timestamp ${stamp.time}`}
                                    sx={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                  />
                                </Box>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileInputChange(e, stamp.id)}
                                style={{ display: 'none' }}
                                id={`image-upload-${stamp.id}`}
                              />
                              <label 
                                htmlFor={`image-upload-${stamp.id}`}
                                className="image-upload-button"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <IconButton
                                  component="span"
                                  size="small"
                                  sx={{ 
                                    p: 0.5,
                                    bgcolor: stamp.image ? 'primary.main' : 'grey.500',
                                    color: 'white',
                                    '&:hover': {
                                      bgcolor: stamp.image ? 'primary.dark' : 'grey.600'
                                    }
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <AddPhotoAlternateIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </label>
                              {parseFloat(stamp.time).toFixed(2)}s
                              <Button
                                className="delete-button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (stamp.image) {
                                    try {
                                      await dataService.deleteNodeFile(nodeId, stamp.image);
                                      if (imageUrls[stamp.image]) {
                                        URL.revokeObjectURL(imageUrls[stamp.image]);
                                        setImageUrls(prev => {
                                          const newUrls = { ...prev };
                                          delete newUrls[stamp.image];
                                          return newUrls;
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Error deleting image file:', error);
                                    }
                                  }
                                  setTimestamps(prev => prev.filter(t => t.id !== stamp.id));
                                }}
                              >
                                ×
                              </Button>
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
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: `${(currentTime / (audioRef.current?.duration || 1)) * 100}%`,
                          transform: 'translateX(-50%)',
                          bgcolor: 'background.paper',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          fontSize: '12px',
                          color: 'error.main',
                          fontWeight: 'bold',
                          zIndex: 15
                        }}
                      >
                        {currentTime.toFixed(2)}s
                      </Box>
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
                </Box>
              </Box>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default MusicKeyboardTracker;