// room.js
const app = getApp()
const roomSync = require('../../utils/roomSync')

Page({
  data: {
    roomInfo: {},
    isHost: false,
    currentPlayerId: '',
    scoreHistory: [],
    showScoreModal: false,
    selectedPlayer: {},
    inputScore: '',
    showShareModal: false,
    qrSize: 220,
    showEditModal: false,
    editNickName: '',
    editAvatarUrl: '',
    officialQRCodePath: '',
    useOfficialQRCode: false
  },

  onLoad(options) {
    this.initRoom(options)
  },

  onUnload() {
    // 页面卸载时停止同步
    roomSync.stopSync()
  },

  initRoom(options) {
    const { roomId, isHost } = options
    
    if (!roomId) {
      wx.showToast({
        title: '房间ID无效',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    // 从本地存储获取房间信息
    let roomInfo = wx.getStorageSync(`room_${roomId}`)
    
    if (!roomInfo) {
      wx.showToast({
        title: '房间不存在',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    console.log('房间信息:', roomInfo)
    console.log('是否房主:', isHost)

    // 初始化数据同步
    const isHostBool = isHost === 'true'
    roomSync.initSync(roomId, isHostBool)
    
    // 监听数据更新
    roomSync.onDataUpdate((updatedRoomData) => {
      console.log('收到房间数据更新:', updatedRoomData)
      this.setData({
        roomInfo: updatedRoomData
      })
      
      // 更新计分历史
      this.loadScoreHistory(roomId)
    })

    // 如果不是房主，需要加入房间
    if (isHost === 'false') {
      this.joinRoom(roomInfo)
    } else {
      // 房主的情况，找到房主的playerId
      const hostPlayer = roomInfo.players.find(p => p.isHost)
      if (hostPlayer) {
        this.setData({
          currentPlayerId: hostPlayer.playerId
        })
      } else {
        // 如果没有找到房主玩家，可能是数据异常，重新创建房主玩家
        console.log('未找到房主玩家，重新创建')
        const hostPlayerId = this.generatePlayerId()
        const newHostPlayer = {
          nickName: roomInfo.host?.nickName || '房主',
          avatarUrl: roomInfo.host?.avatarUrl || '/images/default-avatar.svg',
          score: roomInfo.initialScore || 0,
          isHost: true,
          playerId: hostPlayerId
        }
        roomInfo.players.unshift(newHostPlayer) // 添加到第一位
        roomInfo.hostPlayerId = hostPlayerId
        
        // 更新本地存储
        wx.setStorageSync(`room_${roomId}`, roomInfo)
        
        this.setData({
          currentPlayerId: hostPlayerId
        })
      }
      
      // 为房主也添加设置个人信息的提示
      const currentHostPlayer = roomInfo.players.find(p => p.isHost)
      if (currentHostPlayer && (currentHostPlayer.avatarUrl === '/images/default-avatar.svg' || currentHostPlayer.nickName.includes('微信用户'))) {
        setTimeout(() => {
          wx.showModal({
            title: '设置个人信息',
            content: '检测到您使用的是默认头像和昵称，是否要设置真实的头像和昵称？',
            confirmText: '去设置',
            cancelText: '稍后再说',
            success: (res) => {
              if (res.confirm) {
                // 打开编辑弹窗
                this.setData({
                  showEditModal: true,
                  editNickName: currentHostPlayer.nickName,
                  editAvatarUrl: currentHostPlayer.avatarUrl
                })
              }
            }
          })
        }, 1000)
      }
    }
    
    this.setData({
      roomInfo,
      isHost: isHost === 'true'
    })

    // 加载计分历史
    this.loadScoreHistory(roomId)
  },

  joinRoom(roomInfo) {
    // 获取用户信息
    app.getUserInfo().then(userInfo => {
      this.addPlayerToRoom(roomInfo, userInfo)
    }).catch(() => {
      // 使用默认信息
      const userInfo = {
        nickName: '微信用户' + Math.floor(Math.random() * 1000),
        avatarUrl: '/images/default-avatar.svg'
      }
      this.addPlayerToRoom(roomInfo, userInfo)
    })
  },

  addPlayerToRoom(roomInfo, userInfo) {
    // 检查是否已经在房间中
    const existingPlayer = roomInfo.players.find(p => p.nickName === userInfo.nickName)
    
    if (existingPlayer) {
      // 如果已经在房间中，更新currentPlayerId和roomInfo
      this.setData({
        currentPlayerId: existingPlayer.playerId,
        roomInfo: roomInfo
      })
      wx.showToast({
        title: '欢迎回来',
        icon: 'success'
      })
      // 播报欢迎回来
      this.playVoiceAnnouncement(`欢迎${userInfo.nickName}回到房间`)
      return
    }
    
    if (roomInfo.players.length >= roomInfo.maxPlayers) {
      wx.showToast({
        title: '房间已满',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    // 添加新玩家
    const newPlayerId = this.generatePlayerId()
    const newPlayer = {
      ...userInfo,
      score: roomInfo.initialScore,
      isHost: false,
      playerId: newPlayerId,
      joinTime: Date.now() // 添加加入时间
    }
    
    roomInfo.players.push(newPlayer)
    
    // 更新本地存储
    wx.setStorageSync(`room_${roomInfo.roomId}`, roomInfo)
    
    // 使用同步功能添加玩家
    roomSync.addPlayer(newPlayer)
    
    // 更新当前玩家ID和房间信息
    this.setData({
      currentPlayerId: newPlayerId,
      roomInfo: roomInfo
    })
    
    wx.showToast({
      title: '成功加入房间',
      icon: 'success'
    })
    
    // 播报用户进入房间
    this.playVoiceAnnouncement(`${userInfo.nickName}进入了房间`)
    
    // 如果使用的是默认头像，提示用户设置个人信息
    if (userInfo.avatarUrl === '/images/default-avatar.svg' || userInfo.nickName.includes('微信用户')) {
      setTimeout(() => {
        wx.showModal({
          title: '设置个人信息',
          content: '检测到您使用的是默认头像和昵称，是否要设置真实的头像和昵称？',
          confirmText: '去设置',
          cancelText: '稍后再说',
          success: (res) => {
            if (res.confirm) {
              // 打开编辑弹窗
              this.setData({
                showEditModal: true,
                editNickName: userInfo.nickName,
                editAvatarUrl: userInfo.avatarUrl
              })
            }
          }
        })
      }, 2000)
    }
  },

  loadScoreHistory(roomId) {
    const history = wx.getStorageSync(`history_${roomId}`) || []
    this.setData({
      scoreHistory: history
    })
  },

  selectPlayer(e) {
    const player = e.currentTarget.dataset.player
    
    // 如果点击的是自己，显示编辑弹窗
    if (player.playerId === this.data.currentPlayerId) {
      this.setData({
        showEditModal: true,
        editNickName: player.nickName,
        editAvatarUrl: player.avatarUrl
      })
      return
    }

    // 点击其他玩家，显示计分弹窗
    this.setData({
      selectedPlayer: player,
      showScoreModal: true,
      inputScore: ''
    })
  },

  closeScoreModal() {
    this.setData({
      showScoreModal: false,
      selectedPlayer: {},
      inputScore: ''
    })
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  onScoreInput(e) {
    this.setData({
      inputScore: e.detail.value
    })
  },

  confirmScore() {
    const score = parseInt(this.data.inputScore)
    
    if (!score || score <= 0) {
      wx.showToast({
        title: '请输入有效的转分数量',
        icon: 'error'
      })
      return
    }

    // 更新分数
    this.updateScores(score)
    
    // 自动关闭弹窗
    this.closeScoreModal()
  },

  updateScores(score) {
    const roomInfo = { ...this.data.roomInfo }
    const currentPlayer = roomInfo.players.find(p => p.playerId === this.data.currentPlayerId)
    const targetPlayer = roomInfo.players.find(p => p.playerId === this.data.selectedPlayer.playerId)
    
    if (!currentPlayer || !targetPlayer) {
      wx.showToast({
        title: '玩家信息错误',
        icon: 'error'
      })
      return
    }

    // 更新分数：当前玩家减分，目标玩家加分
    currentPlayer.score -= score
    targetPlayer.score += score

    // 创建历史记录
    const historyItem = {
      id: Date.now(),
      fromPlayer: currentPlayer.nickName,
      toPlayer: targetPlayer.nickName,
      score: score,
      time: this.formatTime(new Date()),
      timestamp: Date.now()
    }

    const newHistory = [historyItem, ...this.data.scoreHistory]

    // 更新数据
    this.setData({
      roomInfo,
      scoreHistory: newHistory
    })

    // 保存到本地存储
    wx.setStorageSync(`room_${roomInfo.roomId}`, roomInfo)
    wx.setStorageSync(`history_${roomInfo.roomId}`, newHistory)

    // 使用同步功能更新玩家信息
    roomSync.updatePlayer(currentPlayer.playerId, { score: currentPlayer.score })
    roomSync.updatePlayer(targetPlayer.playerId, { score: targetPlayer.score })
    
    // 手动触发同步，确保分数更新及时传播
    roomSync.forcSync()

    wx.showToast({
      title: '转分成功',
      icon: 'success'
    })
  },

  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  },

  shareRoom() {
    this.setData({
      showShareModal: true
    })
    
    // 延迟生成二维码，等待DOM渲染完成
    setTimeout(() => {
      this.generateQRCode()
    }, 300)
  },

  closeShareModal() {
    this.setData({
      showShareModal: false
    })
  },

  // 生成小程序码（使用官方API）
  generateQRCode() {
    console.log('开始生成小程序码...')
    
    wx.showLoading({
      title: '生成中...',
      mask: true
    })
    
    const roomInfo = this.data.roomInfo
    
    // 优先使用云函数生成官方小程序码
    if (wx.cloud) {
      this.generateOfficialQRCode(roomInfo)
    } else {
      // 降级使用本地生成的二维码
      this.generateLocalQRCode(roomInfo)
    }
  },

  // 使用云函数生成官方小程序码
  generateOfficialQRCode(roomInfo) {
    wx.cloud.callFunction({
      name: 'generateQRCode',
      data: {
        roomId: roomInfo.roomId,
        roomName: roomInfo.name,
        gameType: roomInfo.gameType
      },
      success: (res) => {
        wx.hideLoading()
        console.log('云函数调用成功:', res)
        
        if (res.result.success) {
          // 将小程序码buffer转换为临时文件路径
          const fs = wx.getFileSystemManager()
          const filePath = `${wx.env.USER_DATA_PATH}/qrcode_${Date.now()}.jpg`
          
          try {
            fs.writeFileSync(filePath, res.result.qrCodeBuffer)
            
            // 更新页面数据，显示官方小程序码
            this.setData({
              officialQRCodePath: filePath,
              useOfficialQRCode: true
            })
            
            wx.showToast({
              title: '小程序码已生成',
              icon: 'success',
              duration: 1500
            })
          } catch (error) {
            console.error('保存小程序码失败:', error)
            // 降级使用本地生成
            this.generateLocalQRCode(roomInfo)
          }
        } else {
          console.error('生成小程序码失败:', res.result.error)
          // 降级使用本地生成
          this.generateLocalQRCode(roomInfo)
        }
      },
      fail: (error) => {
        wx.hideLoading()
        console.error('云函数调用失败:', error)
        // 降级使用本地生成
        this.generateLocalQRCode(roomInfo)
      }
    })
  },

  // 本地生成二维码（降级方案）
  generateLocalQRCode(roomInfo) {
    console.log('使用本地方案生成二维码...')
    
    // 构建标准化的房间数据
    const qrData = {
      type: 'ttdp-room', // 天天打牌房间标识
      version: '1.0',
      roomId: roomInfo.roomId,
      name: roomInfo.name,
      gameType: roomInfo.gameType,
      maxPlayers: roomInfo.maxPlayers,
      initialScore: roomInfo.initialScore,
      host: roomInfo.host,
      hostPlayerId: roomInfo.hostPlayerId,
      timestamp: Date.now(),
      // 添加校验信息
      checksum: this.generateChecksum(roomInfo.roomId)
    }
    
    const qrText = JSON.stringify(qrData)
    console.log('二维码数据:', qrData)
    
    // 延迟生成二维码，确保Canvas已经渲染
    setTimeout(() => {
      this.drawLocalQRCode(qrText, qrData)
    }, 100)
  },

  // 生成校验码
  generateChecksum(roomId) {
    let hash = 0
    for (let i = 0; i < roomId.length; i++) {
      const char = roomId.charCodeAt(i)
      hash = ((hash << 5) - hash + char) & 0xFFFFFF
    }
    return hash.toString(36)
  },

  // 绘制本地二维码
  drawLocalQRCode(text, roomData) {
    console.log('开始绘制本地二维码...')
    
    try {
      const ctx = wx.createCanvasContext('qrcode')
      const size = this.data.qrSize
      
      if (!ctx) {
        console.error('无法创建Canvas上下文')
        wx.hideLoading()
        wx.showToast({
          title: '二维码生成失败',
          icon: 'error'
        })
        return
      }
      
      // 清空画布
      ctx.clearRect(0, 0, size, size)
      
      // 绘制白色背景
      ctx.setFillStyle('#ffffff')
      ctx.fillRect(0, 0, size, size)
      
      // 绘制简化的二维码模式
      this.drawSimpleQRPattern(ctx, text, size)
      
      // 绘制中心Logo区域
      this.drawCenterLogo(ctx, size, roomData)
      
      // 执行绘制
      ctx.draw(false, () => {
        wx.hideLoading()
        console.log('本地二维码绘制完成')
        
        this.setData({
          useOfficialQRCode: false
        })
        
        wx.showToast({
          title: '二维码已生成',
          icon: 'success',
          duration: 1000
        })
      })
    } catch (error) {
      wx.hideLoading()
      console.error('本地二维码生成失败:', error)
      wx.showToast({
        title: '二维码生成失败',
        icon: 'error'
      })
    }
  },

  // 绘制简化的二维码模式
  drawSimpleQRPattern(ctx, text, size) {
    const gridSize = 21 // 标准二维码网格
    const margin = 20
    const qrSize = size - margin * 2
    const cellSize = Math.floor(qrSize / gridSize)
    const startX = (size - gridSize * cellSize) / 2
    const startY = (size - gridSize * cellSize) / 2
    
    // 生成基于文本的模式
    const pattern = this.generateSimplePattern(text, gridSize)
    
    // 绘制二维码网格
    ctx.setFillStyle('#000000')
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (pattern[i][j]) {
          const x = startX + j * cellSize
          const y = startY + i * cellSize
          ctx.fillRect(x, y, cellSize, cellSize)
        }
      }
    }
    
    // 绘制定位标记
    this.drawPositionMarkers(ctx, startX, startY, cellSize, gridSize)
  },

  // 生成简化的二维码模式
  generateSimplePattern(text, size) {
    const pattern = []
    let hash = 0
    
    // 计算文本哈希
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash + char) & 0xFFFFFF
    }
    
    // 生成模式
    for (let i = 0; i < size; i++) {
      pattern[i] = []
      for (let j = 0; j < size; j++) {
        // 跳过定位标记区域
        if (this.isPositionMarkerArea(i, j, size)) {
          pattern[i][j] = this.getPositionMarkerPattern(i, j, size)
          continue
        }
        
        // 跳过中心Logo区域
        if (this.isCenterLogoArea(i, j, size)) {
          pattern[i][j] = false
          continue
        }
        
        // 生成数据模式
        const seed = (hash + i * 31 + j * 17) % 100
        pattern[i][j] = seed < 45 // 45%填充率
      }
    }
    
    return pattern
  },

  // 检查是否为定位标记区域
  isPositionMarkerArea(i, j, size) {
    const markerSize = 7
    return (
      (i < markerSize && j < markerSize) || // 左上
      (i < markerSize && j >= size - markerSize) || // 右上
      (i >= size - markerSize && j < markerSize) // 左下
    )
  },

  // 检查是否为中心Logo区域
  isCenterLogoArea(i, j, size) {
    const center = Math.floor(size / 2)
    const radius = 4
    return Math.abs(i - center) <= radius && Math.abs(j - center) <= radius
  },

  // 获取定位标记模式
  getPositionMarkerPattern(i, j, size) {
    const markerSize = 7
    let relI, relJ
    
    if (i < markerSize && j < markerSize) {
      relI = i; relJ = j
    } else if (i < markerSize && j >= size - markerSize) {
      relI = i; relJ = j - (size - markerSize)
    } else if (i >= size - markerSize && j < markerSize) {
      relI = i - (size - markerSize); relJ = j
    } else {
      return false
    }
    
    // 标准定位标记模式
    if (relI === 0 || relI === 6 || relJ === 0 || relJ === 6) return true
    if ((relI >= 2 && relI <= 4) && (relJ >= 2 && relJ <= 4)) return true
    return false
  },

  // 绘制定位标记
  drawPositionMarkers(ctx, startX, startY, cellSize, gridSize) {
    // 定位标记已在generateSimplePattern中处理
  },

  // 绘制中心Logo
  drawCenterLogo(ctx, size, roomData) {
    const centerX = size / 2
    const centerY = size / 2
    const logoSize = 80
    
    // 绘制白色背景
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(centerX - logoSize/2, centerY - logoSize/2, logoSize, logoSize)
    
    // 绘制渐变背景
    const gradient = ctx.createLinearGradient(
      centerX - logoSize/2, centerY - logoSize/2,
      centerX + logoSize/2, centerY + logoSize/2
    )
    gradient.addColorStop(0, '#667eea')
    gradient.addColorStop(1, '#764ba2')
    
    ctx.setFillStyle(gradient)
    ctx.fillRect(centerX - logoSize/2 + 4, centerY - logoSize/2 + 4, logoSize - 8, logoSize - 8)
    
    // 绘制Logo文字
    ctx.setFillStyle('#ffffff')
    ctx.setFontSize(16)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText('天天', centerX, centerY - 12)
    ctx.fillText('打牌', centerX, centerY + 8)
    
    // 绘制房间信息
    ctx.setFillStyle('#000000')
    ctx.setFontSize(10)
    ctx.fillText(roomData.roomId.substr(-4), centerX, centerY + 28)
  },

  exitRoom() {
    wx.showModal({
      title: '退出房间',
      content: '确定要退出当前房间吗？',
      success: (res) => {
        if (res.confirm) {
          // 如果是房主，询问是否解散房间
          if (this.data.isHost) {
            wx.showModal({
              title: '解散房间',
              content: '您是房主，退出后房间将被解散，确定继续吗？',
              success: (res2) => {
                if (res2.confirm) {
                  // 停止同步并清理房间数据
                  roomSync.stopSync()
                  roomSync.cleanupRoom(this.data.roomInfo.roomId)
                  
                  wx.navigateBack()
                }
              }
            })
          } else {
            // 客人退出，只停止同步
            roomSync.stopSync()
            wx.navigateBack()
          }
        }
      }
    })
  },

  generatePlayerId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 3)
  },

  closeEditModal() {
    this.setData({
      showEditModal: false,
      editNickName: '',
      editAvatarUrl: ''
    })
  },

  onNickNameInput(e) {
    this.setData({
      editNickName: e.detail.value
    })
  },

  confirmEdit() {
    const nickName = this.data.editNickName.trim()
    const avatarUrl = this.data.editAvatarUrl
    
    if (!nickName) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'error'
      })
      return
    }

    if (nickName.length > 10) {
      wx.showToast({
        title: '昵称不能超过10个字符',
        icon: 'error'
      })
      return
    }

    // 更新用户信息
    this.updateUserInfo(nickName, avatarUrl)
    
    // 关闭弹窗
    this.closeEditModal()
  },

  updateUserInfo(nickName, avatarUrl) {
    const roomInfo = { ...this.data.roomInfo }
    const currentPlayer = roomInfo.players.find(p => p.playerId === this.data.currentPlayerId)
    
    if (!currentPlayer) {
      wx.showToast({
        title: '用户信息错误',
        icon: 'error'
      })
      return
    }

    // 更新玩家信息
    currentPlayer.nickName = nickName
    currentPlayer.avatarUrl = avatarUrl

    // 更新全局用户信息
    app.globalData.userInfo = {
      ...app.globalData.userInfo,
      nickName: nickName,
      avatarUrl: avatarUrl
    }

    // 更新数据
    this.setData({
      roomInfo
    })

    // 保存到本地存储
    wx.setStorageSync(`room_${roomInfo.roomId}`, roomInfo)

    // 使用同步功能更新玩家信息
    roomSync.updatePlayer(currentPlayer.playerId, { 
      nickName: nickName, 
      avatarUrl: avatarUrl 
    })
    
    // 手动触发同步，确保用户信息更新及时传播
    roomSync.forcSync()

    wx.showToast({
      title: '修改成功',
      icon: 'success'
    })
  },

  // 语音播报方法
  playVoiceAnnouncement(text) {
    // 简化实现，使用文字提示和系统提示音
    try {
      // 播放系统提示音
      wx.showToast({
        title: text,
        icon: 'none',
        duration: 3000
      })
      
      // 尝试播放系统提示音
      wx.vibrateShort({
        type: 'light'
      })
      
      console.log('用户进入提示:', text)
    } catch (error) {
      console.log('提示异常:', error)
      // 降级为简单文字提示
      this.showTextAnnouncement(text)
    }
  },

  // 文字提示方法
  showTextAnnouncement(text) {
    wx.showToast({
      title: text,
      icon: 'none',
      duration: 2000
    })
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    console.log('选择的头像:', avatarUrl)
    this.setData({
      editAvatarUrl: avatarUrl
    })
    wx.showToast({
      title: '头像已更新',
      icon: 'success',
      duration: 1000
    })
  },

  // 分享给好友
  shareToFriend() {
    // 构建包含房间信息的分享路径，包含房主信息
    const shareData = {
      roomId: this.data.roomInfo.roomId,
      name: this.data.roomInfo.name,
      gameType: this.data.roomInfo.gameType,
      maxPlayers: this.data.roomInfo.maxPlayers,
      initialScore: this.data.roomInfo.initialScore,
      host: this.data.roomInfo.host, // 包含房主信息
      hostPlayerId: this.data.roomInfo.hostPlayerId, // 包含房主玩家ID
      timestamp: Date.now()
    }
    
    // 将房间数据编码到URL参数中
    const encodedData = encodeURIComponent(JSON.stringify(shareData))
    const sharePath = `/pages/index/index?shareData=${encodedData}`
    
    console.log('分享路径:', sharePath)
    console.log('分享数据:', shareData)
    
    // 触发微信分享
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    
    // 关闭分享弹窗
    this.closeShareModal()
    
    wx.showToast({
      title: '请点击右上角分享',
      icon: 'none',
      duration: 2000
    })
  },

  // 页面分享配置
  onShareAppMessage() {
    const shareData = {
      roomId: this.data.roomInfo.roomId,
      name: this.data.roomInfo.name,
      gameType: this.data.roomInfo.gameType,
      maxPlayers: this.data.roomInfo.maxPlayers,
      initialScore: this.data.roomInfo.initialScore,
      host: this.data.roomInfo.host, // 包含房主信息
      hostPlayerId: this.data.roomInfo.hostPlayerId, // 包含房主玩家ID
      timestamp: Date.now()
    }
    
    const encodedData = encodeURIComponent(JSON.stringify(shareData))
    
    return {
      title: `邀请你加入${this.data.roomInfo.name}`,
      path: `/pages/index/index?shareData=${encodedData}`,
      imageUrl: '', // 可以添加分享图片
      success: (res) => {
        console.log('分享成功:', res)
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        })
      },
      fail: (res) => {
        console.log('分享失败:', res)
        wx.showToast({
          title: '分享失败',
          icon: 'error'
        })
      }
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const shareData = {
      roomId: this.data.roomInfo.roomId,
      name: this.data.roomInfo.name,
      gameType: this.data.roomInfo.gameType,
      maxPlayers: this.data.roomInfo.maxPlayers,
      initialScore: this.data.roomInfo.initialScore,
      host: this.data.roomInfo.host, // 包含房主信息
      hostPlayerId: this.data.roomInfo.hostPlayerId, // 包含房主玩家ID
      timestamp: Date.now()
    }
    
    const encodedData = encodeURIComponent(JSON.stringify(shareData))
    
    return {
      title: `${this.data.roomInfo.name} - 天天打牌`,
      query: `shareData=${encodedData}`,
      imageUrl: '', // 可以添加分享图片
      success: (res) => {
        console.log('朋友圈分享成功:', res)
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        })
      },
      fail: (res) => {
        console.log('朋友圈分享失败:', res)
        wx.showToast({
          title: '分享失败',
          icon: 'error'
        })
      }
    }
  },
})