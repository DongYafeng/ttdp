// roomSync.js - 房间数据同步工具
// 模拟云端数据同步功能

class RoomSync {
  constructor() {
    this.syncInterval = null
    this.roomId = null
    this.isHost = false
    this.syncCallbacks = []
  }

  // 初始化房间同步
  initSync(roomId, isHost = false) {
    this.roomId = roomId
    this.isHost = isHost
    
    console.log(`初始化房间同步: ${roomId}, 是否房主: ${isHost}`)
    
    // 如果是房主，定期广播房间数据
    if (isHost) {
      this.startHostBroadcast()
    } else {
      // 如果不是房主，定期同步房间数据
      this.startGuestSync()
    }
  }

  // 房主广播房间数据
  startHostBroadcast() {
    // 立即广播一次
    this.broadcastRoomData()
    
    // 每5秒广播一次房间数据
    this.syncInterval = setInterval(() => {
      this.broadcastRoomData()
    }, 5000)
    
    // 房主需要频繁检查是否有新玩家加入 - 优化为500毫秒检查一次
    this.hostSyncInterval = setInterval(() => {
      this.hostSyncNewPlayers()
    }, 500) // 从2000毫秒优化为500毫秒，确保快速响应
    
    // 移除房主从云端同步的逻辑，因为房主本身就是数据源头
    // 房主从云端同步可能会覆盖刚添加的新玩家数据，导致房主看不见新玩家
    console.log('房主模式：只广播数据，不从云端同步')
  }

  // 客人同步房间数据
  startGuestSync() {
    // 立即同步一次
    this.syncRoomData()
    
    // 优化客人同步频率为1秒，确保快速看到新玩家
    this.syncInterval = setInterval(() => {
      this.syncRoomData()
    }, 1000) // 从3000毫秒优化为1000毫秒
  }

  // 广播房间数据（房主使用）
  broadcastRoomData() {
    if (!this.roomId) return
    
    const roomData = wx.getStorageSync(`room_${this.roomId}`)
    if (!roomData) return
    
    // 添加同步时间戳
    roomData.lastSync = Date.now()
    roomData.syncVersion = (roomData.syncVersion || 0) + 1
    
    // 保存到"云端"存储（使用特殊的key模拟）
    wx.setStorageSync(`cloud_room_${this.roomId}`, roomData)
    
    console.log(`房主广播房间数据: ${this.roomId}, 版本: ${roomData.syncVersion}`)
  }

  // 同步房间数据（客人使用）
  syncRoomData() {
    if (!this.roomId) return
    
    try {
      // 检查是否有同步触发标记
      const syncTrigger = wx.getStorageSync(`sync_trigger_${this.roomId}`)
      let shouldForceSync = false
      
      if (syncTrigger && syncTrigger.timestamp) {
        // 检查触发时间是否在最近5秒内
        const timeDiff = Date.now() - syncTrigger.timestamp
        if (timeDiff < 5000) {
          shouldForceSync = true
          console.log('检测到同步触发标记，立即同步')
        }
      }
      
      // 从"云端"获取最新房间数据
      const cloudRoomData = wx.getStorageSync(`cloud_room_${this.roomId}`)
      if (!cloudRoomData) {
        console.log('云端暂无房间数据')
        return
      }
      
      // 获取本地房间数据
      const localRoomData = wx.getStorageSync(`room_${this.roomId}`)
      
      // 比较版本，如果云端数据更新或有强制同步标记，则同步
      if (shouldForceSync || !localRoomData || !localRoomData.syncVersion || 
          cloudRoomData.syncVersion > localRoomData.syncVersion) {
        
        console.log(`同步房间数据: 本地版本 ${localRoomData?.syncVersion || 0} -> 云端版本 ${cloudRoomData.syncVersion}${shouldForceSync ? ' (强制同步)' : ''}`)
        
        // 保留当前用户的playerId
        const currentPlayerId = localRoomData?.currentPlayerId
        
        // 合并数据：保留本地用户信息，同步其他玩家信息
        const mergedData = this.mergeRoomData(localRoomData, cloudRoomData, currentPlayerId)
        
        // 更新本地存储
        wx.setStorageSync(`room_${this.roomId}`, mergedData)
        
        // 通知页面更新
        this.notifyDataUpdate(mergedData)
        
        // 如果是强制同步，清理触发标记
        if (shouldForceSync) {
          wx.removeStorageSync(`sync_trigger_${this.roomId}`)
        }
      }
    } catch (error) {
      console.error('同步房间数据失败:', error)
    }
  }

  // 合并房间数据
  mergeRoomData(localData, cloudData, currentPlayerId) {
    // 以云端数据为基础
    const mergedData = { ...cloudData }
    
    // 如果本地有当前用户信息，确保保留
    if (localData && currentPlayerId) {
      const localCurrentPlayer = localData.players?.find(p => p.playerId === currentPlayerId)
      if (localCurrentPlayer) {
        // 在云端数据中查找或添加当前用户
        const cloudPlayerIndex = mergedData.players.findIndex(p => p.playerId === currentPlayerId)
        if (cloudPlayerIndex >= 0) {
          // 更新云端数据中的当前用户信息
          mergedData.players[cloudPlayerIndex] = { ...mergedData.players[cloudPlayerIndex], ...localCurrentPlayer }
        } else {
          // 如果云端数据中没有当前用户，添加进去
          mergedData.players.push(localCurrentPlayer)
        }
      }
      
      // 保留当前用户ID
      mergedData.currentPlayerId = currentPlayerId
    }
    
    return mergedData
  }

  // 添加数据更新回调
  onDataUpdate(callback) {
    this.syncCallbacks.push(callback)
  }

  // 通知数据更新
  notifyDataUpdate(roomData) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(roomData)
      } catch (error) {
        console.error('数据更新回调执行失败:', error)
      }
    })
  }

  // 手动触发同步
  forcSync() {
    if (this.isHost) {
      this.broadcastRoomData()
    } else {
      this.syncRoomData()
    }
  }

  // 更新玩家信息
  updatePlayer(playerId, playerData) {
    if (!this.roomId) return
    
    const roomData = wx.getStorageSync(`room_${this.roomId}`)
    if (!roomData) return
    
    const playerIndex = roomData.players.findIndex(p => p.playerId === playerId)
    if (playerIndex >= 0) {
      roomData.players[playerIndex] = { ...roomData.players[playerIndex], ...playerData }
      
      // 更新本地存储
      wx.setStorageSync(`room_${this.roomId}`, roomData)
      
      // 如果是房主，立即广播
      if (this.isHost) {
        this.broadcastRoomData()
      }
    }
  }

  // 添加新玩家
  addPlayer(playerData) {
    if (!this.roomId) return
    
    const roomData = wx.getStorageSync(`room_${this.roomId}`)
    if (!roomData) return
    
    // 检查玩家是否已存在
    const existingPlayer = roomData.players.find(p => p.playerId === playerData.playerId)
    if (!existingPlayer) {
      roomData.players.push(playerData)
      
      // 更新本地存储
      wx.setStorageSync(`room_${this.roomId}`, roomData)
      
      // 立即通知页面更新，确保当前设备能立即看到新玩家
      this.notifyDataUpdate(roomData)
      
      // 如果是房主，立即广播
      if (this.isHost) {
        this.broadcastRoomData()
        // 房主添加新玩家后，立即触发所有客人同步
        this.triggerAllGuestsSync()
      } else {
        // 如果是客人，将新玩家信息提交给房主
        this.submitPlayerToHost(playerData)
      }
    }
  }

  // 客人向房主提交新玩家信息
  submitPlayerToHost(playerData) {
    try {
      console.log('客人准备提交新玩家信息:', playerData.nickName, '玩家ID:', playerData.playerId)
      
      // 获取现有的客人玩家数据
      let guestPlayers = wx.getStorageSync(`guest_players_${this.roomId}`) || []
      console.log('当前guest_players存储:', guestPlayers)
      
      // 检查是否已经提交过
      const existingSubmission = guestPlayers.find(p => p.playerId === playerData.playerId)
      if (!existingSubmission) {
        guestPlayers.push(playerData)
        
        // 保存到特殊的存储位置供房主读取
        wx.setStorageSync(`guest_players_${this.roomId}`, guestPlayers)
        
        console.log('客人成功提交新玩家信息给房主:', playerData.nickName)
        console.log('更新后的guest_players存储:', guestPlayers)
        
        // 新增：立即触发房主检查新玩家，无需等待定时器
        this.triggerHostSyncNewPlayers()
      } else {
        console.log('玩家信息已经提交过，跳过:', playerData.nickName)
      }
    } catch (error) {
      console.error('提交玩家信息给房主失败:', error)
    }
  }

  // 停止同步
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    
    if (this.hostSyncInterval) {
      clearInterval(this.hostSyncInterval)
      this.hostSyncInterval = null
    }
    
    this.roomId = null
    this.isHost = false
    this.syncCallbacks = []
    
    console.log('房间同步已停止')
  }

  // 清理房间数据
  cleanupRoom(roomId) {
    try {
      // 清理本地数据
      wx.removeStorageSync(`room_${roomId}`)
      wx.removeStorageSync(`history_${roomId}`)
      
      // 清理云端数据（仅房主）
      if (this.isHost) {
        wx.removeStorageSync(`cloud_room_${roomId}`)
      }
      
      // 清理客人玩家数据
      wx.removeStorageSync(`guest_players_${roomId}`)
      
      // 清理同步触发标记
      wx.removeStorageSync(`sync_trigger_${roomId}`)
      
      console.log(`房间数据已清理: ${roomId}`)
    } catch (error) {
      console.error('清理房间数据失败:', error)
    }
  }

  // 房主检查并同步新玩家信息
  hostSyncNewPlayers() {
    if (!this.roomId) return
    
    try {
      // 检查是否有客人提交的新玩家信息
      const guestPlayersData = wx.getStorageSync(`guest_players_${this.roomId}`)
      if (!guestPlayersData || !Array.isArray(guestPlayersData) || guestPlayersData.length === 0) {
        return
      }
      
      console.log('房主检查到新玩家信息:', guestPlayersData)
      
      // 获取当前房间数据
      const roomData = wx.getStorageSync(`room_${this.roomId}`)
      if (!roomData) {
        console.error('房主获取房间数据失败')
        return
      }
      
      console.log('房主当前房间数据:', roomData)
      
      let hasNewPlayers = false
      
      // 将新玩家添加到房间中
      guestPlayersData.forEach(newPlayer => {
        const existingPlayer = roomData.players.find(p => p.playerId === newPlayer.playerId)
        if (!existingPlayer) {
          console.log('房主添加新玩家:', newPlayer.nickName, '玩家ID:', newPlayer.playerId)
          roomData.players.push(newPlayer)
          hasNewPlayers = true
        } else {
          console.log('玩家已存在，跳过:', newPlayer.nickName)
        }
      })
      
      if (hasNewPlayers) {
        console.log('房主更新后的玩家列表:', roomData.players.map(p => ({ nickName: p.nickName, playerId: p.playerId, isHost: p.isHost })))
        
        // 更新本地存储
        wx.setStorageSync(`room_${this.roomId}`, roomData)
        
        // 立即广播更新后的房间数据
        this.broadcastRoomData()
        
        // 通知页面更新 - 确保房主页面立即显示新玩家
        this.notifyDataUpdate(roomData)
        
        // 清理已处理的客人玩家数据
        wx.removeStorageSync(`guest_players_${this.roomId}`)
        
        // 新增：触发所有客人立即同步，确保他们能立即看到新玩家
        this.triggerAllGuestsSync()
        
        console.log('房主成功处理新玩家，已通知页面更新和客人同步')
      } else {
        console.log('没有新玩家需要添加')
      }
    } catch (error) {
      console.error('房主同步新玩家失败:', error)
    }
  }

  // 新增：立即触发房主检查新玩家（无需等待定时器）
  triggerHostSyncNewPlayers() {
    console.log('立即触发房主检查新玩家')
    // 使用短延迟确保数据已保存
    setTimeout(() => {
      console.log('执行房主检查新玩家')
      this.hostSyncNewPlayers()
    }, 100)
  }

  // 新增：触发所有客人立即同步
  triggerAllGuestsSync() {
    try {
      // 设置一个特殊的同步触发标记
      const syncTrigger = {
        timestamp: Date.now(),
        roomId: this.roomId,
        action: 'new_player_joined'
      }
      
      wx.setStorageSync(`sync_trigger_${this.roomId}`, syncTrigger)
      
      console.log('触发所有客人立即同步')
    } catch (error) {
      console.error('触发客人同步失败:', error)
    }
  }
}

// 创建全局实例
const roomSync = new RoomSync()

// 兼容 CommonJS 和 ES 模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = roomSync
} else if (typeof exports !== 'undefined') {
  exports.default = roomSync
} 