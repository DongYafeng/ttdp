// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { roomId, roomName, gameType } = event
    
    if (!roomId) {
      return {
        success: false,
        error: '房间ID不能为空'
      }
    }
    
    // 调用微信官方接口生成小程序码
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: `roomId=${roomId}&t=${Date.now()}`,
      page: 'pages/index/index',
      width: 430,
      autoColor: true,
      lineColor: { r: 0, g: 0, b: 0 },
      isHyaline: true,
      envVersion: 'trial' // 开发版：develop，体验版：trial，正式版：release
    })
    
    if (result.errCode === 0) {
      // 成功生成小程序码
      return {
        success: true,
        qrCodeBuffer: result.buffer,
        contentType: result.contentType,
        roomInfo: {
          roomId,
          roomName,
          gameType,
          timestamp: Date.now()
        }
      }
    } else {
      console.error('生成小程序码失败:', result)
      return {
        success: false,
        error: '生成小程序码失败',
        errCode: result.errCode,
        errMsg: result.errMsg
      }
    }
  } catch (error) {
    console.error('云函数执行失败:', error)
    return {
      success: false,
      error: '云函数执行失败',
      details: error.message
    }
  }
} 