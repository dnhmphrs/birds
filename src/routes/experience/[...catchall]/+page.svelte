<script>
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  export let data;
  
  let canvas;
  let engine;
  let mounted = false;
  
  onMount(async () => {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
      return;
    }
    
    try {
      // Initialize the engine with the canvas
      engine = new Engine(canvas);
      
      // Dynamically import the experience
      const experienceModule = await import(`../../../lib/graphics/experiences/${data.experience}/${data.experience}Experience.js`);
      const Experience = experienceModule.default;
      
      // Start the experience with camera config
      await engine.start(Experience, getCameraConfig(data.experience));
      
      mounted = true;
      
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
    } catch (error) {
      console.error(`Error loading ${data.experience} experience:`, error);
      alert(`Failed to load experience: ${error.message}`);
    }
  });
  
  onDestroy(() => {
    if (engine) {
      engine.cleanup();
    }
  });
</script>

<svelte:head>
  <title>{data.experience} Experience</title>
</svelte:head>

<div class="error-container">
  <h2>Experience Not Found</h2>
  <p>The experience "{$page.params.catchall}" doesn't exist or is not available.</p>
  <a href="/">Return to Home</a>
</div>

{#if !data.experience}
  <div class="error-container">
    <h2>Experience Not Found</h2>
    <p>The experience "{$page.params.catchall}" doesn't exist or is not available.</p>
    <a href="/">Return to Home</a>
  </div>
{:else}
  <div class="experience-container">
    <canvas bind:this={canvas}></canvas>
    
    {#if !mounted}
      <div class="loading">
        <p>Loading {data.experience} Experience...</p>
      </div>
    {/if}
    
    <a href="/" class="back-button">Back to Home</a>
  </div>
{/if}

<style>
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    padding: 2rem;
  }
  
  .error-container a {
    margin-top: 2rem;
    padding: 0.75rem 1.5rem;
    background-color: #ffffff;
    color: white;
    text-decoration: none;
    border-radius: 0.25rem;
    transition: background-color 0.2s;
  }
  
  .error-container a:hover {
    background-color: #2d3748;
  }

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
  
  .loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 1.5rem;
  }
  
  .back-button {
    position: absolute;
    top: 20px;
    left: 20px;
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.3s;
    z-index: 100;
  }
  
  .back-button:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }
</style> 