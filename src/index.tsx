const canvas = document.getElementById("canvas")! as HTMLCanvasElement;
const gl = canvas.getContext("webgl2", { antialias: false })!;

gl.enable(gl.BLEND);
gl.blendEquation(gl.FUNC_ADD);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.disable(gl.CULL_FACE);
gl.disable(gl.DEPTH_TEST);
gl.enable(gl.SCISSOR_TEST);
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
function fixNormal2f(v: [number, number]) {
  let d2 = v[0] * v[0] + v[1] * v[1];
  if (d2 < 0.5) {
    d2 = 0.5;
  }
  const invLensq = 1.0 / d2;
  v[0] *= invLensq;
  v[1] *= invLensq;
}
function polyLine(
  points: [number, number][],
  color: [number, number, number, number],
  closed: boolean,
  thickness: number
): [Float32Array, Int16Array] {
  const count = closed ? points.length : points.length - 1;
  const AA_SIZE = 1.0;
  const colorTrans = [color[0], color[1], color[2], 0.0] as const;
  const isThickLine = thickness > 1.0;
  const idxCount = isThickLine ? count * 18 : count * 12;
  const vtxCount = isThickLine ? points.length * 4 : points.length * 3;
  const vtxData = new Float32Array(vtxCount * 6);
  const idxData = new Int16Array(idxCount);
  let vtxWritePtr = 0;
  let idxWritePtr = 0;
  let vtxCurrentIdx = 0;
  const tempNormals = new Float32Array(points.length * 2);
  const tempPoints = new Float32Array(
    points.length * (isThickLine ? 2 : 4) * 2
  );
  for (let i1 = 0; i1 < count; i1++) {
    const i2 = i1 + 1 == points.length ? 0 : i1 + 1;
    const p1 = points[i1];
    const p2 = points[i2];
    const d = [p2[0] - p1[0], p2[1] - p1[1]] as [number, number];
    normalize2fOverZero(d);
    tempNormals[i1 * 2 + 0] = d[1];
    tempNormals[i1 * 2 + 1] = -d[0];
  }
  if (!closed) {
    tempNormals[(points.length - 1) * 2 + 0] =
      tempNormals[(points.length - 2) * 2 + 0];
    tempNormals[(points.length - 1) * 2 + 1] =
      tempNormals[(points.length - 2) * 2 + 1];
  }
  if (!isThickLine) {
    const halfDrawSize = AA_SIZE;
    if (!closed) {
      tempPoints[0] = points[0][0] + tempNormals[0] * halfDrawSize;
      tempPoints[1] = points[0][1] + tempNormals[1] * halfDrawSize;
      tempPoints[2] = points[0][0] - tempNormals[0] * halfDrawSize;
      tempPoints[3] = points[0][1] - tempNormals[1] * halfDrawSize;
      tempPoints[(points.length - 1) * 2 + 0] =
        points[points.length - 1][0] +
        tempNormals[(points.length - 1) * 2 + 0] * halfDrawSize;
      tempPoints[(points.length - 1) * 2 + 1] =
        points[points.length - 1][1] +
        tempNormals[(points.length - 1) * 2 + 1] * halfDrawSize;
      tempPoints[(points.length - 1) * 2 + 2] =
        points[points.length - 1][0] -
        tempNormals[(points.length - 1) * 2 + 0] * halfDrawSize;
      tempPoints[(points.length - 1) * 2 + 3] =
        points[points.length - 1][1] -
        tempNormals[(points.length - 1) * 2 + 1] * halfDrawSize;
    }
    let idx1 = vtxCurrentIdx;
    for (let i1 = 0; i1 < count; i1++) {
      const i2 = i1 + 1 == points.length ? 0 : i1 + 1;
      const idx2 = i1 + 1 == points.length ? vtxCurrentIdx : idx1 + 3;

      const dm = [
        (tempNormals[i1 * 2 + 0] + tempNormals[i2 * 2 + 0]) * 0.5,
        (tempNormals[i1 * 2 + 1] + tempNormals[i2 * 2 + 1]) * 0.5,
      ] as [number, number];
      fixNormal2f(dm);
      dm[0] *= halfDrawSize;
      dm[1] *= halfDrawSize;

      tempPoints[i2 * 2 * 2 + 0] = points[i2][0] + dm[0];
      tempPoints[i2 * 2 * 2 + 1] = points[i2][1] + dm[1];
      tempPoints[i2 * 2 * 2 + 2] = points[i2][0] - dm[0];
      tempPoints[i2 * 2 * 2 + 3] = points[i2][1] - dm[1];

      idxData[idxWritePtr + 0] = idx2 + 0;
      idxData[idxWritePtr + 1] = idx1 + 0;
      idxData[idxWritePtr + 2] = idx1 + 2;

      idxData[idxWritePtr + 3] = idx1 + 2;
      idxData[idxWritePtr + 4] = idx2 + 2;
      idxData[idxWritePtr + 5] = idx2 + 0;

      idxData[idxWritePtr + 6] = idx2 + 1;
      idxData[idxWritePtr + 7] = idx1 + 1;
      idxData[idxWritePtr + 8] = idx1 + 0;

      idxData[idxWritePtr + 9] = idx1 + 0;
      idxData[idxWritePtr + 10] = idx2 + 0;
      idxData[idxWritePtr + 11] = idx2 + 1;
      idxWritePtr += 12;

      idx1 = idx2;
    }

    for (let i = 0; i < points.length; i++) {
      vtxData[vtxWritePtr + 0] = points[i][0];
      vtxData[vtxWritePtr + 1] = points[i][1];
      vtxData[vtxWritePtr + 2] = color[0];
      vtxData[vtxWritePtr + 3] = color[1];
      vtxData[vtxWritePtr + 4] = color[2];
      vtxData[vtxWritePtr + 5] = color[3];
      vtxWritePtr += 6;

      vtxData[vtxWritePtr + 0] = tempPoints[i * 2 * 2 + 0];
      vtxData[vtxWritePtr + 1] = tempPoints[i * 2 * 2 + 1];
      vtxData[vtxWritePtr + 2] = colorTrans[0];
      vtxData[vtxWritePtr + 3] = colorTrans[1];
      vtxData[vtxWritePtr + 4] = colorTrans[2];
      vtxData[vtxWritePtr + 5] = colorTrans[3];
      vtxWritePtr += 6;

      vtxData[vtxWritePtr + 0] = tempPoints[i * 2 * 2 + 2];
      vtxData[vtxWritePtr + 1] = tempPoints[i * 2 * 2 + 3];
      vtxData[vtxWritePtr + 2] = colorTrans[0];
      vtxData[vtxWritePtr + 3] = colorTrans[1];
      vtxData[vtxWritePtr + 4] = colorTrans[2];
      vtxData[vtxWritePtr + 5] = colorTrans[3];
      vtxWritePtr += 6;
    }
  }
  return [vtxData, idxData];
}

const points = [];
for (let a = 0; a < 360; a += 5) {
  const rad = (a / 180) * Math.PI;
  const R = 200;
  points.push([Math.cos(rad) * R + 300, Math.sin(rad) * R + 300] as [
    number,
    number
  ]);
}

const [vtxData, idxData] = polyLine(points, [1.0, 1.0, 1.0, 1.0], true, 1);

console.log(points);
console.log(vtxData);
console.log(idxData);
console.log(idxData.reduce((a, b) => Math.max(a, b), 0));

gl.bufferData(gl.ARRAY_BUFFER, vtxData, gl.STATIC_DRAW);

gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);

gl.drawElements(gl.TRIANGLES, idxData.length, gl.UNSIGNED_SHORT, 0);
gl.flush();
