import Box from '@mui/material/Box';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { useTheme } from '@mui/material/styles'
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import CustomNumberInput from './CustomNumberInput';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import config from '../../config';
import { useNodeState, NodeState, CustomNodeType } from '../stores/nodeStore';
import { shallow } from 'zustand/shallow';
import Stack from '@mui/material/Stack';

const renderNodeContent = (nodeId: string, key: string, props: any, onValueChange: (nodeId: string, changeKey: string, changeValue: any) => void) => {
    let field;
    let fieldType = props.display || '';

    if (fieldType === 'group') {
        field = (
            <Stack direction="row" spacing={1} key={key}>
                {Object.entries(props.params).map(([gkey, gdata]) => renderNodeContent(nodeId, gkey, gdata, onValueChange))}
            </Stack>
        )
        return field;
    }

    // Data type can be an array, the array is mostly used for input handles to allow multiple types in
    // For processing the node we only use the first type, that is the main type
    // TODO: should we use an "allowedTypes" property instead?
    const dataType = Array.isArray(props.type) && props.type.length > 0 ? props.type[0] : props.type;

    const style = props.style || {};

    if ( fieldType !== 'input' && fieldType !== 'output') {
        if (!fieldType && props.options && typeof props.options === 'object') {
            fieldType = 'select';
        } else if (dataType === 'boolean') {
            fieldType = fieldType !== 'checkbox' ? 'switch' : fieldType;
        } else if (dataType === 'int' || dataType === 'integer' || dataType === 'float' || dataType === 'number') {
            fieldType = props.display === 'slider' ? 'slider' : 'number';
        } else if (!fieldType) {
            fieldType = 'text';
        }
    }

    switch (fieldType) {
        case 'input':
            field = (
                <Box key={key} sx={{ pt: 1, pb: 1, position: 'relative', ...style }}>
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
                <Box key={key} sx={{ pt: 1, pb: 1, position: 'relative', ...style }}>
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
                        className="nodrag"
                    />
                </Box>
            );
            break;
        case 'select':
            const selectValue = props.value || props.default || '';

            field = (
                <Box key={key} sx={{ pt: 1, pb: 1, ...style }}>
                    <TextField
                        onChange={(e) => onValueChange(nodeId, key, e.target.value)}
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
        case 'switch':
            field = (
                <Box key={key} sx={{ ml: '-8px', ...style }}>
                    <FormGroup>
                        <FormControlLabel
                            sx={{ m: 0}}
                            control={<Switch
                                color="secondary"
                                defaultChecked={props.default || false}
                                onChange={(e) => onValueChange(nodeId, key, e.target.checked)}
                            />}
                            label={props.label || key}
                        />
                    </FormGroup>
                </Box>
            );
            break;
        case 'ui':
            field = (
                <Box key={key} sx={{ ...style }}>
                    <img src={props.value || props.default || ''} alt={props.label || key} data-key={key} />
                </Box>
            );
            break;
        case 'slider':
        case 'number':
            field = (
                <CustomNumberInput
                    key={key}
                    value={props.value || props.default || 0}
                    label={props.label || key}
                    dataType={dataType}
                    min={props.min}
                    max={props.max}
                    step={props.step}
                    slider={fieldType === 'slider'}
                    onChange={(newValue) => onValueChange(nodeId, key, newValue)}
                    style={style}
                />
            );
            break;
        default:
            field = (
                <Box key={key} sx={{ pt: 1, pb: 1, ...style }}>
                    <TextField
                        onChange={(e) => onValueChange(nodeId, key, e.target.value)}
                        variant="outlined"
                        type={fieldType}
                        size="small"
                        fullWidth
                        label={props.label || key}
                        value={props.value || props.default || ''}
                        className="nodrag"
                    />
                </Box>
            );
    }

    return field;
}

const CustomNode = (props: NodeProps<CustomNodeType>) => {
    const theme = useTheme();
    const { setParamValue, setNodeExecuted } = useNodeState((state: NodeState) => ({ setParamValue: state.setParamValue, setNodeExecuted: state.setNodeExecuted }), shallow);

    //const onValueChange = (nodeId: string, key: string, value: any) => {
    //    setParamValue(nodeId, key, value);
    //}
    const onClearCache = async () => {
        const nodeId = props.id;

        try {
            const response = await fetch('http://' + config.serverAddress + '/clearNodeCache', {
                method: 'DELETE',
                body: JSON.stringify({ nodeId }),
            });

            if (response.ok) {
                setNodeExecuted(nodeId, false, 0, 0);
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    // Group fields by data.params.group.
    // From:
    // 'seed': { ... }, 'width': { ... group: 'dimensions' }, 'height': { ... group: 'dimensions' }
    // To:
    // 'seed': { ... }, 'dimensions_1234': { ... , 'params': { 'width': { ... }, 'height': { ... } } }
    // This complication is done to keep all fields on the same level and avoid nested objects
    const groupedParams = Object.entries(props.data.params).reduce((acc: any, [key, data]) => {
        const group = data.group ? data.group + '_group' : undefined;

        if (!group) {
            acc[key] = data;
        } else {
            if (!acc[group]) {
                acc[group] = { display: 'group', params: {} };
            }
            acc[group].params[key] = data;
        }

        return acc;
    }, {});

    const fields = Object.entries(groupedParams).map(([key, data]) => renderNodeContent(props.id, key, data, setParamValue));
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
                    //fontWeight: '700',
                    color: theme.palette.common.white,
                    padding: '8px 10px 8px 10px',
                    borderTopWidth: '6px',
                    borderTopStyle: 'solid',
                    borderTopColor: 'rgba(0, 0, 0, 0.2)',
                    backgroundColor: '#121212',
                    //borderTopLeftRadius: 4,
                    //borderTopRightRadius: 4,
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
                sx={{
                    //borderTop: '4px solid rgba(0, 0, 0, 0.2)',
                    backgroundColor: theme.palette.background.paper,
                    paddingLeft: 1,
                    paddingRight: 1,
                    paddingTop: '4px',
                }}
            >
                {fields}
            </Box>
            <Box
                component="footer"
                sx={{
                    padding: 1,
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.secondary,
                    borderTop: `2px solid ${theme.palette.divider}`,
                    //borderBottomLeftRadius: 4,
                    //borderBottomRightRadius: 4,
                    ".MuiChip-icon": { fontSize: '14px' },
                }}
            >
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
                        label="Cache"
                        title="Clear Cache"
                        onClick={onClearCache}
                        disabled={!props.data.cache}
                        color="secondary"
                        variant="filled"
                        sx={{
                            height: '24px',
                            borderRadius: 0.5,
                            fontSize: '12px',
                            span: { padding: '0px 8px 0px 10px' },
                        }}
                    />
                    {/* <Chip
                        icon={<MemoryIcon />}
                        label={props.data.memory ? `${props.data.memory}` : '0Mb'}
                        title="Memory Usage"
                        sx={{
                            color: theme.palette.text.secondary,
                            height: '24px',
                            borderRadius: 0.5,
                            fontSize: '12px',
                            span: { padding: '0px 8px 0px 10px' },
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                    /> */}
                    <Chip
                        icon={<AccessAlarmIcon />}
                        label={props.data.time ? `${props.data.time}s` : '-'}
                        title="Execution Time"
                        sx={{
                            color: theme.palette.text.secondary,
                            height: '24px',
                            borderRadius: 0.5,
                            fontSize: '12px',
                            span: { padding: '0px 8px 0px 10px' },
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                    />
                </Stack>
            </Box>
        </Box>
    );
}

export default CustomNode;