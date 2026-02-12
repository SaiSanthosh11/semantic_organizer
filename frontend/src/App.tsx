import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  FolderOpen,
  Activity,
  Layers,
  Database,
  Cpu,
  Terminal,
  Maximize2,
  ChevronRight,
  Upload,
  RefreshCw,
  LayoutGrid,
  X,
  Calendar,
  Share2,
  Tag,
  Eye,
  Download,
  Trash2
} from 'lucide-react';
import Visualizer from './components/Visualizer';

// Reference Colors from User Snippet
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

const CLUSTER_PALETTE = [
  { fill: "#7c3aed", glow: "#a855f7", label: "#c4b5fd" },
  { fill: "#0891b2", glow: "#06b6d4", label: "#67e8f9" },
  { fill: "#059669", glow: "#10b981", label: "#6ee7b7" },
  { fill: "#d97706", glow: "#f59e0b", label: "#fcd34d" },
  { fill: "#dc2626", glow: "#ef4444", label: "#fca5a5" },
  { fill: "#db2777", glow: "#ec4899", label: "#f9a8d4" },
];

interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'warning' | 'system' | 'error';
  ts: string;
}

interface GraphNode {
  id: string;
  name: string;
  group: 'file' | 'folder';
  clusterId: number;
  metadata?: any;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const App: React.FC = () => {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ files: 0, folders: 0 });
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'graph' | 'clusters' | 'logs'>('graph');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pipeline, setPipeline] = useState<any>(null);
  const [algorithm, setAlgorithm] = useState<'DBSCAN' | 'KMEANS'>('DBSCAN');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-49), {
      msg,
      type,
      ts: new Date().toLocaleTimeString()
    }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws');

    ws.onopen = () => {
      setConnected(true);
      addLog('Connected to semantic engine', 'success');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'state') {
        const { clusters, files, pipeline: pipe, algorithm: alg } = message.data;
        setPipeline(pipe);
        if (alg) setAlgorithm(alg as any);

        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];

        // Add Cluster Nodes
        Object.entries(clusters).forEach(([cid, name]) => {
          nodes.push({
            id: `folder-${cid}`,
            name: name as string,
            group: 'folder',
            clusterId: parseInt(cid)
          });
        });

        if (Array.isArray(files)) {
          files.forEach((file: any) => {
            nodes.push({
              id: file.path,
              name: file.name,
              group: 'file',
              clusterId: file.cluster,
              metadata: {
                size: file.size,
                modified: file.modified,
                type: file.type,
                content: file.content
              }
            });

            if (file.cluster !== -1) {
              links.push({
                source: `folder-${file.cluster}`,
                target: file.path
              });
            }
          });
        }

        setData({ nodes, links });
        setStats({ files: files.length, folders: Object.keys(clusters).length });
        addLog(`Synchronized: ${files.length} files organized`, 'system');
      } else if (message.type === 'log') {
        addLog(message.message, 'info');
      }
    };

    ws.onclose = () => {
      setConnected(false);
      addLog('Connection lost. Retrying...', 'warning');
    };

    return () => ws.close();
  }, []);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const formData = new FormData();
      formData.append('file', file);
      addLog(`Uploading ${file.name}...`, 'info');
      fetch('http://localhost:8001/upload', {
        method: 'POST',
        body: formData
      })
        .then(r => r.json())
        .then(d => addLog(`Uploaded ${d.filename}`, 'success'))
        .catch(e => addLog(`Upload failed: ${e.message}`, 'error'));
    });
  };

  const runDeclutter = () => {
    if (confirm('Are you sure you want to reset all organization and move files back to root?')) {
      addLog('Triggering system reset...', 'warning');
      fetch('http://localhost:8001/declutter')
        .then(r => r.json())
        .then(() => addLog('System reset complete', 'success'))
        .catch(e => addLog(`Reset failed: ${e.message}`, 'error'));
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return COLORS.green;
      case 'warning': return COLORS.amber;
      case 'error': return COLORS.red;
      case 'system': return COLORS.cyan;
      default: return COLORS.textSecondary;
    }
  };

  return (
    <div style={{
      height: '100vh',
      backgroundColor: COLORS.bg,
      color: COLORS.textPrimary,
      fontFamily: "'JetBrains Mono', monospace",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        height: '64px',
        borderBottom: `1px solid ${COLORS.border}`,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#12121a88',
        backdropFilter: 'blur(12px)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.cyan})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 15px ${COLORS.accent}44`
          }}>
            <Database size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '2px' }}>SEFS</div>
            <div style={{ fontSize: '10px', color: COLORS.textMuted }}>SEMANTIC ENTROPY FILE SYSTEM</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)',
            padding: '6px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.cyan, boxShadow: `0 0 8px ${COLORS.cyan}` }}></div>
            <span style={{ fontSize: '11px', color: COLORS.cyan, fontWeight: 700 }}>{stats.files} FILES</span>
          </div>
          <div style={{
            background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)',
            padding: '6px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.accentGlow, boxShadow: `0 0 8px ${COLORS.accentGlow}` }}></div>
            <span style={{ fontSize: '11px', color: COLORS.accentGlow, fontWeight: 700 }}>{stats.folders} CLUSTERS</span>
          </div>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
            padding: '6px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Cpu size={14} color={COLORS.green} />
            <span style={{ fontSize: '11px', color: COLORS.green, fontWeight: 700 }}>IDLE</span>
          </div>
          <div style={{
            background: connected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${connected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            padding: '6px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px',
            animation: connected ? 'pulse 2s infinite' : 'none'
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: connected ? COLORS.cyan : COLORS.red,
              boxShadow: `0 0 8px ${connected ? COLORS.cyan : COLORS.red}`
            }}></div>
            <span style={{ fontSize: '11px', color: '#fff', fontWeight: 800, letterSpacing: '1px' }}>
              {connected ? 'WATCHING' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <aside style={{
          width: '280px',
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          background: COLORS.surface,
          zIndex: 10
        }}>
          {/* Controls */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? COLORS.cyan : COLORS.border}`,
                borderRadius: '12px',
                padding: '30px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? COLORS.cyan + '08' : 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s'
              }}
            >
              <Upload size={24} color={dragOver ? COLORS.cyan : COLORS.textMuted} style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '11px', color: COLORS.textSecondary, fontWeight: 600 }}>DROP OR CLICK TO UPLOAD</div>
              <div style={{ fontSize: '9px', color: COLORS.textMuted, marginTop: '4px' }}>TXT · PDF · DOCX · MD</div>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* Algorithm Selection */}
            <div>
              <div style={{ fontSize: '10px', color: COLORS.textMuted, letterSpacing: '1px', marginBottom: '12px' }}>ALGORITHM</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: 'rgba(0,0,0,0.2)',
                padding: '4px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                marginBottom: '12px'
              }}>
                <button
                  onClick={() => setAlgorithm('DBSCAN')}
                  style={{
                    padding: '8px', fontSize: '10px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer',
                    background: algorithm === 'DBSCAN' ? 'rgba(124, 58, 237, 0.2)' : 'transparent',
                    color: algorithm === 'DBSCAN' ? COLORS.accentGlow : COLORS.textMuted,
                    border: 'none', transition: 'all 0.2s'
                  }}
                >DBSCAN</button>
                <button
                  onClick={() => setAlgorithm('KMEANS')}
                  style={{
                    padding: '8px', fontSize: '10px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer',
                    background: algorithm === 'KMEANS' ? 'rgba(124, 58, 237, 0.2)' : 'transparent',
                    color: algorithm === 'KMEANS' ? COLORS.accentGlow : COLORS.textMuted,
                    border: 'none', transition: 'all 0.2s'
                  }}
                >KMEANS</button>
              </div>

              <button
                onClick={() => {
                  setIsAnalyzing(true);
                  addLog(`Running ${algorithm} Analysis...`, 'info');
                  fetch('http://localhost:8001/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ algorithm })
                  })
                    .then(r => r.json())
                    .finally(() => setIsAnalyzing(false));
                }}
                disabled={isAnalyzing}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: isAnalyzing ? COLORS.border : `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentGlow})`,
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isAnalyzing ? 'none' : `0 4px 15px ${COLORS.accent}44`
                }}
              >
                <Activity size={16} className={isAnalyzing ? 'animate-pulse' : ''} />
                {isAnalyzing ? 'ANALYZING...' : 'Run Analysis'}
              </button>
            </div>
          </div>

          {/* NLP Pipeline Alignment */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ fontSize: '10px', color: COLORS.textMuted, letterSpacing: '1px', marginBottom: '12px' }}>NLP PIPELINE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { name: 'Load Documents', icon: FolderOpen, status: pipeline?.['Load Documents'] || 'done' },
                { name: 'Preprocessing', icon: Activity, status: pipeline?.['Preprocessing'] || 'done' },
                { name: 'BERT Embeddings', icon: Cpu, status: pipeline?.['BERT Embeddings'] || 'done' },
                { name: 'Cosine Similarity', icon: Layers, status: pipeline?.['Cosine Similarity'] || 'done' },
                { name: 'Clustering', icon: LayoutGrid, status: pipeline?.['Clustering'] || 'active' }
              ].map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  background: step.status === 'active' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px', border: `1px solid ${step.status === 'active' ? COLORS.accent + '44' : COLORS.border}`,
                  transition: 'all 0.3s'
                }}>
                  <step.icon size={14} color={step.status === 'active' ? COLORS.accentGlow : (step.status === 'done' ? COLORS.green : COLORS.textMuted)} />
                  <span style={{
                    fontSize: '11px',
                    color: step.status === 'active' ? COLORS.textPrimary : COLORS.textSecondary,
                    flex: 1
                  }}>{step.name}</span>
                  {step.status === 'done' && <div style={{ color: COLORS.green, fontSize: '10px' }}>✓</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Quick List / Reset */}
          <div style={{ flex: 1, padding: '0 20px 20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: COLORS.textMuted, letterSpacing: '1px' }}>RECENT FILES</div>
              <button
                onClick={runDeclutter}
                style={{
                  background: 'none', border: 'none', color: COLORS.red,
                  fontSize: '9px', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <RefreshCw size={10} /> RESET
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.nodes.filter(n => n.group === 'file').slice(0, 10).map((node, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedNode(node)}
                  style={{
                    fontSize: '11px', padding: '8px', borderRadius: '4px',
                    backgroundColor: selectedNode?.id === node.id ? COLORS.accent + '22' : 'transparent',
                    color: selectedNode?.id === node.id ? COLORS.accentGlow : COLORS.textSecondary,
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}
                >
                  <FileText size={12} /> {node.name}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Tabs */}
          <nav style={{
            display: 'flex', gap: '2px', padding: '0 12px',
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surface
          }}>
            {[
              { id: 'graph', label: 'NODE GRAPH', icon: Maximize2 },
              { id: 'clusters', label: 'CLUSTERS', icon: FolderOpen },
              { id: 'logs', label: 'SYSTEM LOG', icon: Terminal }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 20px',
                  background: 'none', border: 'none',
                  borderBottom: `2px solid ${activeTab === tab.id ? COLORS.accent : 'transparent'}`,
                  color: activeTab === tab.id ? COLORS.textPrimary : COLORS.textMuted,
                  fontSize: '11px', fontWeight: activeTab === tab.id ? 700 : 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </nav>

          {/* View Container */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {activeTab === 'graph' && (
              <>
                {/* Floating Graph Info Chips */}
                <div style={{
                  position: 'absolute', top: '24px', left: '24px', zIndex: 10,
                  display: 'flex', gap: '12px'
                }}>
                  <div style={{
                    background: 'rgba(18, 18, 26, 0.7)', backdropFilter: 'blur(8px)',
                    padding: '8px 16px', borderRadius: '10px', border: '1px solid #ffffff11',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.cyan }} />
                    <span style={{ fontSize: '11px', color: COLORS.textMuted }}>Root: <span style={{ color: COLORS.textPrimary }}>~/Documents</span></span>
                  </div>
                  <div style={{
                    background: 'rgba(18, 18, 26, 0.7)', backdropFilter: 'blur(8px)',
                    padding: '8px 16px', borderRadius: '10px', border: '1px solid #ffffff11'
                  }}>
                    <span style={{ fontSize: '11px', color: COLORS.textMuted }}>Graph View - <span style={{ color: COLORS.cyan }}>{stats.folders} clusters</span></span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '100%', background: '#000' }}>
                  <Visualizer data={data} onNodeClick={setSelectedNode} />
                </div>
              </>
            )}

            {activeTab === 'logs' && (
              <div ref={logRef} style={{
                height: '100%', padding: '24px', overflowY: 'auto',
                fontSize: '12px', lineHeight: '1.8'
              }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '4px' }}>
                    <span style={{ color: COLORS.textMuted }}>[{log.ts}]</span>
                    <span style={{ color: getLogColor(log.type) }}>{log.msg}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'clusters' && (
              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', overflowY: 'auto' }}>
                {data.nodes.filter(n => n.group === 'folder').map((folder, i) => {
                  const items = data.nodes.filter(n => n.clusterId === folder.clusterId && n.group === 'file');
                  const palette = CLUSTER_PALETTE[i % CLUSTER_PALETTE.length];
                  return (
                    <div key={i} style={{
                      borderRadius: '12px', border: `1px solid ${palette.fill}22`,
                      background: palette.fill + '08', overflow: 'hidden'
                    }}>
                      <div style={{ padding: '16px', background: palette.fill + '11', borderBottom: `1px solid ${palette.fill}22` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <FolderOpen size={20} color={palette.glow} />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: palette.label }}>{folder.name.toUpperCase()}</div>
                            <div style={{ fontSize: '10px', color: COLORS.textMuted }}>{items.length} ORGANIZED FILES</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: '12px' }}>
                        {items.map((it, j) => (
                          <div key={j} style={{ fontSize: '11px', color: COLORS.textSecondary, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ChevronRight size={10} /> {it.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Floating File Inspector Card (as per image) */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            width: '380px',
            background: 'rgba(18, 18, 26, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            zIndex: 100,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            maxHeight: 'calc(100% - 48px)',
            overflowY: 'auto'
          }}>
            {/* Header: Icon, Name, Topic & Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', background: '#fff1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FileText size={18} color="#a855f7" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', wordBreak: 'break-word', letterSpacing: '0.3px' }}>
                    {selectedNode.name}
                  </div>
                  <div style={{ fontSize: '11px', color: COLORS.red, fontWeight: 600, marginTop: '2px' }}>
                    {data.nodes.find(n => n.group === 'folder' && n.clusterId === selectedNode.clusterId)?.name || 'Unsorted'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                  background: 'rgba(16, 185, 129, 0.1)', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.green, boxShadow: `0 0 6px ${COLORS.green}` }} />
                  <span style={{ fontSize: '10px', color: '#fff', fontWeight: 700 }}>Connected</span>
                </div>
                <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', color: '#fff4', cursor: 'pointer', padding: '4px' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Metadata Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Size', value: selectedNode.metadata?.size || '0 KB', icon: <Database size={14} /> },
                { label: 'Modified', value: new Date(selectedNode.metadata?.modified * 1000).toLocaleDateString(), icon: <Calendar size={14} /> },
                { label: 'Type', value: selectedNode.metadata?.type || 'FILE', icon: <FileText size={14} /> },
                { label: 'Position', value: `(${Math.round(selectedNode.x || 0)}, ${Math.round(selectedNode.y || 0)})`, icon: <Share2 size={14} /> }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: COLORS.textMuted }}>
                    {item.icon} {item.label}
                  </div>
                  <div style={{ color: COLORS.textSecondary, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid #ffffff0a' }} />

            {/* Semantic Keywords */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: COLORS.textMuted, fontSize: '10px', letterSpacing: '1px', fontWeight: 800 }}>
                <Tag size={12} /> SEMANTIC KEYWORDS
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(selectedNode.metadata?.keywords || ['document', 'organized']).map((tag: string, i: number) => (
                  <span key={i} style={{
                    fontSize: '10px', padding: '4px 12px', borderRadius: '6px',
                    background: 'rgba(6, 182, 212, 0.05)', color: COLORS.cyan,
                    border: '1px solid rgba(6, 182, 212, 0.15)'
                  }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* Confidence Progress */}
            <div>
              <div style={{ height: '4px', width: '100%', background: '#fff1', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{
                  height: '100%', width: `${(selectedNode.metadata?.confidence || 0.85) * 100}%`,
                  background: COLORS.cyan, boxShadow: `0 0 10px ${COLORS.cyan}44`
                }} />
              </div>
              <div style={{ fontSize: '10px', color: COLORS.textMuted }}>
                Semantic confidence: <span style={{ color: COLORS.textSecondary }}>{Math.round((selectedNode.metadata?.confidence || 0.85) * 100)}%</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => fetch(`http://localhost:8001/open?path=${encodeURIComponent(selectedNode.id)}`)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #ffffff11',
                    background: 'rgba(6, 182, 212, 0.1)', color: COLORS.cyan, fontSize: '11px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                  }}
                >
                  <Eye size={14} /> View
                </button>
                <button
                  onClick={() => window.location.href = `http://localhost:8001/download?path=${encodeURIComponent(selectedNode.id)}`}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #ffffff11',
                    background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontSize: '11px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                  }}
                >
                  <Download size={14} /> Download
                </button>
              </div>
              <button
                onClick={async () => {
                  if (confirm(`Delete ${selectedNode.name}?`)) {
                    await fetch(`http://localhost:8001/delete?path=${encodeURIComponent(selectedNode.id)}`, { method: 'DELETE' });
                    setSelectedNode(null);
                  }
                }}
                style={{
                  width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ffffff11',
                  background: 'rgba(239, 68, 68, 0.1)', color: COLORS.red, fontSize: '11px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                }}
              >
                <Trash2 size={14} /> Delete File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
