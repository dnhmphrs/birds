<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import NeuralNetExperience from '$lib/graphics/experiences/NeuralNet/NeuralNetExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import ActivityMonitor from '$lib/components/ActivityMonitor.svelte';
  import { getExperienceColor } from '$lib/store/experienceStore.js';
  
  let canvas;
  let canvasContainer;
  let engine;
  let mounted = false;
  let loadingMessage = "Initializing WebGPU...";
  let loadingProgress = -1;
  let showActivityMonitor = true;
  let showStats = true;
  let numNodes = 800;
  let experience = null;
  
  const accentColor = getExperienceColor('neuralnet');
  
  onMount(async () => {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      return;
    }
    
    loadingMessage = "Initializing graphics engine...";
    loadingProgress = 30;
    engine = new Engine(canvas);
    
    loadingMessage = "Generating network graph...";
    loadingProgress = 60;
    experience = await engine.start(NeuralNetExperience, getCameraConfig('NeuralNet'));
    
    if (experience) {
      numNodes = experience.numNodes;
    }
    
    loadingMessage = "Finalizing...";
    loadingProgress = 90;
    
    setTimeout(() => {
      loadingProgress = 100;
      setTimeout(() => {
        mounted = true;
        updateCanvasHeight();
      }, 300);
    }, 500);
    
    const handleResize = () => {
      updateCanvasHeight();
    };
    
    const handleMonitorResize = (event) => {
      setTimeout(() => {
        updateCanvasHeight();
      }, 50);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('activity-monitor-resize', handleMonitorResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('activity-monitor-resize', handleMonitorResize);
      if (engine) {
        engine.cleanup();
      }
    };
  });
  
  function updateCanvasHeight() {
    if (!canvasContainer || !engine) return;
    
    const monitorHeight = showActivityMonitor ? 320 : 0;
    const availableHeight = window.innerHeight - monitorHeight;
    
    // Update container height
    canvasContainer.style.height = `${availableHeight}px`;
    
    // Wait for CSS transition and DOM updates before resizing engine
    setTimeout(() => {
      if (engine && canvas) {
        // Get actual rendered dimensions
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        if (width > 0 && height > 0) {
          // Update viewport without changing camera aspect
          engine.updateViewport(width, height);
        }
      }
    }, 350); // Match CSS transition duration
  }
  
  $: if (showActivityMonitor !== undefined && mounted && canvasContainer) {
    // Small delay to ensure state is updated
    setTimeout(() => updateCanvasHeight(), 10);
  }
  
  onDestroy(() => {
    if (engine) {
      engine.cleanup();
    }
  });
  
  function toggleActivityMonitor() {
    showActivityMonitor = !showActivityMonitor;
  }
  
  function toggleStats() {
    showStats = !showStats;
  }
  
  function toggleMagneticField() {
    if (experience) {
      experience.magneticFieldEnabled = !experience.magneticFieldEnabled;
      console.log('Magnetic field:', experience.magneticFieldEnabled ? 'ON' : 'OFF');
    }
  }
</script>

<svelte:head>
  <title>Neural Network - Chip Firing Simulation</title>
</svelte:head>

<div class="experience-container">
  <div class="canvas-container" bind:this={canvasContainer}>
    <canvas bind:this={canvas}></canvas>
  </div>
  
  <LoadingOverlay 
    isLoading={!mounted} 
    message={loadingMessage} 
    accentColor={accentColor}
    progress={loadingProgress}
  />
  
  <div class="control-panel">
    <a href="/" class="back-button">⏎ Back</a>
    <div class="controls">
      <button 
        class="control-button" 
        class:active={showActivityMonitor}
        on:click={toggleActivityMonitor}
      >
        📊 Activity Monitor
      </button>
      <button 
        class="control-button"
        class:active={showStats}
        on:click={toggleStats}
      >
        📈 Stats
      </button>
      <button 
        class="control-button magnetic-field-button"
        class:active={experience?.magneticFieldEnabled}
        on:click={toggleMagneticField}
        title="Toggle magnetic field forces"
      >
        🧲 Field
      </button>
    </div>
  </div>
  
  {#if showStats && mounted}
    <div class="info-panel">
      <h3>Chip Firing Neural Network</h3>
      <div class="info-item">
        <span class="info-label">Nodes:</span>
        <span class="info-value">{numNodes}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Model:</span>
        <span class="info-value">Erdős-Rényi</span>
      </div>
      <div class="info-item">
        <span class="info-label">Sink:</span>
        <span class="info-value sink-indicator">● Center (Cyan)</span>
      </div>
      <div class="info-item">
        <span class="info-label">Magnetic Field:</span>
        <span class="info-value" class:field-active={experience?.magneticFieldEnabled}>
          {experience?.magneticFieldEnabled ? '🧲 Active' : '○ Inactive'}
        </span>
      </div>
      <div class="legend">
        <div class="legend-item">
          <span class="color-box inactive"></span>
          <span>Inactive</span>
        </div>
        <div class="legend-item">
          <span class="color-box active"></span>
          <span>Firing</span>
        </div>
        <div class="legend-item">
          <span class="color-box sink"></span>
          <span>Sink</span>
        </div>
      </div>
    </div>
  {/if}
  
  {#if mounted}
    <ActivityMonitor {numNodes} isVisible={showActivityMonitor} />
  {/if}
</div>

<style>
  .experience-container {
    width: 100%;
    height: 100vh;
    position: relative;
    overflow: hidden;
    background: #0a0a0a;
  }
  
  .canvas-container {
    width: 100%;
    height: 100vh;
    position: relative;
    transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  
  .control-panel {
    position: absolute;
    top: 20px;
    left: 20px;
    right: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
    pointer-events: none;
  }
  
  .control-panel > * {
    pointer-events: auto;
  }
  
  .back-button {
    padding: 10px 18px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }
  
  .back-button:hover {
    background-color: rgba(0, 0, 0, 0.85);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateX(-2px);
  }
  
  .controls {
    display: flex;
    gap: 10px;
  }
  
  .control-button {
    padding: 10px 16px;
    background-color: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s;
    backdrop-filter: blur(10px);
  }
  
  .control-button:hover {
    background-color: rgba(0, 0, 0, 0.85);
    border-color: rgba(255, 127, 0, 0.5);
    color: white;
  }
  
  .control-button.active {
    background-color: rgba(255, 127, 0, 0.2);
    border-color: rgba(255, 127, 0, 0.6);
    color: white;
  }
  
  .control-button.magnetic-field-button.active {
    background-color: rgba(147, 51, 234, 0.2);
    border-color: rgba(147, 51, 234, 0.6);
    animation: pulse-glow 2s ease-in-out infinite;
  }
  
  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 5px rgba(147, 51, 234, 0.3);
    }
    50% {
      box-shadow: 0 0 15px rgba(147, 51, 234, 0.6);
    }
  }
  
  .info-panel {
    position: absolute;
    top: 80px;
    right: 20px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 16px;
    color: white;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    z-index: 100;
    min-width: 220px;
    max-width: 280px;
  }
  
  .info-panel h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 8px;
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .info-label {
    color: rgba(255, 255, 255, 0.6);
  }
  
  .info-value {
    color: rgba(255, 255, 255, 0.95);
    font-weight: 500;
  }
  
  .sink-indicator {
    color: #00ccff;
  }
  
  .field-active {
    color: #9333ea;
  }
  
  .legend {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 11px;
  }
  
  .color-box {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .color-box.inactive {
    background: rgba(204, 51, 51, 0.3);
  }
  
  .color-box.active {
    background: rgba(255, 127, 0, 1);
  }
  
  .color-box.sink {
    background: rgba(0, 204, 255, 0.8);
  }
  
  @media (max-width: 768px) {
    .control-panel {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    
    .info-panel {
      top: auto;
      bottom: 340px;
      right: 10px;
      left: 10px;
      max-width: none;
    }
  }
</style>