import { registerResource, unregisterResource, cleanupResource } from '../utils/MemoryManager.js';

class Pipeline {
	constructor(device) {
		this.device = device;
		this.pipeline = null;
		this.bindGroup = null;
		
		// Resource tracking
		this.resources = {
			buffers: [],
			textures: [],
			bindGroups: [],
			pipelines: [],
			shaderModules: [],
			others: []
		};
		
		// Register this pipeline
		registerResource(this, 'pipelines');
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
	
	// Create and track a buffer
	createBuffer(descriptor) {
		const buffer = this.device.createBuffer(descriptor);
		return this.trackResource(buffer, 'buffers');
	}
	
	// Create and track a bind group
	createBindGroup(descriptor) {
		const bindGroup = this.device.createBindGroup(descriptor);
		return this.trackResource(bindGroup, 'bindGroups');
	}
	
	// Create and track a shader module
	createShaderModule(descriptor) {
		const shaderModule = this.device.createShaderModule(descriptor);
		return this.trackResource(shaderModule, 'shaderModules');
	}
	
	// Create and track a render pipeline
	createRenderPipeline(descriptor) {
		const pipeline = this.device.createRenderPipeline(descriptor);
		return this.trackResource(pipeline, 'pipelines');
	}
	
	// Create and track a compute pipeline
	createComputePipeline(descriptor) {
		const pipeline = this.device.createComputePipeline(descriptor);
		return this.trackResource(pipeline, 'pipelines');
	}
	
	// Create and track a texture
	createTexture(descriptor) {
		const texture = this.device.createTexture(descriptor);
		return this.trackResource(texture, 'textures');
	}

	async initialize() {
		throw new Error('initialize() must be implemented by subclasses');
	}

	render() {
		throw new Error('render() must be implemented by subclasses');
	}

	cleanup() {
		// Clean up resources
		for (const type in this.resources) {
			const resources = this.resources[type];
			if (resources && resources.length > 0) {
				for (let i = 0; i < resources.length; i++) {
					const resource = resources[i];
					if (resource) {
						// Call destroy method if available
						if (typeof resource.destroy === 'function') {
							try {
								resource.destroy();
							} catch (error) {
								console.warn(`Error destroying ${type} resource:`, error);
							}
						}
						
						// Unregister from memory manager
						unregisterResource(resource, type);
						
						// Clear reference in the array
						resources[i] = null;
					}
				}
				// Clear array
				resources.length = 0;
			}
		}
		
		// Clear resources object
		this.resources = {};
		
		// Clear pipeline and bindGroup references
		if (this.pipeline) {
			// WebGPU doesn't provide a way to destroy pipelines, so just unregister
			unregisterResource(this.pipeline, 'pipelines');
			this.pipeline = null;
		}
		
		if (this.bindGroup) {
			unregisterResource(this.bindGroup, 'bindGroups');
			this.bindGroup = null;
		}
		
		// Mark as not initialized
		if (this.isInitialized !== undefined) {
			this.isInitialized = false;
		}
		
		// Clear device reference
		this.device = null;
		
		// Clear resource manager reference
		this.resourceManager = null;
		
		// Unregister this pipeline from memory manager
		unregisterResource(this, 'pipelines');
	}
}

export default Pipeline;
