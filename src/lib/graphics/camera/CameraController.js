// CameraController.js
import { vec3 } from 'gl-matrix';

export default class CameraController {
	constructor(camera, target = vec3.fromValues(0, 0, 0), config = {}) {
		this.camera = camera;
		this.target = target;
		
		// Default angles
		this.theta = Math.PI / 2;
		this.phi = Math.PI / 4;
		
		// If camera position is already set (from config), calculate theta and phi from it
		if (camera && camera.position && 
		    (camera.position[0] !== 0 || camera.position[1] !== 0 || camera.position[2] !== 0)) {
			// Calculate relative position from target
			const relX = camera.position[0] - target[0];
			const relY = camera.position[1] - target[1];
			const relZ = camera.position[2] - target[2];
			
			// Calculate distance
			const dist = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
			
			// Calculate phi (vertical angle)
			this.phi = Math.acos(relY / dist);
			
			// Calculate theta (horizontal angle)
			this.theta = Math.atan2(relZ, relX);
			
			// Use this distance instead of the one from config
			this.baseDistance = dist;
			this.distance = dist;
		} else {
			// Use distance from config
			this.baseDistance = config.baseDistance || 4000.0; // Base distance from target, configurable
			this.distance = this.baseDistance; // Initial distance set by zoom
		}
		
		this.currentZoom = 1.0;
		
		this.isDragging = false;
		this.lastMouseX = 0;
		this.lastMouseY = 0;

		// Only update camera position if it's not already set
		if (!camera || !camera.position || 
		    (camera.position[0] === 0 && camera.position[1] === 0 && camera.position[2] === 0)) {
			this.updateCameraPosition();
		}
	}

	startDrag(x, y) {
		this.isDragging = true;
		this.lastMouseX = x;
		this.lastMouseY = y;
	}

	endDrag() {
		this.isDragging = false;
	}

	adjustZoom(deltaZoom) {
		const sensitivity = 0.001; // Zoom sensitivity
		const minZoom = 0.1; // Minimum zoom level
		const maxZoom = 100.0; // Maximum zoom level

		// Adjust the current zoom level and clamp it
		this.currentZoom = Math.min(
			Math.max(this.currentZoom + deltaZoom * sensitivity, minZoom),
			maxZoom
		);

		// Update the distance based on the current zoom
		this.distance = this.baseDistance * this.currentZoom;

		// Update the camera position to reflect the new zoom level
		this.updateCameraPosition();
	}

	handleMouseMove(x, y) {
		if (this.isDragging) {
			const deltaX = x - this.lastMouseX;
			const deltaY = y - this.lastMouseY;

			const sensitivity = 10.0;

			this.theta -= deltaX * sensitivity;
			this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi - deltaY * sensitivity));

			this.updateCameraPosition();

			this.lastMouseX = x;
			this.lastMouseY = y;
		}
	}

	updateCameraPosition() {
		const x = this.target[0] + this.distance * Math.sin(this.phi) * Math.cos(this.theta);
		const y = this.target[1] + this.distance * Math.cos(this.phi);
		const z = this.target[2] + this.distance * Math.sin(this.phi) * Math.sin(this.theta);

		this.camera.position = vec3.fromValues(x, y, z);
		this.camera.updateView();
	}

	updateAspect(width, height) {
		this.camera.updateAspect(width, height);
	}
	
	cleanup() {		
		// Clear references to camera
		this.camera = null;
		
		// Reset state
		this.isDragging = false;
		this.lastMouseX = 0;
		this.lastMouseY = 0;
		this.currentZoom = 1.0;
		
		// Clear target reference
		this.target = null;
	
	}
}

// Camera configurations for each experience
const cameraConfigs = {
	Bird: {
		position: { x: 0, y: 0, z: 30 },
		fov: 40 * (Math.PI / 180),
		baseDistance: 50
	},
	Cube: {
		position: { x: 0, y: 0, z: 5 },
		fov: 60 * (Math.PI / 180),
		baseDistance: 10
	},
	NeuralNet: {
		position: { x: 0, y: 0, z: 15 },
		fov: 45 * (Math.PI / 180),
		baseDistance: 30
	},
	Poincare: {
		position: { x: 0, y: 0, z: 10 },
		fov: 50 * (Math.PI / 180),
		baseDistance: 20
	}
};
