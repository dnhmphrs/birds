export function createBirdGeometry(device) {
	const vertices = new Float32Array([
		0, 0, -20, 0, -8, 10, 0, 0, 30,
		0, 0, -15, -20, 0, 5, 0, 0, 15,
		0, 0, 15, 20, 0, 5, 0, 0, -15
	]);

	const indices = new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 0]); // pad to 10 (20 bytes)

	const vertexBuffer = device.createBuffer({
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true
	});
	new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
	vertexBuffer.unmap();

	const indexBuffer = device.createBuffer({
		size: indices.byteLength,
		usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true
	});
	new Uint16Array(indexBuffer.getMappedRange()).set(indices);
	indexBuffer.unmap();

	return { vertexBuffer, indexBuffer, indexCount: 9 }; // still only draw 9
}

export function createPredatorGeometry(device) {
	const vertices = new Float32Array([
		0, 0, -60, 0, -12, 15, 0, 0, 35,
		0, 0, -25, -60, 0, 20, 0, 0, 25,
		0, 0, 25, 60, 0, 20, 0, 0, -25
	]);

	const indices = new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 0]); // pad to 10

	const vertexBuffer = device.createBuffer({
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true
	});
	new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
	vertexBuffer.unmap();

	const indexBuffer = device.createBuffer({
		size: indices.byteLength,
		usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true
	});
	new Uint16Array(indexBuffer.getMappedRange()).set(indices);
	indexBuffer.unmap();

	return { vertexBuffer, indexBuffer, indexCount: 9 };
}