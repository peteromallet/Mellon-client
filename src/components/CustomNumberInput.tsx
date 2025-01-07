import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InputBase from '@mui/material/InputBase';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface CustomNumberInputProps {
    dataKey: string;
    value: string | number;
    label: string;
    dataType?: 'int' | 'float';
    slider?: boolean;
    disabled?: boolean;
    onChange: (value: string) => void;
    min?: number;
    max?: number;
    step?: number;
    style?: React.CSSProperties;
}

interface DragState {
    x: number;
    value: number;
}

interface InputRefs {
    input: HTMLInputElement | null;
    dragTimeout: number | null;
    dragStart: DragState;
    isDragging: boolean;
}

const CustomNumberInput = ({
    value,
    label = '',
    dataType = 'int',
    slider = false,
    disabled = false,
    onChange,
    min,
    max,
    step,
    style,
    ...props
}: CustomNumberInputProps) => {
    const theme = useTheme();
    const sx = style || {};

    const refs = useRef<InputRefs>({
        input: null,
        dragTimeout: null,
        dragStart: { x: 0, value: 0 },
        isDragging: false
    });

    const inputRefCallback = useCallback((node: HTMLDivElement | null) => {
        // Get the actual input element from the InputBase
        refs.current.input = node?.querySelector('input') || null;
    }, []);

    const [localValue, setLocalValue] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);

    // Constants
    const displaySlider = slider && min !== undefined && max !== undefined;
    const minValue = min !== undefined ? min : -Number.MAX_SAFE_INTEGER;
    const maxValue = max !== undefined ? max : Number.MAX_SAFE_INTEGER;
    const increment = step !== undefined ? step : (dataType === 'float' ? 0.1 : 1);
    const decimals = dataType === 'float' ? (increment.toString().split('.')[1]?.length || 1) : 0;

    // Use the prop value when not editing, and localValue when editing
    const displayValue = useMemo(() => {
        return isEditing ? localValue : String(value || 0);
    }, [isEditing, localValue, value]);

    const getBackgroundStyle = (value: number) => {
        if (!displaySlider) return {};

        // Calculate percentage based on the actual value's proportion of the range
        // For negative ranges, we need to normalize the value to a 0-100% scale
        const range = maxValue - minValue;
        const normalizedValue = value - minValue; // Shift the value to start from 0
        const sliderPercent = Math.max(0, Math.min(100, (normalizedValue / range) * 100));
        
        const baseColor = refs.current.isDragging ? theme.palette.secondary.main : 'rgba(255,255,255,0.25)';
        const hoverColor = theme.palette.secondary.main;

        const gradientStyle = `linear-gradient(to right, ${baseColor} 0%, ${baseColor} ${sliderPercent}%, rgba(255,255,255,0.1) ${sliderPercent}%)`;

        return {
            background: gradientStyle,
            '&:hover': { background: `linear-gradient(to right, ${hoverColor} 0%, ${hoverColor} ${sliderPercent}%, rgba(255,255,255,0.1) ${sliderPercent}%)` }
        };
    };

    const updateValue = useCallback((value: string | number) => {
        value = Number(value);
        if (isNaN(value)) {
            value = (maxValue - minValue) / 2;
        }
        const newValue = String(Math.min(maxValue, Math.max(minValue, value)).toFixed(decimals));
        
        setLocalValue(newValue);
        onChange(newValue);
    }, [minValue, maxValue, decimals, onChange]);

    const handleBlur = useCallback(() => {
        const inputElement = refs.current.input;
        if (inputElement) {
            updateValue(inputElement.value);
        }
        setIsEditing(false);
    }, [updateValue]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        const inputElement = e.currentTarget;
        if (e.key === 'Enter' || e.key === 'Escape') {
            setIsEditing(false);
            updateValue(inputElement.value);
            inputElement.blur();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            updateValue(Number(inputElement.value) + increment);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            updateValue(Number(inputElement.value) - increment);
        }
    }, [increment, updateValue]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (refs.current.dragTimeout) {
            clearTimeout(refs.current.dragTimeout);
        }

        e.preventDefault();
        e.stopPropagation();

        if (!refs.current.isDragging) {
            refs.current.isDragging = true;
        }

        const delta = e.clientX - refs.current.dragStart.x;
        const range = maxValue - minValue;
        const steps = range / increment || 100;
        const valueRange = displaySlider ? steps / 300 * delta : delta;
        const newValue = refs.current.dragStart.value + valueRange * increment;

        updateValue(newValue);
    }, [minValue, maxValue, increment, updateValue, displaySlider]);

    const handleMouseUp = useCallback(() => {
        if (refs.current.dragTimeout) {
            clearTimeout(refs.current.dragTimeout);
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        refs.current.isDragging = false;
    }, [handleMouseMove]);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only handle left mouse button
        if (e.button !== 0) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // Ignore clicks on the chevron buttons
        const isButton = (e.target as HTMLElement).closest('button');
        if (isButton) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const inputElement = refs.current.input;
        if (inputElement && document.activeElement !== inputElement) {
            inputElement.focus();
        }
        
        // Force exit editing mode and sync local value with current value
        setIsEditing(false);
        setLocalValue(String(value));

        // Get the bounding rectangle of the slider container
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const leftOffset = 40;
        const rightOffset = 40;
        const availableWidth = rect.width - leftOffset - rightOffset;
        
        const clickX = e.clientX - rect.left - leftOffset;
        const relativePosition = Math.max(0, Math.min(1, clickX / availableWidth));

        if (displaySlider && clickX >= 0 && clickX <= availableWidth) {
            const newValue = minValue + (maxValue - minValue) * relativePosition;
            const roundedValue = Math.round(newValue / increment) * increment;
            updateValue(roundedValue);
            refs.current.dragStart = { x: e.clientX, value: roundedValue };
        } else {
            // Use the current value prop instead of displayValue
            refs.current.dragStart = { x: e.clientX, value: Number(value) };
        }

        refs.current.isDragging = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(true);
        setLocalValue(e.target.value);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        // Ignore double clicks on the chevron buttons
        const isButton = (e.target as HTMLElement).closest('button');
        if (isButton) {
            return;
        }

        const inputElement = refs.current.input;
        if (inputElement) {
            inputElement.select();
        }
    };

    useEffect(() => {
        const currentRefs = refs.current;
        
        return () => {
            if (currentRefs.dragTimeout) {
                window.clearTimeout(currentRefs.dragTimeout);
            }
        };
    }, []);

    const field = (
        <Stack
            data-key={props.dataKey}
            direction="row"
            spacing={0.5}
            className={`nodrag customNumberInput${disabled ? ' mellon-disabled' : ''}`}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            sx={{
                mb: 0,
                p: 0.5,
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'center',
                ...getBackgroundStyle(Number(displayValue)),
                borderRadius: 1,
                overflow: 'hidden',
                userSelect: 'none',
                cursor: 'default',
                outline: isEditing ? `2px solid ${theme.palette.primary.main}` : 'none',
                ...sx,
            }}
        >
            <IconButton
                size="small"
                disableRipple
                onClick={() => updateValue(Number(displayValue) - increment)}
                sx={{
                    borderRadius: 1,
                    opacity: Number(displayValue) <= minValue ? 0.4 : 1,
                    '&:hover': { background: Number(displayValue) <= minValue ? '' : 'rgba(255,255,255,0.15)' }
                }}
            >
                <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Box sx={{ maxWidth: '50%'}}>
                <Typography sx={{ fontSize: '14px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={label}>{label}</Typography>
            </Box>
            <InputBase
                ref={inputRefCallback}
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                inputProps={{
                    sx: { fontSize: '14px', textAlign: 'right', padding: 0, cursor: 'default' },
                }}
                sx={{ flexGrow: 1 }}
            />
            <IconButton
                size="small"
                disableRipple
                onClick={() => updateValue(Number(displayValue) + increment)}
                sx={{
                    borderRadius: 1,
                    opacity: Number(displayValue) >= maxValue ? 0.4 : 1,
                    '&:hover': { background: Number(displayValue) >= maxValue ? '' : 'rgba(255,255,255,0.15)' }
                }}
            >
                <ChevronRightIcon fontSize="small" />
            </IconButton>
        </Stack>
    );

    return field;
};

export default CustomNumberInput;