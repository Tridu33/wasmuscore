import { FFmpeg } from '@ffmpeg/ffmpeg'
// 对url格式的网络视频转码
const ffmpeg = new FFmpeg()
if (!isLoadFfmpegCore) {
  messageText.value = '加载ffmpeg-core.js'
  await ffmpeg.load({
    coreURL: '/static/esm/ffmpeg-core.js',
  })
  isLoadFfmpegCore = true
}

function readFromBlobOrFile(blob) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader()
    fileReader.onload = () => {
      resolve(fileReader.result)
    }
    fileReader.onerror = ({
      target: {
        error: { code },
      },
    }) => {
      reject(new Error(`File could not be read! Code=${code}`))
    }
    fileReader.readAsArrayBuffer(blob)
  })
}
// 读取文件代码
async function fetchFile(_data) {
  let data = _data
  if (typeof _data === 'undefined') {
    return new Uint8Array()
  }

  if (typeof _data === 'string') {
    /* From base64 format */
    if (/data:_data\/([a-zA-Z]*);base64,([^"]*)/.test(_data)) {
      data = atob(_data.split(',')[1])
        .split('')
        .map(c => c.charCodeAt(0))
        /* From remote server/URL */
    }
    else {
      const res = await fetch(new URL(_data, import.meta.url).href)
      data = await res.arrayBuffer()
    }
    /* From Blob or File */
  }
  else if (_data instanceof File || _data instanceof Blob) {
    data = await readFromBlobOrFile(_data)
  }
  return new Uint8Array(data)
}

export default ffmpeg
