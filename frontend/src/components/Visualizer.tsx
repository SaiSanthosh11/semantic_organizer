import ForceGraph2D from 'react-force-graph-2d';
import { useRef, useCallback } from 'react';

interface VisualizerProps {
  data: {
    nodes: any[];
    links: any[];
  }
}

const Visualizer = ({ data }: VisualizerProps) => {
  const fgRef = useRef();

  const handleNodeClick = useCallback((node: any) => {
    // Assuming node.id is the filename
    fetch(`http://127.0.0.1:8000/open?path=${node.id}`)
      .then(res => res.json())
      .then(data => console.log(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeLabel="id"
        nodeAutoColorBy="group"
        linkDirectionalParticles={2}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
};

export default Visualizer;
