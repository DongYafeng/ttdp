App({
  globalData: {
    userInfo: null,
    roomInfo: null,
    players: []
  },
  
  onLaunch() {
    console.log('小程序启动')
    
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        // 这里需要替换为你的云开发环境ID
        env: 'your-cloud-env-id', // 请替换为实际的云开发环境ID
        traceUser: true
      })
      console.log('云开发初始化成功')
    } else {
      console.warn('云开发功能不可用，将使用本地二维码生成')
    }
    
    // 不再在启动时获取用户信息，改为在需要时获取
  },
  
  // 获取用户基本信息（使用新的API）
  getUserInfo() {
    return new Promise((resolve, reject) => {
      // 先检查是否已经有用户信息
      if (this.globalData.userInfo) {
        resolve(this.globalData.userInfo)
        return
      }
      
      // 使用默认信息，后续通过头像昵称组件获取真实信息
      const defaultUserInfo = {
        nickName: '微信用户' + Math.floor(Math.random() * 1000),
        avatarUrl: '/images/default-avatar.svg'
      }
      
      this.globalData.userInfo = defaultUserInfo
      resolve(defaultUserInfo)
    })
  },
  
  // 更新用户信息
  updateUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    console.log('用户信息已更新:', userInfo)
  }
})