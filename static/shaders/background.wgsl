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

// Late-evening sundown: a warm dusty horizon rising into deep indigo, so the
// birds read as dark silhouettes against the glow. To try another mood, swap
// the four palette colours below for one of the alternates:
//
//   Ember Horizon  h(0.80,0.48,0.38) lo(0.50,0.27,0.40) up(0.26,0.17,0.34) z(0.12,0.09,0.22)
//   Nightfall      h(0.52,0.30,0.44) lo(0.34,0.20,0.42) up(0.19,0.14,0.34) z(0.08,0.07,0.18)
@fragment
fn fragment_main(@location(0) fragPos: vec2<f32>) -> @location(0) vec4<f32> {
    let t = (fragPos.y + 1.0) / 2.0; // 0 = horizon (bottom), 1 = zenith (top)

    // Deep Dusk
    let horizon = vec3<f32>(0.70, 0.44, 0.40); // warm dusty rose
    let lower   = vec3<f32>(0.46, 0.26, 0.40); // wine / plum
    let upper   = vec3<f32>(0.25, 0.17, 0.34); // royal purple
    let zenith  = vec3<f32>(0.13, 0.10, 0.24); // deep indigo

    var col = mix(horizon, lower, smoothstep(0.0, 0.34, t));
    col = mix(col, upper, smoothstep(0.30, 0.64, t));
    col = mix(col, zenith, smoothstep(0.60, 1.0, t));
    return vec4<f32>(col, 1.0);
}
