<script>
  import { onMount, onDestroy } from 'svelte';
  import Engine from '$lib/graphics/Engine.js';
  import HomeBackgroundExperience from '$lib/graphics/experiences/Home/HomeBackgroundExperience.js';
  import { experiences } from '$lib/store/experienceStore.js';
  // import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
  
  let selectedExp = null;
  let mounted = false;
  let canvas;
  let engine;
  let backgroundLoaded = false;
  
  onMount(() => {
    mounted = true;
    
    // Simulate background loading
    setTimeout(() => {
      backgroundLoaded = true;
    }, 500);
  });
  
  onMount(async () => {
    // Terminal typing effect
    const terminalText = document.querySelector('.terminal-text');
    if (terminalText) {
      const text = terminalText.textContent;
      terminalText.textContent = '';
      let i = 0;
      const typeWriter = () => {
        if (i < text.length) {
          terminalText.textContent += text.charAt(i);
          i++;
          setTimeout(typeWriter, Math.random() * 50 + 20);
        }
      };
      typeWriter();
    }
    
    // Initialize WebGPU background
    if (canvas && navigator.gpu) {
      try {
        // Initialize the engine with the canvas
        engine = new Engine(canvas);
        
        // Start the background experience
        await engine.start(HomeBackgroundExperience);
        
        backgroundLoaded = true;
      } catch (error) {
        console.error("Error initializing background shader:", error);
        backgroundLoaded = true; // Still mark as loaded to avoid blocking UI
      }
    } else {
      console.warn("WebGPU is not available, skipping background initialization");
      // No WebGPU support, just mark as loaded
      backgroundLoaded = true;
    }
  });
  
  onDestroy(() => {
    // Clean up engine when component is destroyed
    if (engine) {
      engine.stop();
    }
  });
</script>

<svelte:head>
  <title>WebGPU Experiences</title>
  <meta name="description" content="A collection of interactive WebGPU experiences" />
</svelte:head>

<div class="background-canvas">
  <canvas bind:this={canvas}></canvas>
</div>

<div class="container {mounted && backgroundLoaded ? 'loaded' : ''}">
  <header>
    <div class="terminal">
      <div class="terminal-header">
        <span class="terminal-title">webgpu_experiences.exe</span>
        <div class="terminal-buttons">
          <span class="terminal-button"></span>
          <span class="terminal-button"></span>
          <span class="terminal-button"></span>
        </div>
      </div>
      <div class="terminal-body">
        <p class="terminal-text">
          > INITIALIZING WEBGPU EXPERIENCES...<br>
          > LOADING MODULES...<br>
          > SYSTEM READY.
        </p>
      </div>
    </div>
  </header>

  <main>
    <div class="experience-grid">
      {#each $experiences as exp, i}
        <div 
          class="experience-item" 
          on:mouseenter={() => selectedExp = exp}
          on:mouseleave={() => selectedExp = null}
          style="--delay: {i * 150}ms; --accent: {exp.color};"
        >
          <a href="/experience/{exp.id}" class="experience-link">
            <span class="experience-index">[{i + 1}]</span>
            <span class="experience-name">{exp.name}</span>
            <span class="experience-arrow">→</span>
          </a>
        </div>
      {/each}
    </div>
    
    <div class="preview-panel">
      {#if selectedExp}
        <div class="preview-content" style="--accent: {selectedExp.color};">
          <div class="preview-ascii">
            {#if selectedExp.id === 'flocking'}
              <pre class="ascii-art">
      /^v^\         /^v^\
                          
         /^v^\
                /^v^\
   
        /^v^\
  
  FLOCKING / HUNTING
              </pre>
            {:else if selectedExp.id === 'neuralnet'}
              <pre class="ascii-art">
  o---o---o       o---o---o       o---o---o
 /|\ /|\ /|\     /|\ /|\ /|\     /|\ /|\ /|\
o---o---o---o   o---o---o---o   o---o---o---o
 \|/ \|/ \|/     \|/ \|/ \|/     \|/ \|/ \|/
  o---o---o       o---o---o       o---o---o
  
  NEURAL NET
              </pre>
            {:else if selectedExp.id === 'riemann'}
              <pre class="ascii-art">
  .-.       .-.       .-.
 /   \     /   \     /   \
(     )---(     )---(     )
 \   /     \   /     \   /
  '-'       '-'       '-'
  
  RIEMANN SURFACES
              </pre>
            {:else if selectedExp.id === 'wikiground'}
              <pre class="ascii-art">
  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
      ~ ~ ~ ~ ~ ~ ~
    ~ ~ ~ ~ ~ ~ ~ ~ ~
  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
      ~ ~ ~ ~ ~ ~ ~
    ~ ~ ~ ~ ~ ~ ~ ~ ~
  
  WIKIGROUND
              </pre>
            {:else if selectedExp.id === 'gridcode'}
              <pre class="ascii-art">
   ⬡     ⬡     ⬡     ⬡  
 ⬡     ⬡     ⬡     ⬡     ⬡
   ⬡     ⬡     ⬡     ⬡  
 ⬡     ⬡     ⬡     ⬡     ⬡
   ⬡     ⬡     ⬡     ⬡  
  
  GRID CODE
              </pre>
            {:else}
              <pre class="ascii-art">
  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █             █
  █    WEBGPU   █
  █             █
  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
  
  EXPERIENCE
              </pre>
            {/if}
            <div class="scan-line"></div>
          </div>
          <div class="preview-info">
            <h2>{selectedExp.name}</h2>
            <p>{selectedExp.description}</p>
          </div>
        </div>
      {:else}
        <div class="preview-placeholder">
          <pre class="ascii-art placeholder-ascii">



[ select experience ]



          </pre>
        </div>
      {/if}
    </div>
  </main>
  
  <footer>
    <div class="footer-text">
      [2025] <a href="https://aufbau.io" class="company-link">AUFBAU</a> WEBGPU EXPERIMENTS // SYSTEM V1.0
    </div>
  </footer>
</div>

<style>
  @font-face {
    font-family: 'VT323';
    src: url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
  }
  
  :global(body) {
    background-color: transparent;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    opacity: 0;
    transition: opacity 0.5s ease;
    background-color: rgba(0, 0, 0, 0.5);
  }
  
  .loaded {
    opacity: 1;
  }
  
  .terminal {
    border: 1px solid #00ff00;
    margin-bottom: 2rem;
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
  }
  
  .terminal-header {
    background-color: #000;
    border-bottom: 1px solid #00ff00;
    padding: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .terminal-title {
    color: #00ff00;
    font-weight: bold;
  }
  
  .terminal-buttons {
    display: flex;
    gap: 5px;
  }
  
  .terminal-button {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #333;
    border: 1px solid #00ff00;
  }
  
  .terminal-body {
    padding: 1rem;
    background-color: #000;
    color: #00ff00;
    font-family: 'Courier New', monospace;
  }
  
  .terminal-text {
    margin: 0;
    line-height: 1.5;
  }
  
  main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
  
  .experience-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .experience-item {
    border: 1px solid var(--accent, #00ff00);
    background-color: rgba(0, 0, 0, 0.8);
    transition: all 0.3s ease;
    animation: fadeIn 0.5s ease forwards;
    animation-delay: var(--delay);
    opacity: 0;
  }
  
  .experience-item:hover {
    background-color: rgba(0, 0, 0, 0.9);
    transform: translateX(5px);
    box-shadow: -5px 0 0 var(--accent, #00ff00);
  }
  
  .experience-link {
    display: flex;
    padding: 1rem;
    text-decoration: none;
    color: var(--accent, #00ff00);
    justify-content: space-between;
    align-items: center;
  }
  
  .experience-index {
    font-size: 0.8rem;
    opacity: 0.7;
  }
  
  .experience-name {
    font-weight: bold;
    letter-spacing: 2px;
  }
  
  .experience-arrow {
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  
  .experience-item:hover .experience-arrow {
    opacity: 1;
    transform: translateX(5px);
  }
  
  .preview-panel {
    border: 1px solid #00ff00;
    height: 350px;
    position: relative;
    overflow: hidden;
    display: flex;
  }
  
  .preview-content {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .preview-ascii {
    flex: 1;
    position: relative;
    overflow: hidden;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 220px;
    padding: 20px;
    text-align: center;
  }
  
  .ascii-art {
    font-family: 'Courier New', monospace;
    color: var(--accent, #00ff00);
    text-align: center;
    line-height: 1.5;
    margin: 0 auto;
    font-size: 15px;
    white-space: pre;
    animation: pulse 3s infinite alternate;
    letter-spacing: 0;
    text-shadow: 0 0 5px var(--accent, #00ff00);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
  }
  
  .placeholder-ascii {
    color: #00ff00;
    opacity: 0.7;
    animation: blink 1s step-end infinite;
    font-size: 18px;
    letter-spacing: 2px;
    text-transform: lowercase;
  }
  
  .scan-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: rgba(0, 255, 0, 0.5);
    animation: scanLine 2s linear infinite;
  }
  
  .preview-info {
    padding: 1rem;
    background-color: #000;
    border-top: 1px solid var(--accent, #00ff00);
    min-height: 100px;
    display: flex;
    flex-direction: column;
  }
  
  .preview-info h2 {
    margin: 0 0 0.5rem 0;
    color: var(--accent, #00ff00);
  }
  
  .preview-info p {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    opacity: 0.8;
    flex: 1;
  }
  
  .preview-placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
    background-color: rgba(0, 0, 0, 0.8);
  }
  
  footer {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.8;
    letter-spacing: 1px;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes scanLine {
    0% {
      top: 0%;
    }
    100% {
      top: 100%;
    }
  }
  
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  
  @keyframes pulse {
    0% { opacity: 0.7; }
    100% { opacity: 1; }
  }
  
  @media (max-width: 768px) {
    main {
      grid-template-columns: 1fr;
    }
    
    .preview-panel {
      min-height: 200px;
    }
  }
  
  /* Add styles for the background canvas */
  .background-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    opacity: 0.8;
  }
  
  .background-canvas canvas {
    width: 100%;
    height: 100%;
  }
  
  .company-link {
    color: #00ff00;
    text-decoration: none;
    position: relative;
    transition: all 0.3s ease;
  }
</style>

