<script>
  import { onMount, onDestroy } from 'svelte';
  import { formatBytes } from '$lib/graphics/utils/MemoryManager.js';
  
  // Video capture state
  let showCapturePopup = false;
  let captureDuration = 5; // Default 5 seconds
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;
  let recordingProgress = 0;
  let recordingTimer = null;
  let recordingStartTime = 0;
  let processingChunks = false;
  let maxChunkSize = 50 * 1024 * 1024; // 50MB max chunk size
  let maxTotalSize = 500 * 1024 * 1024; // 500MB max total size
  let totalRecordedSize = 0;
  let memoryWarning = false;
  
  // Quality presets for different recording modes
  const qualityPresets = {
    low: {
      fps: 24,
      bitrate: 8000000, // 8 Mbps
      fallbackBitrate: 5000000, // 5 Mbps
      lossless: false,
      dataInterval: 250 // More frequent chunks for better memory management
    },
    medium: {
      fps: 30,
      bitrate: 20000000, // 20 Mbps
      fallbackBitrate: 12000000, // 12 Mbps
      lossless: true,
      dataInterval: 500
    },
    high: {
      fps: 60,
      bitrate: 40000000, // 40 Mbps (lossless)
      fallbackBitrate: 25000000, // 25 Mbps
      lossless: true,
      dataInterval: 500
    }
  };
  
  // Default to medium quality
  let captureQuality = 'medium';
  
  // Function to toggle capture popup
  function toggleCapturePopup() {
    showCapturePopup = !showCapturePopup;
  }
  
  // Function to find the best canvas for capture
  function findCanvas() {
    // Try multiple selectors to find the canvas
    let canvas = document.querySelector('canvas.webgpu-canvas');
    
    // If not found, try other common selectors
    if (!canvas) {
      canvas = document.querySelector('.experience-container canvas');
    }
    
    // If still not found, try any canvas in the document
    if (!canvas) {
      const canvases = document.querySelectorAll('canvas');
      if (canvases.length > 0) {
        // Use the largest canvas by area as it's likely the main experience canvas
        let largestArea = 0;
        for (const c of canvases) {
          const area = c.width * c.height;
          if (area > largestArea) {
            largestArea = area;
            canvas = c;
          }
        }
      }
    }
    
    return canvas;
  }
  
  // Function to create a media recorder with optimal settings
  function createMediaRecorder(stream) {
    // Get quality settings based on selected preset
    const quality = qualityPresets[captureQuality];
    
    // Default options with high quality settings
    const options = { 
      mimeType: 'video/webm;codecs=vp9', // Use VP9 codec for better quality
      videoBitsPerSecond: quality.bitrate
    };
    
    // Try different lossless or near-lossless codec options
    const losslessOptions = [
      'video/webm;codecs=vp9.0 profile=3', // VP9 lossless profile
      'video/webm;codecs=vp9.2', // VP9 Profile 2 (10-bit)
      'video/webm;codecs=vp9'
    ];
    
    // Find the first supported lossless codec
    for (const codec of losslessOptions) {
      if (MediaRecorder.isTypeSupported(codec)) {
        options.mimeType = codec;
        break;
      }
    }
    
    // Fall back to standard options if preferred codec is not supported
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.warn(`Lossless codec not supported, falling back to standard WebM`);
      return new MediaRecorder(stream, { 
        mimeType: 'video/webm',
        videoBitsPerSecond: quality.fallbackBitrate
      });
    } else {
      return new MediaRecorder(stream, options);
    }
  }
  
  // Function to update the recording progress display
  function updateRecordingProgress() {
    const elapsed = (Date.now() - recordingStartTime) / 1000;
    
    // Calculate progress based on the requested duration, not the actual buffered duration
    // This ensures the progress bar reaches 100% at the requested duration
    recordingProgress = Math.min(100, (elapsed / captureDuration) * 100);
    
    // Show memory warning if we're using more than 60% of total allowed size
    memoryWarning = totalRecordedSize > (maxTotalSize * 0.6);
  }
  
  // Function to start video capture
  async function startCapture() {
    try {
      // Find the canvas
      const canvas = findCanvas();
      if (!canvas) {
        console.error('No canvas found for capture');
        return;
      }
      
      // Get the actual canvas dimensions for high-resolution capture
      const width = canvas.width || canvas.clientWidth;
      const height = canvas.height || canvas.clientHeight;
      
      // Get quality settings
      const quality = qualityPresets[captureQuality];
      
      // Add a small buffer to ensure we capture the full requested duration
      const actualDuration = captureDuration + 0.5; // Add 0.5 seconds buffer
      
      // For all quality levels, try to use the canvas directly without scaling
      let stream;
      try {
        // Handle OffscreenCanvas specially
        if (canvas instanceof OffscreenCanvas) {
          const tempCanvas = document.createElement('canvas');
          
          // For low quality, use a smaller canvas
          if (captureQuality === 'low' && width > 1280) {
            const aspectRatio = width / height;
            tempCanvas.height = 720;
            tempCanvas.width = Math.round(720 * aspectRatio);
          } else {
            tempCanvas.width = width;
            tempCanvas.height = height;
          }
          
          // Set up a render loop to copy from the offscreen canvas
          const ctx = tempCanvas.getContext('2d');
          ctx.imageSmoothingQuality = captureQuality === 'low' ? 'medium' : 'high';
          
          const renderLoop = () => {
            if (!isRecording) return;
            ctx.drawImage(canvas, 0, 0, width, height, 
                         0, 0, tempCanvas.width, tempCanvas.height);
            requestAnimationFrame(renderLoop);
          };
          
          renderLoop();
          stream = tempCanvas.captureStream(quality.fps);
        } else {
          // For regular canvas, use our optimization function
          stream = optimizeCanvasForRecording(canvas, quality);
        }
      } catch (e) {
        console.warn(`Failed to capture at ${captureQuality} quality, falling back:`, e);
        stream = canvas.captureStream(quality.fps);
      }
      
      // Reset recording state
      recordedChunks = [];
      totalRecordedSize = 0;
      isRecording = true;
      recordingProgress = 0;
      processingChunks = false;
      
      // Create a single MediaRecorder for the entire duration
      mediaRecorder = createMediaRecorder(stream);
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          // Check if we're approaching memory limits
          totalRecordedSize += event.data.size;
          
          recordedChunks.push(event.data);
          
          // Check for memory pressure after adding new chunk
          checkMemoryPressure();
          
          // If individual chunk is too large, process it immediately
          if (event.data.size > maxChunkSize && !processingChunks) {
            processLargeChunks();
          }
        }
      };
      
      mediaRecorder.onstop = () => {
        finalizeRecording(width, height, stream);
      };
      
      // For all quality levels, use the data interval from the preset
      const dataInterval = quality.dataInterval || 500;
      
      // Start recording with appropriate data collection frequency
      mediaRecorder.start(dataInterval);
      
      // Store start time
      recordingStartTime = Date.now();
      
      // Start a timer to update the progress display
      recordingTimer = setInterval(() => {
        updateRecordingProgress();
        
        // Check for memory pressure
        checkMemoryPressure();
      }, 100);
      
      // Schedule the stop after the specified duration (with buffer)
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          stopRecording();
        }
      }, actualDuration * 1000);
      
      // Close the popup
      showCapturePopup = false;
    } catch (error) {
      console.error('Error starting capture:', error);
      isRecording = false;
      recordingProgress = 0;
    }
  }
  
  // Function to stop recording safely
  function stopRecording() {
    try {
      // Request data before stopping to ensure we get the last bit of data
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
        mediaRecorder.stop();
      }
    } catch (error) {
      console.error('Error stopping recorder:', error);
      if (mediaRecorder) {
        finalizeRecording(
          findCanvas()?.width || 1280, 
          findCanvas()?.height || 720, 
          null
        );
      }
    }
  }
  
  // Function to process large chunks to free memory
  async function processLargeChunks() {
    if (processingChunks || recordedChunks.length === 0) return;
    
    processingChunks = true;
    
    try {
      // Create a temporary blob from current chunks
      const tempBlob = new Blob(recordedChunks, { type: 'video/webm' });
      
      // Convert to ArrayBuffer to maintain a single reference
      const arrayBuffer = await tempBlob.arrayBuffer();
      
      // Replace multiple chunks with a single chunk
      recordedChunks = [new Blob([arrayBuffer], { type: 'video/webm' })];
    } catch (error) {
      console.error('Error processing chunks:', error);
    } finally {
      processingChunks = false;
    }
  }
  
  // Function to finalize the recording and create the download
  async function finalizeRecording(width, height, stream) {
    if (recordedChunks.length === 0) {
      console.error('No chunks recorded, cannot create video');
      isRecording = false;
      recordingProgress = 0;
      return;
    }

    try {
      // Process chunks if needed before finalizing
      if (recordedChunks.length > 1) {
        await processLargeChunks();
      }
      
      // Choose appropriate MIME type based on quality
      let mimeType = 'video/webm;codecs=vp9.0 profile=3'; // Try lossless profile first
      
      // Fall back to high quality VP9 if lossless not supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9';
      }
      
      // Create a blob from the recorded chunks
      const blob = new Blob(recordedChunks, { type: mimeType });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Include resolution, quality, and duration in filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const quality = captureQuality.toUpperCase();
      a.download = `raum-capture-${width}x${height}-${quality}-${captureDuration}s-${timestamp}.webm`;
      
      // Add to document, trigger download, and clean up
      document.body.appendChild(a);
      a.click();
      
      // Clean up resources immediately
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Stop the recording timer
        if (recordingTimer) {
          clearInterval(recordingTimer);
          recordingTimer = null;
        }
        
        // Stop the stream tracks
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        // Reset state and clear memory
        recordedChunks = [];
        totalRecordedSize = 0;
        isRecording = false;
        recordingProgress = 0;
        mediaRecorder = null;
        processingChunks = false;
      }, 100);
    } catch (error) {
      console.error('Error finalizing recording:', error);
      // Reset state on error
      recordedChunks = [];
      totalRecordedSize = 0;
      isRecording = false;
      recordingProgress = 0;
      mediaRecorder = null;
      processingChunks = false;
    }
  }
  
  // Function to cancel an ongoing recording
  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try {
        mediaRecorder.stop();
      } catch (error) {
        console.error('Error stopping recorder during cancel:', error);
      }
    }
    
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    
    // Clean up any stream tracks
    try {
      const canvas = findCanvas();
      if (canvas) {
        const stream = canvas.captureStream();
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    } catch (error) {
      console.error('Error cleaning up stream tracks:', error);
    }
    
    // Reset all state
    recordedChunks = [];
    totalRecordedSize = 0;
    isRecording = false;
    recordingProgress = 0;
    mediaRecorder = null;
    processingChunks = false;
  }
  
  // Function to optimize canvas for recording
  function optimizeCanvasForRecording(canvas, quality) {
    // For low quality, we can use a smaller canvas to reduce memory usage
    if (captureQuality === 'low' && canvas.width > 1280) {
      
      // Create a smaller canvas for recording
      const optimizedCanvas = document.createElement('canvas');
      const aspectRatio = canvas.width / canvas.height;
      
      // Target 720p for low quality
      optimizedCanvas.height = 720;
      optimizedCanvas.width = Math.round(720 * aspectRatio);
      
      const ctx = optimizedCanvas.getContext('2d');
      
      // Set up a render loop to copy and scale down from the original canvas
      const renderLoop = () => {
        if (!isRecording) return;
        
        // Use low quality settings for better performance
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 
                     0, 0, optimizedCanvas.width, optimizedCanvas.height);
        
        requestAnimationFrame(renderLoop);
      };
      
      renderLoop();
      return optimizedCanvas.captureStream(quality.fps);
    }
    
    // For medium/high quality, use the original canvas
    return canvas.captureStream(quality.fps);
  }
  
  // Function to check for memory pressure
  function checkMemoryPressure() {
    // Check if performance.memory is available (Chrome/Edge)
    if (typeof window.performance !== 'undefined' && window.performance.memory) {
      const memoryUsage = window.performance.memory.usedJSHeapSize;
      const memoryLimit = window.performance.memory.jsHeapSizeLimit;
      const memoryPercentage = (memoryUsage / memoryLimit) * 100;
      
      // Critical memory pressure - stop recording immediately
      if (memoryPercentage > 85) {
        console.error(`Critical memory pressure detected (${memoryPercentage.toFixed(1)}%), stopping recording`);
        stopRecording();
        return true;
      }
      
      // High memory pressure - process chunks to free memory
      if (memoryPercentage > 70 && !processingChunks && recordedChunks.length > 1) {
        console.warn(`High memory pressure detected (${memoryPercentage.toFixed(1)}%), processing chunks`);
        processLargeChunks();
        return true;
      }
    }
    
    // Check if we're exceeding our self-imposed size limit
    if (totalRecordedSize > maxTotalSize * 0.9) {
      console.warn(`Approaching size limit (${formatBytes(totalRecordedSize)}), stopping recording`);
      stopRecording();
      return true;
    }
    
    return false;
  }
  
  // Function to clean up all resources
  function cleanupResources() {
    // Stop any ongoing recording
    cancelRecording();
    
    // Clear any large objects to help garbage collection
    recordedChunks = [];
    totalRecordedSize = 0;
    mediaRecorder = null;
    
    // Force a garbage collection hint (not guaranteed to run)
    if (window.gc) {
      try {
        window.gc();
      } catch (e) {
        // Ignore if not available
      }
    }
  }
  
  onDestroy(() => {
    // Clean up all resources when component is destroyed
    cleanupResources();
  });
</script>

<div class="video-recorder">
  <!-- Video capture button -->
  <div class="capture-controls">
    {#if isRecording}
      <div class="recording-status">
        <div class="progress-bar">
          <div class="progress-fill" class:warning={memoryWarning} style="width: {recordingProgress}%"></div>
        </div>
        <button class="cancel-btn" on:click={cancelRecording} title="Cancel recording">
          ✕
        </button>
      </div>
    {:else}
      <button 
        class="capture-btn" 
        on:click={toggleCapturePopup}
        title="Capture video of experience"
      >
        <p>Record Frames: 📹</p>
      </button>
    {/if}
  </div>
  
  <!-- Capture popup -->
  {#if showCapturePopup}
    <div class="capture-popup">
      <div class="capture-popup-content">
        <div class="popup-header">
          <h3>Capture Experience</h3>
          <button class="close-btn" on:click={toggleCapturePopup}>×</button>
        </div>
        <div class="capture-form">
          <label for="duration">Duration (seconds)</label>
          <input 
            type="number" 
            id="duration" 
            bind:value={captureDuration} 
            min="1" 
            max="60" 
            step="1"
          />
          
          <label for="quality" class="quality-label">Quality</label>
          <div class="quality-selector">
            <button 
              class="quality-btn {captureQuality === 'low' ? 'active' : ''}" 
              on:click={() => captureQuality = 'low'}
              title="Optimized for stability (24 FPS)"
            >
              Low
            </button>
            <button 
              class="quality-btn {captureQuality === 'medium' ? 'active' : ''}" 
              on:click={() => captureQuality = 'medium'}
              title="Balanced quality (30 FPS)"
            >
              Medium
            </button>
            <button 
              class="quality-btn {captureQuality === 'high' ? 'active' : ''}" 
              on:click={() => captureQuality = 'high'}
              title="Maximum quality (60 FPS)"
            >
              High
            </button>
          </div>
          
          <div class="quality-help">
            {#if captureQuality === 'low'}
              Optimized for stability (24 FPS). Best for longer recordings.
            {:else if captureQuality === 'medium'}
              Balanced quality (30 FPS). Good for most recordings.
            {:else if captureQuality === 'high'}
              Maximum quality (60 FPS). Best for short recordings.
            {/if}
          </div>
        </div>
        <div class="capture-actions">
          <button class="primary-btn" on:click={startCapture}>Start Capture</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .video-recorder {
    width: 100%;
  }
  
  .capture-controls {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    justify-content: center;
  }
  
  .capture-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 5px;
    transition: opacity 0.2s;
  }
  
  .capture-btn:hover {
    opacity: 0.8;
  }
  
  .recording-status {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .progress-bar {
    flex-grow: 1;
    height: 3px;
    background-color: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background-color: rgba(255, 255, 255, 0.7);
    transition: width 0.3s ease;
  }
  
  .progress-fill.warning {
    background-color: rgba(255, 180, 0, 0.8);
  }
  
  .cancel-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
    transition: opacity 0.2s;
  }
  
  .cancel-btn:hover {
    opacity: 0.8;
  }
  
  .capture-popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
  }
  
  .capture-popup-content {
    background-color: rgba(20, 20, 20, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 16px;
    width: 280px;
    color: white;
  }
  
  .popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .popup-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  
  .close-btn:hover {
    color: white;
  }
  
  .capture-form {
    margin-bottom: 20px;
  }
  
  .capture-form label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .quality-label {
    margin-top: 12px;
  }
  
  .quality-selector {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  
  .quality-btn {
    flex: 1;
    padding: 6px 0;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .quality-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .quality-btn.active {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .quality-help {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 12px;
    min-height: 36px;
  }
  
  .capture-form input {
    width: 100%;
    padding: 8px;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 14px;
  }
  
  .capture-form input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .capture-actions {
    display: flex;
    justify-content: flex-end;
  }
  
  .primary-btn {
    padding: 8px 16px;
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .primary-btn:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }
</style> 