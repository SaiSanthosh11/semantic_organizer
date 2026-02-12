import React, { useCallback, useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Palette from User Snippet
const COLORS = {
  bg: "#0a0a0f",
  surface: "#12121a",
  border: "#1e1e2e",
  accent: "#7c3aed",
  accentGlow: "#a855f7",
  cyan: "#06b6d4",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#475569",
};

interface VisualizerProps {
  data: {
    nodes: any[];
    links: any[];
  };
  onNodeClick: (node: any) => void;
}

const CLUSTER_COLORS = [
  "#06b6d4", // Cyan
  "#a855f7", // Purple
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#ec4899", // Pink
];

const Visualizer: React.FC<VisualizerProps> = ({ data, onNodeClick }) => {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          w: entry.contentRect.width,
          h: entry.contentRect.height
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    onNodeClick(node);
  }, [onNodeClick]);

  const handleNodeHover = (node: any) => {
    setHoveredNode(node);
    if (node && fgRef.current) {
      // Calculate screen position
      const pos = fgRef.current.graph2ScreenCoords(node.x, node.y);
      setTooltipPos({ x: pos.x, y: pos.y });
    }
  };

  const getClusterColor = (clusterId: number) => {
    if (clusterId === -1) return COLORS.textMuted;
    return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: COLORS.bg
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.w}
        height={dimensions.h}
        graphData={data}
        backgroundColor="#0a0a0f"
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onRenderFramePre={(ctx, globalScale) => {
          // Draw a dynamic grid in "world" coordinates
          const gridGap = 80;
          const range = 4000; // Large enough area

          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 1 / globalScale;

          for (let x = -range; x <= range; x += gridGap) {
            ctx.moveTo(x, -range);
            ctx.lineTo(x, range);
          }
          for (let y = -range; y <= range; y += gridGap) {
            ctx.moveTo(-range, y);
            ctx.lineTo(range, y);
          }
          ctx.stroke();

          // Sub-grid dots for extra depth
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          for (let x = -range; x <= range; x += gridGap) {
            for (let y = -range; y <= range; y += gridGap) {
              ctx.rect(x - 0.5 / globalScale, y - 0.5 / globalScale, 1 / globalScale, 1 / globalScale);
            }
          }
          ctx.fill();

          ctx.restore();
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const isFolder = node.group === 'folder';
          const clusterColor = getClusterColor(node.clusterId);
          // Files now share the cluster color exactly
          const nodeColor = clusterColor;
          const radius = isFolder ? 8 : 6;

          // 1. Draw Cluster Hulls (only for folder nodes)
          if (isFolder) {
            // Find all files in this cluster
            const clusterFiles = data.nodes.filter(n => n.clusterId === node.clusterId && n.group === 'file');
            if (clusterFiles.length > 0) {
              // Calculate a bounding circle
              let maxDist = 40;
              clusterFiles.forEach(f => {
                const d = Math.sqrt(Math.pow(f.x - node.x, 2) + Math.pow(f.y - node.y, 2));
                if (d > maxDist) maxDist = d;
              });

              ctx.beginPath();
              ctx.arc(node.x, node.y, maxDist + 15, 0, 2 * Math.PI, false);
              ctx.setLineDash([5, 5]);
              ctx.strokeStyle = clusterColor + '33';
              ctx.lineWidth = 1 / globalScale;
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // Cluster Hub Label (Centered ABOVE)
            ctx.font = `bold ${14 / globalScale}px 'JetBrains Mono'`;
            ctx.fillStyle = clusterColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(node.name.toUpperCase(), node.x, node.y - 45 / globalScale);
          } else {
            // 1b. Draw File Label (Centered BELOW dot)
            ctx.font = `${11 / globalScale}px 'JetBrains Mono'`;
            ctx.fillStyle = COLORS.textSecondary;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            // Truncate name if too long
            const label = node.name.length > 20 ? node.name.substring(0, 17) + '...' : node.name;
            ctx.fillText(label, node.x, node.y + radius + 5 / globalScale);
          }

          // 2. Draw Node Glow
          ctx.shadowBlur = 15 / globalScale;
          ctx.shadowColor = nodeColor;

          // 3. Draw Node Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          // Inner core for folder
          if (isFolder) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius / 2, 0, 2 * Math.PI, false);
            ctx.fillStyle = '#fff';
            ctx.fill();
          }

          ctx.shadowBlur = 0;
        }}
        linkColor={(link: any) => {
          const targetNode = data.nodes.find(n => n.id === link.target.id || n.id === link.target);
          if (targetNode) {
            const clusterColor = getClusterColor(targetNode.clusterId);
            const color = targetNode.clusterId === -1 ? '#ffffff' : clusterColor;
            return `${color}15`; // 15% opacity for subtlety
          }
          return 'rgba(255, 255, 255, 0.05)';
        }}
        linkWidth={1.5}
        linkDirectionalParticles={1}
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleWidth={1.2}
        linkDirectionalParticleColor={(link: any) => {
          const targetNode = data.nodes.find(n => n.id === link.target.id || n.id === link.target);
          return targetNode ? getClusterColor(targetNode.clusterId) : COLORS.accentGlow;
        }}
      />

      {/* Premium Hover Tooltip */}
      {hoveredNode && hoveredNode.group === 'file' && (
        <div style={{
          position: 'absolute',
          left: tooltipPos.x + 20,
          top: tooltipPos.y - 100,
          width: '280px',
          background: 'rgba(18, 18, 26, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #ffffff1a',
          borderRadius: '12px',
          padding: '20px',
          color: '#fff',
          pointerEvents: 'none',
          zIndex: 1000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', background: '#ffffff0a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              📄
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, wordBreak: 'break-all' }}>{hoveredNode.name}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: COLORS.textSecondary }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Size</span>
              <span style={{ color: '#fff' }}>{hoveredNode.metadata?.size || '0 KB'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Modified</span>
              <span style={{ color: '#fff' }}>{new Date(hoveredNode.metadata?.modified * 1000).toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Type</span>
              <span style={{ color: '#fff' }}>{hoveredNode.metadata?.type || 'FILE'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
            <span style={{ padding: '4px 10px', borderRadius: '6px', background: COLORS.cyan + '22', border: `1px solid ${COLORS.cyan}44`, color: COLORS.cyan, fontSize: '10px' }}>revenue</span>
            <span style={{ padding: '4px 10px', borderRadius: '6px', background: COLORS.accent + '22', border: `1px solid ${COLORS.accent}44`, color: COLORS.accentGlow, fontSize: '10px' }}>Q1</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visualizer;
