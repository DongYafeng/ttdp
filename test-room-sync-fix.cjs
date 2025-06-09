// 房间同步问题修复测试
// 测试房主能否看到新加入的玩家

// 模拟微信小程序存储
const storage = {}
global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value },
  removeStorageSync: (key) => { delete storage[key] }
}

// 引入房间同步模块
const roomSync = require('./utils/roomSync.js')

// 调试导入的对象
console.log('导入的roomSync对象:', roomSync)
console.log('roomSync类型:', typeof roomSync)
console.log('roomSync方法:', Object.getOwnPropertyNames(roomSync))

// 测试函数
async function testRoomSyncFix() {
  console.log('=== 房间同步问题修复测试 ===\n')
  
  const roomId = 'test_room_123'
  
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
    name: '测试房间',
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
  
  // 等待一下确保同步启动
  await new Promise(resolve => setTimeout(resolve, 200))
  
  // 3. 模拟客人加入房间
  console.log('\n3. 客人加入房间')
  const guestPlayer = {
    nickName: '客人1',
    avatarUrl: '/images/guest1-avatar.jpg',
    score: 0,
    isHost: false,
    playerId: 'guest_001',
    joinTime: Date.now()
  }
  
  // 模拟客人提交玩家信息
  console.log('客人提交玩家信息...')
  roomSync.submitPlayerToHost(guestPlayer)
  
  // 4. 等待房主处理
  console.log('\n4. 等待房主处理新玩家...')
  await new Promise(resolve => setTimeout(resolve, 600)) // 等待600毫秒
  
  // 5. 检查房主是否能看到新玩家
  console.log('\n5. 检查房主房间数据')
  const hostRoomData = wx.getStorageSync(`room_${roomId}`)
  console.log('房主看到的玩家列表:')
  hostRoomData.players.forEach((player, index) => {
    console.log(`  ${index + 1}. ${player.nickName} (${player.isHost ? '房主' : '客人'}) - ID: ${player.playerId}`)
  })
  
  // 6. 检查云端数据
  console.log('\n6. 检查云端数据')
  const cloudData = wx.getStorageSync(`cloud_room_${roomId}`)
  if (cloudData) {
    console.log('云端玩家列表:')
    cloudData.players.forEach((player, index) => {
      console.log(`  ${index + 1}. ${player.nickName} (${player.isHost ? '房主' : '客人'}) - ID: ${player.playerId}`)
    })
  } else {
    console.log('云端暂无数据')
  }
  
  // 7. 验证结果
  console.log('\n7. 验证结果')
  const expectedPlayers = 2 // 房主 + 1个客人
  const actualPlayers = hostRoomData.players.length
  
  if (actualPlayers === expectedPlayers) {
    console.log('✅ 测试通过：房主能正确看到所有玩家')
    console.log(`   预期玩家数: ${expectedPlayers}, 实际玩家数: ${actualPlayers}`)
    
    // 检查是否包含客人
    const hasGuest = hostRoomData.players.some(p => p.playerId === guestPlayer.playerId)
    if (hasGuest) {
      console.log('✅ 房主能看到新加入的客人')
    } else {
      console.log('❌ 房主看不到新加入的客人')
    }
  } else {
    console.log('❌ 测试失败：房主看不到正确的玩家数量')
    console.log(`   预期玩家数: ${expectedPlayers}, 实际玩家数: ${actualPlayers}`)
  }
  
  // 8. 测试第二个客人加入
  console.log('\n8. 测试第二个客人加入')
  const guestPlayer2 = {
    nickName: '客人2',
    avatarUrl: '/images/guest2-avatar.jpg',
    score: 0,
    isHost: false,
    playerId: 'guest_002',
    joinTime: Date.now()
  }
  
  console.log('第二个客人提交玩家信息...')
  roomSync.submitPlayerToHost(guestPlayer2)
  
  // 等待处理
  await new Promise(resolve => setTimeout(resolve, 600))
  
  // 检查最终结果
  const finalRoomData = wx.getStorageSync(`room_${roomId}`)
  console.log('\n最终房主看到的玩家列表:')
  finalRoomData.players.forEach((player, index) => {
    console.log(`  ${index + 1}. ${player.nickName} (${player.isHost ? '房主' : '客人'}) - ID: ${player.playerId}`)
  })
  
  const finalExpectedPlayers = 3 // 房主 + 2个客人
  const finalActualPlayers = finalRoomData.players.length
  
  if (finalActualPlayers === finalExpectedPlayers) {
    console.log('✅ 最终测试通过：房主能看到所有玩家')
  } else {
    console.log('❌ 最终测试失败：房主看不到所有玩家')
  }
  
  // 9. 清理
  console.log('\n9. 清理测试数据')
  roomSync.stopSync()
  roomSync.cleanupRoom(roomId)
  
  console.log('\n=== 测试完成 ===')
}

// 运行测试
testRoomSyncFix().catch(console.error) 