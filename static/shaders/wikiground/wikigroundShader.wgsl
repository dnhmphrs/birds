// --- Uniforms ---
struct GlobeParams { a: f32, f: f32, elevMin: f32, elevMax: f32, baseScale: f32, };
struct TimeParams  { t: f32, radius: f32, pad0: f32, pad1: f32, };

@group(0) @binding(0) var<uniform> uProj : mat4x4<f32>;
@group(0) @binding(1) var<uniform> uView : mat4x4<f32>;
@group(0) @binding(2) var<uniform> uTime : TimeParams;

// Packed RGBA8 height: R=hi, G=lo (UNORM 0..1)
@group(0) @binding(3) var heightTex : texture_2d<f32>;
@group(0) @binding(4) var heightSamp: sampler;
@group(0) @binding(5) var<uniform> globe : GlobeParams;

// --- Tunables ---
const PI : f32 = 3.141592653589793;
const RAD2DEG : f32 = 57.29577951308232;

// Rotate globe yaw if desired
const ROT_Y : f32 = 0.0;

// --- Vertex I/O ---
struct VSIn { @location(0) pos: vec3<f32>, };
struct VSOut {
  @builtin(position) Position : vec4<f32>,
  @location(0) worldPos : vec3<f32>,
  @location(1) lon : f32,
  @location(2) lat : f32,
  @location(3) elevBase : f32,   // meters, no exaggeration (for contours)
  @location(4) elevGeom : f32,   // meters, with exaggeration (geometry)
};

// --- Helpers ---
fn yawY(v: vec3<f32>, ang: f32) -> vec3<f32> {
  let s = sin(ang); let c = cos(ang);
  return vec3<f32>( c*v.x + s*v.z, v.y, -s*v.x + c*v.z );
}

fn cartesianToLonLat(n: vec3<f32>) -> vec2<f32> {
  let r = yawY(normalize(n), ROT_Y); // * sin(uTime.t); // for FUNK
  let lon = atan2(r.z, r.x);               // [-pi, pi]
  //   let lon = atan2(r.x, r.z);                 // funky
  let lat = asin(clamp(r.y, -1.0, 1.0));   // [-pi/2, pi/2]
  return vec2<f32>(lon, lat);
}

fn wrapLon(lon: f32) -> f32 {
  var L = lon;
  if (L >  PI)  { L -= 2.0 * PI; }
  if (L < -PI)  { L += 2.0 * PI; }
  return L;
}

fn lonLatToUV(lon: f32, lat: f32) -> vec2<f32> {
  let lonDeg = lon * RAD2DEG;
  let latDeg = lat * RAD2DEG;
  let eps = 1e-6;
  let u = clamp(fract((lonDeg + 180.0) / 360.0), 0.0 + eps, 1.0 - eps);
  let v = clamp((90.0 - latDeg) / 180.0, 0.0 + eps, 1.0 - eps);
  return vec2<f32>(u, v);
}

fn decodeHeight01(tex: vec4<f32>) -> f32 {
  let hi = tex.r * 255.0;
  let lo = tex.g * 255.0;
  return (hi * 256.0 + lo) / 65535.0; // 0..1
}

fn sampleHeightMeters(lon: f32, lat: f32) -> f32 {
  let uv = lonLatToUV(wrapLon(lon), lat);
  let t = decodeHeight01(textureSampleLevel(heightTex, heightSamp, uv, 0.0));
  return mix(globe.elevMin, globe.elevMax, t); // meters
}

fn geodeticToECEF(lat: f32, lon: f32, h: f32, a: f32, f: f32) -> vec3<f32> {
  let e2 = f * (2.0 - f);
  let sφ = sin(lat); let cφ = cos(lat);
  let sλ = sin(lon); let cλ = cos(lon);
  let N = a / sqrt(1.0 - e2 * sφ * sφ);
  let x = (N + h) * cφ * cλ;
  let y = (N + h) * cφ * sλ;
  let z = (N * (1.0 - e2) + h) * sφ;
  return vec3<f32>(x, y, z) * globe.baseScale;
}

// --- Stages ---
@vertex
fn vertexMain(input: VSIn) -> VSOut {
  let lonlat = cartesianToLonLat(input.pos);

  // Base elevation for contours (no exaggeration)
  let hBase = sampleHeightMeters(lonlat.x, lonlat.y);
  // Geometry elevation (exaggerated by uTime.radius)
  let hGeom = hBase * uTime.radius;

  let world = geodeticToECEF(lonlat.y, lonlat.x, hGeom, globe.a, globe.f);

  var out: VSOut;
  out.worldPos = world;
  out.lon = lonlat.x;
  out.lat = lonlat.y;
  out.elevBase = hBase;
  out.elevGeom = hGeom;
  out.Position = uProj * uView * vec4<f32>(world, 1.0);
  return out;
}

// --- Screen-space contour AA ---
// Constant-width lines in pixels: use reduced value v = h/interval,
// and scale the AA window by fwidth(v).
// Constant-pixel-width contour: 1 at the contour center, 0 outside ~±half_px
fn contour_mask_px(v: f32, half_px: f32) -> f32 {
  // distance to nearest integer (0 at contour, 0.5 midway)
  let g = fract(v);
  let d = min(g, 1.0 - g);

  // AA window in "unit" domain based on how fast v changes per pixel
  let dv = max(fwidth(v), 1e-6);
  let w  = half_px * dv;

  // full at d=0, fades to 0 by d=w
  return 1.0 - smoothstep(0.0, w, d);
}

@fragment
fn fragmentMain(in: VSOut) -> @location(0) vec4<f32> {
  // Black base
  var color = vec3<f32>(0.0 , 0.0 , 0.0);

  // Elevation (meters, un-exaggerated) for contouring
  let h = in.elevBase;
  let isLand = h >= 0.0;

  // Elevation intervals (meters). Tweak to taste.
  let minorIntervalLand = 250.0;
  let majorIntervalLand = 1000.0;
  let minorIntervalSea  = 250.0;
  let majorIntervalSea  = 1000.0;

  // Desired line half-widths **in pixels**
  let MINOR_HALF_PX : f32 = 0.6;   // ~1.2px line
  let MAJOR_HALF_PX : f32 = 1.2;   // ~2.4px line

  // Pick intervals based on land/sea
  var minorInterval = minorIntervalSea;
  var majorInterval = majorIntervalSea;
  if (isLand) {
    minorInterval = minorIntervalLand;
    majorInterval = majorIntervalLand;
  }

  // Reduced values
  let vMinor = h / minorInterval;
  let vMajor = h / majorInterval;

  // Constant-pixel-width contour masks
  let minor = contour_mask_px(vMinor, MINOR_HALF_PX);
  let major = contour_mask_px(vMajor, MAJOR_HALF_PX);

  // Prefer max instead of summed clamp to avoid “filling”
  let line = max(major, minor * 0.6);

  // Line colors
  var lineColor = vec3<f32>(0.35, 0.65 , 1.0); // ocean (blue-ish)
  if (isLand) {
    lineColor = vec3<f32>(0.95, 0.95, 0.95); // land (white)
  }

  // Apply contour lines over black (manual mix to avoid type issues)
  color = color + (lineColor - color) * line;

  return vec4<f32>(color, 1.0);
}
