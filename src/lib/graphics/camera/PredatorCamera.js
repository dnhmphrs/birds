import { mat4, vec3 } from 'gl-matrix';

export default class PredatorCamera {
    constructor(device) {
        this.device = device;
        this.projectionMatrix = mat4.create();
        this.viewMatrix = mat4.create();
        this.position = vec3.fromValues(0, 0, 0);
        this.target = vec3.fromValues(0, 0, 0);  // Add target vector
        this.aspect = 1; // Aspect ratio for the small view

        // Initialize buffers
        this.projectionBuffer = this.createBuffer(64); // 4x4 matrix = 16 floats = 64 bytes
        this.viewBuffer = this.createBuffer(64);       // 4x4 matrix = 16 floats = 64 bytes
        
        // Create buffers for position and target
        this.positionBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Predator Position Buffer'
        });

        this.targetBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Predator Target Buffer'
        });
    }

    createBuffer(size) {
        return this.device.createBuffer({
            size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Predator Camera Buffer'
        });
    }

    updateProjection(fov = Math.PI / 4, near = 0.1, far = 25000) {
        mat4.perspective(this.projectionMatrix, fov, this.aspect, near, far);
        this.updateBuffers();
    }

    updateFromPositionAndTarget(position, target) {
        // Update the local vectors
        this.position = position;
        this.target = target;

        // Update view matrix
        mat4.lookAt(
            this.viewMatrix,
            this.position,
            this.target,
            [0, 1, 0]  // Up vector
        );

        // Use a wider FOV for the predator camera
        this.updateProjection(Math.PI / 4); // 90 degrees FOV
        
        // Update GPU buffers
        this.updateBuffers();
    }

    updateBuffers() {
        if (this.device) {
            this.device.queue.writeBuffer(this.projectionBuffer, 0, this.projectionMatrix);
            this.device.queue.writeBuffer(this.viewBuffer, 0, this.viewMatrix);
        }
    }

    setPosition(position) {
        this.position = position;
    }

    cleanup() {
        if (this.projectionBuffer) {
            this.projectionBuffer.destroy();
            this.projectionBuffer = null;
        }
        if (this.viewBuffer) {
            this.viewBuffer.destroy();
            this.viewBuffer = null;
        }
        if (this.positionBuffer) {
            this.positionBuffer.destroy();
            this.positionBuffer = null;
        }
        if (this.targetBuffer) {
            this.targetBuffer.destroy();
            this.targetBuffer = null;
        }
    }
} 