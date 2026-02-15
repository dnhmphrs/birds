import { registerResource, unregisterResource, cleanupResource } from '../utils/MemoryManager.js';

class Experience {
	constructor(device, resourceManager) {
		this.device = device;
		this.resourceManager = resourceManager;
		this.objects = [];
		this.pipelines = [];
		
		// Resource tracking
		this.resources = {
			buffers: [],
			textures: [],
			bindGroups: [],
			pipelines: [],
			shaderModules: [],
			samplers: [],
			others: []
		};
		
		// State tracking
		this.initialized = false;
		this.active = false;
		this.name = this.constructor.name;
		
		// Loading state
		this.isLoading = true;
		this.loadingProgress = 0;
		this.loadingMessage = "Initializing...";
		
		// Register this experience with the memory manager
		registerResource(this, 'experiences', this.name);
		
		// Register with resource manager if available
		if (this.resourceManager && typeof this.resourceManager.registerExperience === 'function') {
			this.resourceManager.registerExperience(this.name, this);
		}
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

	addObject(object) {
		if (!object) return;
		
		this.objects.push(object);
		this.trackResource(object, 'others');
	}

	addPipeline(pipeline) {
		if (!pipeline) return;
		
		this.pipelines.push(pipeline);
		this.trackResource(pipeline, 'pipelines');
	}
	
	// Create a buffer with automatic tracking
	createBuffer(descriptor) {
		if (!this.device) {
			console.warn("Cannot create buffer: device is null");
			return null;
		}
		
		try {
			const buffer = this.device.createBuffer(descriptor);
			return this.trackResource(buffer, 'buffers');
		} catch (error) {
			console.error("Error creating buffer:", error);
			return null;
		}
	}
	
	// Create a texture with automatic tracking
	createTexture(descriptor) {
		if (!this.device) {
			console.warn("Cannot create texture: device is null");
			return null;
		}
		
		try {
			const texture = this.device.createTexture(descriptor);
			return this.trackResource(texture, 'textures');
		} catch (error) {
			console.error("Error creating texture:", error);
			return null;
		}
	}
	
	// Create a bind group with automatic tracking
	createBindGroup(descriptor) {
		if (!this.device) {
			console.warn("Cannot create bind group: device is null");
			return null;
		}
		
		try {
			const bindGroup = this.device.createBindGroup(descriptor);
			return this.trackResource(bindGroup, 'bindGroups');
		} catch (error) {
			console.error("Error creating bind group:", error);
			return null;
		}
	}
	
	// Create a shader module with automatic tracking
	createShaderModule(descriptor) {
		if (!this.device) {
			console.warn("Cannot create shader module: device is null");
			return null;
		}
		
		try {
			const shaderModule = this.device.createShaderModule(descriptor);
			return this.trackResource(shaderModule, 'shaderModules');
		} catch (error) {
			console.error("Error creating shader module:", error);
			return null;
		}
	}
	
	// Create a sampler with automatic tracking
	createSampler(descriptor) {
		if (!this.device) {
			console.warn("Cannot create sampler: device is null");
			return null;
		}
		
		try {
			const sampler = this.device.createSampler(descriptor);
			return this.trackResource(sampler, 'samplers');
		} catch (error) {
			console.error("Error creating sampler:", error);
			return null;
		}
	}
	
	// Handle resize events
	handleResize(width, height) {
		// Override in subclasses
	}
	
	// Initialize the experience
	async initialize() {
		this.initialized = true;
		this.active = true;
	}
	
	// Activate the experience
	activate() {
		this.active = true;
	}
	
	// Deactivate the experience
	deactivate() {
		this.active = false;
	}

	cleanup() {
		// Remove all objects
		this.objects.forEach(obj => {
			if (obj && typeof obj.cleanup === 'function') {
				obj.cleanup();
			}
		});
		this.objects = [];

		// Remove all pipelines
		this.pipelines.forEach(pipeline => {
			if (pipeline && typeof pipeline.cleanup === 'function') {
				pipeline.cleanup();
			}
		});
		this.pipelines = [];

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

		// Clear device and resource manager references
		this.device = null;
		this.resourceManager = null;
		
		// Unregister this experience from the memory manager
		unregisterResource(this, 'experiences');
	}

	// Method to update loading state
	updateLoadingState(isLoading, message = "", progress = 0) {
		this.isLoading = isLoading;
		this.loadingMessage = message;
		this.loadingProgress = progress;
		
		// Dispatch a custom event that the UI can listen for
		if (typeof window !== 'undefined') {
			const event = new CustomEvent('experience-loading-update', { 
				detail: { 
					experience: this.name,
					isLoading: this.isLoading,
					message: this.loadingMessage,
					progress: this.loadingProgress
				} 
			});
			window.dispatchEvent(event);
		}
	}
}

export default Experience;
