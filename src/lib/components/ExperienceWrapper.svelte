<!-- 
  ExperienceWrapper.svelte
  A common wrapper component for all WebGPU experiences that handles memory management
-->
<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { page } from '$app/stores';
  import Engine from '$lib/graphics/Engine.js';
  import LoadingOverlay from './LoadingOverlay.svelte';
  import { getExperienceColor } from '$lib/store/experienceStore.js';
  
  // Props
  export let experienceClass; // The experience class to instantiate
  export let cameraConfig = {}; // Camera configuration
  export let accentColor = null; // Optional override for accent color
  
  // Get experience ID from class name
  $: experienceId = experienceClass?.name?.toLowerCase().replace('experience', '') || '';
  
  // Get accent color from store if not provided
  $: effectiveAccentColor = accentColor || getExperienceColor(experienceId);
  
  // Internal state
  let canvas;
  let engine;
  let experience;
  let isLoading = true;
  let loadingMessage = "Initializing WebGPU...";
  let loadingProgress = -1; // -1 means indeterminate
  let currentPath;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Function to handle loading state updates from the experience
  function handleLoadingUpdate(event) {
    const { experience: expName, isLoading: expIsLoading, message, progress } = event.detail;
    
    // Only update if it's from our current experience
    if (experience && experience.name === expName) {
      loadingMessage = message;
      loadingProgress = progress;
      
      // If the experience says it's done loading, wait a short delay then hide the loading screen
      if (!expIsLoading && isLoading) {
        loadingProgress = 100;
        setTimeout(() => {
          isLoading = false;
          dispatch('loaded');
        }, 300);
      } else if (expIsLoading && !isLoading) {
        // If the experience says it's loading but we're not showing the loading screen, show it
        isLoading = true;
      }
    }
  }
  
  // Watch for route changes to trigger cleanup
  $: if (page && $page.url.pathname !== currentPath) {
    currentPath = $page.url.pathname;
    if (engine && !isLoading) {
      // Set loading state while cleaning up
      isLoading = true;
      loadingMessage = "Cleaning up resources...";
      
      // Force cleanup and wait before allowing new experience to load
      forceCleanup();
      
      // Add a short delay to ensure resources are properly released
      setTimeout(() => {
        // Now the new route can load its experience
        isLoading = false;
      }, 300);
    }
  }
  
  onMount(async () => {
    // Store initial path
    if (page) {
      currentPath = $page.url.pathname;
    }
    
    // Add event listener for loading state updates
    window.addEventListener('experience-loading-update', handleLoadingUpdate);
    
    if (canvas && navigator.gpu) {
      // Initialize the engine with the canvas
      loadingMessage = "Initializing graphics engine...";
      loadingProgress = 30;
      engine = new Engine(canvas);
      
      // Start the experience with the camera config
      loadingMessage = `Loading ${experienceClass.name} experience...`;
      loadingProgress = 40;
      experience = await engine.start(experienceClass, cameraConfig);
      
      // Dispatch the experience ready event
      dispatch('ready', { engine, experience });
      
      // Update loading message to indicate we're finalizing
      loadingMessage = "Finalizing...";
      loadingProgress = 90;
      
      // Hide loading screen immediately after the next frame renders
      requestAnimationFrame(() => {
        loadingProgress = 100;
        setTimeout(() => {
          isLoading = false;
          dispatch('loaded');
        }, 300); // Short delay to show 100% progress
      });
      
      // Handle window resize
      const handleResize = () => {
        if (engine) {
          try {
            engine.handleResize();
          } catch (error) {
            console.warn("Error during resize:", error);
          }
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('experience-loading-update', handleLoadingUpdate);
        
        // First remove any global references
        if (window.currentExperience) {
          window.currentExperience = null;
        }
        
        // Then stop the engine which will trigger all cleanup
        if (engine) {
          engine.stop();
          engine = null;
        }
        
        // Clear experience reference
        if (experience) {
          experience = null;
        }
        
        // Force garbage collection if available
        if (window.gc) {
          window.gc();
        }
        
        // Dispatch cleanup event
        dispatch('cleanup');
      };
    } else if (!navigator.gpu) {
      loadingMessage = "WebGPU is not supported in your browser";
      dispatch('error', { message: "WebGPU is not supported in your browser" });
      setTimeout(() => {
        alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      }, 1000);
    }
  });
  
  onDestroy(() => {
    window.removeEventListener('experience-loading-update', handleLoadingUpdate);
  });
  
  // Function to get the current engine instance
  export function getEngine() {
    return engine;
  }
  
  // Function to get the current experience instance
  export function getExperience() {
    return experience;
  }
  
  // Function to force garbage collection
  export function forceCleanup() {
    if (engine) {
      // First try to explicitly clean up the current experience
      if (experience && typeof experience.cleanup === 'function') {
        experience.cleanup();
      }
      
      // Then use the engine's garbage collection
      engine.performGarbageCollection();
      
      // Force a double garbage collection after a short delay
      setTimeout(() => {
        engine.performGarbageCollection();
      }, 100);
      
      return true;
    }
    return false;
  }
</script>

<div class="experience-container">
  <canvas bind:this={canvas} class="webgpu-canvas"></canvas>
  
  <!-- Loading overlay -->
  <LoadingOverlay 
    isLoading={isLoading} 
    message={loadingMessage} 
    accentColor={effectiveAccentColor}
    progress={loadingProgress}
  />
  
  <!-- Slot for experience-specific UI -->
  <slot {engine} {experience} {isLoading}></slot>
</div>

<style>
  .experience-container {
    width: 100%;
    height: 100vh;
    position: relative;
    overflow: hidden;
    background-color: #000;
  }
  
  .webgpu-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style> 