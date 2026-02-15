import { mat4, vec3 } from 'gl-matrix';

export class Camera {
	constructor(device, width, height) {
		this.device = device;
		this.position = vec3.fromValues(0, 2000, 4000);
		this.target = vec3.fromValues(0, 0, 0);
		this.up = vec3.fromValues(0, 1, 0);
		this.fov = 40 * (Math.PI / 180);
		this.aspect = width / height;
		this.near = 0.1;
		this.far = 100000;

		this.projectionMatrix = mat4.create();
		this.viewMatrix = mat4.create();

		this.projectionBuffer = device.createBuffer({
			size: 64,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Projection'
		});

		this.viewBuffer = device.createBuffer({
			size: 64,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'View'
		});

		this.update();
	}

	update() {
		mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far);
		mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
		this.device.queue.writeBuffer(this.projectionBuffer, 0, this.projectionMatrix);
		this.device.queue.writeBuffer(this.viewBuffer, 0, this.viewMatrix);
	}

	resize(width, height) {
		this.aspect = width / height;
		this.update();
	}

	destroy() {
		this.projectionBuffer?.destroy();
		this.viewBuffer?.destroy();
	}
}

export class CameraController {
	constructor(camera) {
		this.camera = camera;
		this.distance = vec3.length(camera.position);
		this.theta = Math.atan2(camera.position[2], camera.position[0]);
		this.phi = Math.acos(camera.position[1] / this.distance);
		this.isDragging = false;
		this.lastX = 0;
		this.lastY = 0;
	}

	onMouseDown(x, y) {
		this.isDragging = true;
		this.lastX = x;
		this.lastY = y;
	}

	onMouseUp() {
		this.isDragging = false;
	}

	onMouseMove(x, y) {
		if (!this.isDragging) return;

		const dx = x - this.lastX;
		const dy = y - this.lastY;
		const sensitivity = 5.0;

		this.theta -= dx * sensitivity;
		this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi - dy * sensitivity));

		this.updatePosition();
		this.lastX = x;
		this.lastY = y;
	}

	onWheel(delta) {
		const zoomSpeed = 0.001;
		this.distance = Math.max(100, Math.min(50000, this.distance * (1 + delta * zoomSpeed)));
		this.updatePosition();
	}

	updatePosition() {
		const x = this.distance * Math.sin(this.phi) * Math.cos(this.theta);
		const y = this.distance * Math.cos(this.phi);
		const z = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
		vec3.set(this.camera.position, x, y, z);
		this.camera.update();
	}
}