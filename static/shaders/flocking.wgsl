struct Params { separation: f32, alignment: f32, cohesion: f32, centerGravity: vec4<f32> };

@group(0) @binding(0) var<uniform> dt: f32;
@group(0) @binding(1) var<storage, read_write> positions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec3<f32>>;
@group(0) @binding(3) var<storage, read_write> phases: array<f32>;
@group(0) @binding(4) var<uniform> params: Params;
@group(0) @binding(5) var<storage, read> predatorPos: vec3<f32>;
@group(0) @binding(6) var<storage, read> predatorVel: vec3<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    let count = arrayLength(&positions);
    if (idx >= count) { return; }

    var vel = velocities[idx];
    let pos = positions[idx];
    var sepForce = vec3<f32>(0.0);
    var alignForce = vec3<f32>(0.0);
    var cohesionForce = vec3<f32>(0.0);
    var neighbors: u32 = 0;

    for (var i: u32 = 0; i < count; i++) {
        if (i == idx) { continue; }
        let other = positions[i];
        let dist = length(other - pos);
        if (dist < 250.0) {
            if (dist < 250.0 && dist > 0.0) { sepForce -= normalize(other - pos) / dist; }
            alignForce += velocities[i];
            cohesionForce += other;
            neighbors++;
        }
    }

    if (neighbors > 0) {
        alignForce = normalize(alignForce / f32(neighbors)) * params.alignment;
        cohesionForce = normalize((cohesionForce / f32(neighbors)) - pos) * params.cohesion;
    }

    vel += sepForce * params.separation + alignForce + cohesionForce;
    vel += normalize(params.centerGravity.xyz - pos) * 1.25;

    let predDist = length(predatorPos - pos);
    if (predDist < 100000.0 && predDist > 0.0) {
        vel += normalize(pos - predatorPos) * (2000000.0 / (predDist * predDist));
    }

    let speed = length(vel);
    if (speed > 100.0) { vel = normalize(vel) * 100.0; }

    velocities[idx] = vel;
    positions[idx] = pos + vel * 11.0 * dt;
    phases[idx] = (phases[idx] + dt * 5.0) % 6.28318530718;
}