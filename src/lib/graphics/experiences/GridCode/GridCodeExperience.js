import Experience from '../Experience.js';
import GridCodePipeline from './GridCodePipeline.js';

class GridCodeExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Debug flag
        this.debug = true; // Enable debug logging
        
        // Loading state
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
            this.resourceManager.experiences.gridcode = this;
        }
        
        // Grid resolution - reduced for better performance during debugging
        this.resolution = 200; // 50x50 grid (reduced from 100x100)
        this.totalVertices = this.resolution * this.resolution;
        this.totalIndices = (this.resolution - 1) * (this.resolution - 1) * 6; // 2 triangles per grid cell
        
        // KP shader parameters
        this.kpParams = {
            scaleIndex: 2, // Default scale index (middle scale)
            distortion: 0  // Default distortion (none)
        };
        
        // Animation time
        this.time = 0;
        
        // Create vertex and index buffers
        this.createBuffers();
        
        // Create uniform buffer for time
        this.uniformBuffer = this.device.createBuffer({
            size: 16, // 3 unused floats + 1 float for time
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Grid Code Uniforms Buffer'
        });
        
        // Store a reference to this for cleanup
        this._globalRef = null;
        
        // Expose this experience globally, but with a weak reference pattern
        if (typeof window !== 'undefined') {
            // Store the previous value to restore it on cleanup if needed
            this._previousGlobalRef = window.gridCodeExperience;
            window.gridCodeExperience = this;
            this._globalRef = window.gridCodeExperience;
        }
    }
    
    // Method to update loading state
    updateLoadingState(isLoading, message = "", progress = 0) {
        this.isLoading = isLoading;
        this.loadingMessage = message;
        this.loadingProgress = progress;
        
        // Dispatch a custom event that the UI can listen for
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('gridcode-loading-update', { 
                detail: { 
                    isLoading: this.isLoading,
                    message: this.loadingMessage,
                    progress: this.loadingProgress
                } 
            });
            window.dispatchEvent(event);
        }
    }
    
    createBuffers() {
        // Create vertices for the grid
        const vertices = new Float32Array(this.totalVertices * 3); // x, y, z for each vertex
        
        // Generate a flat grid initially - match Riemann's approach
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const index = (y * this.resolution + x) * 3;
                
                // Map grid coordinates to [-2, 2] range - CENTERED EXACTLY
                const xPos = (x / (this.resolution - 1)) * 4 - 2;
                const yPos = (y / (this.resolution - 1)) * 4 - 2;
                
                // Set vertex position (flat grid)
                vertices[index] = xPos;     // x
                vertices[index + 1] = yPos; // y
                vertices[index + 2] = 0;    // z (flat)
            }
        }
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        
        // Create indices for the grid
        const indices = new Uint32Array(this.totalIndices);
        let indexCount = 0;
        
        for (let i = 0; i < this.resolution - 1; i++) {
            for (let j = 0; j < this.resolution - 1; j++) {
                const topLeft = i * this.resolution + j;
                const topRight = topLeft + 1;
                const bottomLeft = (i + 1) * this.resolution + j;
                const bottomRight = bottomLeft + 1;
                
                // First triangle (top-left, bottom-left, bottom-right)
                indices[indexCount++] = topLeft;
                indices[indexCount++] = bottomLeft;
                indices[indexCount++] = bottomRight;
                
                // Second triangle (top-left, bottom-right, top-right)
                indices[indexCount++] = topLeft;
                indices[indexCount++] = bottomRight;
                indices[indexCount++] = topRight;
            }
        }
        
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
    }
    
    // Function to update KP scale
    updateKPScale(scaleIndex) {
        this.kpParams.scaleIndex = scaleIndex;
        
        if (this.pipeline) {
            this.pipeline.updateKPParams(scaleIndex, this.kpParams.distortion);
        }
    }
    
    // Function to update KP distortion
    updateKPDistortion(distortion) {
        this.kpParams.distortion = distortion;
        
        if (this.pipeline) {
            this.pipeline.updateKPParams(this.kpParams.scaleIndex, distortion);
        }
    }
    
    async initialize() {
        this.updateLoadingState(true, "Initializing pipeline...", 10);
        
        try {
            // Create the pipeline
            this.pipeline = new GridCodePipeline(this.device, this.resourceManager);
            
            // Initialize the pipeline
            const success = await this.pipeline.initialize();
            if (!success) {
                this.updateLoadingState(true, "Failed to initialize pipeline", 100);
                return false;
            }
            
            this.updateLoadingState(true, "Pipeline initialized", 50);
            
            // Set initial KP parameters
            this.pipeline.updateKPParams(this.kpParams.scaleIndex, this.kpParams.distortion);
            
            // Set up camera target to center of grid without overriding position
            this.updateLoadingState(true, "Configuring camera...", 90);
            if (this.resourceManager && this.resourceManager.camera) {
                // Look at the center of the grid (0,0,0)
                this.resourceManager.camera.target = [0, 0, 0];
                this.resourceManager.camera.updateView();
                
                // Set up camera controller if available
                if (this.resourceManager.cameraController) {
                    // Set the target to the center of the grid
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
            
            // Update time (for subtle animation)
            this.time += 0.01;
            
            // Skip buffer updates if we're not active
            if (!this.isActive || !this.uniformBuffer) {
                return;
            }
            
            // Update uniform buffer with time
            this.device.queue.writeBuffer(
                this.uniformBuffer,
                0,
                new Float32Array([0, 0, 0, this.time])
            );
            
            // Render using pipeline with the KP shader
            this.pipeline.render(
                commandEncoder,
                textureView,
                depthTextureView,
                this.vertexBuffer,
                this.indexBuffer,
                this.uniformBuffer,
                this.totalIndices,
                'kp' // Always use KP shader
            );
        } catch (error) {
            console.error("Error in Grid Code render:", error);
        }
    }
    
    handleResize(width, height) {
        // Update camera aspect ratio if needed
        if (this.resourceManager && this.resourceManager.camera) {
            this.resourceManager.camera.updateAspect(width, height);
        }
        
        // Update depth texture if needed - add null check
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
            const event = new CustomEvent('gridcode-shutdown', { 
                detail: { experience: 'gridcode' } 
            });
            window.dispatchEvent(event);
        }
        
        // Return a promise that resolves after a short delay
        // This gives any in-progress renders time to complete
        return new Promise(resolve => {
            setTimeout(() => {
                // console.log("GridCodeExperience: Shutdown complete, proceeding with cleanup");
                resolve();
            }, 100); // 100ms delay should be enough for any in-progress frame to complete
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
        
        // Clean up buffers - explicitly destroy WebGPU resources
        if (this.vertexBuffer) {
            // Not calling destroy() as WebGPU doesn't support explicit destruction for buffers
            // Just unregister from resource manager and set to null
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
            if (this.resourceManager.experiences.gridcode === this) {
                this.resourceManager.experiences.gridcode = null;
            }
        }
        
        // Remove global reference
        if (typeof window !== 'undefined' && window.gridCodeExperience === this) {
            window.gridCodeExperience = this._previousGlobalRef;
        }
        
        // Clear references
        this._globalRef = null;
        this._previousGlobalRef = null;
        
        // Dispatch an event to notify UI components that we're cleaning up
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('gridcode-cleanup', { 
                detail: { experience: 'gridcode' } 
            });
            window.dispatchEvent(event);
        }
        
        // Call parent cleanup for standardized resource management
        super.cleanup();
    }
}

export default GridCodeExperience; 