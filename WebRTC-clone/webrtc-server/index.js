const socket = require('socket.io')
const http = require('http')
const server = http.createServer()

const io = socket(server, {
  cors: { origin: '*' },
})

io.on('connection', (sock) => {
  console.log('server connect success')
  // 通知客户端
  sock.emit('connectionSuccess')
  // 监听房间创建信息
  sock.on('joinRoom', (roomId) => {
    // 加入房间
    sock.join(roomId)
  })
  // 监听发起通话请求
  sock.on('callRemote', (roomId) => {
    // 触发一个收到请求事件-向这个房间中的所有人广播这个事件
    io.to(roomId).emit('receiveCall')
  })
  // 监听接受通话请求
  sock.on('acceptCall', (roomId) => {
    // 向这个房间中的所有人广播这个事件
    io.to(roomId).emit('acceptCall')
  })
  // 监听发起者的发送offer事件
  sock.on('sendOffer', ({ roomId, offer }) => {
    // 广播发送offer事件给接收者
    io.to(roomId).emit('sendOffer', offer)
  })

  // 监听接收者的发送answer事件
  sock.on('sendAnswer', ({ roomId, answer }) => {
    // A要接收answer 广播receiveAnswer给发起者
    io.to(roomId).emit('receiveAnswer', answer)
  })

  // 监听A发送candidate事件
  sock.on('sendCandidate', ({ roomId, candidate }) => {
    // 广播sendCandidate给接收者
    io.to(roomId).emit('receiveCandidate', candidate)
  })

  // 监听拒绝/挂断事件
  sock.on('hangUp', (roomId) => {
    // 广播hangUp给接收者
    io.to(roomId).emit('hangUp')
  })
})

server.listen(3000, () => {
  console.log('server is running at 3000')
})
