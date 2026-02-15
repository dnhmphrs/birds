@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<storage, read> guidingLine: array<vec4<f32>, 2>;

@vertex
fn vertex_main(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
    return projection * view * vec4<f32>(guidingLine[idx].xyz, 1.0);
}

@fragment
fn fragment_main() -> @location(0) vec4<f32> {
    return vec4<f32>(0.0, 1.0, 0.0, 1.0);
}