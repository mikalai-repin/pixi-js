import { Filter, GlProgram, GpuProgram } from 'pixi.js';

/*
 * Свой фильтр: серость расходится кругом от центра объекта. progress — от 0 (цветной) до 1 (серый целиком)
 */

// --- GLSL (WebGL) ---
// Стандартный вершинный шейдер фильтра PixiJS: растягивает прямоугольник на область фильтра
// и передаёт фрагментному шейдеру координаты во временной текстуре
const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
// highp: в вершинном шейдере эти uniform объявлены с высокой точностью, и здесь точность должна совпадать
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uProgress;

// Ширина размытой границы между серым и цветным: доля расстояния от центра до угла
const float EDGE = 0.2;

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  // Яркость пикселя: зелёный глаз видит лучше всего, синий хуже всего
  vec3 grey = vec3(dot(color.rgb, vec3(0.299, 0.587, 0.114)));
  // Где мы внутри области фильтра, в пикселях, и как далеко от её центра (0 — центр, 1 — угол)
  vec2 pixel = vTextureCoord * uInputSize.xy;
  vec2 center = uOutputFrame.zw * 0.5;
  float distanceToCenter = length(pixel - center) / length(center);
  // Внутри круга радиусом progress — серый, снаружи — цвет, между ними — мягкая граница
  float radius = uProgress * (1.0 + EDGE);
  float amount = 1.0 - smoothstep(radius - EDGE, radius, distanceToCenter);
  finalColor = vec4(mix(color.rgb, grey, amount), color.a);
}`;

// --- WGSL (WebGPU) ---
// Глобальные uniform фильтра PixiJS передаёт в группе 0 вместе с текстурой, наши — в группе 1
const source = `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};
struct GreyUniforms {
  uProgress: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> greyUniforms: GreyUniforms;

const EDGE: f32 = 0.2;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Тот же стандартный вершинный шейдер фильтра, на WGSL
@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return VSOutput(vec4(position, 0.0, 1.0), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(uTexture, uSampler, uv);
  let grey = vec3(dot(color.rgb, vec3(0.299, 0.587, 0.114)));
  let pixel = uv * gfu.uInputSize.xy;
  let center = gfu.uOutputFrame.zw * 0.5;
  let distanceToCenter = length(pixel - center) / length(center);
  let radius = greyUniforms.uProgress * (1.0 + EDGE);
  let amount = 1.0 - smoothstep(radius - EDGE, radius, distanceToCenter);
  return vec4(mix(color.rgb, grey, amount), color.a);
}`;

export class GreyFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex, fragment, name: 'grey-filter' }),
      gpuProgram: GpuProgram.from({
        vertex: { source, entryPoint: 'mainVertex' },
        fragment: { source, entryPoint: 'mainFragment' },
      }),
      // Группа uniform: имя совпадает с greyUniforms в WGSL, uProgress — с uniform в обоих шейдерах
      resources: {
        greyUniforms: { uProgress: { value: 0, type: 'f32' } },
      },
    });
  }

  /** Насколько далеко от центра разошлась серость: 0 — нисколько, 1 — до самых углов */
  get progress() {
    return this.resources.greyUniforms.uniforms.uProgress;
  }

  set progress(value: number) {
    this.resources.greyUniforms.uniforms.uProgress = value;
  }
}
