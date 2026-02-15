import { mat4, vec3 } from 'gl-matrix';

export class PredatorCamera {
	constructor(device) {
		this.device = device;
		this.projectionMatrix = mat4.create();
		this.viewMatrix = mat4.create();
		this.position = vec3.create();
		this.target = vec3.create();
		this.aspect = 1;

		this.projectionBuffer = device.createBuffer({
			size: 64,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Predator Projection'
		});

		this.viewBuffer = device.createBuffer({
			size: 64,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Predator View'
		});

		this.updateProjection();
	}

	updateProjection(fov = Math.PI / 4, near = 0.1, far = 25000) {
		mat4.perspective(this.projectionMatrix, fov, this.aspect, near, far);
		this.device.queue.writeBuffer(this.projectionBuffer, 0, this.projectionMatrix);
	}

	updateFromPositionAndTarget(position, target) {
		vec3.copy(this.position, position);
		vec3.copy(this.target, target);
		mat4.lookAt(this.viewMatrix, this.position, this.target, [0, 1, 0]);
		this.updateProjection();
		this.device.queue.writeBuffer(this.viewBuffer, 0, this.viewMatrix);
	}

	destroy() {
		this.projectionBuffer?.destroy();
		this.viewBuffer?.destroy();
	}
}