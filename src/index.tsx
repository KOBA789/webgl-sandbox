const canvas = document.getElementById("canvas")! as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);

const vsSource = `#version 300 es
precision mediump float;
layout (location = 0) in vec2 position;
layout (location = 1) in vec4 color;
uniform mat4 projection;
out vec4 fragColor;
void main() {
  fragColor = color;
  gl_Position = projection * vec4(position.xy, 0.0, 1.0);
}
`;

const fsSource = `#version 300 es
precision mediump float;
in vec4 fragColor;
layout (location = 0) out vec4 outColor;
void main() {
  outColor = fragColor;
}
`;

const vs = gl.createShader(gl.VERTEX_SHADER)!;
gl.shaderSource(vs, vsSource);
gl.compileShader(vs);

const vsInfoLog = gl.getShaderInfoLog(vs)!;
if (vsInfoLog.length > 0) {
  throw new Error(vsInfoLog);
}

const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
gl.shaderSource(fs, fsSource);
gl.compileShader(fs);

const fsInfoLog = gl.getShaderInfoLog(fs)!;
if (fsInfoLog.length > 0) {
  throw new Error(fsInfoLog);
}

const shaderProgram = gl.createProgram()!;
gl.attachShader(shaderProgram, vs);
gl.attachShader(shaderProgram, fs);
gl.linkProgram(shaderProgram);

gl.useProgram(shaderProgram);

const attribLocationPosition = 0;
const attribLocationColor = 1;
const attribLocationProjection = gl.getUniformLocation(
  shaderProgram,
  "projection"
)!;

const L = 0;
const R = 1000;
const T = 0;
const B = 1000;
const projection = new Float32Array([
  ...[2.0 / (R - L), 0.0, 0.0, 0.0],
  ...[0.0, 2.0 / (T - B), 0.0, 0.0],
  ...[0.0, 0.0, -1.0, 0.0],
  ...[(R + L) / (L - R), (T + B) / (B - T), 0.0, 1.0],
]);
gl.uniformMatrix4fv(attribLocationProjection, false, projection);

const vbo = gl.createBuffer()!;
const ibo = gl.createBuffer()!;

gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

gl.enableVertexAttribArray(attribLocationPosition);
gl.enableVertexAttribArray(attribLocationColor);
gl.vertexAttribPointer(attribLocationPosition, 2, gl.FLOAT, false, 24, 0);
gl.vertexAttribPointer(attribLocationColor, 4, gl.FLOAT, false, 24, 8);

function normalize2fOverZero(v: [number, number]) {
  const d2 = v[0] * v[0] + v[1] * v[1];
  if (d2 > 0.0) {
    const invLen = 1.0 / Math.sqrt(d2);
    v[0] *= invLen;
    v[1] *= invLen;
  }
}
function polyLine(
  points: [number, number][],
  color: [number, number, number, number],
  closed: boolean,
  thickness: number
): [Float32Array, Int16Array] {
  const count = closed ? points.length : points.length - 1;
  const idxCount = count * 6;
  const vtxCount = count * 4;
  const vtxData = new Float32Array(vtxCount * 6);
  const idxData = new Int16Array(idxCount);
  let vtxWritePtr = 0;
  let idxWritePtr = 0;
  let vtxCurrentIdx = 0;
  for (let i1 = 0; i1 < count; i1++) {
    const i2 = i1 + 1 == points.length ? 0 : i1 + 1;
    const p1 = points[i1];
    const p2 = points[i2];

    const d = [p2[0] - p1[0], p2[1] - p1[1]] as [number, number];
    normalize2fOverZero(d);
    const dx = thickness * 0.5 * d[0];
    const dy = thickness * 0.5 * d[1];

    vtxData[vtxWritePtr + 0] = p1[0] + dy;
    vtxData[vtxWritePtr + 1] = p1[1] - dx;
    vtxData[vtxWritePtr + 2] = color[0];
    vtxData[vtxWritePtr + 3] = color[1];
    vtxData[vtxWritePtr + 4] = color[2];
    vtxData[vtxWritePtr + 5] = color[3];
    vtxWritePtr += 6;

    vtxData[vtxWritePtr + 0] = p2[0] + dy;
    vtxData[vtxWritePtr + 1] = p2[1] - dx;
    vtxData[vtxWritePtr + 2] = color[0];
    vtxData[vtxWritePtr + 3] = color[1];
    vtxData[vtxWritePtr + 4] = color[2];
    vtxData[vtxWritePtr + 5] = color[3];
    vtxWritePtr += 6;

    vtxData[vtxWritePtr + 0] = p2[0] - dy;
    vtxData[vtxWritePtr + 1] = p2[1] + dx;
    vtxData[vtxWritePtr + 2] = color[0];
    vtxData[vtxWritePtr + 3] = color[1];
    vtxData[vtxWritePtr + 4] = color[2];
    vtxData[vtxWritePtr + 5] = color[3];
    vtxWritePtr += 6;

    vtxData[vtxWritePtr + 0] = p1[0] - dy;
    vtxData[vtxWritePtr + 1] = p1[1] + dx;
    vtxData[vtxWritePtr + 2] = color[0];
    vtxData[vtxWritePtr + 3] = color[1];
    vtxData[vtxWritePtr + 4] = color[2];
    vtxData[vtxWritePtr + 5] = color[3];
    vtxWritePtr += 6;

    idxData[idxWritePtr + 0] = vtxCurrentIdx + 0;
    idxData[idxWritePtr + 1] = vtxCurrentIdx + 1;
    idxData[idxWritePtr + 2] = vtxCurrentIdx + 2;
    idxData[idxWritePtr + 3] = vtxCurrentIdx + 0;
    idxData[idxWritePtr + 4] = vtxCurrentIdx + 2;
    idxData[idxWritePtr + 5] = vtxCurrentIdx + 3;
    idxWritePtr += 6;
    vtxCurrentIdx += 4;
  }
  return [vtxData, idxData];
}

const points = [];
for (let a = 0; a < 360; a += 10) {
  const rad = (a / 180) * Math.PI;
  const R = 200;
  points.push([Math.cos(rad) * R + 300, Math.sin(rad) * R + 300] as [
    number,
    number
  ]);
}

const [vtxData, idxData] = polyLine(points, [1.0, 1.0, 1.0, 1.0], true, 10);

console.log(vtxData);
console.log(idxData);

gl.bufferData(gl.ARRAY_BUFFER, vtxData, gl.STATIC_DRAW);

gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);

gl.drawElements(gl.TRIANGLES, idxData.length, gl.UNSIGNED_SHORT, 0);
gl.flush();
