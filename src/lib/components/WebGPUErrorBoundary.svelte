<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  // Export props for customization
  export let recoveryMessage = "The application encountered a rendering error. Please try refreshing the page.";
  export let showRecoveryButton = true;
  export let recoveryButtonText = "Restart Renderer";
  export let onRecoveryClick = null;
  
  // Local state
  let hasError = false;
  let errorMessage = "";
  let errorCount = 0;
  
  const dispatch = createEventDispatcher();
  
  // Function to detect WebGPU errors
  function handleWebGPUError(event) {
    // Check if this is a WebGPU error
    if (event.message && (
        event.message.includes('WebGPU') || 
        event.message.includes('GPU') ||
        event.message.includes('WGSL') ||
        event.message.includes('ShaderModule')
      )) {
      hasError = true;
      errorMessage = event.message;
      errorCount++;
      
      // Dispatch error event
      dispatch('webgpuerror', {
        message: errorMessage,
        count: errorCount
      });
      
      // Prevent default error handling
      event.preventDefault();
    }
  }
  
  // Recovery function
  function attemptRecovery() {
    if (typeof onRecoveryClick === 'function') {
      onRecoveryClick();
    } else {
      // Default recovery - reload the experience
      window.location.reload();
    }
    
    // Reset error state
    hasError = false;
    errorMessage = "";
  }
  
  onMount(() => {
    // Listen for WebGPU errors
    window.addEventListener('error', handleWebGPUError);
  });
  
  onDestroy(() => {
    // Remove error listeners
    window.removeEventListener('error', handleWebGPUError);
  });
</script>

{#if hasError}
  <div class="error-overlay">
    <div class="error-container">
      <h2>Rendering Error Detected</h2>
      <p>{recoveryMessage}</p>
      
      {#if errorMessage}
        <div class="error-details">
          <p>Error details:</p>
          <pre>{errorMessage}</pre>
        </div>
      {/if}
      
      {#if showRecoveryButton}
        <button class="recovery-button" on:click={attemptRecovery}>
          {recoveryButtonText}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .error-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .error-container {
    background-color: #fff;
    border-radius: 8px;
    padding: 20px;
    max-width: 80%;
    max-height: 80%;
    overflow: auto;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  }
  
  h2 {
    color: #d32f2f;
    margin-top: 0;
  }
  
  .error-details {
    margin-top: 15px;
    border-top: 1px solid #eee;
    padding-top: 15px;
  }
  
  pre {
    background-color: #f5f5f5;
    padding: 10px;
    border-radius: 4px;
    overflow: auto;
    max-height: 200px;
    font-size: 12px;
  }
  
  .recovery-button {
    background-color: #2196f3;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 15px;
    font-weight: bold;
  }
  
  .recovery-button:hover {
    background-color: #1976d2;
  }
</style> 