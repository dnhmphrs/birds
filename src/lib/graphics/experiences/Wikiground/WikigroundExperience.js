import Experience from '../Experience.js';
import WikigroundPipeline from './WikigroundPipeline.js';

class WikigroundExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Initialize loading state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.loadingMessage = "Initializing...";
        
        // Active state - track if experience is active
        this.isActive = true;
        
        // Register this experience with the resource manager
        if (this.resourceManager) {
            if (!this.resourceManager.experiences) {
                this.resourceManager.experiences = {};
            }
            this.resourceManager.experiences.wikiground = this;
        }
        
        // Sphere resolution
        this.sphereResolution = 64; // 64x32 sphere segments
        this.totalVertices = (this.sphereResolution + 1) * (this.sphereResolution / 2 + 1);
        this.totalIndices = this.sphereResolution * this.sphereResolution / 2 * 6;
        
        // Animation time
        this.time = 0;
        
        // Create sphere buffers
        this.createSphereBuffers();
        
        // Create uniform buffer for time and parameters
        this.uniformBuffer = this.device.createBuffer({
            size: 16, // 4 floats: time, radius, unused, unused
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Wikiground Uniforms Buffer'
        });
        
        // Store a reference to this for cleanup
        this._globalRef = null;
        
        // Expose this experience globally
        if (typeof window !== 'undefined') {
            this._previousGlobalRef = window.wikigroundExperience;
            window.wikigroundExperience = this;
            this._globalRef = window.wikigroundExperience;
        }
    }
    
    // Method to update loading state
    updateLoadingState(isLoading, message = "", progress = 0) {
        this.isLoading = isLoading;
        this.loadingMessage = message;
        this.loadingProgress = progress;
        
        // Dispatch a custom event that the UI can listen for
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('wikiground-loading-update', { 
                detail: { 
                    isLoading: this.isLoading,
                    message: this.loadingMessage,
                    progress: this.loadingProgress
                } 
            });
            window.dispatchEvent(event);
        }
    }
    
    createSphereBuffers() {
        // Create vertices for a UV sphere
        const vertices = new Float32Array(this.totalVertices * 3);
        let vertexIndex = 0;
        
        // Generate sphere vertices
        for (let lat = 0; lat <= this.sphereResolution / 2; lat++) {
            const theta = (lat * Math.PI) / (this.sphereResolution / 2);
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let lon = 0; lon <= this.sphereResolution; lon++) {
                const phi = (lon * 2 * Math.PI) / this.sphereResolution;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                // Sphere coordinates with radius 1
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                
                vertices[vertexIndex * 3] = x;
                vertices[vertexIndex * 3 + 1] = y;
                vertices[vertexIndex * 3 + 2] = z;
                
                vertexIndex++;
            }
        }
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
            label: 'Wikiground Vertex Buffer'
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        
        // Create indices for sphere triangles
        const indices = new Uint32Array(this.totalIndices);
        let indexCount = 0;
        
        for (let lat = 0; lat < this.sphereResolution / 2; lat++) {
            for (let lon = 0; lon < this.sphereResolution; lon++) {
                const first = lat * (this.sphereResolution + 1) + lon;
                const second = first + this.sphereResolution + 1;
                
                // First triangle
                indices[indexCount++] = first;
                indices[indexCount++] = second;
                indices[indexCount++] = first + 1;
                
                // Second triangle
                indices[indexCount++] = second;
                indices[indexCount++] = second + 1;
                indices[indexCount++] = first + 1;
            }
        }
        
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
            label: 'Wikiground Index Buffer'
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
    }
    
    async initialize() {
        this.updateLoadingState(true, "Initializing pipeline...", 10);
        
        try {
            // Create the pipeline
            this.pipeline = new WikigroundPipeline(this.device, this.resourceManager);
            
            // Initialize the pipeline
            const success = await this.pipeline.initialize();
            if (!success) {
                this.updateLoadingState(true, "Failed to initialize pipeline", 100);
                return false;
            }
            
            this.updateLoadingState(true, "Pipeline initialized", 50);
            
            // Set up camera target to center of sphere
            this.updateLoadingState(true, "Configuring camera...", 90);
            if (this.resourceManager && this.resourceManager.camera) {
                // Look at the center of the sphere (0,0,0)
                this.resourceManager.camera.target = [0, 0, 0];
                this.resourceManager.camera.updateView();
                
                // Set up camera controller if available
                if (this.resourceManager.cameraController) {
                    // Set the target to the center of the sphere
                    this.resourceManager.cameraController.target = [0, 0, 0];
                }
            }
            
            this.updateLoadingState(false, "Initialization complete", 100);
            return true;
        } catch (error) {
            this.updateLoadingState(false, `Error: ${error.message}`, 100);
            return false;
        }
    }
    
    render(commandEncoder, textureView) {
        // Skip rendering if not active or pipeline not initialized
        if (!this.isActive || !this.pipeline || !this.pipeline.isInitialized) {
            return;
        }
        
        try {
            // Get depth texture view
            const depthTextureView = this.resourceManager?.getDepthTextureView?.();
            if (!depthTextureView) {
                return;
            }
            
            // Update time
            this.time += 0.01;
            
            // Update uniform buffer with time and radius
            this.device.queue.writeBuffer(
                this.uniformBuffer,
                0,
                new Float32Array([this.time, 1.0, 0.0, 0.0]) // time, radius, unused, unused
            );
            
            // Render using pipeline
            this.pipeline.render(
                commandEncoder,
                textureView,
                depthTextureView,
                this.vertexBuffer,
                this.indexBuffer,
                this.uniformBuffer,
                this.totalIndices
            );
        } catch (error) {
            console.error("Error in Wikiground render:", error);
        }
    }
    
    handleResize(width, height) {
        // Update camera aspect ratio if needed
        if (this.resourceManager && this.resourceManager.camera) {
            this.resourceManager.camera.updateAspect(width, height);
        }
        
        // Update depth texture if needed
        if (this.resourceManager && typeof this.resourceManager.updateDepthTexture === 'function') {
            this.resourceManager.updateDepthTexture(width, height);
        }
    }
    
    // Add a shutdown method to properly sequence cleanup
    shutdown() {
        // Mark as inactive first to prevent further rendering
        this.isActive = false;
        this.isLoading = true;
        
        // Dispatch an event to notify UI components that we're shutting down
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('wikiground-shutdown', { 
                detail: { experience: 'wikiground' } 
            });
            window.dispatchEvent(event);
        }
        
        // Return a promise that resolves after a short delay
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, 100);
        });
    }
    
    cleanup() {
        // First, mark as inactive to prevent further rendering
        this.isActive = false;
        this.isLoading = true;
        
        // Clean up pipeline
        if (this.pipeline) {
            this.pipeline.cleanup();
            this.pipeline = null;
        }
        
        // Clean up buffers
        if (this.vertexBuffer) {
            if (this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.vertexBuffer, 'buffers');
            }
            this.vertexBuffer = null;
        }
        
        if (this.indexBuffer) {
            if (this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.indexBuffer, 'buffers');
            }
            this.indexBuffer = null;
        }
        
        if (this.uniformBuffer) {
            if (this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.uniformBuffer, 'buffers');
            }
            this.uniformBuffer = null;
        }
        
        // Reset state
        this.loadingProgress = 0;
        this.time = 0;
        
        // Remove from resource manager
        if (this.resourceManager && this.resourceManager.experiences) {
            if (this.resourceManager.experiences.wikiground === this) {
                this.resourceManager.experiences.wikiground = null;
            }
        }
        
        // Remove global reference
        if (typeof window !== 'undefined' && window.wikigroundExperience === this) {
            window.wikigroundExperience = this._previousGlobalRef;
        }
        
        // Clear references
        this._globalRef = null;
        this._previousGlobalRef = null;
        
        // Dispatch an event to notify UI components that we're cleaning up
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('wikiground-cleanup', { 
                detail: { experience: 'wikiground' } 
            });
            window.dispatchEvent(event);
        }
        
        // Call parent cleanup for standardized resource management
        super.cleanup();
    }
}

export default WikigroundExperience;