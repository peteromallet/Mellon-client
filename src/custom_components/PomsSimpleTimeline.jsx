import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, IconButton, Slider, TextField, Tooltip } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useNodeState } from '../stores/nodeStore';
import { dataService } from '../services/dataService';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';

const PomsSimpleTimeline = ({ nodeId, nodeData }) => {
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
  const [hoveredTimestamp, setHoveredTimestamp] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTimestamp, setDraggedTimestamp] = useState(null);
  const [draggedOver, setDraggedOver] = useState(null);
  const justFinishedDraggingRef = useRef(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);
  const [isDeletingTimestamp, setIsDeletingTimestamp] = useState(null);
  const lastManualSelectionRef = useRef(null);

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
        console.log('DEBUG - Loaded server data:', {
          serverData,
          hasTimestamps: !!serverData?.params?.timestamps,
          timestampCount: serverData?.params?.timestamps?.length
        });
        
        if (serverData?.params?.timestamps) {
          console.log('DEBUG - Setting timestamps:', serverData.params.timestamps);
          const timestampsWithIds = serverData.params.timestamps.map(t => ({
            id: t.id || generateUniqueId(),
            time: t.time,
            image: t.image
          }));
          setTimestamps(timestampsWithIds);
          setParamValue(nodeId, 'timestamps', timestampsWithIds);
          console.log('DEBUG - Timestamps set:', timestampsWithIds);
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
            
            // Force audio to load
            if (audioRef.current) {
              audioRef.current.load();
              // Wait for metadata to load
              await new Promise((resolve) => {
                const handleLoaded = () => {
                  audioRef.current.removeEventListener('loadedmetadata', handleLoaded);
                  resolve();
                };
                audioRef.current.addEventListener('loadedmetadata', handleLoaded);
              });
            }
            
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
      // Don't save if we're dragging or haven't loaded initially
      if (!nodeId || !initialLoadCompleteRef.current || dragRef.current) return;

      try {
        // Ensure timestamps are valid before saving
        const validTimestamps = timestamps
          .filter(t => t && typeof t === 'object')
          .map(t => ({
            id: t.id || generateUniqueId(),
            time: t.time || '0',
            image: t.image || null
          }))
          .filter(t => !isNaN(parseFloat(t.time)));

        // Only save if we have valid data
        if (validTimestamps.length > 0) {
          const data = {
            params: {
              component: 'PomsSimpleTimeline',
              timestamps: validTimestamps
            },
            files: [
              ...(audioFileName ? [audioFileName] : []),
              ...validTimestamps
                .filter(t => t.image)
                .map(t => t.image)
                .filter(Boolean)
            ].filter(Boolean),
            cache: true
          };

          // Save node data first
          await dataService.saveNodeData(nodeId, data);
          
          // Then update param value
          await setParamValue(nodeId, 'timestamps', validTimestamps);
        }
      } catch (error) {
        console.error('Error saving data:', error);
      }
    };

    // Debounce the save operation
    const timeoutId = setTimeout(saveData, 500);
    return () => clearTimeout(timeoutId);
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

        // Force audio to load
        if (audioRef.current) {
          audioRef.current.load();
          // Wait for metadata to load
          await new Promise((resolve) => {
            const handleLoaded = () => {
              audioRef.current.removeEventListener('loadedmetadata', handleLoaded);
              resolve();
            };
            audioRef.current.addEventListener('loadedmetadata', handleLoaded);
          });
        }
        
        const data = {
          params: {
            component: 'PomsSimpleTimeline',
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
      } else if (event.key === '1' || event.key === '2') {
        event.preventDefault();
        
        console.log('DEBUG - Key press state:', {
          currentTime,
          timestamps: timestamps.map(t => ({ id: t.id, time: t.time })),
          isPlaying,
          selectedTimestamp
        });
        
        const sortedTimestamps = [...timestamps].sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
        
        if (event.key === '1') {
          // Find previous timestamp, including exact matches
          const prevTimestamp = sortedTimestamps.reverse().find(t => {
            const stampTime = parseFloat(t.time);
            return stampTime <= currentTime && Math.abs(stampTime - currentTime) > 0.01;
          });
          if (prevTimestamp) {
            console.log('DEBUG - Found prev timestamp:', {
              currentTime,
              prevTime: prevTimestamp.time,
              allTimes: sortedTimestamps.map(t => t.time),
              willSelect: prevTimestamp.id
            });
            const newTime = parseFloat(prevTimestamp.time);
            setCurrentTime(newTime);
            setSelectedTimestamp(prevTimestamp.id);
            lastManualSelectionRef.current = Date.now();
            setLastHitColor(null);
            // Only update audio if it's playing
            if (isPlaying && audioRef.current) {
              audioRef.current.currentTime = newTime;
            }
            console.log('DEBUG - After selection:', {
              selectedTimestamp: prevTimestamp.id,
              lastManualSelectionTime: lastManualSelectionRef.current
            });
          }
        } else {
          // Find next timestamp, including exact matches
          const nextTimestamp = sortedTimestamps.find(t => {
            const stampTime = parseFloat(t.time);
            return stampTime >= currentTime && Math.abs(stampTime - currentTime) > 0.01;
          });
          if (nextTimestamp) {
            console.log('DEBUG - Found next timestamp:', {
              currentTime,
              nextTime: nextTimestamp.time,
              allTimes: sortedTimestamps.map(t => t.time),
              willSelect: nextTimestamp.id
            });
            const newTime = parseFloat(nextTimestamp.time);
            setCurrentTime(newTime);
            setSelectedTimestamp(nextTimestamp.id);
            lastManualSelectionRef.current = Date.now();
            setLastHitColor(null);
            // Only update audio if it's playing
            if (isPlaying && audioRef.current) {
              audioRef.current.currentTime = newTime;
            }
            console.log('DEBUG - After selection:', {
              selectedTimestamp: nextTimestamp.id,
              lastManualSelectionTime: lastManualSelectionRef.current
            });
          }
        }
      } else if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        
        if (audioRef.current) {
          const newTime = Math.max(0, audioRef.current.currentTime - 0.33);
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          setLastHitColor(null);
        }
      } else if (event.key === 't') {
        event.preventDefault();
        
        if (audioRef.current) {
          const newTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 0.33);
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          setLastHitColor(null);
        }
      } else if (event.key === 'q') {
        setPlaybackRate(prev => Math.max(0, prev - 0.1));
      } else if (event.key === 'w') {
        setPlaybackRate(prev => Math.min(2, prev + 0.1));
      } else if (event.key === 'r') {
        handleZoom('in');
      } else if (event.key === 'e') {
        handleZoom('out');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, handleZoom, timestamps, currentTime, setCurrentTime, setLastHitColor]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleTimeUpdate = () => {
        console.log('DEBUG - timeupdate event fired:', {
          isPlaying,
          currentTime: audio.currentTime,
          lastCheckedTime: lastCheckedTimeRef.current
        });
        
        const currentTimeFloat = audio.currentTime;
        const previousTime = lastCheckedTimeRef.current;
        
        setCurrentTime(currentTimeFloat);
        
        // Only check for passed timestamps during playback
        if (isPlaying) {
          // Find the most recently passed timestamp
          let passedIndex = -1;
          for (let i = 0; i < timestamps.length; i++) {
            const stampTime = parseFloat(timestamps[i].time);
            
            // Check if we've passed this timestamp since the last update
            if (previousTime <= stampTime && currentTimeFloat >= stampTime) {
              passedIndex = i;
              console.log('DEBUG - Passed timestamp:', {
                stampId: timestamps[i].id,
                stampTime,
                previousTime,
                currentTimeFloat
              });
              
              setLastHitTimestamp(Date.now());
              setLastHitColor([
                '#FFB3B3',
                '#B3FFB3',
                '#B3B3FF',
                '#FFE6B3',
                '#FFB3FF',
                '#B3FFFF'
              ][i % 6]);
              
              setSelectedTimestamp(timestamps[i].id);
              break;
            }
          }
        }
        
        lastCheckedTimeRef.current = currentTimeFloat;
      };

      console.log('DEBUG - Setting up timeupdate listener');
      audio.addEventListener('timeupdate', handleTimeUpdate);
      
      return () => {
        console.log('DEBUG - Removing timeupdate listener');
        audio.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [isPlaying, timestamps]);

  const handleScroll = (e) => {
    if (!isPlaying) {
      setViewportStart(e.target.scrollLeft);
    }
  };

  const handleSelection = (stampId, e) => {
    if (!isDragging && !e.target.closest('.image-delete-button')) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedTimestamp(stampId === selectedTimestamp ? null : stampId);
    }
  };

  const handleDragStart = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const timestamp = timestamps[index];
    if (!timestamp || !timestamp.id || typeof timestamp !== 'object') {
      console.error('Invalid timestamp:', timestamp);
      return;
    }
    
    isInteractingWithTimestampRef.current = true;
    setIsDragging(true);
    setDraggedTimestamp(timestamp.id);
    dragRef.current = {
      id: timestamp.id,
      startX: e.clientX,
      originalTime: parseFloat(timestamp.time) || 0
    };
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e) => {
    if (!dragRef.current?.id || !timelineRef.current || !audioRef.current) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    const timeline = timelineRef.current;
    const duration = audioRef.current.duration || 1;
    const rect = timeline.getBoundingClientRect();
    const timelineWidth = rect.width;
    
    const deltaX = e.clientX - rect.left;
    const percentX = Math.max(0, Math.min(1, deltaX / timelineWidth));
    const newTime = (percentX * duration).toFixed(4);

    // Update timestamp without sorting
    setTimestamps(prevTimestamps => {
      if (!Array.isArray(prevTimestamps)) return prevTimestamps;

      // First validate the dragRef.current
      if (!dragRef.current?.id) {
        return prevTimestamps;
      }

      // Then update only that timestamp
      return prevTimestamps.map(stamp => {
        if (!stamp || typeof stamp !== 'object') return stamp;
        return stamp.id === dragRef.current.id 
          ? { ...stamp, time: newTime }
          : stamp;
      });
    });
  };

  const handleDragEnd = (e) => {
    if (dragRef.current !== null) {
      // Prevent the mouseup event from triggering timeline click
      e.preventDefault();
      e.stopPropagation();

      // Sort timestamps only at the end of drag
      setTimestamps(prev => {
        return [...prev].sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
      });
    }
    
    // Clear all drag and interaction states immediately
    setIsDragging(false);
    setDraggedTimestamp(null);
    dragRef.current = null;
    isInteractingWithTimestampRef.current = false;
    // Don't clear selected timestamp here
    justFinishedDraggingRef.current = true;
    setTimeout(() => {
      justFinishedDraggingRef.current = false;
    }, 100);
    
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  const handleTimelineMouseDown = async (e) => {
    if (isInteractingWithTimestampRef.current || justFinishedDraggingRef.current) {
      return;
    }

    if (timelineRef.current && audioRef.current) {
      const timeline = timelineRef.current;
      const duration = audioRef.current.duration;
      
      const rect = timeline.getBoundingClientRect();
      
      // When zoomed out, use simple relative positioning
      if (zoom <= 1) {
        const clickX = e.clientX - rect.left;
        const clickPercent = clickX / rect.width;
        const newTime = clickPercent * duration;
        
        if (newTime >= 0 && newTime <= duration) {
          console.log('DEBUG - Timeline click:', {
            newTime,
            currentTime,
            timestamps: timestamps.map(t => ({ id: t.id, time: t.time }))
          });
          setLastHitColor(null);
          setCurrentTime(newTime);
          // Only update audio if playing
          if (isPlaying) {
            audioRef.current.currentTime = newTime;
          }
        }
        return;
      }
      
      // When zoomed in, account for scroll position
      const container = timeline.parentElement;
      const scrollLeft = container.scrollLeft;
      const totalWidth = timeline.offsetWidth;
      const clickX = e.clientX - rect.left + scrollLeft;
      const clickPercent = clickX / totalWidth;
      
      const newTime = clickPercent * duration;
      
      if (newTime >= 0 && newTime <= duration) {
        setLastHitColor(null);
        // Set React state first
        setCurrentTime(newTime);
        // Only update audio if playing
        if (isPlaying) {
          audioRef.current.currentTime = newTime;
        }
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

  const handleTimelineDragEnd = (e) => {
    if (!isDraggingTimelineRef.current && timelineRef.current && audioRef.current) {
      const timeline = timelineRef.current;
      const duration = audioRef.current.duration;
      
      // Use timeline's getBoundingClientRect directly instead of container
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
      if (event.key === 'd' && selectedTimestamp !== null) {
        event.preventDefault();
        event.stopPropagation();
        
        const timestampToDelete = timestamps.find(t => t.id === selectedTimestamp);
        if (!timestampToDelete) return;

        // If there's an image, delete it first
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

        // Delete the timestamp and clear selection
        setTimestamps(prev => prev.filter(t => t.id !== selectedTimestamp));
        setSelectedTimestamp(null);
      }
    };

    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [selectedTimestamp, timestamps, nodeId, imageUrls]);

  const preventEventsDuringDrag = (e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  };

  // Add effect to sync audio with timeline when playing starts
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.currentTime = currentTime;
    }
  }, [isPlaying]);

  return (
    <Card sx={{ 
      width: '100%', 
      maxWidth: '800px',
      minWidth: '800px',
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
                preload="metadata"
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
                        max={2}
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

                  <Tooltip 
                    title={
                      <Box sx={{ p: 1, fontSize: '0.875rem' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                          Keyboard Shortcuts
                        </Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                          <li>Space - Play/Pause</li>
                          <li>F/G - Add timestamp</li>
                          <li>Q/W - Decrease/Increase speed</li>
                          <li>E/R - Zoom out/in</li>
                          <li>1/2 - Jump to previous/next timestamp</li>
                          <li>Tab/T - Scrub backward/forwards</li>
                          <li>D - Delete selected</li>
                        </Box>
                      </Box>
                    }
                    arrow
                    placement="left"
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

                <Box sx={{ position: 'relative' }}>
                  <Box 
                    sx={{
                      overflowX: zoom > 1 ? 'auto' : 'hidden',
                      borderRadius: 1,
                      '&::-webkit-scrollbar': {
                        height: '8px',
                        display: zoom > 1 ? 'block' : 'none'
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
                      <Box 
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '8px',
                          zIndex: 99999,
                          bgcolor: lastHitColor || 'transparent',
                          transition: 'background-color 0.1s',
                          opacity: lastHitColor ? 1 : 0,
                          pointerEvents: 'none'
                        }}
                      />
                      
                      <Box 
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          bgcolor: 'grey.100',
                          zIndex: 1
                        }}
                      />

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

                      {timestamps.map((stamp, index) => {
                        const duration = audioRef.current?.duration || 1;
                        const timePercent = parseFloat(stamp.time) / duration;
                        const leftPercent = timePercent * 100;

                        return (
                          <Box
                            key={stamp.id}
                            className={`timestamp-marker ${selectedTimestamp === stamp.id ? 'selected' : ''}`}
                            sx={{
                              position: 'absolute',
                              height: '100%',
                              width: '4px',
                              cursor: isDragging ? (draggedTimestamp === stamp.id ? 'grabbing' : 'default') : 'grab',
                              left: `${leftPercent}%`,
                              transform: 'translateX(-50%)',
                              display: 'flex',
                              justifyContent: 'center',
                              zIndex: draggedTimestamp === stamp.id ? 100000 : 
                                     selectedTimestamp === stamp.id ? 99999 :
                                     hoveredTimestamp === stamp.id ? 99998 : 1,
                              pointerEvents: isDragging && draggedTimestamp !== stamp.id ? 'none' : 'auto',
                              transition: draggedTimestamp === stamp.id ? 'none' : 'all 0.2s',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                width: '2px',
                                height: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: draggedTimestamp === stamp.id 
                                  ? '#FFA500'
                                  : selectedTimestamp === stamp.id || hoveredTimestamp === stamp.id
                                    ? '#FFA500'
                                    : 'primary.light',
                                opacity: selectedTimestamp === stamp.id || hoveredTimestamp === stamp.id || draggedTimestamp === stamp.id ? 1 : 0.7,
                                transition: 'all 0.2s',
                                zIndex: -1,
                              },
                              '& > *': {
                                zIndex: 'inherit',
                                pointerEvents: isDragging && draggedTimestamp !== stamp.id ? 'none' : 'auto'
                              },
                              '&:hover, &.selected': {
                                zIndex: draggedTimestamp === stamp.id ? 100000 : 99999
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (!isDragging) {
                                setHoveredTimestamp(stamp.id);
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isDragging) {
                                setHoveredTimestamp(null);
                              }
                            }}
                            onClick={(e) => handleSelection(stamp.id, e)}
                            onMouseDown={(e) => {
                              if (e.button === 0 && !e.target.closest('.image-delete-button')) {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDragStart(index, e);
                              }
                            }}
                          >
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
                                zIndex: 2,
                                pointerEvents: 'auto',
                                width: 'fit-content',
                                minWidth: '36px',
                                height: '20px',
                                '& > *': {
                                  zIndex: 'inherit',
                                },
                                '& > span': {
                                  pointerEvents: 'auto',
                                  padding: '2px 4px'
                                },
                                '&:hover': {
                                  '& .delete-button': {
                                    opacity: isDeletingTimestamp === stamp.id ? 0.5 : 1,
                                    visibility: 'visible',
                                    pointerEvents: isDeletingTimestamp === stamp.id ? 'none' : 'auto'
                                  }
                                },
                                '& .delete-button': {
                                  opacity: 0,
                                  visibility: isDragging ? 'hidden' : 'visible',
                                  transition: 'opacity 0.2s, visibility 0.2s'
                                }
                              }}
                              onMouseEnter={(e) => {
                                if (e.target === e.currentTarget && !isDragging) {
                                  setHoveredTimestamp(stamp.id);
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (e.target === e.currentTarget && !isDragging) {
                                  setHoveredTimestamp(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!stamp.image) {
                                  setDraggedOver(stamp.id);
                                }
                              }}
                              onDragEnter={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!stamp.image) {
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
                              <Box className="upload-hover-area" />
                              {stamp.image && imageUrls[stamp.image] && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: '50%',
                                    transform: draggedTimestamp === stamp.id 
                                      ? 'translateX(-50%) scale(1.5) translateY(-8px)'
                                      : (hoveredTimestamp === stamp.id || selectedTimestamp === stamp.id) && !isDragging
                                        ? 'translateX(-50%) scale(1.5) translateY(-8px)'
                                        : 'translateX(-50%) scale(1) translateY(0)',
                                    width: 48,
                                    height: 48,
                                    marginBottom: '8px',
                                    borderRadius: 1,
                                    overflow: 'visible',
                                    border: draggedTimestamp === stamp.id || ((hoveredTimestamp === stamp.id || selectedTimestamp === stamp.id) && !isDragging)
                                      ? '1px solid rgba(255, 255, 255, 0.4)'
                                      : '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: draggedTimestamp === stamp.id || ((hoveredTimestamp === stamp.id || selectedTimestamp === stamp.id) && !isDragging)
                                      ? '0 8px 16px rgba(0,0,0,0.3)'
                                      : '0 2px 4px rgba(0,0,0,0.1)',
                                    transition: draggedTimestamp === stamp.id 
                                      ? 'none' 
                                      : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'move',
                                    zIndex: 3,
                                    pointerEvents: isDragging && draggedTimestamp !== stamp.id ? 'none' : 'auto',
                                    '&:hover': {
                                      '& .image-delete-button': {
                                        opacity: isDragging ? 0 : 1,
                                        transform: isDragging ? 'scale(0.8)' : 'scale(1)',
                                        visibility: isDragging ? 'hidden' : 'visible'
                                      }
                                    }
                                  }}
                                  onMouseDown={(e) => {
                                    if (!e.target.closest('.image-delete-button')) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDragStart(index, e);
                                    }
                                  }}
                                  onClick={(e) => handleSelection(stamp.id, e)}
                                  onMouseEnter={(e) => preventEventsDuringDrag(e)}
                                  onMouseLeave={(e) => preventEventsDuringDrag(e)}
                                >
                                  <Box
                                    component="img"
                                    src={imageUrls[stamp.image]}
                                    alt={`Timestamp ${stamp.time}`}
                                    sx={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      pointerEvents: 'none',
                                      borderRadius: 'inherit'
                                    }}
                                  />
                                  <IconButton
                                    className="image-delete-button"
                                    onClick={async (e) => {
                                      console.log('Delete button clicked - START');
                                      e.preventDefault();
                                      e.stopPropagation();
                                      e.nativeEvent.stopImmediatePropagation();
                                      
                                      try {
                                        // First, get current node data
                                        const currentData = await dataService.loadNodeData(nodeId);
                                        if (!currentData) {
                                          throw new Error('Could not load node data');
                                        }

                                        // Remove the file from the files array
                                        const updatedFiles = (currentData.files || []).filter(f => f !== stamp.image);

                                        // Update node data with the file removed
                                        await dataService.saveNodeData(nodeId, {
                                          ...currentData,
                                          files: updatedFiles
                                        });

                                        // Clean up the URL from memory
                                        if (imageUrls[stamp.image]) {
                                          URL.revokeObjectURL(imageUrls[stamp.image]);
                                          setImageUrls(prev => {
                                            const newUrls = { ...prev };
                                            delete newUrls[stamp.image];
                                            return newUrls;
                                          });
                                        }

                                        // Update timestamps to remove image reference
                                        setTimestamps(prev => prev.map(t => 
                                          t.id === stamp.id 
                                            ? { ...t, image: undefined }
                                            : t
                                        ));

                                        console.log('Image deletion complete');
                                      } catch (error) {
                                        console.error('Error removing image:', error);
                                      }
                                    }}
                                    onMouseDown={(e) => {
                                      console.log('Delete button mouse down');
                                      e.preventDefault();
                                      e.stopPropagation();
                                      e.nativeEvent.stopImmediatePropagation();
                                    }}
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      width: 16,
                                      height: 16,
                                      padding: 0,
                                      minWidth: 'unset',
                                      opacity: 0,
                                      transform: 'scale(0.8)',
                                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                      border: '1px solid rgba(255, 255, 255, 0.3)',
                                      color: 'white',
                                      fontSize: '12px',
                                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                      zIndex: 31,
                                      pointerEvents: isDragging ? 'none' : 'auto',
                                      visibility: isDragging ? 'hidden' : 'visible',
                                      borderRadius: '0 4px 0 4px',
                                      '&:hover': {
                                        backgroundColor: 'rgba(255, 0, 0, 0.6)',
                                        border: '1px solid rgba(255, 255, 255, 0.5)',
                                        transform: 'scale(1.1)'
                                      },
                                      '& .MuiTouchRipple-root': {
                                        display: 'none'
                                      }
                                    }}
                                  >
                                    ×
                                  </IconButton>
                                </Box>
                              )}
                              {!stamp.image && !draggedTimestamp && (
                                <>
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
                                    style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      left: '50%',
                                      transform: 'translateX(-50%)',
                                      marginBottom: '4px',
                                      padding: '2px',
                                      zIndex: hoveredTimestamp === stamp.id ? 997 : 998,
                                      pointerEvents: isDragging ? 'none' : 'auto',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '24px',
                                      height: '24px',
                                      cursor: 'pointer',
                                      opacity: hoveredTimestamp === stamp.id && !isDragging ? 1 : 0,
                                      visibility: hoveredTimestamp === stamp.id && !isDragging ? 'visible' : 'hidden',
                                      transition: 'opacity 0.2s'
                                    }}
                                  >
                                    <IconButton
                                      component="span"
                                      size="small"
                                      sx={{ 
                                        p: 0.5,
                                        bgcolor: 'grey.500',
                                        color: 'white',
                                        width: '24px',
                                        height: '24px',
                                        '&:hover': {
                                          bgcolor: 'grey.600'
                                        }
                                      }}
                                    >
                                      <AddPhotoAlternateIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </label>
                                </>
                              )}
                              <Typography sx={{ fontSize: 'inherit', color: 'text.primary' }}>
                                {parseFloat(stamp.time).toFixed(2)}s
                              </Typography>
                              <Button
                                className="delete-button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();

                                  // Prevent multiple clicks during deletion
                                  if (isDeletingTimestamp === stamp.id) return;
                                  setIsDeletingTimestamp(stamp.id);

                                  try {
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
                                  } finally {
                                    setIsDeletingTimestamp(null);
                                  }
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                }}
                                sx={{
                                  position: 'absolute',
                                  right: -4,
                                  top: -4,
                                  width: 16,
                                  height: 16,
                                  minWidth: 'unset',
                                  padding: 0,
                                  color: '#FFA500',
                                  bgcolor: 'transparent',
                                  fontSize: '14px',
                                  lineHeight: 1,
                                  cursor: isDeletingTimestamp === stamp.id ? 'not-allowed' : 'pointer',
                                  zIndex: 1000,
                                  opacity: isDeletingTimestamp === stamp.id ? 0.5 : 0,
                                  transform: 'scale(0.8)',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                  pointerEvents: isDeletingTimestamp === stamp.id ? 'none' : 'auto',
                                  visibility: isDragging ? 'hidden' : 'visible',
                                  '&:hover': {
                                    color: '#FF4444',
                                    transform: 'scale(1.1)'
                                  }
                                }}
                              >
                                <div className="click-area" />
                                <div className="hover-effect" />
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
                          transform: 'translateX(-50%)',
                          zIndex: 99999
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
                          zIndex: 999999
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

export default PomsSimpleTimeline;