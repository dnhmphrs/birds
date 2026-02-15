<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import FlockingExperience from '$lib/graphics/experiences/Flocking/FlockingExperience.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import { getExperienceColor } from '$lib/store/experienceStore.js';
  
  let canvas;
  let engine;
  let mounted = false;
  let loadingMessage = "Initializing WebGPU...";
  let loadingProgress = -1;
  
  // Experience accent color from store
  const accentColor = getExperienceColor('flocking');
  
  onMount(async () => {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      return;
    }
    
    // Initialize the engine with the canvas
    loadingMessage = "Initializing graphics engine...";
    loadingProgress = 30;
    engine = new Engine(canvas);
    
    // Start the Flocking experience with camera config
    loadingMessage = "Loading Flocking simulation...";
    loadingProgress = 60;
    await engine.start(FlockingExperience, getCameraConfig('Flocking'));
    
    loadingMessage = "Finalizing...";
    loadingProgress = 90;
    
    // Hide loading screen after a short delay
    setTimeout(() => {
      loadingProgress = 100;
      setTimeout(() => {
        mounted = true;
      }, 300);
    }, 500);
    
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
      if (engine) {
        engine.cleanup();
      }
    };
  });
  
  onDestroy(() => {
    if (engine) {
      engine.cleanup();
    }
  });
</script>

<svelte:head>
  <title>Flocking Simulation</title>
</svelte:head>

<div class="music">
  <iframe title="music" style="border: 0; width: 100%; height: 42px;" src="https://bandcamp.com/EmbeddedPlayer/album=1967289637/size=small/bgcol=333333/linkcol=ffffff/track=2440001588/transparent=true/" seamless><a href="https://masayoshifujita.bandcamp.com/album/bird-ambience">Bird Ambience by Masayoshi Fujita</a></iframe>
</div>

<div class="predator-pov">
  <p>predator pov: periodic re-target</p>
</div>

<div class="experience-container">
  <canvas bind:this={canvas}></canvas>
  
  <LoadingOverlay 
    isLoading={!mounted} 
    message={loadingMessage} 
    accentColor={accentColor}
    progress={loadingProgress}
  />
  
  <a href="/" class="back-button">⏎ Back</a>
</div>

<style>
  .experience-container {
    width: 100%;
    height: 100vh;
    position: relative;
    overflow: hidden;
  }
  
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .music {
    position: absolute;
    z-index: 1;
    right: 0px;
  }

  .predator-pov {
    position: absolute;
    z-index: 1;
    bottom: 10px;
    left: 10px;
    border: solid 1px var(--primary);
    width: 330px;
    height: 330px;
    padding: 10px;
    border-radius: 4px;
  }

  .predator-pov p {
    font-size: 13.7px;
  }
  
  .back-button {
    position: absolute;
    top: 20px;
    left: 20px;
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.3s;
    z-index: 100;
  }
  
  .back-button:hover {
    background-color: rgba(0, 0, 0, 0.9);
  }
</style> 