export default class NeuronGeometry {
	constructor(device) {
		this.device = device;

		// Define neuron vertices as a simple sphere or abstract shape
		const vertices = new Float32Array([
			// Center
			0, 0, 0,
			// Point on the edge
			4.5, 0, 0,
			// Another edge
			0, 4.5, 0,
			// Opposite edge
			-4.5, 0, 0,
			// Another opposite edge
			0, -4.5, 0,
			// Top
			0, 0, 4.5
		]);

		const indices = new Uint16Array([
			// Triangle 1
			0, 1, 2,
			// Triangle 2
			0, 2, 3,
			// Triangle 3
			0, 3, 4,
			// Triangle 4
			0, 4, 1,
			// Top triangle 1
			1, 2, 5,
			// Top triangle 2
			2, 3, 5,
			// Top triangle 3
			3, 4, 5,
			// Top triangle 4
			4, 1, 5
		]);

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

		this.indexCount = indices.length;
	}

	getVertexBuffer() {
		return this.vertexBuffer;
	}

	getIndexBuffer() {
		return this.indexBuffer;
	}

	getIndexCount() {
		return this.indexCount;
	}

	cleanup() {
		if (this.vertexBuffer) this.vertexBuffer.destroy();
		if (this.indexBuffer) this.indexBuffer.destroy();
	}
}
