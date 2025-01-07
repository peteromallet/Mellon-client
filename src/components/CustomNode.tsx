import React, { lazy, useState, MouseEvent, useEffect, Suspense } from 'react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { styled, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import CustomNumberInput from './CustomNumberInput';
import config from '../../config';
import { useNodeState, NodeState, CustomNodeType } from '../stores/nodeStore';
import { useWebsocketState } from '../stores/websocketStore';
import { shallow } from 'zustand/shallow';
import Stack from '@mui/material/Stack';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';

//import TextareaAutosize from '@mui/material/TextareaAutosize';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import IconButton from '@mui/material/IconButton';

// Icons
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Autocomplete from '@mui/material/Autocomplete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LinearProgress from '@mui/material/LinearProgress';

// lazy loading
const ThreePreview = lazy(() => import('./ThreePreview'));

const PlainAccordion = styled(Accordion)(({ theme }) => ({
    boxShadow: 'none',
    border: 0,
    padding: 0,
    margin: 0,
    background: 'transparent',
    borderTop: `1px solid ${theme.palette.divider}`,
    '&:before': { background: 'transparent' },
    '.MuiAccordionSummary-root': { padding: '0 4px', margin: 0, background: 'transparent', color: theme.palette.text.secondary, minHeight: '0' },
    '.MuiAccordionDetails-root': { padding: 0, margin: 0 },
    '.MuiAccordionSummary-root:hover, .MuiAccordionSummary-root:hover .MuiAccordionSummary-expandIconWrapper': { color: theme.palette.primary.main },
}));


// const CustomTextarea = styled(TextareaAutosize)(() => ({
//     fontSize: '13px',
//     padding: '4px',
// }));
const DynamicComponent = ({ component, props, nodeId }: { component: string, props: any, nodeId: string }) => {
    const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
    const nodeData = useNodeState(
        (state) => state.nodes.find(n => n.id === nodeId)?.data,
        shallow
    );

    useEffect(() => {
        const loadComponent = async () => {
            try {
                const module = await import(`../custom_components/${component}.jsx`);
                setComponent(() => module[component] || module.default);
            } catch (error) {
                console.error('Error loading component:', error);
            }
        };

        loadComponent();
    }, [component]);

    if (!Component) {
        return <div>Loading component: {component}...</div>;
    }

    return <Component {...props} nodeId={nodeId} nodeData={nodeData} />;
};

const renderNodeContent = (nodeId: string, key: string, props: any, onValueChange: (nodeId: string, changeKey: string, changeValue: any) => void, theme: any) => {
    let field;
    let fieldType = props.display || '';

    const style = props.style || {};

    if (fieldType === 'group') {
        const hidden = props.hidden && props.hidden === true ? { display: 'none' } : {};
        const alignItems = props.direction === 'column' ? 'stretch' : 'center';
        const spacing = props.direction === 'column' ? 0 : 1;

        if (props.label) {
            field = (
                <Box
                    key={key}
                    data-key={key}
                    sx={{
                        '& .MuiFormControlLabel-label': { fontSize: '14px' },
                        borderBottom: `2px solid ${theme.palette.divider}`,
                        p: 0, pt: 0.5,
                        ...hidden,
                    }}
                >
                    <Typography sx={{ p: 0.5, fontSize: '13px', color: theme.palette.text.secondary, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{props.label}</Typography>
                    <Stack
                        direction={props.direction}
                        spacing={spacing}
                        sx={{
                            '& > .MuiBox-root': { flex: "1" },
                            '& > .flex-auto': { flex: "0 0 auto" },
                            '& .MuiFormControlLabel-label': { fontSize: '14px' },
                            justifyContent: "space-between",
                            alignItems: alignItems,
                            mt: 0.5,
                            mb: 1,
                        }}
                    >
                        {Object.entries(props.params).map(([gkey, gdata]) => renderNodeContent(nodeId, gkey, gdata, onValueChange, theme))}
                    </Stack>
                </Box>
            );
        } else {
            field = (
                <Stack
                    key={key}
                    data-key={key}
                    direction={props.direction}
                    spacing={spacing}
                    sx={{
                        '& > .MuiBox-root': { flex: "1" },
                        '& > .flex-auto': { flex: "0 0 auto" },
                        '& .MuiFormControlLabel-label': { fontSize: '14px' },
                        justifyContent: "space-between",
                        alignItems: alignItems,
                        mt: 0, mb: 0,
                        ...hidden,
                    }}
                >
                    {Object.entries(props.params).map(([gkey, gdata]) => renderNodeContent(nodeId, gkey, gdata, onValueChange, theme))}
                </Stack>
            );
        }
        return field;
    }

    if (fieldType === 'collapse') {
        field = (
            <PlainAccordion key={key} disableGutters={true} square={true} className="nodrag">
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ border: 'none' }}>
                    {props.label || key}
                </AccordionSummary>
                <AccordionDetails sx={{ border: 'none' }}>
                    {Object.entries(props.params).map(([gkey, gdata]) => renderNodeContent(nodeId, gkey, gdata, onValueChange, theme))}
                </AccordionDetails>
            </PlainAccordion>
        )
        return field;
    }

    // Data type can be an array, the array is mostly used for input handles to allow multiple types
    // For node processing we only use the first type, that is the main type
    // TODO: should we use an "allowedTypes" property instead?
    const dataType = Array.isArray(props.type) && props.type.length > 0 ? props.type[0] : props.type;

    if (!fieldType && fieldType !== 'input' && fieldType !== 'output') {
        if (props.options && typeof props.options === 'object') {
            fieldType = 'select';
        } else if (dataType === 'boolean') {
            fieldType = props.display === 'checkbox' || props.display === 'iconToggle' ? props.display : 'switch';
        } else if (dataType === 'int' || dataType === 'integer' || dataType === 'float' || dataType === 'number') {
            fieldType = props.display === 'slider' ? 'slider' : 'number';
        } else if (fieldType === 'ui') {
            if (dataType === 'image') {
                fieldType = 'ui_image';
            } else if (dataType.toLowerCase() === 'dropdownicon') {
                fieldType = 'ui_dropdownicon';
            } else if (dataType.toLowerCase() === '3d') {
                fieldType = 'ui_3d';
            }
        } else {
            fieldType = 'text';
        }
    }

    switch (fieldType) {
        case 'hidden':
            return null;
        case 'input':
            field = (
                <Box key={key} sx={{ pt: "4px", pb: "4px", position: 'relative', ...style }}>
                    <Handle
                        id={key}
                        type="target"
                        position={Position.Left}
                        className={`${dataType}-handle`}
                    />
                    <Box sx={{ paddingLeft: 1 }}>{props.label || key}</Box>
                </Box>
            );
            break;
        case 'output':
            field = (
                <Box key={key} sx={{ pt: "4px", pb: "4px", position: 'relative', ...style }}>
                    <Handle
                        id={key}
                        type="source"
                        position={Position.Right}
                        className={`${dataType}-handle`}
                    />
                    <Box sx={{ textAlign: 'right', paddingRight: 1 }}>{props.label || key}</Box>
                </Box>
            );
            break;
        case 'textarea':
            field = (
                <Box key={key} sx={{ pt: 1, pb: 1, minWidth: '320px', ...style }}>
                    <TextField
                        onChange={(e) => onValueChange(nodeId, key, e.target.value)}
                        variant="outlined"
                        type="text"
                        size="small"
                        fullWidth
                        multiline
                        rows={3}
                        label={props.label || key}
                        value={props.value || props.default || ''}
                        sx={{ '& textarea': { fontSize: '13px' } }}
                        className="nodrag nowheel"
                    />
                </Box>
            );
            break;
        case 'select':
            const selectValue = props.value || props.default || '';

            const updateGroupVisibility = (value: string) => {
                if (!props.onChange || props.onChange !== 'showGroup') return;

                const items = Array.isArray(props.options)
                    ? props.options.map((option: any) => ({ key: option.value }))
                    : Object.keys(props.options).map(k => ({ key: k }));

                items.forEach(({ key }: { key: string }) => {
                    const group = document.querySelector(`[data-id="${nodeId}"] [data-key="${key}_group"]`);
                    if (group) {
                        (group as HTMLElement).style.display = value === key ? 'block' : 'none';
                    }
                });
            };

            // Handle initial visibility
            useEffect(() => {
                updateGroupVisibility(selectValue);
            }, [nodeId, props.onChange, props.options, selectValue]);

            const onChange = (e: any) => {
                updateGroupVisibility(e.target.value);
                onValueChange(nodeId, key, e.target.value);
            };

            field = (
                <Box key={key} sx={{ pt: 1, pb: 1, ...style }}>
                    <TextField
                        onChange={onChange}
                        variant="outlined"
                        fullWidth
                        size="small"
                        select
                        label={props.label || key}
                        value={selectValue}
                        slotProps={{
                            select: {
                                native: true,
                                sx: { fontSize: '14px' },
                            },
                        }}
                        helperText={props.help || ''}
                    >
                        {Array.isArray(props.options) ? (
                            props.options.map((v: any, i: number) => (
                                <option key={i} value={v}>
                                    {v}
                                </option>
                            ))
                        ) : (
                            Object.entries(props.options).map(([k, v]: any) => (
                                <option key={k} value={k}>
                                    {typeof v === 'object' ? v.label : v}
                                </option>
                            ))
                        )}
                    </TextField>
                </Box>
            );
            break;
        case 'autocomplete':
            field = (
                <Box key={key} sx={{ pt: 1, pb: 1, minWidth: '320px', ...style }} className="nodrag nowheel">
                    <Autocomplete
                        disablePortal
                        freeSolo={props.no_validation ? true : false}
                        options={props.options || []}
                        renderInput={(params: any) => <TextField {...params} label={props.label || key} />}
                        onChange={(_, value) => onValueChange(nodeId, key, value)}
                        value={props.value || props.default || ''}
                        size="small"
                        sx={{ '& + .MuiAutocomplete-popper .MuiAutocomplete-option': { fontSize: '12px' } }}
                    />
                </Box>
            );
            break;
        case 'tags':
            field = (
                <Box key={key} sx={{ pt: 1, pb: 1, minWidth: '320px', maxWidth: '460px', ...style }} className="nodrag nowheel">
                    <Autocomplete
                        multiple
                        disablePortal
                        filterSelectedOptions
                        handleHomeEndKeys
                        freeSolo={props.no_validation ? true : false}
                        options={props.options || []}
                        renderInput={(params: any) => <TextField {...params} label={props.label || key} />}
                        onChange={(_, value) => onValueChange(nodeId, key, value)}
                        value={props.value || props.default || []}
                        size="small"
                        sx={{ '& + .MuiAutocomplete-popper .MuiAutocomplete-option': { fontSize: '12px', p: 0.5, pl: 1, pr: 1 },
                            '& .MuiChip-root': {
                                borderRadius: '4px',
                            },
                        }}
                    />
                </Box>
            );
            break;
        case 'checkbox':
            field = (
                <Box key={key} sx={{ m: 0, ml: -1, p:0, pb: 0, '& .MuiFormControlLabel-label': { fontSize: '14px' }, ...style }}>
                    <FormGroup>
                        <FormControlLabel
                            sx={{ m: 0, p: 0 }}
                            control={<Checkbox
                                color="secondary"
                                defaultChecked={props.default || false}
                                onChange={(e) => onValueChange(nodeId, key, e.target.checked)}
                                className="nodrag"
                            />}
                            label={props.label || key}
                        />
                    </FormGroup>
                </Box>
            );
            break;
        case 'switch':
            field = (
                <Box key={key} sx={{ m: 0, pb: 1, pt: 0.5, '& .MuiFormControlLabel-label': { fontSize: '14px' }, ...style }}>
                    <FormGroup>
                        <FormControlLabel
                            sx={{ m: 0, p: 0 }}
                            control={<Switch
                                sx={{ mr: 0.5 }}
                                size="small"
                                color="secondary"
                                className="nodrag"
                                defaultChecked={props.default || false}
                                onChange={(e) => onValueChange(nodeId, key, e.target.checked)}
                            />}
                            label={props.label || key}
                        />
                    </FormGroup>
                </Box>
            );
            break;
        case 'ui_image':
            field = (
                <Box key={key} sx={{ ...style }}>
                    <img src={props.value || props.default || ''} alt={props.label || key} data-key={key} />
                </Box>
            );
            break;
        case 'ui_3d':
            field = (
                <Box key={key} sx={{ p: 0, m: 0, mt: 1, mb: 1, ...style }} className="nodrag nowheel">
                    <Suspense fallback={<div>Loading 3D viewer...</div>}>
                        <ThreePreview
                            nodeId={nodeId}
                            dataKey={key}
                            value={props.value || props.default || ''}
                            width={512}
                            height={512}
                        />
                    </Suspense>
                </Box>
            );
            break;
        case 'ui_dropdownicon':
            const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
            const open = Boolean(anchorEl);
            const targetField = Array.isArray(props.target) ? props.target : [props.target];
            const targetElements = targetField.map((field: string) => anchorEl?.parentNode?.parentNode?.querySelector(`[data-id="${field}"]`));

            const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
              setAnchorEl(event.currentTarget);
            };
            const handleMenuItemClick = (i: number) => {
                setAnchorEl(null);
                if (i<0) return;

                const targetValue = Array.isArray(props.options[i].value) ? props.options[i].value : [props.options[i].value];

                targetElements.forEach((el: HTMLElement, index: number) => {
                    if (el && el.dataset && el.dataset.key) {
                        onValueChange(nodeId, el.dataset.key, targetValue[index]);
                    }
                });
            };

            field = (
                <Box key={key} className="flex-auto nodrag" sx={{ ...style }}>
                    <IconButton
                        aria-label="more"
                        aria-haspopup="true"
                        onClick={handleClick}
                        title={props.label || key}
                    >
                        <MoreVertIcon />
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={open}
                        onClose={() => handleMenuItemClick(-1)}
                        slotProps={{
                            paper: {
                                sx: {
                                    boxShadow: "0px 4px 8px 2px rgba(0, 0, 0, 0.5)",
                                    backgroundColor: theme.palette.secondary.dark,
                                },
                            },
                        }}
                    >
                        {props.options.map((option: any, i: number) => (
                            <MenuItem key={i} onClick={() => handleMenuItemClick(i)}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Menu>
                </Box>
            );
            break;
        case 'slider':
        case 'number':
            const disabled = props.disabled ? true : false;

            field = (
                <CustomNumberInput
                    key={key}
                    dataKey={key}
                    value={props.value || props.default || 0}
                    label={props.label || key}
                    dataType={dataType}
                    min={props.min}
                    max={props.max}
                    step={props.step}
                    slider={fieldType === 'slider'}
                    disabled={disabled}
                    onChange={(newValue) => onValueChange(nodeId, key, newValue)}
                    style={style}
                />
            );
            break;
        case 'custom':
            const nodeActions = {
                setValue: (cvalue: any) => onValueChange(nodeId, key, cvalue),
                // TODO: we might need more actions in the future
            };

            field = (
                <Box key={key} sx={{ pt: 1, pb: 1, ...style }}>
                    <DynamicComponent
                        component={props.component}
                        props={{
                            ...props,
                            nodeActions,
                        }}
                        nodeId={nodeId}
                    />
                </Box>
            );
            break;
        case 'iconToggle':
            const [selected, setSelected] = useState(props.value);
            let icons = {};
            if (props.icon === 'random') {
                icons = {
                    icon: <AutoFixHighIcon />,
                    checkedIcon: <AutoFixHighIcon />,
                };
            }

            const disableFields = (value: boolean) => {
                const target = Array.isArray(props.onChange.target) ? props.onChange.target : [props.onChange.target];
                target.forEach((field: string) => {
                    const targetElement = document.querySelector(`[data-id="${nodeId}"] [data-key="${field}"]`);
                    if (targetElement) {
                        (targetElement as HTMLInputElement).classList.toggle('mellon-disabled', value);
                    }
                });
            }

            const handleChange = (value: boolean) => {
                setSelected(value);
                onValueChange(nodeId, key, value);
                disableFields(value);
            }

            useEffect(() => {
                setSelected(props.value);
                disableFields(props.value);
            }, [props.value]);

            field = (
                <Box key={key} sx={{ ...style }} className="flex-auto nodrag">
                    <Checkbox
                        size="small"
                        sx={{
                            p: "8px 8px 8px 8px",
                            m: 0,
                            border: 1,
                            borderRadius: 1,
                            borderColor: theme.palette.divider,
                            '&.Mui-checked': {
                                backgroundColor: theme.palette.secondary.main,
                                color: theme.palette.background.paper,
                            }
                        }}
                        {...icons}
                        checked={selected}
                        title={props.label || key}
                        onChange={() => handleChange(!selected)}
                    />
                </Box>
            );
            break;
        case 'ui_component':
            field = (
                <Box key={key} sx={{ p: 0, m: 0, ...style }} className="nodrag">
                    <DynamicComponent 
                        component={props.component} 
                        props={{
                            onValueChange: (value: any) => onValueChange(nodeId, key, value)
                        }} 
                        nodeId={nodeId}
                    />
                </Box>
            );
            break;
        case 'component':
            field = (
                <Box key={key}>
                    <DynamicComponent 
                        component={props.value} 
                        props={props.props || {}} 
                        nodeId={nodeId}
                    />
                </Box>
            );
            break;
        default:
            field = (
                <Box key={key} sx={{ pt: 1, pb: 0, mb: 0, '& input': { fontSize: '14px', ...style } }}>
                    <TextField
                        data-id={key}
                        data-key={key}
                        onChange={(e) => onValueChange(nodeId, key, e.target.value)}
                        variant="outlined"
                        type={fieldType}
                        size="small"
                        fullWidth
                        label={props.label || key}
                        value={props.value || props.default || ''}
                        className="nodrag"
                        autoComplete="off"
                        sx={ (dataType === 'int' || dataType === 'integer' || dataType === 'float' || dataType === 'number') ? { '& input': { textAlign: 'right' } } : {} }
                    />
                </Box>
            );
    }

    return field;
}

const CustomNode = (props: NodeProps<CustomNodeType>) => {
    const theme = useTheme();
    const { setParamValue, setNodeExecuted, deleteNodeData, loadNodeData } = useNodeState((state: NodeState) => ({
        setParamValue: state.setParamValue,
        setNodeExecuted: state.setNodeExecuted,
        deleteNodeData: state.deleteNodeData,
        loadNodeData: state.loadNodeData
    }), shallow);

    // Subscribe to the full node data to ensure re-render when params change
    const nodeData = useNodeState(
        (state) => state.nodes.find(n => n.id === props.id)?.data,
        shallow
    );

    // Add a separate selector for cache status to ensure re-render
    const cache = useNodeState(
        (state) => state.nodes.find(n => n.id === props.id)?.data?.cache,
        shallow
    );

    const nodeProgress = useWebsocketState(
        (state) => state.nodeProgress[props.id] || { value: 0, type: 'determinate' },
        shallow
    );

    const onClearCache = async () => {
        try {
            await deleteNodeData(props.id);
            // Set node as not executed
            setNodeExecuted(props.id, false, 0, 0);
        } catch (error) {
            console.error('Error clearing node data:', error);
        }
    };

    // Group fields by data.params.group using the live nodeData instead of props
    const groupedParams = Object.entries(nodeData?.params || {}).reduce((acc: any, [key, data]) => {
        let group = undefined;

        if (data.group) {
            if (typeof data.group === 'string') {
                group = {
                    key: data.group + '_group',
                    //display: 'group'
                }
            } else {
                group = {
                    key: (data.group.key || 'untitled') + '_group',
                    display: data.group.display || 'group',
                    label: data.group.label || null,
                    hidden: data.group.hidden || false,
                    direction: data.group.direction || 'row',
                }
            }
        }

        if (!group) {
            acc[key] = data;
        } else {
            if (!acc[group.key]) {
                acc[group.key] = {
                    display: group.display || 'group',
                    label: group.label || null,
                    hidden: group.hidden || false,
                    direction: group.direction || 'row',
                    params: {},
                };
            }
            acc[group.key].params[key] = data;
        }

        return acc;
    }, {});

    const fields = Object.entries(groupedParams).map(([key, data]) => renderNodeContent(props.id, key, data, setParamValue, theme));
    const style = props.data.style || {};

    return (
        <Box
            id={props.id}
            className={`${props.data.module}-${props.data.action} category-${props.data.category} module-${props.data.module}`}
            sx={{
                fontSize: '14px',
                boxShadow: 4,
                outlineOffset: '5px',
                borderRadius: '0',
                ...style,
            }}
        >
            <Box
                component="header"
                sx={{
                    color: theme.palette.common.white,
                    padding: '8px 10px 8px 10px',
                    borderTopWidth: '6px',
                    borderTopStyle: 'solid',
                    borderTopColor: 'rgba(0, 0, 0, 0.2)',
                    backgroundColor: '#121212',
                    fontSize: '15px',
                    textShadow: '0px 2px 0px rgba(0, 0, 0, 0.75)',
                }}
            >
                {props.data.label}
            </Box>
            <Box
                //component="form"
                //noValidate
                //autoComplete="off"
                className="nodrag"
                sx={{
                    //borderTop: '4px solid rgba(0, 0, 0, 0.2)',
                    backgroundColor: theme.palette.background.paper,
                    paddingLeft: 1,
                    paddingRight: 1,
                    paddingTop: '4px',
                    '& > .MuiStack-root': {
                        mb: 1,
                    },
                    '& .MuiAccordionDetails-root > .MuiStack-root': {
                        mb: 1,
                    },
                }}
            >
                {fields}
            </Box>
            <Box
                component="footer"
                className="nodrag"
                sx={{
                    padding: 0,
                    backgroundColor: '#121212',
                }}
            >
                <Box sx={{ width: '100%' }}>
                    <LinearProgress
                        variant={nodeProgress.type === 'indeterminate' ? 'indeterminate' : 'determinate'}
                        color="inherit"
                        value={nodeProgress.value}
                        className={nodeProgress.type === 'disabled' ? 'progress-disabled' : ''}
                        sx={{
                            height: '4px',
                            '&.progress-disabled': {
                                '& .MuiLinearProgress-bar': {
                                    display: 'none',
                                },
                            },
                            '& .MuiLinearProgress-bar1Indeterminate': {
                                background: `repeating-linear-gradient(45deg, ${theme.palette.primary.main} 0, ${theme.palette.primary.main} 20px, ${theme.palette.primary.dark} 20px, ${theme.palette.primary.dark} 40px)`,
                                backgroundSize: '60px 100%',
                                backgroundPosition: '0 0',
                                left: '0', right: '0',
                                animation: 'mellon-progress-ind 1s linear infinite',
                            },
                            '& .MuiLinearProgress-bar1Determinate': {
                                transitionDuration: '80ms',
                                background: `linear-gradient(100deg, ${theme.palette.primary.main} 50%, #ff4259 90%)`,
                            },
                            '& .MuiLinearProgress-bar2Indeterminate': {
                                display: 'none',
                                animation: 'none',
                            },
                         }}
                    />
                </Box>

                <Box sx={{ p: 1 }}>
                    <Stack
                        direction="row"
                        spacing={2}
                        sx={{
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <Chip
                            icon={<DeleteForeverIcon />}
                            label="Data"
                            title="Clear Data"
                            onClick={onClearCache}
                            disabled={!cache}
                            color="secondary"
                            variant="filled"
                            sx={{
                                height: '24px',
                                borderRadius: 0.5,
                                fontSize: '12px',
                                span: { padding: '0px 8px 0px 10px' },
                                '& .MuiChip-icon': {
                                    fontSize: '18px',
                                },
                            }}
                        />
                    </Stack>
                </Box>
            </Box>
        </Box>
    );
}

export default CustomNode;