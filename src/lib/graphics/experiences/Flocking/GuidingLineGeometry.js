// GuidingLineGeometry.js

export default class GuidingLineGeometry {
    constructor(device) {
        // Initialize with default positions (to be updated each frame)
        this.vertices = new Float32Array([
            0.0, 0.0, 0.0, // Predator Position
            0.0, 0.0, 0.0  // Target Bird Position
        ]);

        // Create a vertex buffer for the line (2 vertices, each with x, y, z)
        this.vertexBuffer = device.createBuffer({
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
            label: 'Guiding Line Vertex Buffer'
        });

        // Initialize the buffer with default data
        new Float32Array(this.vertexBuffer.getMappedRange()).set(this.vertices);
        this.vertexBuffer.unmap();

        this.vertexCount = 2;
    }

    // Method to update the line's vertices
    update(startPosition, endPosition, device) {
        this.vertices.set(startPosition, 0); // Predator Position
        this.vertices.set(endPosition, 3);   // Target Bird Position

        // Update the GPU buffer with new vertex data
        device.queue.writeBuffer(
            this.vertexBuffer,
            0,
            this.vertices
        );
    }

    getVertexBuffer() {
        return this.vertexBuffer;
    }

    getVertexCount() {
        return this.vertexCount;
    }

    cleanup() {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
            this.vertexBuffer = null;
        }
    }
}