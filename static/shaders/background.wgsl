struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) fragPos: vec2<f32>,
};

@vertex
fn vertex_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
    var out: VertexOutput;
    out.position = vec4<f32>(pos[idx], 0.0, 1.0);
    out.fragPos = pos[idx];
    return out;
}

@fragment
fn fragment_main(@location(0) fragPos: vec2<f32>) -> @location(0) vec4<f32> {
    let t = (fragPos.y + 1.0) / 2.0;
    return vec4<f32>(mix(vec3(0.2, 0.5, 0.9), vec3(0.4, 0.45, 0.85), t), 1.0);
}