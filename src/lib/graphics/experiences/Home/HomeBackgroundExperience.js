import Experience from '../Experience.js';
import { createFullScreenQuad } from '../../utils/geometryUtils.js';
import Pipeline from '../../pipelines/Pipeline.js';
// Remove the direct import
// import matrixShader from './MatrixShader.wgsl';

// Simple fallback shader in case the imported one fails
const FALLBACK_SHADER = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<uniform> resolution: vec2<f32>;
@group(0) @binding(2) var<uniform> mouse: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(position, 1.0);
    output.uv = position.xy * 0.5 + 0.5;
    return output;
}

@fragment
fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Apply subtle warping effect around mouse cursor
    var warped_uv = uv;
    let mouse_vector = uv - mouse;
    let mouse_dist = length(mouse_vector);
    let warp_strength = 0.03; // Very subtle warping
    let warp_radius = 0.3; // Radius of influence
    
    // Only apply warping within the radius
    if (mouse_dist < warp_radius) {
        // Calculate warping factor - stronger closer to cursor, fading out to edge
        let warp_factor = smoothstep(warp_radius, 0.0, mouse_dist) * warp_strength;
        
        // Create a subtle swirl/lens effect
        let angle = atan2(mouse_vector.y, mouse_vector.x) + sin(time * 0.5) * 0.2;
        let swirl = vec2<f32>(cos(angle), sin(angle)) * mouse_dist;
        
        // Apply the warping
        warped_uv -= swirl * warp_factor;
    }
    
    // Simple gradient background
    var color = vec3<f32>(warped_uv.x * 0.1, warped_uv.y * 0.1, 0.1);
    
    // Add time-based animation
    color.g += sin(time) * 0.1 + 0.1;
    
    return vec4<f32>(color, 1.0);
}
`;

class HomeBackgroundPipeline extends Pipeline {
    constructor(device, resourceManager) {
        super(device);
        this.resourceManager = resourceManager;
        this.isInitialized = false;
        this.shaderCode = null;
    }
    
    async initialize() {
        try {
            // Load shader code
            this.shaderCode = await this.resourceManager.experiences.homeBackground.loadShader();
            
            // Create pipeline layout
            const bindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // Time
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // Resolution
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' } // Mouse
                    }
                ]
            });
            
            // Create pipeline layout
            const pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout]
            });
            
            // Create shader module
            const shaderModule = this.createShaderModule({
                code: this.shaderCode
            });
            
            // Create render pipeline
            this.renderPipeline = this.createRenderPipeline({
                layout: pipelineLayout,
                vertex: {
                    module: shaderModule,
                    entryPoint: 'vertexMain',
                    buffers: [
                        {
                            arrayStride: 3 * 4, // 3 floats, 4 bytes each
                            attributes: [
                                {
                                    shaderLocation: 0,
                                    offset: 0,
                                    format: 'float32x3'
                                }
                            ]
                        }
                    ]
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [
                        {
                            format: navigator.gpu.getPreferredCanvasFormat()
                        }
                    ]
                },
                primitive: {
                    topology: 'triangle-list'
                },
                depthStencil: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less'
                }
            });
            
            // Create bind group
            this.bindGroup = this.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: this.resourceManager.experiences.homeBackground.timeBuffer }
                    },
                    {
                        binding: 1,
                        resource: { buffer: this.resourceManager.experiences.homeBackground.resolutionBuffer }
                    },
                    {
                        binding: 2,
                        resource: { buffer: this.resourceManager.experiences.homeBackground.mouseBuffer }
                    }
                ]
            });
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("Error initializing HomeBackgroundPipeline:", error);
            return false;
        }
    }
    
    render(commandEncoder, textureView, depthTextureView, vertexBuffer, indexBuffer, uniformBuffer, totalIndices) {
        try {
            const renderPassDescriptor = {
                colorAttachments: [
                    {
                        view: textureView,
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store'
                    }
                ],
                depthStencilAttachment: {
                    view: depthTextureView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store'
                }
            };
            
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(this.renderPipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indexBuffer, 'uint16');
            passEncoder.drawIndexed(6); // Draw 2 triangles (6 indices)
            passEncoder.end();
        } catch (error) {
            console.error("Error in HomeBackgroundPipeline render:", error);
        }
    }
}

class HomeBackgroundExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);
        
        // Store device and resource manager
        this.device = device;
        this.resourceManager = resourceManager;
        
        // Initialize loading state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.loadingMessage = "Initializing...";
        
        // Create a full-screen quad
        const { vertices, indices } = createFullScreenQuad();
        
        // Store total indices for rendering
        this.totalIndices = indices.length;
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
        
        // Create separate uniform buffers for each parameter
        this.timeBuffer = this.device.createBuffer({
            size: 4, // Single float (4 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Time Uniform Buffer'
        });
        
        this.resolutionBuffer = this.device.createBuffer({
            size: 8, // Two floats (8 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Resolution Uniform Buffer'
        });
        
        this.mouseBuffer = this.device.createBuffer({
            size: 8, // Two floats (8 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Mouse Uniform Buffer'
        });
        
        // Animation time
        this.time = 0;
        
        // Mouse position (normalized)
        this.mouse = { x: 0.5, y: 0.5 };
        
        // Register mouse move event
        if (typeof window !== 'undefined') {
            window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        }
    }
    
    handleMouseMove(event) {
        // Update mouse position (normalized coordinates)
        if (typeof window !== 'undefined') {
            this.mouse.x = event.clientX / window.innerWidth;
            this.mouse.y = 1.0 - (event.clientY / window.innerHeight); // Flip Y for WebGPU coordinates
        }
    }
    
    async loadShader() {
        // Fetch the shader from the static directory instead of using the imported one
        let shaderCode = FALLBACK_SHADER;
        try {
            // Skip directory checks and directly try to load the shader file
            const response = await fetch('/shaders/home/MatrixShader.wgsl');
            if (response.ok) {
                shaderCode = await response.text();
            } else {
                console.warn("Matrix shader not found in static directory, using fallback shader", response.status, response.statusText);
                
                // Try loading from the static directory directly
                const staticResponse = await fetch('/static/shaders/home/MatrixShader.wgsl');
                if (staticResponse.ok) {
                    shaderCode = await staticResponse.text();
                } else {
                    console.warn("Matrix shader not found in /static directory either, using fallback shader");
                }
            }
        } catch (error) {
            console.error("Error loading Matrix shader:", error);
            console.warn("Using fallback shader");
        }
        return shaderCode;
    }
    
    async initialize() {
        this.updateLoadingState(true, "Initializing pipeline...", 10);
        
        try {
            // Register this experience with the resource manager
            if (this.resourceManager && this.resourceManager.experiences) {
                this.resourceManager.experiences.homeBackground = this;
            } else {
                console.warn("ResourceManager or experiences not available for registration");
            }
            
            // Create the pipeline
            this.pipeline = new HomeBackgroundPipeline(this.device, this.resourceManager);
            
            // Initialize the pipeline
            const success = await this.pipeline.initialize();
            if (!success) {
                this.updateLoadingState(true, "Failed to initialize pipeline", 100);
                return false;
            }
            
            this.updateLoadingState(true, "Pipeline initialized", 50);
            
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
            console.error("Error initializing Home Background Experience:", error);
            this.updateLoadingState(false, `Error: ${error.message}`, 100);
            return false;
        }
    }
    
    render(commandEncoder, textureView) {
        if (!this.pipeline || !this.pipeline.isInitialized) {
            return;
        }
        
        try {
            // Get depth texture view
            const depthTextureView = this.resourceManager.getDepthTextureView?.();
            if (!depthTextureView) {
                return;
            }
            
            // Update time (for subtle animation)
            this.time += 0.01;
            
            // Update time uniform buffer
            this.device.queue.writeBuffer(
                this.timeBuffer,
                0,
                new Float32Array([this.time])
            );
            
            // Update resolution uniform buffer
            if (typeof window !== 'undefined') {
                this.device.queue.writeBuffer(
                    this.resolutionBuffer,
                    0,
                    new Float32Array([window.innerWidth, window.innerHeight])
                );
            }
            
            // Update mouse uniform buffer
            this.device.queue.writeBuffer(
                this.mouseBuffer,
                0,
                new Float32Array([this.mouse.x, this.mouse.y])
            );
            
            // Render using pipeline
            this.pipeline.render(
                commandEncoder,
                textureView,
                depthTextureView,
                this.vertexBuffer,
                this.indexBuffer,
                null, // No longer using uniformBuffer
                this.totalIndices
            );
        } catch (error) {
            console.error("Error in Home Background render:", error);
        }
    }
    
    cleanup() {
        // Remove event listener
        if (typeof window !== 'undefined') {
            window.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        }
        
        // Clean up pipeline
        if (this.pipeline) {
            this.pipeline.cleanup();
            this.pipeline = null;
        }
        
        // Clean up buffers
        if (this.vertexBuffer) {
            this.vertexBuffer = null;
        }
        
        if (this.indexBuffer) {
            this.indexBuffer = null;
        }
        
        if (this.timeBuffer) {
            this.timeBuffer = null;
        }
        
        if (this.resolutionBuffer) {
            this.resolutionBuffer = null;
        }
        
        if (this.mouseBuffer) {
            this.mouseBuffer = null;
        }
        
        // Reset state
        this.isLoading = true;
        this.loadingProgress = 0;
        this.time = 0;
        
        // Remove from resource manager
        if (this.resourceManager && this.resourceManager.experiences) {
            if (this.resourceManager.experiences.homeBackground === this) {
                this.resourceManager.experiences.homeBackground = null;
            }
        }
        
        // Clear device and resource manager references
        this.device = null;
        this.resourceManager = null;
        
        // Call parent cleanup
        super.cleanup();
    }
    
    updateLoadingState(isLoading, message, progress) {
        this.isLoading = isLoading;
        this.loadingMessage = message || this.loadingMessage;
        this.loadingProgress = progress !== undefined ? progress : this.loadingProgress;
        
        // Update resource manager if available
        if (this.resourceManager && this.resourceManager.updateLoadingState) {
            this.resourceManager.updateLoadingState(this.isLoading, this.loadingMessage, this.loadingProgress);
        }
    }
}

export default HomeBackgroundExperience; 