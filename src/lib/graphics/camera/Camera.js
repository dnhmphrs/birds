// Camera.js
import { mat4, vec3 } from 'gl-matrix';
import { registerResource, unregisterResource } from '../utils/MemoryManager.js';

export default class Camera {
	constructor(device, width, height) {
		this.device = device;
		this.projectionMatrix = mat4.create();
		this.viewMatrix = mat4.create();
		this.position = vec3.fromValues(0, 0, 0); // Positioned along the z-axis
		this.aspect = width / height;
		this.isActive = true; // Flag to track if camera is active
		
		// Resource tracking
		this.resources = {
			buffers: [],
			others: []
		};
		
		// Register with memory manager
		registerResource(this, 'others');

		// Initialize buffers
		this.projectionBuffer = this.createBuffer(64, 'Projection Buffer');
		this.viewBuffer = this.createBuffer(64, 'View Buffer');
		this.modelBuffer = this.createBuffer(64, 'Model Buffer'); // Placeholder, can be updated later

		// Set initial projection and view matrices
		this.updateProjection();
		this.updateView();
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

	createBuffer(size, label = 'Camera Buffer') {
		const buffer = this.device.createBuffer({
			size,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label
		});
		
		// Track the buffer
		return this.trackResource(buffer, 'buffers');
	}

	getBuffers() {
		return {
			projectionBuffer: this.projectionBuffer,
			viewBuffer: this.viewBuffer,
			modelBuffer: this.modelBuffer
		};
	}

	updateAspect(width, height) {
		if (width <= 0 || height <= 0) {
			console.warn(`Invalid aspect ratio dimensions: ${width}x${height}`);
			return;
		}
		
		this.aspect = width / height;
		this.updateProjection();
	}

	updateProjection(fov = Math.PI / 4, near = 0.1, far = 100000) {
		mat4.perspective(this.projectionMatrix, fov, this.aspect, near, far);
		this.updateBuffers(); // Synchronize buffer with projection matrix
	}

	updateView() {
		const target = vec3.fromValues(0, 0, 0); // Looking at the origin
		const up = vec3.fromValues(0, 1, 0); // Y-axis is up
		mat4.lookAt(this.viewMatrix, this.position, target, up);
		this.updateBuffers(); // Synchronize buffer with view matrix
	}

	updateBuffers() {
		if (!this.device || !this.isActive) {
			return;
		}
		
		try {
			if (this.projectionBuffer && this.isActive) {
				this.device.queue.writeBuffer(this.projectionBuffer, 0, this.projectionMatrix);
			}
			
			if (this.viewBuffer && this.isActive) {
				this.device.queue.writeBuffer(this.viewBuffer, 0, this.viewMatrix);
			}
		} catch (error) {
			console.error("Error updating camera buffers:", error);
		}
	}

	cleanup() {
		// Mark as inactive first to prevent further buffer updates
		this.isActive = false;
		
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
		
		// Explicitly nullify buffer references
		this.projectionBuffer = null;
		this.viewBuffer = null;
		this.modelBuffer = null;
		
		// Clear device reference
		this.device = null;
		
		// Unregister from memory manager
		unregisterResource(this, 'others');
	}
}
