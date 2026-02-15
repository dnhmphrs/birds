<script>
    import { onMount, onDestroy } from 'svelte';
    import Engine from '$lib/graphics/Engine.js';
    import WikigroundExperience from '$lib/graphics/experiences/Wikiground/WikigroundExperience.js';
    import { getCameraConfig } from '$lib/graphics/config/cameraConfigs.js';
    import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
    import { getExperienceColor } from '$lib/store/experienceStore.js';
    
    let canvas;
    let engine;
    let experience;
    let isLoading = true;
    let loadingMessage = "Initializing WebGPU...";
    let loadingProgress = -1;
    
    // Experience accent color from store
    const accentColor = getExperienceColor('wikiground');
    
    onMount(async () => {
        if (canvas && navigator.gpu) {
            // Initialize the engine with the canvas
            loadingMessage = "Initializing graphics engine...";
            loadingProgress = 20;
            engine = new Engine(canvas);
            
            // Get the Wikiground camera config
            const cameraConfig = getCameraConfig('Wikiground');
            
            // Start the Wikiground experience with the camera config
            loadingMessage = "Loading Wikiground experience...";
            loadingProgress = 40;
            const result = await engine.start(WikigroundExperience, cameraConfig);
            
            // Try to get the experience reference
            if (engine.experience) {
                experience = engine.experience;
            } else if (engine.scene && engine.scene.currentExperience) {
                experience = engine.scene.currentExperience;
            } else if (window.wikigroundExperience) {
                experience = window.wikigroundExperience;
            }
            
            // Update loading message to indicate we're finalizing
            loadingMessage = "Finalizing...";
            loadingProgress = 90;
            
            // Hide loading screen after the next frame renders
            requestAnimationFrame(() => {
                loadingProgress = 100;
                setTimeout(() => {
                    isLoading = false;
                }, 300);
            });
            
            // Handle window resize
            const handleResize = () => {
                if (engine) {
                    engine.handleResize();
                }
            };
            
            window.addEventListener('resize', handleResize);
            
            return () => {
                window.removeEventListener('resize', handleResize);
                if (engine) engine.stop();
            };
        } else if (!navigator.gpu) {
            loadingMessage = "WebGPU is not supported in your browser";
            setTimeout(() => {
                alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
            }, 1000);
        }
    });
    
    onDestroy(() => {
        if (engine) {
            engine.stop();
        }
    });
</script>

<svelte:head>
    <title>Wikiground Experience</title>
</svelte:head>

<div class="experience-container">
    <canvas bind:this={canvas} class="webgpu-canvas"></canvas>
    
    <a href="/" class="back-button">⏎ Back</a>
    
    <!-- Loading overlay -->
    <LoadingOverlay 
        isLoading={isLoading} 
        message={loadingMessage} 
        accentColor={accentColor}
        progress={loadingProgress}
    />
    
    {#if !isLoading}
    <div 
        class="control-panel"
        style="--accent: {accentColor};"
    >
        <h2>WIKIGROUND</h2>
        <p>The Earth's topograhpy. Base layer for a free and open source platform for mapping resources to the natural landscape</p>

        <div class="info">
            info to come
        </div>
         
        
        <!-- <div class="info">
            <p>This experience visualizes a sphere as a starting point for understanding watershed boundaries and flow dynamics.</p>
            <p>Future enhancements will include:</p>
            <ul>
                <li>Terrain generation with height fields</li>
                <li>Water flow simulation</li>
                <li>Watershed boundary calculation</li>
                <li>Interactive rain patterns</li>
            </ul>
        </div>
        
        <div class="controls">
            <h3>Coming Soon</h3>
            <p>Interactive controls for watershed parameters will be added in future updates.</p>
        </div> -->
    </div>
    {/if}
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
    
    .back-button {
        position: absolute;
        top: 20px;
        left: 20px;
        padding: 8px 16px;
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        text-decoration: none;
        font-family: 'Courier New', monospace;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: background-color 0.3s;
        z-index: 100;
    }
    
    .back-button:hover {
        background-color: rgba(0, 0, 0, 0.8);
    }
    
    .control-panel {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.7);
        padding: 20px;
        border-radius: 8px;
        color: white;
        z-index: 100;
        font-family: 'Courier New', monospace;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(5px);
        width: 300px;
        max-height: calc(100vh - 60px);
        overflow-y: auto;
    }
    
    .control-panel h2 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 18px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--accent, #FFDF00);
    }
    

    /* .control-panel h3 {
        font-size: 14px;
        margin: 15px 0 10px;
        color: #aaa;
    } */
    
    .control-panel p {
        margin: 0 0 15px;
        font-size: 14px;
        line-height: 1.5;
        opacity: 0.9;
    }
    
    .info {
        margin-top: 20px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
</style> 