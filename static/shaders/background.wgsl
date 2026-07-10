struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) fragPos: vec2<f32>,
};

struct BgParams {
    frame: vec4<f32>,   // x = time (s), yz = resolution (px)
    camera: vec4<f32>,  // x = yaw (orbit), y = pitch
};
@group(0) @binding(0) var<uniform> u: BgParams;

@vertex
fn vertex_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
    var out: VertexOutput;
    out.position = vec4<f32>(pos[idx], 0.0, 1.0);
    out.fragPos = pos[idx];
    return out;
}

fn hash(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453123);
}

fn vnoise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2<f32>(1.0, 0.0)), u.x),
               mix(hash(i + vec2<f32>(0.0, 1.0)), hash(i + vec2<f32>(1.0, 1.0)), u.x), u.y);
}

fn fbm(p0: vec2<f32>) -> f32 {
    var p = p0;
    var v = 0.0;
    var a = 0.5;
    for (var i = 0; i < 5; i = i + 1) {
        v = v + a * vnoise(p);
        p = p * 2.0;
        a = a * 0.5;
    }
    return v;
}

@fragment
fn fragment_main(@location(0) fragPos: vec2<f32>) -> @location(0) vec4<f32> {
    let t = (fragPos.y + 1.0) / 2.0;
    let sky = mix(vec3<f32>(0.2, 0.5, 0.9), vec3<f32>(0.4, 0.45, 0.85), t);

    // --- mild drifting clouds -------------------------------------------
    // Four knobs to taste (set AMOUNT = 0.0 for no clouds):
    let AMOUNT   = 0.55;                    // max opacity of the clouds
    let COVERAGE = 0.55;                    // 0 = sparse wisps, 1 = overcast
    let SCALE    = 1.10;                    // cloud size (larger = bigger, softer puffs)
    let SPEED    = 0.025;                   // horizontal drift
    let STRETCH  = vec2<f32>(1.0, 1.0);     // soft puffs; wispy streaks: vec2(0.5, 2.4)
    let PARALLAX = 0.15;                    // how strongly clouds track the camera (0 = fixed)

    let time = u.frame.x;
    let aspect = u.frame.y / max(u.frame.z, 1.0);
    let uv = vec2<f32>((fragPos.x * 0.5 + 0.5) * aspect, t);

    var cp = uv * (1.8 / SCALE) * STRETCH;
    cp.x = cp.x + time * SPEED + u.camera.x * PARALLAX;   // slide with orbit
    cp.y = cp.y + u.camera.y * PARALLAX;                  // slide with pitch
    let n = fbm(cp);

    let threshold = mix(0.72, 0.34, COVERAGE);
    let height = smoothstep(0.12, 0.6, t);              // favour the upper sky
    let cloud = smoothstep(threshold, threshold + 0.28, n) * height;

    let cloudCol = mix(sky, vec3<f32>(0.78, 0.86, 0.96), 0.55);
    let col = mix(sky, cloudCol, cloud * AMOUNT);
    return vec4<f32>(col, 1.0);
}
