// Remove the Node.js imports
// import { readFileSync } from 'fs';
// import path from 'path';

class GridCodePipeline {
    constructor(device, resourceManager) {
        this.device = device;
        this.resourceManager = resourceManager;
        this.isInitialized = false;
        this.isActive = true; // Flag to track if pipeline is active
        this.shaderModule = null;
        this.renderPipeline = null;
        this.bindGroup = null;
        
        // Create KP shader parameters buffer with default values
        this.kpParamsBuffer = this.device.createBuffer({
            size: 16, // 4 floats (scaleIndex, distortion, padding1, padding2)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'KP Shader Parameters Buffer'
        });
        
        // Initialize with default values
        this.updateKPParams(2, 0); // Default: scale index 2, no distortion
    }
    
    // Method to update KP shader parameters
    updateKPParams(scaleIndex, distortion) {
        if (!this.device || !this.kpParamsBuffer) return;
        
        // Clamp values to valid ranges
        scaleIndex = Math.max(0, Math.min(5, scaleIndex));
        distortion = Math.max(0, Math.min(1, distortion));
        
        // Update the buffer
        this.device.queue.writeBuffer(
            this.kpParamsBuffer,
            0,
            new Float32Array([scaleIndex, distortion, 0, 0]) // Include padding
        );
    }
    
    async initialize() {
        // Create bind group layout with additional binding for KP parameters
        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' } // Projection matrix
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' } // View matrix
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' } // Time uniform
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' } // KP shader parameters
                }
            ]
        });
        
        // Create pipeline layout
        this.pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout]
        });
        
        // Initialize KP shader - use the shader from the static folder
        await this.initializeShader('/shaders/gridcode/KPShader.wgsl');
        
        this.isInitialized = true;
        return true;
    }
    
    async initializeShader(shaderPath) {
        // Fetch the shader code from the WGSL file using browser's fetch API
        const response = await fetch(shaderPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch shader: ${response.statusText}`);
        }
        
        const shaderCode = await response.text();
        
        // Create shader module
        this.shaderModule = this.device.createShaderModule({
            code: shaderCode,
            label: 'Grid Code KP Tau-Function Shader'
        });
        
        // Create render pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: this.pipelineLayout,
            vertex: {
                module: this.shaderModule,
                entryPoint: 'vertexMain',
                buffers: [
                    {
                        // Position (x, y, z)
                        arrayStride: 12, // 3 floats * 4 bytes
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
                module: this.shaderModule,
                entryPoint: 'fragmentMain',
                targets: [
                    {
                        format: navigator.gpu.getPreferredCanvasFormat()
                    }
                ]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus'
            }
        });
        
        return true;
    }
    
    // Create or update the bind group with current buffers
    updateBindGroup(projectionBuffer, viewBuffer, uniformBuffer) {
        if (!this.device || !this.bindGroupLayout) return;
        
        // Clean up previous bind group if it exists
        this.bindGroup = null;
        
        // Create new bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: projectionBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: viewBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: uniformBuffer }
                },
                {
                    binding: 3,
                    resource: { buffer: this.kpParamsBuffer }
                }
            ]
        });
    }
    
    render(commandEncoder, textureView, depthTextureView, vertexBuffer, indexBuffer, uniformBuffer, indexCount) {
        if (!this.isInitialized || !this.renderPipeline || !this.isActive) {
            return;
        }
        
        try {
            // Create render pass
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: textureView,
                        clearValue: { r: 0.0, g: 0.0, b: 0.1, a: 1.0 }, // Match Riemann's background color
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
            });
            
            // Get camera buffers
            if (!this.resourceManager || !this.resourceManager.camera) {
                renderPass.end();
                return;
            }
            
            // Safely get camera buffers and check if they're valid
            const cameraBuffers = this.resourceManager.camera.getBuffers();
            if (!cameraBuffers || !cameraBuffers.projectionBuffer || !cameraBuffers.viewBuffer) {
                renderPass.end();
                return;
            }
            
            const { projectionBuffer, viewBuffer } = cameraBuffers;
            
            // Additional safety check for destroyed buffers
            if (!projectionBuffer.size || !viewBuffer.size) {
                console.warn("Camera buffers appear to be destroyed, skipping render");
                renderPass.end();
                return;
            }
            
            // Create or update bind group if needed
            if (!this.bindGroup) {
                this.updateBindGroup(projectionBuffer, viewBuffer, uniformBuffer);
            }
            
            if (!this.bindGroup) {
                renderPass.end();
                return;
            }
            
            // Set pipeline and bind group
            renderPass.setPipeline(this.renderPipeline);
            renderPass.setBindGroup(0, this.bindGroup);
            
            // Set vertex and index buffers
            renderPass.setVertexBuffer(0, vertexBuffer);
            renderPass.setIndexBuffer(indexBuffer, 'uint32');
            
            // Draw
            renderPass.drawIndexed(indexCount);
            
            // End render pass
            renderPass.end();
        } catch (error) {
            console.error("Error in Grid Code Pipeline render:", error);
        }
    }
    
    cleanup() {
        // Mark as not initialized first to prevent further rendering
        this.isInitialized = false;
        this.isActive = false;
        
        try {
            // Proper cleanup with memory manager unregistering
            if (this.shaderModule && this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.shaderModule, 'shaderModules');
                this.shaderModule = null;
            }
            
            if (this.renderPipeline && this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.renderPipeline, 'pipelines');
                this.renderPipeline = null;
            }
            
            if (this.bindGroup && this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.bindGroup, 'bindGroups');
                this.bindGroup = null;
            }
            
            if (this.kpParamsBuffer && this.resourceManager) {
                this.resourceManager.unregisterResource?.(this.kpParamsBuffer, 'buffers');
                this.kpParamsBuffer = null;
            }
            
            // Other resources that don't need special handling
            this.bindGroupLayout = null;
            this.pipelineLayout = null;
            
            // Check if this is a subclass of Pipeline before calling super.cleanup()
            if (Object.getPrototypeOf(this).constructor.name === 'Pipeline' && 
                typeof super.cleanup === 'function') {
                super.cleanup();
            }
            
            // Clear device and resource manager references
            this.device = null;
            this.resourceManager = null;
        } catch (error) {
            console.error("Error during GridCodePipeline cleanup:", error);
        }
    }
}

export default GridCodePipeline; 