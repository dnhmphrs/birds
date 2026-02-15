<script>
  import { onMount, onDestroy } from 'svelte';
  
  export let numNodes = 800;
  export let isVisible = true;
  
  // State
  let activityHistory = [];
  let chips = [];
  let stats = {};
  let sinkNodeIndex = -1;
  let selectedNodes = [];
  let topN = 20;
  
  // Visual settings
  let historyLength = 100;
  let sparklineWidth = 120;
  let sparklineHeight = 30;
  
  // All neurons visualization
  let allNeuronsCanvas;
  let allNeuronsCtx;
  let allNeuronsWidth = 800;
  let allNeuronsHeight = 120;
  let timeWindow = 200;
  let activityBuffer = [];
  
  function handleChipFiringUpdate(event) {
    const data = event.detail;
    activityHistory = data.activityHistory || [];
    chips = data.chips || [];
    stats = data.stats || [];
    sinkNodeIndex = data.sinkNodeIndex;
    
    // Store activity state
    if (data.activity) {
      activityBuffer.push([...data.activity]);
      if (activityBuffer.length > timeWindow) {
        activityBuffer.shift();
      }
    }
    
    updateAllNeuronsVisualization();
    
    // Find most active nodes
    const nodeActivity = activityHistory.map((history, index) => ({
      index,
      firings: history.length,
      recentActivity: history.slice(-10).length
    }));
    
    selectedNodes = nodeActivity
      .filter(node => node.index !== sinkNodeIndex)
      .sort((a, b) => {
        if (b.recentActivity !== a.recentActivity) {
          return b.recentActivity - a.recentActivity;
        }
        return b.firings - a.firings;
      })
      .slice(0, topN);
  }
  
  function updateAllNeuronsVisualization() {
    if (!allNeuronsCtx || activityBuffer.length === 0) return;
    
    const width = allNeuronsWidth;
    const height = allNeuronsHeight;
    
    allNeuronsCtx.fillStyle = '#0a0a0a';
    allNeuronsCtx.fillRect(0, 0, width, height);
    
    const neuronHeight = height / numNodes;
    const timeStep = width / timeWindow;
    
    for (let t = 0; t < activityBuffer.length; t++) {
      const activityState = activityBuffer[t];
      const x = (t / timeWindow) * width;
      
      for (let i = 0; i < numNodes; i++) {
        const activity = activityState[i];
        const y = (i / numNodes) * height;
        
        if (activity < 0.01) continue;
        
        let color;
        if (i === sinkNodeIndex) {
          color = `rgba(0, 204, 255, ${activity})`;
        } else {
          const intensity = Math.min(1, activity);
          color = `rgba(255, ${127 * intensity}, 0, ${intensity})`;
        }
        
        allNeuronsCtx.fillStyle = color;
        allNeuronsCtx.fillRect(x, y, timeStep + 1, neuronHeight + 1);
      }
    }
    
    // Grid lines
    allNeuronsCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    allNeuronsCtx.lineWidth = 1;
    
    for (let i = 0; i < numNodes; i += 100) {
      const y = (i / numNodes) * height;
      allNeuronsCtx.beginPath();
      allNeuronsCtx.moveTo(0, y);
      allNeuronsCtx.lineTo(width, y);
      allNeuronsCtx.stroke();
    }
    
    for (let t = 0; t < timeWindow; t += 50) {
      const x = (t / timeWindow) * width;
      allNeuronsCtx.beginPath();
      allNeuronsCtx.moveTo(x, 0);
      allNeuronsCtx.lineTo(x, height);
      allNeuronsCtx.stroke();
    }
  }
  
  function createSparkline(history) {
    if (!history || history.length === 0) return '';
    
    const width = sparklineWidth;
    const height = sparklineHeight;
    const step = width / Math.max(historyLength, history.length);
    
    const recent = history.slice(-historyLength);
    const now = Date.now();
    
    const points = [];
    for (let i = 0; i < historyLength; i++) {
      const x = i * step;
      const y = height;
      
      const firingIndex = recent.findIndex(f => 
        Math.floor((now - f.time) / (1000/60)) === (historyLength - i - 1)
      );
      
      if (firingIndex >= 0) {
        points.push(`${x},0`);
        points.push(`${x + step},${height}`);
      } else {
        points.push(`${x},${height}`);
      }
    }
    
    return `M 0,${height} ${points.join(' L ')} L ${width},${height}`;
  }
  
  onMount(() => {
    window.addEventListener('chip-firing-update', handleChipFiringUpdate);
    
    if (allNeuronsCanvas) {
      allNeuronsCtx = allNeuronsCanvas.getContext('2d');
      allNeuronsCanvas.width = allNeuronsWidth;
      allNeuronsCanvas.height = allNeuronsHeight;
    }
    
    if (isVisible) {
      dispatchMonitorResize();
    }
  });
  
  onDestroy(() => {
    window.removeEventListener('chip-firing-update', handleChipFiringUpdate);
  });
  
  $: if (isVisible !== undefined) {
    dispatchMonitorResize();
  }
  
  function dispatchMonitorResize() {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('activity-monitor-resize', {
        detail: { isVisible, height: isVisible ? 320 : 0 }
      });
      window.dispatchEvent(event);
    }
  }
</script>

<div class="activity-monitor" class:visible={isVisible}>
  <div class="stats-panel">
    <div class="stat">
      <span class="label">Steps:</span>
      <span class="value">{stats.stepCount || 0}</span>
    </div>
    <div class="stat">
      <span class="label">Total Firings:</span>
      <span class="value">{stats.totalFirings || 0}</span>
    </div>
    <div class="stat">
      <span class="label">Total Chips:</span>
      <span class="value">{stats.totalChips || 0}</span>
    </div>
    <div class="stat">
      <span class="label">Unstable:</span>
      <span class="value warning">{stats.unstableNodes || 0}</span>
    </div>
    {#if sinkNodeIndex >= 0}
      <div class="stat sink-stat">
        <span class="label">Sink Chips:</span>
        <span class="value highlight">{stats.sinkChips || 0}</span>
      </div>
      <div class="stat sink-stat">
        <span class="label">Absorbed:</span>
        <span class="value highlight">{stats.sinkChipsAbsorbed || 0}</span>
      </div>
    {/if}
  </div>
  
  <div class="all-neurons-section">
    <div class="section-header">
      <span>All Neurons Activity (Time →)</span>
      <span class="info-text">Each row = neuron, brightness = activity</span>
    </div>
    <div class="canvas-container">
      <canvas bind:this={allNeuronsCanvas}></canvas>
      <div class="canvas-labels">
        <span class="label-left">Node 0 (Sink)</span>
        <span class="label-right">Node {numNodes - 1}</span>
      </div>
    </div>
  </div>
  
  <div class="activity-grid">
    <div class="grid-header">
      <span>Most Active Nodes</span>
      <span class="controls">
        <button on:click={() => topN = Math.max(5, topN - 5)}>-</button>
        <span>{topN}</span>
        <button on:click={() => topN = Math.min(50, topN + 5)}>+</button>
      </span>
    </div>
    
    <div class="node-list">
      {#each selectedNodes as node}
        <div class="node-item">
          <div class="node-info">
            <span class="node-id">Node {node.index}</span>
            <span class="node-chips">{chips[node.index] || 0} chips</span>
            <span class="node-firings">{node.firings} fires</span>
          </div>
          <div class="sparkline-container">
            <svg width={sparklineWidth} height={sparklineHeight}>
              <path
                d={createSparkline(activityHistory[node.index] || [])}
                fill="none"
                stroke="rgba(255, 127, 0, 0.8)"
                stroke-width="2"
              />
            </svg>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .activity-monitor {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.92);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    z-index: 1000;
    height: 320px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .activity-monitor.visible {
    transform: translateY(0);
  }
  
  .stats-panel {
    display: flex;
    gap: 20px;
    padding: 8px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.3);
  }
  
  .stat {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  
  .stat .label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 10px;
  }
  
  .stat .value {
    color: rgba(255, 255, 255, 0.95);
    font-weight: bold;
    font-size: 13px;
  }
  
  .stat .value.warning {
    color: #ff7f00;
  }
  
  .stat.sink-stat .value.highlight {
    color: #00ccff;
  }
  
  .all-neurons-section {
    flex-shrink: 0;
    padding: 10px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.2);
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 11px;
    font-weight: bold;
  }
  
  .info-text {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: normal;
  }
  
  .canvas-container {
    position: relative;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }
  
  canvas {
    display: block;
    width: 100%;
    height: 120px;
    image-rendering: pixelated;
  }
  
  .canvas-labels {
    position: absolute;
    top: 4px;
    left: 4px;
    right: 4px;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.7);
    pointer-events: none;
  }
  
  .label-left {
    background: rgba(0, 204, 255, 0.3);
    padding: 2px 4px;
    border-radius: 2px;
    border: 1px solid rgba(0, 204, 255, 0.5);
  }
  
  .label-right {
    background: rgba(255, 127, 0, 0.3);
    padding: 2px 4px;
    border-radius: 2px;
    border: 1px solid rgba(255, 127, 0, 0.5);
  }
  
  .activity-grid {
    flex: 1;
    overflow-y: auto;
    padding: 10px 20px;
    min-height: 0;
  }
  
  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 11px;
    font-weight: bold;
  }
  
  .controls {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 11px;
  }
  
  .controls button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 11px;
    transition: all 0.2s;
  }
  
  .controls button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 127, 0, 0.5);
  }
  
  .node-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 6px;
  }
  
  .node-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 6px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s;
  }
  
  .node-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 127, 0, 0.3);
  }
  
  .node-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .node-id {
    color: rgba(255, 255, 255, 0.9);
    font-weight: bold;
    font-size: 11px;
  }
  
  .node-chips {
    color: rgba(255, 127, 0, 0.8);
    font-size: 10px;
  }
  
  .node-firings {
    color: rgba(255, 255, 255, 0.5);
    font-size: 9px;
  }
  
  .sparkline-container {
    flex-shrink: 0;
  }
  
  .activity-grid::-webkit-scrollbar {
    width: 6px;
  }
  
  .activity-grid::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
  }
  
  .activity-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  
  .activity-grid::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>