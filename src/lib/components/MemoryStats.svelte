<script>
  import { onMount, onDestroy } from 'svelte';
  import { getMemoryStats, formatBytes } from '$lib/graphics/utils/MemoryManager.js';
  import { page } from '$app/stores';
  import VideoRecorder from './VideoRecorder.svelte';
  
  // Props
  export let showResourceCounts = false;
  
  // Memory usage state
  let memoryUsage = { current: 0, peak: 0 };
  let memoryMonitorInterval;
  let resourceCounts = { buffers: 0, textures: 0, total: 0 };
  let memoryWarning = false;
  let throttleCount = 0;
  
  // Leak detection variables
  let memoryHistory = [];
  let leakDetected = false;
  let leakGrowthRate = 0;
  let subtleLeakDetected = false;
  let consistentGrowthCount = 0;
  
  // Check if we're on the homepage
  $: isHomepage = $page && $page.url.pathname === '/';
  
  // Calculate usage percentage
  $: memUsagePercent = typeof window !== 'undefined' && window.performance && window.performance.memory ? 
    Math.round((memoryUsage.current / window.performance.memory.jsHeapSizeLimit) * 100) : 0;
  
  // Determine warning status (increased threshold)
  $: isHighMemory = memUsagePercent > 85; // Warn at 85%, but don't throttle until 90%
  
  // Handle memory warning event
  function handleMemoryWarning(event) {
    memoryWarning = true;
    throttleCount++;
    
    // Auto-reset warning after 5 seconds
    setTimeout(() => {
      memoryWarning = false;
    }, 5000);
  }
  
  // Function to detect memory leaks - both sudden and subtle
  function checkForMemoryLeak(currentMem) {
    // Add current memory to history with timestamp
    memoryHistory.push({
      timestamp: Date.now(),
      value: currentMem
    });
    
    // Keep history to a reasonable size
    if (memoryHistory.length > 20) { // Increased from 10 to 20 for better trend analysis
      memoryHistory.shift();
    }
    
    // First check: Growth rate over time (medium term)
    if (memoryHistory.length >= 5) {
      // Calculate growth rate (MB per minute)
      const oldestSample = memoryHistory[0];
      const newestSample = memoryHistory[memoryHistory.length - 1];
      
      const memoryDiff = newestSample.value - oldestSample.value;
      const timeDiffMinutes = (newestSample.timestamp - oldestSample.timestamp) / (1000 * 60);
      
      // Calculate the growth rate in MB per minute
      const growthRate = (memoryDiff / (1024 * 1024)) / timeDiffMinutes;
      leakGrowthRate = Math.round(growthRate * 10) / 10;
      
      // A major leak is indicated by consistent growth over time
      leakDetected = growthRate > 20; // Increased from 15 MB/min to 20 MB/min
    }
    
    // Second check: Consistent small growth (subtle leak)
    if (memoryHistory.length >= 10) {
      let growingSegments = 0;
      
      // Check the last 9 segments
      for (let i = 1; i < memoryHistory.length; i++) {
        if (memoryHistory[i].value > memoryHistory[i-1].value + 1024*1024) { // 1MB growth
          growingSegments++;
        }
      }
      
      // If 7+ out of 9 segments show growth, we likely have a subtle leak
      const newSubtleLeakDetected = growingSegments >= 7;
      
      // If we just detected a subtle leak, increment the counter
      if (newSubtleLeakDetected && !subtleLeakDetected) {
        consistentGrowthCount++;
      }
      
      subtleLeakDetected = newSubtleLeakDetected;
    }
  }
  
  // Function to monitor memory usage
  function startMemoryMonitoring() {
    if (typeof window.performance !== 'undefined' && window.performance.memory) {
      // Listen for memory warning events from Engine
      window.addEventListener('memory-warning', handleMemoryWarning);
      
      memoryMonitorInterval = setInterval(() => {
        const currentUsage = window.performance.memory.usedJSHeapSize;
        memoryUsage.current = currentUsage;
        memoryUsage.peak = Math.max(memoryUsage.peak, currentUsage);
        
        // Check for memory leaks
        checkForMemoryLeak(currentUsage);
        
        // Get resource counts from MemoryManager
        const stats = getMemoryStats();
        if (stats && stats.resourceCounts) {
          resourceCounts = stats.resourceCounts;
        }
      }, 2000); // Check every 2 seconds
    }
  }
  
  onMount(() => {
    // Start memory monitoring
    startMemoryMonitoring();
  });
  
  onDestroy(() => {
    // Stop memory monitoring
    if (memoryMonitorInterval) {
      clearInterval(memoryMonitorInterval);
      memoryMonitorInterval = null;
    }
    
    // Remove event listener
    window.removeEventListener('memory-warning', handleMemoryWarning);
  });
</script>

{#if !isHomepage}
<div class="memory-stats" class:warning={isHighMemory} class:throttling={memoryWarning} 
     class:leak={leakDetected} class:subtle-leak={subtleLeakDetected && !leakDetected}>
  <div>Memory: {formatBytes(memoryUsage.current)} ({memUsagePercent}%)</div>
  <div>Peak: {formatBytes(memoryUsage.peak)}</div>
  {#if window.performance && window.performance.memory}
  <div>Limit: {formatBytes(window.performance.memory.jsHeapSizeLimit)}</div>
  {/if}
  
  {#if leakDetected}
    <div class="memory-alert leak-alert">
      Memory leak: {leakGrowthRate} MB/min
    </div>
  {/if}
  
  {#if subtleLeakDetected && !leakDetected}
    <div class="memory-alert subtle-leak-alert">
      Subtle leak detected ({consistentGrowthCount})
    </div>
  {/if}
  
  {#if memoryWarning}
    <div class="memory-alert">
      Throttling rendering - High memory usage ({throttleCount})
    </div>
  {/if}
  
  <!-- Additional resource stats from MemoryManager -->
  {#if showResourceCounts && resourceCounts}
    <div class="resource-counts">
      <div>Buffers: {resourceCounts.buffers}</div>
      <div>Textures: {resourceCounts.textures}</div>
      <div>Total: {resourceCounts.total}</div>
    </div>
  {/if}
  
  <!-- Video recorder component -->
  <VideoRecorder />
</div>
{/if}

<style>
  .memory-stats {
    position: fixed;
    bottom: 10px;
    left: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 4px;
    z-index: 100;
    transition: background-color 0.3s ease;
  }
  
  .warning {
    background-color: rgba(255, 150, 0, 0.8);
    color: black;
  }
  
  .throttling {
    background-color: rgba(255, 50, 50, 0.9);
    color: white;
    animation: pulse 1s infinite;
  }
  
  .leak {
    background-color: rgba(200, 50, 255, 0.9);
    color: white;
    animation: pulse 2s infinite;
  }
  
  .subtle-leak {
    background-color: rgba(120, 80, 200, 0.7);
    color: white;
    animation: pulse 4s infinite;
  }
  
  .leak-alert {
    border-top: 2px solid yellow;
  }
  
  .subtle-leak-alert {
    border-top: 1px dashed yellow;
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
  }
  
  .memory-alert {
    font-weight: bold;
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid white;
  }
  
  .resource-counts {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid rgba(255, 255, 255, 0.3);
  }
</style> 