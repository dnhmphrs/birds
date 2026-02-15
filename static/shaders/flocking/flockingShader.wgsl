// flockingShader.wgsl

struct FlockingParams {
    separation: f32,
    alignment: f32,
    cohesion: f32,
    centerGravity: vec4<f32>
};

@group(0) @binding(0) var<uniform> deltaTime: f32;
@group(0) @binding(1) var<storage, read_write> positions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec3<f32>>;
@group(0) @binding(3) var<storage, read_write> phases: array<f32>;
@group(0) @binding(4) var<uniform> flockingParams: FlockingParams;
@group(0) @binding(5) var<storage, read> predatorPosition: vec3<f32>;
@group(0) @binding(6) var<storage, read> predatorVelocity: vec3<f32>;

const SPEED_LIMIT: f32 = 100.0;
const SEPARATION_DISTANCE: f32 = 250.0;
const NEIGHBOR_RADIUS: f32 = 250.0;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    let index = GlobalInvocationID.x;
    if (index >= arrayLength(&positions)) {
        return;
    }

    var velocity = velocities[index];
    var separationForce = vec3<f32>(0.0);
    var alignmentForce = vec3<f32>(0.0);
    var cohesionForce = vec3<f32>(0.0);
    var neighborCount: u32 = 0;

    for (var i: u32 = 0; i < arrayLength(&positions); i = i + 1) {
        if (i == index) { continue; }

        let pos = positions[i];
        let distance = length(pos - positions[index]);

        if (distance < NEIGHBOR_RADIUS) {
            // Separation: Avoid crowding neighbors
            if (distance < SEPARATION_DISTANCE) {
                separationForce = separationForce - normalize(pos - positions[index]) / distance;
            }

            // Alignment: Match velocity with neighbors
            alignmentForce = alignmentForce + velocities[i];

            // Cohesion: Move towards the average position of neighbors
            cohesionForce = cohesionForce + pos;

            neighborCount = neighborCount + 1;
        }
    }

    if (neighborCount > 0) {
        // Alignment: steer towards average velocity
        alignmentForce = alignmentForce / f32(neighborCount);
        alignmentForce = normalize(alignmentForce) * flockingParams.alignment;

        // Cohesion: steer towards average position
        cohesionForce = (cohesionForce / f32(neighborCount)) - positions[index];
        cohesionForce = normalize(cohesionForce) * flockingParams.cohesion;
    }

    // Apply separation force
    velocity = velocity + (separationForce * flockingParams.separation);

    // Apply alignment and cohesion forces
    velocity = velocity + alignmentForce + cohesionForce;

    // Apply center of gravity force
    let centerDirection = normalize(flockingParams.centerGravity.xyz - positions[index]);
    velocity = velocity + centerDirection * 1.25;

    // Predator Repulsion
    let birdPos = positions[index];
    let toPredator = predatorPosition - birdPos;
    let distance = length(toPredator);

    const PREDATOR_INFLUENCE_RADIUS: f32 = 100000.0; // Adjust as needed
    const REPULSION_CONSTANT: f32 = 2000000.0; // Adjust strength as needed

    if (distance < PREDATOR_INFLUENCE_RADIUS && distance > 0.0) {
        let repulsionDir = normalize(birdPos - predatorPosition);
        let repulsionForce = repulsionDir * (REPULSION_CONSTANT / (distance * distance));
        velocity += repulsionForce;
    }

    // Update velocity with accumulated forces
    velocities[index] = velocity;

    // Limit speed to prevent birds from accelerating indefinitely
    let speed = length(velocity);
    if (speed > SPEED_LIMIT) {
        velocity = normalize(velocity) * SPEED_LIMIT;
    }

    // Update position based on velocity
    let newPosition = positions[index] + (velocity * 11.0) * deltaTime;
    positions[index] = newPosition;

    // Update velocity
    velocities[index] = velocity;

    // Update phase
    phases[index] = phases[index] + deltaTime * 5.0; // Adjust speed as needed
    if (phases[index] > 2.0 * 3.14159265359) {
        phases[index] = phases[index] - 2.0 * 3.14159265359;
    }
}