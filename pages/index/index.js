// index.js
const app = getApp()

Page({
  data: {
  },

  onLoad(options) {
    console.log('首页加载参数:', options)
    
    // 检查是否通过官方小程序码进入（scene参数）
    if (options.scene) {
      this.handleOfficialQRCode(options.scene)
      return
    }
    
    // 检查是否通过分享链接进入
    if (options.shareData) {
      try {
        const shareData = JSON.parse(decodeURIComponent(options.shareData))
        console.log('解析分享数据:', shareData)
        
        // 验证分享数据的时效性
        if (shareData.timestamp) {
          const now = Date.now()
          const shareAge = now - shareData.timestamp
          const maxAge = 30 * 60 * 1000 // 30分钟有效期
          
          if (shareAge > maxAge) {
            wx.showModal({
              title: '分享链接已过期',
              content: '此分享链接已超过30分钟，请向房主索取新的分享链接',
              showCancel: false
            })
            return
          }
        }
        
        // 显示加入房间确认
        wx.showModal({
          title: '加入房间',
          content: `房间名称：${shareData.name}\n游戏类型：${shareData.gameType}\n是否加入此房间？`,
          confirmText: '加入',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.joinRoomWithData(shareData)
            }
          }
        })
      } catch (error) {
        console.log('解析分享数据失败:', error)
        wx.showToast({
          title: '分享链接无效',
          icon: 'error'
        })
      }
    }
  },

  // 处理官方小程序码
  handleOfficialQRCode(scene) {
    console.log('处理官方小程序码scene:', scene)
    
    try {
      // 解析scene参数，格式：roomId=xxx&t=timestamp
      const params = new URLSearchParams(scene)
      const roomId = params.get('roomId')
      const timestamp = params.get('t')
      
      if (!roomId) {
        wx.showToast({
          title: '无效的小程序码',
          icon: 'error'
        })
        return
      }
      
      // 验证时效性
      if (timestamp) {
        const now = Date.now()
        const qrAge = now - parseInt(timestamp)
        const maxAge = 24 * 60 * 60 * 1000 // 24小时有效期
        
        if (qrAge > maxAge) {
          wx.showModal({
            title: '小程序码已过期',
            content: '此小程序码已超过24小时，请向房主索取新的小程序码',
            showCancel: false
          })
          return
        }
      }
      
      console.log('解析到房间ID:', roomId)
      
      // 显示加载提示
      wx.showLoading({
        title: '正在验证房间...',
        mask: true
      })
      
      // 延迟处理，确保页面加载完成
      setTimeout(() => {
        this.joinRoomById(roomId)
      }, 500)
      
    } catch (error) {
      console.error('解析官方小程序码失败:', error)
      wx.showToast({
        title: '小程序码格式错误',
        icon: 'error'
      })
    }
  },

  // 创建房间
  createRoom() {
    wx.navigateTo({
      url: '/pages/create-room/create-room'
    })
  },

  // 扫码进房
  scanCode() {
    wx.scanCode({
      success: (res) => {
        console.log('扫码结果:', res.result)
        
        wx.showLoading({
          title: '解析中...',
          mask: true
        })
        
        try {
          let roomData = null
          
          // 方式1: 解析天天打牌标准格式（新格式）
          try {
            roomData = JSON.parse(res.result)
            if (roomData && roomData.type === 'ttdp-room' && roomData.roomId) {
              console.log('天天打牌格式解析成功:', roomData)
              
              // 验证版本兼容性
              if (roomData.version && roomData.version !== '1.0') {
                wx.hideLoading()
                wx.showModal({
                  title: '版本不兼容',
                  content: '此二维码版本不兼容，请更新小程序到最新版本',
                  showCancel: false
                })
                return
              }
              
              // 验证校验码
              if (roomData.checksum) {
                const expectedChecksum = this.generateChecksum(roomData.roomId)
                if (roomData.checksum !== expectedChecksum) {
                  wx.hideLoading()
                  wx.showModal({
                    title: '二维码已损坏',
                    content: '二维码数据校验失败，请重新获取',
                    showCancel: false
                  })
                  return
                }
              }
              
              // 验证时效性
              if (roomData.timestamp) {
                const now = Date.now()
                const qrAge = now - roomData.timestamp
                const maxAge = 2 * 60 * 60 * 1000 // 2小时有效期
                
                if (qrAge > maxAge) {
                  wx.hideLoading()
                  wx.showModal({
                    title: '二维码已过期',
                    content: '此二维码已超过2小时，请向房主索取新的二维码',
                    showCancel: false
                  })
                  return
                }
              }
              
              wx.hideLoading()
              this.joinRoomWithData(roomData)
              return
            }
          } catch (e) {
            console.log('天天打牌格式解析失败，尝试其他格式:', e)
          }
          
          // 方式2: 解析旧版JSON格式（兼容性）
          try {
            roomData = JSON.parse(res.result)
            if (roomData && roomData.type === 'chess-room' && roomData.roomId) {
              console.log('旧版JSON格式解析成功:', roomData)
              
              // 验证时效性
              if (roomData.timestamp) {
                const now = Date.now()
                const qrAge = now - roomData.timestamp
                const maxAge = 10 * 60 * 1000 // 10分钟有效期
                
                if (qrAge > maxAge) {
                  wx.hideLoading()
                  wx.showModal({
                    title: '二维码已过期',
                    content: '此二维码已超过10分钟，请向房主索取新的二维码',
                    showCancel: false
                  })
                  return
                }
              }
              
              // 对于简化的二维码，需要从本地存储获取完整房间信息
              const localRoomInfo = wx.getStorageSync(`room_${roomData.roomId}`)
              if (localRoomInfo) {
                wx.hideLoading()
                this.joinRoomWithData(localRoomInfo)
              } else {
                wx.hideLoading()
                this.joinRoomById(roomData.roomId)
              }
              return
            }
          } catch (e) {
            console.log('旧版JSON解析失败，尝试其他格式:', e)
          }
          
          // 方式3: 解析简单文本格式（兼容性）
          if (res.result.startsWith('CHESS_ROOM:') || res.result.startsWith('TTDP_ROOM:')) {
            console.log('检测到文本格式二维码')
            try {
              const prefix = res.result.startsWith('TTDP_ROOM:') ? 'TTDP_ROOM:' : 'CHESS_ROOM:'
              const parts = res.result.replace(prefix, '').split('|')
              if (parts.length >= 2) {
                const roomId = parts[0]
                const timestamp = parts.length > 3 ? parseInt(parts[3]) : null
                
                if (timestamp) {
                  const now = Date.now()
                  const qrAge = now - timestamp
                  const maxAge = 10 * 60 * 1000 // 10分钟有效期
                  
                  if (qrAge > maxAge) {
                    wx.hideLoading()
                    wx.showModal({
                      title: '二维码已过期',
                      content: '此二维码已超过10分钟，请向房主索取新的二维码',
                      showCancel: false
                    })
                    return
                  }
                }
                
                console.log('解析到房间ID:', roomId)
                wx.hideLoading()
                this.joinRoomById(roomId)
                return
              }
            } catch (e) {
              console.log('文本格式解析失败:', e)
            }
          }
          
          // 方式4: 解析URL参数格式（兼容性）
          try {
            const urlParams = new URLSearchParams(res.result.split('?')[1] || res.result)
            const roomId = urlParams.get('roomId')
            if (roomId) {
              console.log('URL参数格式解析成功，房间ID:', roomId)
              wx.hideLoading()
              this.joinRoomById(roomId)
              return
            }
          } catch (e) {
            console.log('URL参数解析失败:', e)
          }
          
          // 方式5: 正则匹配房间号（最后尝试）
          const roomIdMatch = res.result.match(/roomId[=:](\w+)/i)
          if (roomIdMatch) {
            const roomId = roomIdMatch[1]
            console.log('正则匹配成功，房间ID:', roomId)
            wx.hideLoading()
            this.joinRoomById(roomId)
            return
          }
          
          // 如果所有解析方式都失败
          wx.hideLoading()
          console.log('无法解析房间信息，二维码内容:', res.result)
          wx.showModal({
            title: '无效的二维码',
            content: '这不是有效的天天打牌房间二维码，请扫描房主分享的二维码',
            showCancel: false,
            confirmText: '我知道了'
          })
        } catch (error) {
          wx.hideLoading()
          console.log('解析二维码失败:', error)
          wx.showModal({
            title: '扫码失败',
            content: '二维码格式不正确，请重新扫描房主分享的二维码',
            showCancel: false,
            confirmText: '重新扫描',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 重新调用扫码
                setTimeout(() => {
                  this.scanCode()
                }, 500)
              }
            }
          })
        }
      },
      fail: (error) => {
        console.log('扫码失败:', error)
        if (error.errMsg !== 'scanCode:fail cancel') {
          wx.showModal({
            title: '扫码失败',
            content: '无法打开相机或扫码功能，请检查权限设置后重试',
            showCancel: false,
            confirmText: '重新尝试',
            success: (modalRes) => {
              if (modalRes.confirm) {
                setTimeout(() => {
                  this.scanCode()
                }, 500)
              }
            }
          })
        }
      }
    })
  },

  // 生成校验码（与房间页面保持一致）
  generateChecksum(roomId) {
    let hash = 0
    for (let i = 0; i < roomId.length; i++) {
      const char = roomId.charCodeAt(i)
      hash = ((hash << 5) - hash + char) & 0xFFFFFF
    }
    return hash.toString(36)
  },

  // 使用二维码中的完整房间数据加入房间
  joinRoomWithData(roomData) {
    // 显示加载提示
    wx.showLoading({
      title: '正在加入房间...',
      mask: true
    })
    
    // 检查本地是否已存在该房间
    let existingRoom = wx.getStorageSync(`room_${roomData.roomId}`)
    
    // 优先尝试从"云端"获取最新房间数据
    const cloudRoomData = wx.getStorageSync(`cloud_room_${roomData.roomId}`)
    
    if (cloudRoomData) {
      // 如果云端有数据，使用云端数据
      console.log('使用云端房间数据')
      existingRoom = cloudRoomData
    } else if (!existingRoom) {
      // 如果本地和云端都没有房间数据，使用分享数据创建基础房间结构
      console.log('创建基础房间结构')
      existingRoom = {
        roomId: roomData.roomId,
        name: roomData.name || `${roomData.gameType || '棋牌'}房间`,
        gameType: roomData.gameType || '其他',
        maxPlayers: roomData.maxPlayers || 8,
        initialScore: roomData.initialScore || 0,
        players: [], // 空的玩家列表，等待加入
        createTime: roomData.timestamp || Date.now(),
        isSharedRoom: true, // 标记这是通过分享创建的房间
        syncVersion: 0 // 初始化同步版本
      }
      
      // 如果分享数据中包含房主信息，添加房主
      if (roomData.host) {
        const hostPlayer = {
          ...roomData.host,
          score: roomData.initialScore || 0,
          isHost: true,
          playerId: roomData.hostPlayerId || generatePlayerId()
        }
        existingRoom.host = roomData.host
        existingRoom.hostPlayerId = hostPlayer.playerId
        existingRoom.players.push(hostPlayer)
      }
    }
    
    // 保存房间信息到本地
    wx.setStorageSync(`room_${roomData.roomId}`, existingRoom)
    
    wx.hideLoading()
    
    // 显示房间信息确认
    wx.showModal({
      title: '确认加入房间',
      content: `房间名称：${existingRoom.name}\n游戏类型：${existingRoom.gameType}\n当前人数：${existingRoom.players.length}/${existingRoom.maxPlayers}`,
      confirmText: '加入',
      cancelText: '取消',
      success: (modalRes) => {
        if (modalRes.confirm) {
          // 检查房间是否已满
          if (existingRoom.players.length >= existingRoom.maxPlayers) {
            wx.showModal({
              title: '房间已满',
              content: `房间已达到最大人数限制(${existingRoom.maxPlayers}人)`,
              showCancel: false
            })
            return
          }
          
          // 跳转到房间页面
          wx.navigateTo({
            url: `/pages/room/room?roomId=${roomData.roomId}&isHost=false`,
            success: () => {
              wx.showToast({
                title: '正在加入房间',
                icon: 'loading',
                duration: 1500
              })
            },
            fail: (error) => {
              console.log('页面跳转失败:', error)
              wx.showToast({
                title: '加入房间失败',
                icon: 'error'
              })
            }
          })
        }
      }
    })
  },

  // 根据房间ID加入房间
  joinRoomById(roomId) {
    console.log('尝试加入房间:', roomId)
    
    // 显示加载提示
    wx.showLoading({
      title: '正在验证房间...',
      mask: true
    })
    
    // 延迟处理，确保加载动画显示
    setTimeout(() => {
      try {
        // 检查房间是否存在
        const roomInfo = wx.getStorageSync(`room_${roomId}`)
        
        wx.hideLoading()
        
        if (!roomInfo) {
          console.log('房间不存在，尝试创建基础房间结构')
          
          // 尝试创建基础房间结构（适用于通过官方小程序码进入的情况）
          const basicRoomInfo = {
            roomId: roomId,
            name: `房间 ${roomId.substr(-4)}`,
            gameType: '棋牌游戏',
            maxPlayers: 8,
            initialScore: 0,
            players: [],
            createTime: Date.now(),
            isSharedRoom: true,
            syncVersion: 0
          }
          
          // 保存基础房间信息
          wx.setStorageSync(`room_${roomId}`, basicRoomInfo)
          
          wx.showModal({
            title: '创建房间',
            content: `房间 ${roomId.substr(-4)} 不存在，是否创建新房间？\n\n注意：如果您是通过扫码进入，请确认二维码是否正确`,
            confirmText: '创建并加入',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.navigateToRoom(roomId, false)
              }
            }
          })
          return
        }
        
        // 验证房间数据完整性
        if (!this.validateRoomData(roomInfo)) {
          wx.showModal({
            title: '房间数据异常',
            content: '房间数据不完整，是否尝试修复？',
            confirmText: '修复',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                const repairedRoom = this.repairRoomData(roomInfo)
                wx.setStorageSync(`room_${roomId}`, repairedRoom)
                this.showJoinConfirmation(repairedRoom)
              }
            }
          })
          return
        }
        
        // 检查房间是否已满
        if (roomInfo.players && roomInfo.players.length >= roomInfo.maxPlayers) {
          wx.showModal({
            title: '房间已满',
            content: `房间已达到最大人数限制(${roomInfo.maxPlayers}人)，无法加入`,
            showCancel: false,
            confirmText: '我知道了'
          })
          return
        }
        
        // 显示加入确认
        this.showJoinConfirmation(roomInfo)
        
      } catch (error) {
        wx.hideLoading()
        console.error('加入房间失败:', error)
        
        wx.showModal({
          title: '加入失败',
          content: '加入房间时发生错误，请重试',
          confirmText: '重试',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 重试加入
              setTimeout(() => {
                this.joinRoomById(roomId)
              }, 500)
            }
          }
        })
      }
    }, 300)
  },

  // 验证房间数据完整性
  validateRoomData(roomInfo) {
    if (!roomInfo) return false
    if (!roomInfo.roomId) return false
    if (!roomInfo.name) return false
    if (!roomInfo.gameType) return false
    if (typeof roomInfo.maxPlayers !== 'number') return false
    if (!Array.isArray(roomInfo.players)) return false
    return true
  },

  // 修复房间数据
  repairRoomData(roomInfo) {
    const repaired = {
      roomId: roomInfo.roomId || 'unknown',
      name: roomInfo.name || `房间 ${(roomInfo.roomId || '').substr(-4)}`,
      gameType: roomInfo.gameType || '棋牌游戏',
      maxPlayers: roomInfo.maxPlayers || 8,
      initialScore: roomInfo.initialScore || 0,
      players: Array.isArray(roomInfo.players) ? roomInfo.players : [],
      createTime: roomInfo.createTime || Date.now(),
      isSharedRoom: roomInfo.isSharedRoom || false,
      syncVersion: roomInfo.syncVersion || 0,
      host: roomInfo.host || null,
      hostPlayerId: roomInfo.hostPlayerId || null
    }
    
    console.log('房间数据已修复:', repaired)
    return repaired
  },

  // 显示加入确认对话框
  showJoinConfirmation(roomInfo) {
    const playerCount = roomInfo.players ? roomInfo.players.length : 0
    
    wx.showModal({
      title: '确认加入房间',
      content: `房间名称：${roomInfo.name}\n游戏类型：${roomInfo.gameType}\n当前人数：${playerCount}/${roomInfo.maxPlayers}\n\n确定要加入此房间吗？`,
      confirmText: '加入',
      cancelText: '取消',
      success: (modalRes) => {
        if (modalRes.confirm) {
          this.navigateToRoom(roomInfo.roomId, false)
        }
      }
    })
  },

  // 导航到房间页面
  navigateToRoom(roomId, isHost) {
    wx.showLoading({
      title: '正在进入房间...',
      mask: true
    })
    
    wx.navigateTo({
      url: `/pages/room/room?roomId=${roomId}&isHost=${isHost}`,
      success: () => {
        wx.hideLoading()
        console.log('成功进入房间:', roomId)
      },
      fail: (error) => {
        wx.hideLoading()
        console.error('页面跳转失败:', error)
        
        wx.showModal({
          title: '进入房间失败',
          content: '页面跳转失败，请重试',
          confirmText: '重试',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              setTimeout(() => {
                this.navigateToRoom(roomId, isHost)
              }, 500)
            }
          }
        })
      }
    })
  }
})

// 添加工具方法
function generatePlayerId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 3)
}