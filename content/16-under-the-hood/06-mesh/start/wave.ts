import { Shader, type Texture } from 'pixi.js';

/*
 * Шейдер волны для меша. Одна и та же программа записана дважды: на GLSL для WebGL и на WGSL для WebGPU.
 * Рендерер возьмёт ту, на которой рисует сам
 */

// --- GLSL (WebGL) ---
// Вершинный шейдер: запускается для каждой вершины и решает, где она окажется на экране
const vertex = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uTime;

void main() {
  vec2 position = aPosition;
  // Волна: вершина сдвигается вбок тем сильнее, чем ниже она стоит
  position.x += sin(position.y * 0.05 + uTime * 4.0) * 12.0 * aUV.y;
  // Те же преобразования, что делает PixiJS для любого объекта: локальные → мировые → экран
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(position, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

// Фрагментный шейдер: запускается для каждого пикселя и решает, какого он цвета
const fragment = `
in vec2 vUV;
out vec4 finalColor;

uniform sampler2D uTexture;

void main() {
  finalColor = texture(uTexture, vUV);
}`;

// --- WGSL (WebGPU) ---
// Группы 0 и 1 PixiJS заполняет сам: глобальные матрицы и матрица объекта. Группа 2 — наши ресурсы
const source = `
struct GlobalUniforms {
  uProjectionMatrix: mat3x3<f32>,
  uWorldTransformMatrix: mat3x3<f32>,
  uWorldColorAlpha: vec4<f32>,
  uResolution: vec2<f32>,
};
struct LocalUniforms {
  uTransformMatrix: mat3x3<f32>,
  uColor: vec4<f32>,
  uRound: f32,
};
struct WaveUniforms {
  uTime: f32,
};

@group(0) @binding(0) var<uniform> globalUniforms: GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms: LocalUniforms;
@group(2) @binding(0) var uTexture: texture_2d<f32>;
@group(2) @binding(1) var uSampler: sampler;
@group(2) @binding(2) var<uniform> waveUniforms: WaveUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>, @location(1) aUV: vec2<f32>) -> VertexOutput {
  var position = aPosition;
  position.x += sin(position.y * 0.05 + waveUniforms.uTime * 4.0) * 12.0 * aUV.y;
  let mvp = globalUniforms.uProjectionMatrix * globalUniforms.uWorldTransformMatrix * localUniforms.uTransformMatrix;
  return VertexOutput(vec4<f32>((mvp * vec3<f32>(position, 1.0)).xy, 0.0, 1.0), aUV);
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, uv);
}`;

/** Шейдер волны с картинкой texture. Время волны — uniform uTime в группе waveUniforms */
export function createWaveShader(texture: Texture) {
  return Shader.from({
    gl: { vertex, fragment },
    gpu: {
      vertex: { source, entryPoint: 'mainVertex' },
      fragment: { source, entryPoint: 'mainFragment' },
    },
    // Ресурсы находятся по именам: uTexture и uSampler — в обоих шейдерах, uTime — внутри waveUniforms
    resources: {
      uTexture: texture.source,
      uSampler: texture.source.style,
      waveUniforms: { uTime: { value: 0, type: 'f32' } },
    },
  });
}
