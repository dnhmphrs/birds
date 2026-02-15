// shaders/compute.wgsl

// Define the length of the buffer
const bufferLength: u32 = 256;

@group(0) @binding(0) var<storage, read_write> dataBuffer: array<f32>;

@compute @workgroup_size(64)
fn compute_main(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index < bufferLength) {
        dataBuffer[index] = f32(index) * 10.0; // Some sample computation
    }
}
