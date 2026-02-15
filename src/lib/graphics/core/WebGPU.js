export async function initWebGPU(canvas) {
	if (!navigator.gpu) {
		throw new Error('WebGPU not supported');
	}

	const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
	if (!adapter) {
		throw new Error('No GPU adapter found');
	}

	const device = await adapter.requestDevice({
		requiredLimits: {
			maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
			maxBufferSize: adapter.limits.maxBufferSize
		}
	});

	const context = canvas.getContext('webgpu');
	const format = navigator.gpu.getPreferredCanvasFormat();

	context.configure({ device, format, alphaMode: 'opaque' });

	return { device, context, format };
}