import { registerResource, unregisterResource, cleanupResource } from '../utils/MemoryManager.js';

class ResourceManager {
	constructor(device, camera) {
		this.device = device;
		this.camera = camera;
		this.buffers = {};
		this.depthTexture = null;
		this.depthTextureView = null;
		this.experiences = {};
		this.canvas = null;
		
		// Resource tracking
		this.resources = {
			buffers: [],
			textures: [],
			bindGroups: [],
			others: []
		};
		
		// Register with memory manager
		registerResource(this, 'others');
	}
	
	// Track a resource for automatic cleanup
	trackResource(resource, type = 'others') {
		if (!resource) return resource;
		
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

	initialize(width, height) {
		// Store canvas dimensions
		this.width = width;
		this.height = height;
		
		// Create uniform buffers with tracking
		this.buffers.viewportBuffer = this.createUniformBuffer(16, 'Viewport Buffer');
		this.buffers.mouseBuffer = this.createUniformBuffer(16, 'Mouse Buffer');

		// Update camera aspect ratio
		if (this.camera) {
			this.camera.updateAspect(width, height);
		}
		
		// Initialize depth texture
		this.initializeDepthTexture(width, height);
	}

	createUniformBuffer(size, label = 'Uniform Buffer') {
		const buffer = this.device.createBuffer({
			size,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label
		});
		
		// Track the buffer
		return this.trackResource(buffer, 'buffers');
	}

	initializeDepthTexture(width, height) {
		// Clean up existing depth texture if it exists
		if (this.depthTexture) {
			unregisterResource(this.depthTexture, 'textures');
			this.depthTexture = null;
		}
		
		if (this.depthTextureView) {
			this.depthTextureView = null;
		}
		
		// Create a new depth texture
		this.depthTexture = this.device.createTexture({
			size: { width, height, depthOrArrayLayers: 1 },
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
			label: 'Depth Texture'
		});
		
		// Track the texture
		this.trackResource(this.depthTexture, 'textures');
		
		// Pre-create the view for faster access
		this.depthTextureView = this.depthTexture.createView();
	}

	getViewportBuffer() {
		return this.buffers.viewportBuffer;
	}

	getMouseBuffer() {
		return this.buffers.mouseBuffer;
	}

	getDepthTextureView() {
		if (!this.depthTexture) {
			console.warn("Depth texture is null, attempting to recreate");
			// Try to get canvas dimensions
			let width = this.width || 0;
			let height = this.height || 0;
			
			if (this.canvas) {
				width = this.canvas.width;
				height = this.canvas.height;
			} else if (this.device && this.device.canvas) {
				width = this.device.canvas.width;
				height = this.device.canvas.height;
			}
			
			// Only recreate if we have valid dimensions
			if (width > 0 && height > 0) {
				this.updateDepthTexture(width, height);
			} else {
				return null;
			}
		}
		
		// Return null instead of throwing an error if depthTexture is still null
		return this.depthTextureView;
	}

	updateViewportSize(width, height) {		
		// Store dimensions
		this.width = width;
		this.height = height;
		
		// Update canvas dimensions
		if (this.canvas) {
			this.canvas.width = width;
			this.canvas.height = height;
		}
		
		// Update camera aspect ratio
		if (this.camera) {
			this.camera.updateAspect(width, height);
		}
		
		// Update depth texture
		this.updateDepthTexture(width, height);
		
		// Notify all experiences of the resize
		if (this.experiences) {
			for (const experience of Object.values(this.experiences)) {
				if (experience && typeof experience.handleResize === 'function') {
					experience.handleResize(width, height);
				}
			}
		}
	}

	updateDepthTexture(width, height) {
		// Validate dimensions
		if (!width || !height || width <= 0 || height <= 0) {
			console.warn(`Invalid dimensions for depth texture: ${width}x${height}`);
			return;
		}
		
		try {
			// Check if we already have a depth texture with the same dimensions
			if (this.depthTexture && 
				this.depthTexture.width === width && 
				this.depthTexture.height === height) {
				// No need to recreate the texture
				return;
			}
			
			// Clean up existing depth texture if it exists
			if (this.depthTexture) {
				unregisterResource(this.depthTexture, 'textures');
				this.depthTexture = null;
				this.depthTextureView = null;
			}
			
			// Create a new depth texture with the updated dimensions
			this.depthTexture = this.device.createTexture({
				size: { width, height, depthOrArrayLayers: 1 },
				format: 'depth24plus',
				usage: GPUTextureUsage.RENDER_ATTACHMENT,
				label: 'Depth Texture'
			});
			
			// Track the texture
			this.trackResource(this.depthTexture, 'textures');
			
			// Pre-create the view for faster access
			this.depthTextureView = this.depthTexture.createView();
		} catch (error) {
			console.error("Error creating depth texture:", error);
			this.depthTexture = null;
			this.depthTextureView = null;
		}
	}

	updateMousePosition(x, y) {
		if (!this.buffers.mouseBuffer || !this.device) return;
		
		const mouseData = new Float32Array([x, y, 0, 0]); // Add padding for alignment
		this.device.queue.writeBuffer(this.buffers.mouseBuffer, 0, mouseData);
	}
	
	// Register an experience with the resource manager
	registerExperience(key, experience) {
		if (!experience) return;
		
		// Store the experience
		this.experiences[key] = experience;
		
		// Return the experience for chaining
		return experience;
	}

	cleanup() {		
		// Clean up all experiences first
		if (this.experiences) {
			for (const key in this.experiences) {
				if (this.experiences[key] && typeof this.experiences[key].cleanup === 'function') {
					this.experiences[key].cleanup();
				}
				this.experiences[key] = null;
			}
			this.experiences = {};
		}
		
		// Clean up all tracked resources
		for (const type in this.resources) {
			const resources = this.resources[type];
			if (resources && resources.length > 0) {				
				// Clean up each resource
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
		
		// Destroy buffers - WebGPU buffers need to be explicitly nullified
		if (this.buffers) {
			for (const key in this.buffers) {
				if (this.buffers[key]) {
					unregisterResource(this.buffers[key], 'buffers');
					this.buffers[key] = null;
				}
			}
			this.buffers = {};
		}

		// Destroy depth texture - WebGPU textures need to be explicitly nullified
		if (this.depthTexture) {
			unregisterResource(this.depthTexture, 'textures');
			this.depthTexture = null;
		}
		
		if (this.depthTextureView) {
			this.depthTextureView = null;
		}
		
		// Clear camera reference
		this.camera = null;
		this.cameraController = null;
		
		// Clear device reference
		this.device = null;
		
		// Clear canvas reference if it exists
		if (this.canvas) {
			this.canvas = null;
		}
		
		// Unregister from memory manager
		unregisterResource(this, 'others');

	}
}

export default ResourceManager;
