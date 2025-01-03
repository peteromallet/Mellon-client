import React, { useEffect, useState } from 'react';
import { useNodeState } from '../stores/nodeStore';
import { Handle, Position } from '@xyflow/react';

export function TimestampDisplay({ nodeId }) {
  console.log('TimestampDisplay mounted with nodeId:', nodeId);
  const [timestamps, setTimestamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const getParam = useNodeState((state) => state.getParam);

  useEffect(() => {
    const updateTimestamps = () => {
      console.log('TimestampDisplay updating, nodeId:', nodeId);
      const data = getParam(nodeId, 'timestamps');
      console.log('TimestampDisplay raw data:', data);
      
      if (!nodeId) {
        console.warn('No ID provided to TimestampDisplay');
        setLoading(false);
        return;
      }

      // Handle different data structures
      let processedData = [];
      if (data) {
        if (Array.isArray(data)) {
          processedData = data;
        } else if (data.value && Array.isArray(data.value)) {
          processedData = data.value;
        } else if (typeof data === 'object' && data.type === 'array') {
          processedData = data.value || [];
        } else if (typeof data === 'object') {
          processedData = [data]; // Handle single timestamp object
        }
      }

      console.log('TimestampDisplay processed data:', processedData);
      setTimestamps(processedData);
      setLoading(false);
    };

    updateTimestamps();

    const unsubscribe = useNodeState.subscribe((state) => {
      console.log('Store updated for TimestampDisplay');
      updateTimestamps();
    });
    
    return () => unsubscribe();
  }, [nodeId, getParam]);

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

  return (
    <div className="timestamp-display">
      
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
    </div>
  );
} 