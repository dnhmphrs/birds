// huntingShader.wgsl

// Bind Group Layout Bindings:
// 0: positions (storage buffer, read-only)
// 1: predatorPosition (storage buffer, read-write)
// 2: predatorVelocity (storage buffer, read-write)
// 3: targetIndex (uniform buffer, read-only)
// 4: guidingLineBuffer (storage buffer, read_write)

@group(0) @binding(0) var<storage, read_write> positions: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read_write> predatorPosition: vec3<f32>;
@group(0) @binding(2) var<storage, read_write> predatorVelocity: vec3<f32>;
@group(0) @binding(3) var<uniform> targetIndex: u32;
@group(0) @binding(4) var<storage, read_write> guidingLine: array<vec3<f32>, 2>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    // Ensure only one workgroup runs this shader
    if (GlobalInvocationID.x > 0u) {
        return;
    }

    // // Validate targetIndex
    // if (targetIndex >= positions.length()) {
    //     // Invalid index; do nothing
    //     return;
    // }

    // Retrieve target bird's position
    let targetBirdPos = positions[targetIndex];

    // Calculate the desired direction towards the target bird
    var desiredVelocity = targetBirdPos - predatorPosition;

    // Calculate the distance to the target
    let distance = length(desiredVelocity);

    // Define desired speed
    let DESIRED_SPEED: f32 = 10.0; // Adjust as needed

    // Normalize and scale to desired speed if distance is significant
    if (distance > 1.0) { // Prevent division by zero or negligible movements
        desiredVelocity = normalize(desiredVelocity) * DESIRED_SPEED;
    } else {
        desiredVelocity = vec3<f32>(0.0, 0.0, 0.0);
    }

    // Define steering factor for smooth acceleration/deceleration
    let STEERING_FACTOR: f32 = 0.025; // Adjust for responsiveness

    // Smoothly adjust predator's velocity towards desired velocity
    predatorVelocity = mix(predatorVelocity, desiredVelocity, STEERING_FACTOR);

    // Update predator's position based on new velocity
    predatorPosition += predatorVelocity;

    // Update Guiding Line Buffer
    guidingLine[0] = predatorPosition;
    guidingLine[1] = targetBirdPos;
}