import { initializeWebGPU, cleanupAllWebGPUContexts } from './core/WebGPUContext';
import Camera from './camera/Camera';
import CameraController from './camera/CameraController';
import InteractionManager from './core/InteractionManager';
import ResourceManager from './core/ResourceManager';
import Experience from './experiences/Experience';
import { vec3 } from 'gl-matrix';
import { 
	getMemoryStats, 
	forceGarbageCollection, 
	formatBytes, 
	registerResource, 
	unregisterResource,
	cleanupAllResources
} from './utils/MemoryManager.js';

class Engine {
	constructor(canvas) {
		this.canvas = canvas;
		this.device = null;
		this.context = null;
		this.webgpuContext = null;
		this.resourceManager = null;
		this.scene = null;
		this.camera = null;
		this.cameraController = null;
		this.interactionManager = null;
		this.currentExperience = null;
		this.animationFrameId = null;
		this.renderingPaused = false;
		this.renderEveryNthFrame = 1;
		this.frameCounter = 0;
		
		// Resource tracking
		this.resources = {
			buffers: [],
			textures: [],
			bindGroups: [],
			pipelines: [],
			others: []
		};
		
		// Register with memory manager
		registerResource(this, 'others');
	}
	
	// Track a resource for automatic cleanup
	trackResource(resource, type = 'others') {
		if (!resource) return resource;
		
		// Track large buffer allocations
		if (type === 'buffers' && resource.size) {
			this.trackBufferAllocation(resource.size, resource.label || 'Unnamed buffer');
		}
		
		// Add to appropriate resource list
		if (this.resources[type]) {
			this.resources[type].push(resource);
		} else {
			this.resources.others.push(resource);
		}
		
		// Register with global memory manager
		registerResource(resource, type);
		
		return resource;
	}

	async start(SceneClass, cameraConfig = {}) {
		// Clean up any existing resources first
		if (this.device || this.context) {
			this.cleanup();
		}
		
		try {
			// Reinitialize WebGPU context
			this.webgpuContext = await initializeWebGPU(this.canvas);
			
			if (!this.webgpuContext) {
				console.error("Failed to initialize WebGPU context");
				return null;
			}
			
			this.device = this.webgpuContext.device;
			this.context = this.webgpuContext.context;
			
			// Set up WebGPU error handling
			this.setupWebGPUErrorHandling();
			
			// Track the WebGPU context
			this.trackResource(this.webgpuContext, 'others');
	
			// Initialize Camera and Controller with config
			this.camera = new Camera(this.device, this.canvas.clientWidth, this.canvas.clientHeight);
			this.trackResource(this.camera, 'others');
			
			// Set camera position and fov from config if provided
			if (cameraConfig) {
				// Set position
				if (cameraConfig.position) {
					this.camera.position = vec3.fromValues(
						cameraConfig.position.x,
						cameraConfig.position.y,
						cameraConfig.position.z
					);
					this.camera.updateView();
				}
				
				// Set field of view
				if (cameraConfig.fov) {
					this.camera.updateProjection(cameraConfig.fov);
				}
			}
			
			this.cameraController = new CameraController(this.camera, vec3.fromValues(0, 0, 0), cameraConfig);
			this.trackResource(this.cameraController, 'others');
	
			// Initialize Shared Resource Manager
			this.resourceManager = new ResourceManager(this.device, this.camera);
			this.trackResource(this.resourceManager, 'others');
			
			// Make sure camera controller is available in the resource manager
			this.resourceManager.cameraController = this.cameraController;
			this.resourceManager.canvas = this.canvas;
			
			this.resourceManager.initialize(this.canvas.width, this.canvas.height);
	
			// Initialize Scene
			this.scene = new SceneClass(this.device, this.resourceManager);
			this.trackResource(this.scene, 'others');
			
			await this.scene.initialize();
			
			// Store the current experience for easier access
			if (this.scene && this.scene.currentExperience) {
				this.experience = this.scene.currentExperience;
				this.trackResource(this.experience, 'others');
			} else if (this.resourceManager && this.resourceManager.experiences) {
				// Try to find the experience in the resource manager
				const experienceKeys = Object.keys(this.resourceManager.experiences);
				if (experienceKeys.length > 0) {
					this.experience = this.resourceManager.experiences[experienceKeys[0]];
					this.trackResource(this.experience, 'others');
				}
			}
			
			// If we're starting a specific experience directly (not a scene with multiple experiences)
			if (!this.experience && SceneClass.prototype instanceof Experience) {
				this.experience = this.scene;
			}
			
			// Initialize Interaction Manager
			this.interactionManager = new InteractionManager(this.canvas, this);
			this.trackResource(this.interactionManager, 'others');
			this.interactionManager.initialize();
	
			// Start rendering loop
			this.render();
			
			return this.experience;
		} catch (error) {
			console.error("Error in Engine.start:", error);
			this.cleanup();
			return null;
		}
	}

	updateViewport(width, height) {
		if (!this.canvas || !this.device) {
			return;
		}
		
		if (width <= 0 || height <= 0) {
			return;
		}
		
		this.canvas.width = width;
		this.canvas.height = height;
	
		// Update ResourceManager with new viewport size
		if (this.resourceManager) {
			this.resourceManager.updateViewportSize(width, height);
		}

		// Update camera's aspect ratio
		if (this.cameraController) {
			this.cameraController.updateAspect(width, height);
		}

		// Update the scene if it has an onResize method
		if (this.scene && this.scene.onResize) {
			this.scene.onResize(width, height);
		}
	}

	async cleanup() {
		// Stop animation frame if it's running
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		
		// Properly shutdown experience if it exists
		if (this.experience) {
			try {
				// Check if the experience has a shutdown method
				if (typeof this.experience.shutdown === 'function') {
					// console.log(`Shutting down ${this.experience.constructor.name} experience...`);
					// Wait for shutdown to complete before proceeding with cleanup
					await this.experience.shutdown();
				}
				
				// Now perform cleanup
				if (typeof this.experience.cleanup === 'function') {
					// console.log(`Performing cleanup for ${this.experience.constructor.name} experience`);
					this.experience.cleanup();
				}
			} catch (error) {
				console.error("Error cleaning up experience:", error);
			}
			this.experience = null;
		}
		
		// Clean up scene if different from experience
		if (this.scene && this.scene !== this.experience) {
			if (typeof this.scene.cleanup === 'function') {
				try {
					this.scene.cleanup();
				} catch (error) {
					console.error("Error cleaning up scene:", error);
				}
			}
			this.scene = null;
		}
		
		// Cleanup interaction manager
		if (this.interactionManager) {
			if (typeof this.interactionManager.destroy === 'function') {
				try {
					this.interactionManager.destroy();
				} catch (error) {
					console.error("Error cleaning up interaction manager:", error);
				}
			}
			this.interactionManager = null;
		}

		// Cleanup camera and controller
		if (this.camera) {
			if (typeof this.camera.cleanup === 'function') {
				try {
					this.camera.cleanup();
				} catch (error) {
					console.error("Error cleaning up camera:", error);
				}
			}
			this.camera = null;
		}
		
		if (this.cameraController) {
			if (typeof this.cameraController.cleanup === 'function') {
				try {
					this.cameraController.cleanup();
				} catch (error) {
					console.error("Error cleaning up camera controller:", error);
				}
			}
			this.cameraController = null;
		}
		
		// Clean up resource manager
		if (this.resourceManager) {
			try {
				this.resourceManager.cleanup();
			} catch (error) {
				console.error("Error cleaning up resource manager:", error);
			}
			this.resourceManager = null;
		}
		
		// Clean up WebGPU context
		if (this.webgpuContext) {
			if (typeof this.webgpuContext.cleanup === 'function') {
				try {
					this.webgpuContext.cleanup();
				} catch (error) {
					console.error("Error cleaning up WebGPU context:", error);
				}
			}
			this.webgpuContext = null;
		}

		// Reset device and context
		this.device = null;
		this.context = null;
		
		// Clean up all tracked resources
		for (const type in this.resources) {
			const resources = this.resources[type];
			if (resources && resources.length > 0) {
				for (let i = resources.length - 1; i >= 0; i--) {
					const resource = resources[i];
					if (resource) {
						// Unregister from global memory manager
						unregisterResource(resource, type);
						
						// Explicitly nullify the resource
						resources[i] = null;
					}
				}
				
				// Clear the array
				this.resources[type] = [];
			}
		}
		
		// Remove any global references that might be causing memory leaks
		if (typeof window !== 'undefined') {
			if (window.gridCodeExperience) {
				window.gridCodeExperience = null;
			}
			// Force garbage collection if available (though this is rarely available in browsers)
			if (window.gc) {
				window.gc();
			}
		}
		
		// Unregister from memory manager
		unregisterResource(this, 'others');
	}

	render = () => {
		// Check if we have a valid device and context
		if (!this.device || !this.context) {
			console.warn("WebGPU device or context is null, stopping render loop");
			return;
		}
		
		// Monitor memory every 30 frames
		if (!this._frameCount) this._frameCount = 0;
		this._frameCount++;
		
		if (this._frameCount % 30 === 0) {
			this.monitorMemoryGrowth();
		}
		
		// Skip frames if throttling is active
		if (this.renderEveryNthFrame > 1) {
			this.frameCounter = (this.frameCounter || 0) + 1;
			if (this.frameCounter % this.renderEveryNthFrame !== 0) {
				// Skip this frame
				this.animationFrameId = requestAnimationFrame(this.render);
				return;
			}
		}
		
		try {
			// Memory throttling check - pause rendering if memory usage is too high
			if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
				const memUsage = window.performance.memory.usedJSHeapSize;
				const memLimit = window.performance.memory.jsHeapSizeLimit;
				const percentUsed = (memUsage / memLimit) * 100;
				
				if (memUsage > memLimit * 0.9) { // Increased from 0.85 to match new threshold
					// Memory usage is too high - manage with our smart system
					if (this.handleHighMemoryUsage(percentUsed)) {
						// Memory management took action, continue the render loop if appropriate
						if (!this.renderingPaused) {
							this.animationFrameId = requestAnimationFrame(this.render);
						}
						return;
					}
				}
			}
			
			// Get the current texture from the context
			const textureView = this.context.getCurrentTexture().createView();
			
			// Create a command encoder
			const commandEncoder = this.device.createCommandEncoder();
			
			// Render the scene
			if (this.scene) {
				this.scene.render(commandEncoder, textureView);
			} else {
				console.warn("No scene available to render");
			}
			
			// Submit the command buffer
			this.device.queue.submit([commandEncoder.finish()]);
		} catch (error) {
			console.error("Error in render loop:", error);
			// Don't stop the render loop on error, just log it
		}
		
		// Request the next frame
		this.animationFrameId = requestAnimationFrame(this.render);
	}

	// Smart memory management - implements a progressive throttling strategy
	handleHighMemoryUsage(percentUsed) {
		// Increase thresholds to prevent over-triggering
		const isHighMemory = percentUsed > 90; // Increased from 85%
		const isCriticalMemory = percentUsed > 97; // Increased from 95%
		
		// Dispatch memory warning event for the UI
		const event = new CustomEvent('memory-warning', {
			detail: {
				usedJSHeapSize: window.performance.memory.usedJSHeapSize,
				jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
				percentUsed: percentUsed,
				isCritical: isCriticalMemory
			}
		});
		window.dispatchEvent(event);
		
		if (isCriticalMemory) {
			// Enter emergency mode - pause rendering and reduce quality
			console.warn(`Critical memory usage detected (${percentUsed.toFixed(1)}%). Entering emergency mode.`);
			this.pauseRendering(true);
			return true;
		} else if (isHighMemory) {
			// Throttle rendering and reduce quality
			console.warn(`High memory usage detected (${percentUsed.toFixed(1)}%). Throttling rendering.`);
			this.reduceRenderingQuality();
			return true;
		}
		
		return false;
	}
	
	// Pause/resume rendering
	pauseRendering(isPaused) {
		this.renderingPaused = isPaused;
		
		if (isPaused) {
			// Dispatch event that rendering is paused
			const event = new CustomEvent('rendering-paused', {
				detail: { reason: 'memory' }
			});
			window.dispatchEvent(event);
			
			// If we have an animation frame ID, cancel it
			if (this.animationFrameId) {
				cancelAnimationFrame(this.animationFrameId);
				this.animationFrameId = null;
			}
			
			// Schedule a check to see if we can resume in a few seconds
			setTimeout(() => {
				if (this.renderingPaused) {
					// Check if memory usage has decreased
					if (window.performance && window.performance.memory) {
						const memUsage = window.performance.memory.usedJSHeapSize;
						const memLimit = window.performance.memory.jsHeapSizeLimit;
						const percentUsed = (memUsage / memLimit) * 100;
						
						if (percentUsed < 80) {
							// Safe to resume
							this.pauseRendering(false);
						} else {
							// Still high, check again later
							setTimeout(() => {
								if (this.renderingPaused) {
									this.pauseRendering(false);
								}
							}, 3000);
						}
					} else {
						// No memory API available, just resume
						this.pauseRendering(false);
					}
				}
			}, 3000);
		} else {
			// Resume rendering if paused
			if (!this.animationFrameId) {
				this.animationFrameId = requestAnimationFrame(this.render);
				
				// Dispatch event that rendering is resumed
				const event = new CustomEvent('rendering-resumed');
				window.dispatchEvent(event);
			}
		}
	}
	
	// Reduce rendering quality to manage memory usage
	reduceRenderingQuality() {
		// Skip frames to reduce GPU load
		this.renderEveryNthFrame = (this.renderEveryNthFrame || 1) * 2;
		this.renderEveryNthFrame = Math.min(this.renderEveryNthFrame, 8); // Cap at 8 frames (very low FPS)
		
		// If we have a scene with custom memory management
		if (this.scene && typeof this.scene.handleLowMemory === 'function') {
			this.scene.handleLowMemory();
		}
		
	// If we have an experience with custom memory management
	if (this.experience && typeof this.experience.handleLowMemory === 'function') {
		this.experience.handleLowMemory();
	}
	
	// Schedule quality improvement after some time has passed
	setTimeout(() => {
		if (this.renderEveryNthFrame > 1) {
			this.renderEveryNthFrame = Math.max(1, this.renderEveryNthFrame / 2);
		}
	}, 5000);
}

handleResize() {
	// Update canvas size
	if (this.canvas) {
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		
		if (width > 0 && height > 0) {
			this.canvas.width = width;
			this.canvas.height = height;
			
			// Update context configuration if needed
			if (this.context && this.device) {
				try {
					this.context.configure({
						device: this.device,
						format: navigator.gpu.getPreferredCanvasFormat(),
						alphaMode: 'premultiplied'
					});
				} catch (error) {
					// Error reconfiguring context
				}
			}
			
			// Update viewport if needed
			if (this.resourceManager && this.resourceManager.updateViewportSize) {
				this.resourceManager.updateViewportSize(width, height);
			}
			
			// Update camera aspect ratio
			if (this.camera) {
				this.camera.updateAspect(width, height);
			}
			
			// Call resize on scene if it exists
			if (this.scene && typeof this.scene.handleResize === 'function') {
				this.scene.handleResize(width, height);
			}
		} else {
			// Invalid canvas dimensions
		}
	}
}

// Add a stop method that calls cleanup for compatibility
async stop() {
	await this.cleanup();
}

// Helper method to format bytes to human-readable format
formatBytes(bytes) {
	return formatBytes(bytes);
}

// Static method to clean up all WebGPU resources
static cleanupAll() {
	// Clean up all WebGPU contexts
	cleanupAllWebGPUContexts();
	
	// Clean up all tracked resources
	cleanupAllResources();
	
	// Force garbage collection
	forceGarbageCollection();
}

// Enhanced method to track WebGPU leaks specifically
trackBufferAllocation(size, description = "") {
	// Record large buffer allocations to help debug memory spikes
	if (size > 1024 * 1024 * 10) { // Only track buffers > 10MB
		if (!this._largeBufferLog) {
			this._largeBufferLog = [];
		}
		
		// Capture the stack trace synchronously for better debugging
		const stackTrace = new Error().stack;
		
		// Try to parse out the stack and identify the source
		const stackLines = stackTrace.split('\n');
		const relevantLine = stackLines.find(line => 
			!line.includes('trackBufferAllocation') && 
			!line.includes('trackResource') &&
			line.includes('/'));
		
		// More useful description with stack info
		const enhancedDescription = `${description} - Source: ${relevantLine ? relevantLine.trim() : 'unknown'}`;
		
		// Store info about the large buffer
		this._largeBufferLog.push({
			size,
			description: enhancedDescription,
			timestamp: Date.now(),
			stack: stackTrace
		});
		
		// Keep only the last 20 entries
		if (this._largeBufferLog.length > 20) {
			this._largeBufferLog.shift();
		}
		
		console.warn(`Large buffer allocated: ${formatBytes(size)} - ${enhancedDescription}`);
		
		// Add specialized handling for extremely large allocations
		if (size > 100 * 1024 * 1024) { // Over 100MB individual buffer
			console.error(`CRITICAL: Extremely large buffer (${formatBytes(size)}) allocated. This may cause crashes.`);
			console.error(`Stack trace: ${stackTrace}`);
			
			// Log memory state for debugging
			if (window.performance && window.performance.memory) {
				const memState = window.performance.memory;
				console.error(`Memory state: ${formatBytes(memState.usedJSHeapSize)} / ${formatBytes(memState.jsHeapSizeLimit)} (${Math.round((memState.usedJSHeapSize / memState.jsHeapSizeLimit) * 100)}%)`);
			}
			
			// Dispatch an event to notify the UI of this critical allocation
			const event = new CustomEvent('critical-allocation', {
				detail: {
					size,
					description: enhancedDescription,
					timestamp: Date.now()
				}
			});
			window.dispatchEvent(event);
		}
	}
}

// Add this method to handle WebGPU errors
setupWebGPUErrorHandling() {
	if (!this.device) return;
	
	// Add handler for uncaptured errors
	this.device.addEventListener('uncapturederror', (event) => {
		const errorMessage = event.error?.message || 'Unknown WebGPU error';
		console.error('WebGPU error detected:', errorMessage);
		
		// Try to recover from out-of-memory errors
		if (errorMessage.includes('Out of memory') || 
			errorMessage.includes('memory') || 
			errorMessage.includes('exceeded') || 
			errorMessage.includes('failed to map')) {
			
			console.warn('Attempting to recover from WebGPU memory error...');
			
			// Enter emergency mode - pause rendering immediately
			this.handleHighMemoryUsage(99); // Force high memory handling
			
			// Dispatch event for UI notification
			const event = new CustomEvent('webgpu-error', {
				detail: { message: errorMessage, isMemoryError: true }
			});
			window.dispatchEvent(event);
		} else {
			// Other WebGPU errors
			const event = new CustomEvent('webgpu-error', {
				detail: { message: errorMessage, isMemoryError: false }
			});
			window.dispatchEvent(event);
		}
	});
}

// Check for memory growth
monitorMemoryGrowth() {
	// Only run in browser environment with memory API
	if (typeof window === 'undefined' || !window.performance || !window.performance.memory) {
		return;
	}
	
	// Setup memory tracking
	if (!this._memoryHistory) {
		this._memoryHistory = [];
		this._lastMemSize = window.performance.memory.usedJSHeapSize;
		this._spikeDetected = false;
	}
	
	const currentMem = window.performance.memory.usedJSHeapSize;
	const memDiff = currentMem - this._lastMemSize;
	const memGrowthMB = memDiff / (1024 * 1024);
	
	// Record history with more details for analysis
	this._memoryHistory.push({
		timestamp: Date.now(),
		size: currentMem,
		change: memDiff,
		changePercent: (memDiff / this._lastMemSize) * 100, // Percent change
		surfaceType: this.scene?.currentExperience?.currentSurface || this.experience?.currentSurface  // Helps identify which surface causes issues
	});
	
	// Keep history limited to last 100 samples
	if (this._memoryHistory.length > 100) {
		this._memoryHistory.shift();
	}
	
	// More sophisticated spike detection:
	// 1. Detect sudden huge spikes (still needed for catastrophic issues)
	// 2. Detect consistent growth pattern over multiple samples
	
	// Detect rapid growth (possible leak)
	const isHugeSpike = memGrowthMB > 200; // 200MB sudden growth (was 100MB)
	
	// Detect consistent growth pattern
	let consistentGrowth = false;
	
	if (this._memoryHistory.length >= 5) {
		// Count consecutive growth samples
		let growthCount = 0;
		for (let i = this._memoryHistory.length - 5; i < this._memoryHistory.length; i++) {
			if (this._memoryHistory[i].change > 1024 * 1024 * 5) { // 5MB+ growth
				growthCount++;
			}
		}
		
		// If we've had growth in 4+ of the last 5 samples, it's concerning
		consistentGrowth = growthCount >= 4;
		
		// If we detect a consistent leak, log more comprehensive info
		if (consistentGrowth && !this._leakDetected) {
			console.warn('Consistent memory growth detected - possible memory leak');
			console.warn('Memory history (last 5 samples):');
			
			// Show the growth pattern
			for (let i = Math.max(0, this._memoryHistory.length - 5); i < this._memoryHistory.length; i++) {
				const sample = this._memoryHistory[i];
				console.warn(`Sample ${i}: ${formatBytes(sample.size)} (${formatBytes(sample.change)} change) - Surface: ${sample.surfaceType || 'unknown'}`);
			}
			
			// Flag that we've detected a leak
			this._leakDetected = true;
			
			// Reset leak detector after a reasonable time
			setTimeout(() => {
				this._leakDetected = false;
			}, 30000); // 30 seconds
		}
	}
	
	// Report sudden spikes (different than consistent growth)
	if (isHugeSpike && !this._spikeDetected) {
		console.warn(`Memory spike detected: +${memGrowthMB.toFixed(2)}MB - possible memory leak`);
		
		// Log currently active resource counts
		console.warn('Active resources:', this.resourceManager ? 
			JSON.stringify(getMemoryStats().resourceCounts) : 'Resource manager not available');
		
		// Log recently allocated large buffers
		if (this._largeBufferLog && this._largeBufferLog.length > 0) {
			console.warn('Recent large buffer allocations:');
			this._largeBufferLog.forEach(entry => {
				console.warn(`- ${formatBytes(entry.size)} - ${entry.description}`);
			});
		}
		
		this._spikeDetected = true;
		
		// Reset spike detector after a while
		setTimeout(() => {
			this._spikeDetected = false;
		}, 10000);
	}
	
	this._lastMemSize = currentMem;
}
}

export default Engine;
