@vertex
fn vertex_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
    // Slightly inset from edges to avoid clipping
    let lo = -0.999;
    let hi =  0.999;

    // 4 lines forming a rectangle: bottom, right, top, left
    var pos = array<vec2f, 8>(
        vec2f(lo, lo), vec2f(hi, lo),  // bottom
        vec2f(hi, lo), vec2f(hi, hi),  // right
        vec2f(hi, hi), vec2f(lo, hi),  // top
        vec2f(lo, hi), vec2f(lo, lo)   // left
    );

    return vec4f(pos[vi], 0.0, 1.0);
}

@fragment
fn fragment_main() -> @location(0) vec4f {
    return vec4f(0.0, 1.0, 0.0, 1.0);
}