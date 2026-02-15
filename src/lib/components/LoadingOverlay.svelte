<!-- 
  LoadingOverlay.svelte
  A reusable loading overlay component that adapts to the experience color
-->
<script>
  // Props
  export let isLoading = true; // Whether the loading overlay should be shown
  export let message = "Loading..."; // The loading message to display
  export let accentColor = "#00ffff"; // Default accent color (cyan)
  export let progress = -1; // Progress value (-1 for indeterminate)
  
  // Parse the accent color to get RGB values for rgba()
  $: accentColorRGB = parseColor(accentColor);
  
  // Function to parse hex color to RGB
  function parseColor(color) {
    // Default fallback
    let r = 0, g = 255, b = 255;
    
    // Remove # if present
    if (color.startsWith('#')) {
      color = color.substring(1);
    }
    
    // Parse hex color
    if (color.length === 6) {
      r = parseInt(color.substring(0, 2), 16);
      g = parseInt(color.substring(2, 4), 16);
      b = parseInt(color.substring(4, 6), 16);
    } else if (color.length === 3) {
      r = parseInt(color.charAt(0) + color.charAt(0), 16);
      g = parseInt(color.charAt(1) + color.charAt(1), 16);
      b = parseInt(color.charAt(2) + color.charAt(2), 16);
    }
    
    return `${r}, ${g}, ${b}`;
  }
</script>

{#if isLoading}
<div class="loading-overlay" style="--accent-color: {accentColor}; --accent-color-rgb: {accentColorRGB};">
  <div class="loading-spinner"></div>
  <div class="loading-text">{message}</div>
  
  {#if progress >= 0}
    <div class="loading-progress-container">
      <div class="loading-progress-bar" style="width: {progress}%;"></div>
    </div>
  {/if}
</div>
{/if}

<style>
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 3px solid rgba(var(--accent-color-rgb), 0.3);
    border-radius: 50%;
    border-top-color: var(--accent-color);
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 20px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .loading-text {
    color: var(--accent-color);
    font-family: 'Courier New', monospace;
    font-size: 16px;
    text-align: center;
    margin-bottom: 20px;
  }
  
  .loading-progress-container {
    width: 200px;
    height: 4px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .loading-progress-bar {
    height: 100%;
    background-color: var(--accent-color);
    transition: width 0.3s ease;
  }
</style> 