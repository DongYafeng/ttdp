// 多客人同时加入房间测试
// 测试房主能否看到多个客人同时加入

// 模拟微信小程序存储
const storage = {}
const wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value },
  removeStorageSync: (key) => { delete storage[key] }
}

// 简化的房间同步类
class RoomSync {
  constructor() {
    this.syncInterval = null
    this.hostSyncInterval = null
    this.roomId = null
    this.isHost = false
    this.syncCallbacks = []
  }

  initSync(roomId, isHost = false) {
    this.roomId = roomId
    this.isHost = isHost
    
    console.log(`初始化房间同步: ${roomId}, 是否房主: ${isHost}`)
    
    if (isHost) {
      this.startHostBroadcast()
    }
  }

  startHostBroadcast() {
    this.broadcastRoomData()
    
    this.syncInterval = setInterval(() => {
      this.broadcastRoomData()
    }, 5000)
    
    // 房主检查新玩家 - 500毫秒检查一次
    this.hostSyncInterval = setInterval(() => {
      this.hostSyncNewPlayers()
    }, 500)
    
    console.log('房主模式：只广播数据，不从云端同步')
  }

  broadcastRoomData() {
    if (!this.roomId) return
    
    const roomData = wx.getStorageSync(`room_${this.roomId}`)
    if (!roomData) return
    
    roomData.lastSync = Date.now()
    roomData.syncVersion = (roomData.syncVersion || 0) + 1
    
    wx.setStorageSync(`cloud_room_${this.roomId}`, roomData)
    
    console.log(`房主广播房间数据: ${this.roomId}, 版本: ${roomData.syncVersion}`)
  }

  submitPlayerToHost(playerData) {
    try {
      console.log('客人准备提交新玩家信息:', playerData.nickName, '玩家ID:', playerData.playerId)
      
      let guestPlayers = wx.getStorageSync(`guest_players_${this.roomId}`) || []
      
      const existingSubmission = guestPlayers.find(p => p.playerId === playerData.playerId)
      if (!existingSubmission) {
        guestPlayers.push(playerData)
        
        wx.setStorageSync(`guest_players_${this.roomId}`, guestPlayers)
        
        console.log('客人成功提交新玩家信息给房主:', playerData.nickName)
        
        this.triggerHostSyncNewPlayers()
      } else {
        console.log('玩家信息已经提交过，跳过:', playerData.nickName)
      }
    } catch (error) {
      console.error('提交玩家信息给房主失败:', error)
    }
  }

  hostSyncNewPlayers() {
    if (!this.roomId) return
    
    try {
      const guestPlayersData = wx.getStorageSync(`guest_players_${this.roomId}`)
      if (!guestPlayersData || !Array.isArray(guestPlayersData) || guestPlayersData.length === 0) {
        return
      }
      
      console.log('房主检查到新玩家信息:', guestPlayersData.map(p => p.nickName))
      
      const roomData = wx.getStorageSync(`room_${this.roomId}`)
      if (!roomData) {
        console.error('房主获取房间数据失败')
        return
      }
      
      let hasNewPlayers = false
      
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
        
        wx.setStorageSync(`room_${this.roomId}`, roomData)
        
        this.broadcastRoomData()
        
        wx.removeStorageSync(`guest_players_${this.roomId}`)
        
        console.log('房主成功处理新玩家，已通知页面更新和客人同步')
      }
    } catch (error) {
      console.error('房主同步新玩家失败:', error)
    }
  }

  triggerHostSyncNewPlayers() {
    console.log('立即触发房主检查新玩家')
    setTimeout(() => {
      this.hostSyncNewPlayers()
    }, 100)
  }

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

  cleanupRoom(roomId) {
    try {
      wx.removeStorageSync(`room_${roomId}`)
      wx.removeStorageSync(`cloud_room_${roomId}`)
      wx.removeStorageSync(`guest_players_${roomId}`)
      
      console.log(`房间数据已清理: ${roomId}`)
    } catch (error) {
      console.error('清理房间数据失败:', error)
    }
  }
}

// 测试函数
async function testMultiGuestJoin() {
  console.log('=== 多客人同时加入房间测试 ===\n')
  
  const roomSync = new RoomSync()
  const roomId = 'test_room_456'
  
  // 1. 创建房间（房主）
  console.log('1. 房主创建房间')
  const hostPlayer = {
    nickName: '房主',
    avatarUrl: '/images/host-avatar.jpg',
    score: 0,
    isHost: true,
    playerId: 'host_001'
  }
  
  const roomData = {
    roomId: roomId,
    name: '多人测试房间',
    gameType: '掼蛋',
    maxPlayers: 4,
    initialScore: 0,
    host: { nickName: '房主', avatarUrl: '/images/host-avatar.jpg' },
    hostPlayerId: 'host_001',
    players: [hostPlayer],
    createTime: Date.now(),
    syncVersion: 1
  }
  
  wx.setStorageSync(`room_${roomId}`, roomData)
  console.log('房间创建完成，初始玩家:', roomData.players.map(p => p.nickName))
  
  // 2. 初始化房主同步
  console.log('\n2. 初始化房主同步')
  roomSync.initSync(roomId, true)
  
  await new Promise(resolve => setTimeout(resolve, 200))
  
  // 3. 模拟多个客人同时加入房间
  console.log('\n3. 多个客人同时加入房间')
  
  const guests = [
    {
      nickName: '客人1',
      avatarUrl: '/images/guest1-avatar.jpg',
      score: 0,
      isHost: false,
      playerId: 'guest_001',
      joinTime: Date.now()
    },
    {
      nickName: '客人2',
      avatarUrl: '/images/guest2-avatar.jpg',
      score: 0,
      isHost: false,
      playerId: 'guest_002',
      joinTime: Date.now() + 50
    },
    {
      nickName: '客人3',
      avatarUrl: '/images/guest3-avatar.jpg',
      score: 0,
      isHost: false,
      playerId: 'guest_003',
      joinTime: Date.now() + 100
    }
  ]
  
  // 模拟客人快速连续加入
  console.log('客人们快速连续提交玩家信息...')
  guests.forEach((guest, index) => {
    setTimeout(() => {
      console.log(`${guest.nickName} 提交玩家信息`)
      roomSync.submitPlayerToHost(guest)
    }, index * 50) // 每50毫秒一个客人
  })
  
  // 4. 等待房主处理所有新玩家
  console.log('\n4. 等待房主处理所有新玩家...')
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // 5. 检查房主是否能看到所有新玩家
  console.log('\n5. 检查房主房间数据')
  const hostRoomData = wx.getStorageSync(`room_${roomId}`)
  console.log('房主看到的玩家列表:')
  hostRoomData.players.forEach((player, index) => {
    console.log(`  ${index + 1}. ${player.nickName} (${player.isHost ? '房主' : '客人'}) - ID: ${player.playerId}`)
  })
  
  // 6. 验证结果
  console.log('\n6. 验证结果')
  const expectedPlayers = 4 // 1个房主 + 3个客人
  const actualPlayers = hostRoomData.players.length
  
  if (actualPlayers === expectedPlayers) {
    console.log('✅ 测试通过：房主能正确看到所有玩家')
    console.log(`   预期玩家数: ${expectedPlayers}, 实际玩家数: ${actualPlayers}`)
    
    // 检查每个客人是否都能被房主看到
    let allGuestsVisible = true
    guests.forEach(guest => {
      const hasGuest = hostRoomData.players.some(p => p.playerId === guest.playerId)
      if (hasGuest) {
        console.log(`✅ 房主能看到 ${guest.nickName}`)
      } else {
        console.log(`❌ 房主看不到 ${guest.nickName}`)
        allGuestsVisible = false
      }
    })
    
    if (allGuestsVisible) {
      console.log('✅ 所有客人都能被房主看到')
    } else {
      console.log('❌ 部分客人无法被房主看到')
    }
  } else {
    console.log('❌ 测试失败：房主看不到正确的玩家数量')
    console.log(`   预期玩家数: ${expectedPlayers}, 实际玩家数: ${actualPlayers}`)
  }
  
  // 7. 测试房间满员情况
  console.log('\n7. 测试房间满员后的处理')
  if (hostRoomData.players.length === hostRoomData.maxPlayers) {
    console.log('✅ 房间已满员，符合预期')
  } else {
    console.log(`房间当前人数: ${hostRoomData.players.length}/${hostRoomData.maxPlayers}`)
  }
  
  // 8. 清理
  console.log('\n8. 清理测试数据')
  roomSync.stopSync()
  roomSync.cleanupRoom(roomId)
  
  console.log('\n=== 测试完成 ===')
}

// 运行测试
testMultiGuestJoin().catch(console.error) 