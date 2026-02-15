// webgpu/WebGPUContext.js
import { registerResource, unregisterResource } from '../utils/MemoryManager.js';

// Track active WebGPU contexts for cleanup
const activeContexts = new Set();

export async function initializeWebGPU(canvas) {
	if (!navigator.gpu) {
		console.error('WebGPU is not supported in this browser.');
		return null;
	}

	try {
		// Request adapter with power preference
		const adapter = await navigator.gpu.requestAdapter({
			powerPreference: 'high-performance'
		});
		
		if (!adapter) {
			console.error('Failed to get GPU adapter.');
			return null;
		}

		// Request device with optional features and limits
		const device = await adapter.requestDevice({
			requiredFeatures: [],
			requiredLimits: {
				maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
				maxBufferSize: adapter.limits.maxBufferSize
			}
		});
		
		// Set up uncaptured error handler
		device.addEventListener('uncapturederror', (event) => {
			console.error('WebGPU device error:', event.error);
		});
		
		// Get WebGPU context from canvas
		const context = canvas.getContext('webgpu');
		if (!context) {
			console.error('Failed to get WebGPU context from canvas.');
			return null;
		}
		
		const format = navigator.gpu.getPreferredCanvasFormat();

		// Configure the context
		context.configure({
			device,
			format,
			alphaMode: 'opaque'
		});
		
		// Create context object with additional properties
		const webgpuContext = {
			device,
			context,
			format,
			canvas,
			adapter,
			
			// Cleanup method for this context
			cleanup: function() {
				
				// Remove from active contexts
				activeContexts.delete(this);
				
				// Unconfigure the context if possible
				try {
					if (this.context) {
						// Some browsers support unconfigure
						if (typeof this.context.unconfigure === 'function') {
							this.context.unconfigure();
						}
					}
				} catch (error) {
					console.warn('Error unconfiguring WebGPU context:', error);
				}
				
				// Nullify references
				this.device = null;
				this.context = null;
				this.adapter = null;
				this.canvas = null;
				
				// Unregister from memory manager
				unregisterResource(this, 'others');
				
				('WebGPU context cleanup complete');
			}
		};
		
		// Register with memory manager
		registerResource(webgpuContext, 'others');
		
		// Add to active contexts
		activeContexts.add(webgpuContext);
		
		return webgpuContext;
	} catch (error) {
		console.error('Error initializing WebGPU:', error);
		return null;
	}
}

// Utility function to clean up all active WebGPU contexts
export function cleanupAllWebGPUContexts() {	
	// Create a copy of the set to avoid modification during iteration
	const contextsToCleanup = [...activeContexts];
	
	// Clean up each context
	for (const context of contextsToCleanup) {
		if (context && typeof context.cleanup === 'function') {
			context.cleanup();
		}
	}
	
	// Clear the set
	activeContexts.clear();
}

// Utility function to check if WebGPU is supported
export function isWebGPUSupported() {
	return !!navigator.gpu;
}
