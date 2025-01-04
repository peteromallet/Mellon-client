import React, { useEffect, useState } from 'react';
import { useNodeState } from '../stores/nodeStore';
import { Handle, Position } from '@xyflow/react';

export function TimestampDisplay({ nodeId }) {
  const [timestamps, setTimestamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const getParam = useNodeState((state) => state.getParam);
  const node = useNodeState((state) => state.nodes.find(n => n.id === nodeId));
  
  // Immediately clear timestamps if cache is false
  useEffect(() => {
    if (!node || node.data.cache === false) {
      setTimestamps([]);
      setLoading(false);
      return;
    }
  }, [node]);

  useEffect(() => {
    const updateTimestamps = () => {
      // Double check cache state
      if (!node || node.data.cache === false) {
        setTimestamps([]);
        setLoading(false);
        return;
      }

      const data = getParam(nodeId, 'timestamps');
      
      if (!nodeId || !data) {
        setTimestamps([]);
        setLoading(false);
        return;
      }

      // Handle different data structures
      let processedData = [];
      if (Array.isArray(data)) {
        processedData = data;
      } else if (data.value && Array.isArray(data.value)) {
        processedData = data.value;
      } else if (typeof data === 'object' && data.type === 'array') {
        processedData = data.value || [];
      } else if (typeof data === 'object' && data.value) {
        if (Array.isArray(data.value)) {
          processedData = data.value;
        } else {
          processedData = [data.value];
        }
      } else if (typeof data === 'object') {
        processedData = [data];
      }

      setTimestamps(processedData);
      setLoading(false);
    };

    updateTimestamps();

    const unsubscribe = useNodeState.subscribe(
      state => {
        const currentNode = state.nodes.find(n => n.id === nodeId);
        return {
          timestamps: currentNode?.data?.params?.timestamps,
          cache: currentNode?.data?.cache
        };
      },
      (newState) => {
        if (newState.cache === false) {
          setTimestamps([]);
          setLoading(false);
        } else {
          updateTimestamps();
        }
      }
    );
    
    return () => unsubscribe();
  }, [nodeId, getParam, node]);

  if (!nodeId) {
    return <div>Error: No node ID provided</div>;
  }

  if (loading) {
    return (
      <div>
        Loading timestamps...
        <br />
        Node ID: {nodeId}
      </div>
    );
  }

  // Don't render anything if cache is false
  if (!node || node.data.cache === false) {
    return (
      <div className="timestamp-display">
        <Handle type="target" position={Position.Left} />
        <p>No timestamps available</p>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  }

  return (
    <div className="timestamp-display">
      <Handle type="target" position={Position.Left} />
      
      {timestamps.length === 0 ? (
        <p>No timestamps available</p>
      ) : (
        <ul>
          {timestamps.map((timestamp, index) => (
            <li key={index}>
              {typeof timestamp === 'object' && timestamp.time 
                ? timestamp.time 
                : typeof timestamp === 'number' 
                  ? timestamp.toFixed(4)
                  : timestamp}
            </li>
          ))}
        </ul>
      )}
      
      <Handle type="source" position={Position.Right} />
    </div>
  );
} 