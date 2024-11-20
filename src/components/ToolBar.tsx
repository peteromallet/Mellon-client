import React from 'react'

import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
//import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
//import ToggleButton from '@mui/material/ToggleButton'
//import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
//import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'

import { shallow } from 'zustand/shallow';
import { NodeRegistryState, useNodeRegistryState } from '../stores/nodeRegistryStore';

import OutlinedInput from '@mui/material/OutlinedInput'
import SearchIcon from '@mui/icons-material/Search'

const sidebarWidth = 260

const selectNodeRegistryState = (state: NodeRegistryState) => ({
  nodeRegistry: state.nodeRegistry,
});

export default function LeftSidebar() {
  const theme = useTheme()
  const { nodeRegistry } = useNodeRegistryState(selectNodeRegistryState, shallow);

  // Local node search state, the code will hide the nodes that don't match the search term instead of removing them from the DOM
  const [searchTerm, setSearchTerm] = React.useState('')
  const filteredNodes = React.useMemo(() => {
    const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    if (searchTerms.length === 0) return null;

    return Object.keys(nodeRegistry).filter((key) => {
      const label = nodeRegistry[key].label.toLowerCase();
      return searchTerms.every(term => label.includes(term));
    })
  }, [nodeRegistry, searchTerm])

  // Drag and drop functionality
  const onDragStart = (event: React.DragEvent<HTMLLIElement>, key: string) => {
    event.dataTransfer.setData('text/plain', key);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <Box
      className="left-sidebar"
      textAlign="center"
      sx={{
        width: sidebarWidth,
        overflowY: 'auto',
        backgroundColor: theme.palette.background.paper,
        borderRight: `1px solid ${theme.palette.divider}`,
        pt: 1.5, pl: 1.5, pr: 1.5, pb: 0,
      }}
    >
      {/* <Stack direction="row" justifyContent="center">
        <ToggleButtonGroup
          exclusive
          aria-label="node order"
          size="small"
        >
          <ToggleButton value="category">
            <FolderIcon />
          </ToggleButton>
          <ToggleButton value="module">
            <CategoryIcon />
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack> */}
      <OutlinedInput
        startAdornment={<SearchIcon fontSize="small" sx={{ marginRight: 1 }} />}
        id="main-module-search"
        placeholder="Search"
        size="small"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ width: '100%' }}
      />
      <Box>
      <List dense={true} sx={{ p:0, mt:1.5 }}>
        {Object.keys(nodeRegistry).map((key) => (
          <ListItem
            key={key}
            draggable
            className={`${key} category-${nodeRegistry[key].category} module-${nodeRegistry[key].module}`}
            onDragStart={(event) => onDragStart(event, key)}
            sx={{
              outline: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              mb: 1,
              boxShadow: 3,
              //m: 0,
              //p: 0,
              borderLeftWidth: '8px',
              borderLeftStyle: 'solid',
              cursor: 'grab',
              ":hover": {
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
              },
              display: !filteredNodes || filteredNodes.includes(key) ? 'flex' : 'none',
            }}
          >
            <ListItemText primary={nodeRegistry[key].label} />
          </ListItem>
        ))}
      </List>
      </Box>
    </Box>
  )
}
