@group(0) @binding(0) var<storage, read_write> positions: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read_write> predatorPos: vec3<f32>;
@group(0) @binding(2) var<storage, read_write> predatorVel: vec3<f32>;
@group(0) @binding(3) var<uniform> targetIdx: u32;
@group(0) @binding(4) var<storage, read_write> guidingLine: array<vec4<f32>, 2>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x > 0u) { return; }
    let targetPos = positions[targetIdx];
    var desired = targetPos - predatorPos;
    let dist = length(desired);
    if (dist > 1.0) { desired = normalize(desired) * 10.0; } else { desired = vec3(0.0); }
    predatorVel = mix(predatorVel, desired, 0.025);
    predatorPos += predatorVel;
    guidingLine[0] = vec4<f32>(predatorPos, 1.0);
    guidingLine[1] = vec4<f32>(targetPos, 1.0);
}