@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewport: vec2<f32>;
@group(0) @binding(3) var<storage, read> predatorPos: vec3<f32>;
@group(0) @binding(4) var<storage, read> predatorVel: vec3<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
};

@vertex
fn vertex_main(@location(0) vertex: vec3<f32>) -> VertexOutput {
    let forward = normalize(predatorVel);
    var up = vec3<f32>(0.0, 1.0, 0.0);
    let right = normalize(cross(forward, up));
    up = normalize(cross(right, forward));
    let rot = mat3x3<f32>(right.x, up.x, forward.x, right.y, up.y, forward.y, right.z, up.z, forward.z);
    var out: VertexOutput;
    out.position = projection * view * vec4<f32>(rot * vertex + predatorPos, 1.0);
    out.color = vec3<f32>(1.0, 0.0, 0.0);
    out.normal = normalize(rot * vec3(0.0, 1.0, 0.0));
    return out;
}

@fragment
fn fragment_main(@location(0) color: vec3<f32>, @location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, 1.0);
}