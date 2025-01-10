import React, { useEffect, useRef } from 'react';
import { Box, ImageList, ImageListItem, IconButton, Select, MenuItem, FormControl, InputLabel, Button, Pagination, Skeleton, Fade, Modal, ToggleButtonGroup, ToggleButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SortIcon from '@mui/icons-material/Sort';
import CloseIcon from '@mui/icons-material/Close';
import { useNodeState } from '../stores/nodeStore';
import dataService from '../services/dataService';
import config from '../../config';

const ITEMS_PER_PAGE_OPTIONS = [16, 32, 64, 128];
const IMAGE_SIZES = {
  small: 100,
  medium: 150,
  large: 200
};

const ImageGallery = ({ nodeId, nodeData }) => {
  const imageRefs = useRef({});
  const originalOrder = useRef([]);
  const setParamValue = useNodeState((state) => state.setParamValue);
  const [isDeletingImage, setIsDeletingImage] = React.useState(null);
  const [imageUrls, setImageUrls] = React.useState({});
  const [displayedImages, setDisplayedImages] = React.useState([]);
  const [sortOrder, setSortOrder] = React.useState('newest'); // 'newest' or 'oldest'
  const [itemsPerPage, setItemsPerPage] = React.useState(16);
  const [page, setPage] = React.useState(1);
  const [loadedImages, setLoadedImages] = React.useState({});
  const [selectedImage, setSelectedImage] = React.useState(null);
  const [imageSize, setImageSize] = React.useState('small');

  // Add a debug effect to track state changes
  useEffect(() => {
    console.log('State Debug:', {
      displayedImages: displayedImages.slice(0, 3),
      originalOrder: originalOrder.current.slice(0, 3),
      currentSortOrder: sortOrder,
      timestamp: new Date().toISOString()
    });
  }, [displayedImages, sortOrder]);

  // Effect to handle image loading and original order
  useEffect(() => {
    // Get all possible images
    const savedImages = nodeData?.params?.input?.value || [];
    const newImages = nodeData?.event === 'generation' && Array.isArray(nodeData?.params?.output?.value)
      ? nodeData?.params?.output?.value
      : [];

    console.log('Processing Images:', {
      savedImages: savedImages.slice(0, 3),
      newImages: newImages.slice(0, 3),
      currentOriginalOrder: originalOrder.current.slice(0, 3),
      currentSortOrder: sortOrder,
      timestamp: new Date().toISOString()
    });

    // When receiving new generated images, merge them with existing ones
    const mergedImages = [...new Set([
      ...originalOrder.current,  // Keep existing images
      ...(savedImages || []),    // Add any saved images
      ...(newImages || [])       // Add new generated images
    ])];
    
    // Compare arrays element by element
    const hasOrderChanged = mergedImages.length !== originalOrder.current.length ||
      mergedImages.some((img, idx) => img !== originalOrder.current[idx]);

    if (hasOrderChanged) {
      console.log('Updating original order - detected changes:', {
        oldOrder: originalOrder.current.slice(0, 3),
        newOrder: mergedImages.slice(0, 3),
        totalOldImages: originalOrder.current.length,
        totalNewImages: mergedImages.length
      });
      
      originalOrder.current = mergedImages;

      // Load any new images
      mergedImages.forEach(image => {
        const baseFileName = image.includes('/') ? image.split('/').pop() : image;
        if (!imageUrls[baseFileName]) {
          loadImage(image);
        }
      });

      // Update displayed images based on current sort order
      const newSortedImages = sortOrder === 'newest' 
        ? [...mergedImages].reverse()
        : [...mergedImages];

      // Save the merged state
      const data = {
        params: {
          component: 'ImageGallery',
          input: mergedImages
        },
        files: mergedImages,
        cache: true
      };
      dataService.saveNodeData(nodeId, data);
      setParamValue(nodeId, 'input', mergedImages);

      setDisplayedImages(newSortedImages);
    }
  }, [nodeData?.params?.input?.value, nodeData?.event]); // Only depend on specific nodeData properties

  // Separate effect to handle sorting
  useEffect(() => {
    if (originalOrder.current.length > 0) {
      console.log('Sort effect triggered:', {
        currentSortOrder: sortOrder,
        originalOrderSnapshot: originalOrder.current.slice(0, 3),
        timestamp: new Date().toISOString()
      });

      const sortedImages = sortOrder === 'newest'
        ? [...originalOrder.current].reverse()
        : [...originalOrder.current];

      setDisplayedImages(sortedImages);
    }
  }, [sortOrder]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const totalPages = Math.ceil(displayedImages.length / itemsPerPage);
  const currentPageImages = displayedImages.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const loadImage = async (imageName) => {
    try {
      // Always work with base filenames
      const baseFileName = imageName.includes('/') ? imageName.split('/').pop() : imageName;
      const imageUrl = `http://${config.serverAddress}/data/files/${baseFileName}`;
      setImageUrls(prev => ({ ...prev, [baseFileName]: imageUrl }));
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  const handleDelete = async (index) => {
    if (isDeletingImage === index) return;
    setIsDeletingImage(index);

    try {
      const filename = displayedImages[index];
      const baseFilename = filename.includes('/') ? filename.split('/').pop() : filename;
      
      if (baseFilename) {
        // Remove URL from state
        setImageUrls(prev => {
          const newUrls = { ...prev };
          delete newUrls[filename];
          return newUrls;
        });

        // Remove from node storage
        try {
          await dataService.deleteNodeFile(nodeId, baseFilename);
        } catch (error) {
          console.error('Error deleting file:', error);
        }

        // Update both displayed and original orders
        const newDisplayedImages = displayedImages.filter((_, i) => i !== index);
        originalOrder.current = sortOrder === 'newest' 
          ? [...newDisplayedImages].reverse() 
          : [...newDisplayedImages];
        setDisplayedImages(newDisplayedImages);

        // Save the updated state using the original order
        const data = {
          params: {
            component: 'ImageGallery',
            input: originalOrder.current
          },
          files: originalOrder.current,
          cache: true
        };
        await dataService.saveNodeData(nodeId, data);
        setParamValue(nodeId, 'input', originalOrder.current);
      }
    } finally {
      setIsDeletingImage(null);
    }
  };

  const handleDragStart = (e, index) => {
    console.log('ImageGallery: Drag started', { index, page });
    
    // Calculate the actual index in displayedImages based on current page
    const actualIndex = (page - 1) * itemsPerPage + index;
    const filename = displayedImages[actualIndex];
    const baseFilename = filename.includes('/') ? filename.split('/').pop() : filename;
    const url = imageUrls[baseFilename];
    
    if (url) {
      const dt = e.dataTransfer;
      dt.effectAllowed = 'copy';
      dt.setData('text/plain', url);
      
      const img = e.target;
      dt.setDragImage(img, img.width / 2, img.height / 2);
    }
  };

  const handleSortChange = (event, newSortOrder) => {
    if (newSortOrder !== null && newSortOrder !== sortOrder) {
      console.log('Sort change requested:', {
        oldOrder: sortOrder,
        newOrder: newSortOrder,
        originalOrderSnapshot: originalOrder.current.slice(0, 3),
        timestamp: new Date().toISOString()
      });

      setSortOrder(newSortOrder);
    }
  };

  const handleImageLoad = (baseFilename) => {
    setLoadedImages(prev => ({ ...prev, [baseFilename]: true }));
  };

  const handleImageDoubleClick = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  const handleSizeChange = (event, newSize) => {
    if (newSize !== null) {
      setImageSize(newSize);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Modal
        open={selectedImage !== null}
        onClose={handleCloseModal}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2
        }}
      >
        <Box sx={{ 
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          outline: 'none'
        }}>
          <IconButton
            onClick={handleCloseModal}
            sx={{
              position: 'absolute',
              top: -40,
              right: 0,
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.7)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
          <img
            src={selectedImage}
            alt="Selected image"
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
          />
        </Box>
      </Modal>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="items-per-page-label">Items per page</InputLabel>
            <Select
              labelId="items-per-page-label"
              value={itemsPerPage}
              label="Items per page"
              onChange={(e) => {
                setItemsPerPage(e.target.value);
                setPage(1); // Reset to first page when changing items per page
              }}
              sx={{ color: 'text.primary' }}
            >
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Pagination 
            count={totalPages} 
            page={page} 
            onChange={handlePageChange} 
            size="small"
            sx={{
              '& .MuiPaginationItem-root': {
                color: 'text.primary',
              }
            }}
          />
        </Box>
        <Button
          onClick={() => handleSortChange(null, sortOrder === 'newest' ? 'oldest' : 'newest')}
          size="small"
          startIcon={<SortIcon sx={{ transform: sortOrder === 'newest' ? 'scaleY(-1)' : 'none' }} />}
          sx={{
            color: 'text.primary',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)'
            }
          }}
        >
          {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
        </Button>
      </Box>
      <Box sx={{ position: 'relative', mb: 2 }}>
        <ImageList 
          cols={4} 
          gap={8} 
          sx={{ 
            overflow: 'visible',
            mb: 1,
            '& .MuiImageListItem-root': {
              width: IMAGE_SIZES[imageSize],
              height: IMAGE_SIZES[imageSize],
              padding: 0,
              mb: 0.5,
              '& > div': {
                margin: 0
              }
            }
          }}
        >
          {currentPageImages.map((filename, index) => {
            const baseFilename = filename.includes('/') ? filename.split('/').pop() : filename;
            return (
              <ImageListItem key={index} sx={{ 
                position: 'relative',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'scale(1.05)',
                  zIndex: 1,
                  '& img': {
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                  },
                  '& .MuiIconButton-root': {
                    opacity: 1,
                    transform: 'scale(1)'
                  }
                }
              }}>
                {imageUrls[baseFilename] && (
                  <Box sx={{ 
                    position: 'relative', 
                    width: IMAGE_SIZES[imageSize], 
                    height: IMAGE_SIZES[imageSize] 
                  }}>
                    {!loadedImages[baseFilename] && (
                      <Skeleton 
                        variant="rounded" 
                        width={IMAGE_SIZES[imageSize]} 
                        height={IMAGE_SIZES[imageSize]} 
                        animation="wave"
                        sx={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px'
                        }}
                      />
                    )}
                    <Fade in={loadedImages[baseFilename]} timeout={500}>
                      <img
                        src={imageUrls[baseFilename]}
                        alt={`Generated image ${index + 1}`}
                        loading="lazy"
                        draggable="true"
                        onLoad={() => handleImageLoad(baseFilename)}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDoubleClick={() => handleImageDoubleClick(imageUrls[baseFilename])}
                        style={{ 
                          width: IMAGE_SIZES[imageSize],
                          height: IMAGE_SIZES[imageSize],
                          objectFit: 'cover',
                          borderRadius: '4px',
                          cursor: 'grab',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          opacity: loadedImages[baseFilename] ? 1 : 0
                        }}
                      />
                    </Fade>
                  </Box>
                )}
                <IconButton
                  onClick={() => handleDelete(index)}
                  disabled={isDeletingImage === index}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.7)'
                    },
                    width: 24,
                    height: 24,
                    padding: '4px',
                    opacity: 0,
                    transform: 'scale(0.8)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    visibility: isDeletingImage === index ? 'hidden' : 'visible',
                    '& .MuiTouchRipple-root': {
                      display: 'none'
                    }
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </ImageListItem>
            );
          })}
        </ImageList>
        <Box sx={{ 
          position: 'absolute',
          bottom: -48,
          right: 0,
          zIndex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 1,
          padding: '4px',
          backdropFilter: 'blur(4px)'
        }}>
          <ToggleButtonGroup
            value={imageSize}
            exclusive
            onChange={handleSizeChange}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                color: 'text.primary',
                '&.Mui-selected': {
                  color: 'primary.main',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)'
                }
              }
            }}
          >
            <ToggleButton value="small">S</ToggleButton>
            <ToggleButton value="medium">M</ToggleButton>
            <ToggleButton value="large">L</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Box>
  );
};

export default ImageGallery; 