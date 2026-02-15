import { mousePosition, viewportSize } from '$lib/store/store';

class InteractionManager {
	constructor(canvas, engine) {
		this.canvas = canvas;
		this.engine = engine;
		this.isDragging = false;
		this.lastMouseX = 0;
		this.lastMouseY = 0;

		// Bind methods once
		this.handleResize = this.handleResize.bind(this);
		this.handleMouseMove = this.handleMouseMove.bind(this);
		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handleMouseUp = this.handleMouseUp.bind(this);
		this.handleMouseWheel = this.handleMouseWheel.bind(this);
	}

	initialize() {
		// Set up event listeners using the bound methods
		window.addEventListener('resize', this.handleResize);
		window.addEventListener('mousemove', this.handleMouseMove);
		window.addEventListener('mousedown', this.handleMouseDown);
		window.addEventListener('mouseup', this.handleMouseUp);
		window.addEventListener('wheel', this.handleMouseWheel);

		// Trigger initial resize
		this.handleResize();
	}

	destroy() {		
		// Remove event listeners using the same bound methods
		window.removeEventListener('resize', this.handleResize);
		window.removeEventListener('mousemove', this.handleMouseMove);
		window.removeEventListener('mousedown', this.handleMouseDown);
		window.removeEventListener('mouseup', this.handleMouseUp);
		window.removeEventListener('wheel', this.handleMouseWheel);
		
		// Clear references
		this.canvas = null;
		this.engine = null;
		this.isDragging = false;
		this.lastMouseX = 0;
		this.lastMouseY = 0;
		
		// Reset store values if possible
		try {
			if (typeof mousePosition !== 'undefined' && mousePosition.set) {
				mousePosition.set({ x: 0, y: 0 });
			}
			if (typeof viewportSize !== 'undefined' && viewportSize.set) {
				viewportSize.set({ width: 0, height: 0 });
			}
		} catch (e) {
			console.error("Error resetting store values:", e);
		}
	
	}

	handleResize() {
		const devicePixelRatio = window.devicePixelRatio || 1;
		const width = Math.floor(this.canvas.clientWidth * devicePixelRatio);
		const height = Math.floor(this.canvas.clientHeight * devicePixelRatio);

		viewportSize.set({ width, height });

		// Notify the engine to update viewport-dependent components
		if (this.engine) {
			this.engine.updateViewport(width, height);
		}
	}

	handleMouseMove(event) {
		const rect = this.canvas.getBoundingClientRect();
		const mouseX = (event.clientX - rect.left) / rect.width;
		const mouseY = (event.clientY - rect.top) / rect.height;

		mousePosition.set({ x: mouseX, y: mouseY });

		// Update the pipelines with the mouse position
		if (this.engine?.resourceManager) {
			this.engine.resourceManager.updateMousePosition(mouseX, mouseY);
		}

		// If dragging, update the camera controller
		if (this.isDragging && this.engine?.cameraController) {
			this.engine.cameraController.handleMouseMove(mouseX, mouseY);
		}
	}

	handleMouseDown(event) {
		this.isDragging = true;

		const rect = this.canvas.getBoundingClientRect();
		const mouseX = (event.clientX - rect.left) / rect.width;
		const mouseY = (event.clientY - rect.top) / rect.height;

		mousePosition.set({ x: mouseX, y: mouseY });

		// Notify the engine's camera controller
		if (this.engine) {
			this.engine.cameraController.startDrag(mouseX, mouseY);
		}
	}

	handleMouseUp() {
		this.isDragging = false;

		// Notify the engine's camera controller
		if (this.engine) {
			this.engine.cameraController.endDrag();
		}
	}

	handleMouseWheel(event) {
		const zoomDelta = event.deltaY;
		this.engine.cameraController.adjustZoom(zoomDelta);
	}
}

export default InteractionManager;
